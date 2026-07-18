import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PermissionGuard } from "@/components/admin/PermissionGuard";
import {
  useListStudents,
  useListGroups,
  useUpdateStudent,
  useAssignStudentToGroup,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  getListStudentsQueryKey,
  getListGroupsQueryKey,
  type Student,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal, ArrowLeftCircle, GripVertical, StickyNote,
  Pencil, Trash2, Plus, Check, X, Loader2, CalendarDays, ImageIcon,
  ChevronLeft, ChevronRight, ChevronDown, Pin, EyeOff, Eye, Palette, UserPlus,
} from "lucide-react";
import { format } from "date-fns";
import { useI18n } from "@/contexts/i18n-context";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

// ─── Extended group type with new fields ──────────────────────────────────────

interface GroupWithMeta extends Group {
  position: number;
  color: string | null;
  hidden: boolean;
}

// ─── Stage configs ────────────────────────────────────────────────────────────

const STAGE_COLORS: Record<string, string> = {
  new: "bg-blue-500", contacted: "bg-yellow-500", interested: "bg-green-500",
  payment_pending: "bg-orange-400", payment_confirmed: "bg-emerald-500",
  confirmed: "bg-indigo-500", attended: "bg-teal-500",
  no_show: "bg-red-500", completed: "bg-purple-500", archived: "bg-gray-400",
};

const STAGE_PILL: Record<string, string> = {
  new:               "bg-blue-50 text-blue-700 border-blue-200",
  contacted:         "bg-yellow-50 text-yellow-700 border-yellow-200",
  interested:        "bg-green-50 text-green-700 border-green-200",
  payment_pending:   "bg-orange-50 text-orange-700 border-orange-200",
  payment_confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  confirmed:         "bg-indigo-50 text-indigo-700 border-indigo-200",
  attended:          "bg-teal-50 text-teal-700 border-teal-200",
  no_show:           "bg-red-50 text-red-700 border-red-200",
  completed:         "bg-purple-50 text-purple-700 border-purple-200",
  archived:          "bg-gray-100 text-gray-600 border-gray-200",
};

const ALL_STAGE_IDS = [
  "new","contacted","interested","payment_pending","payment_confirmed",
  "confirmed","attended","no_show","completed","archived",
] as const;

// ─── Color palette ────────────────────────────────────────────────────────────

const COLOR_OPTIONS = [
  { key: "violet",  header: "bg-violet-600",  light: "bg-violet-50",   border: "border-violet-200",  swatch: "bg-violet-500" },
  { key: "teal",    header: "bg-teal-600",    light: "bg-teal-50",     border: "border-teal-200",    swatch: "bg-teal-500" },
  { key: "indigo",  header: "bg-indigo-600",  light: "bg-indigo-50",   border: "border-indigo-200",  swatch: "bg-indigo-500" },
  { key: "rose",    header: "bg-rose-600",    light: "bg-rose-50",     border: "border-rose-200",    swatch: "bg-rose-500" },
  { key: "amber",   header: "bg-amber-600",   light: "bg-amber-50",    border: "border-amber-200",   swatch: "bg-amber-500" },
  { key: "cyan",    header: "bg-cyan-600",    light: "bg-cyan-50",     border: "border-cyan-200",    swatch: "bg-cyan-500" },
  { key: "emerald", header: "bg-emerald-600", light: "bg-emerald-50",  border: "border-emerald-200", swatch: "bg-emerald-500" },
  { key: "fuchsia", header: "bg-fuchsia-600", light: "bg-fuchsia-50",  border: "border-fuchsia-200", swatch: "bg-fuchsia-500" },
  { key: "orange",  header: "bg-orange-600",  light: "bg-orange-50",   border: "border-orange-200",  swatch: "bg-orange-500" },
  { key: "sky",     header: "bg-sky-600",     light: "bg-sky-50",      border: "border-sky-200",     swatch: "bg-sky-500" },
  { key: "lime",    header: "bg-lime-600",    light: "bg-lime-50",     border: "border-lime-200",    swatch: "bg-lime-500" },
  { key: "slate",   header: "bg-slate-600",   light: "bg-slate-50",    border: "border-slate-200",   swatch: "bg-slate-500" },
];

function colForGroup(group: GroupWithMeta, idx: number) {
  if (group.color) {
    return COLOR_OPTIONS.find(c => c.key === group.color) ?? COLOR_OPTIONS[idx % COLOR_OPTIONS.length];
  }
  return COLOR_OPTIONS[idx % COLOR_OPTIONS.length];
}

// ─── Rename input ─────────────────────────────────────────────────────────────

function RenameInput({ value, onConfirm, onCancel }: {
  value: string; onConfirm: (v: string) => void; onCancel: () => void;
}) {
  const [val, setVal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (val.trim()) onConfirm(val.trim()); }}
      className="flex items-center gap-1 flex-1"
    >
      <input
        ref={ref}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => { if (val.trim()) onConfirm(val.trim()); else onCancel(); }}
        className="flex-1 min-w-0 bg-white/20 text-white text-sm font-semibold rounded px-2 py-0.5 outline-none border border-white/40"
      />
      <button type="submit" className="text-white hover:text-green-200 flex-shrink-0">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={onCancel} className="text-white hover:text-red-200 flex-shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </form>
  );
}

// ─── Schedule Student Card ────────────────────────────────────────────────────

function ScheduleStudentCard({ student, groups, currentGroupId, onMove, onReturnToPipeline, t, dragHandleProps }: {
  student: Student;
  groups: GroupWithMeta[];
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

  const [localNote,  setLocalNote]  = useState(student.note ?? "");
  const [showNote,   setShowNote]   = useState(!!student.note);
  const [localStage, setLocalStage] = useState<string>(student.stage);
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

  function handleStageChange(newStage: string) {
    const prev = localStage;
    setLocalStage(newStage);
    fetch(`/api/students/${student.id}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ stage: newStage }),
    })
      .then(r => { if (!r.ok) throw new Error(); return qc.invalidateQueries({ queryKey: getListStudentsQueryKey() }); })
      .catch(() => { setLocalStage(prev); toast({ title: t.errorUpdating, variant: "destructive" }); });
  }

  const fullName = `${student.firstName} ${student.lastName}`;
  const others   = groups.filter((g) => g.id !== currentGroupId);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span
            {...(dragHandleProps ?? {})}
            className="text-gray-300 hover:text-gray-500 flex-shrink-0 cursor-grab active:cursor-grabbing touch-manipulation select-none"
          >
            <GripVertical className="w-4 h-4" />
          </span>
          <Link
            href={`/gab-c7x2p/students/${student.id}`}
            className="font-semibold text-sm text-gray-800 leading-tight truncate hover:text-primary hover:underline cursor-pointer"
          >
            {fullName}
          </Link>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 rounded-md hover:bg-gray-100 transition-opacity flex-shrink-0">
            <MoreHorizontal className="w-4 h-4 text-gray-500" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => onReturnToPipeline(student.id)} className="text-orange-600 font-medium">
              <ArrowLeftCircle className="w-3.5 h-3.5 mr-2" />
              {t.returnToPipeline}
            </DropdownMenuItem>
            {others.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-gray-500">{t.moveToSchedule}</DropdownMenuLabel>
                {others.map((g) => (
                  <DropdownMenuItem key={g.id} onClick={() => onMove(student.id, g.id)}>
                    <span className="w-2 h-2 rounded-full bg-violet-500 mr-2 flex-shrink-0 inline-block" />
                    {g.name}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2 mt-1.5">
        <span className="flex items-center gap-1 text-xs text-gray-500 flex-1 min-w-0">
          <span>📞</span><span className="truncate">{student.phone}</span>
        </span>
        {student.phone && (() => {
          const raw = student.phone.replace(/\s+/g, "");
          const wa  = raw.startsWith("0") ? "213" + raw.slice(1) : raw.startsWith("213") ? raw : "213" + raw;
          return (
            <a
              href={`https://wa.me/${wa}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex-shrink-0 flex items-center gap-1 text-[11px] font-semibold text-white bg-[#25D366] hover:bg-[#1ebe5d] rounded-lg px-2 py-0.5 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current flex-shrink-0" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              واتساب
            </a>
          );
        })()}
      </div>

      {/* Stage dropdown */}
      <div className="mt-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full border transition-colors w-full justify-between ${STAGE_PILL[localStage] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}
            >
              <span className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STAGE_COLORS[localStage] ?? "bg-gray-400"}`} />
                {t.stageLabels[localStage as keyof typeof t.stageLabels] ?? localStage}
              </span>
              <ChevronDown className="w-3 h-3 opacity-60 flex-shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel className="text-[10px] text-gray-400 uppercase tracking-wide">
              {lang === "fr" ? "Changer le statut" : "تغيير الحالة"}
            </DropdownMenuLabel>
            {ALL_STAGE_IDS.map(sid => (
              <DropdownMenuItem
                key={sid}
                onClick={() => handleStageChange(sid)}
                className={`text-xs ${localStage === sid ? "font-bold" : ""}`}
              >
                <span className={`w-2 h-2 rounded-full ${STAGE_COLORS[sid]} mr-2 flex-shrink-0`} />
                {t.stageLabels[sid as keyof typeof t.stageLabels] ?? sid}
                {localStage === sid && <Check className="w-3 h-3 ml-auto text-primary flex-shrink-0" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
          {student.trainingType === "online" ? t.online : t.physical}
        </span>
        {student.paymentStatus && student.paymentStatus !== "unpaid" && (
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${student.paymentStatus === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
            {student.paymentStatus === "paid" ? t.paidBadge : t.depositPaidBadge}
          </span>
        )}
      </div>

      {(student as Student & { receiptUrl?: string | null }).receiptUrl && (
        <a
          href={(student as Student & { receiptUrl?: string | null }).receiptUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 underline"
        >
          <ImageIcon className="w-3 h-3" />
          {lang === "fr" ? "Voir le reçu" : "عرض الوصل"}
        </a>
      )}

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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Groups() {
  const qc = useQueryClient();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";

  const [selectedGroupId, setSelectedGroupId] = useState<"all" | string>("all");
  const [showHidden,  setShowHidden]  = useState(false);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [modalName,   setModalName]   = useState("");
  const [renamingId,  setRenamingId]  = useState<number | null>(null);
  const [colorPickerId, setColorPickerId] = useState<number | null>(null);

  const { data: rawStudents = [], isLoading: studentsLoading } = useListStudents();
  const { data: rawGroups = [],   isLoading: groupsLoading }   = useListGroups();

  const allStudents = rawStudents as Student[];
  const groups = (rawGroups as unknown as GroupWithMeta[]).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  // Students grouped by their schedule
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

  // Unassigned students (no group) – shown in the pinned "تسجيل جديد" column
  const unassignedStudents = allStudents.filter((s) => !s.groupId);

  // Groups to display (filtered by selection + hidden toggle)
  const visibleGroups = showHidden ? groups : groups.filter(g => !g.hidden);
  const displayedGroups = selectedGroupId === "all"
    ? visibleGroups
    : visibleGroups.filter(g => String(g.id) === selectedGroupId);

  const hiddenCount = groups.filter(g => g.hidden).length;

  // ── Mutations ────────────────────────────────────────────────────────────────

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
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListGroupsQueryKey() }),
      onError:   () => toast({ title: t.errorUpdating, variant: "destructive" }),
    },
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

  // ── Group order helpers ───────────────────────────────────────────────────────

  function applyNewOrder(orderedDisplayed: GroupWithMeta[]) {
    // Merge: displayed groups in new order, non-displayed groups stay at end
    const displayedIds = new Set(orderedDisplayed.map(g => g.id));
    const rest = groups.filter(g => !displayedIds.has(g.id));
    const newAll = [...orderedDisplayed, ...rest];
    const withPositions = newAll.map((g, idx) => ({ ...g, position: idx }));

    // Optimistic update in cache
    qc.setQueryData(getListGroupsQueryKey(), withPositions);

    // Save to DB
    fetch("/api/groups/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ positions: withPositions.map((g, i) => ({ id: g.id, position: i })) }),
    }).catch(() => qc.invalidateQueries({ queryKey: getListGroupsQueryKey() }));
  }

  function handleMoveLeft(group: GroupWithMeta) {
    const idx = displayedGroups.findIndex(g => g.id === group.id);
    if (idx <= 0) return;
    const items = [...displayedGroups];
    [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]];
    applyNewOrder(items);
  }

  function handleMoveRight(group: GroupWithMeta) {
    const idx = displayedGroups.findIndex(g => g.id === group.id);
    if (idx >= displayedGroups.length - 1) return;
    const items = [...displayedGroups];
    [items[idx], items[idx + 1]] = [items[idx + 1], items[idx]];
    applyNewOrder(items);
  }

  function handlePinToStart(group: GroupWithMeta) {
    const idx = displayedGroups.findIndex(g => g.id === group.id);
    if (idx <= 0) return;
    const items = [...displayedGroups];
    items.splice(idx, 1);
    items.unshift(group);
    applyNewOrder(items);
  }

  function handleToggleHidden(group: GroupWithMeta) {
    const newHidden = !group.hidden;
    qc.setQueryData(getListGroupsQueryKey(), (old: GroupWithMeta[] | undefined) =>
      (old ?? []).map(g => g.id === group.id ? { ...g, hidden: newHidden } : g),
    );
    fetch(`/api/groups/${group.id}/visibility`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ hidden: newHidden }),
    }).catch(() => qc.invalidateQueries({ queryKey: getListGroupsQueryKey() }));
  }

  function handleColorChange(groupId: number, color: string | null) {
    qc.setQueryData(getListGroupsQueryKey(), (old: GroupWithMeta[] | undefined) =>
      (old ?? []).map(g => g.id === groupId ? { ...g, color } : g),
    );
    fetch(`/api/groups/${groupId}/color`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ color }),
    }).catch(() => qc.invalidateQueries({ queryKey: getListGroupsQueryKey() }));
    setColorPickerId(null);
  }

  // ── Other handlers ────────────────────────────────────────────────────────────

  function handleRename(group: GroupWithMeta, name: string) {
    updateGroupMutation.mutate({ id: group.id, data: { name } });
    setRenamingId(null);
  }

  function handleDelete(group: GroupWithMeta) {
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
    createMutation.mutate({
      data: { name, startDate: new Date().toISOString().slice(0, 10), trainingType: "physical", capacity: 999, status: "open" },
    });
  }

  function handleReturnToPipeline(studentId: number) {
    assignMutation.mutate({ id: studentId, data: { groupId: null } });
  }

  function handleMoveToGroup(studentId: number, groupId: number) {
    assignMutation.mutate({ id: studentId, data: { groupId } });
  }

  // ── Drag end ──────────────────────────────────────────────────────────────────

  function handleDragEnd(result: DropResult) {
    const { type, destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    if (type === "GROUP") {
      // Reorder columns
      const items = [...displayedGroups];
      const [moved] = items.splice(source.index, 1);
      items.splice(destination.index, 0, moved);
      applyNewOrder(items);
      return;
    }

    // Move student (between groups or from/to virtual unassigned column)
    const studentId = parseInt(draggableId.replace("s-", ""), 10);
    const srcId     = source.droppableId;
    const dstId     = destination.droppableId;
    if (srcId === dstId) return;

    if (dstId === "unassigned") {
      // Dragged back to unassigned column → remove group
      assignMutation.mutate({ id: studentId, data: { groupId: null } });
    } else {
      const destGroupId = parseInt(dstId, 10);
      if (!isNaN(destGroupId)) {
        assignMutation.mutate({ id: studentId, data: { groupId: destGroupId } });
      }
    }
  }

  const isLoading = studentsLoading || groupsLoading;

  const addLabel = lang === "fr" ? "Nouveau planning" : t.addSchedule;
  const allLabel = lang === "fr"
    ? `Tous les plannings (${visibleGroups.length})`
    : `كل الجداول (${visibleGroups.length})`;

  return (
    <AdminLayout>
      <PermissionGuard permission="view_groups">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {/* Group selector */}
        <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
          <SelectTrigger className="w-60 rounded-xl bg-white border-border shadow-sm font-medium">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary flex-shrink-0" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{allLabel}</SelectItem>
            {visibleGroups.map((g) => (
              <SelectItem key={g.id} value={String(g.id)}>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{g.name}</span>
                  {g.startDate && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(g.startDate), "dd/MM/yy")}
                    </span>
                  )}
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground ms-auto">
                    {(byGroup[String(g.id)] ?? []).length}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Show hidden toggle */}
        {hiddenCount > 0 && (
          <button
            onClick={() => setShowHidden(p => !p)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${showHidden ? "bg-gray-200 border-gray-300 text-gray-700" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"}`}
          >
            {showHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{lang === "fr" ? `Masqués (${hiddenCount})` : `المخفية (${hiddenCount})`}</span>
          </button>
        )}

        {/* Add schedule */}
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-orange-50 border border-orange-200 text-orange-600 hover:bg-orange-100 transition-colors"
        >
          <Plus className="w-4 h-4" />{addLabel}
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-64 text-muted-foreground">{t.loading}</div>
      )}

      {/* ── Kanban with nested DnD ── */}
      {!isLoading && (
        groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-gray-400">
            <CalendarDays className="w-12 h-12 opacity-30" />
            <p className="text-sm">{lang === "fr" ? "Aucun planning créé." : t.noStudents}</p>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors"
            >
              <Plus className="w-4 h-4" />{addLabel}
            </button>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-6 min-h-[calc(100vh-14rem)] items-start">

            {/* ── Virtual "تسجيل جديد" column – always pinned first ── */}
            {selectedGroupId === "all" && (
              <div className="flex-shrink-0 w-72 rounded-2xl overflow-hidden shadow-sm border border-orange-200 flex flex-col">
                <div className="bg-gradient-to-br from-orange-500 to-amber-500 px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-white/80 flex-shrink-0" />
                    <h3 className="text-white font-bold text-sm flex-1">
                      {lang === "fr" ? "Nouvelles inscriptions" : "تسجيل جديد"}
                    </h3>
                    <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {unassignedStudents.length}
                    </span>
                  </div>
                  <p className="text-white/60 text-[11px] mt-0.5">
                    {lang === "fr" ? "En attente d'affectation" : "بانتظار التعيين لجدول"}
                  </p>
                </div>
                <Droppable droppableId="unassigned" type="STUDENT">
                  {(uprov, usnap) => (
                    <div
                      ref={uprov.innerRef}
                      {...uprov.droppableProps}
                      className={`bg-orange-50/40 flex-1 p-3 space-y-2 overflow-y-auto max-h-[calc(100vh-18rem)] transition-colors ${usnap.isDraggingOver ? "ring-2 ring-inset ring-orange-300 bg-orange-50" : ""}`}
                    >
                      {unassignedStudents.length === 0 && !usnap.isDraggingOver && (
                        <div className="h-24 flex items-center justify-center border-2 border-dashed border-orange-200 rounded-xl">
                          <p className="text-xs text-orange-400 text-center px-2">
                            {lang === "fr" ? "Aucune inscription en attente" : "لا توجد تسجيلات جديدة"}
                          </p>
                        </div>
                      )}
                      {unassignedStudents.map((s, sIdx) => (
                        <Draggable key={s.id} draggableId={`s-${s.id}`} index={sIdx}>
                          {(sdrag, sdragSnap) => (
                            <div
                              ref={sdrag.innerRef}
                              {...sdrag.draggableProps}
                              className={sdragSnap.isDragging ? "opacity-90 rotate-1 shadow-xl" : ""}
                            >
                              <ScheduleStudentCard
                                student={s}
                                groups={groups}
                                currentGroupId={0}
                                onMove={handleMoveToGroup}
                                onReturnToPipeline={() => {}}
                                t={t}
                                dragHandleProps={sdrag.dragHandleProps as unknown as Record<string, unknown>}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {uprov.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            )}

            {/* ── Groups droppable (column reordering) ── */}
            <Droppable droppableId="all-groups" direction="horizontal" type="GROUP">
              {(outerProvided) => (
                <div
                  ref={outerProvided.innerRef}
                  {...outerProvided.droppableProps}
                  className="flex gap-4 items-start flex-shrink-0"
                >
                  {displayedGroups.map((group, idx) => {
                    const col        = colForGroup(group, idx);
                    const gs         = byGroup[String(group.id)] ?? [];
                    const isRenaming = renamingId === group.id;
                    const isFirst    = idx === 0;
                    const isLast     = idx === displayedGroups.length - 1;
                    const showingAll = selectedGroupId === "all";

                    return (
                      <Draggable
                        key={group.id}
                        draggableId={`group-${group.id}`}
                        index={idx}
                        isDragDisabled={!showingAll}
                      >
                        {(drag, dragSnap) => (
                          <div
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            className={`flex-shrink-0 w-72 rounded-2xl overflow-hidden shadow-sm border ${col.border} flex flex-col transition-opacity ${group.hidden ? "opacity-60" : ""} ${dragSnap.isDragging ? "shadow-2xl rotate-1" : ""}`}
                          >
                            {/* Column header */}
                            <div className={`${col.header} px-3 py-2.5`}>
                              <div className="flex items-center gap-1.5">
                                {/* Drag handle for the column — only visible when "all groups" shown */}
                                {showingAll && (
                                  <span
                                    {...drag.dragHandleProps}
                                    className="text-white/50 hover:text-white/90 flex-shrink-0 cursor-grab active:cursor-grabbing select-none"
                                    title={lang === "fr" ? "Déplacer" : "سحب لإعادة الترتيب"}
                                  >
                                    <GripVertical className="w-4 h-4" />
                                  </span>
                                )}

                                {isRenaming ? (
                                  <RenameInput
                                    value={group.name}
                                    onConfirm={(v) => handleRename(group, v)}
                                    onCancel={() => setRenamingId(null)}
                                  />
                                ) : (
                                  <>
                                    <h3 className="text-white font-bold text-sm truncate flex-1">{group.name}</h3>
                                    <div className="flex items-center gap-0.5 flex-shrink-0">
                                      <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full mr-0.5">
                                        {gs.length}
                                      </span>

                                      {/* Rename */}
                                      <button
                                        onClick={() => setRenamingId(group.id)}
                                        title={t.renameSchedule}
                                        className="text-white/60 hover:text-white p-0.5 rounded transition-colors"
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>

                                      {/* Color picker */}
                                      <div className="relative">
                                        <button
                                          onClick={() => setColorPickerId(colorPickerId === group.id ? null : group.id)}
                                          title={lang === "fr" ? "Couleur" : "لون الجدول"}
                                          className="text-white/60 hover:text-white p-0.5 rounded transition-colors"
                                        >
                                          <Palette className="w-3 h-3" />
                                        </button>
                                        {colorPickerId === group.id && (
                                          <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 p-2.5 z-50 flex flex-wrap gap-1.5 w-40">
                                            {COLOR_OPTIONS.map(c => (
                                              <button
                                                key={c.key}
                                                onClick={() => handleColorChange(group.id, c.key)}
                                                title={c.key}
                                                className={`w-6 h-6 rounded-full ${c.swatch} hover:scale-110 transition-transform flex-shrink-0 ${group.color === c.key ? "ring-2 ring-gray-800 ring-offset-1" : ""}`}
                                              />
                                            ))}
                                            <button
                                              onClick={() => handleColorChange(group.id, null)}
                                              title={lang === "fr" ? "Par défaut" : "افتراضي"}
                                              className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors flex items-center justify-center text-gray-500 text-[9px] flex-shrink-0"
                                            >
                                              ↩
                                            </button>
                                          </div>
                                        )}
                                      </div>

                                      {/* More actions */}
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <button className="text-white/60 hover:text-white p-0.5 rounded transition-colors">
                                            <MoreHorizontal className="w-3.5 h-3.5" />
                                          </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-52">
                                          {showingAll && (
                                            <>
                                              <DropdownMenuLabel className="text-xs text-gray-400">
                                                {lang === "fr" ? "Position" : "الترتيب"}
                                              </DropdownMenuLabel>
                                              <DropdownMenuItem
                                                onClick={() => handleMoveLeft(group)}
                                                disabled={isFirst}
                                                className={isFirst ? "opacity-40" : ""}
                                              >
                                                <ChevronLeft className="w-3.5 h-3.5 mr-2 text-gray-500" />
                                                {lang === "fr" ? "Déplacer à gauche" : "تحريك لليسار"}
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                onClick={() => handleMoveRight(group)}
                                                disabled={isLast}
                                                className={isLast ? "opacity-40" : ""}
                                              >
                                                <ChevronRight className="w-3.5 h-3.5 mr-2 text-gray-500" />
                                                {lang === "fr" ? "Déplacer à droite" : "تحريك لليمين"}
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                onClick={() => handlePinToStart(group)}
                                                disabled={isFirst}
                                                className={isFirst ? "opacity-40" : ""}
                                              >
                                                <Pin className="w-3.5 h-3.5 mr-2 text-gray-500" />
                                                {lang === "fr" ? "Épingler au début" : "تثبيت في البداية"}
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator />
                                            </>
                                          )}
                                          <DropdownMenuItem onClick={() => handleToggleHidden(group)}>
                                            {group.hidden ? (
                                              <><Eye className="w-3.5 h-3.5 mr-2 text-gray-500" />{lang === "fr" ? "Afficher" : "إظهار الجدول"}</>
                                            ) : (
                                              <><EyeOff className="w-3.5 h-3.5 mr-2 text-gray-500" />{lang === "fr" ? "Masquer" : "إخفاء الجدول"}</>
                                            )}
                                          </DropdownMenuItem>
                                          {isAdmin && (
                                            <>
                                              <DropdownMenuSeparator />
                                              <DropdownMenuItem
                                                onClick={() => handleDelete(group)}
                                                className="text-red-600"
                                              >
                                                <Trash2 className="w-3.5 h-3.5 mr-2" />
                                                {t.delete}
                                              </DropdownMenuItem>
                                            </>
                                          )}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </>
                                )}
                              </div>
                              {!isRenaming && (
                                <div className="flex items-center gap-2 mt-0.5">
                                  <p className="text-white/60 text-[11px]">
                                    {format(new Date(group.startDate || Date.now()), "dd/MM/yyyy")}
                                  </p>
                                  {group.hidden && (
                                    <span className="text-[10px] bg-white/20 text-white/80 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                      <EyeOff className="w-2.5 h-2.5" />
                                      {lang === "fr" ? "Masqué" : "مخفي"}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Student droppable */}
                            <Droppable droppableId={String(group.id)} type="STUDENT">
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
                                      {(sdrag, sdragSnap) => (
                                        <div
                                          ref={sdrag.innerRef}
                                          {...sdrag.draggableProps}
                                          className={sdragSnap.isDragging ? "opacity-90 rotate-1 shadow-xl" : ""}
                                        >
                                          <ScheduleStudentCard
                                            student={s}
                                            groups={groups}
                                            currentGroupId={group.id}
                                            onMove={handleMoveToGroup}
                                            onReturnToPipeline={handleReturnToPipeline}
                                            t={t}
                                            dragHandleProps={sdrag.dragHandleProps as unknown as Record<string, unknown>}
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
                        )}
                      </Draggable>
                    );
                  })}
                  {outerProvided.placeholder}

                  {/* Add schedule ghost column */}
                  {selectedGroupId === "all" && (
                    <div className="flex-shrink-0 w-64 self-start">
                      <button
                        onClick={() => setModalOpen(true)}
                        className="w-full rounded-2xl border-2 border-dashed border-gray-300 bg-transparent hover:border-orange-400 hover:bg-orange-50 transition-all flex items-center justify-center gap-2 px-4 py-6 text-sm font-medium text-gray-500 hover:text-orange-600 group"
                      >
                        <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />{addLabel}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </Droppable>
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
              {lang === "ar" ? "إلغاء" : "Annuler"}
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
      </PermissionGuard>
    </AdminLayout>
  );
}
