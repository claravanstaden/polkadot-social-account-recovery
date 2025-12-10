'use client';

import { useState } from 'react';
import WalletConnect from '@/components/WalletConnect';
import SocialRecoverySetup from '@/components/SocialRecoverySetup';
import NavBar from '@/components/NavBar';
import { useNetwork } from '@/lib/NetworkContext';

export default function Home() {
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletSource, setWalletSource] = useState<string | null>(null);
  const { selectedNetwork, getActiveWssUrl } = useNetwork();

  const handleWalletConnected = (walletName: string, extensionName: string) => {
    setIsWalletConnected(true);
    setWalletSource(extensionName);
  };

  const handleWalletDisconnected = () => {
    setIsWalletConnected(false);
    setWalletSource(null);
  };

  return (
    <>
      <NavBar />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <header className="text-center mb-12">
            <p className="text-gray-600 text-lg">
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
              Network: {selectedNetwork.name} | Endpoint: {getActiveWssUrl()}
            </p>
            <p className="mt-1">
              Supported wallets: Polkadot.js, Talisman, SubWallet, Nova Wallet
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}
