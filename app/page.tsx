"use client";

import dynamic from "next/dynamic";
import SocialRecoverySetup from "@/components/SocialRecoverySetup";
import NavBar from "@/components/NavBar";
import { useNetwork } from "@/lib/NetworkContext";

// Dynamic import with SSR disabled - Talisman WalletSelect uses browser-only APIs
const PolkadotWalletDialog = dynamic(
  () => import("@/components/PolkadotWalletDialog"),
  { ssr: false },
);

export default function Home() {
  const { selectedNetwork, getActiveWssUrl } = useNetwork();

  return (
    <>
      <NavBar />
      <PolkadotWalletDialog />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <SocialRecoverySetup />

          <footer className="mt-12 text-center text-sm text-gray-500">
            <p>
              Network: {selectedNetwork.name} | Endpoint: {getActiveWssUrl()}
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}
