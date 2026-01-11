"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/lib/ThemeContext";
import NetworkSelector from "./NetworkSelector";
import WalletConnect from "./WalletConnect";
import ThemeToggle from "./ThemeToggle";

const navLinks = [
  { href: "/", label: "My Recovery" },
  { href: "/help-recover", label: "Help Recover" },
  { href: "/inherited", label: "Inherited" },
];

export default function NavBar() {
  const { resolvedTheme } = useTheme();
  const pathname = usePathname();

  return (
    <nav className="bg-[var(--surface)] border-b border-[var(--border-color)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <img
                src={
                  resolvedTheme === "dark"
                    ? "/polkadot-light.png"
                    : "/polkadot-dark.png"
                }
                alt="Polkadot"
                className="w-8 h-8"
              />
              <h1 className="font-display text-xl text-[var(--foreground)]">
                Polkadot Social Recovery
              </h1>
            </div>
            <div className="hidden sm:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? "text-[var(--polkadot-accent)] bg-[var(--polkadot-accent)]/10"
                        : "text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--border-color)]"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <NetworkSelector />
            <ThemeToggle />
            <WalletConnect />
          </div>
        </div>
        {/* Mobile navigation */}
        <div className="sm:hidden pb-3 flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? "text-[var(--polkadot-accent)] bg-[var(--polkadot-accent)]/10"
                    : "text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--border-color)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
