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
  getListStudentsQueryKey,
  getListGroupsQueryKey,
  type Student,
  type StudentStage,
  type Group,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Phone, MapPin, MoreHorizontal, MessageCircle, ChevronDown, DollarSign, CheckCircle2, Pencil, Trash2, Plus, Check, X } from "lucide-react";
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

// ─── Stage Kanban config ────────────────────────────────────────────────────

type StageConfig = {
  id: StudentStage;
  cardBg: string;
  cardBorder: string;
  headerBg: string;
  headerText: string;
  badgeBg: string;
  dotColor: string;
  waBtnClass: string;
};

const STAGE_CONFIGS: StageConfig[] = [
  { id: "new",       cardBg: "bg-blue-50",   cardBorder: "border-blue-200",   headerBg: "bg-blue-600",   headerText: "text-white", badgeBg: "bg-blue-100 text-blue-700",   dotColor: "bg-blue-400",   waBtnClass: "bg-blue-500 hover:bg-blue-600" },
  { id: "contacted", cardBg: "bg-orange-50", cardBorder: "border-orange-200", headerBg: "bg-orange-500", headerText: "text-white", badgeBg: "bg-orange-100 text-orange-700", dotColor: "bg-orange-400", waBtnClass: "bg-orange-500 hover:bg-orange-600" },
  { id: "interested",cardBg: "bg-green-50",  cardBorder: "border-green-200",  headerBg: "bg-green-600",  headerText: "text-white", badgeBg: "bg-green-100 text-green-700",  dotColor: "bg-green-400",  waBtnClass: "bg-green-500 hover:bg-green-600" },
  { id: "no_show",   cardBg: "bg-red-50",    cardBorder: "border-red-200",    headerBg: "bg-red-500",    headerText: "text-white", badgeBg: "bg-red-100 text-red-700",     dotColor: "bg-red-400",    waBtnClass: "bg-red-500 hover:bg-red-600" },
  { id: "archived",  cardBg: "bg-gray-50",   cardBorder: "border-gray-200",   headerBg: "bg-gray-500",   headerText: "text-white", badgeBg: "bg-gray-100 text-gray-600",   dotColor: "bg-gray-400",   waBtnClass: "bg-gray-500 hover:bg-gray-600" },
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
    if (contactReason === "no_answer") return t.noAnswerMsg(name);
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

function toIntlPhone(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  if (clean.startsWith("0") && clean.length === 10) clean = "213" + clean.slice(1);
  else if (clean.startsWith("5") && clean.length === 9) clean = "213" + clean;
  return clean;
}

function openWhatsApp(phone: string, msg: string) {
  window.open(`https://wa.me/${toIntlPhone(phone)}?text=${encodeURIComponent(msg)}`, "_blank");
}

// ─── Stage card ─────────────────────────────────────────────────────────────

function StageStudentCard({ student, cfg, t, stages, onStageChange, onUpdate }: {
  student: Student;
  cfg: StageConfig;
  t: ReturnType<typeof useI18n>["t"];
  stages: StageConfig[];
  onStageChange: (id: number, stage: StudentStage) => void;
  onUpdate: () => void;
}) {
  const { lang } = useI18n();
  const updateMutation = useUpdateStudent({ mutation: { onSuccess: onUpdate } });

  const [localReason, setLocalReason] = useState<ContactReason>((student.contactReason as ContactReason) || "spoken");
  const [localNote, setLocalNote] = useState(student.note ?? "");
  const [localPaymentStatus, setLocalPaymentStatus] = useState<"unpaid" | "deposited" | "paid">((student.paymentStatus as "unpaid" | "deposited" | "paid") ?? "unpaid");
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const fullName = `${student.firstName} ${student.lastName}`;
  const waMsg = getWhatsAppMsg(student.stage as StudentStage, fullName, t, localReason);
  const isContacted  = student.stage === "contacted";
  const isInterested = student.stage === "interested";
  const currentReason = CONTACT_REASONS.find((r) => r.value === localReason) ?? CONTACT_REASONS[0];

  function handleReasonChange(val: ContactReason) {
    setLocalReason(val);
    updateMutation.mutate({ id: student.id, data: { contactReason: val } });
  }

  function handleNoteBlur() {
    if (localNote !== (student.note ?? "")) updateMutation.mutate({ id: student.id, data: { note: localNote || null } });
  }

  function handlePaymentCycle() {
    const next: Record<string, "unpaid" | "deposited" | "paid"> = { unpaid: "deposited", deposited: "paid", paid: "paid" };
    const newStatus = next[localPaymentStatus] ?? "deposited";
    if (newStatus === localPaymentStatus) return;
    setLocalPaymentStatus(newStatus);
    updateMutation.mutate({ id: student.id, data: { paymentStatus: newStatus } });
  }

  return (
    <div className={`${cfg.cardBg} rounded-xl p-4 shadow-sm border ${cfg.cardBorder} hover:shadow-md transition-all group`}>
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-bold text-sm text-gray-800">{fullName}</h4>
        <DropdownMenu>
          <DropdownMenuTrigger className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 rounded-md hover:bg-black/10 active:bg-black/20 transition-opacity touch-manipulation">
            <MoreHorizontal className="w-4 h-4 text-gray-600" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t.moveTo}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {stages.filter((s) => s.id !== student.stage).map((s) => (
              <DropdownMenuItem key={s.id} onClick={() => onStageChange(student.id, s.id)}>
                {t.stageLabels[s.id]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-1.5 mt-2">
        <div className="flex items-center text-xs text-gray-600"><Phone className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" /> {student.phone}</div>
        <div className="flex items-center text-xs text-gray-600"><MapPin className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" /> {student.city}</div>
      </div>

      {isContacted && (
        <div className="mt-3 space-y-2">
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
          <textarea
            ref={noteRef}
            value={localNote}
            onChange={(e) => setLocalNote(e.target.value)}
            onBlur={handleNoteBlur}
            placeholder={lang === "fr" ? "Ajouter une note..." : "أضف ملاحظة..."}
            rows={2}
            className="w-full text-xs rounded-lg border border-orange-200 bg-white px-3 py-2 resize-none placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-300 transition"
          />
        </div>
      )}

      {isInterested && (
        <div className="mt-3">
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
        </div>
      )}

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

      <div className="mt-3 pt-3 border-t border-black/10 flex justify-between items-center gap-2">
        <span className={`text-[10px] font-medium uppercase tracking-wider px-2 py-1 rounded-md ${cfg.badgeBg}`}>
          {student.trainingType === "online" ? t.online : t.physical}
        </span>
        <span className="text-[10px] text-gray-500">{format(new Date(student.createdAt), "MMM d")}</span>
      </div>

      <button onClick={() => openWhatsApp(student.phone, waMsg)} className={`mt-3 w-full flex items-center justify-center gap-2 text-white text-xs font-semibold py-2 rounded-lg transition-colors ${cfg.waBtnClass}`}>
        <MessageCircle className="w-3.5 h-3.5" />{t.sendWhatsApp}
      </button>
    </div>
  );
}

// ─── Groups Kanban helpers ───────────────────────────────────────────────────

const STAGE_COLORS: Record<string, string> = {
  new: "bg-blue-500", contacted: "bg-yellow-500", interested: "bg-green-500", no_show: "bg-red-500", archived: "bg-gray-400",
};

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
const UNASSIGNED_COL = { header: "bg-gray-500", light: "bg-gray-50", border: "border-gray-200" };
const colFor = (idx: number) => COLUMN_PALETTE[idx % COLUMN_PALETTE.length];

function GroupStudentCard({ student, groups, currentGroupId, onMove, t }: {
  student: Student;
  groups: Group[];
  currentGroupId: number | null;
  onMove: (studentId: number, groupId: number | null) => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const stageLabel = t.stageLabels[student.stage as keyof typeof t.stageLabels] ?? student.stage;
  const stageDot = STAGE_COLORS[student.stage] ?? "bg-gray-400";
  const fullName = `${student.firstName} ${student.lastName}`;
  const otherGroups = groups.filter((g) => g.id !== currentGroupId);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-sm text-gray-800 leading-tight">{fullName}</p>
        <DropdownMenu>
          <DropdownMenuTrigger className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 rounded-md hover:bg-gray-100 transition-opacity flex-shrink-0">
            <MoreHorizontal className="w-4 h-4 text-gray-500" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs text-gray-500">{t.moveToSchedule}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {currentGroupId !== null && (
              <DropdownMenuItem onClick={() => onMove(student.id, null)}>
                <span className="w-2 h-2 rounded-full bg-gray-400 mr-2 flex-shrink-0 inline-block" />
                {t.noSchedule}
              </DropdownMenuItem>
            )}
            {otherGroups.map((g) => (
              <DropdownMenuItem key={g.id} onClick={() => onMove(student.id, g.id)}>
                <span className="w-2 h-2 rounded-full bg-violet-500 mr-2 flex-shrink-0 inline-block" />
                {g.name}
              </DropdownMenuItem>
            ))}
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
      </div>
    </div>
  );
}

function RenameInput({ value, onConfirm, onCancel }: { value: string; onConfirm: (v: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (val.trim()) onConfirm(val.trim()); }} className="flex items-center gap-1">
      <input
        ref={ref}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => { if (val.trim()) onConfirm(val.trim()); else onCancel(); }}
        className="flex-1 min-w-0 bg-white/20 text-white text-sm font-semibold rounded px-2 py-0.5 outline-none border border-white/40"
      />
      <button type="submit" className="text-white hover:text-green-200"><Check className="w-3.5 h-3.5" /></button>
      <button type="button" onClick={onCancel} className="text-white hover:text-red-200"><X className="w-3.5 h-3.5" /></button>
    </form>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Pipeline() {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();

  const [view, setView] = useState<"stages" | "groups">("stages");

  // Stage view data
  const { data: students, isLoading: stagesLoading } = useListStudents();
  const updateStageMutation = useUpdateStudentStage({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() }) },
  });

  // Groups view data
  const { data: groups = [], isLoading: gLoading } = useListGroups();
  const { data: allStudents = [], isLoading: sLoading } = useListStudents();

  const assignMutation = useAssignStudentToGroup({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() });
      },
      onError: () => toast({ title: t.errorMoving, variant: "destructive" }),
    },
  });

  const createMutation = useCreateGroup({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() });
        setAddingNew(false);
        setNewName("");
      },
      onError: () => toast({ title: t.errorCreating, variant: "destructive" }),
    },
  });

  const updateGroupMutation = useUpdateGroup({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() }),
      onError: () => toast({ title: t.errorUpdating, variant: "destructive" }),
    },
  });

  const deleteGroupMutation = useDeleteGroup({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
      },
      onError: () => toast({ title: t.errorDeleting, variant: "destructive" }),
    },
  });

  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const newInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = user?.role === "admin";

  // Stage view handlers
  const grouped = STAGE_CONFIGS.reduce((acc, cfg) => {
    acc[cfg.id] = students?.filter((s) => s.stage === cfg.id) || [];
    return acc;
  }, {} as Record<StudentStage, Student[]>);

  // Groups view handlers
  const byGroup = (() => {
    const map: Record<string, Student[]> = { unassigned: [] };
    groups.forEach((g) => { map[String(g.id)] = []; });
    allStudents.forEach((s) => {
      const key = s.groupId ? String(s.groupId) : "unassigned";
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  })();

  function handleMove(studentId: number, groupId: number | null) {
    assignMutation.mutate({ id: studentId, data: { groupId } });
  }

  function handleRename(group: Group, newNameVal: string) {
    updateGroupMutation.mutate({ id: group.id, data: { name: newNameVal } });
    setRenamingId(null);
  }

  function handleDelete(group: Group) {
    if (!confirm(t.deleteScheduleConfirm(group.name))) return;
    deleteGroupMutation.mutate({ id: group.id });
  }

  function handleCreateGroup(name: string) {
    if (!name.trim()) return;
    createMutation.mutate({
      data: { name: name.trim(), startDate: new Date().toISOString().slice(0, 10), trainingType: "physical", capacity: 999, status: "open" },
    });
  }

  const groupsLoading = gLoading || sLoading;

  return (
    <AdminLayout>
      {/* Tab toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setView("stages")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${view === "stages" ? "bg-orange-500 text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          {t.pipeline}
        </button>
        <button
          onClick={() => setView("groups")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${view === "groups" ? "bg-orange-500 text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          {t.schedules}
        </button>
      </div>

      {/* ── Stages view ── */}
      {view === "stages" && (
        stagesLoading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">{t.loading}</div>
        ) : (
          <div className="flex h-[calc(100vh-10rem)] gap-4 sm:gap-5 overflow-x-auto pb-4 scrollbar-hide">
            {STAGE_CONFIGS.map((cfg) => (
              <div key={cfg.id} className="flex-shrink-0 w-72 flex flex-col rounded-2xl overflow-hidden shadow-sm border border-gray-200">
                <div className={`${cfg.headerBg} px-4 py-3 flex items-center justify-between`}>
                  <h3 className={`font-bold text-sm flex items-center gap-2 ${cfg.headerText}`}>
                    <span className="w-2 h-2 rounded-full bg-white/70" />
                    {t.stageLabels[cfg.id]}
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
                      onStageChange={(id, stage) => updateStageMutation.mutate({ id, data: { stage } })}
                      onUpdate={() => queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() })}
                    />
                  ))}
                  {grouped[cfg.id].length === 0 && (
                    <div className="h-32 flex items-center justify-center text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-white/60">{t.empty}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Groups/Schedules view ── */}
      {view === "groups" && (
        groupsLoading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">{t.loading}</div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-6 min-h-[calc(100vh-14rem)] items-start">
            {/* Unassigned column */}
            <div className="flex-shrink-0 w-72 rounded-2xl overflow-hidden shadow-sm border border-gray-200 flex flex-col">
              <div className={`${UNASSIGNED_COL.header} px-4 py-3 flex items-center justify-between`}>
                <h3 className="text-white font-bold text-sm truncate">{t.noSchedule}</h3>
                <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">{byGroup.unassigned?.length ?? 0}</span>
              </div>
              <div className={`${UNASSIGNED_COL.light} flex-1 p-3 space-y-2 overflow-y-auto max-h-[calc(100vh-18rem)]`}>
                {(byGroup.unassigned ?? []).length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">{t.noStudents}</p>
                ) : (
                  (byGroup.unassigned ?? []).map((s) => (
                    <GroupStudentCard key={s.id} student={s} groups={groups} currentGroupId={null} onMove={handleMove} t={t} />
                  ))
                )}
              </div>
            </div>

            {/* Group columns */}
            {groups.map((group, idx) => {
              const col = colFor(idx);
              const groupStudents = byGroup[String(group.id)] ?? [];
              const isRenaming = renamingId === group.id;
              return (
                <div key={group.id} className={`flex-shrink-0 w-72 rounded-2xl overflow-hidden shadow-sm border ${col.border} flex flex-col`}>
                  <div className={`${col.header} px-4 py-3`}>
                    <div className="flex items-center justify-between gap-2">
                      {isRenaming ? (
                        <RenameInput value={group.name} onConfirm={(v) => handleRename(group, v)} onCancel={() => setRenamingId(null)} />
                      ) : (
                        <>
                          <h3 className="text-white font-bold text-sm truncate flex-1">{group.name}</h3>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">{groupStudents.length}</span>
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
                    {!isRenaming && <p className="text-white/70 text-[11px] mt-0.5 capitalize">{group.status}</p>}
                  </div>
                  <div className={`${col.light} flex-1 p-3 space-y-2 overflow-y-auto max-h-[calc(100vh-18rem)]`}>
                    {groupStudents.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">{t.noStudents}</p>
                    ) : (
                      groupStudents.map((s) => (
                        <GroupStudentCard key={s.id} student={s} groups={groups} currentGroupId={group.id} onMove={handleMove} t={t} />
                      ))
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add new group */}
            <div className="flex-shrink-0 w-64">
              {addingNew ? (
                <div className="rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50 p-4">
                  <p className="text-sm font-semibold text-orange-800 mb-2">{t.scheduleNameLabel}</p>
                  <form onSubmit={(e) => { e.preventDefault(); handleCreateGroup(newName); }}>
                    <input
                      ref={newInputRef}
                      autoFocus
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder={t.scheduleNamePlaceholder}
                      className="w-full border border-orange-300 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 mb-2"
                    />
                    <div className="flex gap-2">
                      <button type="submit" disabled={!newName.trim() || createMutation.isPending} className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg transition-colors">
                        {createMutation.isPending ? "..." : t.create}
                      </button>
                      <button type="button" onClick={() => { setAddingNew(false); setNewName(""); }} className="px-3 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <button onClick={() => setAddingNew(true)} className="w-full rounded-2xl border-2 border-dashed border-gray-300 bg-transparent hover:border-orange-400 hover:bg-orange-50 transition-all flex items-center justify-center gap-2 px-4 py-6 text-sm font-medium text-gray-500 hover:text-orange-600 group">
                  <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  {t.addSchedule}
                </button>
              )}
            </div>
          </div>
        )
      )}
    </AdminLayout>
  );
}
