"use client";

import NetworkSelector from "./NetworkSelector";
import WalletConnect from "./WalletConnect";

export default function NavBar() {
  return (
    <nav className="bg-white shadow-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900">
              Polkadot Social Recovery
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <NetworkSelector />
            <WalletConnect />
          </div>
        </div>
      </div>
    </nav>
  );
}
