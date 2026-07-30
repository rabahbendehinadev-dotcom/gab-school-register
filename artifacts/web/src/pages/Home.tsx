export default function Home() {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      background: "#fff",
      fontFamily: "Cairo, Tajawal, sans-serif",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: "linear-gradient(135deg,#f97316,#ea580c)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
          margin: "0 auto 16px",
          boxShadow: "0 8px 24px rgba(249,115,22,.35)",
        }}>G</div>
        <p style={{ color: "#f97316", fontWeight: 900, fontSize: 22, margin: 0 }}>GAB SCHOOL</p>
      </div>
    </div>
  );
}
