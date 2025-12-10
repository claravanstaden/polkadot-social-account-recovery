'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiPromise } from '@polkadot/api';
import { useNetwork } from './NetworkContext';
import { createApi, disconnectApi } from './polkadotApi';

export interface UsePolkadotApiReturn {
  api: ApiPromise | null;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export function usePolkadotApi(): UsePolkadotApiReturn {
  const { getActiveWssUrl, selectedNetwork } = useNetwork();
  const [api, setApi] = useState<ApiPromise | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentWssUrl = useRef<string>('');

  const disconnect = useCallback(async () => {
    if (api) {
      try {
        await disconnectApi(api);
        setApi(null);
        setIsConnected(false);
        currentWssUrl.current = '';
      } catch (err) {
        console.error('Error disconnecting:', err);
      }
    }
  }, [api]);

  const connect = useCallback(async () => {
    const wssUrl = getActiveWssUrl();

    // Don't reconnect if already connected to the same URL
    if (api && isConnected && currentWssUrl.current === wssUrl) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    // Disconnect from previous connection if exists
    if (api) {
      await disconnect();
    }

    try {
      const newApi = await createApi(wssUrl);
      setApi(newApi);
      setIsConnected(true);
      currentWssUrl.current = wssUrl;
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to network';
      setError(errorMessage);
      setApi(null);
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }, [api, isConnected, disconnect, getActiveWssUrl]);

  // Reconnect when network changes
  useEffect(() => {
    // Disconnect when network changes
    if (api && isConnected) {
      disconnect();
    }
  }, [selectedNetwork.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (api) {
        disconnectApi(api).catch(console.error);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    api,
    isConnecting,
    isConnected,
    error,
    connect,
    disconnect,
  };
}
