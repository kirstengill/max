const RETURN_BASE_AMOUNT_UGX = 15000;
const RETURN_BASE_DAILY_UGX = 4500;

export const calculateDailyReturnUGX = (amountUGX: number): number => {
  const normalizedAmount = Math.max(0, Number(amountUGX) || 0);
  return Math.round((normalizedAmount / RETURN_BASE_AMOUNT_UGX) * RETURN_BASE_DAILY_UGX);
};