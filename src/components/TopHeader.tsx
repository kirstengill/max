import React from 'react';
import { Bell, LogIn, Send, Shield, ShieldCheck } from 'lucide-react';
import { AppNotification, UserProfile } from '../types';
import { TELEGRAM_HELP_URL } from '../constants/links';
import { VestraLogo } from './VestraLogo';

interface TopHeaderProps {
  notifications: AppNotification[];
  user?: UserProfile | null;
  onOpenNotifications: () => void;
  onOpenAdmin: () => void;
  onOpenAuth?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  notifications,
  user,
  onOpenNotifications,
  onOpenAdmin,
  onOpenAuth,
}) => {
  const unreadCount = notifications.filter((n) => !n.read).length;
  const isSuperAdmin = Boolean(user && user.isAdmin === true);

  return (
    <header className="px-5 pt-3.5 pb-2.5 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-slate-200/70 sticky top-0 z-30 transition-all">
      {/* Brand & Logo */}
      <div className="flex items-center gap-2">
        <VestraLogo size="sm" showText={true} />
      </div>

      {/* Action Icons */}
      <div className="flex items-center gap-2">
        {/* Admin Quick Switch (if authenticated admin) */}
        {isSuperAdmin && (
          <button
            id="btn-header-admin-console"
            onClick={onOpenAdmin}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
            title="Switch to Administrator Console"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Admin</span>
          </button>
        )}

        {/* Telegram VIP Helpline Option */}
        <a
          id="btn-telegram-header"
          href={TELEGRAM_HELP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100/80 text-sky-800 border border-sky-200 transition-all text-[11px] font-bold shadow-2xs active:scale-95"
          title="Direct VIP Telegram Helpline"
        >
          <Send className="w-3.5 h-3.5 text-sky-600 -translate-x-0.5" />
          <span className="hidden sm:inline">Desk</span>
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
        </a>

        {/* Notifications */}
        <button
          id="btn-notifications"
          onClick={onOpenNotifications}
          aria-label="View notifications"
          className="relative p-2 text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <Bell className="w-4.5 h-4.5 text-slate-700" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 bg-rose-600 text-[9px] font-extrabold text-white rounded-full flex items-center justify-center ring-2 ring-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* User Profile Avatar / Switch */}
        {onOpenAuth && (
          <button
            onClick={onOpenAuth}
            className="p-1 text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors flex items-center justify-center cursor-pointer"
            title={user ? `Signed in as ${user.fullName} (${user.username})` : 'Sign In / Register'}
          >
            {user ? (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 text-emerald-400 font-bold text-xs flex items-center justify-center shadow-xs">
                {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'V'}
              </div>
            ) : (
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
                <LogIn className="w-3.5 h-3.5" />
              </div>
            )}
          </button>
        )}
      </div>
    </header>
  );
};

