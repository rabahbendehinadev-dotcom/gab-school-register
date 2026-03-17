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
    <div className="flex flex-col items-center gap-1">
      <div className="w-12 h-12 bg-black/70 rounded-xl flex items-center justify-center border border-orange-500/20 shadow-sm">
        <span className="text-xl font-black text-white font-mono tracking-tight">{display}</span>
      </div>
      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</span>
    </div>
  );
}

function Sep() {
  return (
    <div className="flex flex-col gap-1 pb-4">
      <span className="w-1 h-1 rounded-full bg-orange-400/60" />
      <span className="w-1 h-1 rounded-full bg-orange-400/60" />
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
        if (data.value) setCourseDate(new Date(data.value));
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
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      dir="rtl"
      className="w-full rounded-2xl bg-gradient-to-br from-gray-900 to-gray-950 border border-orange-500/20 shadow-lg px-4 py-4 mb-4"
    >
      {/* Top row: badge + date */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/25 text-orange-400 text-[10px] font-bold px-3 py-1 rounded-full tracking-wider uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
          الدورة القادمة
        </span>
        <span className="text-gray-400 text-xs">{dateLabel}</span>
      </div>

      {/* Countdown digits */}
      {timeLeft && !timeLeft.expired ? (
        <div className="flex items-center justify-center gap-2">
          <Digit value={timeLeft.days} label="يوم" />
          <Sep />
          <Digit value={timeLeft.hours} label="ساعة" />
          <Sep />
          <Digit value={timeLeft.minutes} label="دقيقة" />
          <Sep />
          <Digit value={timeLeft.seconds} label="ثانية" />
        </div>
      ) : (
        <p className="text-center text-orange-400 font-bold text-sm py-1">🚀 الدورة انطلقت!</p>
      )}

      <p className="text-center text-gray-500 text-[10px] mt-3">
        سارع بالتسجيل قبل امتلاء المقاعد
      </p>
    </div>
  );
}
