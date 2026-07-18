import { ReactNode, useEffect, useRef, useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, Layers, ShieldCheck, Activity,
  Image as ImageIcon, LogOut, Menu, X, Ticket, BookOpen,
  ListTodo, RadioTower, Lock, CheckSquare, ClipboardList,
  BarChart2, Cpu, BellRing, Search,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/contexts/i18n-context";
import { NotificationCenter } from "@/components/admin/NotificationCenter";
import { GlobalSearch } from "@/components/admin/GlobalSearch";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, ...(studentId ? { studentId } : {}) }),
      }).catch(() => {});

      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs < 5 * 60 * 1000) {
        fetch("/api/sessions/action", { method: "POST", credentials: "include" }).catch(() => {});
      }
    };

    send();
    heartbeatRef.current = setInterval(send, 45_000);
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [user, page]);
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { lang, setLang, t } = useI18n();

  useHeartbeat(location);

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setSearchOpen(prev => !prev);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const perms                  = user?.permissions ?? [];
  const canViewDashboard       = perms.includes("view_dashboard");
  const canViewStudents        = perms.includes("view_students") || perms.includes("view_all_students");
  const canViewGroups          = perms.includes("view_groups");
  const canManageTasks         = perms.includes("manage_tasks");
  const canViewAuditLogs       = perms.includes("view_audit_logs");
  const canManageStaff         = perms.includes("manage_staff");
  const canManageRoles         = perms.includes("manage_roles");
  const canManageNotifications = perms.includes("manage_notifications");
  const canViewAiControl       = perms.includes("view_ai_control");
  const canViewReports         = perms.includes("manage_staff") || perms.includes("view_ai_control");
  const canManageNotifSettings = perms.includes("manage_staff") || perms.includes("view_ai_control");

  const { data: aiUnreadData } = useQuery<{ count: number }>({
    queryKey: ["ai-unread-count"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/ai/alerts/unread-count`, { credentials: "include" });
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
      const res = await fetch(`${BASE}/api/checklists/my`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30_000,
    enabled: !!user,
  });
  const overdueChecklistCount = (myChecklists ?? []).filter(a => a.status === "overdue").length;

  const navItems = [
    { href: "/gab-c7x2p",                        fr: "Tableau de bord",          ar: t.dashboard,        icon: LayoutDashboard, exact: true,  show: canViewDashboard },
    { href: "/gab-c7x2p/groups",                 fr: "Groupes",                  ar: t.schedules,        icon: Layers,          exact: false, show: canViewGroups },
    { href: "/gab-c7x2p/students",               fr: "Étudiants",                ar: t.students,         icon: Users,           exact: false, show: canViewStudents },
    { href: "/gab-c7x2p/checklists",             fr: "Mes tâches",               ar: "مهامي",            icon: CheckSquare,     exact: false, show: canViewDashboard, badge: overdueChecklistCount > 0 ? String(overdueChecklistCount) : undefined },
    { href: "/gab-c7x2p/checklist-admin",        fr: "Gestion des tâches",       ar: "إدارة المهام",     icon: ClipboardList,   exact: false, show: canManageTasks },
    { href: "/gab-c7x2p/tasks",                  fr: "Tâches",                   ar: t.tasks,            icon: ListTodo,        exact: false, show: canManageTasks },
    { href: "/gab-c7x2p/open-day",               fr: "Journée Portes Ouvertes",  ar: t.openDay,          icon: Ticket,          exact: false, show: canManageNotifications },
    { href: "/gab-c7x2p/courses",                fr: "Cours",                    ar: t.courses,          icon: BookOpen,        exact: false, show: canManageNotifications },
    { href: "/gab-c7x2p/gallery",                fr: "Galerie",                  ar: t.gallery,          icon: ImageIcon,       exact: false, show: canManageNotifications },
    { href: "/gab-c7x2p/staff",                  fr: "Personnel",                ar: t.staff,            icon: ShieldCheck,     exact: false, show: canManageStaff },
    { href: "/gab-c7x2p/staff-activity",         fr: "Activité équipe",          ar: "نشاط الفريق",      icon: RadioTower,       exact: false, show: canManageStaff },
    { href: "/gab-c7x2p/roles",                  fr: "Rôles",                    ar: "الأدوار",          icon: Lock,            exact: false, show: canManageRoles },
    { href: "/gab-c7x2p/activity",               fr: "Journal d'activité",       ar: t.activityLog,      icon: Activity,        exact: false, show: canViewAuditLogs },
    { href: "/gab-c7x2p/reports",                fr: "Rapports de performance",  ar: "تقارير الأداء",   icon: BarChart2,       exact: false, show: canViewReports },
    { href: "/gab-c7x2p/notification-management",fr: "Gestion notifications",    ar: "إدارة الإشعارات", icon: BellRing,        exact: false, show: canManageNotifSettings },
    { href: "/gab-c7x2p/ai-control",             fr: "Tableau IA",               ar: "التحكم المتقدم",  icon: Cpu,             exact: false, show: canViewAiControl, badge: aiUnreadCount > 0 ? String(aiUnreadCount) : undefined },
  ];

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-primary">
      {lang === "fr" ? "Chargement..." : "جاري التحميل..."}
    </div>;
  }

  if (!user) {
    window.location.href = "/gab-c7x2p/login";
    return null;
  }

  const filteredNav = navItems.filter(item => item.show);
  const currentLabel = filteredNav.find(n => n.exact ? location === n.href : location.startsWith(n.href));
  const pageTitle = currentLabel ? (lang === "fr" ? currentLabel.fr : currentLabel.ar) : (lang === "fr" ? "Tableau de bord" : "لوحة التحكم");

  return (
    <div dir="ltr" className="min-h-screen bg-muted/40 flex overflow-hidden">
      {/* Global Search */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-60 bg-card border-r border-border shadow-2xl lg:shadow-none
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        flex flex-col
      `}>
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-border/50">
          <Link href="/gab-c7x2p" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-base">G</div>
            <div>
              <span className="font-bold text-sm tracking-tight">GAB Admin</span>
              <span className="block text-[9px] text-muted-foreground -mt-0.5 uppercase tracking-widest">CRM / ERP</span>
            </div>
          </Link>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Search shortcut in sidebar */}
        <div className="px-3 pt-3">
          <button
            onClick={() => { setSidebarOpen(false); setSearchOpen(true); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground text-xs transition-colors group"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">{lang === "fr" ? "Rechercher..." : "البحث..."}</span>
            <kbd className="text-[9px] bg-background/80 border border-border/60 px-1.5 py-0.5 rounded-md group-hover:bg-background transition-colors">⌘K</kbd>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
          <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-[0.12em] px-2 py-2">
            {lang === "fr" ? "Navigation" : "التنقل"}
          </p>
          {filteredNav.map(item => {
            const isActive = item.exact ? location === item.href : location.startsWith(item.href);
            const badge = (item as { badge?: string }).badge;
            const label = lang === "fr" ? item.fr : item.ar;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium transition-all duration-150
                  ${isActive
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"}
                `}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-primary" : ""}`} />
                <span className="flex-1 truncate">{label}</span>
                {badge && (
                  <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Language Switcher */}
        <div className="px-3 pb-2">
          <div className="bg-muted rounded-xl p-1 flex gap-1">
            <button
              onClick={() => setLang("fr")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${lang === "fr" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Français
            </button>
            <button
              onClick={() => setLang("ar")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${lang === "ar" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              العربية
            </button>
          </div>
        </div>

        {/* User profile + logout */}
        <div className="p-3 border-t border-border/50">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-muted/40 mb-2">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
              {user.fullName?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate">{user.fullName}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{user.role}</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20 h-8 text-xs"
            onClick={() => logout()}
          >
            <LogOut className="w-3.5 h-3.5 mr-2" />
            {lang === "fr" ? "Déconnexion" : "تسجيل الخروج"}
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-14 bg-card/90 backdrop-blur-md border-b border-border/50 flex items-center px-4 sm:px-6 z-10 sticky top-0">
          <button
            className="lg:hidden p-2 -ml-2 mr-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1 flex items-center justify-between gap-3">
            <h1 className="text-base font-bold text-foreground tracking-tight truncate">{pageTitle}</h1>

            <div className="flex items-center gap-2">
              {/* Search button (desktop) */}
              <button
                onClick={() => setSearchOpen(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground text-xs transition-colors border border-border/40"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{lang === "fr" ? "Rechercher" : "بحث"}</span>
                <kbd className="text-[9px] bg-background/60 px-1.5 py-0.5 rounded border border-border/40">⌘K</kbd>
              </button>
              {/* Search icon (mobile) */}
              <button
                onClick={() => setSearchOpen(true)}
                className="sm:hidden p-2 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <Search className="w-4.5 h-4.5" />
              </button>

              <NotificationCenter />

              <Button variant="outline" size="sm" asChild className="hidden md:flex rounded-full h-8 text-xs">
                <Link href="/">{lang === "fr" ? "Voir le site" : "عرض الموقع"}</Link>
              </Button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
