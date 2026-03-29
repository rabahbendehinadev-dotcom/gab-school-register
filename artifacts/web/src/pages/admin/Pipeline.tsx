import { useState, useRef } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  useListStudents,
  useUpdateStudentStage,
  useUpdateStudent,
  getListStudentsQueryKey,
  Student,
  StudentStage,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Phone, MapPin, MoreHorizontal, MessageCircle, ChevronDown, DollarSign, CheckCircle2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { useI18n } from "@/contexts/i18n-context";

type StageConfig = {
  id: StudentStage;
  cardBg: string;
  cardBorder: string;
  headerBg: string;
  headerText: string;
  badgeBg: string;
  dotColor: string;
  waBtnClass: string;
};

const STAGE_CONFIGS: StageConfig[] = [
  {
    id: "new",
    cardBg: "bg-blue-50",
    cardBorder: "border-blue-200",
    headerBg: "bg-blue-600",
    headerText: "text-white",
    badgeBg: "bg-blue-100 text-blue-700",
    dotColor: "bg-blue-400",
    waBtnClass: "bg-blue-500 hover:bg-blue-600",
  },
  {
    id: "contacted",
    cardBg: "bg-orange-50",
    cardBorder: "border-orange-200",
    headerBg: "bg-orange-500",
    headerText: "text-white",
    badgeBg: "bg-orange-100 text-orange-700",
    dotColor: "bg-orange-400",
    waBtnClass: "bg-orange-500 hover:bg-orange-600",
  },
  {
    id: "interested",
    cardBg: "bg-green-50",
    cardBorder: "border-green-200",
    headerBg: "bg-green-600",
    headerText: "text-white",
    badgeBg: "bg-green-100 text-green-700",
    dotColor: "bg-green-400",
    waBtnClass: "bg-green-500 hover:bg-green-600",
  },
  {
    id: "no_show",
    cardBg: "bg-red-50",
    cardBorder: "border-red-200",
    headerBg: "bg-red-500",
    headerText: "text-white",
    badgeBg: "bg-red-100 text-red-700",
    dotColor: "bg-red-400",
    waBtnClass: "bg-red-500 hover:bg-red-600",
  },
  {
    id: "archived",
    cardBg: "bg-gray-50",
    cardBorder: "border-gray-200",
    headerBg: "bg-gray-500",
    headerText: "text-white",
    badgeBg: "bg-gray-100 text-gray-600",
    dotColor: "bg-gray-400",
    waBtnClass: "bg-gray-500 hover:bg-gray-600",
  },
];

type ContactReason = "spoken" | "phone_busy" | "no_answer";

const CONTACT_REASONS: { value: ContactReason; labelAr: string; labelFr: string; emoji: string }[] = [
  { value: "spoken",     labelAr: "تم التحدث",    labelFr: "Conversation établie", emoji: "✅" },
  { value: "phone_busy", labelAr: "الهاتف مغلق",  labelFr: "Téléphone éteint",     emoji: "📵" },
  { value: "no_answer",  labelAr: "لم يرد",        labelFr: "Pas de réponse",       emoji: "📞" },
];

function getWhatsAppMsg(
  stage: StudentStage,
  name: string,
  t: ReturnType<typeof useI18n>["t"],
  contactReason?: string | null,
): string {
  if (stage === "contacted") {
    if (contactReason === "phone_busy") return t.phoneBusyMsg(name);
    if (contactReason === "no_answer") return t.noAnswerMsg(name);
    return t.contactedMsg(name);
  }
  switch (stage) {
    case "new":      return t.newLeadMsg(name);
    case "interested": return t.interestedMsg(name);
    case "no_show":  return t.noShowMsg(name);
    case "archived": return t.archivedMsg(name);
    default:         return `مرحباً ${name}!`;
  }
}

function toIntlPhone(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  if (clean.startsWith("0") && clean.length === 10) clean = "213" + clean.slice(1);
  else if (clean.startsWith("5") && clean.length === 9) clean = "213" + clean;
  return clean;
}

function openWhatsApp(phone: string, msg: string) {
  const intl = toIntlPhone(phone);
  const encoded = encodeURIComponent(msg);
  window.open(`https://wa.me/${intl}?text=${encoded}`, "_blank");
}

export default function Pipeline() {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { data: students, isLoading } = useListStudents();
  const updateStageMutation = useUpdateStudentStage({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() }),
    },
  });

  if (isLoading)
    return (
      <AdminLayout>
        <div className="animate-pulse">Loading pipeline...</div>
      </AdminLayout>
    );

  const grouped = STAGE_CONFIGS.reduce(
    (acc, cfg) => {
      acc[cfg.id] = students?.filter((s) => s.stage === cfg.id) || [];
      return acc;
    },
    {} as Record<StudentStage, Student[]>,
  );

  const handleStageChange = (id: number, stage: StudentStage) => {
    updateStageMutation.mutate({ id, data: { stage } });
  };

  return (
    <AdminLayout>
      <div className="flex h-[calc(100vh-8rem)] gap-4 sm:gap-5 overflow-x-auto pb-4 scrollbar-hide">
        {STAGE_CONFIGS.map((cfg) => {
          const label = t.stageLabels[cfg.id];
          return (
            <div
              key={cfg.id}
              className="flex-shrink-0 w-72 flex flex-col rounded-2xl overflow-hidden shadow-sm border border-gray-200"
            >
              <div className={`${cfg.headerBg} px-4 py-3 flex items-center justify-between`}>
                <h3 className={`font-bold text-sm flex items-center gap-2 ${cfg.headerText}`}>
                  <span className="w-2 h-2 rounded-full bg-white/70" />
                  {label}
                </h3>
                <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {grouped[cfg.id].length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50/60">
                {grouped[cfg.id].map((student) => (
                  <StudentCard
                    key={student.id}
                    student={student}
                    cfg={cfg}
                    t={t}
                    stages={STAGE_CONFIGS}
                    onStageChange={handleStageChange}
                    onUpdate={() => queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() })}
                  />
                ))}

                {grouped[cfg.id].length === 0 && (
                  <div className="h-32 flex items-center justify-center text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-white/60">
                    {t.empty}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AdminLayout>
  );
}

function StudentCard({
  student,
  cfg,
  t,
  stages,
  onStageChange,
  onUpdate,
}: {
  student: Student;
  cfg: StageConfig;
  t: ReturnType<typeof useI18n>["t"];
  stages: StageConfig[];
  onStageChange: (id: number, stage: StudentStage) => void;
  onUpdate: () => void;
}) {
  const { lang } = useI18n();
  const updateMutation = useUpdateStudent({ mutation: { onSuccess: onUpdate } });

  const [localReason, setLocalReason] = useState<ContactReason>(
    (student.contactReason as ContactReason) || "spoken",
  );
  const [localNote, setLocalNote] = useState(student.note ?? "");
  const [localPaymentStatus, setLocalPaymentStatus] = useState<"unpaid" | "deposited" | "paid">(
    (student.paymentStatus as "unpaid" | "deposited" | "paid") ?? "unpaid",
  );
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const fullName = `${student.firstName} ${student.lastName}`;
  const waMsg = getWhatsAppMsg(student.stage as StudentStage, fullName, t, localReason);

  const isContacted  = student.stage === "contacted";
  const isInterested = student.stage === "interested";

  const currentReason = CONTACT_REASONS.find((r) => r.value === localReason) ?? CONTACT_REASONS[0];

  function handleReasonChange(val: ContactReason) {
    setLocalReason(val);
    updateMutation.mutate({ id: student.id, data: { contactReason: val } });
  }

  function handleNoteBlur() {
    if (localNote !== (student.note ?? "")) {
      updateMutation.mutate({ id: student.id, data: { note: localNote || null } });
    }
  }

  function handlePaymentCycle() {
    const next: Record<string, "unpaid" | "deposited" | "paid"> = {
      unpaid: "deposited",
      deposited: "paid",
      paid: "paid",
    };
    const newStatus = next[localPaymentStatus] ?? "deposited";
    if (newStatus === localPaymentStatus) return;
    setLocalPaymentStatus(newStatus);
    updateMutation.mutate({ id: student.id, data: { paymentStatus: newStatus } });
  }

  return (
    <div
      className={`${cfg.cardBg} rounded-xl p-4 shadow-sm border ${cfg.cardBorder} hover:shadow-md transition-all group`}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-bold text-sm text-gray-800">{fullName}</h4>
        <DropdownMenu>
          <DropdownMenuTrigger className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 rounded-md hover:bg-black/10 active:bg-black/20 transition-opacity touch-manipulation">
            <MoreHorizontal className="w-4 h-4 text-gray-600" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t.moveTo}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {stages
              .filter((s) => s.id !== student.stage)
              .map((s) => (
                <DropdownMenuItem key={s.id} onClick={() => onStageChange(student.id, s.id)}>
                  {t.stageLabels[s.id]}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Info */}
      <div className="space-y-1.5 mt-2">
        <div className="flex items-center text-xs text-gray-600">
          <Phone className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" /> {student.phone}
        </div>
        <div className="flex items-center text-xs text-gray-600">
          <MapPin className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" /> {student.city}
        </div>
      </div>

      {/* ── CONTACTED extras ── */}
      {isContacted && (
        <div className="mt-3 space-y-2">
          {/* Contact reason dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center justify-between gap-2 bg-white border border-orange-200 rounded-lg px-3 py-2 text-xs font-medium text-gray-700 hover:bg-orange-50 transition-colors">
                <span className="flex items-center gap-1.5">
                  <span>{currentReason.emoji}</span>
                  <span>{lang === "fr" ? currentReason.labelFr : currentReason.labelAr}</span>
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel className="text-xs text-gray-500">
                {lang === "fr" ? "Résultat du contact" : "نتيجة التواصل"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {CONTACT_REASONS.map((r) => (
                <DropdownMenuItem
                  key={r.value}
                  onClick={() => handleReasonChange(r.value)}
                  className={localReason === r.value ? "bg-orange-50 font-semibold" : ""}
                >
                  <span className="mr-2">{r.emoji}</span>
                  {lang === "fr" ? r.labelFr : r.labelAr}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Note textarea */}
          <textarea
            ref={noteRef}
            value={localNote}
            onChange={(e) => setLocalNote(e.target.value)}
            onBlur={handleNoteBlur}
            placeholder={lang === "fr" ? "Ajouter une note..." : "أضف ملاحظة..."}
            rows={2}
            className="w-full text-xs rounded-lg border border-orange-200 bg-white px-3 py-2 resize-none placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-300 transition"
          />
        </div>
      )}

      {/* ── INTERESTED extras — 3-state payment button ── */}
      {isInterested && (
        <div className="mt-3">
          {localPaymentStatus === "paid" ? (
            <div className="flex items-center justify-center gap-2 bg-green-100 text-green-700 font-semibold text-xs rounded-lg py-2 border border-green-200">
              <CheckCircle2 className="w-4 h-4" />
              {lang === "fr" ? "Paiement complet ✅" : "مدفوع ✅"}
            </div>
          ) : localPaymentStatus === "deposited" ? (
            <button
              onClick={handlePaymentCycle}
              className="w-full flex items-center justify-center gap-2 bg-white border-2 border-green-400 text-green-700 font-semibold text-xs rounded-lg py-2 hover:bg-green-50 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {lang === "fr" ? "Paiement complet ?" : "مدفوع كامل؟"}
            </button>
          ) : (
            <button
              onClick={handlePaymentCycle}
              className="w-full flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-semibold text-xs rounded-lg py-2 transition-colors"
            >
              <DollarSign className="w-3.5 h-3.5" />
              {lang === "fr" ? "Dépôt payé 💰" : "تم إيداع المبلغ 💰"}
            </button>
          )}
        </div>
      )}

      {/* Payment badge for interested and beyond (excluding the interactive button which handles it for interested) */}
      {!isInterested && ["interested", "no_show", "archived"].includes(student.stage) && localPaymentStatus !== "unpaid" && (
        <div className="mt-3">
          {localPaymentStatus === "paid" ? (
            <div className="flex items-center justify-center gap-1.5 bg-green-100 text-green-700 text-xs font-semibold rounded-lg py-1.5 border border-green-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {lang === "fr" ? "Paiement complet ✅" : "مدفوع ✅"}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-lg py-1.5 border border-yellow-200">
              <DollarSign className="w-3.5 h-3.5" />
              {lang === "fr" ? "Dépôt payé 💰" : "تم الإيداع 💰"}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-black/10 flex justify-between items-center gap-2">
        <span className={`text-[10px] font-medium uppercase tracking-wider px-2 py-1 rounded-md ${cfg.badgeBg}`}>
          {student.trainingType === "online" ? t.online : t.physical}
        </span>
        <span className="text-[10px] text-gray-500">{format(new Date(student.createdAt), "MMM d")}</span>
      </div>

      {/* WhatsApp Button */}
      <button
        onClick={() => openWhatsApp(student.phone, waMsg)}
        className={`mt-3 w-full flex items-center justify-center gap-2 text-white text-xs font-semibold py-2 rounded-lg transition-colors ${cfg.waBtnClass}`}
      >
        <MessageCircle className="w-3.5 h-3.5" />
        {t.sendWhatsApp}
      </button>
    </div>
  );
}
