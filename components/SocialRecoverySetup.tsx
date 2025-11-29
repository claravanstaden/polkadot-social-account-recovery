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

  // Recovery configuration
  const [friends, setFriends] = useState<string[]>(['']);
  const [threshold, setThreshold] = useState<number>(2);
  const [refuteDuration, setRefuteDuration] = useState<number>(7);

  useEffect(() => {
    if (isWalletConnected && walletSource) {
      loadAllAccounts();
    } else {
      // Reset accounts when wallet is disconnected
      setAllAccounts([]);
      setSelectedAccounts(new Set());
      setFriends(['']);
      setThreshold(2);
      setRefuteDuration(7);
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

  const addFriendInput = () => {
    setFriends([...friends, '']);
  };

  const removeFriendInput = (index: number) => {
    const newFriends = friends.filter((_, i) => i !== index);
    setFriends(newFriends.length > 0 ? newFriends : ['']);
  };

  const updateFriend = (index: number, value: string) => {
    const newFriends = [...friends];
    newFriends[index] = value;
    setFriends(newFriends);
  };

  const handleSetupRecovery = () => {
    setError(null);

    if (selectedAccounts.size === 0) {
      setError('Please select at least one account to make recoverable');
      return;
    }

    const validFriends = friends.filter(f => f.trim() !== '');
    if (validFriends.length === 0) {
      setError('Please add at least one friend account');
      return;
    }

    if (threshold < 1 || threshold > validFriends.length) {
      setError(`Threshold must be between 1 and ${validFriends.length} (number of friends)`);
      return;
    }

    if (refuteDuration < 1) {
      setError('Refute duration must be at least 1 day');
      return;
    }

    // TODO: Implement the actual social recovery setup logic here
    console.log('Setting up social recovery:', {
      recoverableAccounts: Array.from(selectedAccounts),
      friends: validFriends,
      threshold,
      refuteDurationDays: refuteDuration,
    });

    alert(
      `Setting up social recovery for ${selectedAccounts.size} account(s)\n` +
      `Friends: ${validFriends.length}\n` +
      `Threshold: ${threshold}\n` +
      `Refute Duration: ${refuteDuration} days`
    );
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
        Select accounts to make recoverable and configure recovery settings
      </p>

      {/* Account Selection */}
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
          <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-2">
            {allAccounts.map((acc) => {
              const isSelected = selectedAccounts.has(acc.address);
              return (
                <button
                  key={acc.address}
                  onClick={() => toggleAccountSelection(acc.address)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
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
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Recovery Configuration */}
      <div className="border-t pt-6 space-y-6">
        <h3 className="text-lg font-semibold text-gray-800">Recovery Configuration</h3>

        {/* Friends List */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Friend Account IDs (Guardians)
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Add the account addresses of friends who can help recover your account
          </p>
          <div className="space-y-2">
            {friends.map((friend, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={friend}
                  onChange={(e) => updateFriend(index, e.target.value)}
                  placeholder="Enter friend's account address..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                />
                {friends.length > 1 && (
                  <button
                    onClick={() => removeFriendInput(index)}
                    className="px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={addFriendInput}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            + Add Another Friend
          </button>
        </div>

        {/* Threshold */}
        <div>
          <label htmlFor="threshold" className="block text-sm font-medium text-gray-700 mb-2">
            Recovery Threshold
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Number of friends required to approve a recovery
          </p>
          <input
            id="threshold"
            type="number"
            min="1"
            max={friends.filter(f => f.trim()).length || 1}
            value={threshold}
            onChange={(e) => setThreshold(parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Refute Duration */}
        <div>
          <label htmlFor="refuteDuration" className="block text-sm font-medium text-gray-700 mb-2">
            Refute Duration (days)
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Waiting period before an approved recovery takes effect
          </p>
          <input
            id="refuteDuration"
            type="number"
            min="1"
            value={refuteDuration}
            onChange={(e) => setRefuteDuration(parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <button
        onClick={handleSetupRecovery}
        disabled={selectedAccounts.size === 0}
        className="w-full mt-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
      >
        Setup Recovery for {selectedAccounts.size > 0 ? `${selectedAccounts.size}` : ''} Account
        {selectedAccounts.size !== 1 ? 's' : ''}
      </button>

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {selectedAccounts.size > 0 && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded text-sm text-gray-700">
          <p className="font-semibold mb-2">Summary:</p>
          <ul className="space-y-1">
            <li>• Accounts to make recoverable: {selectedAccounts.size}</li>
            <li>• Friends (guardians): {friends.filter(f => f.trim()).length}</li>
            <li>• Threshold: {threshold} friend(s) needed to approve recovery</li>
            <li>• Refute duration: {refuteDuration} day(s)</li>
          </ul>
        </div>
      )}
    </div>
  );
}
