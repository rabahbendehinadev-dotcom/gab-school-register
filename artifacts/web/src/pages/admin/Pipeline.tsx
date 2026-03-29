import { useState, useRef, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  useListStudents,
  useListGroups,
  useUpdateStudentStage,
  useUpdateStudent,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useAssignStudentToGroup,
  useUploadStudentReceipt,
  getListStudentsQueryKey,
  getListGroupsQueryKey,
  type Student,
  type StudentStage,
  type Group,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Phone, MapPin, MoreHorizontal, MessageCircle, ChevronDown,
  DollarSign, CheckCircle2, Pencil, Trash2, Plus, Check, X,
  Upload, ImageIcon, Loader2, CalendarDays, ArrowLeftCircle,
  GripVertical, StickyNote,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { useI18n } from "@/contexts/i18n-context";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

// ─── Stage configs ──────────────────────────────────────────────────────────

type StageConfig = {
  id: StudentStage;
  cardBg: string; cardBorder: string; headerBg: string;
  headerText: string; badgeBg: string; dotColor: string; waBtnClass: string;
};

const STAGE_CONFIGS: StageConfig[] = [
  { id: "new",        cardBg: "bg-blue-50",   cardBorder: "border-blue-200",   headerBg: "bg-blue-600",   headerText: "text-white", badgeBg: "bg-blue-100 text-blue-700",    dotColor: "bg-blue-400",   waBtnClass: "bg-blue-500 hover:bg-blue-600" },
  { id: "contacted",  cardBg: "bg-orange-50", cardBorder: "border-orange-200", headerBg: "bg-orange-500", headerText: "text-white", badgeBg: "bg-orange-100 text-orange-700", dotColor: "bg-orange-400", waBtnClass: "bg-orange-500 hover:bg-orange-600" },
  { id: "interested", cardBg: "bg-green-50",  cardBorder: "border-green-200",  headerBg: "bg-green-600",  headerText: "text-white", badgeBg: "bg-green-100 text-green-700",   dotColor: "bg-green-400",  waBtnClass: "bg-green-500 hover:bg-green-600" },
  { id: "no_show",    cardBg: "bg-red-50",    cardBorder: "border-red-200",    headerBg: "bg-red-500",    headerText: "text-white", badgeBg: "bg-red-100 text-red-700",      dotColor: "bg-red-400",    waBtnClass: "bg-red-500 hover:bg-red-600" },
  { id: "archived",   cardBg: "bg-gray-50",   cardBorder: "border-gray-200",   headerBg: "bg-gray-500",   headerText: "text-white", badgeBg: "bg-gray-100 text-gray-600",    dotColor: "bg-gray-400",   waBtnClass: "bg-gray-500 hover:bg-gray-600" },
];

type ContactReason = "spoken" | "phone_busy" | "no_answer";
const CONTACT_REASONS: { value: ContactReason; labelAr: string; labelFr: string; emoji: string }[] = [
  { value: "spoken",     labelAr: "تم التحدث",   labelFr: "Conversation établie", emoji: "✅" },
  { value: "phone_busy", labelAr: "الهاتف مغلق", labelFr: "Téléphone éteint",     emoji: "📵" },
  { value: "no_answer",  labelAr: "لم يرد",       labelFr: "Pas de réponse",       emoji: "📞" },
];

function getWhatsAppMsg(stage: StudentStage, name: string, t: ReturnType<typeof useI18n>["t"], contactReason?: string | null): string {
  if (stage === "contacted") {
    if (contactReason === "phone_busy") return t.phoneBusyMsg(name);
    if (contactReason === "no_answer")  return t.noAnswerMsg(name);
    return t.contactedMsg(name);
  }
  switch (stage) {
    case "new":       return t.newLeadMsg(name);
    case "interested":return t.interestedMsg(name);
    case "no_show":   return t.noShowMsg(name);
    case "archived":  return t.archivedMsg(name);
    default:          return `مرحباً ${name}!`;
  }
}

function toIntlPhone(p: string): string {
  let c = p.replace(/\D/g, "");
  if (c.startsWith("0") && c.length === 10) c = "213" + c.slice(1);
  else if (c.startsWith("5") && c.length === 9) c = "213" + c;
  return c;
}

// ─── Stage student card (Pipeline view) ─────────────────────────────────────
// Only shown for students with groupId === null

function StageStudentCard({ student, cfg, t, stages, groups, onStageChange, onUpdate }: {
  student: Student;
  cfg: StageConfig;
  t: ReturnType<typeof useI18n>["t"];
  stages: StageConfig[];
  groups: Group[];
  onStageChange: (id: number, stage: StudentStage) => void;
  onUpdate: () => void;
}) {
  const { lang } = useI18n();
  const { toast } = useToast();
  const qc = useQueryClient();

  const updateMutation  = useUpdateStudent({ mutation: { onSuccess: onUpdate } });
  const assignMutation  = useAssignStudentToGroup({
    mutation: {
      onSuccess: () => { onUpdate(); qc.invalidateQueries({ queryKey: getListGroupsQueryKey() }); },
      onError: () => toast({ title: t.errorMoving, variant: "destructive" }),
    },
  });
  const createGroupMutation = useCreateGroup({
    mutation: {
      onSuccess: (newGroup) => {
        qc.invalidateQueries({ queryKey: getListGroupsQueryKey() });
        assignMutation.mutate({ id: student.id, data: { groupId: newGroup.id } });
        setShowNewGroup(false);
        setNewGroupName("");
      },
      onError: () => toast({ title: t.errorCreating, variant: "destructive" }),
    },
  });
  const uploadReceiptMutation = useUploadStudentReceipt({
    mutation: {
      onSuccess: () => { onUpdate(); toast({ title: t.receiptUploaded }); },
      onError: () => toast({ title: t.receiptError, variant: "destructive" }),
    },
  });

  const [localReason, setLocalReason]               = useState<ContactReason>((student.contactReason as ContactReason) || "spoken");
  const [localNote, setLocalNote]                   = useState(student.note ?? "");
  const [localPaymentStatus, setLocalPaymentStatus] = useState<"unpaid"|"deposited"|"paid">((student.paymentStatus as "unpaid"|"deposited"|"paid") ?? "unpaid");
  const [showNewGroup, setShowNewGroup]             = useState(false);
  const [newGroupName, setNewGroupName]             = useState("");
  const [showNote, setShowNote]                     = useState(!!student.note);
  const noteRef      = useRef<HTMLTextAreaElement>(null);
  const newGroupRef  = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (showNewGroup) newGroupRef.current?.focus(); }, [showNewGroup]);
  useEffect(() => { if (showNote && !student.note) noteRef.current?.focus(); }, [showNote]);

  const fullName      = `${student.firstName} ${student.lastName}`;
  const waMsg         = getWhatsAppMsg(student.stage as StudentStage, fullName, t, localReason);
  const isContacted   = student.stage === "contacted";
  const isInterested  = student.stage === "interested";
  const currentReason = CONTACT_REASONS.find((r) => r.value === localReason) ?? CONTACT_REASONS[0];

  function handleReasonChange(val: ContactReason) {
    setLocalReason(val);
    updateMutation.mutate({ id: student.id, data: { contactReason: val } });
  }

  function handleNoteBlur() {
    if (localNote !== (student.note ?? "")) updateMutation.mutate({ id: student.id, data: { note: localNote || null } });
  }

  function handlePaymentCycle() {
    const next: Record<string, "unpaid"|"deposited"|"paid"> = { unpaid: "deposited", deposited: "paid", paid: "paid" };
    const newStatus = next[localPaymentStatus] ?? "deposited";
    if (newStatus === localPaymentStatus) return;
    setLocalPaymentStatus(newStatus);
    updateMutation.mutate({ id: student.id, data: { paymentStatus: newStatus } });
  }

  function handleCreateAndAssign() {
    const name = newGroupName.trim();
    if (!name) return;
    createGroupMutation.mutate({
      data: { name, startDate: new Date().toISOString().slice(0, 10), trainingType: "physical", capacity: 999, status: "open" },
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadReceiptMutation.mutate({ id: student.id, data: { receipt: file } });
    e.target.value = "";
  }

  const isUploading = uploadReceiptMutation.isPending;
  const receiptUrl  = student.receiptUrl;

  return (
    <div className={`${cfg.cardBg} rounded-xl p-4 shadow-sm border ${cfg.cardBorder} hover:shadow-md transition-all group`}>

      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-bold text-sm text-gray-800">{fullName}</h4>
        <DropdownMenu>
          <DropdownMenuTrigger className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 rounded-md hover:bg-black/10 active:bg-black/20 transition-opacity touch-manipulation">
            <MoreHorizontal className="w-4 h-4 text-gray-600" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {/* Move stage */}
            <DropdownMenuLabel className="text-xs">{t.moveTo}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {stages.filter((s) => s.id !== student.stage).map((s) => (
              <DropdownMenuItem key={s.id} onClick={() => onStageChange(student.id, s.id)}>
                {t.stageLabels[s.id]}
              </DropdownMenuItem>
            ))}

            {/* Move to schedule */}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs flex items-center gap-1.5 text-orange-600">
              <CalendarDays className="w-3.5 h-3.5" />
              {t.moveToScheduleBtn}
            </DropdownMenuLabel>
            {groups.length === 0 ? (
              <DropdownMenuItem disabled className="text-gray-400 text-xs italic">
                {lang === "fr" ? "Aucun planning créé" : "لا يوجد جداول بعد"}
              </DropdownMenuItem>
            ) : groups.map((g) => (
              <DropdownMenuItem
                key={g.id}
                onClick={() => assignMutation.mutate({ id: student.id, data: { groupId: g.id } })}
              >
                <span className="w-2 h-2 rounded-full bg-violet-500 mr-2 inline-block flex-shrink-0" />
                {g.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={() => setShowNewGroup(true)}>
              <Plus className="w-3.5 h-3.5 mr-2 text-orange-500" />
              <span className="text-orange-600 font-medium">{t.addSchedule}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Info */}
      <div className="space-y-1.5 mt-2">
        <div className="flex items-center text-xs text-gray-600"><Phone className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />{student.phone}</div>
        <div className="flex items-center text-xs text-gray-600"><MapPin className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />{student.city}</div>
      </div>

      {/* Inline create-group form */}
      {showNewGroup && (
        <div className="mt-2 flex gap-1">
          <input
            ref={newGroupRef}
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateAndAssign(); if (e.key === "Escape") { setShowNewGroup(false); setNewGroupName(""); } }}
            placeholder={t.scheduleNamePlaceholder}
            className="flex-1 min-w-0 text-xs border border-orange-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
          />
          <button
            onClick={handleCreateAndAssign}
            disabled={!newGroupName.trim() || createGroupMutation.isPending}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg px-2 py-1.5 transition-colors flex-shrink-0"
          >
            {createGroupMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          </button>
          <button onClick={() => { setShowNewGroup(false); setNewGroupName(""); }} className="text-gray-400 hover:text-gray-600 rounded-lg px-1.5 py-1.5 flex-shrink-0">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Contacted extras */}
      {isContacted && (
        <div className="mt-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center justify-between gap-2 bg-white border border-orange-200 rounded-lg px-3 py-2 text-xs font-medium text-gray-700 hover:bg-orange-50 transition-colors">
                <span className="flex items-center gap-1.5">
                  <span>{currentReason.emoji}</span>
                  <span>{lang === "fr" ? currentReason.labelFr : currentReason.labelAr}</span>
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel className="text-xs text-gray-500">{lang === "fr" ? "Résultat du contact" : "نتيجة التواصل"}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {CONTACT_REASONS.map((r) => (
                <DropdownMenuItem key={r.value} onClick={() => handleReasonChange(r.value)} className={localReason === r.value ? "bg-orange-50 font-semibold" : ""}>
                  <span className="mr-2">{r.emoji}</span>
                  {lang === "fr" ? r.labelFr : r.labelAr}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Interested: payment + receipt */}
      {isInterested && (
        <div className="mt-3 space-y-2">
          {localPaymentStatus === "paid" ? (
            <div className="flex items-center justify-center gap-2 bg-green-100 text-green-700 font-semibold text-xs rounded-lg py-2 border border-green-200">
              <CheckCircle2 className="w-4 h-4" />{t.paidBadge}
            </div>
          ) : localPaymentStatus === "deposited" ? (
            <button onClick={handlePaymentCycle} className="w-full flex items-center justify-center gap-2 bg-white border-2 border-green-400 text-green-700 font-semibold text-xs rounded-lg py-2 hover:bg-green-50 transition-colors">
              <CheckCircle2 className="w-3.5 h-3.5" />{t.markPaid}
            </button>
          ) : (
            <button onClick={handlePaymentCycle} className="w-full flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-semibold text-xs rounded-lg py-2 transition-colors">
              <DollarSign className="w-3.5 h-3.5" />{t.depositPaidBadge}
            </button>
          )}

          {/* Receipt upload */}
          <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
          {receiptUrl ? (
            <div className="flex items-center gap-2">
              <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold rounded-lg py-1.5 hover:bg-blue-100 transition-colors">
                <ImageIcon className="w-3.5 h-3.5" />
                {lang === "fr" ? "Voir le reçu" : "عرض الوصل"}
              </a>
              <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
                title={t.receiptUpload}
                className="flex-shrink-0 p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors disabled:opacity-50">
                {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              </button>
            </div>
          ) : (
            <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
              className="w-full flex items-center justify-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold rounded-lg py-2 hover:bg-blue-100 transition-colors disabled:opacity-50">
              {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {isUploading ? t.uploading : t.receiptUpload}
            </button>
          )}
        </div>
      )}

      {/* no_show / archived payment badge */}
      {!isInterested && ["no_show", "archived"].includes(student.stage) && localPaymentStatus !== "unpaid" && (
        <div className="mt-3">
          {localPaymentStatus === "paid" ? (
            <div className="flex items-center justify-center gap-1.5 bg-green-100 text-green-700 text-xs font-semibold rounded-lg py-1.5 border border-green-200">
              <CheckCircle2 className="w-3.5 h-3.5" />{t.paidBadge}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-lg py-1.5 border border-yellow-200">
              <DollarSign className="w-3.5 h-3.5" />{t.depositPaidBadge}
            </div>
          )}
        </div>
      )}

      {/* ── Universal Notes section ── */}
      <div className="mt-3">
        <button
          onClick={() => setShowNote((p) => !p)}
          className={`w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg transition-colors ${showNote ? "bg-yellow-50 text-yellow-700 border border-yellow-200" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"}`}
        >
          <StickyNote className="w-3.5 h-3.5 flex-shrink-0" />
          {localNote && !showNote ? (
            <span className="truncate text-left">{localNote}</span>
          ) : (
            <span>{lang === "fr" ? "Note" : "ملاحظة"}</span>
          )}
          {localNote && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0 mr-auto" />}
        </button>
        {showNote && (
          <textarea
            ref={noteRef}
            value={localNote}
            onChange={(e) => setLocalNote(e.target.value)}
            onBlur={handleNoteBlur}
            placeholder={lang === "fr" ? "Ajouter une note..." : "أضف ملاحظة..."}
            rows={3}
            className="mt-1.5 w-full text-xs rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 resize-none placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-300 transition"
          />
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-black/10 flex justify-between items-center gap-2">
        <span className={`text-[10px] font-medium uppercase tracking-wider px-2 py-1 rounded-md ${cfg.badgeBg}`}>
          {student.trainingType === "online" ? t.online : t.physical}
        </span>
        <span className="text-[10px] text-gray-500">{format(new Date(student.createdAt), "MMM d")}</span>
      </div>

      <button
        onClick={() => window.open(`https://wa.me/${toIntlPhone(student.phone)}?text=${encodeURIComponent(waMsg)}`, "_blank")}
        className={`mt-3 w-full flex items-center justify-center gap-2 text-white text-xs font-semibold py-2 rounded-lg transition-colors ${cfg.waBtnClass}`}
      >
        <MessageCircle className="w-3.5 h-3.5" />{t.sendWhatsApp}
      </button>
    </div>
  );
}

// ─── Schedule student card (Groups/DnD view) ─────────────────────────────────
// Shows students inside a schedule column. Has "Return to Pipeline" button.

const STAGE_COLORS: Record<string, string> = {
  new: "bg-blue-500", contacted: "bg-yellow-500", interested: "bg-green-500", no_show: "bg-red-500", archived: "bg-gray-400",
};

function ScheduleStudentCard({ student, groups, currentGroupId, onMove, onReturnToPipeline, t, dragHandleProps }: {
  student: Student;
  groups: Group[];
  currentGroupId: number;
  onMove: (studentId: number, groupId: number) => void;
  onReturnToPipeline: (studentId: number) => void;
  t: ReturnType<typeof useI18n>["t"];
  dragHandleProps?: Record<string, unknown>;
}) {
  const { lang } = useI18n();
  const { toast } = useToast();
  const qc = useQueryClient();

  const updateMutation = useUpdateStudent({
    mutation: { onError: () => toast({ title: t.errorUpdating, variant: "destructive" }) },
  });

  const [localNote, setLocalNote] = useState(student.note ?? "");
  const [showNote, setShowNote]   = useState(!!student.note);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (showNote && !student.note) noteRef.current?.focus(); }, [showNote]);

  function handleNoteBlur() {
    if (localNote !== (student.note ?? "")) {
      updateMutation.mutate(
        { id: student.id, data: { note: localNote || null } },
        { onSuccess: () => qc.invalidateQueries({ queryKey: getListStudentsQueryKey() }) },
      );
    }
  }

  const stageLabel = t.stageLabels[student.stage as keyof typeof t.stageLabels] ?? student.stage;
  const stageDot   = STAGE_COLORS[student.stage] ?? "bg-gray-400";
  const fullName   = `${student.firstName} ${student.lastName}`;
  const others     = groups.filter((g) => g.id !== currentGroupId);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {/* Drag handle */}
          <span {...(dragHandleProps ?? {})} className="text-gray-300 hover:text-gray-500 flex-shrink-0 cursor-grab active:cursor-grabbing touch-manipulation select-none">
            <GripVertical className="w-4 h-4" />
          </span>
          <p className="font-semibold text-sm text-gray-800 leading-tight truncate">{fullName}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 rounded-md hover:bg-gray-100 transition-opacity flex-shrink-0">
            <MoreHorizontal className="w-4 h-4 text-gray-500" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {/* Return to pipeline */}
            <DropdownMenuItem onClick={() => onReturnToPipeline(student.id)} className="text-orange-600 font-medium">
              <ArrowLeftCircle className="w-3.5 h-3.5 mr-2" />
              {t.returnToPipeline}
            </DropdownMenuItem>

            {/* Move to another schedule */}
            {others.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-gray-500">{t.moveToSchedule}</DropdownMenuLabel>
                {others.map((g) => (
                  <DropdownMenuItem key={g.id} onClick={() => onMove(student.id, g.id)}>
                    <span className="w-2 h-2 rounded-full bg-violet-500 mr-2 flex-shrink-0 inline-block" />{g.name}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-500">
        <Phone className="w-3 h-3 flex-shrink-0" /><span>{student.phone}</span>
      </div>

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span className="flex items-center gap-1 text-[11px] font-medium text-gray-600">
          <span className={`w-1.5 h-1.5 rounded-full ${stageDot}`} />{stageLabel}
        </span>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
          {student.trainingType === "online" ? t.online : t.physical}
        </span>
        {student.paymentStatus && student.paymentStatus !== "unpaid" && (
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${student.paymentStatus === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
            {student.paymentStatus === "paid" ? t.paidBadge : t.depositPaidBadge}
          </span>
        )}
      </div>

      {/* Receipt link */}
      {student.receiptUrl && (
        <a href={student.receiptUrl} target="_blank" rel="noopener noreferrer"
          className="mt-2 flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 underline">
          <ImageIcon className="w-3 h-3" />
          {lang === "fr" ? "Voir le reçu" : "عرض الوصل"}
        </a>
      )}

      {/* ── Notes section ── */}
      <div className="mt-2">
        <button
          onClick={() => setShowNote((p) => !p)}
          className={`w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg transition-colors ${showNote ? "bg-yellow-50 text-yellow-700 border border-yellow-200" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"}`}
        >
          <StickyNote className="w-3.5 h-3.5 flex-shrink-0" />
          {localNote && !showNote ? (
            <span className="truncate text-left">{localNote}</span>
          ) : (
            <span>{lang === "fr" ? "Note" : "ملاحظة"}</span>
          )}
          {localNote && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0 mr-auto" />}
        </button>
        {showNote && (
          <textarea
            ref={noteRef}
            value={localNote}
            onChange={(e) => setLocalNote(e.target.value)}
            onBlur={handleNoteBlur}
            placeholder={lang === "fr" ? "Ajouter une note..." : "أضف ملاحظة..."}
            rows={3}
            className="mt-1.5 w-full text-xs rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 resize-none placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-300 transition select-text"
          />
        )}
      </div>
    </div>
  );
}

// ─── Rename input ─────────────────────────────────────────────────────────────

function RenameInput({ value, onConfirm, onCancel }: { value: string; onConfirm: (v: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (val.trim()) onConfirm(val.trim()); }} className="flex items-center gap-1 flex-1">
      <input ref={ref} value={val} onChange={(e) => setVal(e.target.value)}
        onBlur={() => { if (val.trim()) onConfirm(val.trim()); else onCancel(); }}
        className="flex-1 min-w-0 bg-white/20 text-white text-sm font-semibold rounded px-2 py-0.5 outline-none border border-white/40" />
      <button type="submit" className="text-white hover:text-green-200 flex-shrink-0"><Check className="w-3.5 h-3.5" /></button>
      <button type="button" onClick={onCancel} className="text-white hover:text-red-200 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
    </form>
  );
}

// ─── Column palette ───────────────────────────────────────────────────────────

const COLUMN_PALETTE = [
  { header: "bg-violet-600", light: "bg-violet-50", border: "border-violet-200" },
  { header: "bg-teal-600",   light: "bg-teal-50",   border: "border-teal-200" },
  { header: "bg-indigo-600", light: "bg-indigo-50", border: "border-indigo-200" },
  { header: "bg-rose-600",   light: "bg-rose-50",   border: "border-rose-200" },
  { header: "bg-amber-600",  light: "bg-amber-50",  border: "border-amber-200" },
  { header: "bg-cyan-600",   light: "bg-cyan-50",   border: "border-cyan-200" },
  { header: "bg-emerald-600",light: "bg-emerald-50",border: "border-emerald-200" },
  { header: "bg-fuchsia-600",light: "bg-fuchsia-50",border: "border-fuchsia-200" },
];
const colFor = (idx: number) => COLUMN_PALETTE[idx % COLUMN_PALETTE.length];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Pipeline() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();

  const [view, setView] = useState<"stages" | "groups">("stages");
  const [modalOpen, setModalOpen]   = useState(false);
  const [modalName, setModalName]   = useState("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const isAdmin = user?.role === "admin";

  const { data: allStudents = [], isLoading: studentsLoading } = useListStudents();
  const { data: groups = [],      isLoading: groupsLoading }   = useListGroups();

  // Pipeline: only students NOT assigned to any group
  const pipelineStudents = allStudents.filter((s) => !s.groupId);

  // Schedules: students grouped by their schedule
  const byGroup = (() => {
    const map: Record<string, Student[]> = {};
    groups.forEach((g) => { map[String(g.id)] = []; });
    allStudents.filter((s) => s.groupId).forEach((s) => {
      const key = String(s.groupId);
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  })();

  // Stage columns for pipeline
  const grouped = STAGE_CONFIGS.reduce((acc, cfg) => {
    acc[cfg.id] = pipelineStudents.filter((s) => s.stage === cfg.id);
    return acc;
  }, {} as Record<StudentStage, Student[]>);

  const updateStageMutation = useUpdateStudentStage({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListStudentsQueryKey() }) },
  });
  const assignMutation = useAssignStudentToGroup({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        qc.invalidateQueries({ queryKey: getListGroupsQueryKey() });
      },
      onError: () => toast({ title: t.errorMoving, variant: "destructive" }),
    },
  });
  const createMutation = useCreateGroup({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListGroupsQueryKey() });
        setModalOpen(false);
        setModalName("");
      },
      onError: () => toast({ title: t.errorCreating, variant: "destructive" }),
    },
  });
  const updateGroupMutation = useUpdateGroup({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListGroupsQueryKey() }), onError: () => toast({ title: t.errorUpdating, variant: "destructive" }) },
  });
  const deleteGroupMutation = useDeleteGroup({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListGroupsQueryKey() });
        qc.invalidateQueries({ queryKey: getListStudentsQueryKey() });
      },
      onError: () => toast({ title: t.errorDeleting, variant: "destructive" }),
    },
  });

  function handleRename(group: Group, name: string) {
    updateGroupMutation.mutate({ id: group.id, data: { name } });
    setRenamingId(null);
  }

  function handleDelete(group: Group) {
    const students = byGroup[String(group.id)] ?? [];
    if (students.length > 0) {
      toast({ title: t.cannotDeleteNonEmpty, variant: "destructive" });
      return;
    }
    if (!confirm(t.deleteScheduleConfirm(group.name))) return;
    deleteGroupMutation.mutate({ id: group.id });
  }

  function handleCreateGroup() {
    const name = modalName.trim();
    if (!name) return;
    createMutation.mutate({ data: { name, startDate: new Date().toISOString().slice(0, 10), trainingType: "physical", capacity: 999, status: "open" } });
  }

  function handleReturnToPipeline(studentId: number) {
    assignMutation.mutate({ id: studentId, data: { groupId: null } });
  }

  function handleMoveToGroup(studentId: number, groupId: number) {
    assignMutation.mutate({ id: studentId, data: { groupId } });
  }

  // ── DnD ──────────────────────────────────────────────────────────────────────
  function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const studentId = parseInt(draggableId.replace("s-", ""), 10);
    const destGroupId = parseInt(destination.droppableId, 10);
    if (isNaN(destGroupId)) return;
    if (destGroupId === parseInt(source.droppableId, 10)) return;

    assignMutation.mutate({ id: studentId, data: { groupId: destGroupId } });
  }

  const isLoading = studentsLoading || groupsLoading;

  return (
    <AdminLayout>
      {/* Tab toggle */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setView("stages")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${view === "stages" ? "bg-orange-500 text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          {t.pipeline}
          <span className="ml-2 text-xs opacity-75">({pipelineStudents.length})</span>
        </button>
        <button
          onClick={() => setView("groups")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${view === "groups" ? "bg-orange-500 text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          {t.schedules}
          <span className="ml-2 text-xs opacity-75">({groups.length})</span>
        </button>

        {/* Add schedule button — visible from both views */}
        <button
          onClick={() => setModalOpen(true)}
          className="mr-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-orange-50 border border-orange-200 text-orange-600 hover:bg-orange-100 transition-colors"
        >
          <Plus className="w-4 h-4" />{t.addSchedule}
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-64 text-muted-foreground">{t.loading}</div>
      )}

      {/* ── Pipeline / Stages view ── */}
      {!isLoading && view === "stages" && (
        <div className="flex h-[calc(100vh-10rem)] gap-4 sm:gap-5 overflow-x-auto pb-4 scrollbar-hide">
          {STAGE_CONFIGS.map((cfg) => (
            <div key={cfg.id} className="flex-shrink-0 w-72 flex flex-col rounded-2xl overflow-hidden shadow-sm border border-gray-200">
              <div className={`${cfg.headerBg} px-4 py-3 flex items-center justify-between`}>
                <h3 className={`font-bold text-sm flex items-center gap-2 ${cfg.headerText}`}>
                  <span className="w-2 h-2 rounded-full bg-white/70" />{t.stageLabels[cfg.id]}
                </h3>
                <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">{grouped[cfg.id].length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50/60">
                {grouped[cfg.id].map((student) => (
                  <StageStudentCard
                    key={student.id}
                    student={student}
                    cfg={cfg}
                    t={t}
                    stages={STAGE_CONFIGS}
                    groups={groups}
                    onStageChange={(id, stage) => updateStageMutation.mutate({ id, data: { stage } })}
                    onUpdate={() => qc.invalidateQueries({ queryKey: getListStudentsQueryKey() })}
                  />
                ))}
                {grouped[cfg.id].length === 0 && (
                  <div className="h-32 flex items-center justify-center text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-white/60">{t.empty}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Schedules / Groups view with DnD ── */}
      {!isLoading && view === "groups" && (
        groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-gray-400">
            <CalendarDays className="w-12 h-12 opacity-30" />
            <p className="text-sm">{t.noStudents}</p>
            <button onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors">
              <Plus className="w-4 h-4" />{t.addSchedule}
            </button>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-6 min-h-[calc(100vh-14rem)] items-start">
              {groups.map((group, idx) => {
                const col = colFor(idx);
                const gs  = byGroup[String(group.id)] ?? [];
                const isRenaming = renamingId === group.id;

                return (
                  <div key={group.id} className={`flex-shrink-0 w-72 rounded-2xl overflow-hidden shadow-sm border ${col.border} flex flex-col`}>
                    {/* Column header */}
                    <div className={`${col.header} px-4 py-3`}>
                      <div className="flex items-center gap-2">
                        {isRenaming ? (
                          <RenameInput value={group.name} onConfirm={(v) => handleRename(group, v)} onCancel={() => setRenamingId(null)} />
                        ) : (
                          <>
                            <h3 className="text-white font-bold text-sm truncate flex-1">{group.name}</h3>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">{gs.length}</span>
                              <button onClick={() => setRenamingId(group.id)} title={t.renameSchedule} className="text-white/70 hover:text-white transition-colors p-0.5 rounded">
                                <Pencil className="w-3 h-3" />
                              </button>
                              {isAdmin && (
                                <button onClick={() => handleDelete(group)} title={t.delete} className="text-white/70 hover:text-red-200 transition-colors p-0.5 rounded">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                      {!isRenaming && <p className="text-white/60 text-[11px] mt-0.5">{format(new Date(group.startDate || Date.now()), "dd/MM/yyyy")}</p>}
                    </div>

                    {/* Droppable column body */}
                    <Droppable droppableId={String(group.id)}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`${col.light} flex-1 p-3 space-y-2 overflow-y-auto max-h-[calc(100vh-18rem)] transition-colors ${snapshot.isDraggingOver ? "ring-2 ring-inset ring-white/50 bg-opacity-70" : ""}`}
                        >
                          {gs.length === 0 && !snapshot.isDraggingOver && (
                            <div className="h-24 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl">
                              <p className="text-xs text-gray-400 text-center px-2">{t.noStudents}</p>
                            </div>
                          )}
                          {gs.map((s, sIdx) => (
                            <Draggable key={s.id} draggableId={`s-${s.id}`} index={sIdx}>
                              {(drag, dragSnap) => (
                                <div
                                  ref={drag.innerRef}
                                  {...drag.draggableProps}
                                  className={`${dragSnap.isDragging ? "opacity-90 rotate-1 shadow-xl" : ""}`}
                                >
                                  <ScheduleStudentCard
                                    student={s}
                                    groups={groups}
                                    currentGroupId={group.id}
                                    onMove={handleMoveToGroup}
                                    onReturnToPipeline={handleReturnToPipeline}
                                    t={t}
                                    dragHandleProps={drag.dragHandleProps as Record<string, unknown>}
                                  />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}

              {/* Add schedule button column */}
              <div className="flex-shrink-0 w-64 self-start">
                <button
                  onClick={() => setModalOpen(true)}
                  className="w-full rounded-2xl border-2 border-dashed border-gray-300 bg-transparent hover:border-orange-400 hover:bg-orange-50 transition-all flex items-center justify-center gap-2 px-4 py-6 text-sm font-medium text-gray-500 hover:text-orange-600 group"
                >
                  <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />{t.addSchedule}
                </button>
              </div>
            </div>
          </DragDropContext>
        )
      )}

      {/* ── Add Schedule Modal ── */}
      <Dialog open={modalOpen} onOpenChange={(o) => { setModalOpen(o); if (!o) setModalName(""); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-orange-500" />
              {t.newScheduleTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <label className="text-sm font-medium text-gray-700 block mb-1.5">{t.scheduleNameLabel}</label>
            <input
              autoFocus
              value={modalName}
              onChange={(e) => setModalName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateGroup(); }}
              placeholder={t.scheduleNamePlaceholder}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
          </div>
          <DialogFooter className="mt-4 gap-2 flex-row">
            <button
              onClick={() => { setModalOpen(false); setModalName(""); }}
              className="flex-1 px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              {t.delete === "حذف" ? "إلغاء" : "Annuler"}
            </button>
            <button
              onClick={handleCreateGroup}
              disabled={!modalName.trim() || createMutation.isPending}
              className="flex-1 px-4 py-2 text-sm text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {t.create}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
