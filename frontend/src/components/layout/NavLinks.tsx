"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LineChart, Target } from "lucide-react";
import { cn } from "@/lib/cn";
import { useLastUsername } from "@/lib/useLastUsername";

const ITEMS = [
  { href: "/", label: "Inicio", icon: Home, withUser: false },
  { href: "/dashboard", label: "Diagnóstico", icon: LineChart, withUser: true },
  { href: "/trainer", label: "Entrenador", icon: Target, withUser: true },
] as const;

function useNavItems() {
  const pathname = usePathname();
  const [lastUser] = useLastUsername();
  return ITEMS.map((item) => ({
    ...item,
    url: item.withUser && lastUser ? `${item.href}?username=${encodeURIComponent(lastUser)}` : item.href,
    active: item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
  }));
}

/** Navegación superior (escritorio / tablet). */
export function NavLinks() {
  const items = useNavItems();
  return (
    <nav aria-label="Principal" className="hidden items-center gap-1 sm:flex">
      {items.map(({ url, label, icon: Icon, active }) => (
        <Link
          key={label}
          href={url}
          aria-current={active ? "page" : undefined}
          className={cn(
            "relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors",
            active ? "bg-ink-750 text-ivory" : "text-ivory-faint hover:bg-ink-800 hover:text-ivory"
          )}
        >
          <Icon className={cn("h-4 w-4", active ? "text-brass-400" : "")} aria-hidden />
          {label}
          {active && <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-brass-400" />}
        </Link>
      ))}
    </nav>
  );
}

/** Barra de pestañas inferior para móvil. */
export function MobileTabBar() {
  const items = useNavItems();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-600/80 bg-ink-900/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg sm:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-3">
        {items.map(({ url, label, icon: Icon, active }) => (
          <Link
            key={label}
            href={url}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
              active ? "text-brass-300" : "text-ivory-faint"
            )}
          >
            <span className={cn("rounded-full px-4 py-1 transition-colors", active && "bg-brass-400/15")}>
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
