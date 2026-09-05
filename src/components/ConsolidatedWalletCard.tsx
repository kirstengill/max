import React from 'react';
import { ArrowDownLeft, ArrowUpRight, ShieldCheck, Sparkles, TrendingUp, Wallet } from 'lucide-react';

interface ConsolidatedWalletCardProps {
  balanceUGX: number;
  dailyYieldUGX?: number;
  totalInvestedUGX?: number;
  pendingApprovalsCount?: number;
  onDeposit: () => void;
  onWithdraw: () => void;
}

export const ConsolidatedWalletCard: React.FC<ConsolidatedWalletCardProps> = ({
  balanceUGX,
  dailyYieldUGX = 0,
  totalInvestedUGX = 0,
  pendingApprovalsCount = 0,
  onDeposit,
  onWithdraw,
}) => {
  const formattedBalance = new Intl.NumberFormat('en-US').format(balanceUGX);
  const formattedDailyYield = new Intl.NumberFormat('en-US').format(dailyYieldUGX);
  const formattedInvested = new Intl.NumberFormat('en-US').format(totalInvestedUGX);

  return (
    <section className="px-5 mt-2 mb-4">
      {/* VESTRA Institutional Yield & Balance Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#090E17] via-[#0D1626] to-[#0A1220] p-5 text-white shadow-xl shadow-slate-900/10 border border-slate-800/80">
        {/* Subtle Ambient Radial Glows */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header Row */}
        <div className="relative z-10 flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Sovereign Ledger
            </span>
            {pendingApprovalsCount > 0 && (
              <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-full">
                {pendingApprovalsCount} In Review
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>256-Bit Vault</span>
          </div>
        </div>

        {/* Big Balance Amount */}
        <div className="relative z-10 mb-4">
          <span className="text-xs text-slate-400 font-medium block mb-1">
            Consolidated Available Balance
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold text-emerald-400 tracking-wider">UGX</span>
            <span className="text-[28px] sm:text-[32px] font-black font-mono tracking-tight text-white leading-none">
              {formattedBalance}
            </span>
          </div>
        </div>

        {/* Financial Metrics Strip */}
        <div className="relative z-10 grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 mb-4 backdrop-blur-xs">
          <div>
            <span className="text-[10.5px] font-medium text-slate-400 block mb-0.5">
              Today's Accrued Yield
            </span>
            <div className="flex items-center gap-1 text-[13px] font-extrabold text-emerald-400 font-mono">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>+UGX {formattedDailyYield}</span>
            </div>
          </div>
          <div className="border-l border-slate-800/80 pl-3">
            <span className="text-[10.5px] font-medium text-slate-400 block mb-0.5">
              Active Allocations
            </span>
            <div className="flex items-center gap-1 text-[13px] font-extrabold text-slate-200 font-mono">
              <Wallet className="w-3.5 h-3.5 text-slate-400" />
              <span>UGX {formattedInvested}</span>
            </div>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="relative z-10 grid grid-cols-2 gap-2.5">
          <button
            id="btn-deposit-main"
            onClick={onDeposit}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white font-bold text-[13.5px] py-2.5 px-3 rounded-xl shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4 text-white" />
            <span>Deposit UGX</span>
          </button>
          <button
            id="btn-withdraw-main"
            onClick={onWithdraw}
            className="flex items-center justify-center gap-2 bg-slate-800/90 hover:bg-slate-700/90 active:scale-98 text-slate-100 border border-slate-700/90 font-bold text-[13.5px] py-2.5 px-3 rounded-xl transition-all cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            <span>Withdraw UGX</span>
          </button>
        </div>
      </div>
    </section>
  );
};
