// Export helpers: Excel (xlsx) + PDF (browser print to PDF).
import * as XLSX from 'xlsx';

/**
 * Export array of rows to .xlsx file.
 *  rows: [{ col1: val, col2: val }]
 *  filename: vd "bao-cao-ld.xlsx"
 *  sheetName: vd "LĐ theo W1-W8"
 */
export function exportXlsx(rows, filename, sheetName = 'Sheet1') {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
}

/**
 * Mở dialog Print với CSS print-only. Người dùng chọn "Save as PDF" để
 * có file PDF. Không cần extra dep.
 *
 * Cách dùng: bọc nội dung cần in trong div class="print-area", còn lại
 * sẽ bị ẩn khi in (xem index.css @media print).
 */
export function printPdf() {
  window.print();
}
