import { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ShieldOff } from "lucide-react";

interface PermissionGuardProps {
  /** Require this single permission. */
  permission?: string;
  /** Require ANY one of these permissions (OR logic). */
  anyOf?: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGuard({ permission, anyOf, children, fallback }: PermissionGuardProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  const perms: string[] = user?.permissions ?? [];
  const allowed = anyOf
    ? anyOf.some((p) => perms.includes(p))
    : permission
      ? perms.includes(permission)
      : true;

  if (!allowed) {
    return fallback ?? (
      <div dir="rtl" className="flex flex-col items-center justify-center min-h-[40vh] text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <ShieldOff className="w-8 h-8 text-destructive" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">لا توجد صلاحية</h3>
          <p className="text-sm text-muted-foreground mt-1">ليس لديك صلاحية الوصول إلى هذه الصفحة</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
