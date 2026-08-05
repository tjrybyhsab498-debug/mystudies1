import {
  BrainCircuit,
  CalendarClock,
  FileText,
  Layers,
  Mic,
  Network,
  ScanLine,
  Sigma,
  type LucideIcon,
} from "lucide-react";

export type FeatureId =
  "summarize" | "flashcards" | "audio" | "ocr" | "mindmap" | "solver" | "planner" | "tutor";

export type FeatureConfigKind = "page-range" | "count" | "none";

export type FeatureDef = {
  id: FeatureId;
  title: string;
  desc: string;
  icon: LucideIcon;
  /** المسار الذي تنتقل إليه البطاقة */
  target: "library" | "tutor" | "home";
  /** نص الشريط السياقي داخل المكتبة */
  pickerHint: string;
  configKind: FeatureConfigKind;
  /** جاهزة فعلياً أم "قريباً" */
  ready: boolean;
  cta: string;
};

export const FEATURES: FeatureDef[] = [
  {
    id: "summarize",
    title: "الكبسولة الذكية",
    desc: "لخّص ملفك",
    icon: FileText,
    target: "library",
    pickerHint: "اختر ملف PDF لتوليد ملخص خارق منه",
    configKind: "page-range",
    ready: true,
    cta: "ابدأ التلخيص",
  },
  {
    id: "tutor",
    title: "الأستاذ الرقمي",
    desc: "ذاكر بالحوار",
    icon: BrainCircuit,
    target: "tutor",
    pickerHint: "اختر ملفاً لتناقشه مع الأستاذ الرقمي",
    configKind: "none",
    ready: true,
    cta: "ابدأ الحوار",
  },
  {
    id: "flashcards",
    title: "الكروت السريعة",
    desc: "بطاقات للحفظ",
    icon: Layers,
    target: "library",
    pickerHint: "اختر ملفاً لتوليد بطاقات تعليمية منه",
    configKind: "count",
    ready: false,
    cta: "توليد البطاقات",
  },
  {
    id: "audio",
    title: "المذياع الدراسي",
    desc: "استمع لدروسك",
    icon: Mic,
    target: "library",
    pickerHint: "اختر ملفاً لتحويله إلى بودكاست صوتي",
    configKind: "page-range",
    ready: false,
    cta: "توليد الصوت",
  },
  {
    id: "ocr",
    title: "عين صقر",
    desc: "مسح الخط اليدوي",
    icon: ScanLine,
    target: "library",
    pickerHint: "اختر صورة أو ملفاً لتحويله إلى نص رقمي",
    configKind: "none",
    ready: false,
    cta: "بدء المسح",
  },
  {
    id: "mindmap",
    title: "الرادار البصري",
    desc: "خرائط ذهنية",
    icon: Network,
    target: "library",
    pickerHint: "اختر ملفاً لتحويله إلى خريطة ذهنية",
    configKind: "page-range",
    ready: false,
    cta: "توليد الخريطة",
  },
  {
    id: "solver",
    title: "حلّال المعادلات",
    desc: "حل خطوة بخطوة",
    icon: Sigma,
    target: "library",
    pickerHint: "اختر ملف المسائل لحلها خطوة بخطوة",
    configKind: "page-range",
    ready: false,
    cta: "ابدأ الحل",
  },
  {
    id: "planner",
    title: "المخطط السحري",
    desc: "خطة مذاكرة",
    icon: CalendarClock,
    target: "home",
    pickerHint: "اختر ملفاً لبناء خطة مذاكرة عليه",
    configKind: "none",
    ready: false,
    cta: "إنشاء الخطة",
  },
];

export const FEATURE_IDS = FEATURES.map((f) => f.id);

export function getFeature(id: string | undefined | null): FeatureDef | undefined {
  if (!id) return undefined;
  return FEATURES.find((f) => f.id === id);
}
