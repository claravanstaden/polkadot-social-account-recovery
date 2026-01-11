"use client";

import { useState, useEffect, useCallback } from "react";
import type { ISubmittableResult } from "@polkadot/types/types";
import { useNetwork } from "@/lib/NetworkContext";
import { usePolkadotApi } from "@/lib/usePolkadotApi";
import { usePolkadotWallet } from "@/lib/PolkadotWalletContext";
import Tooltip from "./Tooltip";

type TxStatus =
  | "idle"
  | "signing"
  | "submitting"
  | "in_block"
  | "finalized"
  | "error";

interface FriendGroup {
  friends: string[];
  friends_needed: number;
  inheritor: string;
  inheritance_delay: number;
  inheritance_order: number;
  cancel_delay: number;
  deposit: number;
}

interface InheritedAccount {
  address: string;
  balance: string;
  balanceRaw: bigint;
  inheritanceOrder: number;
  friendGroups: FriendGroup[];
  hasOngoingAttempts: boolean;
  canBeContested: boolean; // True if lower-order groups exist
  contestingGroups: number[]; // Indices of groups that can contest
}

// Helper to generate Subscan account URL
const getSubscanUrl = (networkId: string, address: string): string | null => {
  if (networkId === "development") return null;
  return `https://assethub-${networkId}.subscan.io/account/${address}`;
};

export default function InheritedPage() {
  const { selectedNetwork } = useNetwork();
  const {
    api,
    isConnecting,
    isConnected,
    error: apiError,
    connect,
  } = usePolkadotApi();
  const {
    wallet,
    accounts,
    selectedAccount: walletSelectedAccount,
    selectAccount,
    openModal,
  } = usePolkadotWallet();

  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Inherited accounts
  const [inheritedAccounts, setInheritedAccounts] = useState<InheritedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Transfer form state
  const [selectedInherited, setSelectedInherited] = useState<string>("");
  const [transferRecipient, setTransferRecipient] = useState<string>("");
  const [transferAmount, setTransferAmount] = useState<string>("");

  const selectedAccount = walletSelectedAccount?.address || "";

  // Fetch inherited accounts
  const fetchInheritedAccounts = useCallback(async () => {
    if (!api || !isConnected || !selectedAccount) {
      setInheritedAccounts([]);
      return;
    }

    setIsLoading(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apiCall = api.call as any;
      const recoveryApi = apiCall.recoveryApi || apiCall.recovery;

      let inheritedAddresses: string[] = [];

      if (recoveryApi && recoveryApi.inheritance) {
        // Use runtime API
        const result = await recoveryApi.inheritance(selectedAccount);
        if (result && !result.isEmpty) {
          inheritedAddresses = result.toJSON() || [];
        }
      } else {
        // Fallback: iterate through Inheritor storage
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const apiQuery = api.query as any;
        const recoveryQuery =
          apiQuery.recovery ||
          apiQuery.socialRecovery ||
          apiQuery.social_recovery;

        if (recoveryQuery?.inheritor) {
          const entries = await recoveryQuery.inheritor.entries();
          for (const [key, value] of entries) {
            if (value && !value.isEmpty) {
              const data = value.toJSON();
              // Data structure: [InheritanceOrder, AccountId, Ticket]
              const inheritorAddress = Array.isArray(data) ? data[1] : data?.inheritor;
              if (inheritorAddress === selectedAccount) {
                // Extract the lost account from the key
                const lostAccount = key.args[0].toString();
                inheritedAddresses.push(lostAccount);
              }
            }
          }
        }
      }

      // Fetch balances and friend groups for each inherited account
      const accountsWithBalances: InheritedAccount[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apiQuery = api.query as any;
      const recoveryQuery = apiQuery.recovery || apiQuery.socialRecovery || apiQuery.social_recovery;

      for (const address of inheritedAddresses) {
        try {
          // Fetch balance
          const accountInfo = await api.query.system.account(address);
          const data = accountInfo.toJSON() as any;
          const freeBalance = BigInt(data?.data?.free || 0);
          const decimals = selectedNetwork.tokenDecimals;
          const balanceFormatted = (Number(freeBalance) / Math.pow(10, decimals)).toFixed(4);

          // Fetch inheritance order from Inheritor storage
          let inheritanceOrder = 0;
          if (recoveryQuery?.inheritor) {
            const inheritorData = await recoveryQuery.inheritor(address);
            if (inheritorData && !inheritorData.isEmpty) {
              const iData = inheritorData.toJSON();
              inheritanceOrder = Array.isArray(iData) ? iData[0] : (iData?.inheritance_order ?? 0);
            }
          }

          // Fetch friend groups
          let friendGroups: FriendGroup[] = [];
          if (recoveryQuery?.friendGroups) {
            const fgResult = await recoveryQuery.friendGroups(address);
            if (fgResult && !fgResult.isEmpty) {
              const fgData = fgResult.toJSON();
              let fgArray: any[] = [];
              if (Array.isArray(fgData)) {
                fgArray = Array.isArray(fgData[0]) ? fgData[0] : fgData;
              }
              friendGroups = fgArray.filter((g: any) => g !== null).map((g: any) => ({
                friends: g.friends || [],
                friends_needed: g.friends_needed ?? g.friendsNeeded ?? 0,
                inheritor: g.inheritor || "",
                inheritance_delay: g.inheritance_delay ?? g.inheritanceDelay ?? 0,
                inheritance_order: g.inheritance_order ?? g.inheritanceOrder ?? 0,
                cancel_delay: g.cancel_delay ?? g.cancelDelay ?? 0,
                deposit: g.deposit ?? 0,
              }));
            }
          }

          // Check for ongoing attempts
          let hasOngoingAttempts = false;
          if (recoveryQuery?.attempt) {
            const attempts = await recoveryQuery.attempt.entries(address);
            hasOngoingAttempts = attempts.length > 0;
          }

          // Check which groups can contest (lower order than current)
          const contestingGroups = friendGroups
            .map((g, idx) => ({ ...g, idx }))
            .filter(g => g.inheritance_order < inheritanceOrder)
            .map(g => g.idx);

          accountsWithBalances.push({
            address,
            balance: `${balanceFormatted} ${selectedNetwork.tokenSymbol}`,
            balanceRaw: freeBalance,
            inheritanceOrder,
            friendGroups,
            hasOngoingAttempts,
            canBeContested: contestingGroups.length > 0,
            contestingGroups,
          });
        } catch (err) {
          console.error(`Error fetching data for ${address}:`, err);
          accountsWithBalances.push({
            address,
            balance: "Unknown",
            balanceRaw: BigInt(0),
            inheritanceOrder: 0,
            friendGroups: [],
            hasOngoingAttempts: false,
            canBeContested: false,
            contestingGroups: [],
          });
        }
      }

      setInheritedAccounts(accountsWithBalances);
    } catch (err) {
      console.error("Error fetching inherited accounts:", err);
      setInheritedAccounts([]);
    } finally {
      setIsLoading(false);
    }
  }, [api, isConnected, selectedAccount, selectedNetwork]);

  // Fetch inherited accounts when connection or account changes
  useEffect(() => {
    fetchInheritedAccounts();
  }, [fetchInheritedAccounts]);

  // Handle transfer from inherited account
  const handleTransfer = useCallback(async () => {
    if (!api || !isConnected || !wallet || !selectedAccount) return;
    if (!selectedInherited || !transferRecipient || !transferAmount) {
      setError("Please fill in all transfer fields");
      return;
    }

    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid transfer amount");
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setTxHash(null);
    setTxStatus("signing");

    try {
      const signer = wallet.signer;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apiTx = api.tx as any;
      const recoveryPallet =
        apiTx.recovery || apiTx.socialRecovery || apiTx.social_recovery;

      if (!recoveryPallet?.controlInheritedAccount) {
        setError("controlInheritedAccount method not found in recovery pallet");
        setTxStatus("error");
        return;
      }

      // Convert amount to chain format
      const decimals = selectedNetwork.tokenDecimals;
      const amountRaw = BigInt(Math.round(amount * Math.pow(10, decimals)));

      // Create the inner transfer call
      const transferCall = api.tx.balances.transferKeepAlive(transferRecipient, amountRaw);

      // Wrap it with controlInheritedAccount
      const tx = recoveryPallet.controlInheritedAccount(selectedInherited, transferCall);
      setTxStatus("submitting");

      const unsub = await tx.signAndSend(
        selectedAccount,
        { signer },
        (result: ISubmittableResult) => {
          const { status, txHash: hash, dispatchError } = result;
          setTxHash(hash.toHex());

          if (status.isInBlock) {
            setTxStatus("in_block");
          }

          if (status.isFinalized) {
            setTxStatus("finalized");

            if (dispatchError) {
              let errorMessage = "Transaction failed";
              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs.join(" ")}`;
              } else {
                errorMessage = dispatchError.toString();
              }
              setError(errorMessage);
              setTxStatus("error");
            } else {
              setSuccessMessage(`Successfully transferred ${transferAmount} ${selectedNetwork.tokenSymbol}!`);
              setTransferAmount("");
              setTransferRecipient("");
              fetchInheritedAccounts();
            }

            unsub();
          }
        },
      );
    } catch (err) {
      console.error("Transfer error:", err);
      setError(err instanceof Error ? err.message : "Failed to transfer");
      setTxStatus("error");
    }
  }, [api, isConnected, wallet, selectedAccount, selectedInherited, transferRecipient, transferAmount, selectedNetwork, fetchInheritedAccounts]);

  // Handle clearing friend groups to prevent future contests
  const handleClearFriendGroups = useCallback(async (inheritedAddress: string) => {
    if (!api || !isConnected || !wallet || !selectedAccount) return;

    // Check if there are ongoing attempts
    const account = inheritedAccounts.find(a => a.address === inheritedAddress);
    if (account?.hasOngoingAttempts) {
      setError("Cannot clear friend groups while there are ongoing recovery attempts. Cancel or wait for them to complete first.");
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setTxHash(null);
    setTxStatus("signing");

    try {
      const signer = wallet.signer;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apiTx = api.tx as any;
      const recoveryPallet = apiTx.recovery || apiTx.socialRecovery || apiTx.social_recovery;

      if (!recoveryPallet?.controlInheritedAccount || !recoveryPallet?.setFriendGroups) {
        setError("Required methods not found in recovery pallet");
        setTxStatus("error");
        return;
      }

      // Create the inner call to clear friend groups (empty array)
      const clearCall = recoveryPallet.setFriendGroups([]);

      // Wrap it with controlInheritedAccount
      const tx = recoveryPallet.controlInheritedAccount(inheritedAddress, clearCall);
      setTxStatus("submitting");

      const unsub = await tx.signAndSend(
        selectedAccount,
        { signer },
        (result: ISubmittableResult) => {
          const { status, txHash: hash, dispatchError } = result;
          setTxHash(hash.toHex());

          if (status.isInBlock) {
            setTxStatus("in_block");
          }

          if (status.isFinalized) {
            setTxStatus("finalized");

            if (dispatchError) {
              let errorMessage = "Transaction failed";
              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs.join(" ")}`;
              } else {
                errorMessage = dispatchError.toString();
              }
              setError(errorMessage);
              setTxStatus("error");
            } else {
              setSuccessMessage("Friend groups cleared successfully! This account can no longer be contested.");
              fetchInheritedAccounts();
            }

            unsub();
          }
        },
      );
    } catch (err) {
      console.error("Clear friend groups error:", err);
      setError(err instanceof Error ? err.message : "Failed to clear friend groups");
      setTxStatus("error");
    }
  }, [api, isConnected, wallet, selectedAccount, inheritedAccounts, fetchInheritedAccounts]);

  if (!wallet) {
    return (
      <div className="w-full max-w-4xl mx-auto p-8 bg-[var(--surface)] rounded-2xl border border-[var(--border-color)] shadow-[0_0_30px_rgba(0,0,0,0.1)] dark:shadow-[0_0_30px_rgba(0,0,0,0.3)]">
        <div className="text-center py-8">
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">
            Inherited Accounts
          </h2>
          <p className="text-[var(--foreground-muted)] mb-4">
            Connect your wallet to view and manage accounts you&apos;ve inherited.
          </p>
          <button
            onClick={openModal}
            className="px-6 py-3 bg-[var(--polkadot-accent)] text-white rounded-lg hover:bg-[var(--polkadot-accent-hover)] transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-8 bg-[var(--surface)] rounded-2xl border border-[var(--border-color)] shadow-[0_0_30px_rgba(0,0,0,0.1)] dark:shadow-[0_0_30px_rgba(0,0,0,0.3)]">
      {apiError && (
        <div className="mb-4 p-4 bg-[var(--warning-bg)] border border-[var(--warning-border)] text-[var(--warning)] rounded-lg text-sm">
          Network connection issue: {apiError}
        </div>
      )}

      {/* Account Selection */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label
            htmlFor="account-select"
            className="text-sm font-medium text-[var(--foreground)]"
          >
            Your Account
          </label>
          {isConnected ? (
            <div className="flex items-center gap-1.5 text-[var(--success)] text-xs">
              <div className="w-1.5 h-1.5 bg-[var(--success)] rounded-full"></div>
              Connected
            </div>
          ) : (
            <button
              onClick={connect}
              disabled={isConnecting}
              className="text-xs text-[var(--polkadot-accent)] hover:text-[var(--polkadot-accent-hover)] disabled:text-[var(--grey-400)] disabled:cursor-not-allowed transition-colors"
            >
              {isConnecting ? "Connecting..." : "Connect to Network"}
            </button>
          )}
        </div>
        {accounts.length === 0 ? (
          <div className="text-center py-4 text-[var(--foreground-muted)]">
            <p>No accounts found.</p>
            <button
              onClick={openModal}
              className="mt-2 text-[var(--polkadot-accent)] hover:underline text-sm"
            >
              Open wallet to add accounts
            </button>
          </div>
        ) : (
          <select
            id="account-select"
            value={selectedAccount}
            onChange={(e) => selectAccount(e.target.value)}
            className="shadow-[0_2px_10px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)] text-sm focus-border-only w-full pl-4 pr-10 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg focus:border-[var(--polkadot-accent)] transition-colors text-[var(--foreground)]"
          >
            <option value="">Select an account...</option>
            {accounts.map((acc) => (
              <option key={acc.address} value={acc.address}>
                {acc.name || "Unnamed"} - {acc.address.slice(0, 8)}...
                {acc.address.slice(-8)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Inherited Accounts List */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-3">
          Inherited Accounts
        </h3>

        {isLoading ? (
          <div className="p-4 bg-[var(--background)] rounded-lg text-[var(--foreground-muted)] text-center">
            Loading inherited accounts...
          </div>
        ) : inheritedAccounts.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-[var(--foreground-muted)]">
              You have inherited access to {inheritedAccounts.length} account
              {inheritedAccounts.length !== 1 ? "s" : ""}
            </p>
            {inheritedAccounts.map((account) => (
              <div
                key={account.address}
                className={`p-4 rounded-lg border bg-[var(--background)] transition-colors ${
                  selectedInherited === account.address
                    ? "border-[var(--polkadot-accent)] bg-[var(--polkadot-accent)]/5"
                    : "border-[var(--border-color)]"
                }`}
              >
                {/* Contest Warning */}
                {account.canBeContested && (
                  <div className="mb-3 p-3 bg-[var(--warning-bg)] border border-[var(--warning-border)] rounded-lg">
                    <div className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-[var(--warning)]">
                          This inheritance can be contested
                        </p>
                        <p className="text-xs text-[var(--warning)] mt-1">
                          {account.contestingGroups.length} friend group{account.contestingGroups.length !== 1 ? "s" : ""} with higher priority (lower order) can still initiate recovery and take over access.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Ongoing Attempts Warning */}
                {account.hasOngoingAttempts && (
                  <div className="mb-3 p-3 bg-[var(--info-bg)] border border-[var(--info-border)] rounded-lg">
                    <div className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-[var(--info)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-[var(--info)]">
                          Ongoing recovery attempts
                        </p>
                        <p className="text-xs text-[var(--info)] mt-1">
                          Other friend groups are attempting to recover this account. If they succeed with a higher priority group, they may take over access.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Account Header - clickable for selection */}
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setSelectedInherited(account.address)}
                >
                  <div>
                    <p className="text-sm text-[var(--foreground-muted)]">Account</p>
                    {getSubscanUrl(selectedNetwork.id, account.address) ? (
                      <a
                        href={getSubscanUrl(selectedNetwork.id, account.address)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-sm text-[var(--polkadot-accent)] hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {account.address.slice(0, 12)}...{account.address.slice(-12)}
                      </a>
                    ) : (
                      <p className="font-mono text-sm text-[var(--foreground)]">
                        {account.address.slice(0, 12)}...{account.address.slice(-12)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-[var(--foreground-muted)]">Balance</p>
                    <p className="font-medium text-[var(--foreground)]">{account.balance}</p>
                  </div>
                </div>

                {/* Inheritance Info */}
                <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-[var(--foreground-muted)]">Your Priority: </span>
                      <span className={`font-medium ${account.inheritanceOrder === 0 ? "text-[var(--success)]" : "text-[var(--foreground)]"}`}>
                        {account.inheritanceOrder === 0 ? "Highest (0)" : `Order ${account.inheritanceOrder}`}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--foreground-muted)]">Friend Groups: </span>
                      <span className="font-medium text-[var(--foreground)]">{account.friendGroups.length}</span>
                    </div>
                  </div>
                </div>

                {/* Friend Groups Details (Expandable) */}
                {account.friendGroups.length > 0 && (
                  <details className="mt-3">
                    <summary className="text-sm text-[var(--foreground-muted)] cursor-pointer hover:text-[var(--foreground)]">
                      View friend groups configuration
                    </summary>
                    <div className="mt-2 space-y-2">
                      {account.friendGroups.map((group, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border text-sm ${
                            account.contestingGroups.includes(idx)
                              ? "border-[var(--warning-border)] bg-[var(--warning-bg)]/50"
                              : "border-[var(--border-color)] bg-[var(--surface)]"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-[var(--foreground)]">
                              Group {idx + 1}
                            </span>
                            <div className="flex items-center gap-2">
                              {account.contestingGroups.includes(idx) && (
                                <span className="text-xs px-2 py-0.5 rounded bg-[var(--warning)] text-white">
                                  Can Contest
                                </span>
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                group.inheritance_order === 0
                                  ? "bg-[var(--polkadot-accent)] text-white"
                                  : "bg-[var(--surface)] text-[var(--foreground-muted)] border border-[var(--border-color)]"
                              }`}>
                                Priority {group.inheritance_order}
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-[var(--foreground-muted)]">Threshold: </span>
                              <span className="text-[var(--foreground)]">{group.friends_needed}/{group.friends.length}</span>
                            </div>
                            <div>
                              <span className="text-[var(--foreground-muted)]">Delay: </span>
                              <span className="text-[var(--foreground)]">{group.inheritance_delay} blocks</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Actions */}
                <div className="mt-3 pt-3 border-t border-[var(--border-color)] flex flex-wrap gap-2">
                  {selectedInherited === account.address ? (
                    <span className="text-xs text-[var(--polkadot-accent)] flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Selected for transfer
                    </span>
                  ) : (
                    <button
                      onClick={() => setSelectedInherited(account.address)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-[var(--polkadot-accent)] text-white hover:bg-[var(--polkadot-accent-hover)] transition-colors"
                    >
                      Select for Transfer
                    </button>
                  )}

                  {/* Clear Friend Groups Button */}
                  {account.friendGroups.length > 0 && (
                    <Tooltip content={
                      account.hasOngoingAttempts
                        ? "Cannot clear while there are ongoing attempts"
                        : "Remove all friend groups to prevent any future recovery contests"
                    }>
                      <button
                        onClick={() => handleClearFriendGroups(account.address)}
                        disabled={account.hasOngoingAttempts || txStatus === "signing" || txStatus === "submitting" || txStatus === "in_block"}
                        className="text-xs px-3 py-1.5 rounded-lg border border-[var(--warning-border)] text-[var(--warning)] hover:bg-[var(--warning-bg)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Clear Friend Groups
                      </button>
                    </Tooltip>
                  )}

                  {/* No friend groups badge */}
                  {account.friendGroups.length === 0 && (
                    <span className="text-xs px-2 py-1 rounded bg-[var(--success-bg)] text-[var(--success)] border border-[var(--success-border)]">
                      Secure - No friend groups
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-center border-dashed">
            <span className="text-[var(--foreground-muted)] text-sm">
              You have not inherited access to any accounts yet.
            </span>
          </div>
        )}
      </div>

      {/* Transfer Form */}
      {inheritedAccounts.length > 0 && (
        <div className="border border-[var(--border-color)] rounded-xl p-5 bg-[var(--background)]">
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
            Transfer from Inherited Account
          </h3>

          {!selectedInherited ? (
            <p className="text-sm text-[var(--foreground-muted)] text-center py-4">
              Select an inherited account above to transfer from
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  From Account
                </label>
                <div className="px-4 py-3 bg-[var(--surface)] border border-[var(--border-color)] rounded-lg">
                  <p className="font-mono text-sm text-[var(--foreground)] truncate">
                    {selectedInherited}
                  </p>
                </div>
              </div>

              <div>
                <label className="flex items-center text-sm font-medium text-[var(--foreground)] mb-2">
                  Recipient Address
                  <Tooltip content="The account that will receive the transferred tokens" />
                </label>
                <input
                  type="text"
                  value={transferRecipient}
                  onChange={(e) => setTransferRecipient(e.target.value)}
                  placeholder="Enter recipient address..."
                  className="focus-border-only w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border-color)] rounded-lg focus:border-[var(--polkadot-accent)] transition-colors text-sm text-[var(--foreground)]"
                />
              </div>

              <div>
                <label className="flex items-center text-sm font-medium text-[var(--foreground)] mb-2">
                  Amount
                  <Tooltip content="Amount to transfer (uses transferKeepAlive to prevent killing the account)" />
                </label>
                <div className="flex items-center border border-[var(--border-color)] rounded-lg focus-within:border-[var(--polkadot-accent)] transition-colors">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={transferAmount}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "" || /^\d*\.?\d*$/.test(value)) {
                        setTransferAmount(value);
                      }
                    }}
                    placeholder="0.00"
                    className="flex-1 h-11 px-4 bg-[var(--surface)] rounded-l-lg text-[var(--foreground)]"
                  />
                  <div className="flex items-center justify-center h-11 px-4 bg-[var(--surface)] border-l border-[var(--border-color)] rounded-r-lg text-sm font-medium text-[var(--foreground-muted)]">
                    {selectedNetwork.tokenSymbol}
                  </div>
                </div>
              </div>

              <button
                onClick={handleTransfer}
                disabled={
                  !transferRecipient ||
                  !transferAmount ||
                  txStatus === "signing" ||
                  txStatus === "submitting" ||
                  txStatus === "in_block"
                }
                className="w-full py-3 px-4 bg-[var(--polkadot-accent)] text-white font-semibold rounded-lg hover:bg-[var(--polkadot-accent-hover)] disabled:bg-[var(--grey-400)] disabled:cursor-not-allowed transition-colors"
              >
                {txStatus === "signing" && "Waiting for signature..."}
                {txStatus === "submitting" && "Submitting transaction..."}
                {txStatus === "in_block" && "Waiting for finalization..."}
                {(txStatus === "idle" || txStatus === "finalized" || txStatus === "error") &&
                  "Transfer"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Transaction Status */}
      {txStatus !== "idle" && txStatus !== "error" && (
        <div className="mt-4 p-4 bg-[var(--info-bg)] border border-[var(--info-border)] text-[var(--info)] rounded-lg">
          <div className="flex items-center gap-2">
            {(txStatus === "signing" || txStatus === "submitting" || txStatus === "in_block") && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            <span>
              {txStatus === "signing" && "Please sign the transaction in your wallet..."}
              {txStatus === "submitting" && "Submitting transaction to the network..."}
              {txStatus === "in_block" && "Transaction included in block, waiting for finalization..."}
              {txStatus === "finalized" && "Transaction finalized!"}
            </span>
          </div>
          {txHash && (
            <p className="mt-2 text-xs font-mono break-all">
              Transaction hash: {txHash}
            </p>
          )}
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="mt-4 p-4 bg-[var(--success-bg)] border border-[var(--success-border)] text-[var(--success)] rounded-lg">
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 bg-[var(--error-bg)] border border-[var(--error-border)] text-[var(--error)] rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}
