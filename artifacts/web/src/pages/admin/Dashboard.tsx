import { AdminLayout } from "@/components/layout/AdminLayout";
import { useGetDashboardStats, useListActivity } from "@workspace/api-client-react";
import { Users, UserPlus, PhoneCall, CheckCircle, XCircle, Archive, Layers, FolderOpen, CalendarDays, Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { useI18n } from "@/contexts/i18n-context";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";

function NextCourseDateCard() {
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/settings/next-course")
      .then(r => r.json())
      .then((data: { value: string | null }) => {
        if (data.value) {
          const d = new Date(data.value);
          const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
          setValue(local);
          setSaved(local);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!value) return;
    setSaving(true);
    try {
      const r = await fetch("/api/settings/next-course", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ value: new Date(value).toISOString() }),
      });
      if (r.ok) {
        setSaved(value);
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
        <div className="h-12 bg-gray-800 animate-pulse rounded-xl" />
      ) : (
        <div className="space-y-3">
          <input
            ref={inputRef}
            type="datetime-local"
            value={value}
            onChange={e => setValue(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
          />

          {saved && (
            <div className="bg-gray-800/60 rounded-lg px-3 py-2">
              <p className="text-[11px] text-gray-400">
                التاريخ الحالي:{" "}
                <span className="text-orange-400 font-semibold">
                  {new Date(saved).toLocaleDateString("ar-DZ", {
                    weekday: "long", year: "numeric", month: "long", day: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </p>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !value || value === saved}
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
          <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-6">
            <h2 className="text-lg font-bold mb-4">{t.systemOverview}</h2>
            <div className="h-48 flex items-center justify-center bg-muted/30 rounded-xl border border-dashed border-border">
              <p className="text-muted-foreground text-sm">Analytics visualization space</p>
            </div>
          </div>
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
    </AdminLayout>
  );
}
