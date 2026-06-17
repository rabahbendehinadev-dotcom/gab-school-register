import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useI18n } from "@/contexts/i18n-context";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Check, Trash2, Phone, MessageCircle, DollarSign, Users, Globe, ClipboardList,
  AlertTriangle, CalendarClock, CalendarCheck2, Loader2,
} from "lucide-react";

interface Task {
  id: number;
  studentId: number | null;
  type: string;
  title: string;
  dueAt: string | null;
  assignedTo: number | null;
  completed: boolean;
  completedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  studentFirstName: string | null;
  studentLastName: string | null;
  studentPhone: string | null;
  assigneeName: string | null;
}

interface StaffMember { id: number; fullName: string }

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

const TYPE_META: Record<string, { icon: typeof Phone; ar: string; fr: string; color: string }> = {
  call: { icon: Phone, ar: "مكالمة", fr: "Appel", color: "text-blue-600 bg-blue-50 border-blue-200" },
  whatsapp: { icon: MessageCircle, ar: "واتساب", fr: "WhatsApp", color: "text-green-600 bg-green-50 border-green-200" },
  payment: { icon: DollarSign, ar: "دفع", fr: "Paiement", color: "text-amber-600 bg-amber-50 border-amber-200" },
  group: { icon: Users, ar: "مجموعة", fr: "Groupe", color: "text-violet-600 bg-violet-50 border-violet-200" },
  site: { icon: Globe, ar: "الموقع", fr: "Site", color: "text-cyan-600 bg-cyan-50 border-cyan-200" },
  other: { icon: ClipboardList, ar: "أخرى", fr: "Autre", color: "text-gray-600 bg-gray-50 border-gray-200" },
};

function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function endOfToday() { const d = new Date(); d.setHours(23, 59, 59, 999); return d; }

export default function Tasks() {
  const { lang } = useI18n();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isFr = lang === "fr";

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("call");
  const [dueAt, setDueAt] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: () => apiFetch("/tasks"),
  });
  const { data: staff = [] } = useQuery<StaffMember[]>({
    queryKey: ["staff-for-tasks"],
    queryFn: () => apiFetch("/staff").catch(() => []),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiFetch("/tasks", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setShowForm(false); setTitle(""); setType("call"); setDueAt(""); setAssignedTo("");
      toast({ title: isFr ? "Tâche créée" : "تم إنشاء المهمة" });
    },
    onError: () => toast({ title: isFr ? "Erreur de création" : "خطأ في الإنشاء", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, completed }: { id: number; completed: boolean }) =>
      apiFetch(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ completed }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const active = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);
  const sot = startOfToday().getTime();
  const eot = endOfToday().getTime();

  const overdue = active.filter((t) => t.dueAt && new Date(t.dueAt).getTime() < sot);
  const today = active.filter((t) => t.dueAt && new Date(t.dueAt).getTime() >= sot && new Date(t.dueAt).getTime() <= eot);
  const upcoming = active.filter((t) => !t.dueAt || new Date(t.dueAt).getTime() > eot);

  function submit() {
    if (!title.trim()) return;
    createMutation.mutate({
      title: title.trim(),
      type,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      assignedTo: assignedTo ? Number(assignedTo) : null,
    });
  }

  function TaskRow({ t: task }: { t: Task }) {
    const meta = TYPE_META[task.type] ?? TYPE_META.other;
    const Icon = meta.icon;
    const studentName = task.studentFirstName ? `${task.studentFirstName} ${task.studentLastName ?? ""}`.trim() : null;
    return (
      <div className={`flex items-start gap-3 p-3 rounded-xl border bg-card hover:shadow-sm transition-all ${task.completed ? "opacity-60" : ""}`}>
        <button
          onClick={() => toggleMutation.mutate({ id: task.id, completed: !task.completed })}
          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${task.completed ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-green-400"}`}
        >
          {task.completed && <Check className="w-3 h-3" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${meta.color}`}>
              <Icon className="w-3 h-3" />{isFr ? meta.fr : meta.ar}
            </span>
            <p className={`text-sm font-medium ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>{task.title}</p>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            {studentName && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{studentName}</span>}
            {task.studentPhone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{task.studentPhone}</span>}
            {task.dueAt && (
              <span className="flex items-center gap-1">
                <CalendarClock className="w-3 h-3" />
                {new Date(task.dueAt).toLocaleString(isFr ? "fr-FR" : "ar-DZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            {task.assigneeName && <span className="text-primary font-medium">@{task.assigneeName}</span>}
          </div>
        </div>
        <button onClick={() => deleteMutation.mutate(task.id)} className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  function Section({ title: stitle, icon: Icon, color, items }: { title: string; icon: typeof Phone; color: string; items: Task[] }) {
    if (items.length === 0) return null;
    return (
      <div>
        <div className={`flex items-center gap-2 mb-2 font-bold text-sm ${color}`}>
          <Icon className="w-4 h-4" />{stitle}
          <span className="text-xs font-semibold bg-current/10 px-1.5 py-0.5 rounded-full opacity-70">{items.length}</span>
        </div>
        <div className="space-y-2">{items.map((t) => <TaskRow key={t.id} t={t} />)}</div>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div dir={isFr ? "ltr" : "rtl"} className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{isFr ? "Tâches & Suivi" : "المهام والمتابعة"}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{isFr ? "Gérez vos rappels et suivis" : "تابع التذكيرات والمهام اليومية"}</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="rounded-xl">
            <Plus className="w-4 h-4 mr-1" />{isFr ? "Nouvelle tâche" : "مهمة جديدة"}
          </Button>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground animate-pulse">{isFr ? "Chargement..." : "جاري التحميل..."}</div>
        ) : tasks.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">{isFr ? "Aucune tâche pour le moment" : "لا توجد مهام بعد"}</p>
          </div>
        ) : (
          <div className="space-y-6">
            <Section title={isFr ? "En retard" : "متأخرة"} icon={AlertTriangle} color="text-red-600" items={overdue} />
            <Section title={isFr ? "Aujourd'hui" : "اليوم"} icon={CalendarCheck2} color="text-orange-600" items={today} />
            <Section title={isFr ? "À venir" : "قادمة"} icon={CalendarClock} color="text-blue-600" items={upcoming} />
            {done.length > 0 && (
              <Section title={isFr ? "Terminées" : "مكتملة"} icon={Check} color="text-green-600" items={done.slice(0, 20)} />
            )}
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent dir={isFr ? "ltr" : "rtl"}>
          <DialogHeader>
            <DialogTitle>{isFr ? "Nouvelle tâche" : "مهمة جديدة"}</DialogTitle>
            <DialogDescription>{isFr ? "Créez un rappel ou un suivi" : "أنشئ تذكيراً أو مهمة متابعة"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">{isFr ? "Titre" : "العنوان"}</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isFr ? "Ex: Rappeler l'étudiant" : "مثال: الاتصال بالطالب"} className="rounded-xl mt-1" autoFocus />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">{isFr ? "Type" : "النوع"}</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {Object.entries(TYPE_META).map(([key, m]) => {
                  const Icon = m.icon;
                  return (
                    <button key={key} onClick={() => setType(key)}
                      className={`flex items-center justify-center gap-1 text-xs font-semibold py-2 rounded-lg border transition-colors ${type === key ? m.color : "border-border text-muted-foreground hover:bg-muted"}`}>
                      <Icon className="w-3.5 h-3.5" />{isFr ? m.fr : m.ar}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">{isFr ? "Échéance (optionnel)" : "الموعد (اختياري)"}</label>
              <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="rounded-xl mt-1" />
            </div>
            {staff.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground">{isFr ? "Assigné à (optionnel)" : "مُسند إلى (اختياري)"}</label>
                <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full rounded-xl mt-1 border border-border bg-background px-3 py-2 text-sm">
                  <option value="">—</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-xl">{isFr ? "Annuler" : "إلغاء"}</Button>
            <Button onClick={submit} disabled={!title.trim() || createMutation.isPending} className="rounded-xl">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (isFr ? "Créer" : "إنشاء")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
