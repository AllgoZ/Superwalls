import {
  ChartColumn,
  CircleHelp,
  FileText,
  History,
  Image as ImageIcon,
  LayoutDashboard,
  Package,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Tags,
  TicketPercent,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "shopping-bag": ShoppingBag,
  users: Users,
  "ticket-percent": TicketPercent,
  package: Package,
  tags: Tags,
  warehouse: Warehouse,
  image: ImageIcon,
  "file-text": FileText,
  "circle-help": CircleHelp,
  "chart-column": ChartColumn,
  history: History,
  settings: Settings,
  "shield-check": ShieldCheck,
};

export function navIcon(name: string): LucideIcon {
  return ICONS[name] ?? LayoutDashboard;
}
