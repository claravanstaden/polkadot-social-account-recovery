"use client";

import { ApiPromise } from "@polkadot/api";
import { usePolkadotApiContext } from "./PolkadotApiContext";

export interface UsePolkadotApiReturn {
  api: ApiPromise | null;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

/**
 * Hook to access the shared Polkadot API connection.
 * The connection is managed globally by PolkadotApiProvider.
 */
export function usePolkadotApi(): UsePolkadotApiReturn {
  return usePolkadotApiContext();
}
