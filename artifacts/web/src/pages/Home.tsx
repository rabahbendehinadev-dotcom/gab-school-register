import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useToast } from "@/hooks/use-toast";
import { useCreateStudent, useListGalleryImages } from "@workspace/api-client-react";
import CourseCountdown from "@/components/CourseCountdown";
import OpenDaySection from "@/components/OpenDaySection";

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



export default function Home() {
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [registeredAsOnline, setRegisteredAsOnline] = useState(false);
  const { data: gallery } = useListGalleryImages();
  const createStudentMutation = useCreateStudent();
  const form = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { housingNeeded: false, trainingType: "physical", experienceLevel: "none" },
  });

  const onSubmit = async (data: RegistrationForm) => {
    try {
      await createStudentMutation.mutateAsync({ data });
      setRegisteredAsOnline(data.trainingType === "online");
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
              <CourseCountdown />
              <OpenDaySection />
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
                  <div className="text-center py-4 space-y-4">
                    <div className="text-5xl">🎉</div>
                    <div>
                      <p className="text-xl font-black text-[#111] mb-1">تم إرسال طلبك بنجاح!</p>
                      <p className="text-sm text-gray-500">سيتواصل معك فريق GAB SCHOOL خلال 24 ساعة.</p>
                    </div>

                    {registeredAsOnline && (
                      <a
                        href="https://online.gab-school.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-2xl border-2 border-orange-400 bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3.5 text-right transition-all hover:from-orange-100 hover:to-amber-100 hover:shadow-md group mx-auto"
                      >
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white text-lg shadow group-hover:scale-105 transition-transform">
                          🎓
                        </div>
                        <div className="flex-1 min-w-0 text-right">
                          <p className="text-sm font-black text-[#111] mb-0.5">ابدأ دورتك الأونلاين الآن</p>
                          <p className="text-[11px] text-orange-600 font-semibold">online.gab-school.com ←</p>
                        </div>
                      </a>
                    )}

                    <a
                      href="https://wa.me/213772339494?text=%D8%A7%D9%84%D8%B3%D9%84%D8%A7%D9%85%20%D8%B9%D9%84%D9%8A%D9%83%D9%85%20%D8%8C%20%D9%84%D9%82%D8%AF%20%D9%82%D9%85%D8%AA%20%D8%A8%D8%A7%D9%84%D8%AA%D8%B3%D8%AC%D9%8A%D9%84%20%D9%81%D9%8A%20GAB%20SCHOOL%20%D9%88%D8%A3%D8%B1%D9%8A%D8%AF%20%D9%85%D8%B9%D8%B1%D9%81%D8%A9%20%D8%A7%D9%84%D9%85%D8%B2%D9%8A%D8%AF"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-3 bg-[#25d366] hover:bg-[#1ebe5d] text-white font-bold px-6 py-3 rounded-2xl transition-colors shadow-lg text-sm"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      تواصل معنا الآن على واتساب
                    </a>
                    <p className="text-xs text-gray-400">أو اضغط الزر الأخضر في أسفل الصفحة</p>
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

                    {/* ── Online Platform Card ── */}
                    <div className="online-border-glow rounded-2xl overflow-hidden border border-orange-400/30" style={{ background: "linear-gradient(135deg,#0f0f0f 0%,#1a1200 60%,#1c0a00 100%)" }}>
                      <div className="h-0.5 w-full" style={{ background:"linear-gradient(90deg,transparent,#f97316,#fb923c,transparent)", backgroundSize:"400px 100%", animation:"shimmer 2s linear infinite" }} />
                      <div className="px-4 pt-3 pb-2">
                        <div className="flex items-center justify-between mb-2">
                          <div className="inline-flex items-center gap-1.5 bg-orange-500/15 border border-orange-500/30 rounded-full px-2.5 py-0.5">
                            <span className="live-dot w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
                            <span className="text-[10px] font-bold text-orange-300 tracking-wider uppercase">متاح الآن</span>
                          </div>
                          <span className="text-[9px] text-gray-500">online.gab-school.com</span>
                        </div>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="relative flex-shrink-0">
                            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl online-icon-float" style={{ background:"linear-gradient(135deg,#f97316,#ea580c)", boxShadow:"0 4px 16px rgba(249,115,22,0.5)" }}>
                              🎓
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span className="online-orbit-dot w-1.5 h-1.5 rounded-full bg-orange-300/80 block" style={{ boxShadow:"0 0 5px rgba(249,115,22,0.9)" }} />
                            </div>
                          </div>
                          <div className="text-right flex-1">
                            <p className="text-sm font-black text-white leading-tight">منصة GAB SCHOOL</p>
                            <p className="text-[10px] text-orange-300 font-semibold">الدروس الأونلاين · فيديوهات مسجّلة</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 mb-2">
                          {[["📹","دروس مرئية"],["🕐","في أي وقت"],["📱","من هاتفك"]].map(([icon, label]) => (
                            <div key={label} className="flex flex-col items-center gap-0.5 bg-white/5 rounded-xl py-1.5 border border-white/8">
                              <span className="text-sm">{icon}</span>
                              <span className="text-[9px] text-gray-400 font-medium">{label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="px-4 pb-3">
                        <a
                          href="https://online.gab-school.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="online-btn-shimmer w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-white text-sm hover:scale-[1.02] active:scale-[0.98] transition-transform"
                          style={{ boxShadow:"0 6px 24px rgba(249,115,22,0.45)" }}
                        >
                          <span>🚀 انطلق للدروس الآن</span>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
                          </svg>
                        </a>
                      </div>
                    </div>

                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── GALLERY ─── */}
      <section id="gallery" className="py-20 bg-[#f5f5f5]">
        <div className="max-w-7xl mx-auto px-5">
          <SectionHeader tag="🖼️ معرض الأعمال" title={<>أعمالنا <Accent>وتجهيزاتنا</Accent></>} desc="صور من معامل الأكاديمية وأعمال الخريجين والتجهيزات الحديثة" />
          {gallery && gallery.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {gallery.map((img, i) => (
                <div
                  key={img.id}
                  className="aspect-square rounded-2xl overflow-hidden bg-[#e5e5e5] shadow-md hover:-translate-y-2 hover:shadow-2xl transition-all duration-500 group relative"
                  style={{
                    animationName: "fadeUp",
                    animationDuration: "0.6s",
                    animationTimingFunction: "ease",
                    animationFillMode: "both",
                    animationDelay: `${i * 0.08}s`,
                  }}
                >
                  <img src={img.url} alt={img.caption || `صورة ${i + 1}`} loading="eager" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
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
