import { useState, useRef, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  useListStudents,
  useListGroups,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useAssignStudentToGroup,
  getListStudentsQueryKey,
  getListGroupsQueryKey,
  type Student,
  type Group,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/contexts/i18n-context";
import { MoreHorizontal, Pencil, Trash2, Plus, Check, X, Phone } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

const STAGE_COLORS: Record<string, string> = {
  new: "bg-blue-500",
  contacted: "bg-yellow-500",
  interested: "bg-green-500",
  no_show: "bg-red-500",
  archived: "bg-gray-400",
};

const STAGE_LABELS_AR: Record<string, string> = {
  new: "جديد",
  contacted: "تم التواصل",
  interested: "مهتم",
  no_show: "لم يحضر",
  archived: "مؤرشف",
};
const STAGE_LABELS_FR: Record<string, string> = {
  new: "Nouveau",
  contacted: "Contacté",
  interested: "Intéressé",
  no_show: "Absent",
  archived: "Archivé",
};

const COLUMN_PALETTE = [
  { header: "bg-violet-600", light: "bg-violet-50", border: "border-violet-200", badge: "bg-violet-100 text-violet-700" },
  { header: "bg-teal-600",   light: "bg-teal-50",   border: "border-teal-200",   badge: "bg-teal-100 text-teal-700" },
  { header: "bg-indigo-600", light: "bg-indigo-50", border: "border-indigo-200", badge: "bg-indigo-100 text-indigo-700" },
  { header: "bg-rose-600",   light: "bg-rose-50",   border: "border-rose-200",   badge: "bg-rose-100 text-rose-700" },
  { header: "bg-amber-600",  light: "bg-amber-50",  border: "border-amber-200",  badge: "bg-amber-100 text-amber-700" },
  { header: "bg-cyan-600",   light: "bg-cyan-50",   border: "border-cyan-200",   badge: "bg-cyan-100 text-cyan-700" },
  { header: "bg-emerald-600",light: "bg-emerald-50",border: "border-emerald-200",badge: "bg-emerald-100 text-emerald-700" },
  { header: "bg-fuchsia-600",light: "bg-fuchsia-50",border: "border-fuchsia-200",badge: "bg-fuchsia-100 text-fuchsia-700" },
];

const UNASSIGNED_COL = {
  header: "bg-gray-500",
  light: "bg-gray-50",
  border: "border-gray-200",
  badge: "bg-gray-100 text-gray-600",
};

function colFor(idx: number) {
  return COLUMN_PALETTE[idx % COLUMN_PALETTE.length];
}

function StudentCard({
  student,
  groups,
  currentGroupId,
  lang,
  onMove,
  t,
}: {
  student: Student;
  groups: Group[];
  currentGroupId: number | null;
  lang: string;
  onMove: (studentId: number, groupId: number | null) => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const stageLabel = lang === "fr"
    ? (STAGE_LABELS_FR[student.stage] ?? student.stage)
    : (STAGE_LABELS_AR[student.stage] ?? student.stage);
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
        <Phone className="w-3 h-3 flex-shrink-0" />
        <span>{student.phone}</span>
      </div>

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span className="flex items-center gap-1 text-[11px] font-medium text-gray-600">
          <span className={`w-1.5 h-1.5 rounded-full ${stageDot}`} />
          {stageLabel}
        </span>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
          {student.trainingType === "online" ? (lang === "fr" ? "En ligne" : "أونلاين") : (lang === "fr" ? "Présentiel" : "حضوري")}
        </span>
      </div>
    </div>
  );
}

function RenameInput({
  value,
  onConfirm,
  onCancel,
}: {
  value: string;
  onConfirm: (v: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (val.trim()) onConfirm(val.trim());
      }}
      className="flex items-center gap-1"
    >
      <input
        ref={ref}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => { if (val.trim()) onConfirm(val.trim()); else onCancel(); }}
        className="flex-1 min-w-0 bg-white/20 text-white text-sm font-semibold rounded px-2 py-0.5 outline-none border border-white/40 placeholder:text-white/60"
      />
      <button type="submit" className="text-white hover:text-green-200">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={onCancel} className="text-white hover:text-red-200">
        <X className="w-3.5 h-3.5" />
      </button>
    </form>
  );
}

export default function Schedules() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: groups = [], isLoading: gLoading } = useListGroups();
  const { data: allStudents = [], isLoading: sLoading } = useListStudents();

  const assignMutation = useAssignStudentToGroup({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        qc.invalidateQueries({ queryKey: getListGroupsQueryKey() });
      },
      onError: () => toast({ title: lang === "fr" ? "Erreur de déplacement" : "خطأ في النقل", variant: "destructive" }),
    },
  });

  const createMutation = useCreateGroup({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListGroupsQueryKey() });
        setAddingNew(false);
        setNewName("");
      },
      onError: () => toast({ title: lang === "fr" ? "Erreur de création" : "خطأ في الإنشاء", variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateGroup({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListGroupsQueryKey() }),
      onError: () => toast({ title: lang === "fr" ? "Erreur de mise à jour" : "خطأ في التعديل", variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteGroup({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListGroupsQueryKey() });
        qc.invalidateQueries({ queryKey: getListStudentsQueryKey() });
      },
      onError: () => toast({ title: lang === "fr" ? "Erreur de suppression" : "خطأ في الحذف", variant: "destructive" }),
    },
  });

  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const newInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === "admin";

  function handleMove(studentId: number, groupId: number | null) {
    assignMutation.mutate({ id: studentId, data: { groupId } });
  }

  function handleRename(group: Group, newNameVal: string) {
    updateMutation.mutate({ id: group.id, data: { name: newNameVal } });
    setRenamingId(null);
  }

  function handleDelete(group: Group) {
    if (!confirm(lang === "fr"
      ? `Supprimer le planning "${group.name}" ? Les étudiants seront déplacés vers "Sans planning".`
      : `حذف الجدول "${group.name}"؟ سيتم نقل الطلاب إلى "بدون جدول".`
    )) return;
    deleteMutation.mutate({ id: group.id });
  }

  function handleCreateGroup(name: string) {
    if (!name.trim()) return;
    createMutation.mutate({
      data: {
        name: name.trim(),
        startDate: new Date().toISOString().slice(0, 10),
        trainingType: "physical",
        capacity: 999,
        status: "open",
      },
    });
  }

  const studentsByGroup = (students: Student[]) => {
    const map: Record<string, Student[]> = { unassigned: [] };
    groups.forEach((g) => { map[String(g.id)] = []; });
    students.forEach((s) => {
      const key = s.groupId ? String(s.groupId) : "unassigned";
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  };

  const byGroup = studentsByGroup(allStudents);
  const isLoading = gLoading || sLoading;

  return (
    <AdminLayout>
      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          {lang === "fr" ? "Chargement..." : "جاري التحميل..."}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-6 min-h-[calc(100vh-12rem)] items-start">

          {/* Unassigned column */}
          <div className="flex-shrink-0 w-72 rounded-2xl overflow-hidden shadow-sm border border-gray-200 flex flex-col">
            <div className={`${UNASSIGNED_COL.header} px-4 py-3 flex items-center justify-between`}>
              <h3 className="text-white font-bold text-sm truncate">{t.noSchedule}</h3>
              <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {byGroup.unassigned?.length ?? 0}
              </span>
            </div>
            <div className={`${UNASSIGNED_COL.light} flex-1 p-3 space-y-2 overflow-y-auto max-h-[calc(100vh-16rem)]`}>
              {(byGroup.unassigned ?? []).length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">{lang === "fr" ? "Aucun étudiant" : "لا يوجد طلاب"}</p>
              ) : (
                (byGroup.unassigned ?? []).map((s) => (
                  <StudentCard
                    key={s.id}
                    student={s}
                    groups={groups}
                    currentGroupId={null}
                    lang={lang}
                    onMove={handleMove}
                    t={t}
                  />
                ))
              )}
            </div>
          </div>

          {/* Group columns */}
          {groups.map((group, idx) => {
            const col = colFor(idx);
            const students = byGroup[String(group.id)] ?? [];
            const isRenaming = renamingId === group.id;

            return (
              <div key={group.id} className={`flex-shrink-0 w-72 rounded-2xl overflow-hidden shadow-sm border ${col.border} flex flex-col`}>
                <div className={`${col.header} px-4 py-3`}>
                  <div className="flex items-center justify-between gap-2">
                    {isRenaming ? (
                      <RenameInput
                        value={group.name}
                        onConfirm={(v) => handleRename(group, v)}
                        onCancel={() => setRenamingId(null)}
                      />
                    ) : (
                      <>
                        <h3 className="text-white font-bold text-sm truncate flex-1">{group.name}</h3>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {students.length}
                          </span>
                          <button
                            onClick={() => setRenamingId(group.id)}
                            title={t.renameSchedule}
                            className="text-white/70 hover:text-white transition-colors p-0.5 rounded"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(group)}
                              title={lang === "fr" ? "Supprimer" : "حذف"}
                              className="text-white/70 hover:text-red-200 transition-colors p-0.5 rounded"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  {!isRenaming && (
                    <p className="text-white/70 text-[11px] mt-0.5 capitalize">{group.status}</p>
                  )}
                </div>

                <div className={`${col.light} flex-1 p-3 space-y-2 overflow-y-auto max-h-[calc(100vh-16rem)]`}>
                  {students.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">{lang === "fr" ? "Aucun étudiant" : "لا يوجد طلاب"}</p>
                  ) : (
                    students.map((s) => (
                      <StudentCard
                        key={s.id}
                        student={s}
                        groups={groups}
                        currentGroupId={group.id}
                        lang={lang}
                        onMove={handleMove}
                        t={t}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}

          {/* Add new group column */}
          <div className="flex-shrink-0 w-64">
            {addingNew ? (
              <div className="rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50 p-4">
                <p className="text-sm font-semibold text-orange-800 mb-2">
                  {lang === "fr" ? "Nom du planning" : "اسم الجدول"}
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleCreateGroup(newName);
                  }}
                >
                  <input
                    ref={newInputRef}
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={lang === "fr" ? "Ex: Groupe A" : "مثال: المجموعة أ"}
                    className="w-full border border-orange-300 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 mb-2"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={!newName.trim() || createMutation.isPending}
                      className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
                    >
                      {createMutation.isPending ? "..." : (lang === "fr" ? "Créer" : "إنشاء")}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAddingNew(false); setNewName(""); }}
                      className="px-3 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <button
                onClick={() => setAddingNew(true)}
                className="w-full rounded-2xl border-2 border-dashed border-gray-300 bg-transparent hover:border-orange-400 hover:bg-orange-50 transition-all flex items-center justify-center gap-2 px-4 py-6 text-sm font-medium text-gray-500 hover:text-orange-600 group"
              >
                <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                {t.addSchedule}
              </button>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
