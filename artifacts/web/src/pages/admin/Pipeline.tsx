import { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useListStudents, useUpdateStudentStage, getListStudentsQueryKey, Student, StudentStage } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Phone, MapPin, MoreHorizontal, MessageCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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

function getWhatsAppMsg(stage: StudentStage, name: string, t: ReturnType<typeof useI18n>["t"]): string {
  switch (stage) {
    case "new": return t.newLeadMsg(name);
    case "contacted": return t.contactedMsg(name);
    case "interested": return t.interestedMsg(name);
    case "no_show": return t.noShowMsg(name);
    case "archived": return t.archivedMsg(name);
    default: return `مرحباً ${name}!`;
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
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() })
    }
  });

  if (isLoading) return <AdminLayout><div className="animate-pulse">Loading pipeline...</div></AdminLayout>;

  const grouped = STAGE_CONFIGS.reduce((acc, cfg) => {
    acc[cfg.id] = students?.filter(s => s.stage === cfg.id) || [];
    return acc;
  }, {} as Record<StudentStage, Student[]>);

  const handleStageChange = (id: number, stage: StudentStage) => {
    updateStageMutation.mutate({ id, data: { stage } });
  };

  return (
    <AdminLayout>
      <div className="flex h-[calc(100vh-8rem)] gap-4 sm:gap-5 overflow-x-auto pb-4 scrollbar-hide">
        {STAGE_CONFIGS.map((cfg) => {
          const label = t.stageLabels[cfg.id];
          return (
            <div key={cfg.id} className="flex-shrink-0 w-72 flex flex-col rounded-2xl overflow-hidden shadow-sm border border-gray-200">
              {/* Colored column header */}
              <div className={`${cfg.headerBg} px-4 py-3 flex items-center justify-between`}>
                <h3 className={`font-bold text-sm flex items-center gap-2 ${cfg.headerText}`}>
                  <span className="w-2 h-2 rounded-full bg-white/70" />
                  {label}
                </h3>
                <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {grouped[cfg.id].length}
                </span>
              </div>

              {/* Column Content */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50/60">
                {grouped[cfg.id].map(student => (
                  <StudentCard
                    key={student.id}
                    student={student}
                    cfg={cfg}
                    t={t}
                    stages={STAGE_CONFIGS}
                    onStageChange={handleStageChange}
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
}: {
  student: Student;
  cfg: StageConfig;
  t: ReturnType<typeof useI18n>["t"];
  stages: StageConfig[];
  onStageChange: (id: number, stage: StudentStage) => void;
}) {
  const [showWaMenu, setShowWaMenu] = useState(false);
  const fullName = `${student.firstName} ${student.lastName}`;
  const waMsg = getWhatsAppMsg(student.stage as StudentStage, fullName, t);

  return (
    <div className={`${cfg.cardBg} rounded-xl p-4 shadow-sm border ${cfg.cardBorder} hover:shadow-md transition-all group`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-bold text-sm text-gray-800">{fullName}</h4>
        <DropdownMenu>
          <DropdownMenuTrigger className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-black/10 transition-opacity">
            <MoreHorizontal className="w-4 h-4 text-gray-600" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t.moveTo}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {stages.filter(s => s.id !== student.stage).map(s => (
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

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-black/10 flex justify-between items-center gap-2">
        <span className={`text-[10px] font-medium uppercase tracking-wider px-2 py-1 rounded-md ${cfg.badgeBg}`}>
          {student.trainingType === "online" ? t.online : t.physical}
        </span>
        <span className="text-[10px] text-gray-500">
          {format(new Date(student.createdAt), "MMM d")}
        </span>
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
