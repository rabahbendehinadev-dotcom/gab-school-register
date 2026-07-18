import { AdminLayout } from "@/components/layout/AdminLayout";
import { PermissionGuard } from "@/components/admin/PermissionGuard";
import { useGetDashboardStats, useListActivity } from "@workspace/api-client-react";
import {
  Users, UserPlus, PhoneCall, CheckCircle, XCircle, Archive,
  Layers, FolderOpen, CalendarDays, Save, Wallet, Banknote,
  Target, AlertCircle, GraduationCap, AlertTriangle, Clock,
  TrendingUp, Zap, ArrowUpRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { useI18n } from "@/contexts/i18n-context";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface ErpStats {
  todayRegistrations: number; monthRegistrations: number; notContacted: number;
  waitingPayment: number; confirmed: number; inTraining: number; completed: number;
  archived: number; totalStudents: number; conversionRate: number;
}
interface FinancialStats { todayRevenue: number; monthRevenue: number; totalRevenue: number; outstanding: number }
interface Task { id: number; completed: boolean; dueAt: string | null }

async function statFetch(path: string) {
  const res = await fetch(`/api${path}`, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function greeting(lang: "ar" | "fr", name: string) {
  const h = new Date().getHours();
  const greetFr = h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
  const greetAr = h < 12 ? "صباح الخير" : h < 18 ? "مساء الخير" : "مساء النور";
  return lang === "fr" ? `${greetFr}, ${name?.split(" ")[0]}` : `${greetAr}، ${name?.split(" ")[0]}`;
}

function PriorityBar() {
  const { lang } = useI18n();
  const isFr = lang === "fr";
  const [, navigate] = useLocation();

  const { data: erp }   = useQuery<ErpStats>({ queryKey: ["stats-erp"],        queryFn: () => statFetch("/stats/erp") });
  const { data: fin }   = useQuery<FinancialStats>({ queryKey: ["stats-financials"], queryFn: () => statFetch("/stats/financials") });
  const { data: tasks } = useQuery<Task[]>({
    queryKey: ["tasks-all"],
    queryFn: () => statFetch("/tasks"),
    staleTime: 60_000,
  });

  const now = new Date();
  const overdueTasks = (tasks ?? []).filter(t => !t.completed && t.dueAt && new Date(t.dueAt) < now).length;
  const notContacted = erp?.notContacted ?? 0;
  const waitingPay   = erp?.waitingPayment ?? 0;
  const outstanding  = fin?.outstanding ?? 0;

  const items = [
    {
      icon: AlertTriangle,
      label:  isFr ? "Tâches en retard"    : "مهام متأخرة",
      value:  overdueTasks,
      sub:    isFr ? "Nécessite action immédiate" : "تحتاج تدخلاً فورياً",
      color:  "text-red-600", bg: "bg-red-50", border: "border-red-200",
      dot:    overdueTasks > 0 ? "bg-red-500" : "",
      href:   "/gab-c7x2p/tasks",
      urgent: overdueTasks > 0,
    },
    {
      icon: Clock,
      label:  isFr ? "Leads non contactés"   : "لم يتم التواصل معهم",
      value:  notContacted,
      sub:    isFr ? "En attente de premier contact" : "بانتظار أول تواصل",
      color:  "text-orange-600", bg: "bg-orange-50", border: "border-orange-200",
      dot:    notContacted > 5 ? "bg-orange-500" : "",
      href:   "/gab-c7x2p/students?stage=new",
      urgent: notContacted > 5,
    },
    {
      icon: Wallet,
      label:  isFr ? "En attente de paiement" : "بانتظار الدفع",
      value:  waitingPay,
      sub:    isFr ? "Confirmer et encaisser" : "تأكيد وتحصيل",
      color:  "text-amber-600", bg: "bg-amber-50", border: "border-amber-200",
      dot:    waitingPay > 0 ? "bg-amber-400" : "",
      href:   "/gab-c7x2p/students?stage=payment_pending",
      urgent: waitingPay > 0,
    },
    {
      icon: AlertCircle,
      label:  isFr ? "Impayés (DZD)"   : "مبالغ مستحقة",
      value:  outstanding,
      sub:    isFr ? "À recouvrer" : "للتحصيل",
      color:  "text-rose-600", bg: "bg-rose-50", border: "border-rose-200",
      dot:    outstanding > 0 ? "bg-rose-500" : "",
      href:   "/gab-c7x2p/students",
      urgent: outstanding > 0,
    },
  ];

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">
          {isFr ? "Actions prioritaires" : "الأولويات الآن"}
        </h2>
        {items.filter(i => i.urgent).length > 0 && (
          <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium animate-pulse">
            {items.filter(i => i.urgent).length} {isFr ? "urgentes" : "عاجلة"}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => navigate(item.href)}
            className={`relative flex items-start gap-3 p-4 rounded-2xl border text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${item.bg} ${item.border} ${item.urgent ? "shadow-sm" : "opacity-70"}`}
          >
            {item.urgent && item.dot && (
              <span className={`absolute top-2.5 right-2.5 w-2 h-2 rounded-full ${item.dot}`} />
            )}
            <div className={`w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center flex-shrink-0 ${item.color}`}>
              <item.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-[11px] font-medium ${item.color} leading-tight`}>{item.label}</p>
              <p className="text-2xl font-bold text-foreground mt-0.5 leading-none">{item.value}</p>
              <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{item.sub}</p>
            </div>
            <ArrowUpRight className={`w-3.5 h-3.5 ${item.color} opacity-60 flex-shrink-0 mt-0.5`} />
          </button>
        ))}
      </div>
    </div>
  );
}

function ErpMetrics() {
  const { lang } = useI18n();
  const isFr = lang === "fr";
  const [, navigate] = useLocation();
  const { data: erp } = useQuery<ErpStats>({ queryKey: ["stats-erp"], queryFn: () => statFetch("/stats/erp") });
  const { data: fin } = useQuery<FinancialStats>({ queryKey: ["stats-financials"], queryFn: () => statFetch("/stats/financials") });

  const metrics = [
    { label: isFr ? "Inscrits aujourd'hui" : "تسجيلات اليوم",  value: erp?.todayRegistrations ?? 0,          icon: UserPlus,   color: "text-purple-600", bg: "bg-purple-500/10" },
    { label: isFr ? "Inscrits ce mois"     : "تسجيلات الشهر",  value: erp?.monthRegistrations ?? 0,          icon: CalendarDays,color: "text-blue-600",   bg: "bg-blue-500/10" },
    { label: isFr ? "Revenu aujourd'hui"   : "إيرادات اليوم",  value: `${fin?.todayRevenue ?? 0} DA`,        icon: Wallet,     color: "text-green-600",  bg: "bg-green-500/10" },
    { label: isFr ? "Revenu ce mois"       : "إيرادات الشهر",  value: `${fin?.monthRevenue ?? 0} DA`,        icon: Banknote,   color: "text-emerald-600",bg: "bg-emerald-500/10" },
    { label: isFr ? "Taux de conversion"   : "نسبة التحويل",   value: `${erp?.conversionRate ?? 0}%`,        icon: Target,     color: "text-orange-600", bg: "bg-orange-500/10" },
    { label: isFr ? "Total étudiants"      : "إجمالي الطلاب",  value: erp?.totalStudents ?? 0,               icon: Users,      color: "text-indigo-600", bg: "bg-indigo-500/10" },
  ];

  const funnel = [
    { label: isFr ? "Non contactés"   : "لم يتم الاتصال", value: erp?.notContacted ?? 0,  color: "bg-blue-500",   href: "/gab-c7x2p/students?stage=new" },
    { label: isFr ? "Attente paiement": "بانتظار الدفع",  value: erp?.waitingPayment ?? 0, color: "bg-amber-500",  href: "/gab-c7x2p/students?stage=payment_pending" },
    { label: isFr ? "Confirmés"       : "مؤكّدون",        value: erp?.confirmed ?? 0,      color: "bg-violet-500", href: "/gab-c7x2p/students?stage=confirmed" },
    { label: isFr ? "En formation"    : "في التدريب",     value: erp?.inTraining ?? 0,     color: "bg-cyan-500",   href: "/gab-c7x2p/students?stage=attended" },
    { label: isFr ? "Terminés"        : "أتموا التدريب",  value: erp?.completed ?? 0,      color: "bg-green-500",  href: "/gab-c7x2p/students?stage=completed" },
  ];
  const maxFunnel = Math.max(1, ...funnel.map(f => f.value));

  return (
    <div className="space-y-4 mb-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {metrics.map((m, i) => (
          <div key={i} className={`bg-card rounded-2xl border border-border/50 shadow-sm p-4 hover:shadow-md transition-all hover:-translate-y-0.5`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${m.bg} ${m.color} mb-2`}>
              <m.icon className="w-4.5 h-4.5" />
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">{m.label}</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold">{isFr ? "Entonnoir de conversion" : "مسار التحويل"}</h2>
          </div>
          <button onClick={() => navigate("/gab-c7x2p/students")} className="text-xs text-primary hover:underline flex items-center gap-1">
            {isFr ? "Voir tous" : "عرض الكل"} <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
        <div className="space-y-2.5">
          {funnel.map((f, i) => (
            <button key={i} onClick={() => navigate(f.href)} className="flex items-center gap-3 w-full group">
              <span className="text-xs text-muted-foreground w-32 flex-shrink-0 text-end group-hover:text-foreground transition-colors">{f.label}</span>
              <div className="flex-1 bg-muted/40 rounded-full h-6 overflow-hidden">
                <div
                  className={`${f.color} h-full rounded-full flex items-center justify-end px-2 transition-all group-hover:opacity-90`}
                  style={{ width: `${Math.max(8, (f.value / maxFunnel) * 100)}%` }}
                >
                  <span className="text-[11px] font-bold text-white">{f.value}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function NextCourseDateCard() {
  const { toast } = useToast();
  const { lang } = useI18n();
  const isFr = lang === "fr";
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
          setSavedLabel(d.toLocaleDateString(isFr ? "fr-DZ" : "ar-DZ", {
            weekday: "long", year: "numeric", month: "long", day: "numeric",
            hour: "2-digit", minute: "2-digit",
          }));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!dateVal) { toast({ title: isFr ? "Choisissez une date" : "يرجى اختيار تاريخ", variant: "destructive" }); return; }
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
        setSavedLabel(d.toLocaleDateString(isFr ? "fr-DZ" : "ar-DZ", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
          hour: "2-digit", minute: "2-digit",
        }));
        toast({ title: isFr ? "✅ Date enregistrée" : "✅ تم حفظ التاريخ" });
      } else {
        toast({ title: isFr ? "Échec de la sauvegarde" : "فشل الحفظ", variant: "destructive" });
      }
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl border border-orange-500/30 shadow-xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
          <CalendarDays className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h2 className="font-bold text-white text-base">
            {isFr ? "Prochaine session" : "تاريخ الدورة القادمة"}
          </h2>
          <p className="text-xs text-gray-400">
            {isFr ? "Le compte à rebours s'affiche sur le site automatiquement" : "يظهر العداد التنازلي على الموقع تلقائياً"}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="h-28 bg-gray-800 animate-pulse rounded-xl" />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">📅 {isFr ? "Date" : "التاريخ"}</label>
              <input type="date" value={dateVal} onChange={e => setDateVal(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">⏰ {isFr ? "Heure" : "الوقت"}</label>
              <input type="time" value={timeVal} onChange={e => setTimeVal(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors" />
            </div>
          </div>
          {savedLabel && (
            <div className="bg-gray-800/60 rounded-lg px-3 py-2">
              <p className="text-[11px] text-gray-400">
                {isFr ? "Actuel" : "الحالي"}: <span className="text-orange-400 font-semibold">{savedLabel}</span>
              </p>
            </div>
          )}
          <button onClick={handleSave} disabled={saving || !dateVal}
            className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors text-sm">
            <Save className="w-4 h-4" />
            {saving ? (isFr ? "Sauvegarde..." : "جاري الحفظ...") : (isFr ? "Sauvegarder et mettre à jour le site" : "حفظ وتحديث الموقع")}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { t, lang } = useI18n();
  const isFr = lang === "fr";
  const { user } = useAuth();
  const { data: stats, isLoading, error, refetch } = useGetDashboardStats();
  const { data: activity } = useListActivity({ limit: 6 });

  if (isLoading) return (
    <AdminLayout>
      <div className="p-8 text-center text-muted-foreground animate-pulse">
        {isFr ? "Chargement du tableau de bord..." : "جاري تحميل لوحة التحكم..."}
      </div>
    </AdminLayout>
  );
  if (!stats) return (
    <AdminLayout>
      <div className="p-8 text-center space-y-4">
        <p className="text-muted-foreground">{isFr ? "Impossible de charger le tableau de bord." : "فشل تحميل لوحة التحكم."}</p>
        {error && <p className="text-xs text-red-500">{String(error)}</p>}
        <button onClick={() => refetch()} className="text-sm underline text-primary">
          {isFr ? "Réessayer" : "إعادة المحاولة"}
        </button>
      </div>
    </AdminLayout>
  );

  const statCards = [
    { label: t.totalStudents,  value: stats.totalStudents,       icon: Users,      color: "text-blue-500",   bg: "bg-blue-500/10",   border: "border-blue-200",   href: "/gab-c7x2p/students" },
    { label: t.newLeads,       value: stats.newStudents,         icon: UserPlus,   color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-200", href: "/gab-c7x2p/students?stage=new" },
    { label: t.contacted,      value: stats.contactedStudents,   icon: PhoneCall,  color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-200", href: "/gab-c7x2p/students?stage=contacted" },
    { label: t.interested,     value: stats.interestedStudents,  icon: CheckCircle,color: "text-green-500",  bg: "bg-green-500/10",  border: "border-green-200",  href: "/gab-c7x2p/students?stage=interested" },
    { label: t.noShows,        value: stats.noShowStudents,      icon: XCircle,    color: "text-red-500",    bg: "bg-red-500/10",    border: "border-red-200",    href: "/gab-c7x2p/students?stage=no_show" },
    { label: t.archived,       value: stats.archivedStudents,    icon: Archive,    color: "text-gray-500",   bg: "bg-gray-500/10",   border: "border-gray-200",   href: "/gab-c7x2p/students?stage=archived" },
    { label: t.totalGroups,    value: stats.totalGroups,         icon: Layers,     color: "text-indigo-500", bg: "bg-indigo-500/10", border: "border-indigo-200", href: "/gab-c7x2p/groups" },
    { label: t.openGroups,     value: stats.openGroups,          icon: FolderOpen, color: "text-emerald-500",bg: "bg-emerald-500/10",border: "border-emerald-200",href: "/gab-c7x2p/groups" },
  ];

  return (
    <AdminLayout>
      <PermissionGuard permission="view_dashboard">
        {/* Greeting */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-foreground">
            {greeting(lang, user?.fullName ?? "")} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isFr
              ? `${new Date().toLocaleDateString("fr-DZ", { weekday: "long", day: "numeric", month: "long" })} — Vue d'ensemble du CRM`
              : `${new Date().toLocaleDateString("ar-DZ", { weekday: "long", day: "numeric", month: "long" })} — نظرة شاملة على النظام`}
          </p>
        </div>

        {/* Priority bar */}
        <PriorityBar />

        {/* ERP metrics + funnel */}
        <ErpMetrics />

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {statCards.map((stat, i) => (
            <Card
              key={i}
              className={`border ${stat.border} shadow-sm hover:shadow-lg transition-all cursor-pointer group hover:-translate-y-1`}
              onClick={() => navigate(stat.href)}
            >
              <CardContent className="p-5 flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform flex-shrink-0`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate">{stat.label}</p>
                  <h3 className="text-xl font-bold text-foreground mt-0.5">{stat.value}</h3>
                </div>
                <TrendingUp className={`w-3.5 h-3.5 ${stat.color} opacity-40 ml-auto flex-shrink-0`} />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom Section */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <NextCourseDateCard />
          </div>

          {/* Recent Activity */}
          <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-border/50 bg-muted/20 flex items-center justify-between">
              <h2 className="text-base font-bold">{t.recentActivity}</h2>
              <button
                onClick={() => navigate("/gab-c7x2p/activity")}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                {isFr ? "Tout voir" : "عرض الكل"} <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
            <div className="flex-1 overflow-auto divide-y divide-border/30">
              {activity?.map(log => (
                <div key={log.id} className="p-4 hover:bg-muted/40 transition-colors">
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <span className="font-semibold text-xs text-foreground leading-tight">{log.action}</span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                      {format(new Date(log.createdAt), "d MMM, HH:mm")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{log.details}</p>
                  {log.performedBy && (
                    <p className="text-[10px] text-primary mt-1.5 font-medium">{log.performedBy}</p>
                  )}
                </div>
              ))}
              {!activity?.length && (
                <div className="p-8 text-center text-muted-foreground text-sm">{t.noRecentActivity}</div>
              )}
            </div>
          </div>
        </div>
      </PermissionGuard>
    </AdminLayout>
  );
}
