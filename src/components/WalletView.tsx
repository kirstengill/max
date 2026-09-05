import React, { useState } from 'react';
import { Transaction, WalletState, UserProfile } from '../types';
import {
  ArrowDownLeft,
  ArrowUpRight,
  History,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Wallet,
  TrendingUp,
  Gift,
  Share2,
  AlertCircle,
  FileText,
  Search,
  Filter,
} from 'lucide-react';
import { WelcomeBonusCard } from './WelcomeBonusCard';

interface WalletViewProps {
  wallet: WalletState;
  transactions: Transaction[];
  user?: UserProfile | null;
  onRefresh?: () => Promise<void> | void;
  onOpenDeposit: () => void;
  onOpenWithdraw: () => void;
  onOpenWithdrawWelcomeBonus?: () => void;
}

export const WalletView: React.FC<WalletViewProps> = ({
  wallet,
  transactions,
  user = null,
  onRefresh,
  onOpenDeposit,
  onOpenWithdraw,
  onOpenWithdrawWelcomeBonus,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Available balance
  const availableBalanceUGX = wallet.totalBalanceUGX || 0;

  // 2. Total invested
  const totalInvestedUGX = transactions
    .filter((t) => t.type === 'investment' && t.status !== 'rejected')
    .reduce((sum, t) => sum + (t.amountUGX || 0), 0);

  // 3. Total rewards
  const totalRewardsUGX = transactions
    .filter((t) => t.type === 'reward' && (t.status === 'completed' || t.status === 'approved'))
    .reduce((sum, t) => sum + (t.amountUGX || 0), 0);

  // 4. Referral earnings
  const referralEarningsUGX = user?.referralEarningsUGX || 0;

  // 5. Pending deposits
  const pendingDepositsUGX = transactions
    .filter((t) => t.type === 'deposit' && t.status === 'pending')
    .reduce((sum, t) => sum + (t.amountUGX || 0), 0);

  // 6. Pending withdrawals
  const pendingWithdrawalsUGX = transactions
    .filter((t) => t.type === 'withdraw' && t.status === 'pending')
    .reduce((sum, t) => sum + (t.amountUGX || 0), 0);

  const pendingCount = transactions.filter((t) => t.status === 'pending').length;
  const hasApprovedDeposit = transactions.some(
    (t) => t.type === 'deposit' && (t.status === 'completed' || t.status === 'approved')
  );

  const filteredTx = transactions
    .filter((t) => {
      if (filterType === 'all') return true;
      if (filterType === 'pending') return t.status === 'pending';
      return t.type === filterType;
    })
    .filter((t) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.description.toLowerCase().includes(q) ||
        (t.paymentMethod && t.paymentMethod.toLowerCase().includes(q)) ||
        (t.recipientInfo && t.recipientInfo.toLowerCase().includes(q)) ||
        t.amountUGX.toString().includes(q)
      );
    });

  return (
    <div className="px-5 py-3 space-y-4 pb-8">
      {/* VESTRA Sovereign Asset Wallet Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#090E17] via-[#0E1726] to-[#0A111F] p-5 text-white shadow-xl border border-slate-800">
        <div className="absolute -top-10 -right-10 w-44 h-44 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Top bar in card */}
        <div className="relative z-10 flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              VESTRA Treasury Vault
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>UGX Sovereign Custody</span>
          </div>
        </div>

        {/* Main Available Balance */}
        <div className="relative z-10 mb-4">
          <span className="text-[11.5px] text-slate-400 font-medium block mb-1">
            Total Available Balance
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold text-emerald-400 font-sans">UGX</span>
            <span className="text-[28px] sm:text-[34px] font-black font-mono tracking-tight text-white leading-none">
              {availableBalanceUGX.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="relative z-10 grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-800/80">
          <button
            onClick={onOpenDeposit}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white font-bold text-[13.5px] py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4" />
            Deposit UGX
          </button>
          <button
            onClick={onOpenWithdraw}
            className="bg-slate-800/90 hover:bg-slate-700 active:scale-98 text-white border border-slate-700/80 font-bold text-[13.5px] py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            Withdraw UGX
          </button>
        </div>
      </div>

      {/* Complete Financial Overview Matrix (All 6 metrics clearly represented) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {/* Metric 1: Total Invested */}
        <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Total Invested</span>
            <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-[15px] font-extrabold font-mono text-slate-900 leading-tight">
            UGX {totalInvestedUGX.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">
            Active asset vaults
          </span>
        </div>

        {/* Metric 2: Total Rewards */}
        <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Total Rewards</span>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-[15px] font-extrabold font-mono text-emerald-600 leading-tight">
            UGX {totalRewardsUGX.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">
            Accrued vault yields
          </span>
        </div>

        {/* Metric 3: Referral Earnings */}
        <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Referral Earnings</span>
            <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Share2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-[15px] font-extrabold font-mono text-purple-700 leading-tight">
            UGX {referralEarningsUGX.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">
            20% partner bonuses
          </span>
        </div>

        {/* Metric 4: Pending Deposits */}
        <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Pending Deposits</span>
            <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-[15px] font-extrabold font-mono text-amber-600 leading-tight">
            UGX {pendingDepositsUGX.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">
            Awaiting admin review
          </span>
        </div>

        {/* Metric 5: Pending Withdrawals */}
        <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Pending Withdrawals</span>
            <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-[15px] font-extrabold font-mono text-rose-600 leading-tight">
            UGX {pendingWithdrawalsUGX.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">
            In transfer queue
          </span>
        </div>

        {/* Metric 6: Available Liquid */}
        <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Available Liquid</span>
            <div className="w-6 h-6 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-[15px] font-extrabold font-mono text-slate-900 leading-tight">
            UGX {availableBalanceUGX.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">
            100% withdrawable
          </span>
        </div>
      </div>

      {/* Welcome Bonus Card Integration */}
      <WelcomeBonusCard
        user={user}
        hasApprovedDeposit={hasApprovedDeposit}
        welcomeBonusClaimed={user?.welcomeBonusClaimed}
        onClaimSuccess={onRefresh}
        onOpenDeposit={onOpenDeposit}
        onOpenWithdraw={onOpenWithdrawWelcomeBonus || onOpenWithdraw}
      />

      {/* Transaction History & Approvals Ledger */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col gap-2.5 mb-3.5">
          <div className="flex items-center justify-between">
            <h4 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>Activity & Settlement Ledger</span>
            </h4>
            {pendingCount > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                {pendingCount} Pending
              </span>
            )}
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by description, method, or amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500 bg-slate-50/50"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: 'All Activities' },
              { id: 'pending', label: `Pending (${pendingCount})` },
              { id: 'deposit', label: 'Deposits' },
              { id: 'withdraw', label: 'Withdrawals' },
              { id: 'investment', label: 'Vault Allocations' },
              { id: 'reward', label: 'Yield Payouts' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  filterType === tab.id
                    ? 'bg-slate-900 text-emerald-400 font-bold shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions List */}
        <div className="space-y-2">
          {filteredTx.length === 0 ? (
            <div className="rounded-xl p-8 border border-dashed border-slate-200 text-center text-slate-400">
              <History className="w-7 h-7 mx-auto mb-2 opacity-40 text-slate-400" />
              <p className="text-[13px] font-medium text-slate-500">No records found matching criteria.</p>
              <span className="text-[11px] text-slate-400">Submit a deposit or allocate into a vault to start activity.</span>
            </div>
          ) : (
            filteredTx.map((tx) => {
              const isPending = tx.status === 'pending';
              const isApproved = tx.status === 'approved' || tx.status === 'completed';
              const isRejected = tx.status === 'rejected';

              return (
                <div
                  key={tx.id}
                  className={`rounded-xl p-3.5 border transition-all ${
                    isPending
                      ? 'border-amber-200 bg-amber-50/30 shadow-2xs'
                      : isRejected
                      ? 'border-rose-200 bg-rose-50/20 opacity-80'
                      : 'border-slate-100 bg-slate-50/40 hover:bg-slate-50'
                  } flex flex-col sm:flex-row sm:items-center justify-between gap-2`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        tx.type === 'reward'
                          ? 'bg-emerald-100 text-emerald-700'
                          : tx.type === 'deposit'
                          ? 'bg-blue-100 text-blue-700'
                          : tx.type === 'investment'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {tx.type === 'reward' ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : tx.type === 'deposit' ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : tx.type === 'investment' ? (
                        <Wallet className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <h5 className="text-[13px] font-bold text-slate-900 leading-tight">
                        {tx.description}
                      </h5>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px] text-slate-400">
                        <span>{tx.date}</span>
                        {tx.paymentMethod && <span>• {tx.paymentMethod}</span>}
                        {tx.recipientInfo && <span>• {tx.recipientInfo}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0 gap-1 pl-12 sm:pl-0">
                    <span
                      className={`text-[13.5px] font-mono font-bold ${
                        tx.type === 'withdraw' || tx.type === 'investment'
                          ? 'text-slate-800'
                          : 'text-emerald-600'
                      }`}
                    >
                      {tx.type === 'withdraw' || tx.type === 'investment' ? '-' : '+'} UGX{' '}
                      {tx.amountUGX.toLocaleString()}
                    </span>

                    {/* Status Badge */}
                    {isPending && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md border border-amber-200">
                        <Clock className="w-2.5 h-2.5 text-amber-700" />
                        Pending Admin Review
                      </span>
                    )}

                    {isApproved && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md border border-emerald-200">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                        {tx.status === 'approved' ? 'Approved' : 'Settled'}
                      </span>
                    )}

                    {isRejected && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md border border-rose-200">
                        <XCircle className="w-2.5 h-2.5 text-rose-600" />
                        Rejected
                      </span>
                    )}
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
