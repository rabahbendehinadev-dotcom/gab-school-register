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
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useI18n } from "@/contexts/i18n-context";
import { NotificationCenter } from "@/components/admin/NotificationCenter";
import { PushToggleButton } from "@/components/admin/PushToggleButton";

function useHeartbeat(page: string) {
  const { user } = useAuth();
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const canViewStudents     = user?.permissions?.includes("view_students") ?? false;
  const canViewGroups       = user?.permissions?.includes("view_groups") ?? false;
  const canManageTasks      = user?.permissions?.includes("manage_tasks") ?? false;
  const canViewDashboard    = user?.permissions?.includes("view_dashboard") ?? false;
  const canViewAuditLogs    = user?.permissions?.includes("view_audit_logs") ?? false;
  const canManageStaff      = user?.permissions?.includes("manage_staff") ?? false;
  const canManageRoles      = user?.permissions?.includes("manage_roles") ?? false;
  const canViewTeamActivity = user?.permissions?.includes("view_team_activity") ?? false;
  const isAdmin             = user?.role === "admin" || user?.role === "owner";

  const navItems = [
    { href: "/gab-c7x2p",               label: t.dashboard,    icon: LayoutDashboard, exact: true, show: canViewDashboard || isAdmin },
    { href: "/gab-c7x2p/groups",        label: t.schedules,    icon: Layers,          exact: false, show: canViewGroups || isAdmin },
    { href: "/gab-c7x2p/students",      label: t.students,     icon: Users,           exact: false, show: canViewStudents || isAdmin },
    { href: "/gab-c7x2p/tasks",         label: t.tasks,        icon: ListTodo,        exact: false, show: canManageTasks || isAdmin },
    { href: "/gab-c7x2p/open-day",      label: t.openDay,      icon: Ticket,          exact: false, show: isAdmin },
    { href: "/gab-c7x2p/courses",       label: t.courses,      icon: BookOpen,        exact: false, show: isAdmin },
    { href: "/gab-c7x2p/gallery",       label: t.gallery,      icon: ImageIcon,       exact: false, show: isAdmin },
    { href: "/gab-c7x2p/staff",         label: t.staff,        icon: ShieldCheck,     exact: false, show: canManageStaff || isAdmin },
    { href: "/gab-c7x2p/staff-activity",label: "نشاط الفريق",  icon: RadioTower,      exact: false, show: canViewTeamActivity || isAdmin },
    { href: "/gab-c7x2p/roles",         label: "الأدوار",      icon: Lock,            exact: false, show: canManageRoles || isAdmin },
    { href: "/gab-c7x2p/activity",      label: t.activityLog,  icon: Activity,        exact: false, show: canViewAuditLogs || isAdmin },
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
                {item.label}
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
          <div className="bg-muted rounded-2xl p-4 mb-4">
            <p className="text-sm font-semibold text-foreground truncate">{user.fullName}</p>
            <p className="text-xs text-muted-foreground capitalize mt-0.5">{user.role}</p>
          </div>
          <Button 
            variant="outline" 
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
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
