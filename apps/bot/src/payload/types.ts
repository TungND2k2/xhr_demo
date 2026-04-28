/**
 * Generic Payload REST shapes. We intentionally avoid coupling to
 * Payload's auto-generated types — the bot uses the wire format only.
 */

export interface PayloadDoc {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface PayloadFindResponse<T extends PayloadDoc = PayloadDoc> {
  docs: T[];
  totalDocs: number;
  totalPages: number;
  page: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  limit: number;
}

export interface PayloadCreateResponse<T extends PayloadDoc = PayloadDoc> {
  doc: T;
  message: string;
}

export interface PayloadUpdateResponse<T extends PayloadDoc = PayloadDoc> {
  doc: T;
  message: string;
}

export interface PayloadDeleteResponse {
  doc: { id: string };
  message: string;
}

/** Payload `where` query (subset we use from bot tools). */
export type Where = Record<string, unknown>;
