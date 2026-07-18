import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/contexts/i18n-context";
import {
  LayoutDashboard, Users, Layers, ShieldCheck, Activity,
  ClipboardList, ListTodo, RadioTower, BarChart2, Cpu,
  BellRing, Search, Phone, ArrowRight, X, Hash,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface StudentResult {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  stage: string;
  groupName?: string | null;
}

const STAGES: Record<string, { fr: string; ar: string; cls: string }> = {
  new:               { fr: "Nouveau",       ar: "جديد",         cls: "bg-blue-100 text-blue-700" },
  contacted:         { fr: "Contacté",      ar: "تم التواصل",   cls: "bg-amber-100 text-amber-700" },
  interested:        { fr: "Intéressé",     ar: "مهتم",         cls: "bg-green-100 text-green-700" },
  payment_pending:   { fr: "Attente paiement", ar: "ينتظر الدفع", cls: "bg-yellow-100 text-yellow-700" },
  payment_confirmed: { fr: "Paiement ok",   ar: "تم الدفع",     cls: "bg-emerald-100 text-emerald-700" },
  confirmed:         { fr: "Confirmé",      ar: "مؤكد",         cls: "bg-indigo-100 text-indigo-700" },
  attended:          { fr: "Présent",       ar: "حضر",          cls: "bg-teal-100 text-teal-700" },
  no_show:           { fr: "Absent",        ar: "لم يحضر",      cls: "bg-red-100 text-red-700" },
  completed:         { fr: "Terminé",       ar: "مكتمل",        cls: "bg-purple-100 text-purple-700" },
  archived:          { fr: "Archivé",       ar: "أرشيف",        cls: "bg-gray-100 text-gray-500" },
};

const NAV_ITEMS = [
  { href: "/gab-c7x2p",                      fr: "Tableau de bord",          ar: "لوحة التحكم",         icon: LayoutDashboard },
  { href: "/gab-c7x2p/students",             fr: "Étudiants",                ar: "الطلاب",              icon: Users },
  { href: "/gab-c7x2p/groups",              fr: "Groupes / Planning",       ar: "المجموعات",           icon: Layers },
  { href: "/gab-c7x2p/tasks",               fr: "Tâches",                   ar: "المهام",              icon: ListTodo },
  { href: "/gab-c7x2p/staff",               fr: "Personnel",                ar: "الفريق",              icon: ShieldCheck },
  { href: "/gab-c7x2p/staff-activity",      fr: "Activité équipe",          ar: "نشاط الفريق",         icon: RadioTower },
  { href: "/gab-c7x2p/checklist-admin",     fr: "Gestion des tâches",       ar: "إدارة المهام",        icon: ClipboardList },
  { href: "/gab-c7x2p/activity",            fr: "Journal d'activité",       ar: "سجل النشاط",          icon: Activity },
  { href: "/gab-c7x2p/reports",             fr: "Rapports de performance",  ar: "تقارير الأداء",       icon: BarChart2 },
  { href: "/gab-c7x2p/notification-management", fr: "Gestion notifications", ar: "إدارة الإشعارات",   icon: BellRing },
  { href: "/gab-c7x2p/ai-control",          fr: "Tableau de bord IA",       ar: "التحكم المتقدم",      icon: Cpu },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: Props) {
  const { lang } = useI18n();
  const isFr = lang === "fr";
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query, 220);

  const { data: students = [], isFetching } = useQuery<StudentResult[]>({
    queryKey: ["global-search", debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 2) return [];
      const r = await fetch(
        `${BASE}/api/students?search=${encodeURIComponent(debouncedQuery)}&limit=8`,
        { credentials: "include" }
      );
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : (data.students ?? []);
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 20_000,
  });

  const filteredNav = NAV_ITEMS.filter(item => {
    if (!query) return true;
    const label = isFr ? item.fr : item.ar;
    return label.toLowerCase().includes(query.toLowerCase()) ||
           item.href.includes(query.toLowerCase());
  }).slice(0, query ? 5 : 8);

  const allResults = [
    ...students.map(s => ({ type: "student" as const, student: s })),
    ...filteredNav.map(n => ({ type: "nav" as const, nav: n })),
  ];

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSelect = useCallback((idx: number) => {
    const item = allResults[idx];
    if (!item) return;
    if (item.type === "student") {
      navigate(`/gab-c7x2p/students/${item.student.id}`);
    } else {
      navigate(item.nav.href);
    }
    onClose();
  }, [allResults, navigate, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, allResults.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
      if (e.key === "Enter") { e.preventDefault(); handleSelect(activeIdx); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, activeIdx, allResults.length, handleSelect, onClose]);

  if (!open) return null;

  const initials = (s: StudentResult) =>
    `${s.firstName?.[0] ?? ""}${s.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4" dir={isFr ? "ltr" : "rtl"}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-card rounded-2xl shadow-2xl border border-border/60 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/50">
          <Search className="w-4.5 h-4.5 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={isFr ? "Rechercher un étudiant, une page..." : "ابحث عن طالب أو صفحة..."}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center gap-1.5">
            {isFetching && <div className="w-3.5 h-3.5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />}
            <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[420px] overflow-y-auto py-2">
          {/* Student results */}
          {students.length > 0 && (
            <div>
              <div className="px-4 py-1.5 flex items-center gap-1.5">
                <Users className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {isFr ? "Étudiants" : "الطلاب"}
                </span>
              </div>
              {students.map((s, i) => {
                const stage = STAGES[s.stage];
                const isActive = i === activeIdx;
                return (
                  <button
                    key={s.id}
                    onClick={() => handleSelect(i)}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors ${isActive ? "bg-primary/8 text-foreground" : "hover:bg-muted/60"}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                      {initials(s)}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium truncate">{s.firstName} {s.lastName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{s.phone}</span>
                        {stage && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${stage.cls}`}>
                            {isFr ? stage.fr : stage.ar}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Empty student state */}
          {debouncedQuery.length >= 2 && students.length === 0 && !isFetching && (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              {isFr ? "Aucun étudiant trouvé" : "لا يوجد طالب بهذا الاسم"}
            </div>
          )}

          {/* Navigation */}
          {filteredNav.length > 0 && (
            <div className={students.length > 0 ? "mt-2 border-t border-border/40 pt-2" : ""}>
              <div className="px-4 py-1.5 flex items-center gap-1.5">
                <Hash className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {isFr ? "Navigation" : "التنقل"}
                </span>
              </div>
              {filteredNav.map((nav, j) => {
                const idx = students.length + j;
                const isActive = idx === activeIdx;
                return (
                  <button
                    key={nav.href}
                    onClick={() => handleSelect(idx)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors ${isActive ? "bg-primary/8 text-foreground" : "hover:bg-muted/60"}`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <nav.icon className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <span className="text-sm flex-1 text-left">{isFr ? nav.fr : nav.ar}</span>
                    <kbd className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">↵</kbd>
                  </button>
                );
              })}
            </div>
          )}

          {!query && students.length === 0 && (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                {isFr ? "Tapez pour rechercher un étudiant ou une page" : "اكتب للبحث عن طالب أو صفحة"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {isFr ? "Naviguez avec ↑↓ et validez avec ↵" : "تنقّل بـ ↑↓ واضغط ↵ للتأكيد"}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span><kbd className="bg-muted px-1 py-0.5 rounded">↑↓</kbd> {isFr ? "naviguer" : "تنقل"}</span>
            <span><kbd className="bg-muted px-1 py-0.5 rounded">↵</kbd> {isFr ? "ouvrir" : "فتح"}</span>
            <span><kbd className="bg-muted px-1 py-0.5 rounded">Esc</kbd> {isFr ? "fermer" : "إغلاق"}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">GAB CRM</span>
        </div>
      </div>
    </div>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
