"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ApiPromise } from "@polkadot/api";
import { useNetwork } from "./NetworkContext";
import { createApi, disconnectApi } from "./polkadotApi";

export interface UsePolkadotApiReturn {
  api: ApiPromise | null;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export function usePolkadotApi(): UsePolkadotApiReturn {
  const { selectedNetwork, customUrls } = useNetwork();
  const [api, setApi] = useState<ApiPromise | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentWssUrl = useRef<string>("");
  const apiRef = useRef<ApiPromise | null>(null);
  // Track connection attempt count to force effect re-runs
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
      // Increment attempt counter to force effect to re-check if URL is correct
      setConnectionAttempt((prev) => prev + 1);
    }
  }, []);

  const connect = useCallback(async () => {
    await connectToUrl(activeWssUrl);
  }, [activeWssUrl, connectToUrl]);

  // Auto-connect when URL changes or after a connection attempt completes
  useEffect(() => {
    // If URL changed from what we're connected to, reconnect
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

  return {
    api,
    isConnecting,
    isConnected,
    error,
    connect,
    disconnect,
  };
}
