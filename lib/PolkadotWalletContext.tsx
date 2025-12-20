"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import type { Wallet, WalletAccount } from "@talismn/connect-wallets";

interface PolkadotWalletContextType {
  wallet: Wallet | null;
  accounts: WalletAccount[];
  selectedAccount: WalletAccount | null;
  isModalOpen: boolean;
  setWallet: (wallet: Wallet | null) => void;
  setAccounts: (accounts: WalletAccount[]) => void;
  selectAccount: (address: string | null) => void;
  openModal: () => void;
  closeModal: () => void;
  disconnect: () => void;
}

const PolkadotWalletContext = createContext<
  PolkadotWalletContextType | undefined
>(undefined);

const WALLET_NAME_KEY = "polkadot-recovery-wallet-name";
const ACCOUNT_ADDRESS_KEY = "polkadot-recovery-account-address";

export function PolkadotWalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWalletState] = useState<Wallet | null>(null);
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [selectedAccountAddress, setSelectedAccountAddress] = useState<
    string | null
  >(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load saved wallet on mount
  useEffect(() => {
    const savedWalletName = localStorage.getItem(WALLET_NAME_KEY);
    const savedAccountAddress = localStorage.getItem(ACCOUNT_ADDRESS_KEY);

    if (savedAccountAddress) {
      setSelectedAccountAddress(savedAccountAddress);
    }

    if (savedWalletName) {
      // Auto-reconnect to saved wallet
      const reconnect = async () => {
        try {
          const { getWalletBySource } =
            await import("@talismn/connect-wallets");
          const savedWallet = getWalletBySource(savedWalletName);
          if (savedWallet) {
            await savedWallet.enable("Polkadot Social Account Recovery");
            setWalletState(savedWallet);

            const walletAccounts = await savedWallet.getAccounts(true);
            setAccounts(walletAccounts);
          }
        } catch (err) {
          console.warn("Failed to auto-reconnect wallet:", err);
          localStorage.removeItem(WALLET_NAME_KEY);
        }
      };
      reconnect();
    }
  }, []);

  const setWallet = useCallback((newWallet: Wallet | null) => {
    setWalletState(newWallet);
    if (newWallet) {
      localStorage.setItem(WALLET_NAME_KEY, newWallet.extensionName);
    } else {
      localStorage.removeItem(WALLET_NAME_KEY);
    }
  }, []);

  const selectAccount = useCallback((address: string | null) => {
    setSelectedAccountAddress(address);
    if (address) {
      localStorage.setItem(ACCOUNT_ADDRESS_KEY, address);
    } else {
      localStorage.removeItem(ACCOUNT_ADDRESS_KEY);
    }
  }, []);

  const selectedAccount =
    accounts.find((acc) => acc.address === selectedAccountAddress) || null;

  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  const disconnect = useCallback(() => {
    setWalletState(null);
    setAccounts([]);
    setSelectedAccountAddress(null);
    localStorage.removeItem(WALLET_NAME_KEY);
    localStorage.removeItem(ACCOUNT_ADDRESS_KEY);
  }, []);

  // Subscribe to account changes when wallet is connected
  useEffect(() => {
    if (!wallet) return;

    let unsub: (() => void) | undefined;

    const subscribeAccounts = async () => {
      try {
        unsub = (await wallet.subscribeAccounts((newAccounts) => {
          if (newAccounts) {
            setAccounts(newAccounts);
          }
        })) as () => void;
      } catch (err) {
        console.warn("Failed to subscribe to accounts:", err);
      }
    };

    subscribeAccounts();

    return () => {
      unsub?.();
    };
  }, [wallet]);

  const value: PolkadotWalletContextType = {
    wallet,
    accounts,
    selectedAccount,
    isModalOpen,
    setWallet,
    setAccounts,
    selectAccount,
    openModal,
    closeModal,
    disconnect,
  };

  return (
    <PolkadotWalletContext.Provider value={value}>
      {children}
    </PolkadotWalletContext.Provider>
  );
}

export function usePolkadotWallet(): PolkadotWalletContextType {
  const context = useContext(PolkadotWalletContext);
  if (context === undefined) {
    throw new Error(
      "usePolkadotWallet must be used within a PolkadotWalletProvider",
    );
  }
  return context;
}
