"use client";

import { useState, useEffect, useCallback } from "react";
import type { ISubmittableResult } from "@polkadot/types/types";
import { useNetwork } from "@/lib/NetworkContext";
import { usePolkadotApi } from "@/lib/usePolkadotApi";
import { usePolkadotWallet } from "@/lib/PolkadotWalletContext";
import Tooltip from "./Tooltip";
import { useToast } from "./Toast";
import { TxStatus, TxStatusEnum, getTxButtonLabel, getTxStatusMessage } from "@/lib/txStatus";

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
  withdrawable: boolean; // True if balance > 0
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
  const { showToast } = useToast();

  const [txStatus, setTxStatus] = useState<TxStatus>(TxStatusEnum.IDLE);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Inherited accounts
  const [inheritedAccounts, setInheritedAccounts] = useState<InheritedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Transfer form state
  const [selectedInherited, setSelectedInherited] = useState<string>("");
  const [transferRecipient, setTransferRecipient] = useState<string>("");

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
      const tokenDecimals = api.registry.chainDecimals[0];

      for (const address of inheritedAddresses) {
        try {
          // Fetch balance
          const accountInfo = await api.query.system.account(address);
          const data = accountInfo.toJSON() as any;
          const freeBalance = BigInt(data?.data?.free || 0);
          const balanceFormatted = (Number(freeBalance) / Math.pow(10, tokenDecimals)).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          });

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
            withdrawable: freeBalance > BigInt(0),
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
            withdrawable: false,
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
    if (!selectedInherited || !transferRecipient) {
      showToast("Please fill in all transfer fields", "error");
      return;
    }

    setTxHash(null);
    setTxStatus(TxStatusEnum.SIGNING);

    try {
      const signer = wallet.signer;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apiTx = api.tx as any;
      const recoveryPallet =
        apiTx.recovery || apiTx.socialRecovery || apiTx.social_recovery;

      if (!recoveryPallet?.controlInheritedAccount) {
        showToast("controlInheritedAccount method not found in recovery pallet", "error");
        setTxStatus(TxStatusEnum.ERROR);
        return;
      }

      // Create the inner transferAll call with keepAlive = false
      const transferCall = api.tx.balances.transferAll(transferRecipient, false);

      // Wrap it with controlInheritedAccount
      const tx = recoveryPallet.controlInheritedAccount(selectedInherited, transferCall);
      setTxStatus(TxStatusEnum.SUBMITTING);

      const unsub = await tx.signAndSend(
        selectedAccount,
        { signer },
        (result: ISubmittableResult) => {
          const { status, txHash: hash, dispatchError } = result;
          setTxHash(hash.toHex());

          if (status.isInBlock) {
            setTxStatus(TxStatusEnum.IN_BLOCK);
          }

          if (status.isFinalized) {
            setTxStatus(TxStatusEnum.FINALIZED);

            if (dispatchError) {
              let errorMessage = "Transaction failed";
              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs.join(" ")}`;
              } else {
                errorMessage = dispatchError.toString();
              }
              showToast(errorMessage, "error");
              setTxStatus(TxStatusEnum.ERROR);
            } else {
              showToast(`Successfully transferred all funds from inherited account!`, "success");
              setTransferRecipient("");
              fetchInheritedAccounts();
            }

            unsub();
          }
        },
      );
    } catch (err) {
      console.error("Transfer error:", err);
      showToast(err instanceof Error ? err.message : "Failed to transfer", "error");
      setTxStatus(TxStatusEnum.ERROR);
    }
  }, [api, isConnected, wallet, selectedAccount, selectedInherited, transferRecipient, fetchInheritedAccounts, showToast]);

  // Handle clearing friend groups to prevent future contests
  const handleClearFriendGroups = useCallback(async (inheritedAddress: string) => {
    if (!api || !isConnected || !wallet || !selectedAccount) return;

    // Check if there are ongoing attempts
    const account = inheritedAccounts.find(a => a.address === inheritedAddress);
    if (account?.hasOngoingAttempts) {
      showToast("Cannot clear friend groups while there are ongoing recovery attempts. Cancel or wait for them to complete first.", "error");
      return;
    }

    setTxHash(null);
    setTxStatus(TxStatusEnum.SIGNING);

    try {
      const signer = wallet.signer;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apiTx = api.tx as any;
      const recoveryPallet = apiTx.recovery || apiTx.socialRecovery || apiTx.social_recovery;

      if (!recoveryPallet?.controlInheritedAccount || !recoveryPallet?.setFriendGroups) {
        showToast("Required methods not found in recovery pallet", "error");
        setTxStatus(TxStatusEnum.ERROR);
        return;
      }

      // Create the inner call to clear friend groups (empty array)
      const clearCall = recoveryPallet.setFriendGroups([]);

      // Wrap it with controlInheritedAccount
      const tx = recoveryPallet.controlInheritedAccount(inheritedAddress, clearCall);
      setTxStatus(TxStatusEnum.SUBMITTING);

      const unsub = await tx.signAndSend(
        selectedAccount,
        { signer },
        (result: ISubmittableResult) => {
          const { status, txHash: hash, dispatchError } = result;
          setTxHash(hash.toHex());

          if (status.isInBlock) {
            setTxStatus(TxStatusEnum.IN_BLOCK);
          }

          if (status.isFinalized) {
            setTxStatus(TxStatusEnum.FINALIZED);

            if (dispatchError) {
              let errorMessage = "Transaction failed";
              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs.join(" ")}`;
              } else {
                errorMessage = dispatchError.toString();
              }
              showToast(errorMessage, "error");
              setTxStatus(TxStatusEnum.ERROR);
            } else {
              showToast("Friend groups cleared successfully! This account can no longer be contested.", "success");
              fetchInheritedAccounts();
            }

            unsub();
          }
        },
      );
    } catch (err) {
      console.error("Clear friend groups error:", err);
      showToast(err instanceof Error ? err.message : "Failed to clear friend groups", "error");
      setTxStatus(TxStatusEnum.ERROR);
    }
  }, [api, isConnected, wallet, selectedAccount, inheritedAccounts, fetchInheritedAccounts, showToast]);

  if (!wallet) {
    return (
      <div className="w-full max-w-4xl mx-auto p-8 card">
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
    <div className="w-full max-w-4xl mx-auto p-8 card">
      {apiError && (
        <div className="mb-6 alert alert-warning text-sm">
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
            className="text-sm focus-border-only w-full pl-4 pr-10 py-3 bg-[var(--background)] rounded-lg focus:ring-2 focus:ring-[var(--polkadot-accent)]/20 transition-all text-[var(--foreground)]"
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

      <div className="section-divider" />

      {/* Inherited Accounts List */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          Inherited Accounts
        </h3>

        {isLoading ? (
          <div className="empty-state">
            Loading inherited accounts...
          </div>
        ) : inheritedAccounts.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--foreground-muted)]">
              You have inherited access to {inheritedAccounts.length} account
              {inheritedAccounts.length !== 1 ? "s" : ""}
            </p>
            {inheritedAccounts.map((account) => (
              <div
                key={account.address}
                className={`p-5 rounded-xl bg-[var(--background)] transition-all ${
                  account.withdrawable ? "cursor-pointer hover:shadow-md" : "cursor-default"
                } ${
                  selectedInherited === account.address
                    ? "ring-2 ring-[var(--polkadot-accent)] shadow-md"
                    : ""
                }`}
                onClick={() => account.withdrawable && setSelectedInherited(account.address)}
              >
                {/* Contest Warning */}
                {account.canBeContested && (
                  <div className="mb-4 alert alert-warning">
                    <div className="flex items-start gap-2">
                      <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium">
                          This inheritance can be contested
                        </p>
                        <p className="text-xs opacity-90 mt-1">
                          {account.contestingGroups.length} friend group{account.contestingGroups.length !== 1 ? "s" : ""} with higher priority can still take over access.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Ongoing Attempts Warning */}
                {account.hasOngoingAttempts && (
                  <div className="mb-4 alert alert-info">
                    <div className="flex items-start gap-2">
                      <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium">
                          Ongoing recovery attempts
                        </p>
                        <p className="text-xs opacity-90 mt-1">
                          Other groups are attempting recovery. If they succeed with higher priority, they may take over access.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Account Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-wide mb-1">Account</p>
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
                    <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-wide mb-1">Balance</p>
                    <p className="font-semibold text-[var(--foreground)]">{account.balance}</p>
                  </div>
                </div>

                {/* Inheritance Info */}
                <div className="mt-4 flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      account.inheritanceOrder === 0
                        ? "bg-[var(--success-bg)] text-[var(--success)]"
                        : "bg-[var(--background)] text-[var(--foreground-muted)]"
                    }`}>
                      {account.inheritanceOrder === 0 ? "Highest Priority" : `Priority ${account.inheritanceOrder}`}
                    </span>
                  </div>
                  <span className="text-[var(--foreground-muted)]">
                    {account.friendGroups.length} friend group{account.friendGroups.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Friend Groups Details (Expandable) */}
                {account.friendGroups.length > 0 && (
                  <details className="mt-4" onClick={(e) => e.stopPropagation()}>
                    <summary className="text-sm text-[var(--foreground-muted)] cursor-pointer hover:text-[var(--foreground)]">
                      View friend groups configuration
                    </summary>
                    <div className="mt-3 space-y-2">
                      {account.friendGroups.map((group, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg text-sm ${
                            account.contestingGroups.includes(idx)
                              ? "bg-[var(--warning-bg)]"
                              : "bg-[var(--surface)]"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-[var(--foreground)]">
                              Group {idx + 1}
                            </span>
                            <div className="flex items-center gap-2">
                              {account.contestingGroups.includes(idx) && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--warning)] text-white">
                                  Can Contest
                                </span>
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                group.inheritance_order === 0
                                  ? "bg-[var(--polkadot-accent)] text-white"
                                  : "bg-[var(--grey-200)] dark:bg-[var(--grey-700)] text-[var(--foreground-muted)]"
                              }`}>
                                Priority {group.inheritance_order}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-4 text-xs text-[var(--foreground-muted)]">
                            <span>Threshold: <span className="text-[var(--foreground)]">{group.friends_needed}/{group.friends.length}</span></span>
                            <span>Delay: <span className="text-[var(--foreground)]">{group.inheritance_delay} blocks</span></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Actions */}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {!account.withdrawable ? (
                    <span className="text-sm px-4 py-2 rounded-lg bg-[var(--grey-400)] text-white cursor-not-allowed">
                      Already Withdrawn
                    </span>
                  ) : selectedInherited === account.address ? (
                    <span className="text-sm text-[var(--polkadot-accent)] flex items-center gap-1.5 font-medium">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Selected for withdrawal
                    </span>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedInherited(account.address); }}
                      className="text-sm px-4 py-2 rounded-lg bg-[var(--polkadot-accent)] text-white hover:bg-[var(--polkadot-accent-hover)] transition-colors"
                    >
                      Select for Withdrawal
                    </button>
                  )}

                  {/* Clear Friend Groups Button */}
                  {account.friendGroups.length > 0 && (
                    <Tooltip content={
                      account.hasOngoingAttempts
                        ? "Cannot clear while there are ongoing attempts"
                        : "Remove all friend groups to prevent future contests"
                    }>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleClearFriendGroups(account.address); }}
                        disabled={account.hasOngoingAttempts || txStatus === TxStatusEnum.SIGNING || txStatus === TxStatusEnum.SUBMITTING || txStatus === TxStatusEnum.IN_BLOCK}
                        className="text-sm px-4 py-2 rounded-lg text-[var(--warning)] hover:bg-[var(--warning-bg)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Clear Friend Groups
                      </button>
                    </Tooltip>
                  )}

                  {/* No friend groups badge */}
                  {account.friendGroups.length === 0 && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--success-bg)] text-[var(--success)]">
                      No friend groups set


                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            You have not inherited access to any accounts yet.
          </div>
        )}
      </div>

      {/* Transfer Form */}
      {inheritedAccounts.length > 0 && selectedInherited && (
        <>
          <div className="section-divider" />
          <div className="rounded-xl p-6 bg-[var(--background)]">
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
              Withdraw from Inherited Account
            </h3>

            <div className="space-y-4">
              <div>
                <label className="flex items-center text-sm font-medium text-[var(--foreground)] mb-2">
                  Recipient Address
                  <Tooltip content="The account that will receive the transferable DOT." />
                </label>
                <input
                  type="text"
                  value={transferRecipient}
                  onChange={(e) => setTransferRecipient(e.target.value)}
                  placeholder="Enter recipient address..."
                  className="focus-border-only w-full px-4 py-3 bg-[var(--surface)] rounded-lg focus:ring-2 focus:ring-[var(--polkadot-accent)]/20 transition-all text-sm text-[var(--foreground)]"
                />
              </div>

              <div className="alert alert-info text-sm">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-medium">Withdrawing transferable DOT</p>
                    <p className="opacity-90 mt-1">
                      This will withdraw all transferable DOT from the inherited account. There may be tokens, staked, vested or other funds remaining.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleTransfer}
                disabled={
                  !transferRecipient ||
                  txStatus === TxStatusEnum.SIGNING ||
                  txStatus === TxStatusEnum.SUBMITTING ||
                  txStatus === TxStatusEnum.IN_BLOCK
                }
                className="w-full py-3 px-4 bg-[var(--polkadot-accent)] text-white font-semibold rounded-lg hover:bg-[var(--polkadot-accent-hover)] disabled:bg-[var(--grey-400)] disabled:cursor-not-allowed transition-colors"
              >
                {getTxButtonLabel(txStatus, "Withdraw All Funds")}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Transaction Status */}
      {txStatus !== TxStatusEnum.IDLE && txStatus !== TxStatusEnum.ERROR && (
        <div className="mt-6 alert alert-info">
          <div className="flex items-center gap-2">
            {(txStatus === TxStatusEnum.SIGNING || txStatus === TxStatusEnum.SUBMITTING || txStatus === TxStatusEnum.IN_BLOCK) && (
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
            <span className="text-sm">
              {getTxStatusMessage(txStatus)}
            </span>
          </div>
          {txHash && (
            <p className="mt-2 text-xs font-mono opacity-75 break-all">
              Transaction hash: {txHash}
            </p>
          )}
        </div>
      )}

    </div>
  );
}
