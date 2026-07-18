import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell, BellOff, BellRing, Zap, Smartphone, ListTodo,
  Users, GitMerge, CheckSquare, Cpu, Volume2, VolumeX,
  Clock, Save, ChevronDown, ChevronUp, Shield
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface NotifSettings {
  enabled: boolean;
  pref: "always" | "during_shift" | "critical_only" | "off";
  push: boolean;
  tasks: boolean;
  newStudents: boolean;
  followups: boolean;
  checklist: boolean;
  ai: boolean;
  sound: boolean;
  reminderIntervalMin: number;
}

interface StaffRow {
  id: number;
  fullName: string;
  role: string;
  settings: NotifSettings;
}

const PREF_OPTIONS = [
  { value: "always",       label: "دائماً",         desc: "في أي وقت",         color: "bg-green-100 text-green-800 border-green-300" },
  { value: "during_shift", label: "أثناء الدوام",   desc: "ساعات العمل فقط",  color: "bg-blue-100 text-blue-800 border-blue-300" },
  { value: "critical_only",label: "الحرجة فقط",     desc: "التنبيهات الحرجة",  color: "bg-orange-100 text-orange-800 border-orange-300" },
  { value: "off",          label: "إيقاف",           desc: "لا توقيت",          color: "bg-gray-100 text-gray-700 border-gray-300" },
] as const;

const REMINDER_OPTIONS = [15, 30, 60, 120, 240];

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        checked ? "bg-primary" : "bg-muted-foreground/30"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
        checked ? "translate-x-4" : "translate-x-0.5"
      }`} />
    </button>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  desc,
  checked,
  onChange,
  disabled,
  ownerOnly,
  isOwner,
}: {
  icon: React.ElementType;
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  ownerOnly?: boolean;
  isOwner?: boolean;
}) {
  const locked = ownerOnly && !isOwner;
  return (
    <div className={`flex items-center justify-between py-2.5 border-b last:border-0 ${locked ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-2.5">
        <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <div>
          <p className="text-xs font-medium">{label} {ownerOnly && <span className="text-[10px] text-amber-600 mr-1">• للمالك فقط</span>}</p>
          {desc && <p className="text-[10px] text-muted-foreground">{desc}</p>}
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled || locked} />
    </div>
  );
}

function StaffCard({ staff, isOwner }: { staff: StaffRow; isOwner: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<NotifSettings>({ ...staff.settings });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft({ ...staff.settings });
    setDirty(false);
  }, [staff.settings]);

  const set = <K extends keyof NotifSettings>(key: K, val: NotifSettings[K]) => {
    setDraft(d => ({ ...d, [key]: val }));
    setDirty(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/ai/notification-prefs/${staff.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: `تم حفظ إعدادات "${staff.fullName}"` });
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["notif-prefs"] });
    },
    onError: () => toast({ title: "فشل الحفظ", variant: "destructive" }),
  });

  const statusColor = !draft.enabled
    ? "border-l-gray-400"
    : draft.pref === "off"
    ? "border-l-gray-400"
    : draft.pref === "critical_only"
    ? "border-l-orange-400"
    : "border-l-green-500";

  return (
    <Card className={`border-l-4 ${statusColor} transition-shadow`}>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold truncate" dir="rtl">{staff.fullName}</CardTitle>
            <p className="text-xs text-muted-foreground capitalize mt-0.5">{staff.role}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {draft.enabled ? (
              <Badge className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 border-green-300">مفعّل</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-gray-500">موقف</Badge>
            )}
            <Toggle checked={draft.enabled} onChange={v => set("enabled", v)} />
          </div>
        </div>

        {/* Timing buttons */}
        <div className="grid grid-cols-4 gap-1 mt-3">
          {PREF_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => set("pref", opt.value)}
              disabled={!draft.enabled}
              className={`text-[10px] py-1 px-0.5 rounded border font-medium transition-all ${
                draft.pref === opt.value ? opt.color : "bg-background text-muted-foreground border-border"
              } ${!draft.enabled ? "opacity-40 cursor-not-allowed" : "hover:opacity-80"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-2">
        {/* Expand button */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full mb-2"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? "إخفاء التفاصيل" : "إعدادات تفصيلية"}
        </button>

        {expanded && (
          <div className="border rounded-lg px-3 py-1 mb-3 bg-muted/30">
            <ToggleRow
              icon={Smartphone} label="Push Notifications" desc="إشعارات الهاتف حتى التطبيق مغلق"
              checked={draft.push} onChange={v => set("push", v)} disabled={!draft.enabled}
            />
            <ToggleRow
              icon={ListTodo} label="إشعارات المهام" desc="تذكير بالمهام والمواعيد"
              checked={draft.tasks} onChange={v => set("tasks", v)} disabled={!draft.enabled}
            />
            <ToggleRow
              icon={Users} label="إشعارات الطلاب الجدد" desc="عند إضافة طالب جديد"
              checked={draft.newStudents} onChange={v => set("newStudents", v)} disabled={!draft.enabled}
            />
            <ToggleRow
              icon={GitMerge} label="إشعارات المتابعات" desc="تذكير بالمتابعات المعلقة"
              checked={draft.followups} onChange={v => set("followups", v)} disabled={!draft.enabled}
            />
            <ToggleRow
              icon={CheckSquare} label="إشعارات Checklist" desc="تنبيهات قوائم المهام"
              checked={draft.checklist} onChange={v => set("checklist", v)} disabled={!draft.enabled}
            />
            <ToggleRow
              icon={Cpu} label="إشعارات AI" desc="تنبيهات الذكاء الاصطناعي"
              checked={draft.ai} onChange={v => set("ai", v)} disabled={!draft.enabled}
              ownerOnly isOwner={isOwner}
            />
            <ToggleRow
              icon={draft.sound ? Volume2 : VolumeX} label="صوت الإشعار" desc="تشغيل صوت عند وصول الإشعار"
              checked={draft.sound} onChange={v => set("sound", v)} disabled={!draft.enabled}
            />

            {/* Reminder interval */}
            <div className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium">تكرار التذكير</p>
                  <p className="text-[10px] text-muted-foreground">كل كم دقيقة يتكرر التذكير</p>
                </div>
              </div>
              <select
                value={draft.reminderIntervalMin}
                onChange={e => set("reminderIntervalMin", parseInt(e.target.value))}
                disabled={!draft.enabled}
                className="text-xs border rounded-lg px-2 py-1 bg-background disabled:opacity-40"
              >
                {REMINDER_OPTIONS.map(m => (
                  <option key={m} value={m}>{m} دقيقة</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {dirty && (
          <Button
            size="sm"
            className="w-full h-8 text-xs gap-1.5"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            <Save className="w-3.5 h-3.5" />
            {save.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function NotificationManagement() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const perms = user?.permissions ?? [];
  const canManage = perms.includes("manage_staff") || perms.includes("manage_ai_control");
  const isOwner = user?.role === "owner";

  if (!canManage) {
    navigate("/gab-c7x2p");
    return null;
  }

  const { data, isLoading } = useQuery<StaffRow[]>({
    queryKey: ["notif-prefs"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/ai/notification-prefs`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const rows = data ?? [];
  const enabledCount  = rows.filter(r => r.settings.enabled).length;
  const disabledCount = rows.length - enabledCount;
  const pushCount     = rows.filter(r => r.settings.push && r.settings.enabled).length;

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <BellRing className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">إدارة الإشعارات</h2>
              <p className="text-sm text-muted-foreground">تحكم في إعدادات إشعارات كل موظف — الموظفون لا يستطيعون تغيير هذه الإعدادات</p>
            </div>
          </div>
        </div>

        {/* Policy notice */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <Shield className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold mb-0.5">سياسة الإشعارات الإجبارية</p>
            <p className="text-xs">الإشعارات جزء من سياسة النظام. الموظفون لا يستطيعون تعديل أي إعداد خاص بإشعاراتهم. إذا قام موظف بتعطيل إشعارات المتصفح يدوياً، يُسجَّل ذلك تلقائياً في سجل النشاط ويُرسَل تنبيه للمالك.</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <div className="flex justify-center mb-1"><Bell className="w-5 h-5 text-green-600" /></div>
              <p className="text-2xl font-bold text-green-600">{enabledCount}</p>
              <p className="text-xs text-muted-foreground">إشعارات مفعّلة</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <div className="flex justify-center mb-1"><BellOff className="w-5 h-5 text-gray-400" /></div>
              <p className="text-2xl font-bold text-gray-500">{disabledCount}</p>
              <p className="text-xs text-muted-foreground">موقوفة</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <div className="flex justify-center mb-1"><Smartphone className="w-5 h-5 text-blue-600" /></div>
              <p className="text-2xl font-bold text-blue-600">{pushCount}</p>
              <p className="text-xs text-muted-foreground">Push مفعّل</p>
            </CardContent>
          </Card>
        </div>

        {/* Staff grid */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">لا يوجد موظفون.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map(s => (
              <StaffCard key={s.id} staff={s} isOwner={isOwner} />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
