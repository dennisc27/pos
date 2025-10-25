"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BadgeDollarSign,
  Boxes,
  Building2,
  CircleDollarSign,
  Cog,
  Gem,
  HandCoins,
  LayoutDashboard,
  MessageCircle,
  ShieldAlert,
  ShoppingBag,
  UsersRound
} from "lucide-react";

const links = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "POS2", href: "/pos2", icon: ShoppingBag },
  { name: "Loans", href: "/loans", icon: HandCoins },
  { name: "Layaways", href: "/layaways", icon: BadgeDollarSign },
  { name: "Inventory", href: "/inventory", icon: Boxes },
  { name: "Repairs & Fab", href: "/repairs", icon: Gem },
  { name: "CRM", href: "/crm", icon: UsersRound },
  { name: "Cash", href: "/cash", icon: CircleDollarSign },
  { name: "Marketing", href: "/marketing", icon: MessageCircle },
  { name: "Compliance", href: "/compliance", icon: ShieldAlert },
  { name: "Branches", href: "/branches", icon: Building2 },
  { name: "Settings", href: "/settings", icon: Cog }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-800 bg-slate-950/80 px-4 py-6 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
      <div className="flex items-center gap-2 px-2 text-sm font-semibold tracking-wide text-slate-200">
        <span className="rounded bg-sky-500/10 px-2 py-1 text-xs uppercase text-sky-400">POS</span>
        <span>Pawn Command</span>
      </div>
      <nav className="mt-8 flex-1 space-y-1 overflow-y-auto pr-1">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive =
            pathname === link.href ||
            (link.href !== "/" && pathname?.startsWith(link.href));
          return (
            <Link
              key={link.name}
              href={link.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                isActive
                  ? "bg-slate-800/80 text-white shadow"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{link.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
