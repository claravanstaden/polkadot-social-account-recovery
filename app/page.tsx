'use client';

import { useState } from 'react';
import WalletConnect from '@/components/WalletConnect';
import SocialRecoverySetup from '@/components/SocialRecoverySetup';

export default function Home() {
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletSource, setWalletSource] = useState<string | null>(null);

  const handleWalletConnected = (walletName: string, extensionName: string) => {
    setIsWalletConnected(true);
    setWalletSource(extensionName);
  };

  const handleWalletDisconnected = () => {
    setIsWalletConnected(false);
    setWalletSource(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Polkadot Social Account Recovery
          </h1>
          <p className="text-gray-600">
            Connect your wallet and select accounts to make recoverable
          </p>
        </header>

        <div className="space-y-6">
          <WalletConnect
            onWalletConnected={handleWalletConnected}
            onWalletDisconnected={handleWalletDisconnected}
          />
          <SocialRecoverySetup
            isWalletConnected={isWalletConnected}
            walletSource={walletSource}
          />
        </div>

        <footer className="mt-12 text-center text-sm text-gray-500">
          <p>
            Supported wallets: Polkadot.js, Talisman, SubWallet, Nova Wallet
          </p>
        </footer>
      </div>
    </div>
  );
}
