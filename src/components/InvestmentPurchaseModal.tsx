import React, { useRef, useState } from 'react';
import { X, Check, AlertCircle, ArrowUpRight, ShieldCheck, Zap, Wallet, Sparkles, Clock, Calculator } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Machine } from '../types';
import { ProjectImage } from './ProjectImage';
import { calculateDailyReturnUGX } from '../services/investmentReturns';
import { getPreciousMetalCategoryLabel } from '../constants/preciousMetalImages';

interface InvestmentPurchaseModalProps {
  machine: Machine | null;
  userBalanceUGX: number;
  onClose: () => void;
  onConfirmInvest: (machine: Machine, amountUGX: number) => Promise<boolean>;
  onOpenDeposit: () => void;
}

export const InvestmentPurchaseModal: React.FC<InvestmentPurchaseModalProps> = ({
  machine,
  userBalanceUGX,
  onClose,
  onConfirmInvest,
  onOpenDeposit,
}) => {
  if (!machine) return null;

  const productMin = machine.minimum_investment_amount ?? machine.minInvestUGX;
  const [amountUGX, setAmountUGX] = useState<number>(productMin);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const durationDays = machine.durationDays || 30;
  const isBelowMinimum = amountUGX < productMin;
  const isInsufficient = userBalanceUGX < amountUGX;
  const estDailyYield = calculateDailyReturnUGX(amountUGX);
  const estTermYield = estDailyYield * durationDays;
  const totalReturn = amountUGX + estTermYield;

  const presets = [
    { label: `UGX ${productMin.toLocaleString()}`, value: productMin },
    { label: `UGX ${(productMin * 2).toLocaleString()}`, value: productMin * 2 },
    { label: `UGX ${(productMin * 3).toLocaleString()}`, value: productMin * 3 },
    { label: `UGX ${(productMin * 5).toLocaleString()}`, value: productMin * 5 },
  ];

  const handleInvest = async () => {
    if (isBelowMinimum) {
      setErrorMessage(`Minimum investment for this product is UGX ${productMin.toLocaleString()}.`);
      return;
    }
    if (isInsufficient) {
      setErrorMessage(`Insufficient balance: available UGX ${userBalanceUGX.toLocaleString()}, required UGX ${amountUGX.toLocaleString()}.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const success = await onConfirmInvest(machine, amountUGX);
      if (success) {
        confetti({ particleCount: 75, spread: 60, origin: { y: 0.6 } });
        onClose();
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to complete vault allocation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-extrabold tracking-widest text-emerald-700 uppercase font-sans">
                VESTRA VAULT ALLOCATION
              </span>
            </div>
            <h3 className="text-[16px] font-black text-slate-900 leading-tight">
              {machine.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Machine Header */}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 flex items-center gap-3">
            <div className="w-16 h-16 bg-white rounded-xl p-1 border border-slate-200 shrink-0 flex items-center justify-center overflow-hidden">
              <ProjectImage
                src={machine.image}
                alt={machine.title}
                fallbackCategory={machine.category}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                {getPreciousMetalCategoryLabel(machine.category)}
              </span>
              <p className="text-[13px] font-bold text-slate-900 mt-1 truncate">
                {machine.subtitle || machine.description}
              </p>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>Term: {durationDays} Days</span>
              </div>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[12.5px] font-bold text-slate-800">
                Allocation Amount (UGX)
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                Min: UGX {productMin.toLocaleString()}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-emerald-600 text-xs">
                UGX
              </span>
              <input
                type="number"
                value={amountUGX || ''}
                ref={amountInputRef}
                min={productMin}
                step={5000}
                onChange={(e) => setAmountUGX(Number(e.target.value))}
                className="w-full pl-14 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:bg-white transition-all"
              />
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setAmountUGX(preset.value)}
                  className={`py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                    amountUGX === preset.value
                      ? 'bg-slate-900 text-emerald-400 border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => amountInputRef.current?.focus()}
                className={`py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                  !presets.some((preset) => preset.value === amountUGX)
                    ? 'bg-slate-900 text-emerald-400 border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Custom Amount
              </button>
            </div>
          </div>

          {/* Wallet Balance Status */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <Wallet className="w-4 h-4 text-emerald-600" />
              <span>Available Wallet Balance:</span>
            </div>
            <span className={`font-mono font-bold ${isInsufficient ? 'text-rose-600' : 'text-slate-900'}`}>
              UGX {userBalanceUGX.toLocaleString()}
            </span>
          </div>

          {/* Projected Yield Breakdown */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-4 text-white space-y-2 text-xs border border-slate-800">
            <div className="flex items-center justify-between text-slate-300 pb-2 border-b border-slate-700/60 font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Calculator className="w-3.5 h-3.5" />
                Projected Vault Returns
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Daily Auto-Credit</span>
            </div>

            <div className="flex justify-between items-center text-slate-300 pt-1">
              <span>Expected Daily Yield:</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                + UGX {estDailyYield.toLocaleString()} / day
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span>Estimated Term Return ({durationDays}d):</span>
              <span className="font-mono font-bold text-cyan-400">
                + UGX {estTermYield.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-200 pt-1.5 border-t border-slate-700/60 font-bold">
              <span>Total Payout (Principal + Yield):</span>
              <span className="font-mono font-black text-white text-sm">
                UGX {totalReturn.toLocaleString()}
              </span>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            {isInsufficient ? (
              <div className="space-y-2">
                <button
                  onClick={() => {
                    onClose();
                    onOpenDeposit();
                  }}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Wallet className="w-4 h-4" />
                  <span>Top Up Balance to Allocate (Deposit UGX)</span>
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={handleInvest}
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/20"
              >
                <Check className="w-4 h-4" />
                {isSubmitting
                  ? 'Deploying VESTRA Allocation...'
                  : `Confirm Allocation (UGX ${amountUGX.toLocaleString()})`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
