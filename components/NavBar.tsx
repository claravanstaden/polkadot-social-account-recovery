"use client";

import { useTheme } from "@/lib/ThemeContext";
import NetworkSelector from "./NetworkSelector";
import WalletConnect from "./WalletConnect";
import ThemeToggle from "./ThemeToggle";

export default function NavBar() {
  const { resolvedTheme } = useTheme();

  return (
    <nav className="bg-[var(--surface)] border-b border-[var(--border-color)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
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
          <div className="flex items-center gap-3">
            <NetworkSelector />
            <ThemeToggle />
            <WalletConnect />
          </div>
        </div>
      </div>
    </nav>
  );
}
