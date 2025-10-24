import { Bell, MoonStar, Search, Store } from "lucide-react";

export function TopBar() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-800/80 bg-slate-950/60 px-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-900 px-3 py-1.5 text-sm text-slate-200">
          <Store className="h-4 w-4 text-sky-400" />
          <span>Santo Domingo - Main</span>
        </div>
        <div className="hidden items-center gap-3 text-xs text-slate-400 md:flex">
          <span>
            Shift: <span className="font-medium text-slate-200">Morning A</span>
          </span>
          <span>
            Drawer: <span className="font-medium text-emerald-400">Balanced</span>
          </span>
          <span>
            Till Float: <span className="font-medium text-slate-200">RD$15,000</span>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-slate-400 lg:flex">
          <Search className="h-4 w-4" />
          <input
            placeholder="Search customers, tickets, receipts..."
            className="w-64 bg-transparent text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none"
          />
        </div>
        <button className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-slate-300 hover:text-white">
          <Bell className="h-4 w-4" />
        </button>
        <button className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-slate-300 hover:text-white">
          <MoonStar className="h-4 w-4" />
        </button>
        <div className="hidden items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs lg:flex">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="font-medium text-slate-200">Maria P.</span>
        </div>
      </div>
    </header>
  );
}
