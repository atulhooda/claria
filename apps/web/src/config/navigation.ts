import {
  FileTextIcon,
  LayoutDashboardIcon,
  MicIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Disabled items render as muted placeholders — used for routes that don't exist yet. */
  disabled?: boolean;
}

export const primaryNav: readonly NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
  { label: "Consultations", href: "/consultations", icon: MicIcon },
  { label: "Patients", href: "/patients", icon: UsersIcon, disabled: true },
  { label: "Notes", href: "/notes", icon: FileTextIcon, disabled: true },
];

export const secondaryNav: readonly NavItem[] = [
  { label: "Settings", href: "/settings", icon: SettingsIcon, disabled: true },
];
