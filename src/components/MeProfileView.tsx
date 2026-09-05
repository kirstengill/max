import React from 'react';
import { UserProfile } from '../types';
import { WHATSAPP_HELP_URL } from '../constants/links';
import {
  ShieldCheck,
  LogOut,
  ChevronRight,
  HelpCircle,
  CheckCircle2,
  Users,
  Lock,
  Globe,
  FileText,
  MessageCircle,
  ExternalLink
} from 'lucide-react';

interface MeProfileViewProps {
  user: UserProfile | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onOpenSupport: () => void;
  onNavigateToReferral?: () => void;
  onOpenAdmin?: () => void;
}

export const MeProfileView: React.FC<MeProfileViewProps> = ({
  user,
  onOpenAuth,
  onSignOut,
  onOpenSupport,
  onNavigateToReferral,
  onOpenAdmin,
}) => {
  const isAdmin = Boolean(user?.isAdmin || user?.role === 'admin');

  return (
    <div className="px-5 py-3 space-y-4 pb-6">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-[18px] shadow-sm">
            {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-[16px] font-extrabold text-slate-900 leading-tight">
                {user?.fullName || 'Investor'}
              </h3>
              <ShieldCheck className="w-4 h-4 text-emerald-600 fill-emerald-100" />
            </div>
            <p className="text-[12px] text-slate-500 font-mono">
              @{user?.username || 'investor'}
            </p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {isAdmin ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-blue-600" /> Authorized Admin
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> UGX 4,000 Bonus Active
                </span>
              )}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {user?.tier || 'Standard'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onOpenAuth}
          className="text-[12px] font-semibold text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-xl border border-blue-200 hover:bg-blue-50 transition-colors cursor-pointer"
        >
          Switch Account
        </button>
      </div>

      {/* Referral Program Banner */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-4 border border-blue-200/80 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-[13.5px] font-bold text-slate-900 leading-tight">
                Referral Program
              </h4>
              <span className="text-[9.5px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 px-1.5 py-0.2 rounded-full">
                Code: {user?.referralCode || 'VESTRA-VIP'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              {user?.referralCount
                ? `${user.referralCount} referrals • UGX ${(user.referralEarningsUGX || 0).toLocaleString()} earned`
                : 'Invite friends and earn 20% of every approved deposit they make'}
            </p>
          </div>
        </div>

        {onNavigateToReferral && (
          <button
            onClick={onNavigateToReferral}
            className="px-3 py-1.5 bg-[#1657D9] text-white rounded-xl text-[11px] font-bold shadow-xs hover:bg-blue-700 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
          >
            <span>View</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Settings Options for Normal Users (NO ADMIN BUTTONS/TEXTS FOR NORMAL USERS) */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {/* If user is an authenticated administrator, allow switching to the Admin Dashboard */}
        {isAdmin && onOpenAdmin && (
          <button
            onClick={onOpenAdmin}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer text-left bg-blue-50/40"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-blue-900 block">
                    Admin Master Console
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                    Root
                  </span>
                </div>
                <span className="text-[11px] text-blue-600">Multisig queue and cluster yield settings</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-blue-400" />
          </button>
        )}

        {onNavigateToReferral && (
          <button
            onClick={onNavigateToReferral}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[13px] font-bold text-slate-900 block">
                  My Referral Network & Links
                </span>
                <span className="text-[11px] text-slate-400">Share your link and earn UGX commissions</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        )}

        <a
          id="btn-whatsapp-profile-option"
          href={WHATSAPP_HELP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-emerald-50/50 transition-colors cursor-pointer text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#25D366] flex items-center justify-center">
              <MessageCircle className="w-4 h-4 fill-emerald-600/20" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-bold text-slate-900 block">
                  Official WhatsApp Helpdesk
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                  Live
                </span>
              </div>
              <span className="text-[11px] text-emerald-700 font-medium">Direct support, verification & community</span>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
        </a>

        <button
          onClick={onOpenSupport}
          className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[13px] font-bold text-slate-900 block">
                24/7 DS Concierge Support
              </span>
              <span className="text-[11px] text-slate-400">Live AI & human technical desk</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        <div className="w-full px-4 py-3.5 flex items-center justify-between text-left">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[13px] font-bold text-slate-900 block">
                Operating Currency & Region
              </span>
              <span className="text-[11px] text-slate-400">Uganda (UGX Sovereign Network)</span>
            </div>
          </div>
        </div>

        <button
          onClick={onSignOut}
          className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-red-50/50 transition-colors cursor-pointer text-left text-red-600"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <LogOut className="w-4 h-4" />
            </div>
            <span className="text-[13px] font-bold">Sign Out</span>
          </div>
          <ChevronRight className="w-4 h-4 text-red-400" />
        </button>
      </div>

      {/* Footer Info */}
      <div className="text-center pt-2 text-[11px] text-slate-400">
        VESTRA Sovereign Capital • Institutional Yield Vaults
      </div>
    </div>
  );
};
