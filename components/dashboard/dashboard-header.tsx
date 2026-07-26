"use client";

import { AccountMenu } from "@/components/auth/account-menu";

export function DashboardHeader() {
  return (
    <header className="flex h-18 items-center justify-between border-b border-slate-200 bg-white px-5 sm:h-20 sm:px-8 lg:px-12">
      <a href="#" className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-950">
        <span className="grid size-8 place-items-center rounded-xl bg-emerald-500 text-base text-white shadow-sm">✦</span>
        AlphaPilot
      </a>
      <nav className="hidden items-center gap-7 text-sm font-medium text-slate-500 sm:flex">
        <a className="text-slate-950" href="#portfolio">Portfolio</a>
        <a className="transition hover:text-slate-950" href="#allocation">Allocation</a>
        <a className="transition hover:text-slate-950" href="#risk">Risk</a>
      </nav>
      <AccountMenu />
    </header>
  );
}
