/**
 * Convert MS Office "legacy" formats (.doc, .xls, .ppt, .rtf, .wps, .odt...)
 * sang .docx / .xlsx / .pptx bằng LibreOffice headless. Cần `soffice` binary
 * trong PATH (apt install libreoffice-core libreoffice-writer ...).
 *
 * MarkItDown không xử lý được binary cũ → bot tự convert trước.
 */
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const LEGACY_TO_TARGET: Record<string, "docx" | "xlsx" | "pptx"> = {
  ".doc": "docx",
  ".rtf": "docx",
  ".wps": "docx",
  ".odt": "docx",
  ".xls": "xlsx",
  ".ods": "xlsx",
  ".csv": "xlsx", // skip — markitdown đọc được CSV trực tiếp, nhưng giữ cho an toàn
  ".ppt": "pptx",
  ".odp": "pptx",
};

// CSV thì markitdown handle được rồi → loại trừ.
const LEGACY_EXTS = new Set(
  Object.keys(LEGACY_TO_TARGET).filter((e) => e !== ".csv"),
);

const MIME_OF_TARGET = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
} as const;

export function needsLegacyConvert(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return LEGACY_EXTS.has(ext);
}

export class LegacyOfficeError extends Error {}

export interface ConvertResult {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

export async function convertLegacyOffice(
  buffer: Buffer,
  filename: string,
): Promise<ConvertResult> {
  const ext = path.extname(filename).toLowerCase();
  const target = LEGACY_TO_TARGET[ext];
  if (!target) {
    throw new LegacyOfficeError(`extension "${ext}" không thuộc legacy list`);
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "soffice-"));
  try {
    // Sanitize filename — bỏ ký tự lạ, giữ tiếng Việt OK
    const safeBase = path
      .basename(filename, ext)
      .replace(/[/\\?%*:|"<>]/g, "_") || "input";
    const inputPath = path.join(tmpDir, safeBase + ext);
    await fs.writeFile(inputPath, buffer);

    await runSoffice(inputPath, target, tmpDir);

    const outputPath = path.join(tmpDir, safeBase + "." + target);
    const outputBuf = await fs.readFile(outputPath).catch(() => null);
    if (!outputBuf) {
      throw new LegacyOfficeError(`LibreOffice không tạo được output file ${outputPath}`);
    }

    return {
      buffer: outputBuf,
      filename: safeBase + "." + target,
      mimeType: MIME_OF_TARGET[target],
    };
  } finally {
    fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

function runSoffice(input: string, target: string, outDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const bin = process.env.LIBREOFFICE_BIN ?? "soffice";
    // -env:UserInstallation: tránh conflict khi convert song song
    const userProfile = `-env:UserInstallation=file://${outDir}/lo-profile`;
    const proc = spawn(
      bin,
      [userProfile, "--headless", "--convert-to", target, "--outdir", outDir, input],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    const timeout = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new LegacyOfficeError("LibreOffice timeout (45s)"));
    }, 45_000);
    proc.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
      } else {
        reject(
          new LegacyOfficeError(
            `LibreOffice exit ${code}: ${stderr.slice(0, 300).trim() || "(no stderr)"}`,
          ),
        );
      }
    });
    proc.on("error", (e) => {
      clearTimeout(timeout);
      reject(new LegacyOfficeError(`spawn soffice: ${e.message}`));
    });
  });
}
