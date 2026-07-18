import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle, Info, Zap, RefreshCw, Settings, ChevronDown, ChevronUp, Eye, Bell, BarChart2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Severity = "info" | "warning" | "important" | "critical";

interface AiFinding {
  type: string;
  severity: Severity;
  titleAr: string;
  descriptionAr: string;
  triggerCondition: string;
  evidence: string[];
  affectedStaffIds: number[];
  affectedStudentIds: number[];
  suggestedActionAr: string;
  period: string;
  linkPath?: string;
}

interface AiReport {
  id: number;
  report_type: string;
  severity: Severity;
  findings: AiFinding[];
  is_read: boolean;
  generated_at: string;
}

interface AiSettings {
  ai_scheduler_enabled: string;
  ai_idle_threshold_min: string;
  ai_late_response_threshold_h: string;
  ai_calls_without_result_threshold: string;
  ai_critical_alert_interval_min: string;
  ai_3h_interval_h: string;
  ai_midday_hour: string;
  ai_eod_hour: string;
  ai_weekly_day: string;
  ai_weekly_hour: string;
}

const severityConfig: Record<Severity, { label: string; color: string; icon: React.ElementType; bg: string; border: string }> = {
  critical: { label: "حرج",    color: "text-red-600",    icon: AlertTriangle, bg: "bg-red-50",    border: "border-red-200" },
  important:{ label: "مهم",    color: "text-orange-600", icon: AlertTriangle, bg: "bg-orange-50", border: "border-orange-200" },
  warning:  { label: "تحذير",  color: "text-yellow-600", icon: AlertTriangle, bg: "bg-yellow-50", border: "border-yellow-200" },
  info:     { label: "معلومة", color: "text-blue-600",   icon: Info,          bg: "bg-blue-50",   border: "border-blue-200" },
};

const reportTypeLabel: Record<string, string> = {
  manual: "يدوي",
  "3h_summary": "ملخص 3 ساعات",
  midday_report: "تقرير الظهيرة",
  end_of_day: "تقرير نهاية اليوم",
  critical_alert: "تنبيه حرج",
};

function SeverityBadge({ severity }: { severity: Severity }) {
  const cfg = severityConfig[severity];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color} ${cfg.bg}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function FindingCard({ finding }: { finding: AiFinding }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = severityConfig[finding.severity];

  return (
    <div className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <SeverityBadge severity={finding.severity} />
            <span className="text-xs text-muted-foreground">{finding.period}</span>
          </div>
          <p className={`font-semibold text-sm ${cfg.color}`}>{finding.titleAr}</p>
          <p className="text-sm text-foreground/80 mt-1">{finding.descriptionAr}</p>
        </div>
        <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={() => setExpanded(e => !e)}>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          {finding.triggerCondition && (
            <div className="bg-white/50 rounded-lg px-3 py-2 border border-current/10">
              <p className="text-xs font-semibold text-muted-foreground mb-0.5">شرط التفعيل</p>
              <p className="text-xs text-foreground/70 font-mono">{finding.triggerCondition}</p>
            </div>
          )}
          {finding.affectedStaffIds.length > 0 && (
            <p className="text-xs text-muted-foreground">الموظفون المتأثرون: #{finding.affectedStaffIds.join(", #")}</p>
          )}
          {finding.affectedStudentIds.length > 0 && (
            <p className="text-xs text-muted-foreground">الطلاب المتأثرون: {finding.affectedStudentIds.length} طالب</p>
          )}
          {finding.evidence.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">الأدلة</p>
              <ul className="space-y-1">
                {finding.evidence.map((e, i) => (
                  <li key={i} className="text-xs text-foreground/70 bg-white/60 rounded px-2 py-1">{e}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="bg-white/60 rounded-lg px-3 py-2">
            <p className="text-xs font-semibold text-muted-foreground mb-0.5">الإجراء المقترح</p>
            <p className="text-xs text-foreground/80">{finding.suggestedActionAr}</p>
          </div>
          {finding.linkPath && (
            <a
              href={`${BASE}${finding.linkPath}`}
              className="text-xs text-primary hover:underline font-medium"
            >
              انتقل للصفحة ←
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function ReportCard({ report, onMarkRead }: { report: AiReport; onMarkRead: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = severityConfig[report.severity];
  const findings = report.findings as AiFinding[];
  const date = new Date(report.generated_at).toLocaleString("ar-EG");

  return (
    <Card className={`border ${report.is_read ? "border-border" : "border-primary/40"}`}>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={report.severity} />
            <span className="text-sm font-medium">{reportTypeLabel[report.report_type] ?? report.report_type}</span>
            <span className="text-xs text-muted-foreground">{date}</span>
            {!report.is_read && <span className="w-2 h-2 rounded-full bg-primary inline-block" />}
          </div>
          <div className="flex items-center gap-1">
            {!report.is_read && (
              <Button variant="ghost" size="icon" className="h-7 w-7" title="تعيين كمقروء" onClick={() => onMarkRead(report.id)}>
                <Eye className="w-4 h-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(e => !e)}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{findings.length} نتيجة</p>
      </CardHeader>

      {expanded && (
        <CardContent className="p-4 pt-2 space-y-3">
          {findings.length === 0
            ? <p className="text-sm text-muted-foreground">لا توجد نتائج.</p>
            : findings.map((f, i) => <FindingCard key={i} finding={f} />)
          }
        </CardContent>
      )}
    </Card>
  );
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: settings } = useQuery<AiSettings>({
    queryKey: ["ai-settings"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/ai/settings`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const [form, setForm] = useState<Partial<AiSettings>>({});
  const merged = { ...settings, ...form } as AiSettings;

  const save = useMutation({
    mutationFn: async (data: Partial<AiSettings>) => {
      const res = await fetch(`${BASE}/api/ai/settings`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم حفظ الإعدادات" });
      qc.invalidateQueries({ queryKey: ["ai-settings"] });
      onClose();
    },
  });

  return (
    <Card className="border-primary/30">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="w-4 h-4" />
          إعدادات نظام التحكم
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm">تفعيل الجدولة التلقائية</Label>
          <Switch
            checked={merged.ai_scheduler_enabled === "true"}
            onCheckedChange={v => setForm(f => ({ ...f, ai_scheduler_enabled: v ? "true" : "false" }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">حد الخمول (دقائق)</Label>
            <Input
              type="number" min="5" max="120"
              value={merged.ai_idle_threshold_min ?? "20"}
              onChange={e => setForm(f => ({ ...f, ai_idle_threshold_min: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">حد وقت الاستجابة (ساعات)</Label>
            <Input
              type="number" min="1" max="24"
              value={merged.ai_late_response_threshold_h ?? "2"}
              onChange={e => setForm(f => ({ ...f, ai_late_response_threshold_h: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">حد المكالمات بدون نتيجة</Label>
            <Input
              type="number" min="1" max="20"
              value={merged.ai_calls_without_result_threshold ?? "3"}
              onChange={e => setForm(f => ({ ...f, ai_calls_without_result_threshold: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">فاصل فحص الحرج (دقائق)</Label>
            <Input
              type="number" min="1" max="60"
              value={merged.ai_critical_alert_interval_min ?? "10"}
              onChange={e => setForm(f => ({ ...f, ai_critical_alert_interval_min: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">فاصل الملخص الدوري (ساعات)</Label>
            <Input
              type="number" min="1" max="12"
              value={merged.ai_3h_interval_h ?? "3"}
              onChange={e => setForm(f => ({ ...f, ai_3h_interval_h: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">ساعة تقرير الظهيرة</Label>
            <Input
              type="number" min="8" max="16"
              value={merged.ai_midday_hour ?? "12"}
              onChange={e => setForm(f => ({ ...f, ai_midday_hour: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">ساعة تقرير نهاية اليوم</Label>
            <Input
              type="number" min="16" max="23"
              value={merged.ai_eod_hour ?? "20"}
              onChange={e => setForm(f => ({ ...f, ai_eod_hour: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">يوم التقرير الأسبوعي (0=أحد, 1=اثنين)</Label>
            <Input
              type="number" min="0" max="6"
              value={merged.ai_weekly_day ?? "1"}
              onChange={e => setForm(f => ({ ...f, ai_weekly_day: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">ساعة التقرير الأسبوعي</Label>
            <Input
              type="number" min="5" max="12"
              value={merged.ai_weekly_hour ?? "8"}
              onChange={e => setForm(f => ({ ...f, ai_weekly_hour: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="flex-1" onClick={() => save.mutate(form)} disabled={save.isPending}>
            {save.isPending ? "جاري الحفظ..." : "حفظ الإعدادات"}
          </Button>
          <Button size="sm" variant="outline" onClick={onClose}>إلغاء</Button>
        </div>
      </CardContent>
    </Card>
  );
}

const NOTIF_PREF_LABELS: Record<string, string> = {
  always: "دائماً",
  during_shift: "أثناء الوردية",
  critical_only: "الحرجة فقط",
  off: "إيقاف",
};

interface StaffPref {
  id: number;
  full_name: string;
  role: string;
  notification_pref: string;
}

function NotifPrefsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: prefs, isLoading } = useQuery<StaffPref[]>({
    queryKey: ["ai-notif-prefs"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/ai/notification-prefs`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const update = useMutation({
    mutationFn: async ({ staffId, pref }: { staffId: number; pref: string }) => {
      const res = await fetch(`${BASE}/api/ai/notification-prefs/${staffId}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pref }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم تحديث تفضيل الإشعار" });
      qc.invalidateQueries({ queryKey: ["ai-notif-prefs"] });
    },
    onError: () => toast({ title: "فشل التحديث", variant: "destructive" }),
  });

  return (
    <Card className="border-primary/20">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bell className="w-4 h-4" />
          تفضيلات الإشعارات لكل موظف
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {(prefs ?? []).map(s => (
              <div key={s.id} className="flex items-center justify-between gap-3 py-1.5 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{s.full_name}</p>
                  <p className="text-xs text-muted-foreground">{s.role}</p>
                </div>
                <Select
                  value={s.notification_pref ?? "during_shift"}
                  onValueChange={pref => update.mutate({ staffId: s.id, pref })}
                  disabled={update.isPending}
                >
                  <SelectTrigger className="h-7 w-36 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(NOTIF_PREF_LABELS).map(([v, label]) => (
                      <SelectItem key={v} value={v} className="text-xs">{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface PerfRow {
  staffId: number; fullName: string; role: string;
  totalActions: number; whatsappClicks: number; callClicks: number;
  confirmedStudents: number; conversionRate: number | null;
  checklistRate: number | null; avgFirstResponseHours: number | null;
  tasksLate: number;
}

function StaffPerfSummary() {
  const to   = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const { data, isLoading } = useQuery<PerfRow[]>({
    queryKey: ["ai-staff-perf-summary"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/ai/staff-performance?from=${from}&to=${to}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 5 * 60_000,
  });

  const rows = data ?? [];
  return (
    <Card className="border-border/50">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart2 className="w-4 h-4" />
          مقارنة أداء الموظفين — آخر 30 يوم
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">جاري التحميل...</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">لا توجد بيانات.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-right py-1.5 pr-2 font-medium">الموظف</th>
                  <th className="text-center py-1.5 font-medium">النشاط</th>
                  <th className="text-center py-1.5 font-medium">واتساب</th>
                  <th className="text-center py-1.5 font-medium">اتصالات</th>
                  <th className="text-center py-1.5 font-medium">مؤكدون</th>
                  <th className="text-center py-1.5 font-medium">تحويل%</th>
                  <th className="text-center py-1.5 font-medium">قوائم%</th>
                  <th className="text-center py-1.5 font-medium">استجابة</th>
                  <th className="text-center py-1.5 font-medium">متأخرة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.staffId} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-1.5 pr-2">
                      <p className="font-medium">{r.fullName}</p>
                      <p className="text-muted-foreground text-[10px]">{r.role}</p>
                    </td>
                    <td className="text-center py-1.5">{r.totalActions}</td>
                    <td className="text-center py-1.5 text-green-600">{r.whatsappClicks}</td>
                    <td className="text-center py-1.5 text-blue-600">{r.callClicks}</td>
                    <td className="text-center py-1.5 text-violet-600 font-semibold">{r.confirmedStudents}</td>
                    <td className="text-center py-1.5">
                      {r.conversionRate != null
                        ? <span className={r.conversionRate >= 50 ? "text-green-600 font-medium" : "text-orange-600"}>{r.conversionRate}%</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="text-center py-1.5">
                      {r.checklistRate != null
                        ? <span className={r.checklistRate >= 70 ? "text-green-600" : "text-orange-600"}>{r.checklistRate}%</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="text-center py-1.5">
                      {r.avgFirstResponseHours != null
                        ? <span className={r.avgFirstResponseHours > 4 ? "text-orange-600" : "text-green-600"}>{r.avgFirstResponseHours}h</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="text-center py-1.5">
                      {r.tasksLate > 0
                        ? <span className="text-red-600 font-medium">{r.tasksLate}</span>
                        : <span className="text-muted-foreground">0</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AiControl() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showSettings, setShowSettings] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const canManage = user?.permissions?.includes("manage_ai_control");
  const canView   = user?.permissions?.includes("view_ai_control");

  if (!canView) {
    navigate("/gab-c7x2p");
    return null;
  }

  const { data: reportsData, isLoading: reportsLoading, refetch: refetchReports } = useQuery<{ total: number; rows: AiReport[] }>({
    queryKey: ["ai-reports", severityFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "30" });
      if (severityFilter !== "all") params.set("severity", severityFilter);
      const res = await fetch(`${BASE}/api/ai/reports?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const { data: activeAlerts } = useQuery<AiReport[]>({
    queryKey: ["ai-alerts-active"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/ai/alerts/active`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const runNow = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/ai/reports/run`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `تم التحليل — ${data.findings?.length ?? 0} نتيجة` });
      qc.invalidateQueries({ queryKey: ["ai-reports"] });
      qc.invalidateQueries({ queryKey: ["ai-alerts-active"] });
    },
    onError: () => toast({ title: "فشل التحليل", variant: "destructive" }),
  });

  const markRead = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${BASE}/api/ai/reports/${id}/read`, { method: "POST", credentials: "include" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-reports"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await fetch(`${BASE}/api/ai/reports/read-all`, { method: "POST", credentials: "include" });
    },
    onSuccess: () => {
      toast({ title: "تم تعيين الكل كمقروء" });
      qc.invalidateQueries({ queryKey: ["ai-reports"] });
    },
  });

  const reports = reportsData?.rows ?? [];
  const total   = reportsData?.total ?? 0;
  const alerts  = activeAlerts ?? [];

  const criticalCount  = alerts.filter(a => a.severity === "critical").length;
  const importantCount = alerts.filter(a => a.severity === "important").length;
  const warningCount   = alerts.filter(a => a.severity === "warning").length;
  const unread         = reports.filter(r => !r.is_read).length;

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-foreground">لوحة التحكم المتقدمة</h2>
            <p className="text-sm text-muted-foreground mt-0.5">مراقبة الأداء والتنبيهات التلقائية</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => setShowSettings(s => !s)}>
                <Settings className="w-4 h-4 ml-1" />
                الإعدادات
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => { refetchReports(); qc.invalidateQueries({ queryKey: ["ai-alerts-active"] }); }}>
              <RefreshCw className="w-4 h-4 ml-1" />
              تحديث
            </Button>
            {canManage && (
              <Button size="sm" onClick={() => runNow.mutate()} disabled={runNow.isPending}>
                <Zap className="w-4 h-4 ml-1" />
                {runNow.isPending ? "جاري التحليل..." : "تحليل الآن"}
              </Button>
            )}
          </div>
        </div>

        {/* Settings Panel + Notification Prefs */}
        {showSettings && canManage && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SettingsPanel onClose={() => setShowSettings(false)} />
            <NotifPrefsPanel />
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-red-700 mb-1">حرج</p>
              <p className="text-3xl font-bold text-red-600">{criticalCount}</p>
            </CardContent>
          </Card>
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-orange-700 mb-1">مهم</p>
              <p className="text-3xl font-bold text-orange-600">{importantCount}</p>
            </CardContent>
          </Card>
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-yellow-700 mb-1">تحذيرات</p>
              <p className="text-3xl font-bold text-yellow-600">{warningCount}</p>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-blue-700 mb-1">إجمالي التقارير</p>
              <p className="text-3xl font-bold text-blue-600">{total}</p>
            </CardContent>
          </Card>
        </div>

        {/* Staff Performance Summary — required on AI Control page */}
        <StaffPerfSummary />

        {/* Active Alerts Section */}
        {alerts.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              التنبيهات النشطة
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {alerts.slice(0, 10).map(r => {
                const findings = r.findings as AiFinding[];
                return findings.map((f, i) => (
                  <FindingCard key={`${r.id}-${i}`} finding={f} />
                ));
              })}
            </div>
          </div>
        )}

        {/* Reports List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground">
              سجل التقارير
              {unread > 0 && <span className="mr-2 text-xs text-primary">{unread} غير مقروء</span>}
            </h3>
            <div className="flex items-center gap-2">
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue placeholder="كل الأولويات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأولويات</SelectItem>
                  <SelectItem value="critical">حرج</SelectItem>
                  <SelectItem value="important">مهم</SelectItem>
                  <SelectItem value="warning">تحذير</SelectItem>
                  <SelectItem value="info">معلومة</SelectItem>
                </SelectContent>
              </Select>
              {unread > 0 && (
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => markAllRead.mutate()}>
                  تعيين الكل كمقروء
                </Button>
              )}
            </div>
          </div>

          {reportsLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">جاري التحميل...</div>
          ) : reports.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">لا توجد تقارير بعد</p>
                <p className="text-xs text-muted-foreground mt-1">اضغط "تحليل الآن" لتشغيل أول تقرير</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {reports.map(r => (
                <ReportCard key={r.id} report={r} onMarkRead={id => markRead.mutate(id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
