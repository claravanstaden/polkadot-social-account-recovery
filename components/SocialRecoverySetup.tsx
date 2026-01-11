"use client";

import { useState, useEffect, useCallback } from "react";
import type { ISubmittableResult } from "@polkadot/types/types";
import { useNetwork } from "@/lib/NetworkContext";
import { usePolkadotApi } from "@/lib/usePolkadotApi";
import { usePolkadotWallet } from "@/lib/PolkadotWalletContext";
import NumberInput from "./NumberInput";
import Tooltip from "./Tooltip";
import AttemptCard from "./shared/AttemptCard";

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

interface Attempt {
  friend_group_index: number;
  initiator: string;
  init_block: number;
  last_approval_block: number;
  approvals: number;
}

interface AttemptWithGroup {
  friendGroup: FriendGroup;
  attempt: Attempt;
}

// Helper to generate Subscan account URL
const getSubscanUrl = (networkId: string, address: string): string | null => {
  if (networkId === "development") return null;
  return `https://assethub-${networkId}.subscan.io/account/${address}`;
};

export default function SocialRecoverySetup() {
  const { selectedNetwork, getActiveWssUrl } = useNetwork();
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
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);

  // Existing friend groups from chain
  const [existingFriendGroups, setExistingFriendGroups] = useState<
    FriendGroup[] | null
  >(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);

  // Attempts on this account
  const [attemptsOnAccount, setAttemptsOnAccount] = useState<AttemptWithGroup[]>([]);
  const [isLoadingAttempts, setIsLoadingAttempts] = useState(false);
  const [currentBlock, setCurrentBlock] = useState<number>(0);

  // Friend groups configuration
  const [friendGroups, setFriendGroups] = useState<FriendGroup[]>([
    {
      friends: [""],
      friends_needed: 2,
      inheritor: "",
      inheritance_delay: 10,
      inheritance_order: 0,
      cancel_delay: 10,
      deposit: 10,
    },
  ]);

  // Get selected account address
  const selectedAccount = walletSelectedAccount?.address || "";

  // Reset form when wallet disconnects
  useEffect(() => {
    if (!wallet) {
      setFriendGroups([
        {
          friends: [""],
          friends_needed: 2,
          inheritor: "",
          inheritance_delay: 10,
          inheritance_order: 0,
          cancel_delay: 10,
          deposit: 10,
        },
      ]);
    }
  }, [wallet]);

  // Fetch existing friend groups from chain
  const fetchExistingFriendGroups = useCallback(async () => {
    if (!api || !isConnected || !selectedAccount) {
      setExistingFriendGroups(null);
      return;
    }

    setIsLoadingExisting(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apiQuery = api.query as any;
      const recoveryQuery =
        apiQuery.recovery ||
        apiQuery.socialRecovery ||
        apiQuery.social_recovery;

      if (!recoveryQuery) {
        setExistingFriendGroups(null);
        setIsLoadingExisting(false);
        return;
      }

      // Try to find the storage for friend groups
      let result = null;
      const storageKeys = Object.keys(recoveryQuery);

      // Try common storage key names
      const possibleKeys = [
        "friendGroups",
        "recoverable",
        "friendGroup",
        "recovery",
        "config",
      ];
      for (const key of possibleKeys) {
        if (recoveryQuery[key]) {
          result = await recoveryQuery[key](selectedAccount);
          if (result && !result.isEmpty) {
            break;
          }
        }
      }

      // If no common key found, try the first available key that looks like a map
      if (!result || result.isEmpty) {
        for (const key of storageKeys) {
          if (
            typeof recoveryQuery[key] === "function" &&
            !key.startsWith("_")
          ) {
            try {
              result = await recoveryQuery[key](selectedAccount);
              if (result && !result.isEmpty) {
                break;
              }
            } catch {
              // Skip keys that don't accept account as parameter
            }
          }
        }
      }

      if (result && !result.isEmpty) {
        // Parse the result
        const data = result.toJSON();

        // Handle different data structures
        let friendGroupsArray: any[] = [];

        if (Array.isArray(data)) {
          // The data might be [[friendGroups], null] or [friendGroup1, friendGroup2]
          // Check if first element is an array of friend groups
          if (data.length > 0 && Array.isArray(data[0])) {
            // Structure: [[friendGroup1, friendGroup2, ...], null]
            friendGroupsArray = data[0].filter((item: any) => item !== null);
          } else {
            // Structure: [friendGroup1, friendGroup2, ...]
            friendGroupsArray = data.filter((item: any) => item !== null);
          }
        }

        if (friendGroupsArray.length > 0) {
          const parsedGroups: FriendGroup[] = friendGroupsArray.map(
            (group: any) => ({
              friends: group.friends || [],
              friends_needed: group.friends_needed ?? group.friendsNeeded ?? 0,
              inheritor: group.inheritor || "",
              inheritance_delay:
                group.inheritance_delay ?? group.inheritanceDelay ?? 0,
              inheritance_order:
                group.inheritance_order ?? group.inheritanceOrder ?? 0,
              cancel_delay: group.cancel_delay ?? group.cancelDelay ?? 0,
              deposit: group.deposit ?? 0,
            }),
          );
          setExistingFriendGroups(parsedGroups);
        } else {
          setExistingFriendGroups(null);
        }
      } else {
        setExistingFriendGroups(null);
      }
    } catch (err) {
      console.error("Error fetching existing friend groups:", err);
      setExistingFriendGroups(null);
    } finally {
      setIsLoadingExisting(false);
    }
  }, [api, isConnected, selectedAccount]);

  // Fetch existing friend groups when account or connection changes
  useEffect(() => {
    fetchExistingFriendGroups();
  }, [fetchExistingFriendGroups]);

  // Fetch attempts on this account and current block
  const fetchAttemptsOnAccount = useCallback(async () => {
    if (!api || !isConnected || !selectedAccount) {
      setAttemptsOnAccount([]);
      return;
    }

    setIsLoadingAttempts(true);

    try {
      // Get current block number
      const header = await api.rpc.chain.getHeader();
      setCurrentBlock(header.number.toNumber());

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apiCall = api.call as any;
      const recoveryApi = apiCall.recoveryApi || apiCall.recovery;

      if (!recoveryApi || !recoveryApi.attempts) {
        // Try storage query fallback
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const apiQuery = api.query as any;
        const recoveryQuery =
          apiQuery.recovery ||
          apiQuery.socialRecovery ||
          apiQuery.social_recovery;

        if (recoveryQuery?.attempt) {
          // Query all attempts for this account
          const entries = await recoveryQuery.attempt.entries(selectedAccount);
          const attempts: AttemptWithGroup[] = [];

          for (const [_key, value] of entries) {
            if (value && !value.isEmpty) {
              const data = value.toJSON();
              // Data structure: [AttemptOf, AttemptTicket, SecurityDeposit]
              const attemptData = Array.isArray(data) ? data[0] : data;

              if (attemptData) {
                const friendGroupIndex = attemptData.friend_group_index ?? attemptData.friendGroupIndex ?? 0;

                // Get the friend group for this attempt
                const friendGroup = existingFriendGroups?.[friendGroupIndex];
                if (friendGroup) {
                  // Count approvals from bitfield
                  let approvalCount = 0;
                  const approvals = attemptData.approvals;
                  if (Array.isArray(approvals)) {
                    for (const word of approvals) {
                      approvalCount += (word >>> 0).toString(2).split('1').length - 1;
                    }
                  } else if (typeof approvals === 'number') {
                    approvalCount = (approvals >>> 0).toString(2).split('1').length - 1;
                  }

                  attempts.push({
                    friendGroup,
                    attempt: {
                      friend_group_index: friendGroupIndex,
                      initiator: attemptData.initiator || "",
                      init_block: attemptData.init_block ?? attemptData.initBlock ?? 0,
                      last_approval_block: attemptData.last_approval_block ?? attemptData.lastApprovalBlock ?? 0,
                      approvals: approvalCount,
                    },
                  });
                }
              }
            }
          }

          setAttemptsOnAccount(attempts);
        } else {
          setAttemptsOnAccount([]);
        }
        return;
      }

      // Use runtime API if available
      const result = await recoveryApi.attempts(selectedAccount);
      if (result && !result.isEmpty) {
        const data = result.toJSON();
        if (Array.isArray(data)) {
          const attempts: AttemptWithGroup[] = data.map((item: any) => {
            const [friendGroup, attempt] = item;
            // Count approvals from bitfield
            let approvalCount = 0;
            const approvals = attempt.approvals;
            if (Array.isArray(approvals)) {
              for (const word of approvals) {
                approvalCount += (word >>> 0).toString(2).split('1').length - 1;
              }
            }

            return {
              friendGroup: {
                friends: friendGroup.friends || [],
                friends_needed: friendGroup.friends_needed ?? friendGroup.friendsNeeded ?? 0,
                inheritor: friendGroup.inheritor || "",
                inheritance_delay: friendGroup.inheritance_delay ?? friendGroup.inheritanceDelay ?? 0,
                inheritance_order: friendGroup.inheritance_order ?? friendGroup.inheritanceOrder ?? 0,
                cancel_delay: friendGroup.cancel_delay ?? friendGroup.cancelDelay ?? 0,
                deposit: friendGroup.deposit ?? 0,
              },
              attempt: {
                friend_group_index: attempt.friend_group_index ?? attempt.friendGroupIndex ?? 0,
                initiator: attempt.initiator || "",
                init_block: attempt.init_block ?? attempt.initBlock ?? 0,
                last_approval_block: attempt.last_approval_block ?? attempt.lastApprovalBlock ?? 0,
                approvals: approvalCount,
              },
            };
          });
          setAttemptsOnAccount(attempts);
        } else {
          setAttemptsOnAccount([]);
        }
      } else {
        setAttemptsOnAccount([]);
      }
    } catch (err) {
      console.error("Error fetching attempts:", err);
      setAttemptsOnAccount([]);
    } finally {
      setIsLoadingAttempts(false);
    }
  }, [api, isConnected, selectedAccount, existingFriendGroups]);

  // Fetch attempts when account or connection changes
  useEffect(() => {
    fetchAttemptsOnAccount();
  }, [fetchAttemptsOnAccount]);

  // Handle cancel attempt
  const handleCancelAttempt = useCallback(async (attemptIndex: number) => {
    if (!api || !isConnected || !wallet || !selectedAccount) return;

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

      if (!recoveryPallet?.cancelAttempt) {
        setError("cancelAttempt method not found in recovery pallet");
        setTxStatus("error");
        return;
      }

      const tx = recoveryPallet.cancelAttempt(selectedAccount, attemptIndex);
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
              setSuccessMessage("Recovery attempt cancelled successfully!");
              fetchAttemptsOnAccount();
            }

            unsub();
          }
        },
      );
    } catch (err) {
      console.error("Cancel attempt error:", err);
      setError(err instanceof Error ? err.message : "Failed to cancel attempt");
      setTxStatus("error");
    }
  }, [api, isConnected, wallet, selectedAccount, fetchAttemptsOnAccount]);

  // Handle slash attempt
  const handleSlashAttempt = useCallback(async (attemptIndex: number) => {
    if (!window.confirm(
      "Are you sure you want to slash this attempt? This will burn the initiator's deposit and cannot be undone."
    )) {
      return;
    }

    if (!api || !isConnected || !wallet || !selectedAccount) return;

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

      if (!recoveryPallet?.slashAttempt) {
        setError("slashAttempt method not found in recovery pallet");
        setTxStatus("error");
        return;
      }

      const tx = recoveryPallet.slashAttempt(attemptIndex);
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
              setSuccessMessage("Recovery attempt slashed! The initiator's deposit has been burned.");
              fetchAttemptsOnAccount();
            }

            unsub();
          }
        },
      );
    } catch (err) {
      console.error("Slash attempt error:", err);
      setError(err instanceof Error ? err.message : "Failed to slash attempt");
      setTxStatus("error");
    }
  }, [api, isConnected, wallet, selectedAccount, fetchAttemptsOnAccount]);

  const addFriendGroup = () => {
    setFriendGroups([
      ...friendGroups,
      {
        friends: [""],
        friends_needed: 2,
        inheritor: "",
        inheritance_delay: 10,
        inheritance_order: friendGroups.length,
        cancel_delay: 10,
        deposit: 10,
      },
    ]);
  };

  const removeFriendGroup = (groupIndex: number) => {
    if (friendGroups.length > 1) {
      setFriendGroups(friendGroups.filter((_, i) => i !== groupIndex));
    }
  };

  const moveFriendGroup = (fromIndex: number, direction: "up" | "down") => {
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= friendGroups.length) return;

    const newGroups = [...friendGroups];
    [newGroups[fromIndex], newGroups[toIndex]] = [
      newGroups[toIndex],
      newGroups[fromIndex],
    ];
    setFriendGroups(newGroups);
  };

  const updateFriendGroup = (
    groupIndex: number,
    field: keyof FriendGroup,
    value: any,
  ) => {
    const newGroups = [...friendGroups];
    newGroups[groupIndex] = { ...newGroups[groupIndex], [field]: value };
    setFriendGroups(newGroups);
  };

  const addFriend = (groupIndex: number) => {
    const newGroups = [...friendGroups];
    newGroups[groupIndex].friends.push("");
    setFriendGroups(newGroups);
  };

  const removeFriend = (groupIndex: number, friendIndex: number) => {
    const newGroups = [...friendGroups];
    if (newGroups[groupIndex].friends.length > 1) {
      newGroups[groupIndex].friends = newGroups[groupIndex].friends.filter(
        (_, i) => i !== friendIndex,
      );
      setFriendGroups(newGroups);
    }
  };

  const updateFriend = (
    groupIndex: number,
    friendIndex: number,
    value: string,
  ) => {
    const newGroups = [...friendGroups];
    newGroups[groupIndex].friends[friendIndex] = value;
    setFriendGroups(newGroups);
  };

  const handleSetupRecovery = useCallback(async () => {
    setError(null);
    setSuccessMessage(null);
    setTxHash(null);

    if (!selectedAccount) {
      setError("Please select an account to configure recovery for");
      return;
    }

    if (!api || !isConnected) {
      setError(
        'Not connected to network. Please wait for connection or click "Connect to Network".',
      );
      return;
    }

    // Verify wallet is connected
    if (!wallet || !walletSelectedAccount) {
      setError("Please connect your wallet and select an account");
      return;
    }

    // Validate friend groups
    for (let i = 0; i < friendGroups.length; i++) {
      const group = friendGroups[i];
      const validFriends = group.friends.filter((f) => f.trim() !== "");

      if (validFriends.length === 0) {
        setError(
          `Friend group ${i + 1}: Please add at least one friend account`,
        );
        return;
      }

      if (
        group.friends_needed < 1 ||
        group.friends_needed > validFriends.length
      ) {
        setError(
          `Friend group ${i + 1}: Friends needed must be between 1 and ${validFriends.length}`,
        );
        return;
      }

      if (!group.inheritor.trim()) {
        setError(`Friend group ${i + 1}: Please specify an inheritor account`);
        return;
      }

      if (group.inheritance_delay < 1) {
        setError(
          `Friend group ${i + 1}: Inheritance delay must be at least 1 block`,
        );
        return;
      }

      if (group.cancel_delay < 1) {
        setError(
          `Friend group ${i + 1}: Cancel delay must be at least 1 block`,
        );
        return;
      }

      if (group.deposit < 0) {
        setError(`Friend group ${i + 1}: Deposit must be a positive number`);
        return;
      }
    }

    // Prepare friend groups data for the extrinsic
    // Sort friends alphabetically as required by the pallet
    // Use array index as inheritance_order (position in list = priority)
    // Convert deposit from human-readable to chain format (10 or 12 decimals)
    const tokenDecimals = selectedNetwork.tokenDecimals;
    const friendGroupsData = friendGroups.map((group, index) => ({
      deposit: BigInt(
        Math.round(group.deposit * Math.pow(10, tokenDecimals)),
      ).toString(),
      friends: group.friends.filter((f) => f.trim() !== "").sort(),
      friends_needed: group.friends_needed,
      inheritor: group.inheritor,
      inheritance_delay: group.inheritance_delay,
      inheritance_order: index, // Lower index = higher priority
      cancel_delay: group.cancel_delay,
    }));

    try {
      setTxStatus("signing");

      // Get the signer from the wallet
      const signer = wallet.signer;

      // Find the recovery pallet - try various possible names
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apiTx = api.tx as any;
      const recoveryPallet =
        apiTx.recovery || apiTx.socialRecovery || apiTx.social_recovery;

      if (!recoveryPallet) {
        const chainName = await api.rpc.system.chain();
        setError(
          `Recovery pallet not found on chain "${chainName}". ` +
            `Please verify you're connected to a chain with the recovery pallet.`,
        );
        setTxStatus("error");
        return;
      }

      if (!recoveryPallet.setFriendGroups) {
        setError("setFriendGroups method not found in recovery pallet.");
        setTxStatus("error");
        return;
      }

      // Create the extrinsic
      const tx = recoveryPallet.setFriendGroups(friendGroupsData);

      setTxStatus("submitting");

      // Sign and send the transaction
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

            // Check for dispatch error
            if (dispatchError) {
              let errorMessage = "Transaction failed";

              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(
                  dispatchError.asModule,
                );
                errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs.join(" ")}`;
              } else {
                errorMessage = dispatchError.toString();
              }

              setError(errorMessage);
              setTxStatus("error");
            } else {
              setSuccessMessage(
                `Social recovery configured successfully! Transaction hash: ${hash.toHex()}`,
              );
              // Refresh existing friend groups and close form
              fetchExistingFriendGroups();
              setIsFormVisible(false);
            }

            unsub();
          }
        },
      );
    } catch (err) {
      console.error("Transaction error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to submit transaction",
      );
      setTxStatus("error");
    }
  }, [
    selectedAccount,
    api,
    isConnected,
    wallet,
    walletSelectedAccount,
    friendGroups,
    selectedNetwork.name,
    getActiveWssUrl,
    fetchExistingFriendGroups,
  ]);

  const handleDeleteFriendGroups = useCallback(async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete all friend groups? This action cannot be undone.",
      )
    ) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setTxHash(null);

    if (!selectedAccount) {
      setError("Please select an account");
      return;
    }

    if (!api || !isConnected) {
      setError("Not connected to network");
      return;
    }

    if (!wallet || !walletSelectedAccount) {
      setError("Please connect your wallet and select an account");
      return;
    }

    try {
      setTxStatus("signing");

      const signer = wallet.signer;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apiTx = api.tx as any;
      const recoveryPallet =
        apiTx.recovery || apiTx.socialRecovery || apiTx.social_recovery;

      if (!recoveryPallet || !recoveryPallet.setFriendGroups) {
        setError("Recovery pallet not found");
        setTxStatus("error");
        return;
      }

      // Pass empty array to delete all friend groups
      const tx = recoveryPallet.setFriendGroups([]);

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
                const decoded = api.registry.findMetaError(
                  dispatchError.asModule,
                );
                errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs.join(" ")}`;
              } else {
                errorMessage = dispatchError.toString();
              }
              setError(errorMessage);
              setTxStatus("error");
            } else {
              setSuccessMessage("Friend groups deleted successfully!");
              fetchExistingFriendGroups();
            }

            unsub();
          }
        },
      );
    } catch (err) {
      console.error("Transaction error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to submit transaction",
      );
      setTxStatus("error");
    }
  }, [
    selectedAccount,
    api,
    isConnected,
    wallet,
    walletSelectedAccount,
    fetchExistingFriendGroups,
  ]);

  if (!wallet) {
    return null;
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
            Account
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

      {/* Existing Friend Groups from Chain */}
      {isConnected && selectedAccount && !isFormVisible && (
        <div>
          {isLoadingExisting ? (
            <div className="empty-state">
              Loading existing friend groups...
            </div>
          ) : existingFriendGroups && existingFriendGroups.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[var(--foreground-muted)]">
                  {existingFriendGroups.length} friend group
                  {existingFriendGroups.length !== 1 ? "s" : ""} configured
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setFriendGroups(
                        existingFriendGroups.map((group) => ({
                          ...group,
                          friends:
                            group.friends.length > 0 ? group.friends : [""],
                        })),
                      );
                      setIsFormVisible(true);
                    }}
                    className="p-1.5 text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--border-color)] rounded transition-colors"
                    title="Edit friend groups"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={handleDeleteFriendGroups}
                    disabled={
                      txStatus === "signing" ||
                      txStatus === "submitting" ||
                      txStatus === "in_block"
                    }
                    className="p-1.5 text-[var(--foreground-muted)] hover:text-[var(--error)] hover:bg-[var(--error-bg)] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete all friend groups"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              {existingFriendGroups
                .slice()
                .sort((a, b) => a.inheritance_order - b.inheritance_order)
                .map((group, index) => (
                  <div
                    key={index}
                    className="p-5 rounded-xl bg-[var(--background)]"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <span className="font-medium text-[var(--foreground)]">
                        Group {index + 1}
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
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                      <div>
                        <span className="text-xs text-[var(--foreground-muted)] uppercase tracking-wide">
                          Threshold
                        </span>
                        <p className="text-[var(--foreground)] font-medium mt-0.5">
                          {group.friends_needed} of {group.friends.length}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-[var(--foreground-muted)] uppercase tracking-wide">
                          Inheritance Delay
                        </span>
                        <p className="text-[var(--foreground)] font-medium mt-0.5">
                          {group.inheritance_delay} blocks
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-[var(--foreground-muted)] uppercase tracking-wide">
                          Cancel Delay
                        </span>
                        <p className="text-[var(--foreground)] font-medium mt-0.5">
                          {group.cancel_delay} blocks
                        </p>
                      </div>
                    </div>

                    <div className="text-sm mb-3">
                      <span className="text-xs text-[var(--foreground-muted)] uppercase tracking-wide">
                        Inheritor
                      </span>
                      {getSubscanUrl(selectedNetwork.id, group.inheritor) ? (
                        <a
                          href={
                            getSubscanUrl(selectedNetwork.id, group.inheritor)!
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block font-mono text-xs text-[var(--polkadot-accent)] hover:underline truncate mt-0.5"
                        >
                          {group.inheritor}
                        </a>
                      ) : (
                        <p className="font-mono text-xs text-[var(--foreground)] truncate mt-0.5">
                          {group.inheritor}
                        </p>
                      )}
                    </div>

                    <details className="text-sm">
                      <summary className="text-[var(--foreground-muted)] cursor-pointer hover:text-[var(--foreground)]">
                        {group.friends.length} friend
                        {group.friends.length !== 1 ? "s" : ""}
                      </summary>
                      <ul className="mt-2 space-y-1 pl-2">
                        {group.friends.map((friend, i) => (
                          <li key={i} className="font-mono text-xs truncate">
                            {getSubscanUrl(selectedNetwork.id, friend) ? (
                              <a
                                href={
                                  getSubscanUrl(selectedNetwork.id, friend)!
                                }
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
                  </div>
                ))}
            </div>
          ) : (
            <div className="p-6 bg-[var(--background)] rounded-xl flex items-center justify-between">
              <span className="text-[var(--foreground-muted)] text-sm">
                No recovery configured for this account yet.
              </span>
              <button
                onClick={() => setIsFormVisible(true)}
                className="px-4 py-2 text-sm bg-[var(--polkadot-accent)] text-white rounded-lg hover:bg-[var(--polkadot-accent-hover)] transition-colors"
              >
                Set Recovery
              </button>
            </div>
          )}
        </div>
      )}

      {/* Recovery Attempts on My Account */}
      {isConnected && selectedAccount && !isFormVisible && (
        <div className="mt-8">
          <div className="section-divider" />
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4 mt-6">
            Recovery Attempts on My Account
          </h3>
          {isLoadingAttempts ? (
            <div className="empty-state">
              Loading recovery attempts...
            </div>
          ) : attemptsOnAccount.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--foreground-muted)]">
                {attemptsOnAccount.length} active recovery attempt
                {attemptsOnAccount.length !== 1 ? "s" : ""} on your account
              </p>
              {attemptsOnAccount.map((item, index) => (
                <AttemptCard
                  key={index}
                  friendGroup={item.friendGroup}
                  attempt={item.attempt}
                  currentBlock={currentBlock}
                  selectedAccount={selectedAccount}
                  groupIndex={item.attempt.friend_group_index}
                  isLostAccount={true}
                  onCancel={() => handleCancelAttempt(item.attempt.friend_group_index)}
                  onSlash={() => handleSlashAttempt(item.attempt.friend_group_index)}
                  isLoading={txStatus === "signing" || txStatus === "submitting" || txStatus === "in_block"}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              No active recovery attempts on your account.
            </div>
          )}
        </div>
      )}

      {/* Friend Groups Form */}
      {isFormVisible && (
        <div className="pt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-[var(--foreground)]">
                {existingFriendGroups && existingFriendGroups.length > 0
                  ? "Update Recovery"
                  : "Set Recovery"}
              </h3>
              <button
                onClick={() => setIsInfoDialogOpen(true)}
                className="p-1 text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--border-color)] rounded transition-colors"
                title="Learn more"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>
            </div>
            <button
              onClick={addFriendGroup}
              className="px-4 py-2 text-sm bg-[var(--polkadot-accent)] text-white rounded-lg hover:bg-[var(--polkadot-accent-hover)] transition-colors"
            >
              + Add Friend Group
            </button>
          </div>

          {friendGroups.map((group, groupIndex) => (
            <div
              key={groupIndex}
              className="rounded-xl p-6 space-y-5 bg-[var(--background)]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Priority reorder buttons */}
                  {friendGroups.length > 1 && (
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveFriendGroup(groupIndex, "up")}
                        disabled={groupIndex === 0}
                        className="p-1 text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Move up (higher priority)"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 15l7-7 7 7"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveFriendGroup(groupIndex, "down")}
                        disabled={groupIndex === friendGroups.length - 1}
                        className="p-1 text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Move down (lower priority)"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                  <div>
                    <h4 className="font-semibold text-[var(--foreground)]">
                      Friend Group {groupIndex + 1}
                    </h4>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full inline-block mt-1 ${
                        groupIndex === 0
                          ? "bg-[var(--polkadot-accent)] text-white"
                          : "bg-[var(--grey-200)] dark:bg-[var(--grey-700)] text-[var(--foreground-muted)]"
                      }`}
                    >
                      {groupIndex === 0
                        ? "Highest Priority"
                        : `Priority ${groupIndex + 1}`}
                    </span>
                  </div>
                </div>
                {friendGroups.length > 1 && (
                  <button
                    onClick={() => removeFriendGroup(groupIndex)}
                    className="p-1.5 text-[var(--foreground-muted)] hover:text-[var(--error)] hover:bg-[var(--error-bg)] rounded transition-colors"
                    title="Remove group"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>

              {/* Friends */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  Friend Accounts
                </label>
                <div className="space-y-2">
                  {group.friends.map((friend, friendIndex) => (
                    <div key={friendIndex} className="relative">
                      <input
                        type="text"
                        value={friend}
                        onChange={(e) =>
                          updateFriend(groupIndex, friendIndex, e.target.value)
                        }
                        placeholder="Enter friend's account address..."
                        className={`focus-border-only w-full px-4 py-3 bg-[var(--surface)] rounded-lg focus:ring-2 focus:ring-[var(--polkadot-accent)]/20 transition-all text-sm text-[var(--foreground)] ${group.friends.length > 1 ? "pr-10" : ""}`}
                      />
                      {group.friends.length > 1 && (
                        <button
                          onClick={() => removeFriend(groupIndex, friendIndex)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--foreground-muted)] hover:text-[var(--error)] transition-colors"
                          title="Remove friend"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => addFriend(groupIndex)}
                  className="mt-2 text-sm text-[var(--polkadot-accent)] hover:underline"
                >
                  + Add Friend
                </button>
              </div>

              {/* Friends Needed (Threshold) */}
              <div className="max-w-[220px]">
                <NumberInput
                  label="Friends Needed (Threshold)"
                  value={group.friends_needed}
                  onChange={(value) =>
                    updateFriendGroup(groupIndex, "friends_needed", value)
                  }
                  min={1}
                  max={group.friends.filter((f) => f.trim()).length || 1}
                  tooltip="The minimum number of friends required to approve a recovery or inheritance. For example, '2 of 3' means any 2 friends can initiate."
                />
              </div>

              {/* Inheritor */}
              <div>
                <label className="flex items-center text-sm font-medium text-[var(--foreground)] mb-2">
                  Inheritor Account
                  <Tooltip content="The account that will receive your assets if friends initiate inheritance and you don't cancel within the delay period." />
                </label>
                <input
                  type="text"
                  value={group.inheritor}
                  onChange={(e) =>
                    updateFriendGroup(groupIndex, "inheritor", e.target.value)
                  }
                  placeholder="Enter inheritor's account address..."
                  className="focus-border-only w-full px-4 py-3 bg-[var(--surface)] rounded-lg focus:ring-2 focus:ring-[var(--polkadot-accent)]/20 transition-all text-sm text-[var(--foreground)]"
                />
              </div>

              {/* Delays and Deposit */}
              <div className="grid grid-cols-3 gap-4">
                <NumberInput
                  label="Inheritance Delay"
                  value={group.inheritance_delay}
                  onChange={(value) =>
                    updateFriendGroup(groupIndex, "inheritance_delay", value)
                  }
                  min={1}
                  suffix="blocks"
                  tooltip="Number of blocks to wait before inheritance can be claimed. This gives you time to cancel unwanted recovery attempts."
                />

                <NumberInput
                  label="Cancel Delay"
                  value={group.cancel_delay}
                  onChange={(value) =>
                    updateFriendGroup(groupIndex, "cancel_delay", value)
                  }
                  min={1}
                  suffix="blocks"
                  tooltip="Number of blocks after which a pending recovery can be cancelled by a higher-priority group."
                />

                <div>
                  <label className="flex items-center text-sm font-medium text-[var(--foreground)] mb-2">
                    Deposit Amount
                    <Tooltip content="Required deposit locked when creating this recovery configuration. Will be returned when the configuration is removed." />
                  </label>
                  <div className="focus-parent flex items-center bg-[var(--surface)] rounded-lg focus-within:ring-2 focus-within:ring-[var(--polkadot-accent)]/20 transition-all overflow-hidden">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={group.deposit}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Allow empty, numbers, and decimals
                        if (value === "" || /^\d*\.?\d*$/.test(value)) {
                          updateFriendGroup(
                            groupIndex,
                            "deposit",
                            value === "" ? 0 : parseFloat(value) || 0,
                          );
                        }
                      }}
                      placeholder="0.00"
                      className="flex-1 h-11 px-3 bg-transparent text-[var(--foreground)]"
                    />
                    <div className="flex items-center justify-center h-11 px-4 text-sm font-medium text-[var(--foreground-muted)]">
                      {selectedNetwork.tokenSymbol}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setIsFormVisible(false)}
              className="flex-1 py-4 px-4 bg-[var(--background)] text-[var(--foreground)] font-semibold rounded-xl hover:bg-[var(--grey-200)] dark:hover:bg-[var(--grey-700)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSetupRecovery}
              disabled={
                !selectedAccount ||
                !isConnected ||
                txStatus === "signing" ||
                txStatus === "submitting" ||
                txStatus === "in_block"
              }
              className="flex-1 bg-[var(--polkadot-accent)] hover:bg-[var(--polkadot-accent-hover)] disabled:bg-[var(--grey-400)] disabled:cursor-not-allowed text-white font-semibold py-4 px-4 rounded-xl transition-colors"
            >
              {txStatus === "signing" && "Waiting for signature..."}
              {txStatus === "submitting" && "Submitting transaction..."}
              {txStatus === "in_block" && "Waiting for finalization..."}
              {(txStatus === "idle" ||
                txStatus === "finalized" ||
                txStatus === "error") &&
                `Save ${friendGroups.length} Friend Group${friendGroups.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}

      {/* Transaction Status */}
      {txStatus !== "idle" && txStatus !== "error" && (
        <div className="mt-6 alert alert-info">
          <div className="flex items-center gap-2">
            {(txStatus === "signing" ||
              txStatus === "submitting" ||
              txStatus === "in_block") && (
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
              {txStatus === "signing" &&
                "Please sign the transaction in your wallet..."}
              {txStatus === "submitting" &&
                "Submitting transaction to the network..."}
              {txStatus === "in_block" &&
                "Transaction included in block, waiting for finalization..."}
              {txStatus === "finalized" && "Transaction finalized!"}
            </span>
          </div>
          {txHash && (
            <p className="mt-2 text-xs font-mono opacity-75 break-all">
              Transaction hash: {txHash}
            </p>
          )}
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="mt-6 alert alert-success text-sm">
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-6 alert alert-error text-sm">
          {error}
        </div>
      )}

      {/* Info Dialog */}
      {isInfoDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-[var(--grey-950)]/50 backdrop-blur-sm"
            onClick={() => setIsInfoDialogOpen(false)}
          />
          <div className="relative card max-w-lg w-full mx-4 p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl text-[var(--foreground)]">
                How Social Recovery Works
              </h2>
              <button
                onClick={() => setIsInfoDialogOpen(false)}
                className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="space-y-4 text-sm text-[var(--foreground-secondary)]">
              <div>
                <h3 className="font-semibold text-[var(--foreground)] mb-1">
                  Friend Groups
                </h3>
                <p>
                  A friend group is a set of trusted accounts that can help
                  recover your account. You can create multiple groups with
                  different priority levels.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-[var(--foreground)] mb-1">
                  Priority Order
                </h3>
                <p>
                  Higher priority groups can override recovery attempts from
                  lower priority groups. Use the arrows to reorder groups.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-[var(--foreground)] mb-1">
                  Threshold
                </h3>
                <p>
                  The number of friends required to approve a recovery. For
                  example, &quot;2 of 3&quot; means any 2 friends from the group
                  can initiate recovery.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-[var(--foreground)] mb-1">
                  Inheritor
                </h3>
                <p>
                  The account that will receive your assets if friends initiate
                  inheritance and you don&apos;t claim them within the delay
                  period.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-[var(--foreground)] mb-1">
                  Inheritance Delay
                </h3>
                <p>
                  Number of blocks to wait before inheritance can be claimed.
                  Gives you time to cancel unwanted recovery attempts.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-[var(--foreground)] mb-1">
                  Cancel Delay
                </h3>
                <p>
                  Number of blocks after which a pending recovery can be
                  cancelled by a higher-priority group.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsInfoDialogOpen(false)}
              className="w-full mt-6 py-3 bg-[var(--polkadot-accent)] text-white rounded-lg hover:bg-[var(--polkadot-accent-hover)] transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
