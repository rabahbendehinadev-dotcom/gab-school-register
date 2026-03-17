import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Users, Clock, Power, Settings2, Trash2, Download } from "lucide-react";

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

interface Registration {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  whatsapp: string;
  city: string;
  createdAt: string;
}

function toIntlPhone(p: string) {
  let c = p.replace(/\D/g, "");
  if (c.startsWith("0") && c.length === 10) c = "213" + c.slice(1);
  else if (c.startsWith("5") && c.length === 9) c = "213" + c;
  return c;
}

export default function OpenDay() {
  const { toast } = useToast();
  const [status, setStatus] = useState<OpenDayStatus | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "اليوم المفتوح",
    seats: "15",
    date: "",
    dateTime: "09:00",
    opensAt: "",
    opensAtTime: "09:00",
  });

  async function load() {
    const [s, r] = await Promise.all([
      fetch("/api/open-day/status").then(x => x.json()),
      fetch("/api/open-day/registrations").then(x => x.json()),
    ]);
    setStatus(s);
    setRegistrations(r);
    setForm(prev => ({
      ...prev,
      title: s.title || "اليوم المفتوح",
      seats: String(s.seats || 15),
      date: s.date ? s.date.split("T")[0] : "",
      dateTime: s.date ? s.date.split("T")[1]?.slice(0, 5) || "09:00" : "09:00",
      opensAt: s.opensAt ? s.opensAt.split("T")[0] : "",
      opensAtTime: s.opensAt ? s.opensAt.split("T")[1]?.slice(0, 5) || "09:00" : "09:00",
    }));
  }

  useEffect(() => { load(); }, []);

  async function toggleEnabled() {
    if (!status) return;
    setSaving(true);
    await fetch("/api/open-day/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !status.enabled }),
    });
    await load();
    setSaving(false);
    toast({ title: !status.enabled ? "✅ تم تفعيل اليوم المفتوح" : "⛔ تم إيقاف اليوم المفتوح" });
  }

  async function saveSettings() {
    setSaving(true);
    const dateVal = form.date ? `${form.date}T${form.dateTime}:00` : "";
    const opensAtVal = form.opensAt ? `${form.opensAt}T${form.opensAtTime}:00` : "";
    await fetch("/api/open-day/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        seats: Number(form.seats),
        date: dateVal,
        opensAt: opensAtVal,
      }),
    });
    await load();
    setSaving(false);
    toast({ title: "✅ تم حفظ الإعدادات" });
  }

  function exportCSV() {
    const header = "الاسم الأول,اللقب,الهاتف,الواتساب,الولاية,تاريخ التسجيل";
    const rows = registrations.map(r =>
      `${r.firstName},${r.lastName},${r.phone},${r.whatsapp},${r.city},${new Date(r.createdAt).toLocaleDateString("ar-DZ")}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "open-day-registrations.csv"; a.click();
  }

  const pct = status ? Math.min(100, (status.registrationCount / status.seats) * 100) : 0;

  return (
    <AdminLayout>
      <div dir="rtl" className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-black text-foreground">🎟️ اليوم المفتوح</h2>
            <p className="text-sm text-muted-foreground mt-0.5">إدارة التسجيل في اليوم المفتوح المجاني</p>
          </div>
          <button
            onClick={toggleEnabled}
            disabled={saving}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg ${
              status?.enabled
                ? "bg-red-500 hover:bg-red-600 text-white shadow-red-200"
                : "bg-green-500 hover:bg-green-600 text-white shadow-green-200"
            }`}
          >
            <Power className="w-4 h-4" />
            {status?.enabled ? "إيقاف التسجيل" : "تفعيل التسجيل"}
          </button>
        </div>

        {/* Status cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "حالة التسجيل", value: status?.enabled ? "مفتوح 🟢" : "مغلق 🔴", color: status?.enabled ? "text-green-600" : "text-red-500" },
            { label: "المقاعد الكلية", value: status?.seats ?? "-", color: "text-foreground" },
            { label: "المسجّلون", value: status?.registrationCount ?? 0, color: "text-orange-500" },
            { label: "المقاعد المتبقية", value: status?.spotsLeft ?? "-", color: status?.isFull ? "text-red-500" : "text-green-600" },
          ].map(card => (
            <div key={card.label} className="bg-card border border-border rounded-2xl p-4 text-center shadow-sm">
              <p className={`text-2xl font-black ${card.color}`}>{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        {status && (
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <div className="flex justify-between text-sm font-medium mb-2">
              <span className="text-muted-foreground">امتلاء المقاعد</span>
              <span className={pct >= 100 ? "text-red-500 font-black" : "text-orange-500 font-black"}>
                {status.registrationCount} / {status.seats}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  background: pct >= 100 ? "#ef4444" : `linear-gradient(90deg,#f97316,#ea580c)`,
                }}
              />
            </div>
            {status.isFull && (
              <p className="text-center text-red-500 font-bold text-sm mt-2">🚫 امتلأت جميع المقاعد</p>
            )}
          </div>
        )}

        {/* Settings form */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="font-black text-base flex items-center gap-2 mb-5">
            <Settings2 className="w-4 h-4 text-orange-500" /> إعدادات اليوم المفتوح
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">عنوان الحدث</label>
              <input
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="اليوم المفتوح — GAB SCHOOL"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">عدد المقاعد</label>
              <input
                type="number"
                min={1}
                value={form.seats}
                onChange={e => setForm(p => ({ ...p, seats: e.target.value }))}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground flex items-center gap-1 mb-1">
                <Calendar className="w-3.5 h-3.5" /> تاريخ اليوم المفتوح
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  className="border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-orange-400" />
                <input type="time" value={form.dateTime} onChange={e => setForm(p => ({ ...p, dateTime: e.target.value }))}
                  className="border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground flex items-center gap-1 mb-1">
                <Clock className="w-3.5 h-3.5" /> موعد فتح التسجيل (اختياري — عداد الوقت)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={form.opensAt} onChange={e => setForm(p => ({ ...p, opensAt: e.target.value }))}
                  className="border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-orange-400" />
                <input type="time" value={form.opensAtTime} onChange={e => setForm(p => ({ ...p, opensAtTime: e.target.value }))}
                  className="border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">سيظهر للزوار عداد العد التنازلي حتى هذا الوقت</p>
            </div>
          </div>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="mt-5 w-full py-3 rounded-xl font-black text-white text-sm transition-all hover:-translate-y-0.5 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#f97316,#ea580c)", boxShadow: "0 6px 20px rgba(249,115,22,.3)" }}
          >
            {saving ? "⏳ جاري الحفظ..." : "💾 حفظ الإعدادات"}
          </button>
        </div>

        {/* Registrations table */}
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h3 className="font-black text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-orange-500" /> المسجّلون ({registrations.length})
            </h3>
            {registrations.length > 0 && (
              <button onClick={exportCSV} className="flex items-center gap-1.5 text-xs font-bold text-orange-500 hover:text-orange-600 transition-colors">
                <Download className="w-3.5 h-3.5" /> تصدير CSV
              </button>
            )}
          </div>
          {registrations.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              لا يوجد مسجّلون بعد
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-xs text-muted-foreground">
                    <th className="text-right px-4 py-3 font-bold">#</th>
                    <th className="text-right px-4 py-3 font-bold">الاسم</th>
                    <th className="text-right px-4 py-3 font-bold">الهاتف</th>
                    <th className="text-right px-4 py-3 font-bold">الولاية</th>
                    <th className="text-right px-4 py-3 font-bold">التاريخ</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((r, i) => (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold">{r.firstName} {r.lastName}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.phone}</td>
                      <td className="px-4 py-3">{r.city}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString("ar-DZ")}
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`https://wa.me/${toIntlPhone(r.whatsapp || r.phone)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#25d366]/10 hover:bg-[#25d366]/20 transition-colors"
                          title="واتساب"
                        >
                          <svg viewBox="0 0 24 24" fill="#25d366" className="w-4 h-4">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
