import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { AdminLayout } from "@/components/layout/AdminLayout";
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
  ChevronLeft, ChevronRight, Pin, EyeOff, Eye, Palette,
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

// ─── Stage dot colors ─────────────────────────────────────────────────────────

const STAGE_COLORS: Record<string, string> = {
  new: "bg-blue-500", contacted: "bg-yellow-500", interested: "bg-green-500",
  payment_pending: "bg-orange-400", payment_confirmed: "bg-emerald-500",
  confirmed: "bg-indigo-500", attended: "bg-teal-500",
  no_show: "bg-red-500", completed: "bg-purple-500", archived: "bg-gray-400",
};

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

      <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-500">
        <span>📞</span><span>{student.phone}</span>
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

    // Move student between groups
    const studentId  = parseInt(draggableId.replace("s-", ""), 10);
    const destGroupId = parseInt(destination.droppableId, 10);
    if (isNaN(destGroupId)) return;
    if (destGroupId === parseInt(source.droppableId, 10)) return;
    assignMutation.mutate({ id: studentId, data: { groupId: destGroupId } });
  }

  const isLoading = studentsLoading || groupsLoading;

  const addLabel = lang === "fr" ? "Nouveau planning" : t.addSchedule;
  const allLabel = lang === "fr"
    ? `Tous les plannings (${visibleGroups.length})`
    : `كل الجداول (${visibleGroups.length})`;

  return (
    <AdminLayout>
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
            {/* Outer droppable for column reordering */}
            <Droppable droppableId="all-groups" direction="horizontal" type="GROUP">
              {(outerProvided) => (
                <div
                  ref={outerProvided.innerRef}
                  {...outerProvided.droppableProps}
                  className="flex gap-4 overflow-x-auto pb-6 min-h-[calc(100vh-14rem)] items-start"
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
    </AdminLayout>
  );
}
