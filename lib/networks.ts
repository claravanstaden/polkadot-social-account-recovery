export interface NetworkConfig {
  id: "development" | "westend" | "paseo" | "polkadot";
  name: string;
  assetHubWss: string;
}

export const SUPPORTED_NETWORKS: NetworkConfig[] = [
  {
    id: "polkadot",
    name: "Polkadot",
    assetHubWss: "wss://polkadot-asset-hub-rpc.polkadot.io",
  },
  {
    id: "westend",
    name: "Westend",
    assetHubWss: "wss://westend-asset-hub-rpc.polkadot.io",
  },
  {
    id: "paseo",
    name: "Paseo",
    assetHubWss: "wss://paseo-asset-hub-rpc.polkadot.io",
  },
  {
    id: "development",
    name: "Development",
    assetHubWss: "ws://127.0.0.1:12144",
  },
];

export const getNetworkById = (id: string): NetworkConfig | undefined => {
  return SUPPORTED_NETWORKS.find((network) => network.id === id);
};

export const DEFAULT_NETWORK_ID = "polkadot";
