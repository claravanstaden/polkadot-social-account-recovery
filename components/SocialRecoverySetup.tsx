"use client";

import { useState, useEffect, useCallback } from "react";
import type { ISubmittableResult } from "@polkadot/types/types";
import { useNetwork } from "@/lib/NetworkContext";
import { usePolkadotApi } from "@/lib/usePolkadotApi";
import { usePolkadotWallet } from "@/lib/PolkadotWalletContext";
import NumberInput from "./NumberInput";

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

  // Existing friend groups from chain
  const [existingFriendGroups, setExistingFriendGroups] = useState<
    FriendGroup[] | null
  >(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);

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
              // Refresh existing friend groups
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
    friendGroups,
    selectedNetwork.name,
    getActiveWssUrl,
    fetchExistingFriendGroups,
  ]);

  if (!wallet) {
    return null;
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-[var(--surface)] rounded-2xl border border-[var(--border-color)]">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl font-normal mb-2 text-[var(--foreground)]">
            Setup Social Recovery
          </h2>
          <p className="text-sm text-[var(--foreground-secondary)]">
            Configure friend groups for account recovery and inheritance
          </p>
        </div>
        <div className="flex-shrink-0 ml-4">
          {isConnected ? (
            <div className="flex items-center gap-2 text-[var(--success)] text-sm">
              <div className="w-2 h-2 bg-[var(--success)] rounded-full"></div>
              Connected
            </div>
          ) : (
            <button
              onClick={connect}
              disabled={isConnecting}
              className="px-4 py-2 text-sm bg-[var(--polkadot-accent)] text-white rounded-lg hover:bg-[var(--polkadot-accent-hover)] disabled:bg-[var(--grey-400)] disabled:cursor-not-allowed transition-colors"
            >
              {isConnecting ? "Connecting..." : "Connect to Network"}
            </button>
          )}
        </div>
      </div>

      {apiError && (
        <div className="mb-4 p-4 bg-[var(--warning-bg)] border border-[var(--warning-border)] text-[var(--warning)] rounded-lg text-sm">
          Network connection issue: {apiError}
        </div>
      )}

      {/* Account Selection */}
      <div className="mb-6">
        <label
          htmlFor="account-select"
          className="block text-sm font-medium text-[var(--foreground)] mb-2"
        >
          Account to Configure
        </label>
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
            className="focus-border-only w-full pl-4 pr-10 py-3 bg-[var(--background)] border border-[var(--border-color)] rounded-lg focus:border-[var(--polkadot-accent)] transition-colors text-[var(--foreground)]"
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
      {isConnected && selectedAccount && (
        <div className="mb-6 border-t border-[var(--border-color)] pt-6">
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
            Existing Configuration
          </h3>
          {isLoadingExisting ? (
            <div className="p-4 bg-[var(--background)] rounded-lg text-[var(--foreground-muted)] text-center">
              Loading existing friend groups...
            </div>
          ) : existingFriendGroups && existingFriendGroups.length > 0 ? (
            <div className="space-y-4">
              <div className="p-4 bg-[var(--success-bg)] border border-[var(--success-border)] rounded-lg">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-sm text-[var(--success)]">
                    This account has {existingFriendGroups.length} friend group
                    {existingFriendGroups.length !== 1 ? "s" : ""} configured on
                    chain.
                  </p>
                  <button
                    onClick={() => {
                      setFriendGroups(
                        existingFriendGroups.map((group) => ({
                          ...group,
                          friends:
                            group.friends.length > 0 ? group.friends : [""],
                        })),
                      );
                    }}
                    className="p-1.5 text-[var(--success)] hover:bg-[var(--success-bg)] rounded transition-colors"
                    title="Load into form for editing"
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
                </div>
                {existingFriendGroups
                  .slice()
                  .sort((a, b) => a.inheritance_order - b.inheritance_order)
                  .map((group, index) => (
                    <div
                      key={index}
                      className="bg-[var(--surface)] p-3 rounded-lg border border-[var(--border-color)] mb-2 last:mb-0"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-medium text-[var(--foreground)]">
                          Friend Group {index + 1}
                        </p>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            group.inheritance_order === 0
                              ? "bg-[var(--polkadot-accent)] text-white"
                              : "bg-[var(--background)] text-[var(--foreground-muted)] border border-[var(--border-color)]"
                          }`}
                        >
                          {group.inheritance_order === 0
                            ? "Highest Priority"
                            : `Priority ${group.inheritance_order + 1}`}
                        </span>
                      </div>
                      <div className="text-sm text-[var(--foreground-secondary)] space-y-1">
                        <p>
                          <span className="font-medium">Friends:</span>{" "}
                          {group.friends.length}
                        </p>
                        <ul className="ml-4 text-xs font-mono text-[var(--foreground-muted)]">
                          {group.friends.map((friend, i) => (
                            <li key={i} className="truncate">
                              {friend}
                            </li>
                          ))}
                        </ul>
                        <p>
                          <span className="font-medium">Friends Needed:</span>{" "}
                          {group.friends_needed}
                        </p>
                        <p>
                          <span className="font-medium">Inheritor:</span>{" "}
                          <span className="font-mono text-xs truncate inline-block max-w-xs align-bottom">
                            {group.inheritor}
                          </span>
                        </p>
                        <p>
                          <span className="font-medium">
                            Inheritance Delay:
                          </span>{" "}
                          {group.inheritance_delay} blocks
                        </p>
                        <p>
                          <span className="font-medium">Cancel Delay:</span>{" "}
                          {group.cancel_delay} blocks
                        </p>
                        <p>
                          <span className="font-medium">Deposit:</span>{" "}
                          {group.deposit}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--foreground-muted)] text-sm">
              No friend groups configured for this account yet.
            </div>
          )}
        </div>
      )}

      {/* Friend Groups Form */}
      <div className="border-t border-[var(--border-color)] pt-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              {existingFriendGroups && existingFriendGroups.length > 0
                ? "Update Friend Groups"
                : "Configure Friend Groups"}
            </h3>
            <p className="text-xs text-[var(--foreground-muted)] mt-1">
              Order matters: higher priority groups can override lower priority
              recoveries. Use the arrows to reorder.
            </p>
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
            className="border border-[var(--border-color)] rounded-xl p-5 space-y-4 bg-[var(--background)]"
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
                    className={`text-xs px-2 py-0.5 rounded ${
                      groupIndex === 0
                        ? "bg-[var(--polkadot-accent)] text-white"
                        : "bg-[var(--surface)] text-[var(--foreground-muted)] border border-[var(--border-color)]"
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
                  className="text-sm text-[var(--error)] hover:underline"
                >
                  Remove Group
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
                  <div key={friendIndex} className="flex gap-2">
                    <input
                      type="text"
                      value={friend}
                      onChange={(e) =>
                        updateFriend(groupIndex, friendIndex, e.target.value)
                      }
                      placeholder="Enter friend's account address..."
                      className="focus-border-only flex-1 px-4 py-3 bg-[var(--surface)] border border-[var(--border-color)] rounded-lg focus:border-[var(--polkadot-accent)] transition-colors text-sm font-mono text-[var(--foreground)]"
                    />
                    {group.friends.length > 1 && (
                      <button
                        onClick={() => removeFriend(groupIndex, friendIndex)}
                        className="px-4 py-2 bg-[var(--error-bg)] text-[var(--error)] rounded-lg hover:bg-[var(--error-border)] transition-colors"
                      >
                        Remove
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
            <NumberInput
              label="Friends Needed (Threshold)"
              value={group.friends_needed}
              onChange={(value) =>
                updateFriendGroup(groupIndex, "friends_needed", value)
              }
              min={1}
              max={group.friends.filter((f) => f.trim()).length || 1}
              hint="Number of friends required to approve recovery"
            />

            {/* Inheritor */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Inheritor Account
              </label>
              <input
                type="text"
                value={group.inheritor}
                onChange={(e) =>
                  updateFriendGroup(groupIndex, "inheritor", e.target.value)
                }
                placeholder="Enter inheritor's account address..."
                className="focus-border-only w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border-color)] rounded-lg focus:border-[var(--polkadot-accent)] transition-colors font-mono text-sm text-[var(--foreground)]"
              />
              <p className="text-xs text-[var(--foreground-muted)] mt-1">
                Account that will inherit if recovery is not claimed
              </p>
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
              />

              <NumberInput
                label="Cancel Delay"
                value={group.cancel_delay}
                onChange={(value) =>
                  updateFriendGroup(groupIndex, "cancel_delay", value)
                }
                min={1}
                suffix="blocks"
              />

              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  Deposit Amount
                </label>
                <div className="focus-parent flex items-center border border-[var(--border-color)] rounded-lg focus-within:border-[var(--polkadot-accent)] transition-colors">
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
                    className="flex-1 h-11 px-3 bg-[var(--surface)] rounded-l-lg text-[var(--foreground)]"
                  />
                  <div className="flex items-center justify-center h-11 px-4 bg-[var(--surface)] border-l border-[var(--border-color)] rounded-r-lg text-sm font-medium text-[var(--foreground-muted)]">
                    {selectedNetwork.tokenSymbol}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSetupRecovery}
        disabled={
          !selectedAccount ||
          !isConnected ||
          txStatus === "signing" ||
          txStatus === "submitting" ||
          txStatus === "in_block"
        }
        className="w-full mt-6 bg-[var(--polkadot-accent)] hover:bg-[var(--polkadot-accent-hover)] disabled:bg-[var(--grey-400)] disabled:cursor-not-allowed text-white font-semibold py-4 px-4 rounded-xl transition-colors"
      >
        {txStatus === "signing" && "Waiting for signature..."}
        {txStatus === "submitting" && "Submitting transaction..."}
        {txStatus === "in_block" && "Waiting for finalization..."}
        {(txStatus === "idle" ||
          txStatus === "finalized" ||
          txStatus === "error") &&
          `Setup Recovery with ${friendGroups.length} Friend Group${friendGroups.length !== 1 ? "s" : ""}`}
      </button>

      {/* Transaction Status */}
      {txStatus !== "idle" && txStatus !== "error" && (
        <div className="mt-4 p-4 bg-[var(--info-bg)] border border-[var(--info-border)] text-[var(--info)] rounded-lg">
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
            <span>
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
