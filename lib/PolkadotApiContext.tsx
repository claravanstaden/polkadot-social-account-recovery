"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { ApiPromise } from "@polkadot/api";
import { useNetwork } from "./NetworkContext";
import { createApi, disconnectApi } from "./polkadotApi";

export interface PolkadotApiContextValue {
  api: ApiPromise | null;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const PolkadotApiContext = createContext<PolkadotApiContextValue | undefined>(
  undefined,
);

export function PolkadotApiProvider({ children }: { children: ReactNode }) {
  const { selectedNetwork, customUrls } = useNetwork();
  const [api, setApi] = useState<ApiPromise | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentWssUrl = useRef<string>("");
  const apiRef = useRef<ApiPromise | null>(null);
  const [connectionAttempt, setConnectionAttempt] = useState(0);

  // Compute the active URL directly from context state to ensure reactivity
  const activeWssUrl =
    customUrls[selectedNetwork.id] || selectedNetwork.assetHubWss;

  const disconnect = useCallback(async () => {
    if (apiRef.current) {
      try {
        await disconnectApi(apiRef.current);
      } catch (err) {
        console.error("Error disconnecting:", err);
      }
      apiRef.current = null;
      setApi(null);
      setIsConnected(false);
      currentWssUrl.current = "";
    }
  }, []);

  const connectToUrl = useCallback(async (wssUrl: string) => {
    // Don't reconnect if already connected to the same URL
    if (apiRef.current && currentWssUrl.current === wssUrl) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    // Disconnect from previous connection if exists
    if (apiRef.current) {
      try {
        await disconnectApi(apiRef.current);
      } catch (err) {
        console.error("Error disconnecting previous:", err);
      }
      apiRef.current = null;
      setApi(null);
      setIsConnected(false);
    }

    try {
      console.log("Connecting to:", wssUrl);
      const newApi = await createApi(wssUrl);

      // Verify the connection is ready by getting chain info
      const chain = await newApi.rpc.system.chain();
      console.log("Connected to chain:", chain.toString());

      apiRef.current = newApi;
      currentWssUrl.current = wssUrl;
      setApi(newApi);
      setIsConnected(true);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to connect to network";
      console.error("Connection error:", errorMessage);
      setError(errorMessage);
      apiRef.current = null;
      setApi(null);
      setIsConnected(false);
      currentWssUrl.current = "";
    } finally {
      setIsConnecting(false);
      setConnectionAttempt((prev) => prev + 1);
    }
  }, []);

  const connect = useCallback(async () => {
    await connectToUrl(activeWssUrl);
  }, [activeWssUrl, connectToUrl]);

  // Auto-connect when URL changes
  useEffect(() => {
    if (currentWssUrl.current !== activeWssUrl && !isConnecting) {
      console.log(
        "URL changed from",
        currentWssUrl.current,
        "to",
        activeWssUrl,
      );
      connectToUrl(activeWssUrl);
    }
  }, [activeWssUrl, connectToUrl, connectionAttempt, isConnecting]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (apiRef.current) {
        disconnectApi(apiRef.current).catch(console.error);
      }
    };
  }, []);

  const value: PolkadotApiContextValue = {
    api,
    isConnecting,
    isConnected,
    error,
    connect,
    disconnect,
  };

  return (
    <PolkadotApiContext.Provider value={value}>
      {children}
    </PolkadotApiContext.Provider>
  );
}

export function usePolkadotApiContext() {
  const context = useContext(PolkadotApiContext);
  if (!context) {
    throw new Error(
      "usePolkadotApiContext must be used within PolkadotApiProvider",
    );
  }
  return context;
}
