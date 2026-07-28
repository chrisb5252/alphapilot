"use client";
import Link from "next/link";
import { useState } from "react";
import { Show, SignInButton, SignOutButton } from "@clerk/nextjs";

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const links = [
    { href: "/", label: "Home" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard#research", label: "Research" },
    { href: "/settings/brokerages", label: "Brokerages" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ];
  return (
    <nav className="border-b border-slate-200 bg-white/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight text-slate-950"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-emerald-500 text-sm text-white">
            A
          </span>
          AlphaPilot
        </Link>
        <div className="hidden items-center gap-6 sm:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-600 transition hover:text-emerald-700"
            >
              {link.label}
            </Link>
          ))}
          <AuthButtons />
        </div>
        <button
          aria-label="Open navigation menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="grid size-10 place-items-center rounded-lg border border-slate-200 text-slate-700 sm:hidden"
        >
          <span className="text-xl leading-none">{open ? "×" : "☰"}</span>
        </button>
      </div>
      {open && (
        <div className="border-t border-slate-100 bg-white px-5 py-3 sm:hidden">
          {links.map((link) => (
            <Link
              onClick={() => setOpen(false)}
              key={link.href}
              href={link.href}
              className="block rounded-lg px-3 py-3 text-sm font-medium text-slate-700 hover:bg-emerald-50"
            >
              {link.label}
            </Link>
          ))}
          <div className="px-3 py-3">
            <AuthButtons />
          </div>
        </div>
      )}
    </nav>
  );
}

function AuthButtons() {
  return (
    <>
      <Show when="signed-out">
        <SignInButton>
          <button className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white">
            Log in
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <SignOutButton>
          <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
            Log out
          </button>
        </SignOutButton>
      </Show>
    </>
  );
}
