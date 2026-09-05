import React, { useState, useEffect } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Globe,
  HelpCircle,
  KeyRound,
  Gift,
  Users,
  Check
} from 'lucide-react';
import { authService, UserAccountData, cleanReferralCode } from '../services/supabaseAuth';
import { UserProfile } from '../types';
import { VestraLogo } from './VestraLogo';

interface AuthScreenProps {
  initialMode?: 'signin' | 'signup';
  initialReferralCode?: string;
  onAuthSuccess: (user: UserProfile, data?: UserAccountData) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  initialMode = 'signin',
  initialReferralCode = '',
  onAuthSuccess,
}) => {
  const initialCleanRef = cleanReferralCode(initialReferralCode);
  const [mode, setMode] = useState<'signin' | 'signup'>(initialCleanRef ? 'signup' : initialMode);

  // Sign In Form States
  const [signInUsername, setSignInUsername] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Sign Up Form States
  const [signUpFullName, setSignUpFullName] = useState('');
  const [signUpUsername, setSignUpUsername] = useState('');
  const [signUpPhone, setSignUpPhone] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [referralCode, setReferralCode] = useState(initialCleanRef);
  const [hasUrlReferral, setHasUrlReferral] = useState(Boolean(initialCleanRef));
  const [agreedTerms, setAgreedTerms] = useState(true);

  // General States
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Extract referral code from URL query parameters (?ref=CODE) or localStorage
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const refParam = searchParams.get('ref') || searchParams.get('referral') || localStorage.getItem('pending_referral_code');
      if (refParam) {
        const cleanRef = cleanReferralCode(refParam);
        if (cleanRef) {
          setReferralCode(cleanRef);
          setHasUrlReferral(true);
          setMode('signup');
          localStorage.setItem('pending_referral_code', cleanRef);
        }
      }
    } catch (e) {
      // Ignore URL parsing failure
    }
  }, []);

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return score; // 0 to 4
  };

  const passStrength = getPasswordStrength(signUpPassword);

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await authService.signInWithPassword(signInUsername.trim(), signInPassword);
      if (res.error) {
        setErrorMsg(res.error);
        setLoading(false);
      } else {
        setSuccessMsg(`Welcome back, ${res.user.fullName}! Opening dashboard...`);
        setTimeout(() => {
          onAuthSuccess(res.user, res.data);
        }, 500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to sign in. Please verify your credentials.');
      setLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanUsername = signUpUsername.trim();
    if (!cleanUsername) {
      setErrorMsg('Username is required.');
      return;
    }
    if (cleanUsername.length < 3) {
      setErrorMsg('Username must be at least 3 characters.');
      return;
    }
    if (!signUpPassword) {
      setErrorMsg('Password is required.');
      return;
    }
    if (signUpPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (signUpPassword !== signUpConfirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }
    if (!agreedTerms) {
      setErrorMsg('Please accept the Terms of Service to proceed.');
      return;
    }

    setLoading(true);

    try {
      const finalReferral = cleanReferralCode(referralCode);
      const res = await authService.signUp(
        cleanUsername,
        signUpPassword,
        (signUpFullName || cleanUsername).trim(),
        signUpPhone.trim() || undefined,
        finalReferral
      );
      if (res.error) {
        setErrorMsg(res.error);
        setLoading(false);
        return;
      }
      if (res.needsConfirmation) {
        setSuccessMsg('Account created! Please confirm your account, then sign in.');
        setLoading(false);
        return;
      }
      setSuccessMsg('Account created successfully! Complete your first deposit to unlock your UGX 4,000 Welcome Bonus.');
      setTimeout(() => {
        onAuthSuccess(res.user!, res.data);
      }, 600);
    } catch (err: any) {
      setErrorMsg(err.message || 'Sign up failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col min-h-full bg-gradient-to-b from-[#F0F4FC] via-[#F8FAFC] to-white pb-8">
      {/* Brand Header Banner */}
      <div className="px-6 pt-6 pb-4 flex items-center justify-between">
        <VestraLogo size="md" showText={true} />

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] font-bold text-emerald-800 shadow-2xs">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Sovereign Security</span>
        </div>
      </div>

      {/* Segmented Tab Bar (Sign In / Sign Up) */}
      <div className="px-6 mt-1 mb-4">
        <div className="bg-slate-200/70 p-1 rounded-2xl grid grid-cols-2 shadow-inner">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`py-2.5 text-[13px] font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'signin'
                ? 'bg-white text-[#1657D9] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5" /> Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`py-2.5 text-[13px] font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'signup'
                ? 'bg-white text-[#1657D9] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Sign Up
          </button>
        </div>
      </div>

      {/* Main Form Container */}
      <div className="px-6 flex-1 flex flex-col justify-between">
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm relative overflow-hidden">
          {/* Decorative background glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />

          {/* Feedback Alerts */}
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50/90 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-start gap-2 animate-in fade-in">
              <HelpCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* SIGN IN FORM */}
          {mode === 'signin' ? (
            <form onSubmit={handleSignInSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[12px] font-bold text-slate-700">
                    Username
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={signInUsername}
                    onChange={(e) => setSignInUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[13.5px] text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[12px] font-bold text-slate-700">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showSignInPassword ? 'text' : 'password'}
                    required
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[13.5px] text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignInPassword(!showSignInPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showSignInPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Device Option */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded-md text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <span className="text-[12px] text-slate-600 font-medium">
                    Keep me signed in
                  </span>
                </label>
                <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Verified Security
                </span>
              </div>

              {/* Primary Action Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 mt-2 bg-gradient-to-r from-[#1657D9] to-[#2563EB] hover:from-blue-700 hover:to-blue-800 text-white font-extrabold text-[14.5px] rounded-2xl transition-all shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-98"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In & Open Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* SIGN UP / REGISTER FORM */
            <form onSubmit={handleSignUpSubmit} className="space-y-3.5">
              {/* Starter Bonus Banner (UGX 4,000 Guaranteed) */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-2xl p-3 flex items-center gap-2.5">
                <Gift className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-[12px] font-extrabold text-emerald-950 flex items-center gap-1">
                    UGX 4,000 Starting Credit Included
                    <span className="text-[9px] bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded-full font-bold">
                      AUTOMATIC
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-snug">
                    New accounts receive <span className="font-bold">UGX 4,000</span> directly in their wallet upon registration.
                  </p>
                </div>
              </div>

              <div>
                <label className="text-[12px] font-bold text-slate-700 mb-1 block">
                  Username <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={signUpUsername}
                    onChange={(e) => setSignUpUsername(e.target.value)}
                    placeholder="Enter your chosen username"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[12px] font-bold text-slate-700 mb-1 block">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={signUpFullName}
                    onChange={(e) => setSignUpFullName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium transition-all"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-slate-700 mb-1 block">
                    Phone Number (MTN / Airtel)
                  </label>
                  <input
                    type="tel"
                    value={signUpPhone}
                    onChange={(e) => setSignUpPhone(e.target.value)}
                    placeholder="0770 000 000"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium transition-all"
                  />
                </div>
              </div>

              {/* Password & Confirm Password */}
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11.5px] font-bold text-slate-700">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                      className="text-[11px] text-blue-600 font-medium hover:underline cursor-pointer"
                    >
                      {showSignUpPassword ? 'Hide password' : 'Show password'}
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <input
                      type={showSignUpPassword ? 'text' : 'password'}
                      required
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11.5px] font-bold text-slate-700 mb-1 block">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <input
                      type={showSignUpPassword ? 'text' : 'password'}
                      required
                      value={signUpConfirmPassword}
                      onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                      placeholder="Re-type your password"
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Optional Full Name */}
              <div>
                <label className="text-[12px] font-bold text-slate-700 mb-1 block">
                  Full Name <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={signUpFullName}
                    onChange={(e) => setSignUpFullName(e.target.value)}
                    placeholder="e.g. Sarah Namubiru"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium transition-all"
                  />
                </div>
              </div>

              {/* Referral Code Field */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[12px] font-bold text-slate-700 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-blue-600" /> Referral Code <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  {hasUrlReferral && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                      Linked from Partner
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="e.g. SC-8F3K9P"
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-mono uppercase text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium transition-all"
                  />
                  {referralCode && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </div>

              {/* Password Strength Meter */}
              {signUpPassword && (
                <div className="space-y-1">
                  <div className="flex gap-1 h-1.5 w-full">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-full flex-1 rounded-full transition-all ${
                          passStrength >= step
                            ? passStrength >= 3
                              ? 'bg-emerald-500'
                              : passStrength === 2
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                            : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                    <span>Password Strength</span>
                    <span className={passStrength >= 3 ? 'text-emerald-600' : 'text-amber-600'}>
                      {passStrength >= 3 ? 'Strong' : passStrength === 2 ? 'Fair' : 'Weak'}
                    </span>
                  </div>
                </div>
              )}

              {/* Terms Checkbox */}
              <div className="pt-1">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded-md text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <span className="text-[11px] text-slate-600 leading-snug">
                    I agree to the <span className="font-bold text-blue-600">Terms of Service</span> & UGX Sovereign Account Policies.
                  </span>
                </label>
              </div>

              {/* Submit Sign Up */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 mt-2 bg-gradient-to-r from-[#1657D9] to-[#2563EB] hover:from-blue-700 hover:to-blue-800 text-white font-extrabold text-[14px] rounded-2xl transition-all shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-98"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Create Account & Claim UGX 4,000</span>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Security Footer */}
        <div className="mt-4 text-center space-y-2">
          <div className="flex items-center justify-center gap-4 text-[11px] text-slate-400 pt-1">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500" /> End-to-End Encrypted
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-slate-500" /> UGX Sovereign Platform
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
