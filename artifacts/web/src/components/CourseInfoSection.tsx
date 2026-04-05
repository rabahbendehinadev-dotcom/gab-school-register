/* ── مكوّن معلومات الدورة — يظهر أسفل فورم التسجيل ── */
export default function CourseInfoSection() {
  return (
    <div dir="rtl" className="space-y-3 mt-4 font-[Cairo,Tajawal,sans-serif]">

      {/* ══ قسم ترويجي: فرصة + برنامج حصري ══ */}
      <div className="rounded-2xl overflow-hidden border border-orange-300 shadow-md">
        {/* رأس ملوّن */}
        <div className="px-5 py-3" style={{ background: "linear-gradient(135deg,#f97316 0%,#ea580c 100%)" }}>
          <p className="text-white font-black text-base">🚀 اليوم ماشي غير دورة…</p>
          <p className="text-orange-100 text-sm font-semibold mt-0.5">
            هذه فرصة باش تدخل عالم فيه الربح الحقيقي 💰
          </p>
        </div>

        <div className="bg-white divide-y divide-gray-100">

          {/* برنامج حصري */}
          <div className="px-5 py-4 space-y-2">
            <div className="flex items-start gap-2.5">
              <span className="text-lg flex-shrink-0">🔥</span>
              <div>
                <p className="text-[13px] font-black text-[#111] leading-snug">
                  عندنا برنامج حصري من تطوير GAB
                </p>
                <p className="text-[12px] text-gray-600 mt-0.5">
                  يدعم أجهزة iPhone من{" "}
                  <bdi className="font-bold text-orange-600">XS</bdi>
                  {" "}إلى{" "}
                  <bdi className="font-bold text-orange-600">17 Pro Max</bdi>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
              <span className="text-2xl">💰</span>
              <div>
                <p className="text-[13px] font-black text-orange-700">
                  بسعر خرافي:{" "}
                  <bdi className="text-orange-600 text-base">250</bdi>
                  {" "}دج فقط
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <span className="text-base flex-shrink-0">⚠️</span>
              <p className="text-[12px] text-red-700 font-bold leading-snug">
                هذا البرنامج مش موجود في السوق — متاح غير لطلبتنا
              </p>
            </div>
          </div>

          {/* حساب VIP */}
          <div className="px-5 py-4 space-y-2">
            <p className="text-xs font-black text-orange-500 uppercase tracking-wider">🔥 بعد الاشتراك في الدورة مباشرة</p>
            <div className="flex items-start gap-2.5">
              <span className="text-base flex-shrink-0">🔥</span>
              <p className="text-[13px] font-black text-[#111] leading-snug">
                تتحصل على حساب VIP خاص بك في السيرفر
              </p>
            </div>
            <div className="grid grid-cols-1 gap-1.5 mr-6">
              {[
                { icon: "💰", text: "أسعار خاصة أقل من السوق" },
                { icon: "⚡", text: "خدمات سريعة وجاهزة" },
                { icon: "💼", text: "تبدأ تخدم وتربح من أول يوم" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-2">
                  <span className="text-sm">{icon}</span>
                  <span className="text-[12px] text-[#333] font-semibold">{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* منظومة كاملة */}
          <div className="px-5 py-4">
            <p className="text-xs font-black text-orange-500 uppercase tracking-wider mb-3">🌐 تدخل مباشرة في منظومة كاملة</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: "🌐", name: "Reparily", desc: "تجيب زبائن", url: "https://reparily.com" },
                { icon: "💻", name: "GAB System", desc: "تسير خدمتك", url: "https://system.gab-school.com" },
                { icon: "📡", name: "Server VIP", desc: "تخدم بأسعارك", url: "https://www.unlock-gab.com" },
                { icon: "🧰", name: "Tools", desc: "كل الأدوات جاهزة", url: "https://tools.gab-school.com" },
              ].map(({ icon, name, desc, url }) => (
                <a key={name} href={url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 hover:border-orange-300 hover:bg-orange-50 transition-all group">
                  <span className="text-base">{icon}</span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black text-[#111] group-hover:text-orange-600 transition-colors">
                      <bdi>{name}</bdi>
                    </p>
                    <p className="text-[10px] text-gray-400">{desc}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* خلاصة */}
          <div className="px-5 py-3" style={{ background: "linear-gradient(135deg,#fff7ed,#fff)" }}>
            <p className="text-xs font-black text-orange-500 uppercase tracking-wider mb-2">🔥 يعني باختصار</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm">❌</span>
                <span className="text-[12px] text-gray-500 line-through font-semibold">ماشي غير تتعلم</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">✅</span>
                <span className="text-[12px] text-green-700 font-black">تخرج جاهز تخدم وتدخل فلوس مباشرة</span>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="px-5 py-3 bg-orange-500 flex items-center justify-center gap-2">
            <span className="text-base">⏳</span>
            <p className="text-white font-black text-[13px]">الأماكن محدودة — سجل الآن قبل ما تغلق الدورة</p>
          </div>
        </div>
      </div>

      {/* ══ معلومات الدورة ══ */}
      <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-xs font-black text-orange-500 uppercase tracking-wider">📋 معلومات الدورة</p>
        </div>
        <div className="px-5 py-4 space-y-2.5">
          {[
            { icon: "⏰", text: ["أسبوع تكوين مكثف · ", "9", " ساعات في اليوم"] },
            { icon: "💻", text: ["100٪ تطبيقي · حاسوب + ", "20", " هاتف لكل متربص"] },
            { icon: "🛌", text: ["الإقامة مجانية للقاطنين خارج العاصمة"] },
            { icon: "💵", text: ["تكلفة الدورة: ", "40,000", " دج"] },
            { icon: "🎓", text: ["شهادة رسمية عند اكتمال الدورة"] },
          ].map(({ icon, text }, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="text-base flex-shrink-0 mt-0.5">{icon}</span>
              <span className="text-[13px] text-[#333] leading-snug font-semibold">
                {text.map((chunk, j) =>
                  j % 2 === 1
                    ? <bdi key={j} className="text-orange-600 font-black">{chunk}</bdi>
                    : chunk
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ══ محتوى iOS ══ */}
      <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-xs font-black text-orange-500 uppercase tracking-wider">🍏 محتوى دورة Apple iOS</p>
        </div>
        <div className="px-5 py-4 flex flex-wrap gap-2">
          {[
            "إزالة iCloud — iPhone 6 → 15 Pro Max",
            "Unlock Official جميع الإصدارات",
            "Bypass & Full Bypass iCloud",
            "فك Passcode مع الاحتفاظ بالشبكة",
            "إزالة MDM — iPhone & iPad",
            "حذف iCloud — Apple Watch",
            "MacBook T2 — Full Bypass",
            "حذف iCloud iPad عبر Purple Mode",
          ].map((item) => (
            <span key={item}
              className="inline-flex items-center gap-1 bg-orange-50 border border-orange-200 text-orange-700 text-[11px] font-bold px-2.5 py-1 rounded-full">
              ✅ <bdi>{item}</bdi>
            </span>
          ))}
        </div>
      </div>

      {/* ══ محتوى Android ══ */}
      <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-xs font-black text-orange-500 uppercase tracking-wider">🤖 محتوى دورة Android</p>
        </div>
        <div className="px-5 py-4 flex flex-wrap gap-2">
          {[
            "Z3X · EFT · CM2 · UMT · SIGMA BOX",
            "تخطي FRP Lock — جميع الأجهزة",
            "إزالة Mi Account شاومي",
            "فك Screen Lock بدون حذف البيانات",
            "استرجاع IMEI لكل الهواتف",
            "تحويل نسخة صينية → عالمية",
            "Unlock Bootloader",
            "أساسيات JTAG · EMMC · UFS",
          ].map((item) => (
            <span key={item}
              className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 text-gray-700 text-[11px] font-bold px-2.5 py-1 rounded-full">
              ✅ <bdi>{item}</bdi>
            </span>
          ))}
        </div>
      </div>

      {/* ══ شروط الحجز ══ */}
      <div className="rounded-2xl overflow-hidden border border-amber-200 shadow-sm bg-amber-50">
        <div className="px-5 py-3 border-b border-amber-100">
          <p className="text-xs font-black text-orange-500 uppercase tracking-wider">📌 شروط الحجز والتسجيل</p>
        </div>
        <div className="px-5 py-4 space-y-2.5">
          {[
            { icon: "💳", parts: ["عربون الحجز: ", "5,000", " دج عبر بريدي موب أو CCP"] },
            { icon: "⚠️", parts: ["في حالة الإلغاء لا يُمكن استرداد مبلغ العربون"] },
            { icon: "📄", parts: ["المستندات: نسخة من بطاقة التعريف الوطني"] },
            { icon: "📞", parts: ["للتسجيل والاستفسار: ", "0772 339 494", " (واتساب / فايبر)"] },
            { icon: "📍", parts: ["المقر: براقي · الجزائر العاصمة"] },
          ].map(({ icon, parts }, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="text-base flex-shrink-0 mt-0.5">{icon}</span>
              <span className="text-[12px] text-[#444] leading-snug font-semibold">
                {parts.map((chunk, j) =>
                  j % 2 === 1
                    ? <bdi key={j} className="font-black text-[#111]">{chunk}</bdi>
                    : chunk
                )}
              </span>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-amber-100 flex items-center gap-2">
          <span className="text-base">💬</span>
          <p className="text-[12px] text-[#555] font-bold">
            بعد إرسال الاستمارة تواصل معنا على واتساب{" "}
            <a href="https://wa.me/213772339494" target="_blank" rel="noopener noreferrer"
              className="text-orange-600 underline underline-offset-2">
              <bdi>0772 339 494</bdi>
            </a>
            {" "}لتأكيد التسجيل
          </p>
        </div>
      </div>

    </div>
  );
}
