import { useAuth } from "./use-auth";

export function usePermission(permission: string): boolean {
  const { user } = useAuth();
  return user?.permissions?.includes(permission) ?? false;
}

export function useHasAnyPermission(...permissions: string[]): boolean {
  const { user } = useAuth();
  if (!user?.permissions) return false;
  return permissions.some((p) => user.permissions.includes(p));
}

export function useHasAllPermissions(...permissions: string[]): boolean {
  const { user } = useAuth();
  if (!user?.permissions) return false;
  return permissions.every((p) => user.permissions.includes(p));
}
