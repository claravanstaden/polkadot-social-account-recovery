# Polkadot Social Account Recovery

A Next.js application for linking multiple Polkadot accounts together for social recovery purposes.

## Features

- Support for multiple wallet providers (Polkadot.js, Talisman, SubWallet, Nova Wallet)
- Connect and authenticate with wallet extensions
- View accounts from the connected wallet
- Multi-select interface to choose which accounts should be recoverable
- Select All / Deselect All functionality
- Configure social recovery settings:
  - Add multiple friend/guardian account addresses
  - Set recovery threshold (number of friends needed to approve)
  - Set refute duration (waiting period in days)
- Input validation for all recovery parameters
- Visual summary of recovery configuration
- Modern, responsive UI built with Tailwind CSS

## Prerequisites

Before you begin, make sure you have:

1. Node.js 18+ installed
2. At least one Polkadot wallet extension installed:
   - [Polkadot.js](https://polkadot.js.org/extension/)
   - [Talisman](https://talisman.xyz/)
   - [SubWallet](https://subwallet.app/)
   - [Nova Wallet](https://novawallet.io/)
3. At least one account created in your wallet extension

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

Then, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## How to Use

1. **Connect Wallet**: Choose a wallet provider (Polkadot.js, Talisman, SubWallet, or Nova Wallet) and click to connect
2. **View All Accounts**: Once connected, all your accounts from that wallet will be displayed
3. **Select Accounts**: Check the boxes next to accounts you want to make recoverable
   - Use "Select All" to quickly select all accounts
   - Use "Deselect All" to clear your selection
4. **Configure Recovery Settings**:
   - **Friend Account IDs**: Add the account addresses of trusted friends who can help recover your account (guardians)
   - **Recovery Threshold**: Set how many friends need to approve a recovery (must be ≤ number of friends)
   - **Refute Duration**: Set the waiting period (in days) before an approved recovery takes effect
5. **Setup Recovery**: Click "Setup Recovery" to configure social recovery for the selected accounts

The selected accounts will be configured for social recovery, allowing them to be recovered through trusted guardians if access is lost.

## Project Structure

```
polkadot-social-account-recovery/
├── app/
│   ├── page.tsx                # Main page component
│   ├── layout.tsx              # Root layout
│   └── globals.css             # Global styles
├── components/
│   ├── WalletConnect.tsx       # Wallet connection component with multi-wallet support
│   └── SocialRecoverySetup.tsx # Multi-account selection component for recovery setup
├── lib/
│   └── wallets.ts              # Wallet configurations and types
└── package.json
```

## Technologies Used

- [Next.js 15](https://nextjs.org/) - React framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [@polkadot/extension-dapp](https://polkadot.js.org/docs/extension/) - Polkadot extension integration
- [@polkadot/util](https://polkadot.js.org/docs/util/) - Polkadot utilities
- [@polkadot/util-crypto](https://polkadot.js.org/docs/util-crypto/) - Cryptographic utilities

## Building for Production

To create a production build:

```bash
pnpm build
pnpm start
```

## Learn More

- [Polkadot.js Extension Documentation](https://polkadot.js.org/docs/extension/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Polkadot Developer Documentation](https://docs.substrate.io/)

## License

MIT
