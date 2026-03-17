import { AdminLayout } from "@/components/layout/AdminLayout";
import { useGetDashboardStats, useListActivity } from "@workspace/api-client-react";
import { Users, UserPlus, PhoneCall, CheckCircle, XCircle, Archive, Layers, FolderOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { useI18n } from "@/contexts/i18n-context";

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
    {
      label: t.totalStudents,
      value: stats.totalStudents,
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-200",
      href: "/gab-c7x2p/students",
    },
    {
      label: t.newLeads,
      value: stats.newStudents,
      icon: UserPlus,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      border: "border-purple-200",
      href: "/gab-c7x2p/students?stage=new",
    },
    {
      label: t.contacted,
      value: stats.contactedStudents,
      icon: PhoneCall,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
      border: "border-orange-200",
      href: "/gab-c7x2p/students?stage=contacted",
    },
    {
      label: t.interested,
      value: stats.interestedStudents,
      icon: CheckCircle,
      color: "text-green-500",
      bg: "bg-green-500/10",
      border: "border-green-200",
      href: "/gab-c7x2p/students?stage=interested",
    },
    {
      label: t.noShows,
      value: stats.noShowStudents,
      icon: XCircle,
      color: "text-red-500",
      bg: "bg-red-500/10",
      border: "border-red-200",
      href: "/gab-c7x2p/students?stage=no_show",
    },
    {
      label: t.archived,
      value: stats.archivedStudents,
      icon: Archive,
      color: "text-gray-500",
      bg: "bg-gray-500/10",
      border: "border-gray-200",
      href: "/gab-c7x2p/students?stage=archived",
    },
    {
      label: t.totalGroups,
      value: stats.totalGroups,
      icon: Layers,
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
      border: "border-indigo-200",
      href: "/gab-c7x2p/groups",
    },
    {
      label: t.openGroups,
      value: stats.openGroups,
      icon: FolderOpen,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      border: "border-emerald-200",
      href: "/gab-c7x2p/groups",
    },
  ];

  return (
    <AdminLayout>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
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

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border/50 shadow-sm p-6">
          <h2 className="text-lg font-bold mb-4">{t.systemOverview}</h2>
          <div className="h-64 flex items-center justify-center bg-muted/30 rounded-xl border border-dashed border-border">
            <p className="text-muted-foreground">Analytics visualization space</p>
          </div>
        </div>

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
