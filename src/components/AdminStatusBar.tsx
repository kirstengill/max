import React from 'react';
import { ShieldCheck, ShieldAlert, Sparkles } from 'lucide-react';
import { UserProfile } from '../types';

interface AdminStatusBarProps {
  user: UserProfile | null;
  onOpenAdmin: () => void;
}

export const AdminStatusBar: React.FC<AdminStatusBarProps> = ({ user, onOpenAdmin }) => {
  const isAdmin = Boolean(user?.isAdmin || user?.role === 'admin');

  return (
    <div
      className={`w-full py-1.5 px-4 flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-t border-b ${
        isAdmin
          ? 'bg-[#E9F0FA] border-blue-100/80 hover:bg-blue-100/60'
          : 'bg-emerald-50/70 border-emerald-100/80 hover:bg-emerald-100/60'
      }`}
      onClick={onOpenAdmin}
      id="btn-admin-status-bar"
    >
      {isAdmin ? (
        <>
          <ShieldCheck className="w-3.5 h-3.5 text-[#1657D9]" />
          <span className="text-[12px] font-medium text-[#1E293B]">
            Admin Console Access:{' '}
            <span className="text-[#16A34A] font-semibold">authorized (@{user?.username})</span>
          </span>
        </>
      ) : (
        <>
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-[12px] font-medium text-emerald-950">
            Account Status:{' '}
            <span className="text-emerald-700 font-bold">Standard Investor (UGX 5,000 Welcome Credit Active)</span>
          </span>
        </>
      )}
    </div>
  );
};
