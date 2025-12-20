"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  NetworkConfig,
  SUPPORTED_NETWORKS,
  getNetworkById,
  DEFAULT_NETWORK_ID,
} from "./networks";

interface NetworkContextType {
  selectedNetwork: NetworkConfig;
  customUrls: Record<string, string>;
  setNetwork: (networkId: string) => void;
  setCustomUrl: (networkId: string, url: string) => void;
  getActiveWssUrl: () => string;
  resetCustomUrl: (networkId: string) => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

const STORAGE_KEY_NETWORK = "polkadot-recovery-network";
const STORAGE_KEY_CUSTOM_URLS = "polkadot-recovery-custom-urls";

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkConfig>(() => {
    // Initialize with default network
    return getNetworkById(DEFAULT_NETWORK_ID) || SUPPORTED_NETWORKS[0];
  });

  const [customUrls, setCustomUrls] = useState<Record<string, string>>({});
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedNetworkId = localStorage.getItem(STORAGE_KEY_NETWORK);
      const savedCustomUrls = localStorage.getItem(STORAGE_KEY_CUSTOM_URLS);

      if (savedNetworkId) {
        const network = getNetworkById(savedNetworkId);
        if (network) {
          setSelectedNetwork(network);
        }
      }

      if (savedCustomUrls) {
        setCustomUrls(JSON.parse(savedCustomUrls));
      }
    } catch (error) {
      console.warn("Failed to load network settings from localStorage:", error);
    }
    setIsInitialized(true);
  }, []);

  // Save to localStorage when network changes
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEY_NETWORK, selectedNetwork.id);
    } catch (error) {
      console.warn("Failed to save network to localStorage:", error);
    }
  }, [selectedNetwork, isInitialized]);

  // Save to localStorage when custom URLs change
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_URLS, JSON.stringify(customUrls));
    } catch (error) {
      console.warn("Failed to save custom URLs to localStorage:", error);
    }
  }, [customUrls, isInitialized]);

  const setNetwork = (networkId: string) => {
    const network = getNetworkById(networkId);
    if (network) {
      setSelectedNetwork(network);
    }
  };

  const setCustomUrl = (networkId: string, url: string) => {
    setCustomUrls((prev) => ({
      ...prev,
      [networkId]: url,
    }));
  };

  const getActiveWssUrl = (): string => {
    return customUrls[selectedNetwork.id] || selectedNetwork.assetHubWss;
  };

  const resetCustomUrl = (networkId: string) => {
    setCustomUrls((prev) => {
      const newUrls = { ...prev };
      delete newUrls[networkId];
      return newUrls;
    });
  };

  const value: NetworkContextType = {
    selectedNetwork,
    customUrls,
    setNetwork,
    setCustomUrl,
    getActiveWssUrl,
    resetCustomUrl,
  };

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextType {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
}
