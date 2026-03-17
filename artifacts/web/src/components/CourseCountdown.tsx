import { useEffect, useState } from "react";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
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

function Digit({ value, label }: { value: number; label: string }) {
  const display = String(value).padStart(2, "0");
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 bg-black rounded-2xl flex items-center justify-center shadow-[0_8px_32px_rgba(249,115,22,0.35)] border border-orange-500/30 overflow-hidden">
        {/* glow line */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-px h-px bg-orange-500/20" />
        {/* top half */}
        <div className="absolute inset-x-0 top-0 h-1/2 bg-white/[0.04]" />
        <span className="relative text-3xl sm:text-4xl font-black text-white tracking-tight font-mono">
          {display}
        </span>
      </div>
      <span className="mt-2 text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-widest">{label}</span>
    </div>
  );
}

export default function CourseCountdown() {
  const [courseDate, setCourseDate] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/settings/next-course")
      .then(r => r.json())
      .then((data: { value: string | null }) => {
        if (data.value) {
          setCourseDate(new Date(data.value));
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!courseDate) return;
    setTimeLeft(calcTimeLeft(courseDate));
    const id = setInterval(() => setTimeLeft(calcTimeLeft(courseDate)), 1000);
    return () => clearInterval(id);
  }, [courseDate]);

  if (!loaded || !courseDate) return null;

  const dateLabel = courseDate.toLocaleDateString("ar-DZ", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      dir="rtl"
      className="relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-gray-950 via-gray-900 to-black border border-orange-500/20 shadow-[0_20px_60px_rgba(0,0,0,0.5)] px-6 py-8 mb-6"
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-orange-500/15 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 right-8 w-48 h-48 bg-orange-600/10 rounded-full blur-2xl" />

      {/* Badge */}
      <div className="flex justify-center mb-4">
        <span className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold px-4 py-1.5 rounded-full tracking-wider uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
          الدورة القادمة
        </span>
      </div>

      {/* Title */}
      <h3 className="text-center text-white font-black text-xl sm:text-2xl mb-1">
        انطلاق الدورة الجديدة
      </h3>
      <p className="text-center text-gray-400 text-sm mb-6">{dateLabel}</p>

      {timeLeft && !timeLeft.expired ? (
        <div className="flex items-center justify-center gap-3 sm:gap-5">
          <Digit value={timeLeft.days} label="يوم" />
          <Separator />
          <Digit value={timeLeft.hours} label="ساعة" />
          <Separator />
          <Digit value={timeLeft.minutes} label="دقيقة" />
          <Separator />
          <Digit value={timeLeft.seconds} label="ثانية" />
        </div>
      ) : (
        <p className="text-center text-orange-400 font-bold text-lg">🚀 الدورة انطلقت!</p>
      )}

      {/* CTA */}
      <p className="text-center text-gray-500 text-xs mt-6">
        سارع بالتسجيل قبل امتلاء المقاعد
      </p>
    </div>
  );
}

function Separator() {
  return (
    <div className="flex flex-col gap-1.5 pb-6">
      <span className="w-1.5 h-1.5 rounded-full bg-orange-500/60" />
      <span className="w-1.5 h-1.5 rounded-full bg-orange-500/60" />
    </div>
  );
}
