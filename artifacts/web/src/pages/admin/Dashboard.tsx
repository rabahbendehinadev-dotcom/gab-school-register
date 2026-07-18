import { AdminLayout } from "@/components/layout/AdminLayout";
import { PermissionGuard } from "@/components/admin/PermissionGuard";
import { useGetDashboardStats, useListActivity } from "@workspace/api-client-react";
import { Users, UserPlus, PhoneCall, CheckCircle, XCircle, Archive, Layers, FolderOpen, CalendarDays, Save, Wallet, Banknote, Target, AlertCircle, GraduationCap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { useI18n } from "@/contexts/i18n-context";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface ErpStats {
  todayRegistrations: number; monthRegistrations: number; notContacted: number;
  waitingPayment: number; confirmed: number; inTraining: number; completed: number;
  archived: number; totalStudents: number; conversionRate: number;
}
interface FinancialStats { todayRevenue: number; monthRevenue: number; totalRevenue: number; outstanding: number }

async function statFetch(path: string) {
  const res = await fetch(`/api${path}`, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function ErpMetrics() {
  const { lang } = useI18n();
  const isFr = lang === "fr";
  const { data: erp } = useQuery<ErpStats>({ queryKey: ["stats-erp"], queryFn: () => statFetch("/stats/erp") });
  const { data: fin } = useQuery<FinancialStats>({ queryKey: ["stats-financials"], queryFn: () => statFetch("/stats/financials") });

  const metrics = [
    { label: isFr ? "Inscrits aujourd'hui" : "تسجيلات اليوم", value: erp?.todayRegistrations ?? 0, icon: UserPlus, color: "text-purple-600", bg: "bg-purple-50" },
    { label: isFr ? "Inscrits ce mois" : "تسجيلات الشهر", value: erp?.monthRegistrations ?? 0, icon: CalendarDays, color: "text-blue-600", bg: "bg-blue-50" },
    { label: isFr ? "Revenu aujourd'hui" : "إيرادات اليوم", value: `${fin?.todayRevenue ?? 0}`, icon: Wallet, color: "text-green-600", bg: "bg-green-50" },
    { label: isFr ? "Revenu ce mois" : "إيرادات الشهر", value: `${fin?.monthRevenue ?? 0}`, icon: Banknote, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: isFr ? "Taux de conversion" : "نسبة التحويل", value: `${erp?.conversionRate ?? 0}%`, icon: Target, color: "text-orange-600", bg: "bg-orange-50" },
    { label: isFr ? "Impayés" : "مبالغ مستحقة", value: `${fin?.outstanding ?? 0}`, icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
  ];

  const funnel = [
    { label: isFr ? "Non contactés" : "لم يتم الاتصال", value: erp?.notContacted ?? 0, color: "bg-blue-500" },
    { label: isFr ? "Attente paiement" : "بانتظار الدفع", value: erp?.waitingPayment ?? 0, color: "bg-amber-500" },
    { label: isFr ? "Confirmés" : "مؤكّدون", value: erp?.confirmed ?? 0, color: "bg-violet-500" },
    { label: isFr ? "En formation" : "في التدريب", value: erp?.inTraining ?? 0, color: "bg-cyan-500" },
    { label: isFr ? "Terminés" : "أتموا", value: erp?.completed ?? 0, color: "bg-green-500" },
  ];
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.value));

  return (
    <div className="space-y-4 mb-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {metrics.map((m, i) => (
          <div key={i} className="bg-card rounded-2xl border border-border/50 shadow-sm p-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${m.bg} ${m.color} mb-2`}><m.icon className="w-4.5 h-4.5" /></div>
            <p className="text-[11px] text-muted-foreground leading-tight">{m.label}</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold">{isFr ? "Parcours étudiant" : "رحلة الطالب"}</h2>
        </div>
        <div className="space-y-2.5">
          {funnel.map((f, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-28 flex-shrink-0 text-end">{f.label}</span>
              <div className="flex-1 bg-muted/40 rounded-full h-6 overflow-hidden">
                <div className={`${f.color} h-full rounded-full flex items-center justify-end px-2 transition-all`} style={{ width: `${Math.max(8, (f.value / maxFunnel) * 100)}%` }}>
                  <span className="text-[11px] font-bold text-white">{f.value}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NextCourseDateCard() {
  const { toast } = useToast();
  const [dateVal, setDateVal] = useState("");
  const [timeVal, setTimeVal] = useState("09:00");
  const [savedLabel, setSavedLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings/next-course")
      .then(r => r.json())
      .then((data: { value: string | null }) => {
        if (data.value) {
          const d = new Date(data.value);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          const hh = String(d.getHours()).padStart(2, "0");
          const min = String(d.getMinutes()).padStart(2, "0");
          setDateVal(`${yyyy}-${mm}-${dd}`);
          setTimeVal(`${hh}:${min}`);
          setSavedLabel(d.toLocaleDateString("ar-DZ", {
            weekday: "long", year: "numeric", month: "long", day: "numeric",
            hour: "2-digit", minute: "2-digit",
          }));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!dateVal) {
      toast({ title: "يرجى اختيار تاريخ الدورة", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const iso = new Date(`${dateVal}T${timeVal}:00`).toISOString();
      const r = await fetch("/api/settings/next-course", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ value: iso }),
      });
      if (r.ok) {
        const d = new Date(iso);
        setSavedLabel(d.toLocaleDateString("ar-DZ", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
          hour: "2-digit", minute: "2-digit",
        }));
        toast({ title: "✅ تم حفظ تاريخ الدورة بنجاح" });
      } else {
        toast({ title: "فشل الحفظ", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl border border-orange-500/30 shadow-xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
          <CalendarDays className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h2 className="font-bold text-white text-base">تاريخ الدورة القادمة</h2>
          <p className="text-xs text-gray-400">يظهر العداد التنازلي على الموقع تلقائياً</p>
        </div>
      </div>

      {loading ? (
        <div className="h-28 bg-gray-800 animate-pulse rounded-xl" />
      ) : (
        <div className="space-y-3">
          {/* Date + Time inputs in a row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">📅 التاريخ</label>
              <input
                type="date"
                value={dateVal}
                onChange={e => setDateVal(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">⏰ الوقت</label>
              <input
                type="time"
                value={timeVal}
                onChange={e => setTimeVal(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
              />
            </div>
          </div>

          {savedLabel && (
            <div className="bg-gray-800/60 rounded-lg px-3 py-2">
              <p className="text-[11px] text-gray-400">
                الحالي: <span className="text-orange-400 font-semibold">{savedLabel}</span>
              </p>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !dateVal}
            className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors text-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? "جاري الحفظ..." : "حفظ وتحديث الموقع"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { t } = useI18n();
  const { data: stats, isLoading, error, refetch } = useGetDashboardStats();
  const { data: activity } = useListActivity({ limit: 5 });

  if (isLoading) return <AdminLayout><div className="p-8 text-center text-muted-foreground animate-pulse">Loading dashboard...</div></AdminLayout>;
  if (!stats) return (
    <AdminLayout>
      <div className="p-8 text-center space-y-4">
        <p className="text-muted-foreground">Failed to load dashboard.</p>
        {error && <p className="text-xs text-red-500">{String(error)}</p>}
        <button onClick={() => refetch()} className="text-sm underline text-primary">Retry</button>
      </div>
    </AdminLayout>
  );

  const statCards = [
    { label: t.totalStudents, value: stats.totalStudents, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-200", href: "/gab-c7x2p/students" },
    { label: t.newLeads, value: stats.newStudents, icon: UserPlus, color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-200", href: "/gab-c7x2p/students?stage=new" },
    { label: t.contacted, value: stats.contactedStudents, icon: PhoneCall, color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-200", href: "/gab-c7x2p/students?stage=contacted" },
    { label: t.interested, value: stats.interestedStudents, icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10", border: "border-green-200", href: "/gab-c7x2p/students?stage=interested" },
    { label: t.noShows, value: stats.noShowStudents, icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-200", href: "/gab-c7x2p/students?stage=no_show" },
    { label: t.archived, value: stats.archivedStudents, icon: Archive, color: "text-gray-500", bg: "bg-gray-500/10", border: "border-gray-200", href: "/gab-c7x2p/students?stage=archived" },
    { label: t.totalGroups, value: stats.totalGroups, icon: Layers, color: "text-indigo-500", bg: "bg-indigo-500/10", border: "border-indigo-200", href: "/gab-c7x2p/groups" },
    { label: t.openGroups, value: stats.openGroups, icon: FolderOpen, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-200", href: "/gab-c7x2p/groups" },
  ];

  return (
    <AdminLayout>
      <PermissionGuard permission="view_dashboard">
      {/* ERP metrics + journey funnel */}
      <ErpMetrics />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
        {statCards.map((stat, i) => (
          <Card
            key={i}
            className={`border ${stat.border} shadow-sm hover:shadow-lg transition-all cursor-pointer group hover:-translate-y-1`}
            onClick={() => navigate(stat.href)}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                <h3 className="text-2xl font-bold text-foreground mt-1">{stat.value}</h3>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom Section */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Overview + Next Course */}
        <div className="lg:col-span-2 space-y-6">
          <NextCourseDateCard />
        </div>

        {/* Right: Recent Activity */}
        <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-0 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-border/50 bg-muted/20">
            <h2 className="text-lg font-bold">{t.recentActivity}</h2>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {activity?.map(log => (
              <div key={log.id} className="p-4 hover:bg-muted/50 rounded-xl transition-colors mb-1">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-sm">{log.action}</span>
                  <span className="text-xs text-muted-foreground">{format(new Date(log.createdAt), "MMM d, h:mm a")}</span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{log.details}</p>
                {log.performedBy && <p className="text-xs text-primary mt-2 font-medium">By {log.performedBy}</p>}
              </div>
            ))}
            {!activity?.length && <div className="p-8 text-center text-muted-foreground text-sm">{t.noRecentActivity}</div>}
          </div>
        </div>
      </div>
      </PermissionGuard>
    </AdminLayout>
  );
}
