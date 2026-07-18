import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery } from "@tanstack/react-query";
import { RadioTower, Monitor, Smartphone, Globe, Clock, Zap, Moon, WifiOff, MessageCircle, Phone, StickyNote, ArrowRightLeft } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface StaffActivityItem {
  staffId: number;
  fullName: string;
  role: string;
  status: "active" | "idle_5" | "idle_15" | "offline";
  lastHeartbeatAt: string | null;
  lastActionAt: string | null;
  currentPage: string | null;
  currentStudentId: number | null;
  deviceType: string | null;
  os: string | null;
  browser: string | null;
  todayStats: {
    whatsappClicks: number;
    callClicks: number;
    notesAdded: number;
    stageChanges: number;
    totalActions: number;
  };
}

function statusConfig(status: string) {
  switch (status) {
    case "active":   return { label: "نشط الآن",    color: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50 dark:bg-emerald-950/20", icon: Zap };
    case "idle_5":   return { label: "خامل 5 د",    color: "bg-amber-400",   text: "text-amber-700",   bg: "bg-amber-50 dark:bg-amber-950/20",   icon: Moon };
    case "idle_15":  return { label: "خامل 15 د",   color: "bg-orange-400",  text: "text-orange-700",  bg: "bg-orange-50 dark:bg-orange-950/20", icon: Moon };
    default:         return { label: "غير متصل",    color: "bg-muted-foreground/30", text: "text-muted-foreground", bg: "bg-muted/50", icon: WifiOff };
  }
}

function roleLabel(role: string) {
  const map: Record<string, string> = {
    owner: "المالك",
    admin: "مشرف",
    manager: "مدير",
    team_leader: "قائد الفريق",
    staff: "موظف",
    sales_agent: "مندوب",
    assistant: "مساعد",
    content_manager: "مدير محتوى",
    viewer: "مراقب",
  };
  return map[role] ?? role;
}

function pageLabel(page: string | null): string {
  if (!page) return "—";
  const map: Record<string, string> = {
    "/gab-c7x2p": "لوحة التحكم",
    "/gab-c7x2p/students": "الطلاب",
    "/gab-c7x2p/tasks": "المهام",
    "/gab-c7x2p/groups": "المجموعات",
    "/gab-c7x2p/staff": "الفريق",
    "/gab-c7x2p/staff-activity": "نشاط الفريق",
    "/gab-c7x2p/roles": "الأدوار",
    "/gab-c7x2p/activity": "سجل النشاط",
    "/gab-c7x2p/pipeline": "المسار",
    "/gab-c7x2p/gallery": "المعرض",
    "/gab-c7x2p/courses": "الدورات",
    "/gab-c7x2p/open-day": "يوم مفتوح",
  };
  if (page.startsWith("/gab-c7x2p/students/")) return "ملف طالب";
  return map[page] ?? page;
}

async function fetchActiveStaff(): Promise<StaffActivityItem[]> {
  const res = await fetch("/api/sessions/active", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

export default function StaffActivity() {
  const { data, isLoading, error } = useQuery<StaffActivityItem[]>({
    queryKey: ["sessions", "active"],
    queryFn: fetchActiveStaff,
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  const activeCount  = data?.filter(s => s.status === "active").length ?? 0;
  const idleCount    = data?.filter(s => s.status === "idle_5" || s.status === "idle_15").length ?? 0;
  const offlineCount = data?.filter(s => s.status === "offline").length ?? 0;

  return (
    <AdminLayout>
      <div dir="rtl" className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <RadioTower className="w-6 h-6 text-primary" /> نشاط الفريق المباشر
            </h2>
            <p className="text-muted-foreground text-sm mt-1">يتحدث كل 30 ثانية تلقائياً</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{activeCount} نشط</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />{idleCount} خامل</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-muted-foreground/30 inline-block" />{offlineCount} غائب</span>
          </div>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-muted/30 border border-border/50 h-44 animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <div className="text-destructive text-center py-10">
            ليس لديك صلاحية مشاهدة نشاط الفريق
          </div>
        )}

        {data && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((member) => {
              const cfg = statusConfig(member.status);
              const StatusIcon = cfg.icon;
              const DeviceIcon = member.deviceType === "mobile" ? Smartphone : Monitor;

              return (
                <div
                  key={member.staffId}
                  className={`rounded-2xl border border-border/50 shadow-sm p-4 ${cfg.bg} transition-all`}
                >
                  {/* Top row: name + status */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-foreground text-sm leading-tight">{member.fullName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{roleLabel(member.role)}</p>
                    </div>
                    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${cfg.text} bg-card/70`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.color}`} />
                      {cfg.label}
                    </span>
                  </div>

                  {/* Current page */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <Globe className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{pageLabel(member.currentPage)}</span>
                    {member.currentStudentId && (
                      <span className="text-primary font-medium">#{member.currentStudentId}</span>
                    )}
                  </div>

                  {/* Device + time */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1">
                      <DeviceIcon className="w-3.5 h-3.5" />
                      {member.os ?? "—"} · {member.browser ?? "—"}
                    </span>
                    {member.lastActionAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDistanceToNow(new Date(member.lastActionAt), { locale: ar, addSuffix: true })}
                      </span>
                    )}
                  </div>

                  {/* Today's stats */}
                  <div className="grid grid-cols-4 gap-1 border-t border-border/30 pt-3">
                    <div className="text-center">
                      <p className="text-base font-bold text-emerald-600">{member.todayStats.whatsappClicks}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">واتساب</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-blue-600">{member.todayStats.callClicks}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">مكالمات</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-purple-600">{member.todayStats.notesAdded}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">ملاحظات</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-foreground">{member.todayStats.totalActions}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">إجمالي</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
