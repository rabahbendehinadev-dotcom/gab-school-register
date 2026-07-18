import { AdminLayout } from "@/components/layout/AdminLayout";
import { PermissionGuard } from "@/components/admin/PermissionGuard";
import { useListActivity } from "@workspace/api-client-react";
import { format } from "date-fns";
import { History, User, Clock } from "lucide-react";

export default function Activity() {
  const { data: activity, isLoading } = useListActivity({ limit: 100 });

  if (isLoading) return <AdminLayout><div className="animate-pulse">Loading activity log...</div></AdminLayout>;

  return (
    <AdminLayout>
      <PermissionGuard permission="view_audit_logs">
        <div className="mb-8">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <History className="w-6 h-6 text-primary" /> Activity Journal
          </h2>
          <p className="text-muted-foreground">Complete audit log of system actions.</p>
        </div>

        <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-6 max-w-4xl">
          <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
            {activity?.map((log, index) => (
              <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-card bg-primary text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl bg-muted/30 border border-border/50 shadow-sm hover:shadow-md hover:bg-muted/50 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-foreground text-sm uppercase tracking-wider">{log.action}</span>
                    <span className="text-xs text-muted-foreground font-medium">{format(new Date(log.createdAt), "MMM d, h:mm a")}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{log.details}</p>
                  <div className="flex items-center text-xs font-medium text-primary">
                    <User className="w-3.5 h-3.5 mr-1" /> {log.performedBy || "System"}
                  </div>
                </div>
              </div>
            ))}
            {!activity?.length && <div className="text-center text-muted-foreground py-10">No activity recorded yet.</div>}
          </div>
        </div>
      </PermissionGuard>
    </AdminLayout>
  );
}
