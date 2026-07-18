import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PermissionGuard } from "@/components/admin/PermissionGuard";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/contexts/i18n-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowRight, Phone, MessageCircle, MapPin, Home, GraduationCap, Clock,
  User, History, StickyNote, CalendarCheck, DollarSign, Check, X, Plus,
  PhoneCall, Loader2, Send, AlertTriangle,
} from "lucide-react";

interface Student {
  id: number; firstName: string; lastName: string; phone: string; whatsapp: string;
  city: string; trainingType: string; housingNeeded: boolean; experienceLevel: string;
  note: string | null; contactReason: string | null; depositPaid: boolean;
  paymentStatus: string; receiptUrl: string | null; stage: string; groupId: number | null;
  source: string; agreedPrice: number | null; nextFollowupAt: string | null;
  lastContactedAt: string | null; contactAttempts: number; createdAt: string;
}
interface Note { id: number; content: string; createdBy: string | null; createdAt: string }
interface AttendanceRow { id: number; dayNumber: number; present: boolean; markedBy: string | null }
interface TimelineItem { kind: string; icon: string; text: string; by: string | null; at: string }
interface Payment { id: number; amount: number; method: string; type: string; note: string | null; recordedBy: string | null; createdAt: string }
interface PaymentsResponse { payments: Payment[]; totalPaid: number; agreedPrice: number | null; remaining: number | null }
interface Owner { staffId: number; fullName: string; assignedAt: string }
interface Viewer { staffId: number; fullName: string }
interface StaffMember { id: number; fullName: string; role: string; username: string }
interface CallResult { id: number; studentId: number; staffId: number; staffName: string | null; clickedAt: string; result: string | null; durationSeconds: number | null; note: string | null; nextFollowupAt: string | null; source: string; createdAt: string }

const STAGES: { value: string; ar: string; fr: string; color: string }[] = [
  { value: "new", ar: "جديد", fr: "Nouveau", color: "bg-blue-100 text-blue-700" },
  { value: "contacted", ar: "تم الاتصال", fr: "Contacté", color: "bg-orange-100 text-orange-700" },
  { value: "interested", ar: "مهتم", fr: "Intéressé", color: "bg-green-100 text-green-700" },
  { value: "no_show", ar: "لم يحضر", fr: "Absent", color: "bg-red-100 text-red-700" },
  { value: "archived", ar: "مؤرشف", fr: "Archivé", color: "bg-gray-100 text-gray-600" },
];

const PAY_STATUS: Record<string, { ar: string; fr: string; color: string }> = {
  unpaid: { ar: "غير مدفوع", fr: "Impayé", color: "bg-red-100 text-red-700" },
  deposited: { ar: "عربون مدفوع", fr: "Acompte", color: "bg-amber-100 text-amber-700" },
  paid: { ar: "مدفوع بالكامل", fr: "Payé", color: "bg-green-100 text-green-700" },
};

const CALL_RESULTS: { value: string; ar: string; fr: string; icon: string; color: string }[] = [
  { value: "answered", ar: "تم الرد", fr: "Répondu", icon: "✅", color: "bg-green-50 border-green-400 text-green-700" },
  { value: "no_answer", ar: "لا يرد", fr: "Pas de réponse", icon: "❌", color: "bg-red-50 border-red-400 text-red-700" },
  { value: "busy", ar: "مشغول", fr: "Occupé", icon: "⚠️", color: "bg-amber-50 border-amber-400 text-amber-700" },
  { value: "wrong_number", ar: "رقم خاطئ", fr: "Mauvais n°", icon: "🚫", color: "bg-gray-50 border-gray-400 text-gray-700" },
  { value: "callback", ar: "طلب معاودة", fr: "Rappel demandé", icon: "🔄", color: "bg-blue-50 border-blue-400 text-blue-700" },
  { value: "not_attempted", ar: "لم تتم", fr: "Non tentée", icon: "—", color: "bg-gray-50 border-gray-300 text-gray-500" },
];

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" }, credentials: "include", ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

function waLink(num: string) {
  let d = num.replace(/\D/g, "");
  if (d.startsWith("0")) d = "213" + d.slice(1);
  return `https://wa.me/${d}`;
}

type Tab = "info" | "timeline" | "notes" | "attendance" | "payments";

export default function StudentProfile() {
  const [, params] = useRoute("/gab-c7x2p/students/:id");
  const [, navigate] = useLocation();
  const { lang } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isFr = lang === "fr";
  const id = params?.id ? Number(params.id) : null;
  const [tab, setTab] = useState<Tab>("info");

  const perms = user?.permissions ?? [];
  const canEdit = perms.includes("edit_students");
  const canCall = perms.includes("call_students");
  const canWhatsapp = perms.includes("open_whatsapp");
  const canContact = perms.includes("contact_students");
  const canAddNotes = perms.includes("add_notes");
  const canPayments = perms.includes("view_payments");
  const canAssign = perms.includes("assign_students");

  // Call result modal state
  const [pendingCallId, setPendingCallId] = useState<number | null>(null);
  const [callResultValue, setCallResultValue] = useState<string>("");
  const [callDuration, setCallDuration] = useState<string>("");
  const [callNote, setCallNote] = useState<string>("");
  const [callNextFollowup, setCallNextFollowup] = useState<string>("");
  const callStartRef = useRef<number | null>(null);

  // Owner dialog state
  const [showOwnerDialog, setShowOwnerDialog] = useState(false);

  const studentKey = ["student", id];
  const invalidateErp = () => {
    qc.invalidateQueries({ queryKey: ["/api/students"] });
    qc.invalidateQueries({ queryKey: ["/api/stats"] });
    qc.invalidateQueries({ queryKey: ["stats-erp"] });
    qc.invalidateQueries({ queryKey: ["stats-financials"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const { data: student, isLoading } = useQuery<Student>({
    queryKey: studentKey, queryFn: () => apiFetch(`/students/${id}`), enabled: !!id,
  });

  const { data: viewersData } = useQuery<{ viewers: Viewer[] }>({
    queryKey: ["viewers", id],
    queryFn: () => apiFetch(`/students/${id}/viewers`),
    enabled: !!id,
    refetchInterval: 20_000,
  });

  const { data: owner, refetch: refetchOwner } = useQuery<Owner | null>({
    queryKey: ["owner", id],
    queryFn: () => apiFetch(`/students/${id}/owner`),
    enabled: !!id,
  });

  const { data: staffList = [] } = useQuery<StaffMember[]>({
    queryKey: ["staff-list"],
    queryFn: () => apiFetch("/staff"),
    enabled: showOwnerDialog,
  });

  const stageMutation = useMutation({
    mutationFn: (stage: string) => apiFetch(`/students/${id}/stage`, { method: "PATCH", body: JSON.stringify({ stage }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: studentKey }); qc.invalidateQueries({ queryKey: ["timeline", id] }); invalidateErp(); toast({ title: isFr ? "Étape mise à jour" : "تم تحديث المرحلة" }); },
  });

  const contactMutation = useMutation({
    mutationFn: () => apiFetch(`/students/${id}/followup`, { method: "PATCH", body: JSON.stringify({ incrementAttempt: true }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: studentKey }); qc.invalidateQueries({ queryKey: ["timeline", id] }); invalidateErp(); toast({ title: isFr ? "Contact enregistré" : "تم تسجيل التواصل" }); },
  });

  const callAttemptMutation = useMutation({
    mutationFn: () => apiFetch(`/students/${id}/call-attempt`, { method: "POST" }),
    onSuccess: (data: CallResult) => {
      callStartRef.current = Date.now();
      setPendingCallId(data.id);
      setCallResultValue("");
      setCallDuration("");
      setCallNote("");
      setCallNextFollowup("");
      qc.invalidateQueries({ queryKey: ["timeline", id] });
    },
    onError: () => toast({ title: isFr ? "Erreur" : "خطأ", variant: "destructive" }),
  });

  const callResultMutation = useMutation({
    mutationFn: ({ callId, result, durationSeconds, note, nextFollowupAt }: {
      callId: number; result: string; durationSeconds?: number | null; note?: string | null; nextFollowupAt?: string | null;
    }) => apiFetch(`/students/${id}/call-result/${callId}`, {
      method: "POST",
      body: JSON.stringify({ result, durationSeconds: durationSeconds ?? null, note: note ?? null, nextFollowupAt: nextFollowupAt ? new Date(nextFollowupAt) : null }),
    }),
    onSuccess: () => {
      setPendingCallId(null);
      qc.invalidateQueries({ queryKey: ["timeline", id] });
      qc.invalidateQueries({ queryKey: ["call-results", id] });
      qc.invalidateQueries({ queryKey: studentKey });
      invalidateErp();
      toast({ title: isFr ? "Résultat enregistré" : "تم تسجيل نتيجة المكالمة" });
    },
    onError: () => toast({ title: isFr ? "Erreur" : "خطأ", variant: "destructive" }),
  });

  const assignOwnerMutation = useMutation({
    mutationFn: (staffId: number) => apiFetch(`/students/${id}/owner`, { method: "POST", body: JSON.stringify({ staffId }) }),
    onSuccess: () => {
      setShowOwnerDialog(false);
      refetchOwner();
      qc.invalidateQueries({ queryKey: ["timeline", id] });
      toast({ title: isFr ? "Responsable assigné" : "تم تعيين المسؤول" });
    },
    onError: () => toast({ title: isFr ? "Erreur" : "خطأ", variant: "destructive" }),
  });

  const handleCallClick = () => {
    if (!id) return;
    callAttemptMutation.mutate();
    window.open(`tel:${student?.phone}`, "_self");
  };

  const handleWaClick = () => {
    if (!id || !student) return;
    fetch("/api/log/action", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionType: "whatsapp_click", studentId: id }) }).catch(() => {});
  };

  const submitCallResult = () => {
    if (!pendingCallId || !callResultValue) return;
    const elapsedSec = callStartRef.current ? Math.round((Date.now() - callStartRef.current) / 1000) : null;
    const durationSec = callDuration ? parseInt(callDuration, 10) : elapsedSec;
    callResultMutation.mutate({
      callId: pendingCallId,
      result: callResultValue,
      durationSeconds: durationSec && durationSec > 0 ? durationSec : null,
      note: callNote.trim() || null,
      nextFollowupAt: callNextFollowup || null,
    });
  };

  const viewers = viewersData?.viewers ?? [];

  if (!id) return <AdminLayout><div className="p-8 text-center">Invalid student</div></AdminLayout>;
  if (isLoading) return <AdminLayout><div className="p-8 text-center text-muted-foreground animate-pulse">{isFr ? "Chargement..." : "جاري التحميل..."}</div></AdminLayout>;
  if (!student) return (
    <AdminLayout>
      <div className="p-8 text-center space-y-3">
        <p className="text-muted-foreground">{isFr ? "Étudiant introuvable" : "الطالب غير موجود"}</p>
        <Button variant="outline" onClick={() => navigate("/gab-c7x2p/students")} className="rounded-xl">{isFr ? "Retour" : "رجوع"}</Button>
      </div>
    </AdminLayout>
  );

  const stageMeta = STAGES.find((s) => s.value === student.stage);
  const payMeta = PAY_STATUS[student.paymentStatus] ?? PAY_STATUS.unpaid;

  const allTabs: { key: Tab; ar: string; fr: string; icon: typeof User; perm?: string }[] = [
    { key: "info", ar: "المعلومات", fr: "Infos", icon: User },
    { key: "timeline", ar: "السجل", fr: "Historique", icon: History },
    { key: "notes", ar: "الملاحظات", fr: "Notes", icon: StickyNote, perm: "add_notes" },
    { key: "attendance", ar: "الحضور", fr: "Présence", icon: CalendarCheck, perm: "edit_students" },
    { key: "payments", ar: "المدفوعات", fr: "Paiements", icon: DollarSign, perm: "view_payments" },
  ];
  const tabs = allTabs.filter(tb => !tb.perm || perms.includes(tb.perm));

  return (
    <AdminLayout>
      <PermissionGuard permission="view_students">
      <div dir={isFr ? "ltr" : "rtl"} className="space-y-5 max-w-4xl mx-auto">

        {/* Back button */}
        <button onClick={() => navigate("/gab-c7x2p/students")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowRight className={`w-4 h-4 ${isFr ? "rotate-180" : ""}`} />{isFr ? "Tous les étudiants" : "كل الطلاب"}
        </button>

        {/* Concurrent viewers warning */}
        {viewers.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-800 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              {isFr
                ? `${viewers.length} autre(s) collaborateur(s) consultent ce profil en ce moment : ${viewers.map(v => v.fullName).join("، ")}`
                : `${viewers.length > 1 ? "عدة موظفين يشاهدون" : "موظف آخر يشاهد"} هذا الملف الآن: ${viewers.map(v => v.fullName).join("، ")}`}
            </span>
          </div>
        )}

        {/* Header card */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-xl font-bold">
                {student.firstName[0]}{student.lastName[0]}
              </div>
              <div>
                <h1 className="text-2xl font-bold">{student.firstName} {student.lastName}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {stageMeta && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${stageMeta.color}`}>{isFr ? stageMeta.fr : stageMeta.ar}</span>}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${payMeta.color}`}>{isFr ? payMeta.fr : payMeta.ar}</span>
                  <span className="text-xs text-muted-foreground">{student.contactAttempts} {isFr ? "tentatives" : "محاولة تواصل"}</span>
                </div>
                {/* Primary Owner chip */}
                <div className="flex items-center gap-1.5 mt-1.5">
                  {owner ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                      👤 {isFr ? "Responsable:" : "المسؤول:"} {owner.fullName}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      👤 {isFr ? "Sans responsable" : "بدون مسؤول"}
                    </span>
                  )}
                  {canAssign && (
                    <button onClick={() => setShowOwnerDialog(true)} className="text-xs text-primary hover:underline">
                      {isFr ? "Changer" : "تغيير"}
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {canCall && (
                <button
                  onClick={handleCallClick}
                  disabled={callAttemptMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100 transition-colors disabled:opacity-60"
                >
                  {callAttemptMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                  {isFr ? "Appeler" : "اتصال"}
                </button>
              )}
              {canWhatsapp && (
                <a
                  href={waLink(student.whatsapp)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={handleWaClick}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-50 text-green-700 text-sm font-semibold hover:bg-green-100 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />WhatsApp
                </a>
              )}
              {canContact && (
                <Button onClick={() => contactMutation.mutate()} disabled={contactMutation.isPending} variant="outline" className="rounded-xl">
                  <PhoneCall className="w-4 h-4 mr-1" />{isFr ? "Suivi" : "تسجيل تواصل"}
                </Button>
              )}
            </div>
          </div>

          {/* Stage quick switch */}
          {canEdit && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50 flex-wrap">
              <span className="text-xs font-semibold text-muted-foreground">{isFr ? "Changer l'étape:" : "تغيير المرحلة:"}</span>
              {STAGES.map((s) => (
                <button key={s.value} onClick={() => stageMutation.mutate(s.value)} disabled={s.value === student.stage || stageMutation.isPending}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-all ${s.value === student.stage ? s.color + " ring-2 ring-offset-1 ring-current" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
                  {isFr ? s.fr : s.ar}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl overflow-x-auto">
          {tabs.map((tb) => {
            const Icon = tb.icon;
            return (
              <button key={tb.key} onClick={() => setTab(tb.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${tab === tb.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                <Icon className="w-4 h-4" />{isFr ? tb.fr : tb.ar}
              </button>
            );
          })}
        </div>

        {tab === "info" && <InfoTab student={student} isFr={isFr} />}
        {tab === "timeline" && <TimelineTab id={id} isFr={isFr} />}
        {tab === "notes" && <NotesTab id={id} isFr={isFr} />}
        {tab === "attendance" && <AttendanceTab id={id} isFr={isFr} />}
        {tab === "payments" && <PaymentsTab id={id} isFr={isFr} />}
      </div>

      {/* Owner assign dialog */}
      {showOwnerDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowOwnerDialog(false)}>
          <div dir={isFr ? "ltr" : "rtl"} className="bg-card rounded-2xl border border-border shadow-xl p-5 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-base">{isFr ? "Assigner un responsable" : "تعيين مسؤول"}</h3>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {staffList.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground animate-pulse">...</div>
              ) : staffList.map((s) => (
                <button
                  key={s.id}
                  onClick={() => assignOwnerMutation.mutate(s.id)}
                  disabled={assignOwnerMutation.isPending}
                  className={`w-full text-start px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${owner?.staffId === s.id ? "bg-violet-100 text-violet-700" : "hover:bg-muted"}`}
                >
                  <span className="font-semibold">{s.fullName}</span>
                  <span className="text-xs text-muted-foreground ms-2">{s.role}</span>
                  {owner?.staffId === s.id && <span className="text-xs ms-1">{isFr ? "(actuel)" : "(الحالي)"}</span>}
                </button>
              ))}
            </div>
            <Button variant="outline" className="w-full rounded-xl" onClick={() => setShowOwnerDialog(false)}>{isFr ? "Annuler" : "إلغاء"}</Button>
          </div>
        </div>
      )}

      {/* Call result modal — mandatory after call click */}
      {pendingCallId !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center p-4">
          <div dir={isFr ? "ltr" : "rtl"} className="bg-card rounded-2xl border border-border shadow-xl p-5 w-full max-w-sm space-y-4">
            <div>
              <h3 className="font-bold text-base">{isFr ? "Résultat de l'appel" : "نتيجة المكالمة"}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{isFr ? "Veuillez indiquer le résultat avant de continuer" : "يرجى تحديد نتيجة المكالمة قبل المتابعة"}</p>
            </div>

            {/* Result radio buttons */}
            <div className="grid grid-cols-2 gap-2">
              {CALL_RESULTS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setCallResultValue(r.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${callResultValue === r.value ? r.color + " border-current" : "border-border hover:bg-muted"}`}
                >
                  <span>{r.icon}</span>
                  <span>{isFr ? r.fr : r.ar}</span>
                </button>
              ))}
            </div>

            {/* Optional fields */}
            <div className="space-y-2">
              <Input
                type="number"
                value={callDuration}
                onChange={(e) => setCallDuration(e.target.value)}
                placeholder={isFr ? "Durée (secondes) — optionnel" : "المدة بالثواني (اختياري)"}
                className="rounded-xl text-sm"
                min="0"
              />
              <Input
                value={callNote}
                onChange={(e) => setCallNote(e.target.value)}
                placeholder={isFr ? "Note — optionnel" : "ملاحظة (اختياري)"}
                className="rounded-xl text-sm"
              />
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{isFr ? "Prochain suivi (optionnel)" : "الموعد التالي للمتابعة (اختياري)"}</label>
                <Input
                  type="datetime-local"
                  value={callNextFollowup}
                  onChange={(e) => setCallNextFollowup(e.target.value)}
                  className="rounded-xl text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1 rounded-xl"
                disabled={!callResultValue || callResultMutation.isPending}
                onClick={submitCallResult}
              >
                {callResultMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (isFr ? "Enregistrer" : "حفظ")}
              </Button>
            </div>
          </div>
        </div>
      )}

      </PermissionGuard>
    </AdminLayout>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0">
      <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <span className="text-sm text-muted-foreground w-32 flex-shrink-0">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function InfoTab({ student, isFr }: { student: Student; isFr: boolean }) {
  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5">
      <InfoRow icon={Phone} label={isFr ? "Téléphone" : "الهاتف"} value={student.phone} />
      <InfoRow icon={MessageCircle} label="WhatsApp" value={student.whatsapp} />
      <InfoRow icon={MapPin} label={isFr ? "Ville" : "المدينة"} value={student.city} />
      <InfoRow icon={GraduationCap} label={isFr ? "Niveau" : "المستوى"} value={student.experienceLevel} />
      <InfoRow icon={Home} label={isFr ? "Hébergement" : "السكن"} value={student.housingNeeded ? (isFr ? "Oui" : "نعم") : (isFr ? "Non" : "لا")} />
      <InfoRow icon={User} label={isFr ? "Type" : "نوع التدريب"} value={student.trainingType} />
      <InfoRow icon={Clock} label={isFr ? "Source" : "المصدر"} value={student.source} />
      {student.agreedPrice != null && <InfoRow icon={DollarSign} label={isFr ? "Prix convenu" : "السعر المتفق"} value={`${student.agreedPrice} DZD`} />}
      {student.contactReason && <InfoRow icon={StickyNote} label={isFr ? "Raison" : "سبب التواصل"} value={student.contactReason} />}
      {student.note && (
        <div className="mt-3 p-3 bg-muted/40 rounded-xl">
          <p className="text-xs text-muted-foreground mb-1">{isFr ? "Note initiale" : "ملاحظة أولية"}</p>
          <p className="text-sm">{student.note}</p>
        </div>
      )}
    </div>
  );
}

const TIMELINE_ICONS: Record<string, string> = {
  call_click: "📞",
  call_result: "📞",
  whatsapp_click: "💬",
  owner_assigned: "👤",
  note_added: "📝",
  attendance_marked: "✅",
  payment: "💰",
  contact_logged: "📞",
  stage_changed: "🔀",
};

function TimelineTab({ id, isFr }: { id: number; isFr: boolean }) {
  const { data: items = [], isLoading } = useQuery<TimelineItem[]>({ queryKey: ["timeline", id], queryFn: () => apiFetch(`/students/${id}/timeline`) });
  if (isLoading) return <div className="py-10 text-center text-muted-foreground animate-pulse">...</div>;
  if (items.length === 0) return <div className="py-10 text-center text-muted-foreground text-sm">{isFr ? "Aucun historique" : "لا يوجد سجل"}</div>;
  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 space-y-1">
      {items.map((it, i) => {
        const icon = TIMELINE_ICONS[it.kind] ?? it.icon ?? "📌";
        return (
          <div key={i} className="flex items-start gap-3 py-2.5 border-b border-border/30 last:border-0">
            <span className="text-lg flex-shrink-0">{icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm">{it.text}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(it.at).toLocaleString(isFr ? "fr-FR" : "ar-DZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                {it.by && ` — ${it.by}`}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NotesTab({ id, isFr }: { id: number; isFr: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const { data: notes = [], isLoading } = useQuery<Note[]>({ queryKey: ["notes", id], queryFn: () => apiFetch(`/students/${id}/notes`) });
  const addMutation = useMutation({
    mutationFn: () => apiFetch(`/students/${id}/notes`, { method: "POST", body: JSON.stringify({ content: content.trim() }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notes", id] }); qc.invalidateQueries({ queryKey: ["timeline", id] }); setContent(""); toast({ title: isFr ? "Note ajoutée" : "تمت إضافة الملاحظة" }); },
  });
  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 space-y-4">
      <div className="flex gap-2">
        <Input value={content} onChange={(e) => setContent(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && content.trim()) addMutation.mutate(); }}
          placeholder={isFr ? "Ajouter une note..." : "أضف ملاحظة..."} className="rounded-xl" />
        <Button onClick={() => addMutation.mutate()} disabled={!content.trim() || addMutation.isPending} className="rounded-xl">
          {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        </Button>
      </div>
      {isLoading ? <div className="py-6 text-center text-muted-foreground animate-pulse">...</div> :
        notes.length === 0 ? <div className="py-6 text-center text-muted-foreground text-sm">{isFr ? "Aucune note" : "لا توجد ملاحظات"}</div> :
        <div className="space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="p-3 bg-muted/40 rounded-xl">
              <p className="text-sm">{n.content}</p>
              <p className="text-xs text-muted-foreground mt-1">{n.createdBy} — {new Date(n.createdAt).toLocaleString(isFr ? "fr-FR" : "ar-DZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
            </div>
          ))}
        </div>}
    </div>
  );
}

function AttendanceTab({ id, isFr }: { id: number; isFr: boolean }) {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery<AttendanceRow[]>({ queryKey: ["attendance", id], queryFn: () => apiFetch(`/students/${id}/attendance`) });
  const setMutation = useMutation({
    mutationFn: ({ dayNumber, present }: { dayNumber: number; present: boolean }) => apiFetch(`/students/${id}/attendance`, { method: "PUT", body: JSON.stringify({ dayNumber, present }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attendance", id] }); qc.invalidateQueries({ queryKey: ["timeline", id] }); },
  });
  const byDay = new Map(rows.map((r) => [r.dayNumber, r]));
  const presentCount = rows.filter((r) => r.present).length;
  if (isLoading) return <div className="py-10 text-center text-muted-foreground animate-pulse">...</div>;
  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-sm">{isFr ? "Formation 5 jours" : "التدريب المكثف (5 أيام)"}</h3>
        <span className="text-sm font-semibold text-primary">{presentCount}/5</span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((day) => {
          const row = byDay.get(day);
          const present = row?.present ?? false;
          return (
            <div key={day} className="text-center">
              <p className="text-xs text-muted-foreground mb-1.5">{isFr ? "Jour" : "اليوم"} {day}</p>
              <button onClick={() => setMutation.mutate({ dayNumber: day, present: !present })} disabled={setMutation.isPending}
                className={`w-full aspect-square rounded-xl flex items-center justify-center transition-all ${present ? "bg-green-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
                {present ? <Check className="w-6 h-6" /> : <X className="w-5 h-5 opacity-40" />}
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-3 text-center">{isFr ? "Cliquez pour marquer présent/absent" : "اضغط لتسجيل الحضور/الغياب"}</p>
    </div>
  );
}

function PaymentsTab({ id, isFr }: { id: number; isFr: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [type, setType] = useState("installment");
  const { data, isLoading } = useQuery<PaymentsResponse>({ queryKey: ["payments", id], queryFn: () => apiFetch(`/students/${id}/payments`) });
  const addMutation = useMutation({
    mutationFn: () => apiFetch(`/students/${id}/payments`, { method: "POST", body: JSON.stringify({ amount: Number(amount), method, type }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payments", id] }); qc.invalidateQueries({ queryKey: ["student", id] }); qc.invalidateQueries({ queryKey: ["timeline", id] }); qc.invalidateQueries({ queryKey: ["/api/students"] }); qc.invalidateQueries({ queryKey: ["/api/stats"] }); qc.invalidateQueries({ queryKey: ["stats-erp"] }); qc.invalidateQueries({ queryKey: ["stats-financials"] }); qc.invalidateQueries({ queryKey: ["notifications"] }); setAmount(""); toast({ title: isFr ? "Paiement enregistré" : "تم تسجيل الدفعة" }); },
    onError: () => toast({ title: isFr ? "Erreur" : "خطأ", variant: "destructive" }),
  });
  const METHODS = [["cash", isFr ? "Espèces" : "نقداً"], ["ccp", "CCP"], ["baridimob", "BaridiMob"], ["bank", isFr ? "Banque" : "بنك"], ["other", isFr ? "Autre" : "أخرى"]];
  const TYPES = [["deposit", isFr ? "Acompte" : "عربون"], ["installment", isFr ? "Versement" : "قسط"], ["full", isFr ? "Total" : "كامل"]];

  if (isLoading) return <div className="py-10 text-center text-muted-foreground animate-pulse">...</div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 rounded-2xl p-4 text-center"><p className="text-xs text-green-700 mb-1">{isFr ? "Payé" : "المدفوع"}</p><p className="text-lg font-bold text-green-700">{data?.totalPaid ?? 0}</p></div>
        <div className="bg-blue-50 rounded-2xl p-4 text-center"><p className="text-xs text-blue-700 mb-1">{isFr ? "Convenu" : "المتفق"}</p><p className="text-lg font-bold text-blue-700">{data?.agreedPrice ?? "—"}</p></div>
        <div className="bg-amber-50 rounded-2xl p-4 text-center"><p className="text-xs text-amber-700 mb-1">{isFr ? "Restant" : "المتبقي"}</p><p className="text-lg font-bold text-amber-700">{data?.remaining ?? "—"}</p></div>
      </div>
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-4 space-y-3">
        <h3 className="font-bold text-sm">{isFr ? "Enregistrer un paiement" : "تسجيل دفعة"}</h3>
        <div className="flex gap-2 flex-wrap">
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={isFr ? "Montant (DZD)" : "المبلغ (دج)"} className="rounded-xl flex-1 min-w-[120px]" />
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded-xl border border-border bg-background px-3 text-sm">
            {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-xl border border-border bg-background px-3 text-sm">
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <Button onClick={() => addMutation.mutate()} disabled={!amount || Number(amount) <= 0 || addMutation.isPending} className="rounded-xl">
            {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-4">
        {!data?.payments.length ? <div className="py-6 text-center text-muted-foreground text-sm">{isFr ? "Aucun paiement" : "لا توجد مدفوعات"}</div> :
          <div className="space-y-2">
            {data.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                <div>
                  <p className="text-sm font-semibold">{p.amount} DZD <span className="text-xs font-normal text-muted-foreground">({TYPES.find((t) => t[0] === p.type)?.[1] ?? p.type})</span></p>
                  <p className="text-xs text-muted-foreground">{METHODS.find((m) => m[0] === p.method)?.[1] ?? p.method} — {new Date(p.createdAt).toLocaleDateString(isFr ? "fr-FR" : "ar-DZ")}{p.recordedBy ? ` — ${p.recordedBy}` : ""}</p>
                </div>
              </div>
            ))}
          </div>}
      </div>
    </div>
  );
}
