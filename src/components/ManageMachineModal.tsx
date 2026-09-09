import React, { useState, useEffect } from 'react';
import { X, Zap, Cpu, Activity, Thermometer, ShieldCheck, ArrowUpRight, CheckCircle2, RotateCw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Machine } from '../types';
import { ProjectImage } from './ProjectImage';
import { calculateDailyReturnUGX } from '../services/investmentReturns';

interface ManageMachineModalProps {
  machine: Machine | null;
  onClose: () => void;
  onClaimReward: (machineId: string, amountUGX: number) => void;
  onToggleBoost: (machineId: string) => void;
  onToggleStatus: (machineId: string) => void;
}

export const ManageMachineModal: React.FC<ManageMachineModalProps> = ({
  machine,
  onClose,
  onClaimReward,
  onToggleBoost,
  onToggleStatus,
}) => {
  if (!machine) return null;

  const [liveReward, setLiveReward] = useState(machine.unclaimedRewardsUGX);
  const [isClaiming, setIsClaiming] = useState(false);

  // Simulate real-time micro rewards streaming
  useEffect(() => {
    if (machine.status !== 'Active') return;
    const interval = setInterval(() => {
      setLiveReward((prev) => prev + Math.floor(Math.random() * 45 + 15));
    }, 1500);
    return () => clearInterval(interval);
  }, [machine.status]);

  const handleClaim = () => {
    if (liveReward <= 0) return;
    setIsClaiming(true);
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 },
    });
    setTimeout(() => {
      onClaimReward(machine.id, liveReward);
      setLiveReward(0);
      setIsClaiming(false);
    }, 600);
  };

  const minInvest = machine.minimum_investment_amount ?? machine.minInvestUGX ?? 0;
  const dailyReward = (machine.dailyRewardUGX && machine.dailyRewardUGX > 0)
    ? machine.dailyRewardUGX
    : calculateDailyReturnUGX(minInvest);
  const formattedReward = new Intl.NumberFormat('en-US').format(dailyReward);
  const formattedUnclaimed = new Intl.NumberFormat('en-US').format(liveReward);
  const formattedTotalMined = new Intl.NumberFormat('en-US').format(machine.totalMinedUGX);
  const formattedMinInvest = new Intl.NumberFormat('en-US').format(minInvest);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10">
          <div>
            <span className="text-[11px] font-semibold tracking-wider text-blue-600 uppercase">
              Hardware Console
            </span>
            <h3 className="text-[17px] font-extrabold text-[#0F172A] leading-tight">
              {machine.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Hardware visual banner */}
          <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 rounded-2xl p-4 border border-slate-100 flex items-center gap-4">
            <div className="w-24 h-24 bg-white rounded-xl p-1.5 border border-slate-200/80 shadow-xs shrink-0 flex items-center justify-center overflow-hidden">
              <ProjectImage
                src={machine.image}
                alt={machine.title}
                fallbackCategory={machine.category}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  {machine.status}
                </span>
                {machine.isBoosted && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                    <Zap className="w-3 h-3 fill-amber-500 text-amber-500" />
                    Overclocked
                  </span>
                )}
              </div>
              <p className="text-[13px] font-bold text-slate-800 mt-1 truncate">
                {machine.category} Node
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Power: {machine.powerSource}
              </p>
            </div>
          </div>

          {/* Unclaimed Yield Box */}
          <div className="bg-[#0F172A] rounded-2xl p-4 text-white">
            <div className="flex items-center justify-between text-slate-300 text-[12px] mb-1">
              <span>Accumulated Mining Yield</span>
              <span className="flex items-center gap-1 text-emerald-400 text-[11px]">
                <RotateCw className="w-3 h-3 animate-spin" /> Live Ticking
              </span>
            </div>
            <div className="text-[22px] font-extrabold font-mono text-white mb-3">
              UGX {formattedUnclaimed}
            </div>
            <button
              onClick={handleClaim}
              disabled={isClaiming || liveReward <= 0}
              className="w-full bg-[#1657D9] hover:bg-blue-600 active:scale-98 disabled:opacity-50 text-white font-semibold text-[13px] py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4" />
              {isClaiming ? 'Harvesting...' : 'Claim to Consolidated Wallet'}
            </button>
          </div>

          {/* Telemetry Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-medium">
                <Cpu className="w-3.5 h-3.5 text-blue-600" /> Real-time Hashrate
              </div>
              <div className="text-[15px] font-bold text-slate-900 mt-1">
                {machine.hashrate}
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-medium">
                <Activity className="w-3.5 h-3.5 text-emerald-600" /> Uptime
              </div>
              <div className="text-[15px] font-bold text-slate-900 mt-1">
                {machine.uptime}
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-medium">
                <Thermometer className="w-3.5 h-3.5 text-orange-500" /> Operating Temp
              </div>
              <div className="text-[15px] font-bold text-slate-900 mt-1">
                {machine.temperature}
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" /> Est. ROI / Year
              </div>
              <div className="text-[15px] font-bold text-[#16A34A] mt-1">
                {machine.estYearlyROI}%
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <div className="flex items-center justify-between p-3 bg-slate-50/70 rounded-xl">
              <div>
                <span className="text-[13px] font-bold text-slate-900 block">
                  Turbo Boost Mode (+15% Hash)
                </span>
                <span className="text-[11px] text-slate-500">
                  Dynamic frequency scaling algorithm
                </span>
              </div>
              <button
                onClick={() => onToggleBoost(machine.id)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  machine.isBoosted ? 'bg-[#1657D9]' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                    machine.isBoosted ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50/70 rounded-xl">
              <div>
                <span className="text-[13px] font-bold text-slate-900 block">
                  Mining Rig Power State
                </span>
                <span className="text-[11px] text-slate-500">
                  Currently {machine.status}
                </span>
              </div>
              <button
                onClick={() => onToggleStatus(machine.id)}
                className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-[12px] font-semibold text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                {machine.status === 'Active' ? 'Pause Unit' : 'Resume Unit'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
