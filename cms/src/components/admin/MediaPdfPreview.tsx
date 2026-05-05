'use client'

/**
 * Block xem trước PDF trong Edit view của collection Media.
 *
 * - Đọc doc data hiện tại qua hook `useDocumentInfo` của Payload UI.
 * - Chỉ render khi mimeType là application/pdf — file ảnh đã có preview
 *   sẵn ở trên upload block, file khác thì skip.
 * - Render <iframe> trỏ tới `doc.url` (Payload proxy qua /api/media/file/...
 *   nên iframe load được dù bucket S3 private).
 */

import { useDocumentInfo } from '@payloadcms/ui'

interface MediaDoc {
  mimeType?: string
  url?: string
  filename?: string
}

export default function MediaPdfPreview() {
  const info = useDocumentInfo()
  const doc = (info?.savedDocumentData ?? {}) as MediaDoc

  if (doc.mimeType !== 'application/pdf' || !doc.url) {
    return null
  }

  return (
    <div style={{ marginTop: 24, marginBottom: 24 }}>
      <h4 style={{ margin: '0 0 8px 0' }}>📄 Xem trước PDF</h4>
      <iframe
        title={`Preview ${doc.filename ?? 'PDF'}`}
        src={doc.url}
        style={{
          width: '100%',
          height: 720,
          border: '1px solid var(--theme-elevation-100)',
          borderRadius: 4,
        }}
      />
      <p style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
        Cuộn/zoom bằng trình xem PDF của trình duyệt. Nếu trắng, mở file ở tab mới qua link tải.
      </p>
    </div>
  )
}
