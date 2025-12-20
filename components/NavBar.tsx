"use client";

import NetworkSelector from "./NetworkSelector";
import WalletConnect from "./WalletConnect";
import ThemeToggle from "./ThemeToggle";

export default function NavBar() {
  return (
    <nav className="bg-[var(--surface)] border-b border-[var(--border-color)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            {/* Polkadot-style logo dots */}
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-[var(--polkadot-accent)]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[var(--grey-800)]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[var(--grey-400)]" />
            </div>
            <h1 className="text-xl font-semibold text-[var(--foreground)]">
              Social Recovery
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
