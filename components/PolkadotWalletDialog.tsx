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
      <div className="absolute inset-0 bg-black/50" onClick={closeModal} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {connectedWallet ? "Select Account" : "Connect Wallet"}
          </h2>
          <button
            onClick={closeModal}
            className="text-gray-400 hover:text-gray-600 transition-colors"
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
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
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
                  <span className="text-sm text-gray-600">
                    Connected to {connectedWallet.title}
                  </span>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Disconnect
                </button>
              </div>

              {accounts.length > 0 ? (
                accounts.map((account) => (
                  <button
                    key={account.address}
                    onClick={() => handleAccountSelect(account)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {account.name || "Unnamed Account"}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {account.address.slice(0, 8)}...
                        {account.address.slice(-8)}
                      </p>
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">
                  {isConnecting
                    ? "Loading accounts..."
                    : "No accounts found in this wallet."}
                </p>
              )}
            </div>
          ) : (
            // Show wallet list
            <div className="space-y-2">
              {availableWallets.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  Loading wallets...
                </p>
              ) : (
                availableWallets.map((wallet) => (
                  <button
                    key={wallet.extensionName}
                    onClick={() => handleWalletClick(wallet)}
                    disabled={isConnecting}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {wallet.logo && (
                      <img
                        src={wallet.logo.src}
                        alt={wallet.logo.alt}
                        className="w-8 h-8 rounded"
                      />
                    )}
                    <div className="flex-1 text-left">
                      <p className="font-medium text-gray-900">
                        {wallet.title}
                      </p>
                      {!wallet.installed && (
                        <p className="text-xs text-blue-600">
                          Click to install
                        </p>
                      )}
                    </div>
                    {wallet.installed && (
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
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
