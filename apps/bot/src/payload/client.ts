/**
 * Payload REST client. Handles auth (login + token refresh), JSON
 * encoding, error mapping. Used by every tool to talk to Payload CMS.
 *
 * Auth strategy: bot logs in once at boot with email/password from .env,
 * caches the JWT, refreshes when expired (Payload tokens last 2h by default).
 */
import { getConfig } from "../config.js";
import { logger } from "../utils/logger.js";

export class PayloadError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
    this.name = "PayloadError";
  }
}

interface LoginResponse {
  token: string;
  exp: number;          // expiration timestamp in seconds
  user: { id: string; email: string };
}

class PayloadClient {
  private token: string | null = null;
  private tokenExp = 0;
  private loginInflight: Promise<void> | null = null;

  private get baseUrl(): string {
    return getConfig().PAYLOAD_URL;
  }

  /** Force re-login on next request. */
  invalidateToken(): void {
    this.token = null;
    this.tokenExp = 0;
  }

  /** Lazy-login + auto-refresh on near-expiry. */
  private async ensureToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    // Refresh 60s before expiry
    if (this.token && this.tokenExp > now + 60) return this.token;

    // Single-flight: avoid concurrent logins from parallel requests
    if (!this.loginInflight) this.loginInflight = this.doLogin();
    try {
      await this.loginInflight;
    } finally {
      this.loginInflight = null;
    }
    if (!this.token) throw new PayloadError(500, "auth_failed", "Không thể đăng nhập Payload");
    return this.token;
  }

  private async doLogin(): Promise<void> {
    const cfg = getConfig();
    const res = await fetch(`${this.baseUrl}/api/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: cfg.PAYLOAD_BOT_EMAIL,
        password: cfg.PAYLOAD_BOT_PASSWORD,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new PayloadError(res.status, "login_failed", `Login Payload failed: ${res.status}`, body);
    }
    const data = (await res.json()) as LoginResponse;
    this.token = data.token;
    this.tokenExp = data.exp;
    logger.info("Payload", `Logged in as ${data.user.email}`);
  }

  /**
   * Generic fetch — auto-attaches JWT, parses JSON, throws PayloadError on failure.
   * Retries once on 401 (token may have been invalidated).
   */
  async request<T = unknown>(
    path: string,
    init: { method?: string; body?: unknown; query?: Record<string, unknown> } = {},
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (init.query) {
      for (const [k, v] of Object.entries(init.query)) {
        if (v === undefined || v === null) continue;
        url.searchParams.set(k, typeof v === "string" ? v : JSON.stringify(v));
      }
    }

    const send = async (token: string): Promise<Response> => {
      return fetch(url.toString(), {
        method: init.method ?? "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `JWT ${token}`,
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      });
    };

    let token = await this.ensureToken();
    let res = await send(token);

    if (res.status === 401) {
      // token may have rotated server-side; force re-login then retry once
      this.invalidateToken();
      token = await this.ensureToken();
      res = await send(token);
    }

    const contentType = res.headers.get("content-type") ?? "";
    const data = contentType.includes("application/json")
      ? await res.json().catch(() => null)
      : await res.text();

    if (!res.ok) {
      const message =
        (data && typeof data === "object" && "errors" in data && Array.isArray((data as any).errors))
          ? (data as any).errors[0]?.message ?? `HTTP ${res.status}`
          : `HTTP ${res.status}`;
      throw new PayloadError(res.status, "payload_error", message, data);
    }

    return data as T;
  }

  /**
   * Upload binary file vào Payload media collection (slug: "media").
   * Payload trả về { doc: { id, filename, url, mimeType, ... } }.
   */
  async uploadMedia(input: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    alt?: string;
  }): Promise<{ id: string; filename: string; url?: string; mimeType: string; filesize: number }> {
    const token = await this.ensureToken();
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(input.buffer)], { type: input.mimeType }),
      input.filename,
    );
    if (input.alt) {
      form.append("_payload", JSON.stringify({ alt: input.alt }));
    }

    const res = await fetch(`${this.baseUrl}/api/media`, {
      method: "POST",
      headers: { Authorization: `JWT ${token}` },
      body: form,
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg =
        (data && typeof data === "object" && "errors" in data && Array.isArray((data as any).errors))
          ? (data as any).errors[0]?.message ?? `HTTP ${res.status}`
          : `HTTP ${res.status}`;
      throw new PayloadError(res.status, "upload_failed", `Upload media thất bại: ${msg}`, data);
    }
    return (data as { doc: { id: string; filename: string; url?: string; mimeType: string; filesize: number } }).doc;
  }
}

export const payload = new PayloadClient();
