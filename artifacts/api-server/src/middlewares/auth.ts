import type { Request, Response, NextFunction } from "express";
import "../types/session";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.staffId) {
    res.status(401).json({ error: "غير مصادق — يرجى تسجيل الدخول" });
    return;
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session.staffId) {
      res.status(401).json({ error: "غير مصادق — يرجى تسجيل الدخول" });
      return;
    }
    if (!req.session.role || !roles.includes(req.session.role)) {
      res.status(403).json({ error: "ليس لديك صلاحية هذا الإجراء" });
      return;
    }
    next();
  };
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session.staffId) {
      res.status(401).json({ error: "غير مصادق — يرجى تسجيل الدخول" });
      return;
    }
    const perms: string[] = req.session.permissions ?? [];
    if (!perms.includes(permission)) {
      res.status(403).json({ error: "ليس لديك صلاحية هذا الإجراء" });
      return;
    }
    next();
  };
}
