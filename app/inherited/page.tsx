"use client";

import dynamic from "next/dynamic";
import NavBar from "@/components/NavBar";
import { useNetwork } from "@/lib/NetworkContext";

const PolkadotWalletDialog = dynamic(
  () => import("@/components/PolkadotWalletDialog"),
  { ssr: false },
);

const InheritedPage = dynamic(() => import("@/components/InheritedPage"), {
  ssr: false,
});

export default function Inherited() {
  const { selectedNetwork } = useNetwork();

  return (
    <div className="flex flex-col min-h-screen bg-[var(--background)]">
      <NavBar />
      <PolkadotWalletDialog />

      <main className="flex-grow flex flex-col items-center justify-start p-4 pt-8 sm:p-8 sm:pt-12">
        <InheritedPage />
      </main>

      <footer className="py-4 text-center text-sm text-[var(--foreground-muted)]">
        Connected to {selectedNetwork.name}
      </footer>
    </div>
  );
}
