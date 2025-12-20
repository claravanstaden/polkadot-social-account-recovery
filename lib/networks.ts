export interface NetworkConfig {
  id: "development" | "westend" | "paseo" | "polkadot";
  name: string;
  assetHubWss: string;
  tokenSymbol: string;
  tokenDecimals: number;
}

export const SUPPORTED_NETWORKS: NetworkConfig[] = [
  {
    id: "polkadot",
    name: "Polkadot",
    assetHubWss: "wss://polkadot-asset-hub-rpc.polkadot.io",
    tokenSymbol: "DOT",
    tokenDecimals: 10,
  },
  {
    id: "westend",
    name: "Westend",
    assetHubWss: "wss://westend-asset-hub-rpc.polkadot.io",
    tokenSymbol: "WND",
    tokenDecimals: 12,
  },
  {
    id: "paseo",
    name: "Paseo",
    assetHubWss: "wss://paseo-asset-hub-rpc.polkadot.io",
    tokenSymbol: "PAS",
    tokenDecimals: 10,
  },
  {
    id: "development",
    name: "Development",
    assetHubWss: "ws://127.0.0.1:12144",
    tokenSymbol: "WND",
    tokenDecimals: 12,
  },
];

export const getNetworkById = (id: string): NetworkConfig | undefined => {
  return SUPPORTED_NETWORKS.find((network) => network.id === id);
};

export const DEFAULT_NETWORK_ID = "polkadot";
