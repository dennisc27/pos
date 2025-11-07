"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  ArrowLeftRight,
  ArrowRightLeft,
  BadgeDollarSign,
  BarChart3,
  Boxes,
  ClipboardList,
  Clock,
  Cog,
  FileText,
  Gift,
  GitBranch,
  Globe,
  HandCoins,
  Handshake,
  Hourglass,
  KanbanSquare,
  LayoutDashboard,
  Megaphone,
  ListTree,
  PackagePlus,
  PackageSearch,
  QrCode,
  ShoppingBag,
  ShoppingCart,
  Undo2,
  UsersRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const sections: NavSection[] = [
  {
    title: "Overview",
    items: [{ name: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    title: "Point of Sale",
    items: [
      { name: "New sale", href: "/pos/sale", icon: ShoppingBag },
      { name: "Refund", href: "/pos/refund", icon: Undo2 },
      { name: "Buy", href: "/pos/buy", icon: Handshake },
      { name: "Gift cards", href: "/pos/gift-card", icon: Gift },
    ],
  },
  {
    title: "Cash",
    items: [
      { name: "Shift", href: "/cash/shift", icon: Clock },
      { name: "Movements", href: "/cash/movements", icon: ArrowLeftRight },
    ],
  },
  {
    title: "Loans & Layaway",
    items: [
      { name: "New loan", href: "/loans/new", icon: HandCoins },
      { name: "Past-due", href: "/loans/due", icon: Hourglass },
      { name: "InstaPawn", href: "/loans/instapawn", icon: QrCode },
      { name: "Layaway", href: "/layaway/new", icon: BadgeDollarSign },
    ],
  },
  {
    title: "Inventory",
    items: [
      { name: "Catalog", href: "/inventory", icon: Boxes },
      { name: "Ops", href: "/inventory/ops", icon: FileText },
      { name: "Split & combine", href: "/inventory/split-combine", icon: GitBranch },
      { name: "Barcode", href: "/inventory/barcode", icon: QrCode },
    ],
  },
  {
    title: "E-Commerce",
    items: [
      { name: "Channels", href: "/ecom/channels", icon: Globe },
      { name: "Listings", href: "/ecom/products", icon: PackageSearch },
      { name: "Orders", href: "/ecom/orders", icon: ClipboardList },
      { name: "Returns", href: "/ecom/returns", icon: ArrowRightLeft },
    ],
  },
  {
    title: "Purchasing",
    items: [
      { name: "Overview", href: "/purchases", icon: ShoppingCart },
      { name: "Receive", href: "/purchases/new", icon: PackagePlus },
      { name: "Returns", href: "/purchases/returns", icon: Undo2 },
    ],
  },
  {
    title: "Repairs",
    items: [
      { name: "Intake", href: "/repairs/intake", icon: Wrench },
      { name: "Board", href: "/repairs/board", icon: KanbanSquare },
    ],
  },
  {
    title: "CRM & Marketing",
    items: [
      { name: "Customers", href: "/crm/customers", icon: UsersRound },
      { name: "Marketing", href: "/crm/marketing", icon: Megaphone },
    ],
  },
  {
    title: "Reports",
    items: [
      { name: "All reports", href: "/reports/all", icon: ListTree },
      { name: "Shift-end", href: "/reports/shift-end", icon: FileText },
      { name: "Loans aging", href: "/reports/loans-aging", icon: BarChart3 },
    ],
  },
  {
    title: "Settings",
    items: [{ name: "System", href: "/settings/system", icon: Cog }],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-card px-4 py-6 dark:border-slate-800 dark:bg-slate-950/80 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
      <div className="flex items-center gap-2 px-2 text-sm font-semibold tracking-wide text-foreground">
        <span className="rounded bg-primary/10 px-2 py-1 text-xs uppercase text-primary">POS</span>
        <span>Pawn Command</span>
      </div>
      <nav className="mt-8 flex-1 space-y-6 overflow-y-auto pr-1">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {section.title}
            </p>
            <div className="mt-1 space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                      isActive
                        ? "bg-secondary text-foreground shadow dark:bg-slate-800/80 dark:text-white"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
