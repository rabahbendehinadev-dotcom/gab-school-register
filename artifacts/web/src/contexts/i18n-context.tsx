import { createContext, useContext, useState, ReactNode } from "react";

export type Lang = "ar" | "fr";

const translations = {
  ar: {
    dashboard: "لوحة التحكم",
    pipeline: "خط الإنتاج",
    students: "الطلاب",
    groups: "المجموعات",
    gallery: "المعرض",
    staff: "الفريق",
    activityLog: "سجل النشاط",
    openDay: "اليوم المفتوح",
    navigation: "التنقل",
    logout: "تسجيل الخروج",
    viewSite: "عرض الموقع",
    totalStudents: "إجمالي الطلاب",
    newLeads: "تسجيلات جديدة",
    contacted: "تم التواصل",
    interested: "مهتم",
    noShows: "لم يحضر",
    archived: "مؤرشف",
    totalGroups: "إجمالي المجموعات",
    openGroups: "مجموعات مفتوحة",
    systemOverview: "نظرة عامة على النظام",
    recentActivity: "النشاط الأخير",
    noRecentActivity: "لا يوجد نشاط حديث",
    moveTo: "نقل إلى...",
    empty: "فارغ",
    online: "أونلاين",
    physical: "حضوري",
    sendWhatsApp: "إرسال واتساب",
    newLeadMsg: (name: string) =>
      `مرحباً ${name}! 🎉 لقد تم تسجيلك بنجاح في أكاديمية GAB SCHOOL. سنتواصل معك قريباً لتأكيد تفاصيل الدورة. مع تحياتنا 🌟`,
    contactedMsg: (name: string) =>
      `مرحباً ${name}! 😊 تواصلنا معك مسبقاً بخصوص الانضمام إلى أكاديمية GAB SCHOOL. نذكّرك بأن مقاعد الدورة محدودة. هل أنت مستعد للتسجيل النهائي؟ 🎯`,
    phoneBusyMsg: (name: string) =>
      `مرحباً ${name}! 📵 حاولنا الاتصال بك للتحدث بخصوص انضمامك لأكاديمية GAB SCHOOL، لكن هاتفك كان مغلقاً. نرجو أن تتواصل معنا في أقرب وقت لأن المقاعد محدودة جداً 🎯`,
    noAnswerMsg: (name: string) =>
      `مرحباً ${name}! 📞 اتصلنا بك للتحدث بخصوص انضمامك لأكاديمية GAB SCHOOL لكنك لم تتمكن من الرد. نرجو أن تعاود الاتصال بنا أو تتواصل معنا عبر الواتساب 🙏 المقاعد محدودة!`,
    interestedMsg: (name: string) =>
      `مرحباً ${name}! 🚀 يسعدنا اهتمامك بالانضمام إلى أكاديمية GAB SCHOOL. الدورة القادمة ستبدأ قريباً، هل تريد أن نحجز لك مقعداً الآن؟ 💪`,
    noShowMsg: (name: string) =>
      `إن شاء الله تكون بصحة جيدة ${name} 🙏 لاحظنا أنك لم تتمكن من الحضور اليوم. إن شاء الله ما يكون بك ولا ضرر 🤍 إذا أردت التسجيل في الدورات القادمة يسعدنا مساعدتك، تواصل معنا في أي وقت 😊`,
    archivedMsg: (name: string) =>
      `مرحباً ${name}! 😊 نأمل أنك بخير. نعلمك بأن دورات جديدة متاحة الآن في أكاديمية GAB SCHOOL. هل تفكر في الانضمام مرة أخرى؟ نسعد بعودتك 🌟`,
    stageLabels: {
      new: "تسجيل جديد",
      contacted: "تم التواصل",
      interested: "مهتم",
      no_show: "لم يحضر",
      archived: "مؤرشف",
    },
    paymentLabels: {
      unpaid: "غير مدفوع",
      deposited: "تم الإيداع 💰",
      paid: "مدفوع ✅",
    },
    depositPaidBadge: "تم الإيداع 💰",
    paidBadge: "مدفوع ✅",
    markDepositPaid: "تسجيل إيداع",
    markPaid: "تسجيل دفع كامل",
    receiptUpload: "رفع وصل الدفع",
    uploading: "جاري الرفع...",
    receiptUploaded: "تم رفع الوصل بنجاح",
    receiptError: "خطأ في رفع الوصل",
    schedules: "الجداول",
    noSchedule: "بدون جدول",
    addSchedule: "إضافة جدول جديد",
    moveToSchedule: "نقل إلى...",
    renameSchedule: "تعديل الاسم",
  },
  fr: {
    dashboard: "Tableau de Bord",
    pipeline: "Pipeline",
    students: "Étudiants",
    groups: "Groupes",
    gallery: "Galerie",
    staff: "Personnel",
    activityLog: "Journal d'Activité",
    navigation: "Navigation",
    openDay: "Journée Portes Ouvertes",
    logout: "Déconnexion",
    viewSite: "Voir le Site",
    totalStudents: "Total Étudiants",
    newLeads: "Nouveaux Leads",
    contacted: "Contacté",
    interested: "Intéressé",
    noShows: "Absents",
    archived: "Archivé",
    totalGroups: "Total Groupes",
    openGroups: "Groupes Ouverts",
    systemOverview: "Vue d'ensemble du Système",
    recentActivity: "Activité Récente",
    noRecentActivity: "Aucune activité récente",
    moveTo: "Déplacer vers...",
    empty: "Vide",
    online: "En ligne",
    physical: "Présentiel",
    sendWhatsApp: "Envoyer WhatsApp",
    newLeadMsg: (name: string) =>
      `Bonjour ${name}! 🎉 Votre inscription à GAB SCHOOL a bien été enregistrée. Nous vous contacterons prochainement pour confirmer les détails de votre formation. Cordialement 🌟`,
    contactedMsg: (name: string) =>
      `Bonjour ${name}! 😊 Nous vous avons contacté précédemment concernant votre inscription à GAB SCHOOL. Les places sont limitées, êtes-vous prêt(e) à confirmer votre inscription? 🎯`,
    phoneBusyMsg: (name: string) =>
      `Bonjour ${name}! 📵 Nous avons essayé de vous contacter concernant votre inscription à GAB SCHOOL, mais votre téléphone était éteint. Veuillez nous contacter dès que possible car les places sont très limitées 🎯`,
    noAnswerMsg: (name: string) =>
      `Bonjour ${name}! 📞 Nous avons essayé de vous appeler concernant votre inscription à GAB SCHOOL, mais vous n'avez pas pu répondre. Merci de nous rappeler ou de nous contacter via WhatsApp 🙏 Les places sont limitées!`,
    interestedMsg: (name: string) =>
      `Bonjour ${name}! 🚀 Nous sommes ravis de votre intérêt pour GAB SCHOOL. La prochaine session démarrera bientôt, souhaitez-vous que nous vous réservions une place? 💪`,
    noShowMsg: (name: string) =>
      `Bonjour ${name}! 🙏 Nous espérons que vous allez bien. Nous avons remarqué votre absence aujourd'hui. Si vous souhaitez vous inscrire aux prochaines sessions, nous serons ravis de vous aider. N'hésitez pas à nous contacter 😊`,
    archivedMsg: (name: string) =>
      `Bonjour ${name}! 😊 Nous espérons que vous allez bien. De nouvelles formations sont maintenant disponibles chez GAB SCHOOL. Seriez-vous intéressé(e) par un retour? 🌟`,
    stageLabels: {
      new: "Nouveau Lead",
      contacted: "Contacté",
      interested: "Intéressé",
      no_show: "Absent",
      archived: "Archivé",
    },
    paymentLabels: {
      unpaid: "Non payé",
      deposited: "Dépôt payé 💰",
      paid: "Paiement complet ✅",
    },
    depositPaidBadge: "Dépôt payé 💰",
    paidBadge: "Paiement complet ✅",
    markDepositPaid: "Enregistrer dépôt",
    markPaid: "Paiement complet",
    receiptUpload: "Télécharger reçu",
    uploading: "Téléchargement...",
    receiptUploaded: "Reçu téléchargé avec succès",
    receiptError: "Erreur lors du téléchargement",
    schedules: "Plannings",
    noSchedule: "Sans planning",
    addSchedule: "Nouveau planning",
    moveToSchedule: "Déplacer vers...",
    renameSchedule: "Renommer",
  },
};

type Translations = typeof translations.ar;

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const stored = (localStorage.getItem("gab_lang") as Lang) || "ar";
  const [lang, setLangState] = useState<Lang>(stored);

  const setLang = (l: Lang) => {
    localStorage.setItem("gab_lang", l);
    setLangState(l);
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
