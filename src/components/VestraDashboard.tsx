import React, { useState } from 'react';
import {
  Machine,
  UserInvestment,
  Transaction,
  WalletState,
  UserProfile,
  AppNotification,
} from '../types';
import { InvestmentCard } from './InvestmentCard';
import {
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  Layers,
  Clock,
  CheckCircle2,
  ChevronRight,
  Zap,
  Gift,
  Coins,
  RefreshCw,
  Bell,
  Eye,
  EyeOff,
  Flame,
  CheckCircle,
} from 'lucide-react';
import { WelcomeBonusCard } from './WelcomeBonusCard';

interface VestraDashboardProps {
  user: UserProfile | null;
  wallet: WalletState;
  machines: Machine[];
  userInvestments: UserInvestment[];
  transactions: Transaction[];
  notifications: AppNotification[];
  onDeposit: () => void;
  onWithdraw: () => void;
  onInvest: (machine: Machine) => void;
  onOpenPortfolio: () => void;
  onOpenWallet: () => void;
  onOpenVaults: () => void;
  onClaimReward?: (investmentId: string) => void;
  onRefresh?: () => void;
}

export const VestraDashboard: React.FC<VestraDashboardProps> = ({
  user,
  wallet,
  machines,
  userInvestments,
  transactions,
  notifications,
  onDeposit,
  onWithdraw,
  onInvest,
  onOpenPortfolio,
  onOpenWallet,
  onOpenVaults,
  onClaimReward,
  onRefresh,
}) => {
  const [showBalance, setShowBalance] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('All');

  // Calculations
  const availableBalance = wallet.totalBalanceUGX || 0;
  const dailyYield = wallet.dailyPnlUGX || 0;

  // Total Invested (from active user investments or transactions)
  const totalInvested = userInvestments.reduce(
    (sum, inv) => sum + (inv.amountUGX || inv.purchasePriceUGX || 0),
    0
  );

  // Total Lifetime Earnings (from rewards)
  const totalEarnings = transactions
    .filter((t) => t.type === 'reward' && (t.status === 'completed' || t.status === 'approved'))
    .reduce((sum, t) => sum + (t.amountUGX || 0), 0);

  const activeInvestmentsCount = userInvestments.filter(
    (inv) => inv.status === 'active' || inv.status === 'producing'
  ).length;

  const hasApprovedDeposit = transactions.some(
    (t) => t.type === 'deposit' && (t.status === 'completed' || t.status === 'approved')
  );

  // Categories for filter
  const categories = ['All', 'Liquid Yield', 'Infrastructure', 'AI Clusters', 'Fixed Income'];

  const filteredMachines = machines.filter((m) => {
    if (activeCategory === 'All') return true;
    return m.category.toLowerCase().includes(activeCategory.toLowerCase());
  });

  const recentTransactions = transactions.slice(0, 4);

  return (
    <div className="px-4 sm:px-6 py-4 space-y-6 pb-12 max-w-5xl mx-auto">
      {/* 1. Personalized Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-md border border-slate-700/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Sovereign Account
            </span>
            <span className="text-[11px] font-bold text-slate-300">
              {user?.isAdmin ? 'Security Console' : 'Tier: VIP Member'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Welcome back, {user?.fullName || user?.username || 'Investor'}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">
            Your VESTRA institutional yield engine is operating with 99.98% algorithmic uptime.
          </p>
        </div>

        {/* Quick Refresh Button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sync Portfolio</span>
          </button>
        )}
      </div>

      {/* 2. Central Financial & Yield Matrix (Hero Card) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#070D18] via-[#0E1829] to-[#0A1220] p-6 text-white shadow-xl border border-slate-800">
        {/* Ambient Glows */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Main Available Balance */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Available Liquid Balance
              </span>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="text-slate-400 hover:text-white transition-colors"
                title={showBalance ? 'Hide balance' : 'Show balance'}
              >
                {showBalance ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex items-baseline gap-2.5">
              <span className="text-lg font-extrabold text-emerald-400">UGX</span>
              <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white leading-none">
                {showBalance ? availableBalance.toLocaleString() : '••••••••'}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-3 text-xs text-slate-300 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>100% Principal Protected by Sovereign Risk Buffer</span>
            </div>
          </div>

          {/* Quick Action CTAs */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onDeposit}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white font-bold text-sm shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>Deposit UGX</span>
            </button>
            <button
              onClick={onWithdraw}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 active:scale-98 text-white font-bold text-sm border border-slate-700/80 transition-all cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              <span>Withdraw UGX</span>
            </button>
          </div>
        </div>

        {/* 4 Essential Yield & Investment Stat Badges */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 block mb-1">
              Today's Accrued Yield
            </span>
            <div className="flex items-center gap-1.5 text-base font-extrabold font-mono text-emerald-400">
              <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>+UGX {showBalance ? dailyYield.toLocaleString() : '•••'}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 block mb-1">
              Total Invested
            </span>
            <div className="text-base font-extrabold font-mono text-slate-100">
              UGX {showBalance ? totalInvested.toLocaleString() : '•••'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 block mb-1">
              Total Lifetime Yield
            </span>
            <div className="text-base font-extrabold font-mono text-teal-300">
              UGX {showBalance ? totalEarnings.toLocaleString() : '•••'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 block mb-1">
              Active Vaults
            </span>
            <div className="flex items-center gap-1.5 text-base font-extrabold text-white">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{activeInvestmentsCount} Running</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Welcome Bonus Card (if eligible) */}
      <WelcomeBonusCard
        user={user}
        hasApprovedDeposit={hasApprovedDeposit}
        welcomeBonusClaimed={user?.welcomeBonusClaimed}
        onClaimSuccess={onRefresh}
        onOpenDeposit={onDeposit}
        onOpenWithdraw={onWithdraw}
      />

      {/* 4. Active Investments Overview / Quick Glance */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Flame className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                Active Portfolio & Yield Generation
              </h3>
              <p className="text-xs text-slate-500">
                {activeInvestmentsCount > 0
                  ? `${activeInvestmentsCount} yield contracts actively mining rewards in Uganda`
                  : 'No active yield contracts producing at the moment'}
              </p>
            </div>
          </div>

          <button
            onClick={onOpenPortfolio}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
          >
            <span>View All</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {userInvestments.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-50/70 border border-dashed border-slate-200 text-center">
            <Layers className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <h4 className="text-sm font-bold text-slate-800 mb-1">
              Start Your First VESTRA Yield Vault
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
              Allocate starting from UGX 15,000 to receive daily automated yield credits directly into your UGX wallet.
            </p>
            <button
              onClick={onOpenVaults}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 font-bold text-xs transition-all cursor-pointer"
            >
              Browse Available Vaults
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {userInvestments.slice(0, 2).map((inv) => (
              <div
                key={inv.id}
                className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 flex flex-col justify-between gap-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{inv.machineName}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    Active
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Daily Yield</span>
                    <span className="font-extrabold font-mono text-emerald-600">
                      +UGX {inv.dailyRewardUGX.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Total Mined</span>
                    <span className="font-extrabold font-mono text-slate-900">
                      UGX {(inv.accumulatedRewardUGX || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {onClaimReward && (inv.unclaimedRewardUGX || 0) > 0 && (
                  <button
                    onClick={() => onClaimReward(inv.id)}
                    className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>Claim UGX {(inv.unclaimedRewardUGX || 0).toLocaleString()} Yield</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Featured VESTRA Products Showcase */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Zap className="w-4.5 h-4.5 text-emerald-600" />
              <span>Featured VESTRA Yield Vaults</span>
            </h3>
            <p className="text-xs text-slate-500">
              Institutional-grade automated yields with principal-backed safety.
            </p>
          </div>

          {/* Category Chips */}
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeCategory === cat
                    ? 'bg-slate-900 text-emerald-400 font-bold shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMachines.slice(0, 6).map((machine) => (
            <InvestmentCard
              key={machine.id}
              machine={machine}
              onManage={() => onInvest(machine)}
            />
          ))}
        </div>

        <div className="text-center mt-5">
          <button
            onClick={onOpenVaults}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 hover:border-slate-400 bg-white text-slate-800 font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            <span>Explore All {machines.length} Institutional Vaults</span>
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* 6. Recent Transactions & Activity Stream */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-base font-extrabold text-slate-900">Recent Account Activity</h4>
            <p className="text-xs text-slate-500">Live feed of deposits, withdrawals, and yield distributions</p>
          </div>
          <button
            onClick={onOpenWallet}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
          >
            <span>Open Wallet</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          {recentTransactions.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs font-medium">
              No recent activity recorded yet.
            </div>
          ) : (
            recentTransactions.map((tx) => {
              const isPending = tx.status === 'pending';
              const isApproved = tx.status === 'approved' || tx.status === 'completed';

              return (
                <div
                  key={tx.id}
                  className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        tx.type === 'reward'
                          ? 'bg-emerald-100 text-emerald-700'
                          : tx.type === 'deposit'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {tx.type === 'reward' ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : tx.type === 'deposit' ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">{tx.description}</h5>
                      <span className="text-[10.5px] text-slate-400">{tx.date}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-xs font-extrabold font-mono ${
                        tx.type === 'withdraw' || tx.type === 'investment'
                          ? 'text-slate-800'
                          : 'text-emerald-600'
                      }`}
                    >
                      {tx.type === 'withdraw' || tx.type === 'investment' ? '-' : '+'} UGX{' '}
                      {tx.amountUGX.toLocaleString()}
                    </div>
                    <span
                      className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-sm inline-block mt-0.5 ${
                        isPending
                          ? 'bg-amber-100 text-amber-800'
                          : isApproved
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {tx.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
