export interface WalletConfig {
  id: string;
  name: string;
  description: string;
  extensionName: string;
  installUrl: string;
  icon: string;
}

export const SUPPORTED_WALLETS: WalletConfig[] = [
  {
    id: 'polkadot-js',
    name: 'Polkadot.js',
    description: 'The original Polkadot wallet extension',
    extensionName: 'polkadot-js',
    installUrl: 'https://polkadot.js.org/extension/',
    icon: '/icons/polkadotjs.png',
  },
  {
    id: 'talisman',
    name: 'Talisman',
    description: 'A better wallet for Polkadot & Ethereum',
    extensionName: 'talisman',
    installUrl: 'https://talisman.xyz/',
    icon: '/icons/talisman.png',
  },
  {
    id: 'subwallet',
    name: 'SubWallet',
    description: 'The comprehensive Polkadot wallet',
    extensionName: 'subwallet-js',
    installUrl: 'https://subwallet.app/',
    icon: '/icons/subwallet.jpeg',
  },
  {
    id: 'nova',
    name: 'Nova Wallet',
    description: 'Next-gen wallet for Polkadot ecosystem',
    extensionName: 'polkadot-js',
    installUrl: 'https://novawallet.io/',
    icon: '/icons/nova.png',
  },
];
