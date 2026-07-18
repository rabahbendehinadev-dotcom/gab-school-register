import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PermissionGuard } from "@/components/admin/PermissionGuard";
import { useI18n } from "@/contexts/i18n-context";
import { useAuth } from "@/hooks/use-auth";
import {
  useListGroups, useAssignStudentToGroup, useUpdateStudent,
  type Student, type UpdateStudentBody,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Search, Filter, LayoutGrid, MessageCircle, Trash2, Users, Eye,
  Upload, ExternalLink, ChevronDown, Check, X, RefreshCw,
} from "lucide-react";

const ALL_STAGES = [
  { value: "new",               ar: "تسجيل جديد",       fr: "Nouveau",              cls: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "contacted",         ar: "تم التواصل",         fr: "Contacté",             cls: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "interested",        ar: "مهتم",               fr: "Intéressé",            cls: "bg-green-100 text-green-700 border-green-200" },
  { value: "payment_pending",   ar: "ينتظر الدفع",       fr: "En attente paiement",  cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { value: "payment_confirmed", ar: "تم الدفع",           fr: "Paiement confirmé",    cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "confirmed",         ar: "مؤكد للدورة",       fr: "Confirmé",             cls: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { value: "attended",          ar: "حضر",                fr: "Présent",              cls: "bg-teal-100 text-teal-700 border-teal-200" },
  { value: "no_show",           ar: "لم يحضر",            fr: "Absent",               cls: "bg-red-100 text-red-700 border-red-200" },
  { value: "completed",         ar: "مكتمل التكوين",     fr: "Terminé",              cls: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "archived",          ar: "أرشيف",              fr: "Archivé",              cls: "bg-gray-100 text-gray-500 border-gray-200" },
] as const;

function stageInfo(value: string) {
  return ALL_STAGES.find(s => s.value === value) ?? { ar: value, fr: value, cls: "bg-gray-100 text-gray-500 border-gray-200" };
}

function apiFetch(path: string, opts?: RequestInit) {
  return fetch("/api" + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  }).then(r => r.ok ? r.json() : r.json().then((e: unknown) => Promise.reject(e)));
}

function buildUrl(params: Record<string, string>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v !== "all") p.set(k, v);
  }
  return "/api/students?" + p.toString();
}

function waLink(student: Student) {
  let n = (student.whatsapp || student.phone).replace(/\D/g, "");
  if (n.startsWith("0") && n.length === 10) n = "213" + n.slice(1);
  else if (n.startsWith("5") && n.length === 9) n = "213" + n;
  return `https://wa.me/${n}`;
}

function StageSelect({
  student, disabled, onChange, isFr,
}: { student: Student; disabled: boolean; onChange: (s: string) => void; isFr: boolean }) {
  const si = stageInfo(student.stage);
  return (
    <Select value={student.stage} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={`h-7 text-[11px] rounded-full border px-2.5 font-medium min-w-[110px] ${si.cls}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ALL_STAGES.map(s => (
          <SelectItem key={s.value} value={s.value} className="text-xs">
            <span className={`inline-block rounded-full px-2 py-0.5 border text-xs ${s.cls}`}>{isFr ? s.fr : s.ar}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function Students() {
  const { lang } = useI18n();
  const isFr = lang === "fr";
  const { user } = useAuth();
  const canManage = user?.permissions?.includes("edit_students") ?? false;
  const canOpenWhatsapp = user?.permissions?.includes("open_whatsapp") ?? false;
  const qc = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkStage, setBulkStage] = useState("");
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);
  const [groupDialogStudent, setGroupDialogStudent] = useState<Student | null>(null);

  const filters = useMemo(() => ({
    search,
    stage: stageFilter,
    city: cityFilter,
    groupId: groupFilter !== "all" ? groupFilter : "",
    paymentStatus: paymentFilter,
    trainingType: typeFilter,
    dateFrom,
    dateTo,
  }), [search, stageFilter, cityFilter, groupFilter, paymentFilter, typeFilter, dateFrom, dateTo]);

  const { data: students = [], isLoading, refetch } = useQuery<Student[]>({
    queryKey: ["students-list", filters],
    queryFn: async () => {
      const r = await fetch(buildUrl(filters), { credentials: "include" });
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const { data: counts = {} } = useQuery<Record<string, number>>({
    queryKey: ["stage-counts"],
    queryFn: async () => {
      const r = await fetch("/api/students/stage-counts", { credentials: "include" });
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const { data: groups = [] } = useListGroups();

  const stageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: number; stage: string }) =>
      apiFetch(`/students/${id}/stage`, { method: "PATCH", body: JSON.stringify({ stage }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students-list"] });
      qc.invalidateQueries({ queryKey: ["stage-counts"] });
      qc.invalidateQueries({ queryKey: ["/api/students"] });
      qc.invalidateQueries({ queryKey: ["stats-erp"] });
    },
    onError: () => toast({ title: isFr ? "Erreur" : "خطأ", variant: "destructive" }),
  });

  const bulkMutation = useMutation({
    mutationFn: ({ ids, stage }: { ids: number[]; stage: string }) =>
      apiFetch("/students/bulk/stage", { method: "PATCH", body: JSON.stringify({ ids, stage }) }),
    onSuccess: (_data, { ids }) => {
      qc.invalidateQueries({ queryKey: ["students-list"] });
      qc.invalidateQueries({ queryKey: ["stage-counts"] });
      qc.invalidateQueries({ queryKey: ["/api/students"] });
      qc.invalidateQueries({ queryKey: ["stats-erp"] });
      setSelectedIds(new Set());
      setBulkStage("");
      toast({ title: isFr ? `${ids.length} étudiant(s) mis à jour` : `تم تحديث ${ids.length} طالب` });
    },
    onError: () => toast({ title: isFr ? "Erreur" : "خطأ", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/students/${id}`, { method: "DELETE", credentials: "include" })
        .then(r => { if (!r.ok) throw new Error(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students-list"] });
      qc.invalidateQueries({ queryKey: ["stage-counts"] });
      toast({ title: isFr ? "Étudiant supprimé" : "تم حذف الطالب" });
    },
  });

  const groupMutation = useAssignStudentToGroup({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["students-list"] });
        setGroupDialogStudent(null);
        toast({ title: isFr ? "Groupe assigné" : "تم تعيين المجموعة" });
      },
    },
  });

  const updateMutation = useUpdateStudent({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: ["students-list"] });
        setDetailStudent(data);
        toast({ title: isFr ? "Enregistré" : "تم الحفظ" });
      },
    },
  });

  const total = counts["_total"] ?? students.length;
  const allSelected = students.length > 0 && students.every(s => selectedIds.has(s.id));

  function toggleAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(students.map(s => s.id)));
  }
  function toggleOne(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function clearAdvanced() {
    setCityFilter(""); setGroupFilter("all"); setPaymentFilter("all");
    setTypeFilter("all"); setDateFrom(""); setDateTo("");
  }
  const hasAdvanced = cityFilter || groupFilter !== "all" || paymentFilter !== "all" || typeFilter !== "all" || dateFrom || dateTo;

  return (
    <AdminLayout>
      <PermissionGuard anyOf={["view_students", "view_all_students"]}>
      <div dir="rtl" className="flex flex-col h-[calc(100vh-8rem)] bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 bg-muted/10 flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold">{isFr ? "Étudiants" : "الطلاب"}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isFr ? `${total} au total · Actualisation auto 30s` : `${total} طالب · تحديث تلقائي كل 30 ثانية`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => refetch()}>
              <RefreshCw className="w-3.5 h-3.5" />
              {isFr ? "Actualiser" : "تحديث"}
            </Button>
            <Link href="/gab-c7x2p/pipeline">
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5">
                <LayoutGrid className="w-3.5 h-3.5" />
                {isFr ? "Kanban" : "كانبان"}
              </Button>
            </Link>
          </div>
        </div>

        {/* Stage count strip */}
        <div className="flex gap-2 px-4 py-2.5 overflow-x-auto border-b border-border/30 bg-muted/5 flex-shrink-0">
          <button
            onClick={() => setStageFilter("all")}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              stageFilter === "all"
                ? "bg-foreground text-background border-foreground"
                : "bg-background border-border hover:border-foreground/40"
            }`}
          >
            {isFr ? "Tous" : "الكل"}
            <span className="bg-black/10 rounded-full px-1.5 py-0.5 text-[10px] leading-none">{total}</span>
          </button>
          {ALL_STAGES.map(s => (
            <button
              key={s.value}
              onClick={() => setStageFilter(stageFilter === s.value ? "all" : s.value)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${s.cls} ${
                stageFilter === s.value ? "ring-2 ring-offset-1 ring-current" : "opacity-60 hover:opacity-100"
              }`}
            >
              {isFr ? s.fr : s.ar}
              <span className="bg-white/60 rounded-full px-1.5 py-0.5 text-[10px] leading-none">{counts[s.value] ?? 0}</span>
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="px-4 py-2.5 border-b border-border/30 space-y-2 flex-shrink-0">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={isFr ? "الاسم أو رقم الهاتف..." : "الاسم أو رقم الهاتف..."}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pr-9 rounded-xl bg-background"
                dir="rtl"
              />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[170px] rounded-xl bg-background flex-shrink-0">
                <SelectValue placeholder={isFr ? "Toutes les étapes" : "كل المراحل"} />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="all">{isFr ? "Toutes les étapes" : "كل المراحل"}</SelectItem>
                {ALL_STAGES.map(s => (
                  <SelectItem key={s.value} value={s.value}>{isFr ? s.fr : s.ar}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={showAdvanced ? "default" : "outline"}
              size="sm"
              className="rounded-xl gap-1.5 flex-shrink-0"
              onClick={() => setShowAdvanced(v => !v)}
            >
              <Filter className="w-3.5 h-3.5" />
              {isFr ? "Filtres" : "فلاتر"}
              {hasAdvanced && <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />}
              <ChevronDown className={`w-3 h-3 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
            </Button>
          </div>

          {showAdvanced && (
            <div className="flex gap-2 flex-wrap items-center pt-1">
              <Input
                placeholder={isFr ? "Wilaya..." : "الولاية..."}
                value={cityFilter}
                onChange={e => setCityFilter(e.target.value)}
                className="w-[130px] rounded-xl bg-background h-9 text-sm"
                dir="rtl"
              />
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="w-[150px] rounded-xl bg-background h-9 text-sm">
                  <SelectValue placeholder={isFr ? "Groupe" : "المجموعة"} />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all">{isFr ? "Tous groupes" : "كل المجموعات"}</SelectItem>
                  {groups.map(g => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="w-[150px] rounded-xl bg-background h-9 text-sm">
                  <SelectValue placeholder={isFr ? "Paiement" : "حالة الدفع"} />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all">{isFr ? "Tous" : "الكل"}</SelectItem>
                  <SelectItem value="unpaid">{isFr ? "Non payé" : "لم يدفع"}</SelectItem>
                  <SelectItem value="deposited">{isFr ? "Acompte" : "إيداع"}</SelectItem>
                  <SelectItem value="paid">{isFr ? "Payé" : "مدفوع"}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px] rounded-xl bg-background h-9 text-sm">
                  <SelectValue placeholder={isFr ? "Type" : "النوع"} />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all">{isFr ? "Tous" : "الكل"}</SelectItem>
                  <SelectItem value="physical">{isFr ? "Présentiel" : "حضوري"}</SelectItem>
                  <SelectItem value="online">{isFr ? "En ligne" : "أونلاين"}</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[140px] rounded-xl bg-background h-9 text-xs" title={isFr ? "Du" : "من تاريخ"} />
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[140px] rounded-xl bg-background h-9 text-xs" title={isFr ? "Au" : "إلى تاريخ"} />
              {hasAdvanced && (
                <Button variant="ghost" size="sm" className="rounded-xl text-muted-foreground h-9" onClick={clearAdvanced}>
                  <X className="w-3.5 h-3.5 ml-1" />{isFr ? "Réinitialiser" : "مسح"}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && canManage && (
          <div className="flex items-center gap-3 px-5 py-2 bg-primary/5 border-b border-primary/20 flex-shrink-0">
            <span className="text-sm font-medium text-primary">
              {isFr ? `${selectedIds.size} sélectionné(s)` : `تم تحديد ${selectedIds.size} طالب`}
            </span>
            <div className="flex gap-2 mr-auto items-center">
              <Select value={bulkStage} onValueChange={setBulkStage}>
                <SelectTrigger className="w-[180px] h-8 rounded-lg text-xs bg-background">
                  <SelectValue placeholder={isFr ? "Changer l'étape..." : "تغيير المرحلة..."} />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {ALL_STAGES.map(s => (
                    <SelectItem key={s.value} value={s.value} className="text-xs">{isFr ? s.fr : s.ar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm" className="rounded-lg h-8 text-xs gap-1"
                disabled={!bulkStage || bulkMutation.isPending}
                onClick={() => bulkMutation.mutate({ ids: [...selectedIds], stage: bulkStage })}
              >
                <Check className="w-3 h-3" />{isFr ? "Appliquer" : "تطبيق"}
              </Button>
              <Button
                size="sm" variant="outline" className="rounded-lg h-8 text-xs"
                disabled={bulkMutation.isPending}
                onClick={() => { if (confirm(isFr ? "Archiver les étudiants sélectionnés ?" : "هل تريد أرشفة الطلاب المحددين؟")) bulkMutation.mutate({ ids: [...selectedIds], stage: "archived" }); }}
              >
                {isFr ? "Archiver" : "أرشفة"}
              </Button>
              <Button
                size="sm" variant="ghost" className="rounded-lg h-8 text-xs text-muted-foreground gap-1"
                onClick={() => setSelectedIds(new Set())}
              >
                <X className="w-3 h-3" />{isFr ? "Annuler" : "إلغاء"}
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground animate-pulse text-sm">
              {isFr ? "Chargement..." : "جاري التحميل..."}
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
              <Users className="w-10 h-10 opacity-20" />
              <p className="text-sm">{isFr ? "Aucun étudiant trouvé" : "لا يوجد طلاب"}</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/40 sticky top-0 z-10 backdrop-blur-sm">
                <TableRow>
                  <TableHead className="w-10 text-center">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded cursor-pointer" />
                  </TableHead>
                  <TableHead>{isFr ? "Étudiant" : "الطالب"}</TableHead>
                  <TableHead>{isFr ? "Téléphone" : "الهاتف"}</TableHead>
                  <TableHead>{isFr ? "Wilaya" : "الولاية"}</TableHead>
                  <TableHead>{isFr ? "Type" : "النوع"}</TableHead>
                  <TableHead>{isFr ? "Étape" : "المرحلة"}</TableHead>
                  <TableHead>{isFr ? "Groupe" : "المجموعة"}</TableHead>
                  <TableHead>{isFr ? "Date" : "التسجيل"}</TableHead>
                  <TableHead className="w-28"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map(student => {
                  const group = groups.find(g => g.id === student.groupId);
                  const selected = selectedIds.has(student.id);
                  return (
                    <TableRow key={student.id} className={`group hover:bg-muted/20 transition-colors ${selected ? "bg-primary/5" : ""}`}>
                      <TableCell className="text-center">
                        <input type="checkbox" checked={selected} onChange={() => toggleOne(student.id)} className="rounded cursor-pointer" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Link href={`/gab-c7x2p/students/${student.id}`} className="flex-shrink-0">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-xs font-bold text-primary hover:from-primary/30 hover:to-primary/60 transition-all">
                              {(student.firstName?.[0] ?? "").toUpperCase()}{(student.lastName?.[0] ?? "").toUpperCase()}
                            </div>
                          </Link>
                          <div className="min-w-0">
                            <Link href={`/gab-c7x2p/students/${student.id}`} className="font-semibold text-sm hover:text-primary hover:underline truncate block">
                              {student.firstName} {student.lastName}
                            </Link>
                            <div className="flex gap-1 mt-0.5 flex-wrap">
                              {student.paymentStatus === "paid" && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full border border-emerald-200 font-medium">✓ {isFr ? "Payé" : "مدفوع"}</span>
                              )}
                              {student.paymentStatus === "deposited" && (
                                <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full border border-yellow-200 font-medium">💰 {isFr ? "Acompte" : "إيداع"}</span>
                              )}
                              {student.housingNeeded && (
                                <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full border border-blue-200">🏠</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <a href={`tel:${student.phone}`} className="text-sm hover:text-primary font-medium">{student.phone}</a>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{student.city}</TableCell>
                      <TableCell>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${student.trainingType === "physical" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-cyan-50 text-cyan-700 border-cyan-200"}`}>
                          {student.trainingType === "physical" ? (isFr ? "Présentiel" : "حضوري") : (isFr ? "En ligne" : "أونلاين")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StageSelect
                          student={student}
                          isFr={isFr}
                          disabled={!canManage || stageMutation.isPending}
                          onChange={stage => canManage && stageMutation.mutate({ id: student.id, stage })}
                        />
                      </TableCell>
                      <TableCell>
                        {group
                          ? <span className="text-xs bg-muted px-2 py-0.5 rounded-md">{group.name}</span>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(student.createdAt), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-0.5 items-center">
                          {canOpenWhatsapp && (
                            <a href={waLink(student)} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon" className="w-7 h-7 rounded-lg hover:bg-green-50 text-green-500" title="WhatsApp">
                                <MessageCircle className="w-3.5 h-3.5" />
                              </Button>
                            </a>
                          )}
                          <Link href={`/gab-c7x2p/students/${student.id}`}>
                            <Button variant="ghost" size="icon" className="w-7 h-7 rounded-lg hover:bg-primary/10 hover:text-primary" title={isFr ? "Profil" : "الملف"}>
                              <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          </Link>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                            {canManage && (
                              <Button variant="ghost" size="icon" className="w-7 h-7 rounded-lg" title={isFr ? "Groupe" : "المجموعة"} onClick={() => setGroupDialogStudent(student)}>
                                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                            )}
                            {canManage && (
                              <Button variant="ghost" size="icon" className="w-7 h-7 rounded-lg" title={isFr ? "Modifier" : "تعديل"} onClick={() => setDetailStudent(student)}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </Button>
                            )}
                            {canManage && (
                              <Button
                                variant="ghost" size="icon" className="w-7 h-7 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                                title={isFr ? "Supprimer" : "حذف"}
                                onClick={() => { if (confirm(isFr ? "Supprimer cet étudiant ?" : "حذف هذا الطالب؟")) deleteMutation.mutate(student.id); }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <GroupAssignDialog
        student={groupDialogStudent}
        groups={groups}
        onClose={() => setGroupDialogStudent(null)}
        onAssign={(studentId, groupId) => groupMutation.mutate({ id: studentId, data: { groupId } })}
      />
      <StudentDetailDialog
        student={detailStudent}
        onClose={() => setDetailStudent(null)}
        onSave={(id, data) => updateMutation.mutate({ id, data })}
        isPending={updateMutation.isPending}
      />
      </PermissionGuard>
    </AdminLayout>
  );
}

function GroupAssignDialog({ student, groups, onClose, onAssign }: {
  student: Student | null;
  groups: Array<{ id: number; name: string; studentCount: number; capacity: number }>;
  onClose: () => void;
  onAssign: (studentId: number, groupId: number | null) => void;
}) {
  return (
    <Dialog open={!!student} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-[360px] rounded-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>تعيين المجموعة</DialogTitle>
          <DialogDescription>اختر مجموعة للطالب</DialogDescription>
        </DialogHeader>
        {student && (
          <div className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground">{student.firstName} {student.lastName}</p>
            <Select
              defaultValue={student.groupId?.toString() ?? "none"}
              onValueChange={v => onAssign(student.id, v === "none" ? null : parseInt(v))}
            >
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="none">بدون مجموعة</SelectItem>
                {groups.map(g => (
                  <SelectItem key={g.id} value={g.id.toString()}>
                    {g.name} ({g.studentCount}/{g.capacity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StudentDetailDialog({ student, onClose, onSave, isPending }: {
  student: Student | null;
  onClose: () => void;
  onSave: (id: number, data: UpdateStudentBody) => void;
  isPending: boolean;
}) {
  const { t } = useI18n();
  const form = useForm<UpdateStudentBody>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (student) {
      form.reset({
        firstName: student.firstName,
        lastName: student.lastName,
        phone: student.phone,
        whatsapp: student.whatsapp,
        city: student.city,
        experienceLevel: student.experienceLevel,
        note: student.note ?? "",
        housingNeeded: student.housingNeeded,
        paymentStatus: student.paymentStatus as "unpaid" | "deposited" | "paid",
      });
      setReceiptPreview(student.receiptUrl ?? null);
    }
  }, [student]);

  async function handleReceiptUpload(file: File) {
    if (!student) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("receipt", file);
      const res = await fetch(`/api/students/${student.id}/receipt`, {
        method: "POST", body: formData, credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      const { receiptUrl } = await res.json();
      setReceiptPreview(receiptUrl);
      onSave(student.id, { receiptUrl });
      toast({ title: t.receiptUploaded });
    } catch {
      toast({ title: t.receiptError, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={!!student} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[500px] rounded-3xl p-6 max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">تعديل بيانات الطالب</DialogTitle>
          <DialogDescription>تحديث المعلومات الأساسية للطالب</DialogDescription>
        </DialogHeader>
        {student && (
          <form onSubmit={form.handleSubmit(data => onSave(student.id, data))} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الاسم</Label>
                <Input {...form.register("firstName")} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>اللقب</Label>
                <Input {...form.register("lastName")} className="rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الهاتف</Label>
                <Input {...form.register("phone")} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>واتساب</Label>
                <Input {...form.register("whatsapp")} className="rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الولاية</Label>
                <Input {...form.register("city")} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>المستوى</Label>
                <Input {...form.register("experienceLevel")} className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>ملاحظة</Label>
              <Input {...form.register("note")} className="rounded-xl" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="housing" {...form.register("housingNeeded")} className="rounded" />
              <Label htmlFor="housing">يحتاج إقامة 🏠</Label>
            </div>
            <div className="space-y-2">
              <Label>حالة الدفع</Label>
              <Select
                value={form.watch("paymentStatus") ?? "unpaid"}
                onValueChange={v => form.setValue("paymentStatus", v as "unpaid" | "deposited" | "paid")}
              >
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="unpaid">لم يدفع</SelectItem>
                  <SelectItem value="deposited">تم الإيداع 💰</SelectItem>
                  <SelectItem value="paid">مدفوع كامل ✅</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>وصل الدفع</Label>
              {receiptPreview ? (
                <div className="flex items-center gap-3">
                  <img src={receiptPreview} alt="وصل" className="w-20 h-20 object-cover rounded-lg border border-border" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <div className="flex flex-col gap-2">
                    <a href={receiptPreview} target="_blank" rel="noopener noreferrer">
                      <Button type="button" variant="outline" size="sm" className="rounded-xl gap-1.5">
                        <ExternalLink className="w-3.5 h-3.5" />فتح
                      </Button>
                    </a>
                    <Button type="button" variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      <Upload className="w-3.5 h-3.5" />تغيير
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full border-2 border-dashed border-border rounded-xl p-4 flex flex-col items-center gap-2 hover:bg-muted/30 transition-colors text-muted-foreground text-sm"
                >
                  <Upload className="w-5 h-5" />
                  {uploading ? t.uploading : t.receiptUpload}
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleReceiptUpload(f); }} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1 rounded-xl" disabled={isPending}>
                {isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
              </Button>
              <Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>إلغاء</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
