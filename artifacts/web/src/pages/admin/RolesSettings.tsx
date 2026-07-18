import { AdminLayout } from "@/components/layout/AdminLayout";
import { PermissionGuard } from "@/components/admin/PermissionGuard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Lock, Plus, Edit2, Trash2, Check, X, Shield, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

interface Role {
  id: number;
  name: string;
  displayName: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
}

const PERMISSION_GROUPS: { label: string; perms: string[] }[] = [
  { label: "الطلاب", perms: ["view_students", "edit_students", "delete_students", "contact_students", "call_students", "open_whatsapp", "add_notes", "edit_notes", "view_all_students", "view_own_students", "assign_students"] },
  { label: "الفريق", perms: ["view_team_activity", "manage_staff", "manage_shifts", "manage_roles"] },
  { label: "المهام والتقارير", perms: ["manage_tasks", "view_reports", "view_audit_logs"] },
  { label: "المجموعات والمدفوعات", perms: ["view_groups", "manage_groups", "view_payments", "manage_payments"] },
  { label: "الإشعارات والذكاء الاصطناعي", perms: ["manage_notifications", "view_ai_control", "manage_ai_control", "receive_ai_alerts"] },
  { label: "عام", perms: ["view_dashboard"] },
];

const PERM_LABELS: Record<string, string> = {
  view_dashboard: "مشاهدة لوحة التحكم",
  view_students: "مشاهدة الطلاب",
  edit_students: "تعديل الطلاب",
  delete_students: "حذف الطلاب",
  contact_students: "التواصل مع الطلاب",
  call_students: "الاتصال بالطلاب",
  open_whatsapp: "فتح واتساب",
  add_notes: "إضافة ملاحظات",
  edit_notes: "تعديل الملاحظات",
  view_all_students: "مشاهدة جميع الطلاب",
  view_own_students: "مشاهدة طلابي فقط",
  assign_students: "تخصيص الطلاب",
  view_team_activity: "مشاهدة نشاط الفريق",
  manage_tasks: "إدارة المهام",
  view_reports: "مشاهدة التقارير",
  view_ai_control: "مشاهدة الذكاء الاصطناعي",
  manage_ai_control: "إدارة الذكاء الاصطناعي",
  view_audit_logs: "مشاهدة سجل التدقيق",
  manage_roles: "إدارة الأدوار",
  manage_staff: "إدارة الفريق",
  manage_shifts: "إدارة الوردية",
  manage_notifications: "إدارة الإشعارات",
  view_groups: "مشاهدة المجموعات",
  manage_groups: "إدارة المجموعات",
  view_payments: "مشاهدة المدفوعات",
  manage_payments: "إدارة المدفوعات",
  receive_ai_alerts: "تلقي تنبيهات الذكاء الاصطناعي",
};

async function fetchRoles(): Promise<Role[]> {
  const res = await fetch("/api/roles", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch roles");
  return res.json();
}

function RolesContent() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPerms, setNewPerms] = useState<string[]>([]);

  const canEdit = user?.permissions?.includes("manage_roles");

  const { data: roles, isLoading } = useQuery<Role[]>({
    queryKey: ["roles"],
    queryFn: fetchRoles,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, displayName, permissions }: { id: number; displayName: string; permissions: string[] }) => {
      const res = await fetch(`/api/roles/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, permissions }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["roles"] }); setEditingId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/roles/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roles"] }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/roles", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, displayName: newDisplayName, permissions: newPerms }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["roles"] }); setCreating(false); setNewName(""); setNewDisplayName(""); setNewPerms([]); },
  });

  function startEdit(role: Role) {
    setEditingId(role.id);
    setEditPerms([...role.permissions]);
    setEditDisplayName(role.displayName);
    setExpandedGroups(new Set(PERMISSION_GROUPS.map(g => g.label)));
  }

  function togglePerm(perm: string, perms: string[], setPerms: (p: string[]) => void) {
    setPerms(perms.includes(perm) ? perms.filter(p => p !== perm) : [...perms, perm]);
  }

  function toggleGroup(label: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  }

  function PermMatrix({ perms, setPerms, readOnly = false }: { perms: string[]; setPerms?: (p: string[]) => void; readOnly?: boolean }) {
    return (
      <div className="space-y-2 mt-3">
        {PERMISSION_GROUPS.map(group => {
          const isExpanded = expandedGroups.has(group.label);
          const groupActive = group.perms.filter(p => perms.includes(p)).length;
          return (
            <div key={group.label} className="border border-border/40 rounded-xl overflow-hidden">
              <button type="button" className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/60 transition-colors text-sm font-medium" onClick={() => toggleGroup(group.label)}>
                <span>{group.label}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{groupActive}/{group.perms.length}</span>
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </button>
              {isExpanded && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 p-2">
                  {group.perms.map(perm => (
                    <label key={perm} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${perms.includes(perm) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"} ${readOnly ? "cursor-default" : ""}`}>
                      <input type="checkbox" checked={perms.includes(perm)} disabled={readOnly} onChange={() => setPerms && !readOnly && togglePerm(perm, perms, setPerms)} className="accent-primary" />
                      {PERM_LABELS[perm] ?? perm}
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Lock className="w-6 h-6 text-primary" /> إدارة الأدوار والصلاحيات
          </h2>
          <p className="text-muted-foreground text-sm mt-1">تحكم في ما يمكن لكل دور رؤيته وفعله</p>
        </div>
        {canEdit && (
          <Button onClick={() => setCreating(true)} size="sm" className="gap-2">
            <Plus className="w-4 h-4" /> دور جديد
          </Button>
        )}
      </div>

      {isLoading && <div className="text-muted-foreground text-sm">جاري التحميل...</div>}

      {creating && (
        <div className="bg-card border border-primary/30 rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Shield className="w-4 h-4 text-primary" />إنشاء دور جديد</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">الاسم الداخلي (بالإنجليزية)</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="sales_agent" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">الاسم المعروض</label>
              <input value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} placeholder="مندوب المبيعات" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
            </div>
          </div>
          <PermMatrix perms={newPerms} setPerms={setNewPerms} />
          <div className="flex items-center gap-2 mt-4 justify-end">
            <Button variant="outline" size="sm" onClick={() => setCreating(false)}>إلغاء</Button>
            <Button size="sm" disabled={!newName || !newDisplayName || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? "جاري الحفظ..." : "حفظ الدور"}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {roles?.map(role => {
          const isEditing = editingId === role.id;
          return (
            <div key={role.id} className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    {isEditing ? (
                      <input value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} className="border border-border rounded-lg px-2 py-1 text-sm font-semibold bg-background" />
                    ) : (
                      <p className="font-semibold text-sm">{role.displayName}</p>
                    )}
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{role.name}{role.isSystem && <span className="ml-1 text-primary"> • نظامي</span>}</p>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setEditingId(null)}><X className="w-4 h-4" /></Button>
                        <Button size="sm" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: role.id, displayName: editDisplayName, permissions: editPerms })}><Check className="w-4 h-4" /></Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => startEdit(role)}><Edit2 className="w-4 h-4" /></Button>
                        {!role.isSystem && (
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("هل أنت متأكد من حذف هذا الدور؟")) deleteMutation.mutate(role.id); }}><Trash2 className="w-4 h-4" /></Button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {!isEditing && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {role.permissions.slice(0, 8).map(p => (
                    <span key={p} className="text-[10px] bg-primary/8 text-primary px-2 py-0.5 rounded-full font-medium">{PERM_LABELS[p] ?? p}</span>
                  ))}
                  {role.permissions.length > 8 && <span className="text-[10px] text-muted-foreground px-2 py-0.5">+{role.permissions.length - 8} أخرى</span>}
                  {role.permissions.length === 0 && <span className="text-xs text-muted-foreground italic">لا توجد صلاحيات</span>}
                </div>
              )}

              {isEditing && <PermMatrix perms={editPerms} setPerms={setEditPerms} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function RolesSettings() {
  return (
    <AdminLayout>
      <PermissionGuard permission="manage_roles">
        <RolesContent />
      </PermissionGuard>
    </AdminLayout>
  );
}
