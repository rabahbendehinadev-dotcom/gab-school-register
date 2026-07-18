import { ReactNode, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  Layers, 
  ShieldCheck, 
  Activity, 
  Image as ImageIcon,
  LogOut,
  Menu,
  X,
  Ticket,
  BookOpen,
  ListTodo,
  RadioTower,
  Lock,
  CheckSquare,
  ClipboardList,
  BarChart2,
  Cpu,
  Bell,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/contexts/i18n-context";
import { NotificationCenter } from "@/components/admin/NotificationCenter";
import { PushToggleButton } from "@/components/admin/PushToggleButton";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const NOTIF_LABELS: Record<string, string> = {
  always: "دائماً", during_shift: "أثناء الوردية", critical_only: "الحرجة فقط", off: "إيقاف",
};

function MyNotifPref() {
  const qc = useQueryClient();
  const { data } = useQuery<{ pref: string }>({
    queryKey: ["my-notif-pref"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/ai/my-notification-pref`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
  const update = useMutation({
    mutationFn: async (pref: string) => {
      const r = await fetch(`${BASE}/api/ai/my-notification-pref`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pref }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-notif-pref"] }),
  });

  return (
    <div className="mb-2 px-1">
      <div className="flex items-center gap-1.5 mb-1">
        <Bell className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">إشعاراتي</span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {Object.entries(NOTIF_LABELS).map(([v, label]) => (
          <button
            key={v}
            onClick={() => update.mutate(v)}
            disabled={update.isPending}
            className={`text-xs py-1 px-2 rounded-lg border transition-all ${
              (data?.pref ?? "during_shift") === v
                ? "bg-primary text-white border-primary"
                : "bg-muted text-muted-foreground border-border hover:border-primary/50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function useHeartbeat(page: string) {
  const { user } = useAuth();
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    const onActivity = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener("mousemove", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity, { passive: true });
    window.addEventListener("click", onActivity, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("click", onActivity);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const studentMatch = page.match(/^\/gab-c7x2p\/students\/(\d+)/);
    const studentId = studentMatch ? Number(studentMatch[1]) : undefined;

    const send = () => {
      fetch("/api/sessions/heartbeat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, ...(studentId ? { studentId } : {}) }),
      }).catch(() => {});

      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs < 5 * 60 * 1000) {
        fetch("/api/sessions/action", {
          method: "POST",
          credentials: "include",
        }).catch(() => {});
      }
    };

    send();
    heartbeatRef.current = setInterval(send, 45_000);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [user, page]);
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { lang, setLang, t } = useI18n();

  useHeartbeat(location);

  const perms                = user?.permissions ?? [];
  const canViewDashboard    = perms.includes("view_dashboard");
  const canViewStudents     = perms.includes("view_students") || perms.includes("view_all_students");
  const canViewGroups       = perms.includes("view_groups");
  const canManageTasks      = perms.includes("manage_tasks");
  const canViewAuditLogs    = perms.includes("view_audit_logs");
  const canManageStaff      = perms.includes("manage_staff");
  const canManageRoles      = perms.includes("manage_roles");
  const canManageNotifications = perms.includes("manage_notifications");
  const canViewAiControl    = perms.includes("view_ai_control");
  const canViewReports      = perms.includes("manage_staff") || perms.includes("view_ai_control");

  const { data: aiUnreadData } = useQuery<{ count: number }>({
    queryKey: ["ai-unread-count"],
    queryFn: async () => {
      const res = await fetch("/api/ai/alerts/unread-count", { credentials: "include" });
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    refetchInterval: 60_000,
    enabled: canViewAiControl,
  });
  const aiUnreadCount = aiUnreadData?.count ?? 0;

  const { data: myChecklists } = useQuery<{ id: number; status: string }[]>({
    queryKey: ["my-checklists-badge"],
    queryFn: async () => {
      const res = await fetch("/api/checklists/my", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30_000,
    enabled: !!user,
  });
  const overdueChecklistCount = (myChecklists ?? []).filter(a => a.status === "overdue").length;

  const navItems = [
    { href: "/gab-c7x2p",               label: t.dashboard,      icon: LayoutDashboard, exact: true,  show: canViewDashboard },
    { href: "/gab-c7x2p/groups",        label: t.schedules,      icon: Layers,          exact: false, show: canViewGroups },
    { href: "/gab-c7x2p/students",      label: t.students,       icon: Users,           exact: false, show: canViewStudents },
    { href: "/gab-c7x2p/checklists",    label: "مهامي",          icon: CheckSquare,     exact: false, show: canViewDashboard, badge: overdueChecklistCount > 0 ? String(overdueChecklistCount) : undefined },
    { href: "/gab-c7x2p/checklist-admin", label: "إدارة المهام", icon: ClipboardList,   exact: false, show: canManageTasks },
    { href: "/gab-c7x2p/tasks",         label: t.tasks,          icon: ListTodo,        exact: false, show: canManageTasks },
    { href: "/gab-c7x2p/open-day",      label: t.openDay,        icon: Ticket,          exact: false, show: canManageNotifications },
    { href: "/gab-c7x2p/courses",       label: t.courses,        icon: BookOpen,        exact: false, show: canManageNotifications },
    { href: "/gab-c7x2p/gallery",       label: t.gallery,        icon: ImageIcon,       exact: false, show: canManageNotifications },
    { href: "/gab-c7x2p/staff",         label: t.staff,          icon: ShieldCheck,     exact: false, show: canManageStaff },
    { href: "/gab-c7x2p/staff-activity",label: "نشاط الفريق",    icon: RadioTower,      exact: false, show: canManageStaff },
    { href: "/gab-c7x2p/roles",         label: "الأدوار",        icon: Lock,            exact: false, show: canManageRoles },
    { href: "/gab-c7x2p/activity",      label: t.activityLog,    icon: Activity,        exact: false, show: canViewAuditLogs },
    { href: "/gab-c7x2p/reports",      label: "تقارير الأداء",  icon: BarChart2,       exact: false, show: canViewReports },
    { href: "/gab-c7x2p/ai-control",   label: "لوحة التحكم المتقدمة", icon: Cpu,      exact: false, show: canViewAiControl, badge: aiUnreadCount > 0 ? String(aiUnreadCount) : undefined },
  ];

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-primary">جاري التحميل...</div>;
  }

  if (!user) {
    window.location.href = "/gab-c7x2p/login";
    return null;
  }

  const filteredNav = navItems.filter(item => item.show);

  return (
    <div dir="ltr" className="min-h-screen bg-muted/40 flex overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-card border-r border-border shadow-2xl lg:shadow-none
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        flex flex-col
      `}>
        <div className="h-16 flex items-center px-6 border-b border-border/50">
          <Link href="/gab-c7x2p" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-display font-bold text-xl">
              G
            </div>
            <span className="font-display font-bold text-lg tracking-tight">GAB Admin</span>
          </Link>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
          <div className="mb-4 px-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t.navigation}</p>
          </div>
          {filteredNav.map((item) => {
            const isActive = item.exact ? location === item.href : location.startsWith(item.href);
            const badge = (item as { badge?: string }).badge;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all duration-200
                  ${isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"}
                `}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className={`w-5 h-5 ${isActive ? "text-primary" : ""}`} />
                <span className="flex-1">{item.label}</span>
                {badge && (
                  <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Language Switcher */}
        <div className="px-4 pb-3">
          <div className="bg-muted rounded-xl p-1 flex gap-1">
            <button
              onClick={() => setLang("ar")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                lang === "ar"
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              العربية
            </button>
            <button
              onClick={() => setLang("fr")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                lang === "fr"
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Français
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-border/50">
          <div className="bg-muted rounded-2xl p-4 mb-3">
            <p className="text-sm font-semibold text-foreground truncate">{user.fullName}</p>
            <p className="text-xs text-muted-foreground capitalize mt-0.5">{user.role}</p>
          </div>
          <MyNotifPref />
          <Button 
            variant="outline" 
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20 mt-2"
            onClick={() => logout()}
          >
            <LogOut className="w-4 h-4 mr-2" />
            {t.logout}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-card/80 backdrop-blur-md border-b border-border/50 flex items-center px-4 sm:px-6 lg:px-8 z-10 sticky top-0">
          <button 
            className="lg:hidden p-2 -ml-2 mr-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex-1 flex items-center justify-between">
            <h1 className="text-xl font-display font-semibold text-foreground tracking-tight">
              {filteredNav.find(n => n.exact ? location === n.href : location.startsWith(n.href))?.label || t.dashboard}
            </h1>
            <div className="flex items-center gap-2 sm:gap-4">
              <PushToggleButton />
              <NotificationCenter />
              <Button variant="outline" size="sm" asChild className="hidden sm:flex rounded-full">
                <Link href="/">{t.viewSite}</Link>
              </Button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
