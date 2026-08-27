'use client'

import type { ComponentType } from 'react'
import {
  Activity,
  Apartment,
  Bed,
  BookOpen,
  Building2,
  Calendar,
  Car,
  Cashier,
  Clock,
  Construction,
  Contracts,
  DollarSign,
  Factory,
  FileCheck2,
  FileText,
  GraduationCap,
  Handshake,
  Home,
  Kanban,
  LayoutDashboard,
  LayoutGrid,
  Link2,
  MessageSquare,
  Package,
  PenLine,
  Receipt,
  Restaurant,
  RotateCcw,
  School,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Sprout,
  Stethoscope,
  Store,
  Tag,
  Target,
  Ticket,
  Truck,
  UserCheck,
  UserSearch,
  Users,
  Wallet,
  Wrench,
  Zap,
  type IconProps,
} from '@/lib/icons'

/**
 * The nav's icons, in one map.
 *
 * There used to be two: fifty entries in `Sidebar` and twenty-six in
 * `CommandPalette`, both written by hand against the same registry. The palette
 * was missing every sectoral module — `Stethoscope`, `Restaurant`, `Sprout`,
 * `Bed`, `Apartment`, `Construction`, `Factory`, `School` — so searching for
 * «Pacientes» in a clinic returned a row with an empty square where its icon
 * goes, and the lookup had no fallback to make that visible as a bug. It also
 * carried `PenTool`, which no module has ever declared.
 *
 * Keyed by the string a registry entry's `icon` field holds, so the only way to
 * add a module without its icon is to add one the registry does not name — and
 * `nav.test.ts` pins that this map covers the registry exactly, in both
 * directions.
 *
 * A function rather than a map of elements because the two callers draw at
 * different sizes: 18 in the rail, 15 in the palette's tighter row.
 */
const ICONS: Record<string, ComponentType<IconProps>> = {
  Activity,
  Apartment,
  Bed,
  BookOpen,
  Building2,
  Calendar,
  Car,
  Cashier,
  Clock,
  Construction,
  Contracts,
  DollarSign,
  Factory,
  FileCheck2,
  FileText,
  GraduationCap,
  Handshake,
  Home,
  Kanban,
  LayoutDashboard,
  LayoutGrid,
  Link2,
  MessageSquare,
  Package,
  PenLine,
  Receipt,
  Restaurant,
  RotateCcw,
  School,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Sprout,
  Stethoscope,
  Store,
  Tag,
  Target,
  Ticket,
  Truck,
  UserCheck,
  UserSearch,
  Users,
  Wallet,
  Wrench,
  Zap,
}

export function navIcon(name: string, size: number) {
  const Icon = ICONS[name]
  return Icon ? <Icon size={size} /> : null
}

/** The icon names this map answers to. For the test that pins it. */
export const NAV_ICON_NAMES: string[] = Object.keys(ICONS)
