import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "SkillBot — Quản lý sản xuất hàng may thêu",
};

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  );
}
