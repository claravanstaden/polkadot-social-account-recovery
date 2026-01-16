export const TxStatusEnum = {
  IDLE: "idle",
  SIGNING: "signing",
  SUBMITTING: "submitting",
  IN_BLOCK: "in_block",
  FINALIZED: "finalized",
  ERROR: "error",
} as const;

export type TxStatus = (typeof TxStatusEnum)[keyof typeof TxStatusEnum];

/**
 * Get button label text for transaction status
 */
export function getTxButtonLabel(
  status: TxStatus,
  defaultLabel: string,
): string {
  switch (status) {
    case TxStatusEnum.SIGNING:
      return "Waiting for signature...";
    case TxStatusEnum.SUBMITTING:
      return "Submitting transaction...";
    case TxStatusEnum.IN_BLOCK:
      return "Waiting for finalization...";
    case TxStatusEnum.IDLE:
    case TxStatusEnum.FINALIZED:
    case TxStatusEnum.ERROR:
      return defaultLabel;
    default:
      return defaultLabel;
  }
}

/**
 * Get detailed status message for transaction alerts
 */
export function getTxStatusMessage(status: TxStatus): string {
  switch (status) {
    case TxStatusEnum.SIGNING:
      return "Please sign the transaction in your wallet...";
    case TxStatusEnum.SUBMITTING:
      return "Submitting transaction to the network...";
    case TxStatusEnum.IN_BLOCK:
      return "Transaction included in block, waiting for finalization...";
    case TxStatusEnum.FINALIZED:
      return "Transaction finalized!";
    default:
      return "";
  }
}

/**
 * Parse transaction errors and return user-friendly messages
 */
export function parseTxError(err: unknown): string {
  if (err instanceof Error) {
    const message = err.message;

    // Check for common Substrate/PAPI error patterns
    if (
      message.includes('"type":"Payment"') ||
      message.includes("Payment") ||
      message.includes("Inability to pay")
    ) {
      return "Insufficient funds. Your account needs more balance to cover the transaction fee and any required deposit.";
    }

    if (
      message.includes('"type":"BadOrigin"') ||
      message.includes("BadOrigin")
    ) {
      return "You are not authorized to perform this action.";
    }

    if (message.includes("NotFriend") || message.includes("not a friend")) {
      return "You are not listed as a friend in this recovery configuration.";
    }

    if (message.includes("NotStarted") || message.includes("not started")) {
      return "No recovery attempt has been started for this account.";
    }

    if (
      message.includes("AlreadyStarted") ||
      message.includes("already started")
    ) {
      return "A recovery attempt has already been initiated for this friend group.";
    }

    if (
      message.includes("AlreadyVouched") ||
      message.includes("already vouched")
    ) {
      return "You have already approved this recovery attempt.";
    }

    if (message.includes("NotEnoughFriends")) {
      return "Not enough friends have approved the recovery yet.";
    }

    if (
      message.includes("DelayNotPassed") ||
      message.includes("delay not passed")
    ) {
      return "The required delay period has not passed yet.";
    }

    if (message.includes("Cancelled") || message.includes("cancelled")) {
      return "This recovery attempt was cancelled by the user.";
    }

    if (message.includes("rejected") || message.includes("Rejected")) {
      return "Transaction was rejected. Please try again.";
    }

    return message;
  }

  return "An unexpected error occurred. Please try again.";
}
