'use client';

import { useState, useEffect } from 'react';
import type { InjectedAccountWithMeta } from '@polkadot/extension-inject/types';

interface SocialRecoverySetupProps {
  isWalletConnected: boolean;
  walletSource: string | null;
}

export default function SocialRecoverySetup({ isWalletConnected, walletSource }: SocialRecoverySetupProps) {
  const [allAccounts, setAllAccounts] = useState<InjectedAccountWithMeta[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isWalletConnected && walletSource) {
      loadAllAccounts();
    } else {
      // Reset accounts when wallet is disconnected
      setAllAccounts([]);
      setSelectedAccounts(new Set());
    }
  }, [isWalletConnected, walletSource]);

  const loadAllAccounts = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { web3Accounts } = await import('@polkadot/extension-dapp');
      const accounts = await web3Accounts();

      // Filter accounts to only show those from the selected wallet
      const filteredAccounts = accounts.filter(
        account => account.meta.source === walletSource
      );

      setAllAccounts(filteredAccounts);
      setIsLoading(false);
    } catch (err) {
      setError(`Failed to load accounts: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  const toggleAccountSelection = (address: string) => {
    const newSelection = new Set(selectedAccounts);
    if (newSelection.has(address)) {
      newSelection.delete(address);
    } else {
      newSelection.add(address);
    }
    setSelectedAccounts(newSelection);
  };

  const handleSetupRecovery = () => {
    if (selectedAccounts.size === 0) {
      setError('Please select at least one account to make recoverable');
      return;
    }

    // TODO: Implement the actual social recovery setup logic here
    console.log('Setting up social recovery for accounts:', {
      recoverableAccounts: Array.from(selectedAccounts),
    });

    alert(`Setting up social recovery for ${selectedAccounts.size} account(s)`);
  };

  if (!isWalletConnected) {
    return (
      <div className="w-full max-w-2xl mx-auto p-6 bg-gray-100 rounded-lg">
        <p className="text-gray-600 text-center">
          Please connect your wallet first
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-2 text-gray-800">Setup Social Recovery</h2>
      <p className="text-sm text-gray-600 mb-6">
        Select which accounts you want to make recoverable
      </p>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-700">
            Your Accounts ({selectedAccounts.size} of {allAccounts.length} selected)
          </p>
          {allAccounts.length > 0 && (
            <button
              onClick={() => {
                if (selectedAccounts.size === allAccounts.length) {
                  setSelectedAccounts(new Set());
                } else {
                  setSelectedAccounts(new Set(allAccounts.map(acc => acc.address)));
                }
              }}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {selectedAccounts.size === allAccounts.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading accounts...</div>
        ) : allAccounts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No accounts found. Please create accounts in your wallet extension.
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {allAccounts.map((acc) => {
              const isSelected = selectedAccounts.has(acc.address);
              return (
                <button
                  key={acc.address}
                  onClick={() => toggleAccountSelection(acc.address)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          isSelected
                            ? 'bg-blue-500 border-blue-500'
                            : 'bg-white border-gray-300'
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path d="M5 13l4 4L19 7"></path>
                          </svg>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-800">{acc.meta.name}</div>
                      <div className="text-xs text-gray-500 truncate font-mono">{acc.address}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        Wallet: {acc.meta.source}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={handleSetupRecovery}
        disabled={selectedAccounts.size === 0}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
      >
        Make {selectedAccounts.size > 0 ? `${selectedAccounts.size}` : ''} Account
        {selectedAccounts.size !== 1 ? 's' : ''} Recoverable
      </button>

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {selectedAccounts.size > 0 && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-gray-700">
          <p className="font-semibold mb-2">Accounts to be made recoverable:</p>
          <ul className="space-y-1">
            {Array.from(selectedAccounts).map(addr => {
              const acc = allAccounts.find(a => a.address === addr);
              return (
                <li key={addr} className="truncate">
                  • {acc?.meta.name} <span className="text-gray-500 text-xs">({addr.slice(0, 8)}...{addr.slice(-8)})</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
