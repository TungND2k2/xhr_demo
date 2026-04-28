/** Full logo + tagline — hiển thị trên trang Login. */
export const Logo = () => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 12,
      marginBottom: 16,
    }}
  >
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: 16,
        background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 10px 30px rgba(16, 185, 129, 0.35)",
      }}
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M10.5 11.5L13 16L10.5 20.5M16.5 11.5H21.5M16.5 20.5H21.5"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>
        SkillBot
      </div>
      <div style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>
        Trợ lý AI quản lý sản xuất hàng may thêu
      </div>
    </div>
  </div>
);

export default Logo;
