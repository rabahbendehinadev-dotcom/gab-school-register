import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface OpenDayStatus {
  enabled: boolean;
  seats: number;
  date: string | null;
  opensAt: string | null;
  title: string;
  registrationCount: number;
  spotsLeft: number;
  isFull: boolean;
}

interface TimeLeft {
  days: number; hours: number; minutes: number; seconds: number; expired: boolean;
}

function calcTimeLeft(target: Date): TimeLeft {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / 1000 / 60) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    expired: false,
  };
}

function Pad({ n }: { n: number }) {
  return <span className="font-black tabular-nums">{String(n).padStart(2, "0")}</span>;
}

export default function OpenDaySection() {
  const { toast } = useToast();
  const [status, setStatus] = useState<OpenDayStatus | null>(null);
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [countdownTarget, setCountdownTarget] = useState<Date | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", whatsapp: "", city: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch("/api/open-day/status")
      .then(r => r.json())
      .then((s: OpenDayStatus) => {
        setStatus(s);
        if (s.opensAt) setCountdownTarget(new Date(s.opensAt));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!countdownTarget) return;
    setTimeLeft(calcTimeLeft(countdownTarget));
    const id = setInterval(() => setTimeLeft(calcTimeLeft(countdownTarget)), 1000);
    return () => clearInterval(id);
  }, [countdownTarget]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.phone || !form.city) {
      toast({ variant: "destructive", title: "الرجاء ملء جميع الحقول" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/open-day/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, whatsapp: form.whatsapp || form.phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: "destructive", title: data.error || "حدث خطأ" });
        if (data.error?.includes("امتلأ")) {
          const s = await fetch("/api/open-day/status").then(r => r.json());
          setStatus(s);
        }
        return;
      }
      setSubmitted(true);
      const updated = await fetch("/api/open-day/status").then(r => r.json());
      setStatus(updated);
      toast({ title: "🎉 تم تسجيلك بنجاح في اليوم المفتوح!" });
    } catch {
      toast({ variant: "destructive", title: "حدث خطأ في الاتصال" });
    } finally {
      setSubmitting(false);
    }
  }

  if (!status) return null;

  const opensAtDate = status.opensAt ? new Date(status.opensAt) : null;
  const eventDate = status.date ? new Date(status.date) : null;
  const registrationNotYetOpen = opensAtDate && timeLeft && !timeLeft.expired && !status.enabled;
  const pct = Math.min(100, (status.registrationCount / status.seats) * 100);

  const inputCls = "w-full border border-[#e5e5e5] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all placeholder:text-[#a3a3a3]";

  return (
    <div dir="rtl" className="w-full rounded-3xl overflow-hidden mb-6 shadow-xl border border-orange-200" style={{ background: "linear-gradient(135deg,#fff7ed 0%,#fff 60%,#fff7ed 100%)" }}>
      {/* Header */}
      <div className="relative px-5 pt-5 pb-4 overflow-hidden" style={{ background: "linear-gradient(135deg,#1a0a00 0%,#2d1200 100%)" }}>
        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background:"linear-gradient(90deg,transparent,#f97316,transparent)", backgroundSize:"400px 100%", animation:"shimmer 2s linear infinite" }} />

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="inline-flex items-center gap-1.5 bg-orange-500/20 border border-orange-500/40 rounded-full px-3 py-1">
            <span className="live-dot w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
            <span className="text-[10px] font-black text-orange-300 tracking-widest uppercase">Open Day</span>
          </div>
          {eventDate && (
            <span className="text-[10px] text-orange-200/70 font-medium">
              {eventDate.toLocaleDateString("ar-DZ", { weekday: "long", month: "long", day: "numeric" })}
            </span>
          )}
        </div>

        <h3 className="text-xl font-black text-white mt-2 mb-0.5">{status.title}</h3>
        <p className="text-[11px] text-orange-200/80">يوم مفتوح مجاني · سجّل مقعدك الآن</p>

        {/* Seat progress */}
        <div className="mt-3">
          <div className="flex justify-between text-[10px] font-bold mb-1">
            <span className="text-orange-200/70">المقاعد المتبقية</span>
            <span className={status.isFull ? "text-red-400" : "text-orange-300"}>
              {status.isFull ? "🚫 امتلأت المقاعد" : `${status.spotsLeft} / ${status.seats} مقعد متبقي`}
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: pct >= 100 ? "#ef4444" : "linear-gradient(90deg,#f97316,#fb923c)" }}
            />
          </div>
        </div>
      </div>

      {/* Countdown to registration opening */}
      {registrationNotYetOpen && timeLeft && !timeLeft.expired && (
        <div className="px-5 py-4 bg-orange-50 border-b border-orange-100">
          <p className="text-center text-xs font-bold text-orange-700 mb-2">⏳ يفتح التسجيل خلال</p>
          <div className="flex items-center justify-center gap-2 text-orange-900">
            {[{ v: timeLeft.days, l: "يوم" }, { v: timeLeft.hours, l: "ساعة" }, { v: timeLeft.minutes, l: "دقيقة" }, { v: timeLeft.seconds, l: "ثانية" }].map(({ v, l }, i) => (
              <div key={l} className="flex items-center gap-2">
                {i > 0 && <span className="text-orange-400 font-black text-sm">:</span>}
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center shadow-sm">
                    <span className="text-white text-sm font-black"><Pad n={v} /></span>
                  </div>
                  <span className="text-[9px] text-orange-600 font-bold mt-0.5">{l}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Body */}
      <div className="px-5 py-4">
        {submitted ? (
          <div className="text-center py-4 space-y-3">
            <div className="text-4xl">🎉</div>
            <p className="font-black text-[#111] text-base">تم تسجيلك بنجاح!</p>
            <p className="text-xs text-gray-500">سنتواصل معك قريباً بتفاصيل اليوم المفتوح</p>
            <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-xs font-bold text-green-700">
              🪑 المقاعد المتبقية: {status.spotsLeft}
            </div>
          </div>
        ) : status.isFull ? (
          <div className="text-center py-6 space-y-3">
            <div className="text-4xl">😔</div>
            <p className="font-black text-[#111] text-base">عذراً، لقد امتلأت جميع المقاعد!</p>
            <p className="text-xs text-gray-500">تابعونا للإعلان عن اليوم المفتوح القادم</p>
            <a
              href="https://wa.me/213772339494?text=أريد الاشتراك في اليوم المفتوح القادم"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#25d366] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md hover:bg-[#1ebe5d] transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              أبلغني عن الدورة القادمة
            </a>
          </div>
        ) : !status.enabled && !registrationNotYetOpen ? (
          <div className="text-center py-4 text-sm text-gray-400">
            التسجيل مغلق حالياً — تابعونا للإعلان عن الموعد
          </div>
        ) : !status.enabled && registrationNotYetOpen ? null : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-gray-500 block mb-1">الاسم الأول *</label>
                <input value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} placeholder="محمد" className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 block mb-1">اللقب *</label>
                <input value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} placeholder="بن علي" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-gray-500 block mb-1">الهاتف *</label>
                <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="05X XX XX XX" dir="ltr" className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 block mb-1">الواتساب</label>
                <input value={form.whatsapp} onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))} placeholder="نفس الرقم" dir="ltr" className={inputCls} />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 block mb-1">الولاية *</label>
              <input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="الجزائر · وهران · عنابة..." className={inputCls} />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl font-black text-white text-sm flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#f97316,#ea580c)", boxShadow: "0 8px 24px rgba(249,115,22,.35)" }}
            >
              {submitting ? "⏳ جاري التسجيل..." : `🎟️ احجز مقعدك مجاناً (${status.spotsLeft} متبقي)`}
            </button>
            <p className="text-center text-[10px] text-gray-400">مجاني تماماً · بدون أي رسوم</p>
          </form>
        )}
      </div>
    </div>
  );
}
