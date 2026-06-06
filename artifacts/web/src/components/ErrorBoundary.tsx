import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ fontFamily: "sans-serif", direction: "rtl", padding: "40px 24px", maxWidth: 500, margin: "60px auto", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ color: "#ea580c", marginBottom: 8 }}>خطأ في تحميل الصفحة</h2>
          <p style={{ color: "#555", marginBottom: 24, fontSize: 14 }}>
            حدث خطأ غير متوقع. حاول تحديث الصفحة أو امسح الكاش من المتصفح.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 12, padding: "12px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
          >
            🔄 تحديث الصفحة
          </button>
          <details style={{ marginTop: 24, textAlign: "left", fontSize: 11, color: "#999", direction: "ltr" }}>
            <summary style={{ cursor: "pointer" }}>Technical details</summary>
            <pre style={{ marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {this.state.error.message}{"\n"}{this.state.error.stack}
            </pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
