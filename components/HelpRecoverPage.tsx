"use client";

import { useState, useEffect, useCallback } from "react";
import { connectInjectedExtension } from "polkadot-api/pjs-signer";
import { useNetwork } from "@/lib/NetworkContext";
import { usePapi } from "@/lib/PapiContext";
import { usePolkadotWallet } from "@/lib/PolkadotWalletContext";
import AttemptCard from "./shared/AttemptCard";
import Tooltip from "./Tooltip";
import { useToast } from "./Toast";
import {
  TxStatus,
  TxStatusEnum,
  getTxButtonLabel,
  getTxStatusMessage,
  parseTxError,
} from "@/lib/txStatus";

interface FriendGroup {
  friends: string[];
  friends_needed: number;
  inheritor: string;
  inheritance_delay: number;
  inheritance_order: number;
  cancel_delay: number;
  deposit: number;
}

interface Attempt {
  friend_group_index: number;
  initiator: string;
  init_block: number;
  last_approval_block: number;
  approvals: number;
  voterIndices: number[]; // Track which friend indices have voted
}

interface AttemptWithGroup {
  friendGroup: FriendGroup;
  attempt: Attempt;
}

interface RecoveryStatus {
  isRecovered: boolean;
  currentInheritor: string | null;
  currentInheritanceOrder: number | null;
}

// Helper to generate Subscan account URL
const getSubscanUrl = (networkId: string, address: string): string | null => {
  if (networkId === "development") return null;
  return `https://assethub-${networkId}.subscan.io/account/${address}`;
};

export default function HelpRecoverPage() {
  const { selectedNetwork } = useNetwork();
  const {
    typedApi,
    isConnecting,
    isConnected,
    error: apiError,
    connect,
  } = usePapi();
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

  // Lost account to help recover
  const [lostAccount, setLostAccount] = useState<string>("");
  const [friendGroups, setFriendGroups] = useState<FriendGroup[]>([]);
  const [attempts, setAttempts] = useState<AttemptWithGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentBlock, setCurrentBlock] = useState<number>(0);
  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus>({
    isRecovered: false,
    currentInheritor: null,
    currentInheritanceOrder: null,
  });

  const selectedAccount = walletSelectedAccount?.address || "";

  // Fetch friend groups and attempts for the lost account
  const fetchLostAccountData = useCallback(async () => {
    if (!typedApi || !isConnected || !lostAccount) {
      setFriendGroups([]);
      setAttempts([]);
      setRecoveryStatus({
        isRecovered: false,
        currentInheritor: null,
        currentInheritanceOrder: null,
      });
      return;
    }

    setIsLoading(true);

    try {
      try {
        const blockResult =
          await typedApi.view.Recovery.provided_block_number();
        if (blockResult) {
          setCurrentBlock(Number(blockResult));
        }
      } catch (err) {
        console.warn("Could not fetch block number:", err);
      }

      let fetchedFriendGroups: FriendGroup[] = [];
      const fgResult = await typedApi.view.Recovery.friend_groups(lostAccount);
      if (fgResult && Array.isArray(fgResult) && fgResult.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fetchedFriendGroups = fgResult
          .filter((item: any) => item !== null)
          .map((group: any) => ({
            friends: group.friends || [],
            friends_needed: group.friends_needed ?? group.friendsNeeded ?? 0,
            inheritor: group.inheritor || "",
            inheritance_delay:
              group.inheritance_delay ?? group.inheritanceDelay ?? 0,
            inheritance_order:
              group.inheritance_order ?? group.inheritanceOrder ?? 0,
            cancel_delay: group.cancel_delay ?? group.cancelDelay ?? 0,
            deposit: group.deposit ?? 0,
          }));
      }
      setFriendGroups(fetchedFriendGroups);

      try {
        const inheritorResult =
          await typedApi.view.Recovery.inheritor(lostAccount);
        if (inheritorResult) {
          const inheritorAddress = inheritorResult as string;
          // To get the inheritance order, we need to check which friend group has this inheritor
          let inheritanceOrder = 0;
          for (const group of fetchedFriendGroups) {
            if (group.inheritor === inheritorAddress) {
              inheritanceOrder = group.inheritance_order;
              break;
            }
          }
          setRecoveryStatus({
            isRecovered: true,
            currentInheritor: inheritorAddress,
            currentInheritanceOrder: inheritanceOrder,
          });
        } else {
          setRecoveryStatus({
            isRecovered: false,
            currentInheritor: null,
            currentInheritanceOrder: null,
          });
        }
      } catch (inheritorErr) {
        console.warn("Could not fetch inheritor:", inheritorErr);
        setRecoveryStatus({
          isRecovered: false,
          currentInheritor: null,
          currentInheritanceOrder: null,
        });
      }

      try {
        const fetchedAttempts: AttemptWithGroup[] = [];
        const attemptsResult =
          await typedApi.view.Recovery.attempts(lostAccount);

        if (attemptsResult && Array.isArray(attemptsResult)) {
          for (const item of attemptsResult) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const [friendGroup, attemptData] = item as any;

            // Count approvals and track voter indices from bitfield
            let approvalCount = 0;
            const voterIndices: number[] = [];
            const approvals = attemptData.approvals;

            if (Array.isArray(approvals)) {
              for (let wordIdx = 0; wordIdx < approvals.length; wordIdx++) {
                const word = Number(approvals[wordIdx]) >>> 0;
                for (let bit = 0; bit < 16; bit++) {
                  if (word & (1 << bit)) {
                    approvalCount++;
                    voterIndices.push(wordIdx * 16 + bit);
                  }
                }
              }
            } else if (
              typeof approvals === "number" ||
              typeof approvals === "bigint"
            ) {
              const word = Number(approvals) >>> 0;
              for (let bit = 0; bit < 32; bit++) {
                if (word & (1 << bit)) {
                  approvalCount++;
                  voterIndices.push(bit);
                }
              }
            }

            fetchedAttempts.push({
              friendGroup: {
                friends: friendGroup.friends || [],
                friends_needed:
                  friendGroup.friends_needed ?? friendGroup.friendsNeeded ?? 0,
                inheritor: friendGroup.inheritor || "",
                inheritance_delay:
                  friendGroup.inheritance_delay ??
                  friendGroup.inheritanceDelay ??
                  0,
                inheritance_order:
                  friendGroup.inheritance_order ??
                  friendGroup.inheritanceOrder ??
                  0,
                cancel_delay:
                  friendGroup.cancel_delay ?? friendGroup.cancelDelay ?? 0,
                deposit: friendGroup.deposit ?? 0,
              },
              attempt: {
                friend_group_index:
                  attemptData.friend_group_index ??
                  attemptData.friendGroupIndex ??
                  0,
                initiator: attemptData.initiator || "",
                init_block:
                  attemptData.init_block ?? attemptData.initBlock ?? 0,
                last_approval_block:
                  attemptData.last_approval_block ??
                  attemptData.lastApprovalBlock ??
                  0,
                approvals: approvalCount,
                voterIndices,
              },
            });
          }
        }

        setAttempts(fetchedAttempts);
      } catch (attemptErr) {
        console.warn("Could not fetch attempts:", attemptErr);
        setAttempts([]);
      }
    } catch (err) {
      console.error("Error fetching lost account data:", err);
      showToast(
        "Failed to fetch account data. Please check the address.",
        "error",
      );
    } finally {
      setIsLoading(false);
    }
  }, [typedApi, isConnected, lostAccount, showToast]);

  // Fetch data when lost account changes
  useEffect(() => {
    if (lostAccount.length === 48) {
      fetchLostAccountData();
    }
  }, [lostAccount, fetchLostAccountData]);

  // Check if user has voted for an attempt
  const hasUserVoted = (
    attempt: Attempt,
    friendGroup: FriendGroup,
  ): boolean => {
    const friendIndex = friendGroup.friends.indexOf(selectedAccount);
    if (friendIndex === -1) return false;
    return attempt.voterIndices.includes(friendIndex);
  };

  // Check if user is a friend in this group
  const isUserFriend = (friendGroup: FriendGroup): boolean => {
    return friendGroup.friends.includes(selectedAccount);
  };

  // Find attempt for a friend group
  const getAttemptForGroup = (
    groupIndex: number,
  ): AttemptWithGroup | undefined => {
    return attempts.find((a) => a.attempt.friend_group_index === groupIndex);
  };

  // Check if a group can contest the current recovery
  const canGroupContest = (group: FriendGroup): boolean => {
    if (
      !recoveryStatus.isRecovered ||
      recoveryStatus.currentInheritanceOrder === null
    ) {
      return true; // Not recovered yet, can initiate
    }
    return group.inheritance_order < recoveryStatus.currentInheritanceOrder;
  };

  // Check if a group is blocked from recovering
  const isGroupBlocked = (group: FriendGroup): boolean => {
    if (
      !recoveryStatus.isRecovered ||
      recoveryStatus.currentInheritanceOrder === null
    ) {
      return false;
    }
    return group.inheritance_order >= recoveryStatus.currentInheritanceOrder;
  };

  // Handle initiate attempt
  const handleInitiateAttempt = useCallback(
    async (friendGroupIndex: number) => {
      if (
        !typedApi ||
        !isConnected ||
        !wallet ||
        !selectedAccount ||
        !lostAccount
      )
        return;

      setTxHash(null);
      setTxStatus(TxStatusEnum.SIGNING);

      try {
        const injectedExt = await connectInjectedExtension(
          wallet.extensionName,
        );
        const accounts = injectedExt.getAccounts();
        const account = accounts.find((a) => a.address === selectedAccount);
        if (!account) throw new Error("Account not found in extension");
        const papiSigner = account.polkadotSigner;

        const tx = typedApi.tx.Recovery.initiate_attempt({
          lost: { type: "Id", value: lostAccount },
          friend_group_index: friendGroupIndex,
        });

        setTxStatus(TxStatusEnum.SUBMITTING);

        const result = await tx.signAndSubmit(papiSigner);
        setTxHash(result.txHash);
        setTxStatus(TxStatusEnum.FINALIZED);
        showToast("Recovery attempt initiated successfully!", "success");
        fetchLostAccountData();
      } catch (err) {
        console.error("Initiate attempt error:", err);
        showToast(parseTxError(err), "error");
        setTxStatus(TxStatusEnum.ERROR);
      }
    },
    [
      typedApi,
      isConnected,
      wallet,
      selectedAccount,
      lostAccount,
      fetchLostAccountData,
      showToast,
    ],
  );

  // Handle approve attempt
  const handleApproveAttempt = useCallback(
    async (friendGroupIndex: number) => {
      if (
        !typedApi ||
        !isConnected ||
        !wallet ||
        !selectedAccount ||
        !lostAccount
      )
        return;

      setTxHash(null);
      setTxStatus(TxStatusEnum.SIGNING);

      try {
        const injectedExt = await connectInjectedExtension(
          wallet.extensionName,
        );
        const accounts = injectedExt.getAccounts();
        const account = accounts.find((a) => a.address === selectedAccount);
        if (!account) throw new Error("Account not found in extension");
        const papiSigner = account.polkadotSigner;

        const tx = typedApi.tx.Recovery.approve_attempt({
          lost: { type: "Id", value: lostAccount },
          friend_group_index: friendGroupIndex,
        });

        setTxStatus(TxStatusEnum.SUBMITTING);

        const result = await tx.signAndSubmit(papiSigner);
        setTxHash(result.txHash);
        setTxStatus(TxStatusEnum.FINALIZED);
        showToast("Approval submitted successfully!", "success");
        fetchLostAccountData();
      } catch (err) {
        console.error("Approve attempt error:", err);
        showToast(parseTxError(err), "error");
        setTxStatus(TxStatusEnum.ERROR);
      }
    },
    [
      typedApi,
      isConnected,
      wallet,
      selectedAccount,
      lostAccount,
      fetchLostAccountData,
      showToast,
    ],
  );

  // Handle finish attempt
  const handleFinishAttempt = useCallback(
    async (attemptIndex: number) => {
      if (
        !typedApi ||
        !isConnected ||
        !wallet ||
        !selectedAccount ||
        !lostAccount
      )
        return;

      setTxHash(null);
      setTxStatus(TxStatusEnum.SIGNING);

      try {
        const injectedExt = await connectInjectedExtension(
          wallet.extensionName,
        );
        const accounts = injectedExt.getAccounts();
        const account = accounts.find((a) => a.address === selectedAccount);
        if (!account) throw new Error("Account not found in extension");
        const papiSigner = account.polkadotSigner;

        const tx = typedApi.tx.Recovery.finish_attempt({
          lost: { type: "Id", value: lostAccount },
          attempt_index: attemptIndex,
        });

        setTxStatus(TxStatusEnum.SUBMITTING);

        const result = await tx.signAndSubmit(papiSigner);
        setTxHash(result.txHash);
        setTxStatus(TxStatusEnum.FINALIZED);
        showToast(
          "Recovery completed! The inheritor now has access to the account.",
          "success",
        );
        fetchLostAccountData();
      } catch (err) {
        console.error("Finish attempt error:", err);
        showToast(parseTxError(err), "error");
        setTxStatus(TxStatusEnum.ERROR);
      }
    },
    [
      typedApi,
      isConnected,
      wallet,
      selectedAccount,
      lostAccount,
      fetchLostAccountData,
      showToast,
    ],
  );

  // Handle cancel attempt (as initiator)
  const handleCancelAttempt = useCallback(
    async (attemptIndex: number) => {
      if (
        !typedApi ||
        !isConnected ||
        !wallet ||
        !selectedAccount ||
        !lostAccount
      )
        return;

      setTxHash(null);
      setTxStatus(TxStatusEnum.SIGNING);

      try {
        const injectedExt = await connectInjectedExtension(
          wallet.extensionName,
        );
        const accounts = injectedExt.getAccounts();
        const account = accounts.find((a) => a.address === selectedAccount);
        if (!account) throw new Error("Account not found in extension");
        const papiSigner = account.polkadotSigner;

        const tx = typedApi.tx.Recovery.cancel_attempt({
          lost: { type: "Id", value: lostAccount },
          attempt_index: attemptIndex,
        });

        setTxStatus(TxStatusEnum.SUBMITTING);

        const result = await tx.signAndSubmit(papiSigner);
        setTxHash(result.txHash);
        setTxStatus(TxStatusEnum.FINALIZED);
        showToast("Recovery attempt cancelled successfully!", "success");
        fetchLostAccountData();
      } catch (err) {
        console.error("Cancel attempt error:", err);
        showToast(parseTxError(err), "error");
        setTxStatus(TxStatusEnum.ERROR);
      }
    },
    [
      typedApi,
      isConnected,
      wallet,
      selectedAccount,
      lostAccount,
      fetchLostAccountData,
      showToast,
    ],
  );

  if (!wallet) {
    return (
      <div className="w-full max-w-4xl mx-auto p-8 card">
        <div className="text-center py-8">
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">
            Help Recover an Account
          </h2>
          <p className="text-[var(--foreground-muted)] mb-4">
            Connect your wallet to help recover a friend&apos;s account.
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

      {/* Lost Account Input */}
      <div className="mb-6">
        <label className="flex items-center text-sm font-medium text-[var(--foreground)] mb-2">
          Account to Recover
          <Tooltip content="Enter the address of the account you want to help recover. You must be listed as a friend in their recovery configuration." />
        </label>
        <input
          type="text"
          value={lostAccount}
          onChange={(e) => setLostAccount(e.target.value)}
          placeholder="Enter lost account address..."
          className="focus-border-only w-full px-4 py-3 bg-[var(--background)] rounded-lg focus:ring-2 focus:ring-[var(--polkadot-accent)]/20 transition-all text-sm text-[var(--foreground)]"
        />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="empty-state flex items-center justify-center gap-2">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
          Loading account data...
        </div>
      )}

      {/* Recovery Status Banner */}
      {!isLoading && lostAccount && recoveryStatus.isRecovered && (
        <div className="mb-6 alert alert-success">
          <div className="flex items-start gap-3">
            <svg
              className="w-6 h-6 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <h4 className="font-semibold">Account Already Recovered</h4>
              <p className="text-sm opacity-90 mt-1">
                This account has been recovered by a friend group with priority
                order {recoveryStatus.currentInheritanceOrder}.
                {recoveryStatus.currentInheritanceOrder === 0
                  ? " No other groups can contest."
                  : ` Friend groups with priority lower than ${recoveryStatus.currentInheritanceOrder} can still contest.`}
              </p>
              <div className="mt-2 p-2 bg-[var(--background)] rounded-lg">
                <span className="text-xs text-[var(--foreground-muted)]">
                  Current Inheritor:
                </span>
                {getSubscanUrl(
                  selectedNetwork.id,
                  recoveryStatus.currentInheritor!,
                ) ? (
                  <a
                    href={
                      getSubscanUrl(
                        selectedNetwork.id,
                        recoveryStatus.currentInheritor!,
                      )!
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block font-mono text-sm text-[var(--polkadot-accent)] hover:underline truncate"
                  >
                    {recoveryStatus.currentInheritor}
                  </a>
                ) : (
                  <p className="font-mono text-sm text-[var(--foreground)] truncate">
                    {recoveryStatus.currentInheritor}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Friend Groups and Attempts */}
      {!isLoading && lostAccount && friendGroups.length > 0 && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-3">
              Recovery Configuration
            </h3>
            <p className="text-sm text-[var(--foreground-muted)] mb-4">
              {friendGroups.length} friend group
              {friendGroups.length !== 1 ? "s" : ""} configured for this account
            </p>
          </div>

          {friendGroups.map((group, groupIndex) => {
            const existingAttempt = getAttemptForGroup(groupIndex);
            const userIsFriend = isUserFriend(group);
            const userHasVoted = existingAttempt
              ? hasUserVoted(existingAttempt.attempt, group)
              : false;
            const groupCanContest = canGroupContest(group);
            const groupIsBlocked = isGroupBlocked(group);

            return (
              <div
                key={groupIndex}
                className={`rounded-xl p-5 bg-[var(--background)] ${
                  groupIsBlocked &&
                  group.inheritance_order >
                    recoveryStatus.currentInheritanceOrder!
                    ? "opacity-60"
                    : ""
                }`}
              >
                {/* Recovery Status Banner */}
                {groupIsBlocked &&
                  group.inheritance_order ===
                    recoveryStatus.currentInheritanceOrder && (
                    <div className="mb-4 alert alert-success">
                      <p className="text-sm">
                        This group has completed recovery of the account.
                      </p>
                    </div>
                  )}
                {groupIsBlocked &&
                  group.inheritance_order >
                    recoveryStatus.currentInheritanceOrder! && (
                    <div className="mb-4 alert alert-error">
                      <p className="text-sm">
                        This group cannot recover. A higher priority group has
                        already completed recovery.
                      </p>
                    </div>
                  )}

                {/* Can Contest Banner */}
                {groupCanContest &&
                  recoveryStatus.isRecovered &&
                  !groupIsBlocked && (
                    <div className="mb-4 alert alert-warning">
                      <p className="text-sm">
                        This group has higher priority and can contest the
                        current recovery.
                      </p>
                    </div>
                  )}

                {/* Group Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-[var(--foreground)]">
                      Group {groupIndex + 1}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full ${
                        group.inheritance_order === 0
                          ? "bg-[var(--polkadot-accent)] text-white"
                          : "bg-[var(--grey-200)] dark:bg-[var(--grey-700)] text-[var(--foreground-muted)]"
                      }`}
                    >
                      {group.inheritance_order === 0
                        ? "Highest Priority"
                        : `Priority ${group.inheritance_order + 1}`}
                    </span>
                    {userIsFriend && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--success-bg)] text-[var(--success)]">
                        You are a friend
                      </span>
                    )}
                    {groupIsBlocked &&
                      group.inheritance_order ===
                        recoveryStatus.currentInheritanceOrder && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--success)] text-white">
                          Recovered
                        </span>
                      )}
                    {groupIsBlocked &&
                      group.inheritance_order >
                        recoveryStatus.currentInheritanceOrder! && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--error-bg)] text-[var(--error)]">
                          Blocked
                        </span>
                      )}
                    {groupCanContest &&
                      recoveryStatus.isRecovered &&
                      !groupIsBlocked && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--warning)] text-white">
                          Can Contest
                        </span>
                      )}
                  </div>
                </div>

                {/* Group Details */}
                <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm mb-4">
                  <div>
                    <span className="text-[var(--foreground-muted)]">
                      Threshold
                    </span>
                    <p className="text-[var(--foreground)]">
                      {group.friends_needed} of {group.friends.length}
                    </p>
                  </div>
                  <div>
                    <span className="text-[var(--foreground-muted)]">
                      Inheritance Delay
                    </span>
                    <p className="text-[var(--foreground)]">
                      {group.inheritance_delay} blocks
                    </p>
                  </div>
                  <div>
                    <span className="text-[var(--foreground-muted)]">
                      Cancel Delay
                    </span>
                    <p className="text-[var(--foreground)]">
                      {group.cancel_delay} blocks
                    </p>
                  </div>
                </div>

                <div className="text-sm mb-4">
                  <span className="text-[var(--foreground-muted)]">
                    Inheritor
                  </span>
                  {getSubscanUrl(selectedNetwork.id, group.inheritor) ? (
                    <a
                      href={getSubscanUrl(selectedNetwork.id, group.inheritor)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block font-mono text-xs text-[var(--polkadot-accent)] hover:underline truncate"
                    >
                      {group.inheritor}
                    </a>
                  ) : (
                    <p className="font-mono text-xs text-[var(--foreground)] truncate">
                      {group.inheritor}
                    </p>
                  )}
                </div>

                {/* Friends List */}
                <details className="text-sm mb-4">
                  <summary className="text-[var(--foreground-muted)] cursor-pointer hover:text-[var(--foreground)]">
                    {group.friends.length} friend
                    {group.friends.length !== 1 ? "s" : ""}
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {group.friends.map((friend, i) => (
                      <li
                        key={i}
                        className="font-mono text-xs truncate flex items-center gap-2"
                      >
                        {friend === selectedAccount && (
                          <span className="text-[var(--success)]">(You)</span>
                        )}
                        {getSubscanUrl(selectedNetwork.id, friend) ? (
                          <a
                            href={getSubscanUrl(selectedNetwork.id, friend)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--polkadot-accent)] hover:underline"
                          >
                            {friend}
                          </a>
                        ) : (
                          <span className="text-[var(--foreground-muted)]">
                            {friend}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>

                {/* Attempt Status or Initiate Button */}
                {existingAttempt ? (
                  <AttemptCard
                    friendGroup={group}
                    attempt={existingAttempt.attempt}
                    currentBlock={currentBlock}
                    selectedAccount={selectedAccount}
                    groupIndex={groupIndex}
                    isLostAccount={false}
                    hasVoted={userHasVoted}
                    onApprove={
                      userIsFriend && !userHasVoted && !groupIsBlocked
                        ? () => handleApproveAttempt(groupIndex)
                        : undefined
                    }
                    onFinish={
                      !groupIsBlocked
                        ? () => handleFinishAttempt(groupIndex)
                        : undefined
                    }
                    onCancel={
                      existingAttempt.attempt.initiator === selectedAccount
                        ? () => handleCancelAttempt(groupIndex)
                        : undefined
                    }
                    isLoading={
                      txStatus === TxStatusEnum.SIGNING ||
                      txStatus === TxStatusEnum.SUBMITTING ||
                      txStatus === TxStatusEnum.IN_BLOCK
                    }
                  />
                ) : userIsFriend && !groupIsBlocked ? (
                  <button
                    onClick={() => handleInitiateAttempt(groupIndex)}
                    disabled={
                      txStatus === TxStatusEnum.SIGNING ||
                      txStatus === TxStatusEnum.SUBMITTING ||
                      txStatus === TxStatusEnum.IN_BLOCK
                    }
                    className={`w-full py-3 px-4 font-medium rounded-lg transition-colors ${
                      groupCanContest && recoveryStatus.isRecovered
                        ? "bg-[var(--warning)] text-white hover:opacity-90"
                        : "bg-[var(--polkadot-accent)] text-white hover:bg-[var(--polkadot-accent-hover)]"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {groupCanContest && recoveryStatus.isRecovered
                      ? "Contest Current Recovery"
                      : "Initiate Recovery Attempt"}
                  </button>
                ) : !groupIsBlocked ? (
                  <p className="text-sm text-[var(--foreground-muted)] text-center py-2">
                    You are not a friend in this group
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* No Configuration Found */}
      {!isLoading &&
        lostAccount &&
        lostAccount.length === 48 &&
        friendGroups.length === 0 && (
          <div className="empty-state">
            No recovery configuration found for this account.
          </div>
        )}

      {/* Transaction Status */}
      {txStatus !== TxStatusEnum.IDLE && txStatus !== TxStatusEnum.ERROR && (
        <div className="mt-6 alert alert-info">
          <div className="flex items-center gap-2">
            {(txStatus === TxStatusEnum.SIGNING ||
              txStatus === TxStatusEnum.SUBMITTING ||
              txStatus === TxStatusEnum.IN_BLOCK) && (
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
            <span className="text-sm">{getTxStatusMessage(txStatus)}</span>
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
