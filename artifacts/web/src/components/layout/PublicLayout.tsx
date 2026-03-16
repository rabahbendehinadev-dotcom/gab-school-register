import { ReactNode, useState, useEffect } from "react";

export function PublicLayout({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#111] overflow-x-hidden" style={{ fontFamily: "'Cairo', sans-serif" }}>

      {/* Topbar */}
      <div className="bg-[#111] text-[#fed7aa] text-center py-2 px-4 text-sm font-semibold">
        👑 أكبر أكاديمية لتفليش الهواتف في الجزائر &nbsp;|&nbsp; سجّل الآن واحجز مكانك 🔥
      </div>

      {/* Header */}
      <header className={`
        sticky top-0 z-50 transition-all duration-300 border-b
        ${scrolled
          ? "bg-white/95 backdrop-blur-2xl border-[#e5e5e5] shadow-sm"
          : "bg-white border-[#e5e5e5]"}
      `}>
        <div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between">
          <a href="#" className="flex items-center">
            <img
              src={`${import.meta.env.BASE_URL}images/logo.png`}
              alt="GAB SCHOOL"
              className="h-14 w-auto object-contain"
            />
          </a>

          <nav className="hidden md:flex items-center gap-8">
            <button onClick={() => scrollTo("about")} className="text-sm font-semibold text-[#525252] hover:text-[#f97316] transition-colors">عن المدرسة</button>
            <button onClick={() => scrollTo("features")} className="text-sm font-semibold text-[#525252] hover:text-[#f97316] transition-colors">مميزاتنا</button>
            <button onClick={() => scrollTo("gallery")} className="text-sm font-semibold text-[#525252] hover:text-[#f97316] transition-colors">معرض الصور</button>
            <button
              onClick={() => scrollTo("register")}
              className="flex items-center gap-2 bg-[#f97316] text-white px-6 py-2.5 rounded-full font-bold text-sm hover:bg-[#ea580c] transition-all hover:-translate-y-0.5 shadow-lg shadow-orange-200"
            >
              📋 سجّل الآن
            </button>
          </nav>

          <button className="md:hidden text-2xl p-1" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-[#e5e5e5] px-6 py-5 flex flex-col gap-4 text-right">
            <button onClick={() => scrollTo("about")} className="text-base font-semibold text-[#525252]">عن المدرسة</button>
            <button onClick={() => scrollTo("features")} className="text-base font-semibold text-[#525252]">مميزاتنا</button>
            <button onClick={() => scrollTo("gallery")} className="text-base font-semibold text-[#525252]">معرض الصور</button>
            <button onClick={() => scrollTo("register")} className="text-base font-bold text-[#f97316]">سجّل الآن ←</button>
          </div>
        )}
      </header>

      {children}

      {/* Footer */}
      <footer className="bg-[#111] text-[#a3a3a3] py-12 px-6">
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-5">
          <img
            src={`${import.meta.env.BASE_URL}images/logo.png`}
            alt="GAB SCHOOL"
            className="h-16 w-auto"
            style={{ filter: "brightness(0) invert(1)", opacity: 0.8 }}
          />
          <div className="w-full max-w-md h-px bg-white/10" />
          <p className="text-sm text-center leading-8">
            <span className="text-[#f97316] font-bold">GAB SCHOOL</span> — أكبر أكاديمية لتفليش الهواتف في الجزائر<br />
            © {new Date().getFullYear()} جميع الحقوق محفوظة &nbsp;·&nbsp;
            <a href="https://wa.me/213772339494" className="text-[#f97316] hover:underline">تواصل معنا</a>
          </p>
        </div>
      </footer>

      {/* Floating WhatsApp */}
      <a
        href="https://wa.me/213772339494"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-8 right-6 z-50 w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center text-white shadow-xl hover:scale-110 transition-transform animate-pulse-ring"
        title="واتساب"
        aria-label="تواصل عبر واتساب"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.854L.054 23.447a.5.5 0 0 0 .613.608l5.701-1.494A11.955 11.955 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.898 0-3.677-.525-5.193-1.437l-.372-.22-3.849 1.008 1.023-3.741-.242-.386A10 10 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
        </svg>
      </a>

      {/* Floating Register CTA */}
      <button
        onClick={() => scrollTo("register")}
        className="fixed bottom-8 left-6 z-50 flex items-center gap-2 bg-[#f97316] text-white px-5 py-3.5 rounded-full text-sm font-bold shadow-xl hover:bg-[#ea580c] hover:-translate-y-1 transition-all"
      >
        📋 سجّل في الدورة
      </button>
    </div>
  );
}
