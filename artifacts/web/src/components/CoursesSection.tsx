import { useEffect, useState } from "react";

interface Course {
  id: number;
  title: string;
  startDate: string;
  seats: number;
  enabled: boolean;
  visibleOnPage: boolean;
}

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
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-11 h-11 bg-black/70 rounded-xl flex items-center justify-center border border-orange-500/20 shadow-sm">
        <span className="text-lg font-black text-white font-mono">{String(value).padStart(2, "0")}</span>
      </div>
      <span className="text-[9px] font-medium text-gray-400 uppercase tracking-wide">{label}</span>
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

function CourseCard({ course }: { course: Course }) {
  const target = new Date(course.startDate);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calcTimeLeft(target));

  useEffect(() => {
    setTimeLeft(calcTimeLeft(target));
    const id = setInterval(() => setTimeLeft(calcTimeLeft(target)), 1000);
    return () => clearInterval(id);
  }, [course.startDate]);

  const dateLabel = target.toLocaleDateString("ar-DZ", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      dir="rtl"
      className="w-full rounded-2xl bg-gradient-to-br from-gray-900 to-gray-950 border border-orange-500/20 shadow-lg px-4 py-4"
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/25 text-orange-400 text-[10px] font-bold px-3 py-1 rounded-full tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
          {course.title}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs">{dateLabel}</span>
          <span className="text-[10px] bg-white/10 text-gray-300 px-2 py-0.5 rounded-full">
            {course.seats} مقعد
          </span>
        </div>
      </div>

      {timeLeft.expired ? (
        <p className="text-center text-orange-400 font-bold text-sm py-1">🚀 الدورة انطلقت!</p>
      ) : (
        <div className="flex items-center justify-center gap-2">
          <Digit value={timeLeft.days} label="يوم" />
          <Sep />
          <Digit value={timeLeft.hours} label="ساعة" />
          <Sep />
          <Digit value={timeLeft.minutes} label="دقيقة" />
          <Sep />
          <Digit value={timeLeft.seconds} label="ثانية" />
        </div>
      )}

      <p className="text-center text-gray-500 text-[10px] mt-3">
        سارع بالتسجيل قبل امتلاء المقاعد
      </p>
    </div>
  );
}

export default function CoursesSection() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/courses")
      .then(r => r.json())
      .then((data: Course[]) => {
        setCourses(Array.isArray(data) ? data : []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded || courses.length === 0) return null;

  return (
    <div className="space-y-3 mb-4">
      {courses.map(course => (
        <CourseCard key={course.id} course={course} />
      ))}
    </div>
  );
}
