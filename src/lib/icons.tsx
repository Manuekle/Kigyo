'use client'

/**
 * HugeIcons-backed, lucide-compatible icon set.
 *
 * Every export mirrors the lucide-react component API (`size`, `color`,
 * `className`, `style`, `strokeWidth`) so consuming files only need to change
 * their import source from `lucide-react` to `@/lib/icons`.
 *
 * To swap a glyph, change the mapped HugeIcons icon below — no page edits.
 */
import type { CSSProperties } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Activity01Icon,
  Alert01Icon,
  Alert02Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Award01Icon,
  Notification01Icon,
  BookOpen01Icon,
  Calendar01Icon,
  Tick02Icon,
  CheckmarkCircle01Icon,
  ChevronRightIcon,
  Clock01Icon,
  DollarCircleIcon,
  Download01Icon,
  ViewIcon,
  ViewOffIcon,
  DocumentValidationIcon,
  File01Icon,
  MortarboardIcon,
  HelpCircleIcon,
  InformationCircleIcon,
  KanbanIcon,
  DashboardSquare01Icon,
  ListViewIcon,
  Logout01Icon,
  Location01Icon,
  Menu01Icon,
  Message01Icon,
  PackageIcon,
  AttachmentIcon,
  PencilEdit01Icon,
  PenTool01Icon,
  PlusSignIcon,
  StopIcon,
  Search01Icon,
  SentIcon,
  Settings01Icon,
  Shield01Icon,
  ShieldBanIcon,
  SparklesIcon,
  StarIcon,
  Tag01Icon,
  Ticket01Icon,
  ChartDownIcon,
  ChartUpIcon,
  Upload01Icon,
  UserAdd01Icon,
  UserGroupIcon,
  Wallet01Icon,
  Cancel01Icon,
  CancelCircleIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  FilterIcon,
  MoreHorizontalIcon,
  CheckmarkBadge01Icon,
  CalendarSetting01Icon,
  DocumentCodeIcon,
  GridViewIcon,
  Flag01Icon,
  EraserIcon,
  Share01Icon,
  Link01Icon,
  Copy01Icon,
  TextBoldIcon,
  TextItalicIcon,
  TextUnderlineIcon,
  TextStrikethroughIcon,
  LeftToRightListNumberIcon,
  Image01Icon,
  QuoteDownIcon,
  TextFontIcon,
  Mail01Icon,
  Call02Icon,
  Building03Icon,
  SquareLock01Icon,
  Globe02Icon,
  Invoice01Icon,
  PrinterIcon,
  CsvIcon,
  Video01Icon,
  UserCheck01Icon,
  ShoppingCart01Icon,
  TruckIcon,
  BriefcaseDollarIcon,
  UserRemove01Icon,
  Target01Icon,
  SmileIcon,
  FavouriteIcon,
  AnalyticsUpIcon,
  Delete02Icon,
  FlashIcon,
  Layers01Icon,
  GitBranchIcon,
  Clock04Icon,
  RefreshIcon,
  VolumeHighIcon,
  VolumeOffIcon,
  Sun03Icon,
  Moon02Icon,
  // Sector and operations modules. Every one of these names a thing the
  // business physically has — a vehicle, a bed, a plot of land — so the glyph
  // carries more than a generic document would.
  Wrench01Icon,
  Car01Icon,
  Factory01Icon,
  StethoscopeIcon,
  School01Icon,
  Restaurant01Icon,
  Plant01Icon,
  Home01Icon,
  BedIcon,
  Agreement01Icon,
  UserSearch01Icon,
} from '@hugeicons/core-free-icons'

export interface IconProps {
  size?: number
  color?: string
  className?: string
  strokeWidth?: number
  style?: CSSProperties
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function make(icon: any) {
  return function Icon({ size = 18, color = 'currentColor', strokeWidth = 1.8, className, style }: IconProps) {
    return (
      <HugeiconsIcon
        icon={icon}
        size={size}
        color={color}
        strokeWidth={strokeWidth}
        className={className}
        style={style}
      />
    )
  }
}

export const Activity = make(Activity01Icon)
export const AlertCircle = make(Alert01Icon)
export const AlertTriangle = make(Alert02Icon)
export const ArrowLeft = make(ArrowLeft01Icon)
export const ArrowRight = make(ArrowRight01Icon)
export const Award = make(Award01Icon)
export const Bell = make(Notification01Icon)
export const BookOpen = make(BookOpen01Icon)
export const Calendar = make(Calendar01Icon)
export const Check = make(Tick02Icon)
export const CheckCircle = make(CheckmarkCircle01Icon)
export const ChevronRight = make(ChevronRightIcon)
export const Clock = make(Clock01Icon)
export const DollarSign = make(DollarCircleIcon)
export const Download = make(Download01Icon)
export const Eye = make(ViewIcon)
export const EyeOff = make(ViewOffIcon)
export const FileSignature = make(DocumentValidationIcon)
export const FileText = make(File01Icon)
export const GraduationCap = make(MortarboardIcon)
export const HelpCircle = make(HelpCircleIcon)
export const Info = make(InformationCircleIcon)
export const Kanban = make(KanbanIcon)
export const LayoutDashboard = make(DashboardSquare01Icon)
export const List = make(ListViewIcon)
export const LogOut = make(Logout01Icon)
export const MapPin = make(Location01Icon)
export const Menu = make(Menu01Icon)
export const MessageSquare = make(Message01Icon)
export const Package = make(PackageIcon)
export const Paperclip = make(AttachmentIcon)
export const PenLine = make(PencilEdit01Icon)
export const PenTool = make(PenTool01Icon)
export const Plus = make(PlusSignIcon)
export const Search = make(Search01Icon)
export const Send = make(SentIcon)
export const Settings = make(Settings01Icon)
export const Shield = make(Shield01Icon)
export const ShieldAlert = make(ShieldBanIcon)
export const Sparkles = make(SparklesIcon)
export const Star = make(StarIcon)
export const Tag = make(Tag01Icon)
export const Ticket = make(Ticket01Icon)
export const TrendingDown = make(ChartDownIcon)
export const TrendingUp = make(ChartUpIcon)
export const Upload = make(Upload01Icon)
export const UserPlus = make(UserAdd01Icon)
export const Users = make(UserGroupIcon)
export const Wallet = make(Wallet01Icon)
export const X = make(Cancel01Icon)
export const XCircle = make(CancelCircleIcon)
export const ChevronDown = make(ArrowDown01Icon)
export const ArrowUp = make(ArrowUp01Icon)
export const Filter = make(FilterIcon)
export const MoreHorizontal = make(MoreHorizontalIcon)
export const ShieldCheck = make(CheckmarkBadge01Icon)
export const CalendarClock = make(CalendarSetting01Icon)
export const FileCheck2 = make(DocumentCodeIcon)
export const Boxes = make(PackageIcon)
export const LayoutGrid = make(GridViewIcon)
export const Flag = make(Flag01Icon)
export const Eraser = make(EraserIcon)
export const Share2 = make(Share01Icon)
export const Link2 = make(Link01Icon)
export const Copy = make(Copy01Icon)
export const Bold = make(TextBoldIcon)
export const Italic = make(TextItalicIcon)
export const Underline = make(TextUnderlineIcon)
export const Strikethrough = make(TextStrikethroughIcon)
export const ListOrdered = make(LeftToRightListNumberIcon)
export const Image = make(Image01Icon)
export const Quote = make(QuoteDownIcon)
export const Type = make(TextFontIcon)
export const Mail = make(Mail01Icon)
export const Phone = make(Call02Icon)
export const Building2 = make(Building03Icon)
export const Lock = make(SquareLock01Icon)
export const Globe = make(Globe02Icon)
export const Receipt = make(Invoice01Icon)
export const Printer = make(PrinterIcon)
export const FileSpreadsheet = make(CsvIcon)
export const Video = make(Video01Icon)
export const UserCheck = make(UserCheck01Icon)
export const ShoppingCart = make(ShoppingCart01Icon)
export const ChevronLeft = make(ArrowLeft01Icon)
export const Truck = make(TruckIcon)
export const Briefcase = make(BriefcaseDollarIcon)
export const UserMinus = make(UserRemove01Icon)
export const Target = make(Target01Icon)
export const Smile = make(SmileIcon)
export const Heart = make(FavouriteIcon)
export const BarChart3 = make(AnalyticsUpIcon)
export const Trash2 = make(Delete02Icon)
export const Zap = make(FlashIcon)
export const ChevronUp = make(ArrowUp01Icon)
export const Layers = make(Layers01Icon)
export const GitBranch = make(GitBranchIcon)
export const History = make(Clock04Icon)
export const RotateCcw = make(RefreshIcon)
export const Square = make(StopIcon)
export const Volume = make(VolumeHighIcon)
export const VolumeOff = make(VolumeOffIcon)
export const Sun = make(Sun03Icon)
export const Moon = make(Moon02Icon)

// Sector and operations modules.
export const Wrench = make(Wrench01Icon)
export const Car = make(Car01Icon)
export const Factory = make(Factory01Icon)
export const Stethoscope = make(StethoscopeIcon)
export const School = make(School01Icon)
export const Restaurant = make(Restaurant01Icon)
export const Sprout = make(Plant01Icon)
export const Home = make(Home01Icon)
export const Bed = make(BedIcon)
export const Handshake = make(Agreement01Icon)
export const UserSearch = make(UserSearch01Icon)
