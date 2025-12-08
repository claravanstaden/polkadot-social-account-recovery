'use client';

import { useState } from 'react';
import { SUPPORTED_WALLETS, WalletConfig } from '@/lib/wallets';

interface WalletConnectProps {
  onWalletConnected: (walletName: string, extensionName: string) => void;
  onWalletDisconnected: () => void;
}

export default function WalletConnect({ onWalletConnected, onWalletDisconnected }: WalletConnectProps) {
  const [connectedWallet, setConnectedWallet] = useState<WalletConfig | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);

  const connectToWallet = async (wallet: WalletConfig) => {
    setIsConnecting(true);
    setError(null);

    try {
      const { web3Enable } = await import('@polkadot/extension-dapp');

      // Enable the wallet extension
      const extensions = await web3Enable('Polkadot Social Account Recovery');

      if (extensions.length === 0) {
        setError(`No wallet extensions found. Please install ${wallet.name} or another supported wallet.`);
        setIsConnecting(false);
        return;
      }

      const selectedExtension = extensions.find(ext => ext.name === wallet.extensionName);

      if (!selectedExtension) {
        setError(
          <div>
            <p className="font-semibold mb-2">{wallet.name} is not installed.</p>
            <a
              href={wallet.installUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Click here to install {wallet.name} →
            </a>
          </div>
        );
        setIsConnecting(false);
        return;
      }

      // Successfully connected
      setConnectedWallet(wallet);
      onWalletConnected(wallet.name, wallet.extensionName);
      setIsConnecting(false);
    } catch (err) {
      setError(`Failed to connect: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsConnecting(false);
    }
  };

  if (connectedWallet) {
    return (
      <div className="w-full max-w-2xl mx-auto p-6 bg-green-50 rounded-lg border-2 border-green-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={connectedWallet.icon} alt={connectedWallet.name} className="w-10 h-10 rounded-lg" />
            <div>
              <div className="font-semibold text-gray-800">Connected to {connectedWallet.name}</div>
              <div className="text-sm text-gray-600">Your accounts are loaded below</div>
            </div>
          </div>
          <button
            onClick={() => {
              setConnectedWallet(null);
              setError(null);
              onWalletDisconnected();
            }}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-2 text-gray-800">Connect Wallet</h2>
      <p className="text-sm text-gray-600 mb-6">
        Choose a wallet to connect and view your accounts
      </p>

      <div className="space-y-3">
        {SUPPORTED_WALLETS.map((wallet) => (
          <button
            key={wallet.id}
            onClick={() => connectToWallet(wallet)}
            disabled={isConnecting}
            className="w-full text-left p-4 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <img src={wallet.icon} alt={wallet.name} className="w-10 h-10 rounded-lg" />
              <div className="flex-1">
                <div className="font-semibold text-gray-800">{wallet.name}</div>
              </div>
              {isConnecting && (
                <div className="text-blue-600 text-sm">Connecting...</div>
              )}
            </div>
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
    </div>
  );
}
