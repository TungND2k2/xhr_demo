import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import { payload, PayloadError } from "../payload/client.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = ReturnType<typeof tool<any>>;

function ok(text: string): CallToolResult {
  return { content: [{ type: "text" as const, text }] };
}
function err(message: string): CallToolResult {
  return { content: [{ type: "text" as const, text: `⚠️ ${message}` }], isError: true };
}

interface EmployeeLite {
  id: string;
  employeeCode?: string;
  fullName?: string;
  userAccount?: { id: string } | string | null;
}
interface AssetLite {
  id: string;
  assetCode?: string;
  name?: string;
  status?: string;
}

/**
 * bulk_release_assets — gỡ assignedTo + đổi status='in_stock' cho tất cả
 * tài sản đang gán cho 1 nhân viên. Dùng sau khi HCNS thu hồi xong tài sản
 * của nhân viên đã nghỉ việc.
 */
const bulk_release_assets = tool(
  "bulk_release_assets",
  `Gỡ assignedTo + chuyển tất cả tài sản đang gán cho 1 nhân viên về kho.

Khi dùng:
- HCNS đã thu hồi xong tài sản của nhân viên nghỉ việc → user nhắn "bulk
  release tài sản nhân viên EMP-001" hoặc "đã thu hồi xong tài sản chị Hoa".
- Tool tìm Employee → resolve userAccount → list assets assignedTo=user
  → clear assignedTo + set status='in_stock' cho từng asset.

Tham số:
- employeeId: ID Employee (ưu tiên nếu có)
- employeeCode: vd "EMP-001" (lookup nếu không có ID)

Trả về: danh sách tài sản đã giải phóng.`,
  {
    employeeId: z.string().optional().describe("ID Employee"),
    employeeCode: z.string().optional().describe('Mã NV, vd "EMP-001"'),
  },
  async (args) => {
    if (!args.employeeId && !args.employeeCode) {
      return err("Cần employeeId hoặc employeeCode.");
    }

    try {
      // 1. Resolve Employee
      let employee: EmployeeLite | undefined;
      if (args.employeeId) {
        employee = await payload.request<EmployeeLite>(
          `/api/employees/${encodeURIComponent(args.employeeId)}?depth=1`,
        );
      } else if (args.employeeCode) {
        const res = await payload.request<{ docs: EmployeeLite[] }>(`/api/employees`, {
          query: {
            where: { employeeCode: { equals: args.employeeCode } },
            limit: 1,
            depth: 1,
          },
        });
        employee = res.docs[0];
      }
      if (!employee) {
        return err(`Không tìm thấy nhân viên ${args.employeeCode ?? args.employeeId}.`);
      }

      // 2. Resolve user account
      let userId: string | null = null;
      if (employee.userAccount && typeof employee.userAccount === "object") {
        userId = employee.userAccount.id;
      } else if (typeof employee.userAccount === "string") {
        userId = employee.userAccount;
      }
      if (!userId) {
        return err(
          `Nhân viên ${employee.fullName ?? employee.employeeCode} chưa có user account ` +
            `liên kết — không tra được tài sản theo user.`,
        );
      }

      // 3. Query active assets
      const assetsRes = await payload.request<{ docs: AssetLite[] }>(`/api/assets`, {
        query: {
          where: {
            and: [
              { assignedTo: { equals: userId } },
              { status: { in: "in_use,repairing" } },
            ],
          },
          limit: 200,
          depth: 0,
        },
      });
      const assets = assetsRes.docs;
      if (assets.length === 0) {
        return ok(
          `Nhân viên ${employee.fullName ?? employee.employeeCode} không có tài sản nào ` +
            `đang gán (status in_use / repairing). Không có gì cần làm.`,
        );
      }

      // 4. Release từng asset
      const released: string[] = [];
      const failed: string[] = [];
      for (const a of assets) {
        try {
          await payload.request(`/api/assets/${encodeURIComponent(a.id)}`, {
            method: "PATCH",
            body: { assignedTo: null, status: "in_stock" },
          });
          released.push(`✔ ${a.assetCode ?? "(no code)"} — ${a.name ?? "(no name)"}`);
        } catch (e) {
          failed.push(
            `✗ ${a.assetCode ?? a.id} — ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      const summary =
        `✅ Đã giải phóng ${released.length}/${assets.length} tài sản của ` +
        `${employee.fullName ?? employee.employeeCode}:\n\n` +
        released.join("\n") +
        (failed.length > 0 ? `\n\n⚠ Lỗi ${failed.length}:\n${failed.join("\n")}` : "");
      return ok(summary);
    } catch (e) {
      const reason = e instanceof PayloadError ? e.message : e instanceof Error ? e.message : String(e);
      return err(`Bulk release thất bại: ${reason}`);
    }
  },
);

/**
 * list_assets_by_employee — liệt kê tài sản đang gán cho 1 nhân viên (không
 * thay đổi gì). Dùng khi HCNS hỏi "nhân viên X đang giữ tài sản gì".
 */
const list_assets_by_employee = tool(
  "list_assets_by_employee",
  `Liệt kê tài sản đang gán cho 1 nhân viên (không sửa). Dùng khi user hỏi
"X đang giữ tài sản gì" hoặc trước khi bulk_release_assets để confirm.

Tham số: employeeId hoặc employeeCode.`,
  {
    employeeId: z.string().optional(),
    employeeCode: z.string().optional(),
  },
  async (args) => {
    if (!args.employeeId && !args.employeeCode) {
      return err("Cần employeeId hoặc employeeCode.");
    }
    try {
      let employee: EmployeeLite | undefined;
      if (args.employeeId) {
        employee = await payload.request<EmployeeLite>(
          `/api/employees/${encodeURIComponent(args.employeeId)}?depth=1`,
        );
      } else if (args.employeeCode) {
        const res = await payload.request<{ docs: EmployeeLite[] }>(`/api/employees`, {
          query: {
            where: { employeeCode: { equals: args.employeeCode } },
            limit: 1,
            depth: 1,
          },
        });
        employee = res.docs[0];
      }
      if (!employee) {
        return err(`Không tìm thấy nhân viên ${args.employeeCode ?? args.employeeId}.`);
      }

      let userId: string | null = null;
      if (employee.userAccount && typeof employee.userAccount === "object") {
        userId = employee.userAccount.id;
      } else if (typeof employee.userAccount === "string") {
        userId = employee.userAccount;
      }
      if (!userId) {
        return ok(
          `Nhân viên ${employee.fullName ?? employee.employeeCode} chưa có user account ` +
            `liên kết — không tra được tài sản theo user.`,
        );
      }

      const assetsRes = await payload.request<{ docs: AssetLite[] }>(`/api/assets`, {
        query: {
          where: { assignedTo: { equals: userId } },
          limit: 200,
          depth: 0,
          sort: "-purchaseDate",
        },
      });
      const assets = assetsRes.docs;
      if (assets.length === 0) {
        return ok(
          `${employee.fullName ?? employee.employeeCode}: không có tài sản nào đang gán.`,
        );
      }
      const list = assets
        .map(
          (a, i) =>
            `${i + 1}. ${a.assetCode ?? "(no code)"} — ${a.name ?? "(no name)"} (${a.status ?? "?"})`,
        )
        .join("\n");
      return ok(
        `${employee.fullName ?? employee.employeeCode} đang giữ ${assets.length} tài sản:\n\n${list}`,
      );
    } catch (e) {
      const reason = e instanceof PayloadError ? e.message : e instanceof Error ? e.message : String(e);
      return err(`Tra cứu thất bại: ${reason}`);
    }
  },
);

export const assetWorkflowTools: AnyTool[] = [
  bulk_release_assets as AnyTool,
  list_assets_by_employee as AnyTool,
];
