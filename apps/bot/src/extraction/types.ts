/** Schema AI extract trả về cho hóa đơn (invoice). */
export interface InvoiceExtract {
  customer?: {
    name?: string;
    country?: string;
    phone?: string;
    email?: string;
  };
  items: Array<{
    description: string;
    size?: string;
    quantity: number;
    pricePerUnit?: number;
  }>;
  totalAmount?: number;
  currency?: string;
  invoiceDate?: string;       // YYYY-MM-DD
  notes?: string;
}

/** Schema AI extract trả về cho đề bài (brief). */
export interface BriefExtract {
  items: Array<{
    description: string;     // mô tả chi tiết: vải/dáng/thêu/lining/mác
    size?: string;
    quantity: number;
  }>;
  deadline?: string;          // YYYY-MM-DD
  fabricType?: string;        // woven / knit
  embroideryType?: string;    // handsmocked / french knot / ...
  notes?: string;
}

/** Kết quả so khớp giữa hóa đơn và đề bài. */
export interface DocumentMatchResult {
  status: "match" | "warning" | "rejected";
  qtyMatch: boolean;
  sizeMatch: boolean;
  descMatchPercent: number;
  details?: string;
}

/** Kết quả verify ảnh xác nhận của khách. */
export interface ImageVerifyResult {
  isValid: boolean;
  reasoning: string;
  hasTwoSubjects: boolean;
  hasConfirmationKeyword: boolean;
  detectedKeywords: string[];
}
