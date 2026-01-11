"use client";

import { useMemo } from "react";
import { useNetwork } from "@/lib/NetworkContext";
import Tooltip from "../Tooltip";

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
  approvals: number; // Count of approvals
}

interface AttemptCardProps {
  friendGroup: FriendGroup;
  attempt: Attempt;
  currentBlock: number;
  selectedAccount: string;
  groupIndex: number;
  // Action handlers - only show buttons when handler is provided
  onCancel?: () => void;
  onSlash?: () => void;
  onApprove?: () => void;
  onFinish?: () => void;
  onInitiate?: () => void;
  isLoading?: boolean;
  // Context: are we the lost account or a friend?
  isLostAccount?: boolean;
  hasVoted?: boolean;
}

// Helper to generate Subscan account URL
const getSubscanUrl = (networkId: string, address: string): string | null => {
  if (networkId === "development") return null;
  return `https://assethub-${networkId}.subscan.io/account/${address}`;
};

export default function AttemptCard({
  friendGroup,
  attempt,
  currentBlock,
  selectedAccount,
  groupIndex,
  onCancel,
  onSlash,
  onApprove,
  onFinish,
  onInitiate,
  isLoading = false,
  isLostAccount = false,
  hasVoted = false,
}: AttemptCardProps) {
  const { selectedNetwork } = useNetwork();

  // Calculate time-based conditions
  const blocksUntilInheritable = useMemo(() => {
    const inheritableAt = attempt.init_block + friendGroup.inheritance_delay;
    return Math.max(0, inheritableAt - currentBlock);
  }, [attempt.init_block, friendGroup.inheritance_delay, currentBlock]);

  const blocksUntilCancelable = useMemo(() => {
    const cancelableAt =
      attempt.last_approval_block + friendGroup.cancel_delay;
    return Math.max(0, cancelableAt - currentBlock);
  }, [attempt.last_approval_block, friendGroup.cancel_delay, currentBlock]);

  const isFullyApproved = attempt.approvals >= friendGroup.friends_needed;
  const isInheritable = blocksUntilInheritable === 0 && isFullyApproved;
  const isCancelable = blocksUntilCancelable === 0 || isLostAccount;

  const approvalPercentage = Math.min(
    100,
    (attempt.approvals / friendGroup.friends_needed) * 100,
  );

  const isInitiator = attempt.initiator === selectedAccount;
  const isFriend = friendGroup.friends.includes(selectedAccount);

  return (
    <div className="p-5 rounded-xl bg-[var(--surface)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[var(--foreground)]">
            Group {groupIndex + 1}
          </span>
          <span
            className={`text-xs px-2.5 py-1 rounded-full ${
              friendGroup.inheritance_order === 0
                ? "bg-[var(--polkadot-accent)] text-white"
                : "bg-[var(--grey-200)] dark:bg-[var(--grey-700)] text-[var(--foreground-muted)]"
            }`}
          >
            {friendGroup.inheritance_order === 0
              ? "Highest Priority"
              : `Priority ${friendGroup.inheritance_order + 1}`}
          </span>
        </div>
        {isFullyApproved && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--success-bg)] text-[var(--success)]">
            Approved
          </span>
        )}
      </div>

      {/* Approval Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-[var(--foreground-muted)]">Approvals</span>
          <span className="text-[var(--foreground)]">
            {attempt.approvals} / {friendGroup.friends_needed}
          </span>
        </div>
        <div className="h-2 bg-[var(--border-color)] rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isFullyApproved
                ? "bg-[var(--success)]"
                : "bg-[var(--polkadot-accent)]"
            }`}
            style={{ width: `${approvalPercentage}%` }}
          />
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
        <div>
          <span className="text-[var(--foreground-muted)]">Initiator</span>
          {getSubscanUrl(selectedNetwork.id, attempt.initiator) ? (
            <a
              href={getSubscanUrl(selectedNetwork.id, attempt.initiator)!}
              target="_blank"
              rel="noopener noreferrer"
              className="block font-mono text-xs text-[var(--polkadot-accent)] hover:underline truncate"
            >
              {attempt.initiator.slice(0, 8)}...{attempt.initiator.slice(-8)}
            </a>
          ) : (
            <p className="font-mono text-xs text-[var(--foreground)] truncate">
              {attempt.initiator.slice(0, 8)}...{attempt.initiator.slice(-8)}
            </p>
          )}
        </div>
        <div>
          <span className="text-[var(--foreground-muted)]">Inheritor</span>
          {getSubscanUrl(selectedNetwork.id, friendGroup.inheritor) ? (
            <a
              href={getSubscanUrl(selectedNetwork.id, friendGroup.inheritor)!}
              target="_blank"
              rel="noopener noreferrer"
              className="block font-mono text-xs text-[var(--polkadot-accent)] hover:underline truncate"
            >
              {friendGroup.inheritor.slice(0, 8)}...
              {friendGroup.inheritor.slice(-8)}
            </a>
          ) : (
            <p className="font-mono text-xs text-[var(--foreground)] truncate">
              {friendGroup.inheritor.slice(0, 8)}...
              {friendGroup.inheritor.slice(-8)}
            </p>
          )}
        </div>
        <div>
          <span className="text-[var(--foreground-muted)]">Started Block</span>
          <p className="text-[var(--foreground)]">{attempt.init_block}</p>
        </div>
        <div>
          <span className="text-[var(--foreground-muted)]">Last Approval</span>
          <p className="text-[var(--foreground)]">
            {attempt.last_approval_block}
          </p>
        </div>
      </div>

      {/* Time-based Status */}
      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        {!isFullyApproved && (
          <span className="px-2.5 py-1 rounded-full bg-[var(--warning-bg)] text-[var(--warning)]">
            Needs {friendGroup.friends_needed - attempt.approvals} more
            approval(s)
          </span>
        )}
        {isFullyApproved && blocksUntilInheritable > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-[var(--info-bg)] text-[var(--info)]">
            Inheritable in {blocksUntilInheritable} blocks
          </span>
        )}
        {isInheritable && (
          <span className="px-2.5 py-1 rounded-full bg-[var(--success-bg)] text-[var(--success)]">
            Ready to finish
          </span>
        )}
        {!isLostAccount && !isCancelable && isInitiator && (
          <span className="px-2.5 py-1 rounded-full bg-[var(--info-bg)] text-[var(--info)]">
            Cancelable in {blocksUntilCancelable} blocks
          </span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {/* Approve button - for friends who haven't voted */}
        {onApprove && isFriend && !hasVoted && !isFullyApproved && (
          <button
            onClick={onApprove}
            disabled={isLoading}
            className="flex-1 min-w-[100px] px-4 py-2.5 text-sm font-medium bg-[var(--polkadot-accent)] text-white rounded-lg hover:bg-[var(--polkadot-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Approve
          </button>
        )}

        {/* Finish button - anyone can call when ready */}
        {onFinish && isInheritable && (
          <button
            onClick={onFinish}
            disabled={isLoading}
            className="flex-1 min-w-[100px] px-4 py-2.5 text-sm font-medium bg-[var(--success)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Finish Recovery
          </button>
        )}

        {/* Cancel button - for initiator (after delay) or lost account (immediate) */}
        {onCancel && (isInitiator || isLostAccount) && isCancelable && (
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 min-w-[100px] px-4 py-2.5 text-sm font-medium text-[var(--warning)] hover:bg-[var(--warning-bg)] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Tooltip content="Cancel this recovery attempt and return the deposit to the initiator">
              <span className="flex items-center justify-center gap-1">
                Cancel
                <svg
                  className="w-3.5 h-3.5"
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
              </span>
            </Tooltip>
          </button>
        )}

        {/* Slash button - only for lost account */}
        {onSlash && isLostAccount && (
          <button
            onClick={onSlash}
            disabled={isLoading}
            className="flex-1 min-w-[100px] px-4 py-2.5 text-sm font-medium text-[var(--error)] hover:bg-[var(--error-bg)] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Tooltip content="Slash this malicious attempt and burn the initiator's deposit">
              <span className="flex items-center justify-center gap-1">
                Slash
                <svg
                  className="w-3.5 h-3.5"
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
              </span>
            </Tooltip>
          </button>
        )}
      </div>

      {/* Voted indicator */}
      {hasVoted && !isFullyApproved && (
        <p className="mt-2 text-xs text-[var(--success)]">
          You have already voted for this attempt
        </p>
      )}
    </div>
  );
}
