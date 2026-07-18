import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BarChart2, TrendingUp, Users, RefreshCw, Download, ChevronUp, ChevronDown, Minus, Clock } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface StaffPerf {
  staffId: number;
  fullName: string;
  role: string;
  shiftType: string;
  scheduledHours: number;
  actualLoginHours: number;
  idleHours: number;
  loginCount: number;
  lastActive: string | null;
  totalActions: number;
  studentsOpened: number;
  whatsappClicks: number;
  callClicks: number;
  contactsMade: number;
  callsWithResult: number;
  callsWithoutResult: number;
  notesAdded: number;
  followupTasksTotal: number;
  followupTasksDone: number;
  followupTasksLate: number;
  followupTaskRate: number | null;
  tasksTotal: number;
  tasksCompleted: number;
  tasksLate: number;
  taskCompletionRate: number | null;
  confirmedStudents: number;
  payingStudents: number;
  conversionCount: number;
  conversionRate: number | null;
  checklistDone: number;
  checklistTotal: number;
  checklistRate: number | null;
  avgFirstResponseHours: number | null;
}

type SortKey = keyof StaffPerf;

function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number) { return new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10); }

function RateBar({ value, warn = 60, good = 80 }: { value: number | null; warn?: number; good?: number }) {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>;
  const color = value >= good ? "bg-green-500" : value >= warn ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs font-medium">{value}%</span>
    </div>
  );
}

function Num({ v, className = "" }: { v: number; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{v}</span>;
}

function SortIndicator({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <Minus className="w-3 h-3 opacity-30" />;
  return dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
}

type ColDef = { key: SortKey; label: string; render?: (r: StaffPerf) => React.ReactNode };

const COLUMNS: ColDef[] = [
  { key: "scheduledHours",       label: "ساعات مجدولة", render: r => <span className="text-muted-foreground">{r.scheduledHours}h</span> },
  { key: "actualLoginHours",     label: "ساعات الدخول",  render: r => r.actualLoginHours > 0 ? <span className="text-blue-600 font-medium">{r.actualLoginHours}h</span> : <span className="text-muted-foreground">—</span> },
  { key: "idleHours",            label: "خمول",          render: r => r.idleHours > 0 ? <span className={r.idleHours > 4 ? "text-orange-600" : "text-muted-foreground"}>{r.idleHours}h</span> : <span className="text-green-600">0h</span> },
  { key: "loginCount",           label: "دخول" },
  { key: "totalActions",         label: "النشاط" },
  { key: "studentsOpened",       label: "طلاب مفتوحون" },
  { key: "whatsappClicks",       label: "واتساب",  render: r => <Num v={r.whatsappClicks} className="text-green-600" /> },
  { key: "callClicks",           label: "اتصالات",  render: r => <Num v={r.callClicks} className="text-blue-600" /> },
  { key: "callsWithResult",      label: "مكالمة+نتيجة", render: r => <Num v={r.callsWithResult} className="text-emerald-600 font-semibold" /> },
  {
    key: "callsWithoutResult",   label: "بدون نتيجة",
    render: r => r.callsWithoutResult > 0
      ? <span className="text-orange-600 font-medium">{r.callsWithoutResult}</span>
      : <span className="text-muted-foreground">0</span>,
  },
  { key: "notesAdded",           label: "ملاحظات" },
  { key: "tasksTotal",           label: "مهام" },
  { key: "tasksCompleted",       label: "مكتملة", render: r => <Num v={r.tasksCompleted} className="text-green-600" /> },
  {
    key: "tasksLate",            label: "متأخرة",
    render: r => r.tasksLate > 0
      ? <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{r.tasksLate}</Badge>
      : <span className="text-muted-foreground text-xs">0</span>,
  },
  { key: "taskCompletionRate",   label: "إنجاز مهام", render: r => <RateBar value={r.taskCompletionRate} /> },
  { key: "confirmedStudents",    label: "مؤكدون",  render: r => <Num v={r.confirmedStudents} className="text-violet-600" /> },
  { key: "payingStudents",       label: "مدفوعون",  render: r => <Num v={r.payingStudents} className="text-violet-700 font-semibold" /> },
  { key: "conversionRate",       label: "معدل التحويل%", render: r => <RateBar value={r.conversionRate} /> },
  { key: "checklistRate",        label: "قوائم",    render: r => <RateBar value={r.checklistRate} /> },
  {
    key: "avgFirstResponseHours", label: "وقت الاستجابة",
    render: r => r.avgFirstResponseHours != null
      ? <span className={r.avgFirstResponseHours > 4 ? "text-orange-600" : "text-green-600"}>{r.avgFirstResponseHours}h</span>
      : <span className="text-muted-foreground">—</span>,
  },
];

export default function Reports() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo]     = useState(todayStr());
  const [applied, setApplied] = useState({ from: daysAgo(30), to: todayStr() });
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "totalActions", dir: "desc" });

  const canView = user?.permissions?.includes("view_ai_control") || user?.permissions?.includes("manage_staff");
  if (!canView) { navigate("/gab-c7x2p"); return null; }

  const { data, isLoading, refetch } = useQuery<StaffPerf[]>({
    queryKey: ["staff-performance", applied.from, applied.to],
    queryFn: async () => {
      const p = new URLSearchParams({ from: applied.from, to: applied.to });
      const res = await fetch(`${BASE}/api/ai/staff-performance?${p}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  function applyRange(f: string, t: string) { setFrom(f); setTo(t); setApplied({ from: f, to: t }); }
  function toggleSort(key: SortKey) {
    setSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" });
  }

  const sorted = [...(data ?? [])].sort((a, b) => {
    const va = a[sort.key] ?? 0;
    const vb = b[sort.key] ?? 0;
    const cmp = typeof va === "string" ? (va as string).localeCompare(vb as string) : (va as number) - (vb as number);
    return sort.dir === "asc" ? cmp : -cmp;
  });

  // Summary card values
  const totalContacts    = sorted.reduce((s, r) => s + r.contactsMade, 0);
  const totalConfirmed   = sorted.reduce((s, r) => s + r.conversionCount, 0);
  const totalLate        = sorted.reduce((s, r) => s + r.tasksLate, 0);
  const totalLoginHours  = sorted.reduce((s, r) => s + r.actualLoginHours, 0);

  function exportCsv() {
    if (!sorted.length) return;
    const headers = [
      "الاسم","الدور","نوع الوردية",
      "ساعات مجدولة","ساعات دخول","خمول(h)",
      "تسجيلات دخول","النشاط","طلاب مفتوحون",
      "واتساب","اتصالات","مكالمة+نتيجة","بدون نتيجة",
      "ملاحظات",
      "متابعات(كل)","متابعات مكتملة","متابعات متأخرة","إنجاز متابعات%",
      "مؤكدون","مدفوعون","معدل التحويل%",
      "قوائم%","وقت استجابة(h)"
    ];
    const rows = sorted.map(r => [
      r.fullName, r.role, r.shiftType,
      r.scheduledHours, r.actualLoginHours, r.idleHours,
      r.loginCount, r.totalActions, r.studentsOpened,
      r.whatsappClicks, r.callClicks, r.callsWithResult, r.callsWithoutResult,
      r.notesAdded,
      r.followupTasksTotal ?? r.tasksTotal,
      r.followupTasksDone ?? r.tasksCompleted,
      r.followupTasksLate ?? r.tasksLate,
      r.followupTaskRate ?? r.taskCompletionRate ?? "—",
      r.confirmedStudents, r.payingStudents,
      r.conversionRate != null ? `${r.conversionRate}%` : "—",
      r.checklistRate != null ? `${r.checklistRate}%` : "—",
      r.avgFirstResponseHours ?? "—",
    ]);
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `performance_${applied.from}_${applied.to}.csv`;
    a.click();
  }

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold">تقارير الأداء</h2>
            <p className="text-sm text-muted-foreground mt-0.5">مؤشرات الأداء الفردية لكل موظف</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 ml-1" /> تحديث
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!sorted.length}>
              <Download className="w-4 h-4 ml-1" /> CSV
            </Button>
          </div>
        </div>

        {/* Date filter */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">من</label>
                <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 text-sm w-38" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">إلى</label>
                <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 text-sm w-38" />
              </div>
              <Button size="sm" className="h-8" onClick={() => setApplied({ from, to })}>تطبيق</Button>
              <div className="flex gap-2 mr-auto flex-wrap">
                {[
                  { label: "اليوم",  f: todayStr(), t: todayStr() },
                  { label: "7 أيام", f: daysAgo(7),  t: todayStr() },
                  { label: "30 يوم", f: daysAgo(30), t: todayStr() },
                  { label: "90 يوم", f: daysAgo(90), t: todayStr() },
                ].map(p => (
                  <Button key={p.label} variant="outline" size="sm" className="h-8 text-xs"
                    onClick={() => applyRange(p.f, p.t)}>{p.label}</Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-muted-foreground" /><p className="text-xs text-muted-foreground">الموظفون</p></div>
              <p className="text-2xl font-bold">{sorted.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-muted-foreground" /><p className="text-xs text-muted-foreground">ساعات الدخول</p></div>
              <p className="text-2xl font-bold">{totalLoginHours.toFixed(1)}h</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><BarChart2 className="w-4 h-4 text-muted-foreground" /><p className="text-xs text-muted-foreground">إجمالي التواصلات</p></div>
              <p className="text-2xl font-bold">{totalContacts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-violet-500" /><p className="text-xs text-muted-foreground">مؤكدون + مدفوعون</p></div>
              <p className="text-2xl font-bold text-violet-600">{totalConfirmed}</p>
            </CardContent>
          </Card>
        </div>

        {/* Performance table */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold">
              تفصيل الأداء الفردي
              <span className="font-normal text-muted-foreground mr-2 text-xs">
                {applied.from} ← {applied.to}
              </span>
              {totalLate > 0 && (
                <Badge variant="destructive" className="mr-2 text-[10px]">{totalLate} مهمة متأخرة</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-10 text-muted-foreground text-sm">جاري التحميل...</div>
            ) : sorted.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">لا توجد بيانات للفترة المحددة</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[1200px]">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      {/* Name */}
                      <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground sticky right-0 bg-muted/30 whitespace-nowrap">
                        الموظف
                      </th>
                      {COLUMNS.map(c => (
                        <th
                          key={c.key}
                          className="px-2 py-2.5 text-center font-semibold text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap select-none"
                          onClick={() => toggleSort(c.key)}
                        >
                          <span className="inline-flex items-center gap-0.5 justify-center">
                            {c.label}
                            <SortIndicator active={sort.key === c.key} dir={sort.dir} />
                          </span>
                        </th>
                      ))}
                      <th className="px-2 py-2.5 text-center font-semibold text-muted-foreground whitespace-nowrap">آخر ظهور</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((r, i) => (
                      <tr key={r.staffId} className={`border-b transition-colors hover:bg-muted/20 ${i % 2 === 1 ? "bg-muted/5" : ""}`}>
                        <td className="px-3 py-2.5 sticky right-0 bg-card border-l border-border/40">
                          <p className="font-medium text-foreground whitespace-nowrap">{r.fullName}</p>
                          <p className="text-muted-foreground text-[10px]">{r.role}</p>
                        </td>
                        {COLUMNS.map(c => (
                          <td key={c.key} className="px-2 py-2.5 text-center">
                            {c.render
                              ? c.render(r)
                              : <span className="text-foreground/80">{r[c.key] as number}</span>
                            }
                          </td>
                        ))}
                        <td className="px-2 py-2.5 text-center text-muted-foreground whitespace-nowrap">
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
