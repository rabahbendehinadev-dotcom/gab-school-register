import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PermissionGuard } from "@/components/admin/PermissionGuard";
import { useI18n } from "@/contexts/i18n-context";
import { useToast } from "@/hooks/use-toast";
import { CheckSquare, Clock, AlertTriangle, CheckCircle, PauseCircle, XCircle, PlayCircle, HelpCircle, ChevronDown, RefreshCw, AlarmClock } from "lucide-react";

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

interface Assignment {
  id: number;
  title: string;
  description: string | null;
  priority: string;
  proofRequired: boolean;
  noteRequired: boolean;
  resultRequired: boolean;
  studentRequired: boolean;
  dueAt: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  note: string | null;
  result: string | null;
  proofUrl: string | null;
  snoozeCount: number;
  snoozeUntil: string | null;
}

interface ChecklistSettings {
  checklist_snooze_options: string;
  checklist_max_snooze_count: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  not_started:      { label: "لم تبدأ",           color: "text-muted-foreground", icon: Clock },
  in_progress:      { label: "قيد التنفيذ",        color: "text-blue-600",         icon: PlayCircle },
  completed:        { label: "منجزة",             color: "text-green-600",         icon: CheckCircle },
  overdue:          { label: "متأخرة",            color: "text-red-600",           icon: AlertTriangle },
  postponed:        { label: "مؤجلة",             color: "text-amber-600",         icon: PauseCircle },
  pending_postpone: { label: "انتظار موافقة التأجيل", color: "text-purple-600",    icon: HelpCircle },
  cancelled:        { label: "ملغاة",             color: "text-gray-400",          icon: XCircle },
};

const PRIORITY_COLORS: Record<string, string> = {
  low:    "bg-gray-100 text-gray-600",
  normal: "bg-blue-50 text-blue-700",
  high:   "bg-orange-50 text-orange-700",
  urgent: "bg-red-50 text-red-700",
};
const PRIORITY_LABELS: Record<string, string> = {
  low: "منخفضة", normal: "عادية", high: "عالية", urgent: "عاجلة",
};

function countdown(dueAt: string): string {
  const diff = new Date(dueAt).getTime() - Date.now();
  if (diff < 0) {
    const m = Math.round(-diff / 60000);
    return m < 60 ? `متأخر ${m} د` : `متأخر ${Math.round(m / 60)} س`;
  }
  const m = Math.round(diff / 60000);
  if (m < 60) return `متبقي ${m} د`;
  return `متبقي ${Math.round(m / 60)} س`;
}

function CompleteModal({ assignment, onClose, onSuccess }: {
  assignment: Assignment;
  settings: ChecklistSettings;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [note, setNote]       = useState("");
  const [result, setResult]   = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [error, setError]     = useState<string[]>([]);
  const { toast } = useToast();

  const completeMutation = useMutation({
    mutationFn: (body: object) => apiFetch(`/checklists/assignments/${assignment.id}/complete`, {
      method: "POST", body: JSON.stringify(body),
    }),
    onSuccess: () => { toast({ title: "✅ تم الإنجاز" }); onSuccess(); onClose(); },
    onError: async (err: Error) => {
      try {
        const raw = err.message;
        const idx = raw.indexOf("{");
        if (idx !== -1) {
          const parsed = JSON.parse(raw.slice(idx));
          if (Array.isArray(parsed.details)) { setError(parsed.details); return; }
          if (parsed.error) { setError([parsed.error]); return; }
        }
      } catch { /* no-op */ }
      setError([err.message]);
    },
  });

  const handleSubmit = () => {
    setError([]);
    completeMutation.mutate({
      note:     note     || null,
      result:   result   || null,
      proofUrl: proofUrl || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div dir="rtl" className="bg-card rounded-2xl border border-border shadow-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold">إنجاز المهمة: {assignment.title}</h2>

        {error.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 space-y-1">
            {error.map((e, i) => <div key={i}>• {e}</div>)}
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-foreground">
            الملاحظة {assignment.noteRequired && <span className="text-red-500">*</span>}
            {!assignment.noteRequired && <span className="text-muted-foreground font-normal"> (اختياري)</span>}
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            className="mt-1 w-full border border-border rounded-xl p-2 text-sm resize-none bg-background"
            rows={assignment.noteRequired ? 3 : 2}
            placeholder={assignment.noteRequired ? "اكتب ملاحظتك هنا... (مطلوب)" : "أضف ملاحظة..."}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">
            النتيجة {assignment.resultRequired && <span className="text-red-500">*</span>}
            {!assignment.resultRequired && <span className="text-muted-foreground font-normal"> (اختياري)</span>}
          </label>
          <input
            value={result}
            onChange={e => setResult(e.target.value)}
            className="mt-1 w-full border border-border rounded-xl p-2 text-sm bg-background"
            placeholder={assignment.resultRequired ? "صِف نتيجة المهمة... (مطلوب)" : "صِف نتيجة المهمة..."}
          />
        </div>

        {assignment.proofRequired && (
          <div>
            <label className="text-sm font-medium text-foreground">
              رابط الإثبات <span className="text-red-500">*</span>
            </label>
            <input
              value={proofUrl}
              onChange={e => setProofUrl(e.target.value)}
              type="url"
              className="mt-1 w-full border border-border rounded-xl p-2 text-sm bg-background"
              placeholder="https://... (رابط صورة أو مستند)"
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground mt-1">ارفع الإثبات على Google Drive أو أي خدمة مشاركة ملفات ثم الصق الرابط</p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSubmit}
            disabled={completeMutation.isPending}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold rounded-xl py-2.5 text-sm"
          >
            {completeMutation.isPending ? "..." : "تم الإنجاز ✅"}
          </button>
          <button onClick={onClose} className="flex-1 border border-border rounded-xl py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

function SnoozeMenu({ assignment, settings, onSuccess }: {
  assignment: Assignment;
  settings: ChecklistSettings;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const maxSnooze = parseInt(settings.checklist_max_snooze_count || "3", 10);
  const snoozeOpts = (settings.checklist_snooze_options || "10,30,60").split(",").map(Number);
  const snoozedOut = assignment.snoozeCount >= maxSnooze;

  const snoozeMutation = useMutation({
    mutationFn: (durationMinutes: number) => apiFetch(`/checklists/assignments/${assignment.id}/snooze`, {
      method: "POST", body: JSON.stringify({ durationMinutes }),
    }),
    onSuccess: () => { toast({ title: "⏸ تم التأجيل" }); setOpen(false); onSuccess(); },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  if (snoozedOut) return (
    <span className="text-[10px] text-red-500 font-medium">تجاوز حد التأجيل</span>
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 hover:bg-amber-100"
      >
        <AlarmClock className="w-3 h-3" />
        تأجيل ({assignment.snoozeCount}/{maxSnooze})
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute z-10 top-8 right-0 bg-card border border-border rounded-xl shadow-lg p-2 flex gap-1.5">
          {snoozeOpts.map(min => (
            <button
              key={min}
              onClick={() => snoozeMutation.mutate(min)}
              disabled={snoozeMutation.isPending}
              className="text-xs font-bold px-2 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50"
            >
              {min} د
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Checklists() {
  const { lang } = useI18n();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [completeTarget, setCompleteTarget] = useState<Assignment | null>(null);

  const settingsQ = useQuery<ChecklistSettings>({
    queryKey: ["checklist-settings"],
    queryFn: () => apiFetch("/checklists/settings"),
  });

  const genMutation = useMutation({
    mutationFn: () => apiFetch("/checklists/generate", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-checklists"] }),
    onError: () => {},
  });

  const { data: assignments = [], isLoading, refetch } = useQuery<Assignment[]>({
    queryKey: ["my-checklists"],
    queryFn: () => apiFetch("/checklists/my"),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    genMutation.mutate();
  }, []);

  const startMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/checklists/assignments/${id}/start`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-checklists"] }),
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const helpMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/checklists/assignments/${id}/help`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => toast({ title: "🆘 تم إرسال طلب المساعدة" }),
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const postponeMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/checklists/assignments/${id}/postpone-request`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => { toast({ title: "📤 تم إرسال طلب التأجيل" }); qc.invalidateQueries({ queryKey: ["my-checklists"] }); },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const pending   = assignments.filter(a => ["not_started", "in_progress", "pending_postpone"].includes(a.status));
  const overdue   = assignments.filter(a => a.status === "overdue");
  const done      = assignments.filter(a => ["completed", "cancelled", "postponed"].includes(a.status));

  const settings = settingsQ.data ?? { checklist_snooze_options: "10,30,60", checklist_max_snooze_count: "3" };

  return (
    <AdminLayout>
      <PermissionGuard permission="view_dashboard">
        <div dir="rtl" className="space-y-5 max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <CheckSquare className="w-6 h-6 text-primary" />
                مهامي اليوم
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {new Date().toLocaleDateString("ar-DZ", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
            <button
              onClick={() => { genMutation.mutate(); refetch(); }}
              className="flex items-center gap-1.5 text-sm font-medium text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-xl px-3 py-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${genMutation.isPending ? "animate-spin" : ""}`} />
              تحديث
            </button>
          </div>

          {/* Overdue banner */}
          {overdue.length > 0 && (
            <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm font-bold text-red-700">
                لديك {overdue.length} مهمة متأخرة! يرجى إنجازها فوراً.
              </p>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-16 text-muted-foreground">جاري التحميل...</div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-16 bg-card border border-border rounded-2xl text-muted-foreground">
              <CheckSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">لا توجد مهام اليوم</p>
              <p className="text-xs mt-1">سيتم تعيين المهام تلقائياً من القوالب النشطة</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...overdue, ...pending, ...done].map(a => {
                const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.not_started;
                const StatusIcon = cfg.icon;
                const isPast = new Date(a.dueAt) < new Date();
                const isActive = ["not_started", "in_progress", "overdue"].includes(a.status);
                const snoozedUntil = a.snoozeUntil && new Date(a.snoozeUntil) > new Date();

                return (
                  <div
                    key={a.id}
                    className={`bg-card border rounded-2xl p-4 space-y-3 ${a.status === "overdue" ? "border-red-300 bg-red-50/30" : a.status === "completed" ? "border-green-200 opacity-70" : "border-border"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <StatusIcon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${cfg.color}`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground text-sm leading-tight">{a.title}</p>
                          {a.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.description}</p>}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${PRIORITY_COLORS[a.priority] ?? PRIORITY_COLORS.normal}`}>
                              {PRIORITY_LABELS[a.priority] ?? a.priority}
                            </span>
                            <span className={`text-[10px] font-medium ${isPast && isActive ? "text-red-600" : "text-muted-foreground"}`}>
                              {countdown(a.dueAt)}
                            </span>
                            {snoozedUntil && (
                              <span className="text-[10px] text-amber-600 font-medium">
                                ⏸ مؤجلة حتى {new Date(a.snoozeUntil!).toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${cfg.color} bg-muted/50`}>{cfg.label}</span>
                    </div>

                    {/* Action buttons */}
                    {isActive && (
                      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border/50">
                        {a.status === "not_started" && (
                          <button
                            onClick={() => startMutation.mutate(a.id)}
                            disabled={startMutation.isPending}
                            className="flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 hover:bg-blue-100 disabled:opacity-50"
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            بدأت المهمة
                          </button>
                        )}
                        <button
                          onClick={() => setCompleteTarget(a)}
                          className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5 hover:bg-green-100"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          تم الإنجاز
                        </button>
                        <SnoozeMenu assignment={a} settings={settings} onSuccess={() => qc.invalidateQueries({ queryKey: ["my-checklists"] })} />
                        <button
                          onClick={() => helpMutation.mutate(a.id)}
                          disabled={helpMutation.isPending}
                          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg px-2 py-1.5 hover:bg-muted"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          أحتاج مساعدة
                        </button>
                        <button
                          onClick={() => postponeMutation.mutate(a.id)}
                          disabled={postponeMutation.isPending}
                          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg px-2 py-1.5 hover:bg-muted"
                        >
                          طلب تأجيل
                        </button>
                      </div>
                    )}
                    {a.status === "completed" && a.note && (
                      <p className="text-xs text-muted-foreground border-t border-border/50 pt-2">📝 {a.note}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {completeTarget && (
          <CompleteModal
            assignment={completeTarget}
            settings={settings}
            onClose={() => setCompleteTarget(null)}
            onSuccess={() => qc.invalidateQueries({ queryKey: ["my-checklists"] })}
          />
        )}
      </PermissionGuard>
    </AdminLayout>
  );
}
