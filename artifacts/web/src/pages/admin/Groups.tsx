import { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useI18n } from "@/contexts/i18n-context";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users, Calendar, Plus, Edit, Trash2, ArrowRight,
  MessageCircle, ExternalLink, StickyNote, CheckCircle2,
  ChevronRight, Loader2, Search, UserPlus,
} from "lucide-react";
import { format } from "date-fns";

// ─── Stage config ─────────────────────────────────────────────────────────────

const ALL_STAGES = [
  { value: "new",               ar: "تسجيل جديد",     fr: "Nouveau",              cls: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "contacted",         ar: "تم التواصل",       fr: "Contacté",             cls: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "interested",        ar: "مهتم",             fr: "Intéressé",            cls: "bg-green-100 text-green-700 border-green-200" },
  { value: "payment_pending",   ar: "ينتظر الدفع",     fr: "Attente paiement",     cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { value: "payment_confirmed", ar: "تم الدفع",         fr: "Paiement confirmé",    cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "confirmed",         ar: "مؤكد للدورة",     fr: "Confirmé",             cls: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { value: "attended",          ar: "حضر",              fr: "Présent",              cls: "bg-teal-100 text-teal-700 border-teal-200" },
  { value: "no_show",           ar: "لم يحضر",          fr: "Absent",               cls: "bg-red-100 text-red-700 border-red-200" },
  { value: "completed",         ar: "مكتمل التكوين",   fr: "Terminé",              cls: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "archived",          ar: "أرشيف",            fr: "Archivé",              cls: "bg-gray-100 text-gray-500 border-gray-200" },
] as const;

function stageInfo(value: string) {
  return ALL_STAGES.find(s => s.value === value) ?? { ar: value, fr: value, cls: "bg-gray-100 text-gray-500 border-gray-200" };
}

// ─── Types ────────────────────────────────────────────────────────────────────

type GroupSummary = {
  id: number; name: string; startDate: string; trainingType: string;
  capacity: number; status: string; notes: string | null;
  studentCount: number; confirmedCount: number; paidCount: number; absentCount: number;
};

type GroupStudent = {
  id: number; firstName: string; lastName: string; phone: string;
  whatsapp: string; city: string; stage: string; paymentStatus: string;
  note: string | null; trainingType: string;
};

type GroupDetail = GroupSummary & { students: GroupStudent[] };

type GroupFormData = {
  name: string; startDate: string; trainingType: string;
  capacity: number; status: string; notes?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function apiFetch(path: string, opts?: RequestInit) {
  return fetch("/api" + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
}

function toIntlPhone(p: string): string {
  let c = p.replace(/\D/g, "");
  if (c.startsWith("0") && c.length === 10) c = "213" + c.slice(1);
  else if (c.startsWith("5") && c.length === 9) c = "213" + c;
  return c;
}

function buildWaMsg(studentName: string, stage: string): string {
  switch (stage) {
    case "new":               return `مرحباً ${studentName}! 🎉 تم تسجيلك في أكاديمية GAB SCHOOL. سنتواصل معك قريباً لتأكيد تفاصيل الدورة.`;
    case "payment_pending":   return `مرحباً ${studentName}! 💳 تذكير: يرجى إتمام الدفع لتأكيد مقعدك في الدورة. المقاعد محدودة!`;
    case "payment_confirmed": return `مرحباً ${studentName}! ✅ تأكدنا من استلام دفعتك. شكراً لك!`;
    case "confirmed":         return `مرحباً ${studentName}! 🎯 تم تأكيد مشاركتك في الدورة. في انتظار حضورك!`;
    case "attended":          return `مرحباً ${studentName}! 👋 شكراً على حضورك. نتمنى أن تستفيد من الدورة.`;
    case "no_show":           return `مرحباً ${studentName}! 📞 لاحظنا غيابك عن الدورة. هل أنت بخير؟ يرجى التواصل معنا.`;
    case "completed":         return `مبروك ${studentName}! 🏆 لقد أتممت دورتك بنجاح في أكاديمية GAB SCHOOL. نفخر بك!`;
    default:                  return `مرحباً ${studentName}! 👋 تواصلنا معك من أكاديمية GAB SCHOOL.`;
  }
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Groups() {
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  if (selectedGroupId !== null) {
    return <GroupDetailView groupId={selectedGroupId} onBack={() => setSelectedGroupId(null)} />;
  }
  return <GroupsListView onSelect={setSelectedGroupId} />;
}

// ─── Groups List View ─────────────────────────────────────────────────────────

function GroupsListView({ onSelect }: { onSelect: (id: number) => void }) {
  const { lang } = useI18n();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<GroupSummary | null>(null);

  const s = lang === "ar"
    ? { title: "الجداول والدورات", subtitle: "إدارة الدورات التدريبية والطلاب المسجلين", addBtn: "+ إضافة دورة", total: "طالب", confirmed: "مؤكد", paid: "دفع", absent: "غائب", fill: "امتلاء", openBtn: "فتح الدورة", physical: "حضوري", online: "عن بعد", open: "مفتوح", closed: "مغلق", deleteConfirm: "هل تريد حذف هذه الدورة؟", deleted: "تم حذف الدورة", created: "تم إنشاء الدورة ✅", updated: "تم تحديث الدورة ✅", noGroups: "لا توجد دورات بعد. ابدأ بإنشاء دورة جديدة!" }
    : { title: "Plannings & Formations", subtitle: "Gérer les sessions de formation et les apprenants", addBtn: "+ Ajouter", total: "étudiant", confirmed: "confirmé", paid: "payé", absent: "absent", fill: "remplissage", openBtn: "Ouvrir", physical: "Présentiel", online: "En ligne", open: "Ouvert", closed: "Fermé", deleteConfirm: "Supprimer cette session?", deleted: "Session supprimée", created: "Session créée ✅", updated: "Session mise à jour ✅", noGroups: "Aucune session. Commencez par en créer une!" };

  const { data: groups = [], isLoading, refetch } = useQuery<GroupSummary[]>({
    queryKey: ["groups-list"],
    queryFn: async () => {
      const r = await apiFetch("/groups");
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  async function deleteGroup(id: number) {
    if (!confirm(s.deleteConfirm)) return;
    await apiFetch(`/groups/${id}`, { method: "DELETE" });
    toast({ title: s.deleted });
    qc.invalidateQueries({ queryKey: ["groups-list"] });
    refetch();
  }

  const fillPct = (g: GroupSummary) => Math.min(100, Math.round((g.studentCount / (g.capacity || 1)) * 100));

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{s.title}</h2>
          <p className="text-muted-foreground text-sm mt-1">{s.subtitle}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="rounded-xl shadow-lg shadow-primary/20 shrink-0">
          <Plus className="w-4 h-4 me-2" />{s.addBtn}
        </Button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1,2,3].map(i => <div key={i} className="h-64 bg-muted rounded-2xl animate-pulse" />)}
        </div>
      )}

      {!isLoading && groups.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
          <Calendar className="w-12 h-12 text-muted" />
          <p>{s.noGroups}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {groups.map(g => {
          const pct = fillPct(g);
          const isOpen = g.status === "open";
          return (
            <div key={g.id} className="bg-card rounded-2xl border border-border/60 shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group/card">
              {/* Status bar */}
              <div className={`h-1.5 ${isOpen ? "bg-green-500" : "bg-muted-foreground/40"}`} />

              <div className="p-5 flex-1 flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg text-foreground leading-tight truncate">{g.name}</h3>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isOpen ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                        {isOpen ? s.open : s.closed}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                        {g.trainingType === "physical" ? s.physical : s.online}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                    <button
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      onClick={() => setEditGroup(g)}
                    ><Edit className="w-3.5 h-3.5" /></button>
                    <button
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      onClick={() => deleteGroup(g.id)}
                    ><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                {/* Date */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4 text-primary shrink-0" />
                  {g.startDate ? format(new Date(g.startDate), "dd / MM / yyyy") : "—"}
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { val: g.studentCount,   label: s.total,     cls: "bg-blue-50 text-blue-700" },
                    { val: g.confirmedCount, label: s.confirmed, cls: "bg-indigo-50 text-indigo-700" },
                    { val: g.paidCount,      label: s.paid,      cls: "bg-emerald-50 text-emerald-700" },
                    { val: g.absentCount,    label: s.absent,    cls: "bg-red-50 text-red-700" },
                  ].map(({ val, label, cls }) => (
                    <div key={label} className={`rounded-xl p-2 ${cls}`}>
                      <div className="text-xl font-bold leading-none">{val}</div>
                      <div className="text-xs mt-0.5 font-medium">{label}</div>
                    </div>
                  ))}
                </div>

                {/* Fill bar */}
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{s.fill}</span>
                    <span className="font-semibold">{pct}% · {g.studentCount}/{g.capacity}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-orange-500" : "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Open button */}
                <Button
                  className="w-full mt-auto rounded-xl gap-2"
                  onClick={() => onSelect(g.id)}
                >
                  <Users className="w-4 h-4" />
                  {s.openBtn}
                  <ChevronRight className="w-4 h-4 ms-auto" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <GroupFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["groups-list"] }); refetch(); toast({ title: s.created }); }}
        lang={lang}
      />

      <GroupFormDialog
        open={!!editGroup}
        group={editGroup ?? undefined}
        onClose={() => setEditGroup(null)}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["groups-list"] }); refetch(); setEditGroup(null); toast({ title: s.updated }); }}
        lang={lang}
      />
    </AdminLayout>
  );
}

// ─── Group Detail View ────────────────────────────────────────────────────────

function GroupDetailView({ groupId, onBack }: { groupId: number; onBack: () => void }) {
  const { lang } = useI18n();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const s = lang === "ar"
    ? { back: "← الجداول", total: "إجمالي الطلاب", confirmed: "مؤكدون", paid: "دفعوا", absent: "غائبون", fill: "الامتلاء", physical: "حضوري", online: "عن بعد", open: "مفتوح", closed: "مغلق", editBtn: "تعديل", addStudentBtn: "إضافة طالب", deleteConfirm: "حذف هذه الدورة؟", deleted: "تم الحذف", updated: "تم التحديث ✅", noStudents: "لا يوجد طلاب في هذه الدورة بعد.", colName: "الاسم", colPhone: "الهاتف", colCity: "المدينة", colStage: "الحالة", colPayment: "الدفع", colActions: "إجراءات" }
    : { back: "← Plannings", total: "Total", confirmed: "Confirmés", paid: "Payés", absent: "Absents", fill: "Remplissage", physical: "Présentiel", online: "En ligne", open: "Ouvert", closed: "Fermé", editBtn: "Modifier", addStudentBtn: "Ajouter apprenant", deleteConfirm: "Supprimer cette session?", deleted: "Session supprimée", updated: "Mis à jour ✅", noStudents: "Aucun apprenant dans cette session.", colName: "Nom", colPhone: "Téléphone", colCity: "Ville", colStage: "Statut", colPayment: "Paiement", colActions: "Actions" };

  const { data: group, isLoading, refetch } = useQuery<GroupDetail>({
    queryKey: ["group-detail", groupId],
    queryFn: async () => {
      const r = await apiFetch(`/groups/${groupId}`);
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    },
    refetchInterval: 30_000,
    staleTime: 5_000,
  });

  const fillPct = group ? Math.min(100, Math.round((group.studentCount / (group.capacity || 1)) * 100)) : 0;

  return (
    <AdminLayout>
      {isLoading && (
        <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}

      {group && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              {s.back}
            </button>

            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-2xl font-bold text-foreground">{group.name}</h2>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${group.status === "open" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                    {group.status === "open" ? s.open : s.closed}
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                    {group.trainingType === "physical" ? s.physical : s.online}
                  </span>
                </div>
                {group.startDate && (
                  <p className="text-muted-foreground text-sm mt-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {format(new Date(group.startDate), "EEEE, dd MMMM yyyy")}
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setEditOpen(true)}>
                  <Edit className="w-4 h-4 me-1.5" />{s.editBtn}
                </Button>
                <Button size="sm" className="rounded-xl" onClick={() => setAddOpen(true)}>
                  <UserPlus className="w-4 h-4 me-1.5" />{s.addStudentBtn}
                </Button>
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: s.total,     val: group.studentCount,   cls: "bg-blue-50 text-blue-700 border-blue-100" },
              { label: s.confirmed, val: group.confirmedCount, cls: "bg-indigo-50 text-indigo-700 border-indigo-100" },
              { label: s.paid,      val: group.paidCount,      cls: "bg-emerald-50 text-emerald-700 border-emerald-100" },
              { label: s.absent,    val: group.absentCount,    cls: "bg-red-50 text-red-700 border-red-100" },
              { label: s.fill,      val: `${fillPct}%`,        cls: "bg-orange-50 text-orange-700 border-orange-100" },
            ].map(({ label, val, cls }) => (
              <div key={label} className={`rounded-xl border p-3 text-center ${cls}`}>
                <div className="text-2xl font-bold leading-none">{val}</div>
                <div className="text-xs mt-1 font-medium opacity-80">{label}</div>
              </div>
            ))}
          </div>

          {/* Students table */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-semibold">{s.colName}</TableHead>
                    <TableHead className="font-semibold">{s.colPhone}</TableHead>
                    <TableHead className="font-semibold hidden sm:table-cell">{s.colCity}</TableHead>
                    <TableHead className="font-semibold">{s.colStage}</TableHead>
                    <TableHead className="font-semibold hidden md:table-cell">{s.colPayment}</TableHead>
                    <TableHead className="font-semibold text-center">{s.colActions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.students.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Users className="w-10 h-10 text-muted" />
                          <p className="text-sm">{s.noStudents}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : group.students.map(student => (
                    <StudentRow
                      key={student.id}
                      student={student}
                      lang={lang}
                      onUpdated={() => {
                        qc.invalidateQueries({ queryKey: ["group-detail", groupId] });
                        qc.invalidateQueries({ queryKey: ["groups-list"] });
                        refetch();
                      }}
                      toast={toast}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      <GroupFormDialog
        open={editOpen}
        group={group}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["group-detail", groupId] });
          qc.invalidateQueries({ queryKey: ["groups-list"] });
          setEditOpen(false);
          refetch();
          toast({ title: s.updated });
        }}
        lang={lang}
      />

      <AddStudentDialog
        open={addOpen}
        groupId={groupId}
        existingIds={group?.students.map(s => s.id) ?? []}
        onClose={() => setAddOpen(false)}
        onAdded={() => {
          qc.invalidateQueries({ queryKey: ["group-detail", groupId] });
          qc.invalidateQueries({ queryKey: ["groups-list"] });
          refetch();
        }}
        lang={lang}
        toast={toast}
      />
    </AdminLayout>
  );
}

// ─── Student Row ──────────────────────────────────────────────────────────────

function StudentRow({ student, lang, onUpdated, toast }: {
  student: GroupStudent;
  lang: string;
  onUpdated: () => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteVal, setNoteVal]         = useState(student.note ?? "");
  const [stagePending, setStagePending] = useState(false);
  const [payPending, setPayPending]     = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const fullName  = `${student.firstName} ${student.lastName}`;
  const waPhone   = toIntlPhone(student.whatsapp || student.phone);
  const waMsg     = buildWaMsg(fullName, student.stage);
  const waUrl     = `https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}`;

  const paymentCycles: Record<string, string> = { unpaid: "deposited", deposited: "paid", paid: "paid" };
  const paymentLabels: Record<string, { ar: string; cls: string }> = {
    unpaid:    { ar: "غير مدفوع",  cls: "bg-red-100 text-red-700" },
    deposited: { ar: "عربون",      cls: "bg-yellow-100 text-yellow-700" },
    paid:      { ar: "مدفوع ✅",   cls: "bg-emerald-100 text-emerald-700" },
  };
  const payLbl = paymentLabels[student.paymentStatus] ?? paymentLabels.unpaid;

  const si = stageInfo(student.stage);

  async function changeStage(newStage: string) {
    if (newStage === student.stage) return;
    setStagePending(true);
    try {
      const r = await apiFetch(`/students/${student.id}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ stage: newStage }),
      });
      if (!r.ok) throw new Error();
      onUpdated();
    } catch {
      toast({ title: lang === "ar" ? "خطأ في تغيير الحالة" : "Erreur", variant: "destructive" });
    } finally { setStagePending(false); }
  }

  async function cyclePayment() {
    const next = paymentCycles[student.paymentStatus] ?? "deposited";
    if (next === student.paymentStatus) return;
    setPayPending(true);
    try {
      const r = await apiFetch(`/students/${student.id}`, {
        method: "PATCH",
        body: JSON.stringify({ paymentStatus: next }),
      });
      if (!r.ok) throw new Error();
      onUpdated();
    } catch {
      toast({ title: lang === "ar" ? "خطأ في تحديث الدفع" : "Erreur", variant: "destructive" });
    } finally { setPayPending(false); }
  }

  async function saveNote() {
    if (noteVal === (student.note ?? "")) { setEditingNote(false); return; }
    try {
      const r = await apiFetch(`/students/${student.id}`, {
        method: "PATCH",
        body: JSON.stringify({ note: noteVal || null }),
      });
      if (!r.ok) throw new Error();
      onUpdated();
    } catch {
      toast({ title: lang === "ar" ? "خطأ في حفظ الملاحظة" : "Erreur", variant: "destructive" });
    } finally { setEditingNote(false); }
  }

  return (
    <TableRow className="hover:bg-muted/30 transition-colors group/row">
      {/* Name */}
      <TableCell>
        <Link
          href={`/gab-c7x2p/students/${student.id}`}
          className="font-semibold text-foreground hover:text-primary hover:underline flex items-center gap-1"
        >
          {fullName}
          <ExternalLink className="w-3 h-3 opacity-0 group-hover/row:opacity-60 transition-opacity" />
        </Link>
        <div className="text-xs text-muted-foreground mt-0.5">{student.city}</div>
      </TableCell>

      {/* Phone */}
      <TableCell className="text-sm text-muted-foreground font-mono">{student.phone}</TableCell>

      {/* City (hidden mobile) */}
      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{student.city}</TableCell>

      {/* Stage dropdown */}
      <TableCell>
        <Select value={student.stage} onValueChange={changeStage} disabled={stagePending}>
          <SelectTrigger className={`h-8 text-xs font-medium border rounded-lg px-2 min-w-32 ${si.cls}`}>
            {stagePending ? <Loader2 className="w-3 h-3 animate-spin" /> : <SelectValue />}
          </SelectTrigger>
          <SelectContent>
            {ALL_STAGES.map(st => (
              <SelectItem key={st.value} value={st.value}>
                <span className={`text-xs px-1.5 py-0.5 rounded ${st.cls}`}>
                  {lang === "ar" ? st.ar : st.fr}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* Payment cycling (hidden mobile) */}
      <TableCell className="hidden md:table-cell">
        <button
          onClick={cyclePayment}
          disabled={payPending || student.paymentStatus === "paid"}
          className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all hover:opacity-80 disabled:cursor-default ${payLbl.cls}`}
          title={lang === "ar" ? "انقر للتغيير" : "Cliquer pour changer"}
        >
          {payPending ? "..." : payLbl.ar}
        </button>
      </TableCell>

      {/* Actions */}
      <TableCell>
        <div className="flex items-center gap-1 justify-center">
          {/* Note toggle */}
          <button
            className={`p-1.5 rounded-lg transition-colors ${student.note || editingNote ? "text-amber-500 bg-amber-50" : "text-muted-foreground hover:text-amber-500 hover:bg-amber-50"}`}
            onClick={() => { setEditingNote(v => !v); setTimeout(() => noteRef.current?.focus(), 50); }}
            title={lang === "ar" ? "ملاحظة" : "Note"}
          >
            <StickyNote className="w-4 h-4" />
          </button>

          {/* WhatsApp */}
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-green-600 hover:bg-green-50 transition-colors"
            title="WhatsApp"
          >
            <MessageCircle className="w-4 h-4" />
          </a>

          {/* Profile link */}
          <Link
            href={`/gab-c7x2p/students/${student.id}`}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            title={lang === "ar" ? "فتح الملف" : "Voir le profil"}
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>

        {/* Inline note editor */}
        {editingNote && (
          <div className="mt-2 flex gap-1 items-end">
            <textarea
              ref={noteRef}
              value={noteVal}
              onChange={e => setNoteVal(e.target.value)}
              rows={2}
              className="flex-1 text-xs border border-amber-200 rounded-lg p-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-amber-400 bg-amber-50/50"
              placeholder={lang === "ar" ? "اكتب ملاحظة..." : "Écrire une note..."}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveNote(); } if (e.key === "Escape") setEditingNote(false); }}
            />
            <button onClick={saveNote} className="p-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600">
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

// ─── Group Form Dialog ────────────────────────────────────────────────────────

function GroupFormDialog({ open, group, onClose, onSaved, lang }: {
  open: boolean;
  group?: Partial<GroupSummary>;
  onClose: () => void;
  onSaved: () => void;
  lang: string;
}) {
  const isEdit = !!group?.id;
  const s = lang === "ar"
    ? { title: isEdit ? "تعديل الدورة" : "إضافة دورة جديدة", name: "اسم الدورة", date: "تاريخ البدء", type: "نوع التدريب", capacity: "الطاقة الاستيعابية", status: "الحالة", notes: "ملاحظات", save: isEdit ? "حفظ التغييرات" : "إنشاء", physical: "حضوري", online: "عن بعد", open: "مفتوح", closed: "مغلق", saving: "جاري الحفظ..." }
    : { title: isEdit ? "Modifier la session" : "Nouvelle session", name: "Nom", date: "Date de début", type: "Type de formation", capacity: "Capacité", status: "Statut", notes: "Notes", save: isEdit ? "Enregistrer" : "Créer", physical: "Présentiel", online: "En ligne", open: "Ouvert", closed: "Fermé", saving: "Enregistrement..." };

  const { register, handleSubmit, setValue, watch, reset } = useForm<GroupFormData>({
    defaultValues: {
      name: group?.name ?? "",
      startDate: group?.startDate ?? "",
      trainingType: group?.trainingType ?? "physical",
      capacity: group?.capacity ?? 20,
      status: group?.status ?? "open",
      notes: group?.notes ?? "",
    },
  });

  const [saving, setSaving] = useState(false);

  const onSubmit = useCallback(async (data: GroupFormData) => {
    setSaving(true);
    try {
      const url  = isEdit ? `/groups/${group!.id}` : "/groups";
      const method = isEdit ? "PATCH" : "POST";
      const r = await apiFetch(url, { method, body: JSON.stringify(data) });
      if (!r.ok) throw new Error();
      onSaved();
      reset();
    } catch {
      // silent — onSaved handles toast
    } finally { setSaving(false); }
  }, [isEdit, group, onSaved, reset]);

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) { onClose(); reset(); } }}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{s.title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>{s.name}</Label>
            <Input {...register("name", { required: true })} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>{s.date}</Label>
            <Input type="date" {...register("startDate", { required: true })} className="rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{s.type}</Label>
              <Select value={watch("trainingType")} onValueChange={v => setValue("trainingType", v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="physical">{s.physical}</SelectItem>
                  <SelectItem value="online">{s.online}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{s.capacity}</Label>
              <Input type="number" min={1} {...register("capacity", { valueAsNumber: true })} className="rounded-xl" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{s.status}</Label>
            <Select value={watch("status")} onValueChange={v => setValue("status", v)}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">{s.open}</SelectItem>
                <SelectItem value="closed">{s.closed}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{s.notes}</Label>
            <Input {...register("notes")} className="rounded-xl" />
          </div>
          <Button type="submit" className="w-full rounded-xl" disabled={saving}>
            {saving ? s.saving : s.save}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Student Dialog ───────────────────────────────────────────────────────

function AddStudentDialog({ open, groupId, existingIds, onClose, onAdded, lang, toast }: {
  open: boolean;
  groupId: number;
  existingIds: number[];
  onClose: () => void;
  onAdded: () => void;
  lang: string;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [search, setSearch] = useState("");
  const [assigning, setAssigning] = useState<number | null>(null);

  const s = lang === "ar"
    ? { title: "إضافة طالب للدورة", placeholder: "ابحث بالاسم أو الهاتف...", inGroup: "مسجل مسبقاً", add: "إضافة", added: "تمت الإضافة ✅", noResults: "لا نتائج" }
    : { title: "Ajouter un apprenant", placeholder: "Chercher par nom ou téléphone...", inGroup: "Déjà inscrit", add: "Ajouter", added: "Ajouté ✅", noResults: "Aucun résultat" };

  type RawStudent = { id: number; firstName: string; lastName: string; phone: string; city: string; stage: string };

  const { data: results = [] } = useQuery<RawStudent[]>({
    queryKey: ["student-search", search],
    queryFn: async () => {
      if (search.trim().length < 2) return [];
      const r = await apiFetch(`/students?search=${encodeURIComponent(search)}&limit=20`);
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: open && search.trim().length >= 2,
    staleTime: 5_000,
  });

  async function assignStudent(studentId: number) {
    setAssigning(studentId);
    try {
      const r = await apiFetch(`/students/${studentId}`, {
        method: "PATCH",
        body: JSON.stringify({ groupId }),
      });
      if (!r.ok) throw new Error();
      toast({ title: s.added });
      onAdded();
    } catch {
      toast({ title: lang === "ar" ? "خطأ" : "Erreur", variant: "destructive" });
    } finally { setAssigning(null); }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) { onClose(); setSearch(""); } }}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{s.title}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={s.placeholder}
              className="rounded-xl pl-9"
              autoFocus
            />
          </div>

          {search.trim().length >= 2 && results.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">{s.noResults}</p>
          )}

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {results.map(student => {
              const alreadyIn = existingIds.includes(student.id);
              const si = stageInfo(student.stage);
              return (
                <div key={student.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 hover:bg-muted/30 transition-colors">
                  <div>
                    <p className="font-medium text-sm">{student.firstName} {student.lastName}</p>
                    <p className="text-xs text-muted-foreground">{student.phone} · {student.city}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium mt-1 inline-block ${si.cls}`}>
                      {lang === "ar" ? si.ar : si.fr}
                    </span>
                  </div>
                  {alreadyIn ? (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-lg">{s.inGroup}</span>
                  ) : (
                    <Button
                      size="sm"
                      className="rounded-lg h-8"
                      disabled={assigning === student.id}
                      onClick={() => assignStudent(student.id)}
                    >
                      {assigning === student.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><UserPlus className="w-3 h-3 me-1" />{s.add}</>}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
