export const OrderStatus = {
  CREATED: "CREATED",
  QUEUED: "QUEUED",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED"
};

const allowedTransitions = {
  [OrderStatus.CREATED]: new Set([OrderStatus.QUEUED, OrderStatus.PROCESSING, OrderStatus.CANCELLED]),
  [OrderStatus.QUEUED]: new Set([OrderStatus.PROCESSING, OrderStatus.CANCELLED, OrderStatus.FAILED]),
  [OrderStatus.PROCESSING]: new Set([OrderStatus.COMPLETED, OrderStatus.FAILED]),
  [OrderStatus.COMPLETED]: new Set([]),
  [OrderStatus.FAILED]: new Set([OrderStatus.QUEUED, OrderStatus.CANCELLED]),
  [OrderStatus.CANCELLED]: new Set([])
};

export const canTransitionOrder = (fromStatus, toStatus) => {
  const from = allowedTransitions[fromStatus];
  if (!from) return false;
  return from.has(toStatus);
};

