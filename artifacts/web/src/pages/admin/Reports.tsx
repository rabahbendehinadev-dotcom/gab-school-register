import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BarChart2, TrendingUp, Users, RefreshCw, Download, ChevronUp, ChevronDown, Minus } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface StaffPerf {
  staffId: number;
  fullName: string;
  role: string;
  loginCount: number;
  lastActive: string | null;
  totalActions: number;
  studentsOpened: number;
  contactsMade: number;
  callsWithResult: number;
  callsWithoutResult: number;
  notesAdded: number;
  tasksCompleted: number;
  tasksLate: number;
  followupsCompleted: number;
  checklistDone: number;
  checklistTotal: number;
  checklistRate: number | null;
}

type SortKey = keyof StaffPerf;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoStr(n: number): string {
  return new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);
}

function RateBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>;
  const color = value >= 80 ? "bg-green-500" : value >= 60 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs font-medium">{value}%</span>
    </div>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <Minus className="w-3 h-3 text-muted-foreground/40" />;
  return dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
}

export default function Reports() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const [from, setFrom] = useState(daysAgoStr(30));
  const [to, setTo]     = useState(todayStr());
  const [applied, setApplied] = useState({ from: daysAgoStr(30), to: todayStr() });
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "totalActions", dir: "desc" });

  const canView = user?.permissions?.includes("view_ai_control") || user?.permissions?.includes("view_reports");

  if (!canView) {
    navigate("/gab-c7x2p");
    return null;
  }

  const { data, isLoading, refetch } = useQuery<StaffPerf[]>({
    queryKey: ["staff-performance", applied.from, applied.to],
    queryFn: async () => {
      const params = new URLSearchParams({ from: applied.from, to: applied.to });
      const res = await fetch(`${BASE}/api/ai/staff-performance?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  function toggleSort(key: SortKey) {
    setSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" });
  }

  const sorted = [...(data ?? [])].sort((a, b) => {
    const va = a[sort.key] ?? 0;
    const vb = b[sort.key] ?? 0;
    const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
    return sort.dir === "asc" ? cmp : -cmp;
  });

  const totalContacts  = sorted.reduce((s, r) => s + r.contactsMade,      0);
  const totalConfirmed = sorted.reduce((s, r) => s + r.callsWithResult,   0);
  const totalLate      = sorted.reduce((s, r) => s + r.tasksLate,         0);
  const avgChecklist   = sorted.length > 0
    ? Math.round(sorted.filter(r => r.checklistRate !== null).reduce((s, r) => s + (r.checklistRate ?? 0), 0) / Math.max(sorted.filter(r => r.checklistRate !== null).length, 1))
    : null;

  function exportCsv() {
    if (!sorted.length) return;
    const headers = ["الاسم","الدور","تسجيلات الدخول","إجمالي النشاط","الطلاب المفتوحون","التواصلات","مكالمات بنتيجة","مكالمات بدون نتيجة","الملاحظات","المهام المكتملة","المهام المتأخرة","اكتمال القوائم%"];
    const rows = sorted.map(r => [r.fullName, r.role, r.loginCount, r.totalActions, r.studentsOpened, r.contactsMade, r.callsWithResult, r.callsWithoutResult, r.notesAdded, r.tasksCompleted, r.tasksLate, r.checklistRate ?? "—"]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `performance_${applied.from}_${applied.to}.csv`;
    a.click();
  }

  const cols: { key: SortKey; label: string; align?: string }[] = [
    { key: "fullName",          label: "الموظف" },
    { key: "loginCount",        label: "الدخول",    align: "text-center" },
    { key: "totalActions",      label: "النشاط",    align: "text-center" },
    { key: "studentsOpened",    label: "طلاب",      align: "text-center" },
    { key: "contactsMade",      label: "تواصل",     align: "text-center" },
    { key: "callsWithResult",   label: "مكالمة+نتيجة", align: "text-center" },
    { key: "callsWithoutResult",label: "بدون نتيجة",align: "text-center" },
    { key: "notesAdded",        label: "ملاحظات",   align: "text-center" },
    { key: "tasksCompleted",    label: "مهام مكتملة", align: "text-center" },
    { key: "tasksLate",         label: "مهام متأخرة", align: "text-center" },
    { key: "checklistRate",     label: "القوائم",   align: "text-center" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-foreground">تقارير الأداء</h2>
            <p className="text-sm text-muted-foreground mt-0.5">مؤشرات الأداء الفردية لكل موظف</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 ml-1" />
              تحديث
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!sorted.length}>
              <Download className="w-4 h-4 ml-1" />
              تصدير CSV
            </Button>
          </div>
        </div>

        {/* Date Range Filter */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">من</label>
                <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 text-sm w-40" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">إلى</label>
                <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 text-sm w-40" />
              </div>
              <Button size="sm" className="h-8" onClick={() => setApplied({ from, to })}>
                تطبيق
              </Button>
              <div className="flex gap-2 mr-auto flex-wrap">
                {[
                  { label: "اليوم",    from: todayStr(),    to: todayStr() },
                  { label: "7 أيام",   from: daysAgoStr(7), to: todayStr() },
                  { label: "30 يوم",   from: daysAgoStr(30),to: todayStr() },
                ].map(p => (
                  <Button key={p.label} variant="outline" size="sm" className="h-8 text-xs"
                    onClick={() => { setFrom(p.from); setTo(p.to); setApplied({ from: p.from, to: p.to }); }}>
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">الموظفون</p>
              </div>
              <p className="text-2xl font-bold">{sorted.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart2 className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">إجمالي التواصلات</p>
              </div>
              <p className="text-2xl font-bold">{totalContacts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">مكالمات مؤكدة</p>
              </div>
              <p className="text-2xl font-bold">{totalConfirmed}</p>
            </CardContent>
          </Card>
          <Card className={totalLate > 0 ? "border-red-200 bg-red-50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart2 className={`w-4 h-4 ${totalLate > 0 ? "text-red-500" : "text-muted-foreground"}`} />
                <p className="text-xs text-muted-foreground">مهام متأخرة</p>
              </div>
              <p className={`text-2xl font-bold ${totalLate > 0 ? "text-red-600" : ""}`}>{totalLate}</p>
            </CardContent>
          </Card>
        </div>

        {/* Data Table */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold">
              تفصيل الأداء الفردي
              <span className="font-normal text-muted-foreground mr-2 text-xs">
                {applied.from} → {applied.to}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">جاري التحميل...</div>
            ) : sorted.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">لا توجد بيانات للفترة المحددة</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      {cols.map(c => (
                        <th
                          key={c.key}
                          className={`px-3 py-2.5 text-xs font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap ${c.align ?? "text-right"}`}
                          onClick={() => toggleSort(c.key)}
                        >
                          <span className="inline-flex items-center gap-1">
                            {c.label}
                            <SortIcon active={sort.key === c.key} dir={sort.dir} />
                          </span>
                        </th>
                      ))}
                      <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-center">آخر نشاط</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((r, i) => (
                      <tr key={r.staffId} className={`border-b transition-colors hover:bg-muted/30 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                        <td className="px-3 py-3">
                          <div>
                            <p className="font-medium text-foreground">{r.fullName}</p>
                            <p className="text-xs text-muted-foreground">{r.role}</p>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center text-foreground/80">{r.loginCount}</td>
                        <td className="px-3 py-3 text-center font-semibold">{r.totalActions}</td>
                        <td className="px-3 py-3 text-center text-foreground/80">{r.studentsOpened}</td>
                        <td className="px-3 py-3 text-center text-foreground/80">{r.contactsMade}</td>
                        <td className="px-3 py-3 text-center text-green-600 font-medium">{r.callsWithResult}</td>
                        <td className="px-3 py-3 text-center">
                          {r.callsWithoutResult > 0
                            ? <span className="text-orange-600 font-medium">{r.callsWithoutResult}</span>
                            : <span className="text-muted-foreground">0</span>
                          }
                        </td>
                        <td className="px-3 py-3 text-center text-foreground/80">{r.notesAdded}</td>
                        <td className="px-3 py-3 text-center text-green-600">{r.tasksCompleted}</td>
                        <td className="px-3 py-3 text-center">
                          {r.tasksLate > 0
                            ? <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{r.tasksLate}</Badge>
                            : <span className="text-muted-foreground text-xs">0</span>
                          }
                        </td>
                        <td className="px-3 py-3 text-center">
                          <RateBar value={r.checklistRate} />
                        </td>
                        <td className="px-3 py-3 text-center text-xs text-muted-foreground">
                          {r.lastActive ? new Date(r.lastActive).toLocaleDateString("ar-EG") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
