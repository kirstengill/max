import React from 'react';
import { Machine } from '../types';
import { InvestmentCard } from './InvestmentCard';
import { Zap, Activity, Cpu, ArrowUpRight, Plus, Sparkles, Layers, Clock, CheckCircle, TrendingUp, Coins, ShieldCheck } from 'lucide-react';
import { calculateDailyReturnUGX } from '../services/investmentReturns';

interface InvestmentsViewProps {
  machines: Machine[];
  onManageMachine: (m: Machine) => void;
  onBrowseAvailable?: () => void;
  onClaimAllRewards?: () => void;
}

export const InvestmentsView: React.FC<InvestmentsViewProps> = ({
  machines,
  onManageMachine,
  onBrowseAvailable,
  onClaimAllRewards,
}) => {
  // Only show active / owned machines
  const activeMachines = machines.filter(
    (m) => m.status === 'Active' || m.status === 'Maintenance'
  );
  const totalDailyUGX = activeMachines.reduce((sum, m) => sum + calculateDailyReturnUGX(m.minInvestUGX), 0);
  const totalInvestedUGX = activeMachines.reduce((sum, m) => sum + m.minInvestUGX, 0);
  const totalUnclaimedUGX = activeMachines.reduce((sum, m) => sum + (m.unclaimedRewardsUGX || 0), 0);

  return (
    <div className="px-4 sm:px-6 py-4 space-y-5 pb-12 max-w-5xl mx-auto">
      {/* Portfolio Overview Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#080D18] via-[#0E1728] to-[#0A111F] p-6 text-white shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Active Yield Portfolio
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Regulated Institutional Infrastructure</span>
          </span>
        </div>

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4 my-2">
          <div>
            <span className="text-xs text-slate-400 font-medium block mb-1">
              Combined Daily Yield Generation
            </span>
            <div className="text-3xl font-black font-mono text-emerald-400 flex items-baseline gap-2">
              <span>+UGX {totalDailyUGX.toLocaleString()}</span>
              <span className="text-xs font-normal text-slate-400 font-sans">/ 24h</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Total Capital Allocated:{' '}
              <strong className="text-slate-100 font-mono">
                UGX {totalInvestedUGX.toLocaleString()}
              </strong>
            </p>
          </div>

          {/* Unclaimed Rewards Action */}
          {totalUnclaimedUGX > 0 && onClaimAllRewards && (
            <div className="self-end sm:text-right bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">Unclaimed Accrued Yield</span>
              <div className="text-xl font-black font-mono text-cyan-400 mb-2">
                UGX {totalUnclaimedUGX.toLocaleString()}
              </div>
              <button
                onClick={onClaimAllRewards}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
              >
                <Coins className="w-4 h-4" />
                <span>Claim All Accrued Yields</span>
              </button>
            </div>
          )}
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-slate-800 text-center">
          <div className="bg-slate-900/60 rounded-xl p-2.5 border border-slate-800/80">
            <span className="text-[10.5px] text-slate-400 block font-medium">Active Contracts</span>
            <span className="text-sm font-black text-white font-mono">{activeMachines.length} Vaults</span>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-2.5 border border-slate-800/80">
            <span className="text-[10.5px] text-slate-400 block font-medium">Algorithmic Efficiency</span>
            <span className="text-sm font-black text-cyan-400 font-mono">99.8%</span>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-2.5 border border-slate-800/80">
            <span className="text-[10.5px] text-slate-400 block font-medium">Network Uptime</span>
            <span className="text-sm font-black text-emerald-400 font-mono">99.98%</span>
          </div>
        </div>
      </div>

      {/* Active Vaults List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-black text-slate-900">
              Active Yield Vaults ({activeMachines.length})
            </h3>
            <p className="text-xs text-slate-500">
              Your deployed institutional contracts producing automated daily returns
            </p>
          </div>
          {onBrowseAvailable && (
            <button
              onClick={onBrowseAvailable}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 cursor-pointer bg-emerald-50 hover:bg-emerald-100/70 px-3 py-1.5 rounded-xl border border-emerald-200 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Deploy New Vault</span>
            </button>
          )}
        </div>

        {activeMachines.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center space-y-3 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto border border-slate-200">
              <Layers className="w-7 h-7 text-emerald-600" />
            </div>
            <div>
              <h4 className="text-base font-extrabold text-slate-900">
                No Active Yield Contracts Yet
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                You currently have no active VESTRA vault allocations. Select an opportunity from our catalog to start earning automated daily yields in UGX.
              </p>
            </div>
            {onBrowseAvailable && (
              <button
                onClick={onBrowseAvailable}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-emerald-400 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Explore VESTRA Yield Vaults</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeMachines.map((mach) => (
              <InvestmentCard
                key={mach.id}
                machine={mach}
                onManage={onManageMachine}
                buttonVariant="outline"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
