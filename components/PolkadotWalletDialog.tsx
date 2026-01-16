"use client";

import { useEffect, useState } from "react";
import { usePolkadotWallet } from "@/lib/PolkadotWalletContext";
import type { Wallet, WalletAccount } from "@talismn/connect-wallets";

export default function PolkadotWalletDialog() {
  const {
    isModalOpen,
    closeModal,
    wallet: connectedWallet,
    accounts,
    setWallet,
    setAccounts,
    selectAccount,
  } = usePolkadotWallet();

  const [availableWallets, setAvailableWallets] = useState<Wallet[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available wallets when modal opens (only if no wallet connected)
  useEffect(() => {
    if (!isModalOpen) return;

    // Clear available wallets if a wallet is already connected
    if (connectedWallet) {
      setAvailableWallets([]);
      return;
    }

    let cancelled = false;

    const loadWallets = async () => {
      const { getWallets } = await import("@talismn/connect-wallets");
      if (cancelled) return;
      const wallets = getWallets();
      setAvailableWallets(wallets);
    };

    loadWallets();

    return () => {
      cancelled = true;
    };
  }, [isModalOpen, connectedWallet]);

  const handleWalletClick = async (wallet: Wallet) => {
    if (!wallet.installed) {
      window.open(wallet.installUrl, "_blank");
      return;
    }

    setIsConnecting(true);
    setError(null);
    setAvailableWallets([]); // Clear wallet list immediately when starting connection

    try {
      await wallet.enable("Polkadot Social Account Recovery");
      setWallet(wallet);

      const walletAccounts = await wallet.getAccounts(true);
      setAccounts(walletAccounts);
    } catch (err) {
      console.error("Failed to connect wallet:", err);
      setError(err instanceof Error ? err.message : "Failed to connect wallet");
      // Reload wallets on failure so user can try again
      const { getWallets } = await import("@talismn/connect-wallets");
      setAvailableWallets(getWallets());
    } finally {
      setIsConnecting(false);
    }
  };

  const handleAccountSelect = (account: WalletAccount) => {
    selectAccount(account.address);
    closeModal();
  };

  const handleDisconnect = () => {
    setWallet(null);
    setAccounts([]);
    selectAccount(null);
  };

  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[var(--grey-950)]/50"
        onClick={closeModal}
      />

      {/* Modal */}
      <div className="relative bg-[var(--surface)] rounded-2xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden border border-[var(--border-color)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <h2 className="font-display text-lg font-normal text-[var(--foreground)]">
            {connectedWallet ? "Select Account" : "Connect Wallet"}
          </h2>
          <button
            onClick={closeModal}
            className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
          {error && (
            <div className="mb-4 p-3 bg-[var(--error-bg)] border border-[var(--error-border)] rounded-lg text-[var(--error)] text-sm">
              {error}
            </div>
          )}

          {connectedWallet ? (
            // Show accounts list or loading state
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {connectedWallet.logo && (
                    <img
                      src={connectedWallet.logo.src}
                      alt={connectedWallet.logo.alt}
                      className="w-6 h-6 rounded"
                    />
                  )}
                  <span className="text-sm text-[var(--foreground-secondary)]">
                    Connected to {connectedWallet.title}
                  </span>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="text-sm text-[var(--error)] hover:underline"
                >
                  Disconnect
                </button>
              </div>

              {accounts.length > 0 ? (
                accounts.map((account) => (
                  <button
                    key={account.address}
                    onClick={() => handleAccountSelect(account)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-[var(--border-color)] hover:border-[var(--polkadot-accent)] hover:bg-[var(--background)] transition-colors text-left"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-[var(--polkadot-accent)] to-[var(--grey-600)] rounded-full flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--foreground)] truncate">
                        {account.name || "Unnamed Account"}
                      </p>
                      <p className="text-xs text-[var(--foreground-muted)] truncate font-mono">
                        {account.address.slice(0, 8)}...
                        {account.address.slice(-8)}
                      </p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-[var(--foreground-muted)] text-center py-4">
                  {isConnecting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Loading accounts...
                    </span>
                  ) : (
                    "No accounts found in this wallet."
                  )}
                </div>
              )}
            </div>
          ) : (
            // Show wallet list
            <div className="space-y-2">
              {availableWallets.length === 0 ? (
                <div className="text-[var(--foreground-muted)] text-center py-4 flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Loading wallets...
                </div>
              ) : (
                availableWallets.map((wallet) => (
                  <button
                    key={wallet.extensionName}
                    onClick={() => handleWalletClick(wallet)}
                    disabled={isConnecting}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-[var(--border-color)] hover:border-[var(--polkadot-accent)] hover:bg-[var(--background)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {wallet.logo && (
                      <img
                        src={wallet.logo.src}
                        alt={wallet.logo.alt}
                        className="w-8 h-8 rounded"
                      />
                    )}
                    <div className="flex-1 text-left">
                      <p className="font-medium text-[var(--foreground)]">
                        {wallet.title}
                      </p>
                      {!wallet.installed && (
                        <p className="text-xs text-[var(--polkadot-accent)]">
                          Click to install
                        </p>
                      )}
                    </div>
                    {wallet.installed && (
                      <span className="text-xs text-[var(--success)] bg-[var(--success-bg)] px-2 py-0.5 rounded">
                        Installed
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
