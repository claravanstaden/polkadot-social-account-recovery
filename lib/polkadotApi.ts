import { ApiPromise, WsProvider } from '@polkadot/api';

const CONNECTION_TIMEOUT = 10000; // 10 seconds

export interface ChainInfo {
  name: string;
  genesisHash: string;
}

/**
 * Create a Polkadot API instance connected to the specified WSS URL
 */
export async function createApi(wssUrl: string): Promise<ApiPromise> {
  const provider = new WsProvider(wssUrl, false);

  // Create API with timeout
  const api = await Promise.race([
    ApiPromise.create({ provider }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_TIMEOUT)
    ),
  ]);

  await api.isReady;
  return api;
}

/**
 * Disconnect and cleanup an API instance
 */
export async function disconnectApi(api: ApiPromise): Promise<void> {
  try {
    await api.disconnect();
  } catch (error) {
    console.warn('Error disconnecting API:', error);
  }
}

/**
 * Test if a WSS URL is reachable and valid
 */
export async function testConnection(wssUrl: string): Promise<boolean> {
  let api: ApiPromise | null = null;
  try {
    api = await createApi(wssUrl);
    return api.isConnected;
  } catch (error) {
    console.error('Connection test failed:', error);
    return false;
  } finally {
    if (api) {
      await disconnectApi(api);
    }
  }
}

/**
 * Get chain information from a connected API
 */
export async function getChainInfo(api: ApiPromise): Promise<ChainInfo> {
  const [chain, genesisHash] = await Promise.all([
    api.rpc.system.chain(),
    api.genesisHash,
  ]);

  return {
    name: chain.toString(),
    genesisHash: genesisHash.toString(),
  };
}

/**
 * Validate WSS URL format
 */
export function isValidWssUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'ws:' || urlObj.protocol === 'wss:';
  } catch {
    return false;
  }
}
