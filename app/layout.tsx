"use client";

import { DM_Sans, DM_Serif_Display } from "next/font/google";
import "./globals.css";
import { NetworkProvider } from "@/lib/NetworkContext";
import { PolkadotApiProvider } from "@/lib/PolkadotApiContext";
import { PapiProvider } from "@/lib/PapiContext";
import { PolkadotWalletProvider } from "@/lib/PolkadotWalletContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import { ToastProvider } from "@/components/Toast";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: ["400"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Polkadot Social Recovery</title>
        <meta
          name="description"
          content="Recover your account on Polkadot with friends' help"
        />
      </head>
      <body
        className={`${dmSans.variable} ${dmSerifDisplay.variable} antialiased`}
      >
        <ThemeProvider>
          <NetworkProvider>
            <PolkadotApiProvider>
              <PapiProvider>
                <PolkadotWalletProvider>
                  <ToastProvider>{children}</ToastProvider>
                </PolkadotWalletProvider>
              </PapiProvider>
            </PolkadotApiProvider>
          </NetworkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
