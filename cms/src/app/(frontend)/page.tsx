import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex aspect-square size-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200">
          <span className="text-xl font-bold">SB</span>
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">SkillBot</h1>
          <p className="text-sm text-neutral-600 mt-2">
            Trợ lý AI quản lý sản xuất hàng may thêu xuất khẩu
          </p>
        </div>
        <Link
          href="/admin"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-emerald-600 px-6 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
        >
          Vào dashboard quản lý →
        </Link>
      </div>
    </main>
  );
}
