export interface Machine {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  category: 'Alpha Vaults' | 'Infrastructure' | 'Private Wealth' | 'Liquid Yield' | 'VIP Products' | 'Clean Energy' | 'DS-Mining' | 'All' | string;
  image: string;
  dailyRewardUGX: number;
  status: 'Active' | 'Maintenance' | 'Pending' | 'Reserved';
  estYearlyROI: number;
  minInvestUGX: number;
  /** Configurable per-product minimum investment amount (admin-adjustable). */
  minimum_investment_amount?: number;
  maxInvestUGX?: number;
  durationDays?: number;
  hashrate: string;
  powerSource: string;
  uptime: string;
  temperature: string;
  efficiency: number;
  totalMinedUGX: number;
  unclaimedRewardsUGX: number;
  isBoosted?: boolean;
}

export interface UserInvestment {
  id: string;
  userId: string;
  machineId: string;
  title: string;
  subtitle?: string;
  description?: string;
  category: 'Alpha Vaults' | 'Infrastructure' | 'Private Wealth' | 'Liquid Yield' | 'VIP Products' | 'Clean Energy' | 'DS-Mining' | 'All' | string;
  image: string;
  amountInvestedUGX: number;
  investedDate: string;
  status: 'Active' | 'Maintenance' | 'Completed';
  dailyRewardUGX: number;
  estYearlyROI: number;
  hashrate: string;
  period: string; // e.g. "30 Days / Daily Distribution"
  durationDays?: number;
  totalMinedUGX: number;
  unclaimedRewardsUGX: number;
  isBoosted?: boolean;
}

export interface WalletState {
  totalBalanceUGX: number;
  welcomeBonusUGX?: number;
  withdrawableBalanceUGX?: number;
  depositedBalanceUGX?: number;
  bonusLocked?: boolean;
  dailyPnlUGX: number;
  activeMachinesCount: number;
  pendingTasksCount: number;
  pendingDepositsUGX?: number;
  pendingWithdrawalsUGX?: number;
}

export interface Transaction {
  id: string;
  userId?: string;
  username?: string;
  userFullName?: string;
  type: 'deposit' | 'withdraw' | 'reward' | 'investment' | 'reinvest' | 'bonus';
  amountUGX: number;
  feeUGX?: number;
  netAmountUGX?: number;
  feeRate?: number;
  totalDeductionUGX?: number;
  isBonusWithdrawal?: boolean;
  currency: 'UGX';
  date: string;
  timestamp?: string | number;
  created_at?: string;
  status: 'completed' | 'pending' | 'approved' | 'rejected';
  description: string;
  paymentMethod?: string;
  recipientInfo?: string;
  senderPhone?: string;
  txHash?: string;
  approvedAt?: string;
  rejectedAt?: string;
}

export interface ReferralPartner {
  id: string;
  username: string;
  fullName?: string;
  registeredDate: string;
  status: 'active' | 'pending';
  /** Total approved deposits from this referred user in UGX */
  approvedDepositUGX?: number;
  /** Commission (20%) generated from this referred user's approved deposits */
  commissionUGX?: number;
  /** Status of commission or deposit ('approved' | 'no_approved_deposit' | string) */
  commissionStatus?: string;
  /** Backwards compatibility field */
  rewardUGX?: number;
}

export interface ReferralSummary {
  totalReferrals: number;
  availableCommissionUGX: number;
  totalCommissionUGX: number;
  claimedCommissionUGX: number;
  referralCode: string;
}

export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  phone?: string;
  status?: 'active' | 'blocked';
  role?: 'admin' | 'user';
  isAdmin?: boolean;
  welcomeBonusClaimed?: boolean;
  tier: 'VIP 2 Elite' | 'Standard' | 'VIP 3 Sovereign';
  memberSince: string;
  createdAt?: string;
  verified: boolean;
  avatarUrl?: string;
  country: string;
  referralCode: string;
  referredBy?: string;
  referralCount: number;
  referralEarningsUGX: number;
  referrals: ReferralPartner[];
}

export interface BalanceAdjustment {
  id: string;
  userId: string;
  username: string;
  userFullName?: string;
  previousBalanceUGX: number;
  adjustmentAmountUGX: number;
  newBalanceUGX: number;
  type: 'add' | 'deduct';
  reason: string;
  adminId: string;
  adminUsername: string;
  timestamp: string | number;
  created_at?: string;
  date: string;
}

export interface AdminUserSummary {
  id: string;
  username: string;
  fullName: string;
  phone?: string;
  status: 'active' | 'blocked';
  role: 'admin' | 'user';
  isAdmin: boolean;
  tier: string;
  memberSince: string;
  createdAt?: string;
  balanceUGX: number;
  activeMachinesCount: number;
  transactionsCount: number;
  referralCount: number;
  referralCode: string;
}

export interface AdminTask {
  id: string;
  title: string;
  description: string;
  urgency: 'high' | 'medium' | 'low';
  category: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
  amountUGX?: number;
  transactionId?: string;
  userId?: string;
  username?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'success' | 'alert' | 'info';
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'support' | 'system';
  text: string;
  timestamp: string;
}

export interface UserAccountData {
  wallet: WalletState;
  transactions: Transaction[];
  machines: Machine[];
  adminTasks: AdminTask[];
  notifications: AppNotification[];
}

