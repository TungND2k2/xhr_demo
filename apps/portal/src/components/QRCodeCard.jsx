import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Copy, Check } from 'lucide-react';

/**
 * QRCodeCard — sinh QR code cho 1 URL, chèn logo TLG ở giữa.
 *
 * Props:
 *  - url: link cần encode
 *  - size (default 320)
 *  - logoSrc (default /logo.png)
 *  - title, subtitle: text hiển thị dưới QR
 */
export default function QRCodeCard({ url, size = 320, logoSrc = '/logo.png', title, subtitle }) {
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!url || !canvasRef.current) return;
    let cancelled = false;

    (async () => {
      const canvas = canvasRef.current;
      // Vẽ QR với error correction cao (H) để chèn logo giữa không hỏng
      await QRCode.toCanvas(canvas, url, {
        width: size,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: '#0f172a', light: '#ffffff' },
      });
      if (cancelled) return;

      // Overlay logo giữa
      const ctx = canvas.getContext('2d');
      const logo = new Image();
      logo.crossOrigin = 'anonymous';
      logo.onload = () => {
        if (cancelled) return;
        const logoSize = size * 0.22;
        const pos = (size - logoSize) / 2;
        // Nền trắng bo tròn phía sau logo
        const pad = logoSize * 0.14;
        ctx.fillStyle = '#ffffff';
        roundRect(ctx, pos - pad, pos - pad, logoSize + pad * 2, logoSize + pad * 2, 8);
        ctx.fill();
        ctx.drawImage(logo, pos, pos, logoSize, logoSize);
        setReady(true);
      };
      logo.onerror = () => setReady(true); // vẫn hiện QR nếu logo lỗi
      logo.src = logoSrc;
    })();

    return () => { cancelled = true; };
  }, [url, size, logoSrc]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `qr-dang-ky-hoc-vien.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="bg-white rounded-2xl p-4 shadow-lg shadow-black/5 border border-slate-200">
        <canvas ref={canvasRef} className="rounded-lg" style={{ width: size, height: size }} />
      </div>
      {(title || subtitle) && (
        <div className="text-center mt-3">
          {title && <p className="text-sm font-bold text-[var(--text-main)]">{title}</p>}
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className="flex items-center gap-2 mt-4">
        <button onClick={handleDownload} disabled={!ready} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-all disabled:opacity-50">
          <Download size={14} /> Tải QR (PNG)
        </button>
        <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:border-blue-500/40 transition-all">
          {copied ? <><Check size={14} className="text-green-500" /> Đã chép</> : <><Copy size={14} /> Chép link</>}
        </button>
      </div>
      <p className="text-[11px] text-slate-500 mt-2 break-all text-center max-w-xs">{url}</p>
    </div>
  );
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
