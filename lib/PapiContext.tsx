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
import { createClient, PolkadotClient, TypedApi } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { recovery } from "@polkadot-api/descriptors";
import { useNetwork } from "./NetworkContext";

type RecoveryApi = TypedApi<typeof recovery>;

export interface PapiContextValue {
  client: PolkadotClient | null;
  typedApi: RecoveryApi | null;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const PapiContext = createContext<PapiContextValue | undefined>(undefined);

export function PapiProvider({ children }: { children: ReactNode }) {
  const { selectedNetwork, customUrls } = useNetwork();
  const [client, setClient] = useState<PolkadotClient | null>(null);
  const [typedApi, setTypedApi] = useState<RecoveryApi | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentWssUrl = useRef<string>("");
  const clientRef = useRef<PolkadotClient | null>(null);

  // Compute the active URL directly from context state
  const activeWssUrl =
    customUrls[selectedNetwork.id] || selectedNetwork.assetHubWss;

  const disconnect = useCallback(async () => {
    if (clientRef.current) {
      try {
        clientRef.current.destroy();
      } catch (err) {
        console.error("Error disconnecting PAPI:", err);
      }
      clientRef.current = null;
      setClient(null);
      setTypedApi(null);
      setIsConnected(false);
      currentWssUrl.current = "";
    }
  }, []);

  const connectToUrl = useCallback(async (wssUrl: string) => {
    // Don't reconnect if already connected to the same URL
    if (clientRef.current && currentWssUrl.current === wssUrl) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    // Disconnect from previous connection if exists
    if (clientRef.current) {
      try {
        clientRef.current.destroy();
      } catch (err) {
        console.error("Error disconnecting previous PAPI:", err);
      }
      clientRef.current = null;
      setClient(null);
      setTypedApi(null);
      setIsConnected(false);
    }

    try {
      console.log("PAPI connecting to:", wssUrl);

      // Create WebSocket provider
      const provider = getWsProvider(wssUrl);

      // Create the client
      const newClient = createClient(provider);

      // Get the typed API with our chain descriptors
      const api = newClient.getTypedApi(recovery);

      clientRef.current = newClient;
      currentWssUrl.current = wssUrl;
      setClient(newClient);
      setTypedApi(api);
      setIsConnected(true);
      setError(null);

      console.log("PAPI connected successfully");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to connect via PAPI";
      console.error("PAPI connection error:", errorMessage);
      setError(errorMessage);
      clientRef.current = null;
      setClient(null);
      setTypedApi(null);
      setIsConnected(false);
      currentWssUrl.current = "";
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const connect = useCallback(async () => {
    await connectToUrl(activeWssUrl);
  }, [activeWssUrl, connectToUrl]);

  // Auto-connect when URL changes
  useEffect(() => {
    if (currentWssUrl.current !== activeWssUrl && !isConnecting) {
      console.log(
        "PAPI URL changed from",
        currentWssUrl.current,
        "to",
        activeWssUrl,
      );
      connectToUrl(activeWssUrl);
    }
  }, [activeWssUrl, connectToUrl, isConnecting]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.destroy();
      }
    };
  }, []);

  const value: PapiContextValue = {
    client,
    typedApi,
    isConnecting,
    isConnected,
    error,
    connect,
    disconnect,
  };

  return <PapiContext.Provider value={value}>{children}</PapiContext.Provider>;
}

export function usePapi(): PapiContextValue {
  const context = useContext(PapiContext);
  if (!context) {
    throw new Error("usePapi must be used within PapiProvider");
  }
  return context;
}
