import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, X, UserPlus, Clock, PhoneOff, AlertCircle } from "lucide-react";
import { useI18n } from "@/contexts/i18n-context";

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  studentId: number | null;
  handled: boolean;
  handledAt: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: AppNotification[];
  unhandledCount: number;
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

// ── Notification sound: a short two-tone chime via Web Audio (no asset needed) ──
let sharedCtx: AudioContext | null = null;
function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!sharedCtx) sharedCtx = new Ctx();
    const ctx = sharedCtx;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const tones = [880, 1175];
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  } catch {
    /* ignore */
  }
}

function iconForType(type: string) {
  switch (type) {
    case "new_registration": return <UserPlus className="w-4 h-4 text-blue-600" />;
    case "waiting_payment":  return <Clock    className="w-4 h-4 text-amber-600" />;
    case "not_contacted":    return <PhoneOff className="w-4 h-4 text-red-600"   />;
    default:                 return <AlertCircle className="w-4 h-4 text-gray-500" />;
  }
}

const REALERT_MS = 10 * 60 * 1000;
const POLL_MS    = 20 * 1000;

export function NotificationCenter() {
  const { lang } = useI18n();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [open, setOpen]   = useState(false);
  const [popup, setPopup] = useState<AppNotification | null>(null);

  // bellRef  → the bell button wrapper (always in the DOM)
  // panelRef → the portalled panel div (only when open)
  // Both needed for click-outside: clicking either one should NOT close the panel.
  const bellRef  = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const prevTopIdRef  = useRef<number | null>(null);
  const lastAlertRef  = useRef<number>(0);
  const seededRef     = useRef(false);

  const { data } = useQuery<NotificationsResponse>({
    queryKey: ["notifications"],
    queryFn: () => apiFetch("/notifications"),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
  });

  const notifications  = data?.notifications ?? [];
  const unhandled      = notifications.filter((n) => !n.handled);
  const unhandledCount = data?.unhandledCount ?? unhandled.length;

  const handleMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/notifications/${id}/handle`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const handleAllMutation = useMutation({
    mutationFn: () => apiFetch("/notifications/handle-all", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const alert = useCallback((n: AppNotification | null) => {
    playChime();
    if (n) {
      setPopup(n);
      window.setTimeout(() => setPopup((cur) => (cur?.id === n.id ? null : cur)), 8000);
    }
    lastAlertRef.current = Date.now();
  }, []);

  useEffect(() => {
    const topUnhandled = unhandled[0] ?? null;
    if (!seededRef.current) {
      seededRef.current = true;
      prevTopIdRef.current = topUnhandled?.id ?? null;
      if (unhandledCount > 0) lastAlertRef.current = Date.now();
      return;
    }
    if (topUnhandled && topUnhandled.id !== prevTopIdRef.current) {
      prevTopIdRef.current = topUnhandled.id;
      alert(topUnhandled);
    } else if (!topUnhandled) {
      prevTopIdRef.current = null;
    }
  }, [unhandled, unhandledCount, alert]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (unhandledCount > 0 && Date.now() - lastAlertRef.current >= REALERT_MS) {
        alert(unhandled[0] ?? null);
      }
    }, 30 * 1000);
    return () => window.clearInterval(interval);
  }, [unhandledCount, unhandled, alert]);

  // Close on click outside – must check both the bell wrapper AND the portalled panel
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const inBell  = bellRef.current?.contains(e.target as Node);
      const inPanel = panelRef.current?.contains(e.target as Node);
      if (!inBell && !inPanel) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function openStudent(n: AppNotification) {
    setOpen(false);
    setPopup(null);
    handleMutation.mutate(n.id);
    if (n.studentId) navigate(`/gab-c7x2p/students/${n.studentId}`);
  }

  const fmt = (iso: string) => {
    const d    = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return lang === "fr" ? "à l'instant" : "الآن";
    if (mins < 60) return lang === "fr" ? `il y a ${mins} min` : `منذ ${mins} د`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return lang === "fr" ? `il y a ${hrs} h` : `منذ ${hrs} س`;
    return d.toLocaleDateString(lang === "fr" ? "fr-FR" : "ar-DZ");
  };

  const labels = {
    title:      lang === "fr" ? "Notifications"        : "الإشعارات",
    handleAll:  lang === "fr" ? "Tout traiter"         : "معالجة الكل",
    handle:     lang === "fr" ? "Traité"               : "تم التعامل",
    empty:      lang === "fr" ? "Aucune notification"  : "لا توجد إشعارات",
  };

  // ── Main notification panel (portalled into body) ────────────────────────────
  const panel = open ? createPortal(
    <div
      ref={panelRef}
      style={{ position: "fixed", top: "64px", right: "16px", zIndex: 9999 }}
      className="w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[calc(100vh-80px)]"
      dir={lang === "fr" ? "ltr" : "rtl"}
    >
      {/* Header – always visible */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40 rounded-t-2xl flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <span className="font-bold text-sm">{labels.title}</span>
          {unhandledCount > 0 && (
            <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
              {unhandledCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unhandledCount > 0 && (
            <button
              onClick={() => handleAllMutation.mutate()}
              disabled={handleAllMutation.isPending}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:opacity-50"
            >
              <CheckCheck className="w-3.5 h-3.5" />{labels.handleAll}
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable list */}
      <div className="overflow-y-auto flex-1 min-h-0">
        {notifications.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">{labels.empty}</div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`flex gap-3 px-4 py-3 border-b border-border/50 last:border-0 transition-colors ${n.handled ? "opacity-55" : "bg-primary/[0.03]"} hover:bg-muted/50`}
            >
              <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                {iconForType(n.type)}
              </div>
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => openStudent(n)}
                  className="text-right w-full block"
                  disabled={!n.studentId}
                >
                  <p className="text-sm font-semibold text-foreground leading-tight">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 break-words">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">{fmt(n.createdAt)}</p>
                </button>
              </div>
              {!n.handled && (
                <button
                  onClick={() => handleMutation.mutate(n.id)}
                  title={labels.handle}
                  className="flex-shrink-0 self-center flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg px-2 py-1 transition-colors"
                >
                  <Check className="w-3 h-3" />{labels.handle}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>,
    document.body
  ) : null;

  // ── Floating popup for newly-arrived notifications (also portalled) ───────────
  const floatingPopup = popup ? createPortal(
    <div
      style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 9998 }}
      className="w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border-2 border-primary/30 bg-card shadow-2xl p-4"
      dir={lang === "fr" ? "ltr" : "rtl"}
    >
      <button
        onClick={() => setPopup(null)}
        className="absolute top-2 end-2 p-1 rounded-full hover:bg-muted"
      >
        <X className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
          {iconForType(popup.type)}
        </div>
        <div className="flex-1 min-w-0 pe-4">
          <p className="text-sm font-bold text-foreground">{popup.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 break-words">{popup.message}</p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        {popup.studentId && (
          <button
            onClick={() => openStudent(popup)}
            className="flex-1 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg py-2 transition-colors"
          >
            {lang === "fr" ? "Voir l'étudiant" : "عرض الطالب"}
          </button>
        )}
        <button
          onClick={() => { handleMutation.mutate(popup.id); setPopup(null); }}
          className="flex-1 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg py-2 transition-colors"
        >
          {labels.handle}
        </button>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {/* Bell button – stays in the header layout */}
      <div className="relative" ref={bellRef}>
        <button
          onClick={() => { setOpen((o) => !o); if (sharedCtx?.state === "suspended") sharedCtx.resume().catch(() => {}); }}
          className="relative p-2 rounded-full hover:bg-muted transition-colors"
          aria-label={labels.title}
        >
          <Bell className={`w-5 h-5 ${unhandledCount > 0 ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
          {unhandledCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold ring-2 ring-card">
              {unhandledCount > 99 ? "99+" : unhandledCount}
            </span>
          )}
        </button>
      </div>

      {/* Portalled panel and popup – rendered directly in document.body */}
      {panel}
      {floatingPopup}
    </>
  );
}
