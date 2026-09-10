import React, { useState } from 'react';
import {
  Gift,
  Sparkles,
  CheckCircle2,
  Lock,
  ArrowRight,
  ArrowUpRight,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Percent,
  Wallet
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { UserProfile } from '../types';
import { authService } from '../services/supabaseAuth';

interface WelcomeBonusCardProps {
  user: UserProfile | null;
  hasApprovedDeposit: boolean;
  welcomeBonusClaimed?: boolean;
  onClaimSuccess?: () => void | Promise<void>;
  onOpenDeposit?: () => void;
  onOpenWithdraw?: () => void;
  className?: string;
}

export const WelcomeBonusCard: React.FC<WelcomeBonusCardProps> = ({
  user,
  hasApprovedDeposit,
  welcomeBonusClaimed: propClaimed,
  onClaimSuccess,
  onOpenDeposit,
  onOpenWithdraw,
  className = '',
}) => {
  const isClaimed = propClaimed ?? user?.welcomeBonusClaimed ?? false;
  const [isClaiming, setIsClaiming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [justClaimed, setJustClaimed] = useState(false);

  // If user has claimed the welcome bonus
  if (isClaimed || justClaimed) {
    return (
      <div
        className={`bg-gradient-to-r from-emerald-50 via-teal-50/70 to-emerald-50/50 rounded-2xl p-4 border border-emerald-200/80 shadow-2xs flex items-center justify-between gap-3 ${className}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-2xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-[13.5px] font-extrabold text-slate-900 leading-tight">
                Welcome Bonus Unlocked
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/70 text-emerald-800 uppercase tracking-wide">
                Credited
              </span>
            </div>
            <p className="text-[12px] text-slate-600 mt-0.5 leading-snug">
              UGX 5,000 welcome credit is active in your wallet.
            </p>
          </div>
        </div>

        {onOpenWithdraw ? (
          <button
            onClick={onOpenWithdraw}
            className="text-[12px] font-bold text-emerald-800 bg-white hover:bg-emerald-100/60 px-3 py-1.5 rounded-xl border border-emerald-300 shadow-2xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
          >
            <span>Withdraw Bonus</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
          </button>
        ) : (
          <span className="text-[13px] font-black font-mono text-emerald-700 shrink-0 bg-white/80 px-2.5 py-1 rounded-xl border border-emerald-200/60 shadow-2xs">
            +UGX 5,000
          </span>
        )}
      </div>
    );
  }

  // Handler for claiming the welcome bonus to wallet
  const handleClaim = async () => {
    if (isClaiming) return;
    setIsClaiming(true);
    setErrorMessage(null);

    try {
      const res = await authService.claimWelcomeBonus();

      if (res.success) {
        setJustClaimed(true);
        try {
          confetti({
            particleCount: 65,
            spread: 60,
            origin: { y: 0.6 },
          });
        } catch {}

        if (onClaimSuccess) {
          await onClaimSuccess();
        }
      } else {
        setErrorMessage(res.error || 'Failed to claim welcome bonus. Please try again.');
        if (onClaimSuccess) {
          await onClaimSuccess();
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'A network error occurred while claiming.');
    } finally {
      setIsClaiming(false);
    }
  };

  // Welcome bonus is active and ready for withdrawal or investment (No deposit requirement, no locked state)
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E3A8A] via-[#1D4ED8] to-[#1E40AF] p-4.5 text-white shadow-md border border-blue-400/30 ${className}`}
    >
      <div className="absolute -top-8 -right-8 w-28 h-28 bg-amber-400/20 rounded-full blur-xl pointer-events-none" />

      <div className="relative z-10 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-extrabold uppercase tracking-wider bg-amber-400/20 text-amber-300 px-2.5 py-1 rounded-full border border-amber-300/30 flex items-center gap-1.5 backdrop-blur-xs">
            <Gift className="w-3.5 h-3.5 text-amber-300" />
            Welcome Bonus Active
          </span>
          <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-400/30 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            UGX 5,000 Available
          </span>
        </div>

        <div>
          <h3 className="text-[16.5px] font-black tracking-tight text-white flex items-center gap-2">
            <span>UGX 5,000 Welcome Bonus</span>
            <Sparkles className="w-4 h-4 text-amber-300" />
          </h3>
          <p className="text-[12.5px] text-blue-100/90 mt-1 leading-snug">
            Your UGX 5,000 Welcome Bonus is active. You can withdraw directly to your mobile money or use it to invest in machines. (Subject to standard 30% bonus charge on withdrawal: UGX 1,500 fee, UGX 3,500 payout).
          </p>
        </div>

        {errorMessage && (
          <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-100 text-[12px] flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {/* Direct Bonus Withdrawal Action */}
          {onOpenWithdraw && (
            <button
              id="btn-withdraw-welcome-bonus-action"
              onClick={onOpenWithdraw}
              className="py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 active:scale-[0.99] text-white font-extrabold text-[13px] rounded-xl transition-all shadow-md shadow-emerald-900/30 flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4 text-emerald-100" />
              <span>Withdraw UGX 5,000</span>
              <span className="text-[10px] font-black bg-black/20 text-emerald-100 px-1.5 py-0.5 rounded">
                30% CHARGE
              </span>
            </button>
          )}

          {/* Claim to Wallet Balance Action */}
          <button
            id="btn-claim-welcome-bonus"
            onClick={handleClaim}
            disabled={isClaiming}
            className={`py-2.5 px-4 ${onOpenWithdraw ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20' : 'w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black'} font-bold text-[13px] rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75`}
          >
            {isClaiming ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-current" />
                <span>Claiming to Wallet...</span>
              </>
            ) : (
              <>
                <Wallet className="w-4 h-4 text-current" />
                <span>Claim to Wallet</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
