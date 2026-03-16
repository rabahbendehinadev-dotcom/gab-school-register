import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useToast } from "@/hooks/use-toast";
import { useCreateStudent, useListGalleryImages } from "@workspace/api-client-react";

const registrationSchema = z.object({
  firstName: z.string().min(2, "الاسم الأول مطلوب"),
  lastName: z.string().min(2, "اللقب مطلوب"),
  phone: z.string().min(8, "رقم الهاتف مطلوب"),
  whatsapp: z.string().min(8, "رقم الواتساب مطلوب"),
  city: z.string().min(2, "الولاية مطلوبة"),
  trainingType: z.enum(["online", "physical"]),
  housingNeeded: z.boolean().default(false),
  experienceLevel: z.string().min(2, "اختر مستوى خبرتك"),
  note: z.string().optional(),
});

type RegistrationForm = z.infer<typeof registrationSchema>;

const FEATURES = [
  { icon: "🔧", title: "تدريب عملي 80%", desc: "تدريب يومي على أجهزة حقيقية + أحدث الأدوات والمعدات الاحترافية" },
  { icon: "🎓", title: "شهادة رسمية", desc: "شهادة رسمية من الأكاديمية + ملف تدريبي كامل يؤهلك للعمل المهني فوراً" },
  { icon: "👥", title: "دعم مدى الحياة", desc: "مجموعة واتساب دائمة + متابعة مجانية بعد انتهاء الدورة بدون حد زمني" },
  { icon: "🖥️", title: "سيرفر خاص بنا", desc: "أدوات حصرية على سيرفرنا الخاص لا تجدها في أي مكان آخر" },
  { icon: "🎬", title: "فيديوهات مسجّلة", desc: "مكتبة فيديوهات شاملة تبقى معك إلى الأبد لمراجعة كل المواد" },
  { icon: "💼", title: "توظيف بعد التخرج", desc: "مساعدة في إيجاد عمل أو فتح محل خاص بك بعد نهاية الدورة" },
];

const WHY_ITEMS = [
  { emoji: "🚀", title: "الأوائل في صنع الأدوات", desc: "أدوات احترافية حصرية لا توجد في أي أكاديمية أخرى" },
  { emoji: "🎁", title: "الأدوات مجانية 100%", desc: "تحديثات أسبوعية + قناة تليجرام خاصة بالخريجين" },
  { emoji: "📱", title: "متابعة مدى الحياة", desc: "دعم فني 24/7 من أول يوم ولغاية نهاية مسيرتك المهنية" },
  { emoji: "🥇", title: "أفضل أكاديمية في الجزائر", desc: "اعتراف رسمي وسمعة مثبتة لدى المحترفين في الجزائر" },
];

function useScrollVisible() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.06, rootMargin: "0px 0px 60px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

export default function Home() {
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { data: gallery } = useListGalleryImages();
  const createStudentMutation = useCreateStudent();
  const featuresAnim = useScrollVisible();
  const whyAnim = useScrollVisible();
  const galleryAnim = useScrollVisible();

  const form = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { housingNeeded: false, trainingType: "physical", experienceLevel: "none" },
  });

  const onSubmit = async (data: RegistrationForm) => {
    try {
      await createStudentMutation.mutateAsync({ data });
      setIsSubmitted(true);
      toast({ title: "تم إرسال طلبك بنجاح!", description: "سيتواصل معك فريق GAB SCHOOL خلال 24 ساعة." });
      form.reset();
    } catch {
      toast({ variant: "destructive", title: "حدث خطأ", description: "الرجاء المحاولة مجدداً." });
    }
  };

  return (
    <PublicLayout>

      {/* ─── HERO ─── */}
      <section id="about" className="relative overflow-hidden py-16 md:py-24" style={{ background: "linear-gradient(135deg,#fff 55%,#fff7ed 100%)" }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse 60% 70% at 75% 50%,rgba(249,115,22,.08) 0%,transparent 60%),radial-gradient(ellipse 40% 50% at 10% 85%,rgba(249,115,22,.05) 0%,transparent 50%)"
        }} />

        <div className="max-w-7xl mx-auto px-5 relative">
          <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">

            {/* Content */}
            <div className="animate-fadeup text-right order-2 md:order-1">
              <div className="inline-flex items-center gap-2 bg-[#ffedd5] text-[#ea580c] border border-[#fed7aa] px-5 py-2 rounded-full text-sm font-bold mb-6 animate-pulse-ring">
                🏆 دورة حضورية + فيديوهات مسجّلة
              </div>

              <h1 className="text-4xl md:text-5xl font-black leading-snug mb-5 text-[#111]">
                سجّل في<br />
                <span className="text-gradient-orange">دورة تفليش الهواتف</span><br />
                مع GAB SCHOOL
              </h1>

              <p className="text-[#525252] leading-8 mb-8">
                املأ الاستمارة وسنتواصل معك لتأكيد التسجيل وإعطائك كل التفاصيل<br />
                <strong className="text-[#ea580c]">(العرض · المدة · المواد · مكان الأكاديمية)</strong>
              </p>

              <div className="flex gap-4 flex-wrap justify-end">
                {[
                  { num: "+5000", label: "خريج محترف" },
                  { num: "80%", label: "تدريب عملي" },
                  { num: "24/7", label: "دعم مدى الحياة" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="flex flex-col items-center bg-white border border-[#e5e5e5] rounded-2xl px-5 py-4 shadow-sm hover:border-[#f97316] hover:shadow-lg hover:-translate-y-1 transition-all min-w-[100px]"
                  >
                    <span className="text-2xl font-black text-[#f97316] leading-none">{s.num}</span>
                    <span className="text-xs text-[#525252] font-semibold mt-1 whitespace-nowrap">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Registration Form */}
            <div id="register" className="animate-fadeup-delay order-1 md:order-2">
              <div className="bg-white rounded-3xl p-7 md:p-10 shadow-2xl border border-[#e5e5e5] relative overflow-hidden">
                {/* Shimmer top bar */}
                <div className="absolute top-0 left-0 right-0 h-1.5 rounded-t-3xl" style={{
                  background: "linear-gradient(90deg,#f97316,#ea580c,#f97316)",
                  backgroundSize: "400px 100%",
                  animation: "shimmer 2.5s linear infinite",
                }} />

                <h2 className="text-xl font-black text-center text-[#111] mb-6 flex items-center justify-center gap-2">
                  📋 استمارة التسجيل الرسمية
                </h2>

                {isSubmitted ? (
                  <div className="flex items-start gap-3 bg-[#fff7ed] text-[#ea580c] border border-[#fed7aa] rounded-2xl p-5 font-semibold">
                    <span className="text-2xl">✅</span>
                    <span>تم إرسال طلبك بنجاح! سيتواصل معك فريق GAB SCHOOL خلال 24 ساعة.</span>
                  </div>
                ) : (
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" dir="rtl">

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="👤 الاسم الأول" error={form.formState.errors.firstName?.message}>
                        <input {...form.register("firstName")} placeholder="أدخل اسمك الأول" className={inputCls} />
                      </Field>
                      <Field label="🏷️ اللقب" error={form.formState.errors.lastName?.message}>
                        <input {...form.register("lastName")} placeholder="أدخل لقبك" className={inputCls} />
                      </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="📞 رقم الهاتف" error={form.formState.errors.phone?.message}>
                        <input {...form.register("phone")} type="tel" placeholder="05X XX XX XX" className={inputCls} dir="ltr" />
                      </Field>
                      <Field label="💬 رقم الواتساب" error={form.formState.errors.whatsapp?.message}>
                        <input {...form.register("whatsapp")} type="tel" placeholder="يمكن أن يكون نفس الرقم" className={inputCls} dir="ltr" />
                      </Field>
                    </div>

                    <Field label="📍 الولاية" error={form.formState.errors.city?.message}>
                      <input {...form.register("city")} placeholder="الجزائر · وهران · عنابة..." className={inputCls} />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="💻 نوع الدورة">
                        <select {...form.register("trainingType")} className={selectCls}>
                          <option value="physical">حضورية (في الأكاديمية)</option>
                          <option value="online">أونلاين (عن بعد)</option>
                        </select>
                      </Field>
                      <Field label="🏠 هل تحتاج إقامة؟">
                        <select
                          onChange={(e) => form.setValue("housingNeeded", e.target.value === "true")}
                          className={selectCls}
                        >
                          <option value="false">لا أحتاج</option>
                          <option value="true">نعم أحتاج إقامة</option>
                        </select>
                      </Field>
                    </div>

                    <Field label="📈 مستوى خبرتك">
                      <select {...form.register("experienceLevel")} className={selectCls}>
                        <option value="none">لا خبرة، أبدأ من الصفر</option>
                        <option value="basic">أساسيات بسيطة</option>
                        <option value="advanced">خبرة وأريد الاحتراف</option>
                      </select>
                    </Field>

                    <Field label="📝 ملاحظة (اختياري)">
                      <textarea {...form.register("note")} placeholder="مثال: أفضل الدراسة صباحاً..." rows={2} className={inputCls + " resize-none"} />
                    </Field>

                    <button
                      type="submit"
                      disabled={createStudentMutation.isPending}
                      className="w-full py-4 rounded-xl text-white font-black text-base flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                      style={{ background: "linear-gradient(135deg,#f97316 0%,#ea580c 100%)", boxShadow: "0 10px 32px rgba(249,115,22,.35)" }}
                    >
                      {createStudentMutation.isPending ? "⏳ جاري الإرسال..." : "✈️ إرسال طلب التسجيل الآن"}
                    </button>

                    <p className="text-center text-xs text-[#a3a3a3]">
                      🔒 معلوماتك محفوظة وآمنة · سنتواصل معك خلال 24 ساعة
                    </p>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-5">
          <SectionHeader tag="⭐ مميزاتنا" title={<>لماذا تختار <Accent>GAB SCHOOL</Accent>؟</>} desc="نقدم أفضل تجربة تعليمية في مجال تصليح الهواتف على مستوى الجزائر" />
          <div ref={featuresAnim.ref} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="bg-[#fafafa] border border-[#e5e5e5] rounded-3xl p-8 text-center transition-all hover:-translate-y-2 hover:shadow-2xl hover:border-[#fed7aa] relative overflow-hidden group cursor-default"
                style={{
                  opacity: featuresAnim.visible ? 1 : 0,
                  transform: featuresAnim.visible ? "translateY(0)" : "translateY(32px)",
                  transition: `opacity .5s ${i * 0.08}s ease, transform .5s ${i * 0.08}s ease`,
                }}
              >
                <div className="absolute bottom-0 left-0 right-0 h-0.5 origin-right scale-x-0 group-hover:scale-x-100 transition-transform duration-500" style={{ background: "linear-gradient(90deg,#f97316,#ea580c)" }} />
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5 transition-all group-hover:scale-110 group-hover:shadow-xl" style={{ background: "#ffedd5" }}>
                  {f.icon}
                </div>
                <h3 className="text-base font-black mb-3 text-[#111]">{f.title}</h3>
                <p className="text-sm text-[#525252] leading-7">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── WHY #1 ─── */}
      <section className="py-20 relative overflow-hidden" style={{ background: "linear-gradient(135deg,#f97316 0%,#ea580c 100%)" }}>
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,.06)" }} />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,.06)" }} />
        <div className="max-w-7xl mx-auto px-5 relative">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-white/20 text-white border border-white/30 px-4 py-1.5 rounded-full text-xs font-bold mb-3">
              🏆 الأفضل في الجزائر
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
              نحن الرقم <span className="text-[#ffedd5]">#1</span>
            </h2>
            <div className="w-14 h-1 rounded-full mx-auto mb-3 bg-white/40" />
            <p className="text-white/85 text-sm max-w-xl mx-auto">منذ سنوات ونحن نبني محترفين في مجال تصليح الهواتف</p>
          </div>
          <div ref={whyAnim.ref} className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {WHY_ITEMS.map((w, i) => (
              <div
                key={w.title}
                className="rounded-3xl p-7 text-white transition-all hover:-translate-y-2 cursor-default"
                style={{
                  background: "rgba(255,255,255,.15)",
                  backdropFilter: "blur(12px)",
                  border: "1.5px solid rgba(255,255,255,.3)",
                  opacity: whyAnim.visible ? 1 : 0,
                  transform: whyAnim.visible ? "translateY(0)" : "translateY(32px)",
                  transition: `opacity .5s ${i * 0.1}s ease, transform .5s ${i * 0.1}s ease`,
                }}
              >
                <span className="text-4xl mb-4 block" style={{ animationDelay: `${i * 0.4}s` }}>{w.emoji}</span>
                <h4 className="font-black text-base mb-2">{w.title}</h4>
                <p className="text-white/85 text-sm leading-7">{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── GALLERY ─── */}
      <section id="gallery" className="py-20 bg-[#f5f5f5]">
        <div className="max-w-7xl mx-auto px-5">
          <SectionHeader tag="🖼️ معرض الأعمال" title={<>أعمالنا <Accent>وتجهيزاتنا</Accent></>} desc="صور من معامل الأكاديمية وأعمال الخريجين والتجهيزات الحديثة" />
          {gallery && gallery.length > 0 ? (
            <div ref={galleryAnim.ref} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {gallery.map((img, i) => (
                <div
                  key={img.id}
                  className="aspect-square rounded-2xl overflow-hidden bg-[#e5e5e5] shadow-md hover:-translate-y-2 hover:shadow-2xl transition-all duration-500 group relative"
                  style={{
                    opacity: galleryAnim.visible ? 1 : 0,
                    transform: galleryAnim.visible ? "translateY(0) scale(1)" : "translateY(32px) scale(0.96)",
                    transition: `opacity .55s ${(i % 8) * 0.07}s ease, transform .55s ${(i % 8) * 0.07}s ease`,
                  }}
                >
                  <img src={img.url} alt={img.caption || `صورة ${i + 1}`} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  {img.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-3 py-1.5 truncate translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                      {img.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-[#a3a3a3]">
              <div className="text-6xl mb-4">🖼️</div>
              <p className="text-base font-semibold">سيتم إضافة صور المعمل والأعمال قريباً</p>
              <p className="text-sm mt-2">يمكن رفع الصور من لوحة التحكم</p>
            </div>
          )}
        </div>
      </section>

    </PublicLayout>
  );
}

// ─── helpers ───────────────────────────────────────────────
const inputCls = "w-full px-4 py-3 border border-[#e5e5e5] rounded-xl bg-[#f5f5f5] text-sm focus:outline-none focus:border-[#f97316] focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all font-[Cairo,sans-serif]";
const selectCls = inputCls + " appearance-none cursor-pointer";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-[#525252] mb-1.5">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

function Accent({ children }: { children: React.ReactNode }) {
  return <span className="text-gradient-orange">{children}</span>;
}

function SectionHeader({ tag, title, desc }: { tag: string; title: React.ReactNode; desc: string }) {
  return (
    <div className="text-center mb-14">
      <div className="inline-flex items-center gap-2 bg-[#ffedd5] text-[#ea580c] border border-[#fed7aa] px-4 py-1.5 rounded-full text-xs font-bold mb-3">
        {tag}
      </div>
      <h2 className="text-3xl md:text-4xl font-black text-[#111] mb-3">{title}</h2>
      <div className="w-14 h-1 rounded-full mx-auto mb-3" style={{ background: "linear-gradient(90deg,#f97316,#ea580c)" }} />
      <p className="text-[#525252] text-sm max-w-xl mx-auto">{desc}</p>
    </div>
  );
}
