"use client";

import { usePolkadotWallet } from "@/lib/PolkadotWalletContext";

export default function WalletConnect() {
  const { wallet, selectedAccount, openModal, disconnect } =
    usePolkadotWallet();

  if (wallet && selectedAccount) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={openModal}
          className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border-color)] rounded-lg hover:border-[var(--border-color-dark)] transition-colors"
        >
          {wallet.logo && (
            <img
              src={wallet.logo.src}
              alt={wallet.logo.alt}
              className="w-5 h-5 rounded"
            />
          )}
          <span className="text-sm font-medium text-[var(--foreground)] max-w-[120px] truncate">
            {selectedAccount.name ||
              selectedAccount.address.slice(0, 8) + "..."}
          </span>
        </button>
        <button
          onClick={disconnect}
          className="p-1.5 text-[var(--foreground-muted)] hover:text-[var(--error)] hover:bg-[var(--error-bg)] rounded-lg transition-colors"
          title="Disconnect wallet"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
        </button>
      </div>
    );
  }

  if (wallet) {
    // Wallet connected but no account selected
    return (
      <button
        onClick={openModal}
        className="flex items-center gap-2 px-3 py-1.5 bg-[var(--warning-bg)] border border-[var(--warning-border)] rounded-lg hover:bg-[var(--warning-border)] transition-colors text-sm font-medium text-[var(--foreground)]"
      >
        {wallet.logo && (
          <img
            src={wallet.logo.src}
            alt={wallet.logo.alt}
            className="w-5 h-5 rounded"
          />
        )}
        Select Account
      </button>
    );
  }

  return (
    <button
      onClick={openModal}
      className="flex items-center gap-2 px-4 py-2 bg-[var(--polkadot-accent)] text-white rounded-lg hover:bg-[var(--polkadot-accent-hover)] transition-colors text-sm font-medium"
    >
      Connect Wallet
    </button>
  );
}
