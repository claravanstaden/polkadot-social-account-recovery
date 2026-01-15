export const TxStatusEnum = {
  IDLE: "idle",
  SIGNING: "signing",
  SUBMITTING: "submitting",
  IN_BLOCK: "in_block",
  FINALIZED: "finalized",
  ERROR: "error",
} as const;

export type TxStatus = typeof TxStatusEnum[keyof typeof TxStatusEnum];

/**
 * Get button label text for transaction status
 */
export function getTxButtonLabel(status: TxStatus, defaultLabel: string): string {
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
