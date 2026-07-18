import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PermissionGuard } from "@/components/admin/PermissionGuard";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, Users, Settings, CalendarDays, BarChart3, Save, X } from "lucide-react";

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

interface TemplateItem {
  id: number;
  templateId: number;
  title: string;
  description: string | null;
  priority: string;
  proofRequired: boolean;
  noteRequired: boolean;
  offsetMinutes: number;
  sortOrder: number;
}

interface Template {
  id: number;
  title: string;
  description: string | null;
  assignedToRole: string | null;
  assignedToStaffId: number | null;
  daysOfWeek: number[];
  enabled: boolean;
  recurrence: string;
  items: TemplateItem[];
}

interface StaffMember { id: number; fullName: string; role: string }

interface Assignment {
  id: number;
  title: string;
  status: string;
  priority: string;
  dueAt: string;
  staffId: number;
  staffName: string | null;
  snoozeCount: number;
  completedAt: string | null;
  note: string | null;
  dateKey: string | null;
}

interface ChecklistSettings {
  checklist_reminder2_min: string;
  checklist_important_min: string;
  checklist_overdue_min: string;
  checklist_tl_notify_min: string;
  checklist_ai_alert_min: string;
  checklist_snooze_options: string;
  checklist_max_snooze_count: string;
}

const DAYS = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
const ROLES = ["admin", "team_leader", "sales_agent", "content_manager", "viewer"];
const PRIORITIES = ["low", "normal", "high", "urgent"];
const PRIORITY_LABELS: Record<string, string> = { low: "منخفضة", normal: "عادية", high: "عالية", urgent: "عاجلة" };

const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-600",
  in_progress:  "bg-blue-100 text-blue-700",
  completed:    "bg-green-100 text-green-700",
  overdue:      "bg-red-100 text-red-700",
  postponed:    "bg-amber-100 text-amber-700",
  cancelled:    "bg-gray-100 text-gray-400",
};
const STATUS_LABELS: Record<string, string> = {
  not_started: "لم تبدأ", in_progress: "قيد التنفيذ", completed: "منجزة",
  overdue: "متأخرة", postponed: "مؤجلة", cancelled: "ملغاة",
};

function TemplateForm({ initial, onSave, onCancel }: {
  initial?: Partial<Template>;
  onSave: (data: Partial<Template>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [assignedToRole, setAssignedToRole] = useState(initial?.assignedToRole ?? "");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(initial?.daysOfWeek ?? [0,1,2,3,4,5,6]);
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);

  const toggleDay = (d: number) => setDaysOfWeek(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div>
        <label className="text-xs font-semibold text-muted-foreground">عنوان القالب *</label>
        <input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full border border-border rounded-xl p-2 text-sm bg-background" placeholder="مثال: مراجعة يومية للمتابعات" />
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground">الوصف</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} className="mt-1 w-full border border-border rounded-xl p-2 text-sm resize-none bg-background" rows={2} placeholder="وصف اختياري..." />
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground">تعيين للدور</label>
        <select value={assignedToRole} onChange={e => setAssignedToRole(e.target.value)} className="mt-1 w-full border border-border rounded-xl p-2 text-sm bg-background">
          <option value="">الكل</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-2 block">أيام الأسبوع</label>
        <div className="flex gap-1.5 flex-wrap">
          {DAYS.map((day, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggleDay(i)}
              className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border ${daysOfWeek.includes(i) ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
            >
              {day}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} id="tmpl-enabled" className="w-4 h-4" />
        <label htmlFor="tmpl-enabled" className="text-sm font-medium">تفعيل القالب</label>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={() => onSave({ title, description: description || null, assignedToRole: assignedToRole || null, daysOfWeek, enabled })}
          disabled={!title.trim()}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl px-4 py-2 hover:bg-primary/90 disabled:opacity-50">
          <Save className="w-3.5 h-3.5" /> حفظ
        </button>
        <button onClick={onCancel} className="flex items-center gap-1.5 border border-border text-sm font-medium rounded-xl px-4 py-2 hover:bg-muted text-muted-foreground">
          <X className="w-3.5 h-3.5" /> إلغاء
        </button>
      </div>
    </div>
  );
}

function ItemForm({ templateId, initial, onSave, onCancel }: {
  templateId: number;
  initial?: Partial<TemplateItem>;
  onSave: (data: object) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priority, setPriority] = useState(initial?.priority ?? "normal");
  const [noteRequired, setNoteRequired] = useState(initial?.noteRequired ?? false);
  const [proofRequired, setProofRequired] = useState(initial?.proofRequired ?? false);
  const [offsetMinutes, setOffsetMinutes] = useState(String(initial?.offsetMinutes ?? 0));

  return (
    <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-semibold text-muted-foreground">عنوان البند *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full border border-border rounded-xl p-2 text-sm bg-background" placeholder="ما هي هذه المهمة؟" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">الأولوية</label>
          <select value={priority} onChange={e => setPriority(e.target.value)} className="mt-1 w-full border border-border rounded-xl p-2 text-sm bg-background">
            {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">الإزاحة (دقائق من 9ص)</label>
          <input type="number" min={0} value={offsetMinutes} onChange={e => setOffsetMinutes(e.target.value)} className="mt-1 w-full border border-border rounded-xl p-2 text-sm bg-background" />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground">الوصف</label>
        <input value={description} onChange={e => setDescription(e.target.value)} className="mt-1 w-full border border-border rounded-xl p-2 text-sm bg-background" placeholder="تفاصيل إضافية..." />
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
          <input type="checkbox" checked={noteRequired} onChange={e => setNoteRequired(e.target.checked)} className="w-3.5 h-3.5" />
          ملاحظة إلزامية
        </label>
        <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
          <input type="checkbox" checked={proofRequired} onChange={e => setProofRequired(e.target.checked)} className="w-3.5 h-3.5" />
          إثبات إلزامي
        </label>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onSave({ title, description: description || null, priority, noteRequired, proofRequired, offsetMinutes: parseInt(offsetMinutes, 10) || 0 })}
          disabled={!title.trim()}
          className="text-xs font-bold bg-primary text-primary-foreground rounded-lg px-3 py-1.5 hover:bg-primary/90 disabled:opacity-50">
          حفظ البند
        </button>
        <button onClick={onCancel} className="text-xs font-medium border border-border rounded-lg px-3 py-1.5 hover:bg-muted text-muted-foreground">إلغاء</button>
      </div>
    </div>
  );
}

function TemplateCard({ template, staffList, onRefresh }: { template: Template; staffList: StaffMember[]; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const deleteTmpl = useMutation({
    mutationFn: () => apiFetch(`/checklists/templates/${template.id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "تم الحذف" }); onRefresh(); },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const updateTmpl = useMutation({
    mutationFn: (body: object) => apiFetch(`/checklists/templates/${template.id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { toast({ title: "تم التحديث" }); setEditing(false); onRefresh(); },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const toggleEnabled = useMutation({
    mutationFn: () => apiFetch(`/checklists/templates/${template.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !template.enabled }) }),
    onSuccess: () => onRefresh(),
  });

  const addItem = useMutation({
    mutationFn: (body: object) => apiFetch(`/checklists/templates/${template.id}/items`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { toast({ title: "تمت إضافة البند" }); setAddingItem(false); onRefresh(); },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const deleteItem = useMutation({
    mutationFn: (itemId: number) => apiFetch(`/checklists/items/${itemId}`, { method: "DELETE" }),
    onSuccess: () => onRefresh(),
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  if (editing) return (
    <TemplateForm
      initial={template}
      onSave={data => updateTmpl.mutate(data)}
      onCancel={() => setEditing(false)}
    />
  );

  return (
    <div className={`bg-card border rounded-2xl overflow-hidden ${!template.enabled ? "opacity-60" : ""}`}>
      <div className="p-4 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-sm text-foreground truncate">{template.title}</p>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${template.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {template.enabled ? "نشط" : "معطل"}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {template.assignedToRole && <span className="text-[10px] text-muted-foreground">👤 {template.assignedToRole}</span>}
            <span className="text-[10px] text-muted-foreground">📅 {(template.daysOfWeek ?? []).map(d => DAYS[d]).join(", ")}</span>
            <span className="text-[10px] text-muted-foreground">📋 {template.items.length} بنود</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => toggleEnabled.mutate()} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground text-xs">
            {template.enabled ? "تعطيل" : "تفعيل"}
          </button>
          <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { if (confirm("حذف القالب؟")) deleteTmpl.mutate(); }} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-4 space-y-3">
          <div className="space-y-2">
            {template.items.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">لا توجد بنود — أضف بنداً أدناه</p>
            )}
            {template.items.map(item => (
              <div key={item.id} className="flex items-start gap-2 bg-muted/30 rounded-xl p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <div className="flex gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">{PRIORITY_LABELS[item.priority] ?? item.priority}</span>
                    {item.offsetMinutes > 0 && <span className="text-[10px] text-muted-foreground">+{item.offsetMinutes} د من 9ص</span>}
                    {item.noteRequired && <span className="text-[10px] text-amber-600">ملاحظة إلزامية</span>}
                    {item.proofRequired && <span className="text-[10px] text-orange-600">إثبات إلزامي</span>}
                  </div>
                </div>
                <button onClick={() => deleteItem.mutate(item.id)} className="p-1 hover:bg-red-50 rounded-lg text-red-400">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          {addingItem ? (
            <ItemForm
              templateId={template.id}
              onSave={data => addItem.mutate(data)}
              onCancel={() => setAddingItem(false)}
            />
          ) : (
            <button onClick={() => setAddingItem(true)} className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-primary border border-dashed border-primary/30 rounded-xl py-2 hover:bg-primary/5">
              <Plus className="w-3.5 h-3.5" /> إضافة بند
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type Tab = "templates" | "assignments" | "settings";

export default function ChecklistAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("templates");
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [assignmentDate, setAssignmentDate] = useState(new Date().toISOString().slice(0, 10));
  const [settingsDraft, setSettingsDraft] = useState<ChecklistSettings | null>(null);

  const templatesQ = useQuery<Template[]>({
    queryKey: ["checklist-templates"],
    queryFn: () => apiFetch("/checklists/templates"),
  });

  const staffQ = useQuery<StaffMember[]>({
    queryKey: ["staff-list"],
    queryFn: () => apiFetch("/staff"),
  });

  const assignmentsQ = useQuery<Assignment[]>({
    queryKey: ["checklist-assignments", assignmentDate],
    queryFn: () => apiFetch(`/checklists/assignments?dateKey=${assignmentDate}`),
    enabled: tab === "assignments",
  });

  const settingsQ = useQuery<ChecklistSettings>({
    queryKey: ["checklist-settings"],
    queryFn: () => apiFetch("/checklists/settings"),
    enabled: tab === "settings",
  });

  const createTemplate = useMutation({
    mutationFn: (body: object) => apiFetch("/checklists/templates", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { toast({ title: "✅ تم إنشاء القالب" }); setShowNewTemplate(false); qc.invalidateQueries({ queryKey: ["checklist-templates"] }); },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const saveSettings = useMutation({
    mutationFn: (body: object) => apiFetch("/checklists/settings", { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => { toast({ title: "✅ تم حفظ الإعدادات" }); qc.invalidateQueries({ queryKey: ["checklist-settings"] }); },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const cancelAssignment = useMutation({
    mutationFn: (id: number) => apiFetch(`/checklists/assignments/${id}/cancel`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist-assignments", assignmentDate] }),
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const settings = settingsDraft ?? settingsQ.data;

  const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: "templates",   label: "القوالب",      icon: CalendarDays },
    { id: "assignments", label: "المهام اليوم",  icon: BarChart3 },
    { id: "settings",   label: "إعدادات",       icon: Settings },
  ];

  return (
    <AdminLayout>
      <PermissionGuard permission="manage_tasks">
        <div dir="rtl" className="space-y-5 max-w-5xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold text-foreground">إدارة قوائم المهام</h1>
            <p className="text-sm text-muted-foreground mt-0.5">قوالب المهام اليومية وإعدادات التصعيد</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-muted/40 rounded-2xl p-1 w-fit">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Templates Tab */}
          {tab === "templates" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{templatesQ.data?.length ?? 0} قالب</p>
                <button
                  onClick={() => setShowNewTemplate(true)}
                  className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl px-4 py-2 hover:bg-primary/90"
                >
                  <Plus className="w-4 h-4" /> قالب جديد
                </button>
              </div>

              {showNewTemplate && (
                <TemplateForm
                  onSave={data => createTemplate.mutate(data)}
                  onCancel={() => setShowNewTemplate(false)}
                />
              )}

              {templatesQ.isLoading ? (
                <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
              ) : (templatesQ.data ?? []).length === 0 && !showNewTemplate ? (
                <div className="text-center py-12 bg-card border border-dashed border-border rounded-2xl text-muted-foreground">
                  <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">لا توجد قوالب بعد</p>
                  <p className="text-xs mt-1">أنشئ قالباً لتعيين مهام يومية للموظفين تلقائياً</p>
                </div>
              ) : (
                (templatesQ.data ?? []).map(t => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    staffList={staffQ.data ?? []}
                    onRefresh={() => qc.invalidateQueries({ queryKey: ["checklist-templates"] })}
                  />
                ))
              )}
            </div>
          )}

          {/* Assignments Tab */}
          {tab === "assignments" && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={assignmentDate}
                  onChange={e => setAssignmentDate(e.target.value)}
                  className="border border-border rounded-xl p-2 text-sm bg-background"
                />
                <span className="text-sm text-muted-foreground">{assignmentsQ.data?.length ?? 0} مهمة</span>
              </div>

              {assignmentsQ.isLoading ? (
                <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
              ) : (assignmentsQ.data ?? []).length === 0 ? (
                <div className="text-center py-10 bg-card border border-dashed border-border rounded-2xl text-muted-foreground text-sm">
                  لا توجد مهام لهذا اليوم
                </div>
              ) : (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-right p-3 font-semibold text-muted-foreground text-xs">الموظف</th>
                        <th className="text-right p-3 font-semibold text-muted-foreground text-xs">المهمة</th>
                        <th className="text-right p-3 font-semibold text-muted-foreground text-xs">الحالة</th>
                        <th className="text-right p-3 font-semibold text-muted-foreground text-xs">الموعد</th>
                        <th className="text-right p-3 font-semibold text-muted-foreground text-xs">تأجيلات</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(assignmentsQ.data ?? []).map(a => (
                        <tr key={a.id} className="hover:bg-muted/20">
                          <td className="p-3 font-medium text-foreground">{a.staffName ?? `#${a.staffId}`}</td>
                          <td className="p-3">
                            <p className="font-medium text-foreground">{a.title}</p>
                            {a.note && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">📝 {a.note}</p>}
                          </td>
                          <td className="p-3">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[a.status] ?? ""}`}>
                              {STATUS_LABELS[a.status] ?? a.status}
                            </span>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {new Date(a.dueAt).toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="p-3 text-xs text-center text-muted-foreground">{a.snoozeCount}</td>
                          <td className="p-3">
                            {!["completed", "cancelled"].includes(a.status) && (
                              <button
                                onClick={() => cancelAssignment.mutate(a.id)}
                                className="text-[10px] text-red-600 hover:underline"
                              >
                                إلغاء
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {tab === "settings" && (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-5 max-w-2xl">
              <h2 className="font-bold text-foreground flex items-center gap-2"><Settings className="w-4 h-4" /> إعدادات قوائم المهام</h2>

              {settingsQ.isLoading ? (
                <div className="text-center py-6 text-muted-foreground">جاري التحميل...</div>
              ) : settings ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: "checklist_reminder2_min",  label: "التذكير الثاني (دقائق)", hint: "المدة بعد الاستحقاق لإرسال تذكير ثانٍ" },
                      { key: "checklist_important_min",  label: "الإشعار المهم (دقائق)",  hint: "المدة لإرسال إشعار عاجل" },
                      { key: "checklist_overdue_min",    label: "التأخر (دقائق)",          hint: "المدة لتصنيف المهمة متأخرة وإشعار المشرف" },
                      { key: "checklist_tl_notify_min",  label: "إشعار مشرف الفريق (دقائق)", hint: "المدة لتصعيد للمشرف" },
                      { key: "checklist_ai_alert_min",   label: "تنبيه AI (دقائق)",       hint: "المدة لتنبيه نظام التحكم الذكي" },
                    ].map(({ key, label, hint }) => (
                      <div key={key}>
                        <label className="text-xs font-semibold text-foreground">{label}</label>
                        <p className="text-[10px] text-muted-foreground mb-1">{hint}</p>
                        <input
                          type="number"
                          min={1}
                          value={(settingsDraft ?? settings)[key as keyof ChecklistSettings]}
                          onChange={e => setSettingsDraft(prev => ({ ...(prev ?? settings!), [key]: e.target.value }))}
                          className="w-full border border-border rounded-xl p-2 text-sm bg-background"
                        />
                      </div>
                    ))}
                    <div>
                      <label className="text-xs font-semibold text-foreground">خيارات التأجيل (دقائق، مفصولة بفاصلة)</label>
                      <p className="text-[10px] text-muted-foreground mb-1">مثال: 10,30,60</p>
                      <input
                        value={(settingsDraft ?? settings).checklist_snooze_options}
                        onChange={e => setSettingsDraft(prev => ({ ...(prev ?? settings!), checklist_snooze_options: e.target.value }))}
                        className="w-full border border-border rounded-xl p-2 text-sm bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-foreground">الحد الأقصى للتأجيل (مرات)</label>
                      <p className="text-[10px] text-muted-foreground mb-1">عدد مرات التأجيل المسموح</p>
                      <input
                        type="number"
                        min={1}
                        value={(settingsDraft ?? settings).checklist_max_snooze_count}
                        onChange={e => setSettingsDraft(prev => ({ ...(prev ?? settings!), checklist_max_snooze_count: e.target.value }))}
                        className="w-full border border-border rounded-xl p-2 text-sm bg-background"
                      />
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 space-y-1">
                    <p className="font-semibold">⚙️ تسلسل التصعيد الحالي:</p>
                    {settings && [
                      ["المستوى 1", "عند الاستحقاق", "إشعار أولي"],
                      ["المستوى 2", `+${(settingsDraft ?? settings).checklist_reminder2_min} د`, "تذكير ثانٍ"],
                      ["المستوى 3", `+${(settingsDraft ?? settings).checklist_important_min} د`, "إشعار عاجل"],
                      ["المستوى 4", `+${(settingsDraft ?? settings).checklist_overdue_min} د`, "متأخرة + إشعار مشرف"],
                      ["المستوى 5", `+${(settingsDraft ?? settings).checklist_tl_notify_min} د`, "تصعيد مشرف الفريق"],
                      ["المستوى 6", `+${(settingsDraft ?? settings).checklist_ai_alert_min} د`, "تنبيه AI Control"],
                    ].map(([lvl, time, desc]) => (
                      <p key={lvl}>{lvl}: {time} — {desc}</p>
                    ))}
                  </div>

                  <button
                    onClick={() => saveSettings.mutate(settingsDraft ?? settings)}
                    disabled={saveSettings.isPending}
                    className="flex items-center gap-1.5 bg-primary text-primary-foreground font-bold rounded-xl px-5 py-2.5 hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saveSettings.isPending ? "جاري الحفظ..." : "حفظ الإعدادات"}
                  </button>
                </>
              ) : null}
            </div>
          )}
        </div>
      </PermissionGuard>
    </AdminLayout>
  );
}
