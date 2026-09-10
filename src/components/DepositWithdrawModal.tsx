import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Copy,
  Check,
  Smartphone,
  CreditCard,
  ShieldAlert,
  UserCheck,
  PhoneCall,
  CheckCircle2,
  Send,
  ExternalLink,
  Gift,
  Sparkles,
  ShieldCheck,
  Percent
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { TELEGRAM_HELP_URL } from '../constants/links';
import { authService } from '../services/supabaseAuth';

// Withdrawal & Deposit rules
const MIN_DEPOSIT_UGX = 20000;
const WITHDRAWAL_FEE_RATE = 0.20; // 20% normal withdrawal fee
const BONUS_WITHDRAWAL_FEE_RATE = 0.30; // 30% bonus-withdrawal protection charge

// Helper to calculate maximum withdrawal amount for a given balance
export const calculateMaxWithdrawal = (balance: number): number => {
  return Math.max(0, balance);
};

// Deposit receiving line details
const DEPOSIT_PHONE = '0763445008';
const RECIPIENT_NAME = 'HUZAIRU SSALI';

interface DepositWithdrawModalProps {
  mode: 'deposit' | 'withdraw';
  onClose: () => void;
  balanceUGX: number;
  withdrawableBalanceUGX?: number;
  initialIsWelcomeBonus?: boolean;
  hasApprovedDeposit?: boolean;
  welcomeBonusClaimed?: boolean;
  onSwitchMode?: (mode: 'deposit' | 'withdraw') => void;
  onSuccess: (
    amountUGX: number,
    type: 'deposit' | 'withdraw',
    description: string,
    paymentMethod?: string,
    recipientInfo?: string,
    isBonusWithdrawal?: boolean
  ) => Promise<{ success: boolean; error?: string } | void> | void;
}

export const DepositWithdrawModal: React.FC<DepositWithdrawModalProps> = ({
  mode,
  onClose,
  balanceUGX,
  withdrawableBalanceUGX,
  initialIsWelcomeBonus = false,
  hasApprovedDeposit = false,
  welcomeBonusClaimed = false,
  onSwitchMode,
  onSuccess,
}) => {
  const currentUser = authService.getCurrentUser();
  const [activeTab, setActiveTab] = useState<'mtn' | 'airtel' | 'bank'>('mtn');
  const [isWelcomeBonus, setIsWelcomeBonus] = useState<boolean>(initialIsWelcomeBonus);
  const [minimumWithdrawalUGX, setMinimumWithdrawalUGX] = useState(0);

  const availableWithdrawableUGX =
    withdrawableBalanceUGX !== undefined ? withdrawableBalanceUGX : balanceUGX;

  const [amountUGXStr, setAmountUGXStr] = useState<string>(() => {
    if (initialIsWelcomeBonus) {
      return '5000';
    }
    if (mode === 'withdraw') {
      const maxPossible = calculateMaxWithdrawal(balanceUGX);
      if (maxPossible > 0) {
        return Math.min(maxPossible, 50000).toString();
      }
      return '';
    }
    return MIN_DEPOSIT_UGX.toString();
  });

  useEffect(() => {
    let active = true;
    if (mode !== 'withdraw') return () => { active = false; };
    authService.fetchPlatformSettings().then((res) => {
      if (!active || !res.settings) return;
      const minimum = res.settings.minimum_withdrawal_amount;
      setMinimumWithdrawalUGX(minimum);
      setAmountUGXStr((current) => current || minimum.toString());
    });
    return () => { active = false; };
  }, [mode]);

  const [depositorPhone, setDepositorPhone] = useState<string>(() => currentUser?.phone || '');
  const [recipient, setRecipient] = useState<string>(() =>
    currentUser?.phone
      ? `${currentUser.phone} (${currentUser.username || 'Wallet'})`
      : '0772 123 456 (MTN MoMo)'
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{
    amount: number;
    fee: number;
    totalDeduction: number;
    netAmount: number;
    channel: string;
    recipient: string;
    isWelcomeBonus?: boolean;
  } | null>(null);

  // If user switches welcome bonus toggle
  const handleToggleWelcomeBonus = (enable: boolean) => {
    setIsWelcomeBonus(enable);
    if (enable) {
      setAmountUGXStr('5000');
    }
  };

  const numUGX = parseFloat(amountUGXStr) || 0;

  // Effective balance includes the 5,000 welcome bonus if not yet credited into balance
  const effectiveAvailableBalance =
    mode === 'withdraw' && isWelcomeBonus && !welcomeBonusClaimed && hasApprovedDeposit
      ? balanceUGX + 5000
      : balanceUGX;

  // Fee calculation:
  // When isWelcomeBonus is true, 30% bonus protection charge applies.
  // Otherwise standard 20% withdrawal fee applies.
  const feeRate = isWelcomeBonus ? BONUS_WITHDRAWAL_FEE_RATE : WITHDRAWAL_FEE_RATE;
  const requestedWithdrawalUGX = mode === 'withdraw' ? numUGX : 0;
  const withdrawalFeeUGX =
    mode === 'withdraw'
      ? Math.round(requestedWithdrawalUGX * feeRate)
      : 0;
  const youReceiveUGX =
    mode === 'withdraw'
      ? Math.max(0, requestedWithdrawalUGX - withdrawalFeeUGX)
      : numUGX;
  const totalDeductionUGX = requestedWithdrawalUGX;

  const depositUssd =
    activeTab === 'airtel'
      ? `*185*1*1*${DEPOSIT_PHONE}*${numUGX || 'AMOUNT'}#`
      : `*165*1*1*${DEPOSIT_PHONE}*${numUGX || 'AMOUNT'}#`;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAction = async () => {
    setErrorMessage('');
    if (numUGX <= 0) {
      setErrorMessage('Please enter a valid amount in UGX.');
      return;
    }

    if (mode === 'deposit') {
      if (numUGX < MIN_DEPOSIT_UGX) {
        setErrorMessage(
          `Minimum Deposit: The minimum deposit amount is UGX ${MIN_DEPOSIT_UGX.toLocaleString()}.`
        );
        return;
      }
      const cleanPhone = depositorPhone.trim().replace(/\s+/g, '');
      if (!cleanPhone || cleanPhone.length < 9) {
        setErrorMessage('Please enter the phone number you are depositing from (minimum 9 digits).');
        return;
      }
    }

    // Minimum withdrawal amount & balance verification
    if (mode === 'withdraw') {
      if (minimumWithdrawalUGX <= 0) {
        setErrorMessage('Withdrawal settings are unavailable. Please refresh and try again.');
        return;
      }
      if (requestedWithdrawalUGX < minimumWithdrawalUGX) {
        setErrorMessage(
          `Minimum withdrawal amount is UGX ${minimumWithdrawalUGX.toLocaleString()}.`
        );
        return;
      }

      // Check balance against user's withdrawable balance
      if (requestedWithdrawalUGX > availableWithdrawableUGX) {
        setErrorMessage(
          `Insufficient balance. Requested UGX ${requestedWithdrawalUGX.toLocaleString()} exceeds your available withdrawable balance of UGX ${availableWithdrawableUGX.toLocaleString()}.`
        );
        return;
      }
    }

    setIsProcessing(true);
    try {

      const channelName =
        activeTab === 'mtn'
          ? 'MTN Mobile Money'
          : activeTab === 'airtel'
            ? 'Airtel Money Uganda'
            : 'Stanbic Bank EFT';

      const cleanSender = depositorPhone.trim();
      const desc =
        mode === 'deposit'
          ? `Deposit UGX ${numUGX.toLocaleString()} (Sender: ${cleanSender})`
          : isWelcomeBonus
            ? `Welcome Bonus Withdrawal — UGX ${requestedWithdrawalUGX.toLocaleString()} (Fee: UGX ${withdrawalFeeUGX.toLocaleString()} [30%] | Receive: UGX ${youReceiveUGX.toLocaleString()})`
            : `Withdrawal of UGX ${requestedWithdrawalUGX.toLocaleString()} (Fee: UGX ${withdrawalFeeUGX.toLocaleString()} [20%] | Receive: UGX ${youReceiveUGX.toLocaleString()})`;

      const referenceInfo =
        mode === 'deposit'
          ? `Sender: ${cleanSender} → To: ${RECIPIENT_NAME} (${DEPOSIT_PHONE})`
          : recipient;

      // Pass requested withdrawal amount (or deposit amount) directly to transaction handler
      const submissionAmount = mode === 'withdraw' ? requestedWithdrawalUGX : numUGX;
      const res = await onSuccess(submissionAmount, mode, desc, channelName, referenceInfo, isWelcomeBonus);
      setIsProcessing(false);

      if (res && res.success === false) {
        setErrorMessage(res.error || 'Transaction submission failed.');
        return;
      }

      try {
        confetti({ particleCount: 55, spread: 50, origin: { y: 0.6 } });
      } catch {}

      setSuccessInfo({
        amount: mode === 'withdraw' ? requestedWithdrawalUGX : numUGX,
        fee: withdrawalFeeUGX,
        totalDeduction: totalDeductionUGX,
        netAmount: mode === 'withdraw' ? youReceiveUGX : numUGX,
        channel: channelName,
        recipient: referenceInfo,
        isWelcomeBonus,
      });
      setSubmittedSuccess(true);
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMessage(err?.message || 'Transaction submission failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-100 flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                mode === 'deposit'
                  ? 'bg-blue-100 text-blue-600'
                  : isWelcomeBonus
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-emerald-100 text-emerald-600'
              }`}
            >
              {mode === 'deposit' ? (
                <ArrowDownLeft className="w-5 h-5" />
              ) : isWelcomeBonus ? (
                <Gift className="w-5 h-5 text-emerald-600" />
              ) : (
                <ArrowUpRight className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-[17px] font-extrabold text-[#0F172A] leading-tight">
                {mode === 'deposit'
                  ? 'Deposit UGX'
                  : isWelcomeBonus
                    ? 'Withdraw Welcome Bonus (0% Fee)'
                    : 'Withdraw UGX'}
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                Available: UGX {effectiveAvailableBalance.toLocaleString()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {submittedSuccess && successInfo ? (
          <div className="p-6 space-y-5 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <h4 className="text-[18px] font-extrabold text-slate-900">
                {mode === 'withdraw'
                  ? successInfo.isWelcomeBonus
                    ? 'Welcome Bonus withdrawal submitted at 0% fee!'
                    : 'Withdrawal request submitted successfully.'
                  : 'Deposit request submitted successfully.'}
              </h4>
              <p className="text-[13px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl py-2 px-3 mt-2">
                {mode === 'withdraw'
                  ? 'Your withdrawal is pending admin approval and will be sent to your account.'
                  : 'Your deposit is pending administrator review and verification.'}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left space-y-2.5 text-[12.5px]">
              <div className="flex justify-between items-center text-slate-600">
                <span>Transaction Type</span>
                <span className="font-bold text-slate-900">
                  {successInfo.isWelcomeBonus ? 'Welcome Bonus Withdrawal (30% Charge)' : 'Withdrawal (20% Fee)'}
                </span>
              </div>
              {mode === 'withdraw' ? (
                <>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Withdrawal Amount</span>
                    <span className="font-bold text-slate-900 font-mono">
                      UGX {successInfo.amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>{successInfo.isWelcomeBonus ? 'Bonus Protection Charge' : 'Withdrawal Fee'}</span>
                    {successInfo.isWelcomeBonus ? (
                      <span className="font-extrabold text-amber-700 font-mono bg-amber-100/70 px-2 py-0.5 rounded text-[11px]">
                        - UGX {successInfo.fee.toLocaleString()} (30%)
                      </span>
                    ) : (
                      <span className="font-semibold text-amber-600 font-mono">
                        - UGX {successInfo.fee.toLocaleString()} (20%)
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center text-slate-700 font-bold border-t border-slate-200/60 pt-1.5">
                    <span>Total Wallet Deduction</span>
                    <span className="text-slate-900 font-mono">
                      UGX {successInfo.totalDeduction.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-900 font-bold bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 mt-1">
                    <span className="text-emerald-900">Final Amount You Receive</span>
                    <span className="text-emerald-700 font-mono text-[14px]">
                      UGX {successInfo.netAmount.toLocaleString()}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between items-center text-slate-600">
                  <span>Deposit Amount</span>
                  <span className="font-bold text-slate-900 font-mono">
                    UGX {successInfo.amount.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center text-slate-600">
                <span>Payment Channel</span>
                <span className="font-semibold text-slate-800">{successInfo.channel}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Destination</span>
                <span className="font-mono text-[11.5px] text-slate-800 truncate max-w-[200px]">
                  {successInfo.recipient}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600 border-t border-slate-200/60 pt-2">
                <span>Status</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  Pending Admin Approval
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl font-bold text-[14px] text-white bg-slate-900 hover:bg-slate-800 shadow-md active:scale-98 transition-all cursor-pointer"
            >
              Done & View Activity
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {mode === 'withdraw' && minimumWithdrawalUGX > 0 && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
                Minimum withdrawal amount is UGX {minimumWithdrawalUGX.toLocaleString()}.
              </div>
            )}
            {/* Mode Toggle for Withdraw: Standard vs Welcome Bonus */}
            {mode === 'withdraw' && (
              <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-emerald-50 p-1 rounded-2xl border border-blue-200/80 shadow-2xs flex gap-1">
                <button
                  type="button"
                  onClick={() => handleToggleWelcomeBonus(true)}
                  className={`flex-1 py-2 px-2.5 rounded-xl text-[12px] font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isWelcomeBonus
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-white/60'
                  }`}
                >
                  <Gift className="w-3.5 h-3.5" />
                  <span>Welcome Bonus (30% Charge)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleWelcomeBonus(false)}
                  className={`flex-1 py-2 px-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    !isWelcomeBonus
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-white/60'
                  }`}
                >
                  <span>Standard (20% Fee)</span>
                </button>
              </div>
            )}

            {/* Method Selector */}
            <div>
              <label className="text-[12px] font-semibold text-slate-600 mb-1.5 block">
                {mode === 'deposit'
                  ? 'Select Your Mobile Money Network'
                  : 'Uganda Sovereign Payment Channel'}
              </label>
              <div className={`grid gap-2 ${mode === 'deposit' ? 'grid-cols-2' : 'grid-cols-3'}`}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('mtn');
                    if (mode === 'withdraw') setRecipient('0772 123 456 (MTN MoMo)');
                  }}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    activeTab === 'mtn'
                      ? 'border-[#1657D9] bg-yellow-50 text-[#0F172A] font-bold shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Smartphone className="w-4 h-4 mx-auto mb-1 text-amber-500" />
                  <span className="text-[11px] block font-bold">MTN MoMo</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('airtel');
                    if (mode === 'withdraw') setRecipient('0750 987 654 (Airtel Money)');
                  }}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    activeTab === 'airtel'
                      ? 'border-[#1657D9] bg-red-50 text-[#0F172A] font-bold shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Smartphone className="w-4 h-4 mx-auto mb-1 text-red-500" />
                  <span className="text-[11px] block font-bold">Airtel Money</span>
                </button>

                {mode === 'withdraw' && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('bank');
                      setRecipient('Stanbic Bank - 9030018829104');
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      activeTab === 'bank'
                        ? 'border-[#1657D9] bg-blue-50/70 text-[#1657D9] font-bold shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 mx-auto mb-1 text-blue-600" />
                    <span className="text-[11px] block font-bold">Bank Transfer</span>
                  </button>
                )}
              </div>
            </div>

            {/* Amount Inputs */}
            <div>
              <label className="text-[12px] font-semibold text-slate-600 mb-1.5 flex items-center justify-between">
                <span>
                  {mode === 'deposit'
                    ? 'Amount (UGX)'
                    : isWelcomeBonus
                      ? 'Welcome Bonus Amount'
                      : 'Withdrawal Amount (You Receive)'}
                  {mode === 'withdraw' && !isWelcomeBonus && (
                    <span className="ml-1.5 text-[10.5px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      Min: UGX {(minimumWithdrawalUGX || 0).toLocaleString()}
                    </span>
                  )}
                  {mode === 'deposit' && (
                    <span className="ml-1.5 text-[10.5px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      Min: UGX {MIN_DEPOSIT_UGX.toLocaleString()}
                    </span>
                  )}
                </span>
                <span className="text-[11px] font-medium text-emerald-600 font-mono">
                  UGX {numUGX.toLocaleString()}
                </span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                  UGX
                </span>
                <input
                  type="number"
                  value={amountUGXStr}
                  disabled={isWelcomeBonus}
                  onChange={(e) => setAmountUGXStr(e.target.value)}
                  placeholder={mode === 'deposit' ? '20000' : '5000'}
                  className={`w-full pl-12 pr-4 py-2.5 rounded-xl font-bold text-[16px] focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-mono ${
                    isWelcomeBonus
                      ? 'bg-emerald-50/50 border border-emerald-300 text-emerald-900 cursor-not-allowed'
                      : 'bg-slate-50 border border-slate-200 text-slate-900 focus:border-blue-600'
                  }`}
                />
              </div>

              {/* Withdrawal fee breakdown preview */}
              {mode === 'withdraw' && requestedWithdrawalUGX > 0 && (
                <div className="mt-2.5 bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="text-slate-600 font-medium">Withdrawal Amount</span>
                    <span className="font-mono font-bold text-slate-800">
                      UGX {requestedWithdrawalUGX.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="text-slate-600 font-medium">
                      {isWelcomeBonus ? 'Bonus Protection Charge (30%)' : 'Withdrawal Fee (20%)'}
                    </span>
                    <span className="font-mono font-bold text-amber-600">
                      - UGX {withdrawalFeeUGX.toLocaleString()} ({isWelcomeBonus ? '30%' : '20%'})
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[13px] bg-emerald-50 border border-emerald-200/80 rounded-xl px-3 py-2 mt-1">
                    <span className="text-emerald-900 font-bold">Final Amount You Receive</span>
                    <span className="font-mono font-black text-emerald-700 text-[14px]">
                      UGX {youReceiveUGX.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[12px] text-slate-500 pt-1">
                    <span>Total Wallet Deduction</span>
                    <span className="font-mono font-semibold text-slate-700">
                      UGX {totalDeductionUGX.toLocaleString()}
                    </span>
                  </div>

                  {totalDeductionUGX > availableWithdrawableUGX && (
                    <div className="text-[11px] font-semibold text-rose-600 flex items-center gap-1.5 pt-1 border-t border-rose-100">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                      <span>
                        Insufficient balance. Requested UGX {requestedWithdrawalUGX.toLocaleString()} exceeds your available withdrawable balance of UGX {availableWithdrawableUGX.toLocaleString()}.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Quick preset buttons */}
              {!isWelcomeBonus && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(mode === 'withdraw'
                    ? [5000, 10000, 20000, 50000, 100000]
                    : [20000, 30000, 50000, 100000, 200000]
                  ).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmountUGXStr(preset.toString())}
                      className="flex-1 min-w-[50px] py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                    >
                      {preset >= 1000000 ? `${preset / 1000000}M` : `${preset / 1000}k`}
                    </button>
                  ))}
                  {mode === 'withdraw' && balanceUGX > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const maxRec = calculateMaxWithdrawal(balanceUGX);
                        setAmountUGXStr(maxRec.toString());
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors cursor-pointer border border-blue-200"
                      title="Select maximum balance"
                    >
                      Max ({calculateMaxWithdrawal(balanceUGX).toLocaleString()} UGX)
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Details / Step-by-Step Instructions for Deposit vs Withdraw */}
            {mode === 'deposit' ? (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3.5">
                {/* Depositor's Phone Number Input Field */}
                <div className="bg-white rounded-2xl p-3.5 border border-blue-200/80 shadow-2xs space-y-1.5">
                  <label className="text-[12px] font-bold text-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-blue-900">
                      <Smartphone className="w-4 h-4 text-blue-600" />
                      Your Phone Number (Depositing From) <span className="text-red-500">*</span>
                    </span>
                    <span className="text-[10.5px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                      Required
                    </span>
                  </label>
                  <input
                    type="tel"
                    value={depositorPhone}
                    onChange={(e) => setDepositorPhone(e.target.value)}
                    placeholder="e.g. 0772 123 456 or 0766 000 000"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 font-mono tracking-wide placeholder:font-normal placeholder:text-slate-400"
                  />
                  <p className="text-[10.5px] text-slate-500 leading-tight">
                    Enter the phone number you are sending money from. This number is attached to
                    your deposit transaction so administrators can immediately match and credit your
                    balance.
                  </p>
                </div>

                {/* Recipient Card */}
                <div className="bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 text-white rounded-2xl p-3.5 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-blue-200 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-amber-300" /> Authorized Recipient
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Verified Name
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="text-[10.5px] text-slate-300 block font-medium">
                        Recipient Name
                      </span>
                      <span className="text-[15px] font-black tracking-wide text-amber-300 block font-mono">
                        {RECIPIENT_NAME}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(RECIPIENT_NAME, 'name')}
                      className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Copy Name"
                    >
                      {copiedKey === 'name' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'name' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/10 pt-2">
                    <div>
                      <span className="text-[10.5px] text-slate-300 block font-medium">
                        {activeTab === 'mtn' ? 'MTN MoMo Deposit Number' : 'Deposit Phone Number'}
                      </span>
                      <span className="text-[14px] font-black text-white font-mono block">
                        {DEPOSIT_PHONE}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(DEPOSIT_PHONE, 'phone')}
                      className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Copy Phone Number"
                    >
                      {copiedKey === 'phone' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'phone' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Quick Dial One-Tap Box */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1">
                      <PhoneCall className="w-3.5 h-3.5 text-blue-600" /> Quick USSD Dial Code
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Auto-fills amount</span>
                  </div>
                  <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="font-mono font-bold text-slate-900 text-[13px] break-all">
                      {depositUssd}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(depositUssd, 'ussd')}
                      className="shrink-0 ml-2 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-xs font-bold text-blue-600 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {copiedKey === 'ussd' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'ussd' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Step-by-Step USSD Instructions */}
                <div className="space-y-2 pt-0.5">
                  <span className="text-[11.5px] font-bold text-slate-800 block">
                    Step-by-Step USSD Guide ({activeTab === 'mtn' ? 'MTN MoMo' : 'Airtel Money'}):
                  </span>

                  <div className="space-y-2 text-[12px] text-slate-700 bg-white rounded-xl p-3 border border-slate-200 shadow-2xs">
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                        1
                      </span>
                      <div>
                        <span>Dial </span>
                        <strong className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-900">
                          {activeTab === 'mtn' ? '*165#' : '*185#'}
                        </strong>
                        <span> on your mobile phone keypad.</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                        2
                      </span>
                      <div>
                        <span>Select </span>
                        <strong className="font-semibold text-slate-900">1 (Send Money)</strong>
                        <span> → </span>
                        <strong className="font-semibold text-slate-900">
                          {activeTab === 'mtn'
                            ? '1 (Mobile User)'
                            : '1 (To Mobile / Other Networks)'}
                        </strong>
                        .
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                        3
                      </span>
                      <div>
                        <span>Enter Recipient Number: </span>
                        <strong className="font-mono text-blue-700 bg-blue-50 px-1 py-0.5 rounded font-bold">
                          {DEPOSIT_PHONE}
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                        4
                      </span>
                      <div>
                        <span>Enter Amount: </span>
                        <strong className="font-mono text-slate-900 font-bold">
                          UGX {numUGX.toLocaleString()}
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                        5
                      </span>
                      <div>
                        <span>Confirm that the recipient name shows </span>
                        <strong className="text-amber-800 bg-amber-50 px-1 py-0.5 rounded font-extrabold">
                          {RECIPIENT_NAME}
                        </strong>
                        <span>, then enter your PIN to authorize.</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 pt-0.5 border-t border-slate-100">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                        6
                      </span>
                      <div>
                        <span>After sending, tap the </span>
                        <strong className="text-blue-700 font-bold">Confirm Deposit</strong>
                        <span> button below to submit your request for fast approval!</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Deposit Approval Notice */}
                <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-800 leading-snug">
                    <span className="font-bold">Approval System:</span> Deposit requests are
                    submitted as <span className="font-semibold underline">Pending</span> and
                    credited to your wallet balance after administrator review and verification.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-[12px] font-semibold text-slate-600 mb-1.5 block">
                    Withdrawal Destination (Mobile Number / Bank Acct)
                  </label>
                  <input
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="e.g. 0772 123 456 or Stanbic Acct"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
                  />
                </div>

                {/* Withdrawal Fee Notice */}
                {isWelcomeBonus ? (
                  <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-900 leading-snug">
                      <span className="font-bold">Welcome Bonus Policy:</span> A{' '}
                      <span className="font-extrabold underline">30% bonus protection charge</span> applies to welcome bonus withdrawals (Fee: UGX 1,500, You Receive: UGX 3,500).
                    </p>
                  </div>
                ) : (
                  <div className="bg-blue-50 rounded-xl p-3 border border-blue-200 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-blue-900 leading-snug">
                      <span className="font-bold">Normal Withdrawal Fee (20%):</span> A{' '}
                      <span className="font-semibold underline">20% withdrawal fee</span> is
                      deducted from your requested withdrawal. You will receive the net amount (80%)
                      after administrator review and approval.
                    </p>
                  </div>
                )}
              </div>
            )}

            {errorMessage && (
              <div className="p-2.5 bg-red-50 text-red-700 text-[12px] rounded-xl font-medium border border-red-200">
                {errorMessage}
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={handleAction}
              disabled={isProcessing}
              className={`w-full py-3 rounded-xl font-bold text-[14px] text-white shadow-md active:scale-98 transition-all cursor-pointer ${
                mode === 'deposit'
                  ? 'bg-[#1657D9] hover:bg-blue-700'
                  : isWelcomeBonus
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-slate-900 hover:bg-slate-800'
              }`}
            >
              {isProcessing
                ? 'Processing Transaction...'
                : mode === 'deposit'
                  ? `Confirm Deposit of UGX ${numUGX.toLocaleString()}`
                  : isWelcomeBonus
                    ? `Submit Welcome Bonus Withdrawal (UGX 5,000 | Receive UGX 3,500)`
                    : `Submit Withdrawal of UGX ${requestedWithdrawalUGX.toLocaleString()} (Receive UGX ${youReceiveUGX.toLocaleString()})`}
            </button>

            {/* Quick Telegram Help */}
            <div className="text-center pt-1">
              <a
                id="link-deposit-telegram-help"
                href={TELEGRAM_HELP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-sky-700 hover:text-sky-800 transition-colors"
              >
                <Send className="w-3.5 h-3.5 text-sky-600 -translate-x-0.5" />
                <span>
                  Need help with {mode === 'deposit' ? 'depositing' : 'withdrawing'}? Chat on Telegram
                </span>
                <ExternalLink className="w-3 h-3 text-sky-500" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
