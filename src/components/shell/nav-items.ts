import {
  BookOpen,
  Home,
  MessageCircleQuestion,
  NotebookPen,
  Settings,
  CalendarDays,
  Coins,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; primary?: boolean };

/** Navigation volontairement courte : 4 entrées principales, le reste dans « Plus ». */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Accueil", icon: Home, primary: true },
  { href: "/matieres", label: "Matières", icon: BookOpen, primary: true },
  { href: "/tuteur", label: "Tuteur", icon: MessageCircleQuestion, primary: true },
  { href: "/examens", label: "Examens", icon: CalendarDays },
  { href: "/pensees", label: "Pensées notées", icon: NotebookPen },
  { href: "/reglages", label: "Réglages", icon: Settings },
  { href: "/couts", label: "Coûts IA", icon: Coins },
];
