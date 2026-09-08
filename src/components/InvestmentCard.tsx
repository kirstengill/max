import React from 'react';
import { Machine } from '../types';
import { ProjectImage } from './ProjectImage';
import { ArrowUpRight, ShieldCheck, Sparkles, TrendingUp, Zap, Clock } from 'lucide-react';
import { calculateDailyReturnUGX } from '../services/investmentReturns';

interface InvestmentCardProps {
  machine: Machine;
  onManage: (machine: Machine) => void;
  buttonVariant?: 'outline' | 'solid';
}

export const InvestmentCard: React.FC<InvestmentCardProps> = ({
  machine,
  onManage,
  buttonVariant = 'solid',
}) => {
  const dailyReturnUGX = calculateDailyReturnUGX(machine.minInvestUGX);
  const formattedReward = new Intl.NumberFormat('en-US').format(dailyReturnUGX);
  const formattedMinInvest = new Intl.NumberFormat('en-US').format(machine.minInvestUGX);
  const isOutline = buttonVariant === 'outline';

  // Calculate daily percentage return
  const dailyYieldPercent = machine.minInvestUGX > 0
    ? ((dailyReturnUGX / machine.minInvestUGX) * 100).toFixed(1)
    : '10.0';

  return (
    <div className="group rounded-2xl bg-white p-4 shadow-sm hover:shadow-md border border-slate-200/80 transition-all duration-200 flex flex-col justify-between">
      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/60">
            <Zap className="w-3 h-3 text-emerald-600" />
            {machine.category}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
            <TrendingUp className="w-3 h-3 text-emerald-600" />
            +{dailyYieldPercent}% / day
          </span>
        </div>

        {/* Large Product Imagery with Ambient Backdrop */}
        <div className="relative w-full h-44 rounded-xl overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100 border border-slate-100 mb-3.5 flex items-center justify-center p-2 group-hover:border-emerald-500/20 transition-all">
          <ProjectImage
            src={machine.image}
            alt={machine.title}
            fallbackCategory={machine.category}
            className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
          />
          {/* Subtle Live Badge Overlay */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1 text-[10px] font-semibold bg-slate-900/80 backdrop-blur-xs text-white px-2 py-0.5 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Active Vault</span>
          </div>
          {machine.durationDays && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] font-semibold bg-white/90 backdrop-blur-xs text-slate-700 px-2 py-0.5 rounded-md shadow-2xs border border-slate-200">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>{machine.durationDays} Days</span>
            </div>
          )}
        </div>

        {/* Title & Description */}
        <div className="mb-3">
          <h3 className="text-[16px] font-extrabold text-slate-900 leading-snug tracking-tight group-hover:text-emerald-700 transition-colors">
            {machine.title}
          </h3>
          <p className="text-[12px] font-medium text-slate-500 line-clamp-1 mt-0.5">
            {machine.subtitle || machine.description}
          </p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50/80 border border-slate-200/60 mb-3.5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
              Daily Yield
            </span>
            <span className="text-[13.5px] font-extrabold font-mono text-emerald-600">
              UGX {formattedReward}
            </span>
          </div>
          <div className="text-right border-l border-slate-200/80 pl-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
              Min. Allocation
            </span>
            <span className="text-[13.5px] font-extrabold font-mono text-slate-900">
              UGX {formattedMinInvest}
            </span>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div>
        {isOutline ? (
          <button
            id={`btn-manage-${machine.id}`}
            onClick={() => onManage(machine)}
            className="w-full py-2.5 px-4 rounded-xl border-2 border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white active:scale-98 font-bold text-[13px] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <span>Manage Vault</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            id={`btn-manage-${machine.id}`}
            onClick={() => onManage(machine)}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 hover:from-emerald-700 hover:to-teal-700 active:scale-98 text-white font-bold text-[13px] transition-all flex items-center justify-center gap-1.5 shadow-md shadow-slate-900/10 cursor-pointer"
          >
            <span>Allocate Capital</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </button>
        )}
      </div>
    </div>
  );
};
