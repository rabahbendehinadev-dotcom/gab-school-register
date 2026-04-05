export default function CourseInfoSection() {
  return (
    <div dir="rtl" className="rounded-2xl overflow-hidden border border-orange-200 shadow-md bg-white text-[#111] font-[Cairo,Tajawal,sans-serif] mb-4">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-5 py-4" style={{ background: "linear-gradient(135deg,#f97316 0%,#ea580c 100%)" }}>
        <span className="text-2xl">🔥</span>
        <div>
          <p className="text-white font-black text-base leading-tight">دورة تفليش الهواتف المكثفة</p>
          <p className="text-orange-100 text-xs font-semibold">GAB SCHOOL · أقوى دورة في الجزائر</p>
        </div>
      </div>

      <div className="divide-y divide-gray-100">

        {/* ── معلومات أساسية ── */}
        <div className="px-5 py-4 space-y-2">
          <p className="text-xs font-black text-orange-500 uppercase tracking-wider mb-3">📋 معلومات الدورة</p>
          <div className="grid grid-cols-1 gap-2">
            {[
              { icon: "⏰", text: "أسبوع تكوين مكثف · 9 ساعات في اليوم" },
              { icon: "💻", text: "100٪ تطبيقي · حاسوب + 20 هاتف لكل متربص" },
              { icon: "🛌", text: "الإقامة مجانية للقاطنين خارج العاصمة" },
              { icon: "💵", text: "تكلفة الدورة: 40,000 دج" },
              { icon: "🎓", text: "شهادة رسمية عند اكتمال الدورة" },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-start gap-2.5">
                <span className="text-base flex-shrink-0 mt-0.5">{icon}</span>
                <span className="text-[13px] text-[#333] leading-snug font-semibold">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── محتوى iOS ── */}
        <div className="px-5 py-4">
          <p className="text-xs font-black text-orange-500 uppercase tracking-wider mb-3">🍏 محتوى دورة Apple iOS</p>
          <div className="flex flex-wrap gap-2">
            {[
              "إزالة iCloud (iPhone 6 → 15 Pro Max)",
              "تحرير الشبكة Unlock Official",
              "Bypass & Full Bypass iCloud",
              "فك Passcode مع الشبكة",
              "إزالة MDM iPhone & iPad",
              "iCloud ساعات Apple Watch",
              "MacBook T2 Full Bypass",
              "حذف iCloud iPad عبر Purple Mode",
            ].map((item) => (
              <span key={item} className="inline-flex items-center gap-1 bg-orange-50 border border-orange-200 text-orange-700 text-[11px] font-bold px-2.5 py-1 rounded-full">
                ✅ {item}
              </span>
            ))}
          </div>
        </div>

        {/* ── محتوى Android ── */}
        <div className="px-5 py-4">
          <p className="text-xs font-black text-orange-500 uppercase tracking-wider mb-3">🤖 محتوى دورة Android</p>
          <div className="flex flex-wrap gap-2">
            {[
              "Z3X · EFT · CM2 · UMT · SIGMA BOX",
              "تخطي FRP Lock جميع الأجهزة",
              "إزالة Mi Account شاومي",
              "فك Screen Lock بدون حذف البيانات",
              "استرجاع IMEI لكل الهواتف",
              "تحويل نسخة صينية → عالمية",
              "Unlock Bootloader",
              "أساسيات JTAG · EMMC · UFS",
            ].map((item) => (
              <span key={item} className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 text-gray-700 text-[11px] font-bold px-2.5 py-1 rounded-full">
                ✅ {item}
              </span>
            ))}
          </div>
        </div>

        {/* ── المنظومة الكاملة ── */}
        <div className="px-5 py-4">
          <p className="text-xs font-black text-orange-500 uppercase tracking-wider mb-3">🚀 المنظومة الكاملة بعد التكوين</p>
          <div className="grid grid-cols-1 gap-2">
            {[
              { icon: "🌐", label: "منصة Reparily", desc: "توثيقك وعرض خدماتك لزبائن مباشرة", url: "https://reparily.com" },
              { icon: "💻", label: "برنامج GAB System", desc: "تسيير المحل · المخزون · الزبائن · الصيانة (عام مجاناً)", url: "https://system.gab-school.com" },
              { icon: "🧰", label: "منصة الأدوات", desc: "تحميل البرامج والأدوات بسهولة", url: "https://tools.gab-school.com" },
              { icon: "📡", label: "سيرفر GAB", desc: "أكثر من 1000 خدمة أوتوماتيكية للمحلات", url: "https://www.unlock-gab.com" },
              { icon: "🎓", label: "التعليم أونلاين", desc: "للي ما يقدروش يجوا للأكاديمية", url: "https://online.gab-school.com" },
            ].map(({ icon, label, desc, url }) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 hover:border-orange-300 hover:bg-orange-50 transition-all group">
                <span className="text-xl flex-shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-black text-[#111] group-hover:text-orange-600 transition-colors">{label}</p>
                  <p className="text-[10px] text-gray-500 truncate">{desc}</p>
                </div>
                <svg className="w-4 h-4 text-gray-300 group-hover:text-orange-400 flex-shrink-0 rotate-180" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </a>
            ))}
          </div>
        </div>

        {/* ── شروط الحجز ── */}
        <div className="px-5 py-4 bg-amber-50">
          <p className="text-xs font-black text-orange-500 uppercase tracking-wider mb-3">📌 شروط الحجز والتسجيل</p>
          <div className="space-y-2">
            {[
              { icon: "💳", text: "عربون الحجز: 5,000 دج عبر بريدي موب أو CCP قبل موعد الدورة" },
              { icon: "⚠️", text: "في حالة الإلغاء من طرف المتربص لا يُمكن استرداد مبلغ العربون" },
              { icon: "📄", text: "المستندات المطلوبة: نسخة من بطاقة التعريف الوطني" },
              { icon: "📞", text: "للتسجيل والاستفسار: 0772 339 494 (واتساب / فايبر)" },
              { icon: "📍", text: "المقر: براقي · الجزائر العاصمة" },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-start gap-2.5">
                <span className="text-base flex-shrink-0 mt-0.5">{icon}</span>
                <span className="text-[12px] text-[#444] leading-snug font-semibold">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── بعد التسجيل ── */}
        <div className="px-5 py-3 bg-orange-500/5 flex items-center gap-3">
          <span className="text-lg">💬</span>
          <p className="text-[12px] text-[#555] font-bold leading-snug">
            بعد إرسال الاستمارة تواصل معنا عبر واتساب على{" "}
            <a href="https://wa.me/213772339494" target="_blank" rel="noopener noreferrer" className="text-orange-600 underline underline-offset-2">
              0772 339 494
            </a>{" "}
            لتأكيد التسجيل
          </p>
        </div>

      </div>
    </div>
  );
}
