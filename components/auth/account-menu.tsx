"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export function AccountMenu() {
  return (
    <div className="flex items-center gap-3">
      <Show when="signed-out">
        <SignInButton>
          <button className="text-sm font-medium text-slate-700 hover:text-slate-950">Sign in</button>
        </SignInButton>
        <SignUpButton>
          <button className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">Create account</button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </div>
  );
}
