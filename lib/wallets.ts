export interface WalletConfig {
  id: string;
  name: string;
  extensionName: string;
  installUrl: string;
  icon: string;
}

export const SUPPORTED_WALLETS: WalletConfig[] = [
  {
    id: 'polkadot-js',
    name: 'Polkadot.js',
    extensionName: 'polkadot-js',
    installUrl: 'https://polkadot.js.org/extension/',
    icon: '/icons/polkadotjs.png',
  },
  {
    id: 'talisman',
    name: 'Talisman',
    extensionName: 'talisman',
    installUrl: 'https://talisman.xyz/',
    icon: '/icons/talisman.png',
  },
  {
    id: 'subwallet',
    name: 'SubWallet',
    extensionName: 'subwallet-js',
    installUrl: 'https://subwallet.app/',
    icon: '/icons/subwallet.jpeg',
  },
  {
    id: 'nova',
    name: 'Nova Wallet',
    extensionName: 'polkadot-js',
    installUrl: 'https://novawallet.io/',
    icon: '/icons/nova.png',
  },
];
