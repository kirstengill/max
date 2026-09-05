import React from 'react';
import { LayoutDashboard, Layers, TrendingUp, Users2, Wallet2, ShieldUser } from 'lucide-react';

export type NavTab = 'home' | 'investments' | 'products' | 'referral' | 'wallet' | 'me';

interface BottomNavigationProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onSelectTab,
}) => {
  const tabs: { id: NavTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'home', label: 'Overview', icon: LayoutDashboard },
    { id: 'products', label: 'Vaults', icon: Layers },
    { id: 'investments', label: 'Portfolio', icon: TrendingUp },
    { id: 'wallet', label: 'Wallet', icon: Wallet2 },
    { id: 'referral', label: 'Affiliate', icon: Users2 },
    { id: 'me', label: 'Security', icon: ShieldUser },
  ];

  return (
    <nav className="sticky bottom-0 w-full bg-white/95 backdrop-blur-lg border-t border-slate-200/90 px-2 py-1.5 flex items-center justify-around z-30 shadow-lg shadow-slate-900/5">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            id={`nav-tab-${tab.id}`}
            onClick={() => onSelectTab(tab.id)}
            className={`relative flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all duration-150 cursor-pointer ${
              isActive
                ? 'text-emerald-700 font-bold'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60 font-medium'
            }`}
          >
            {/* Active Highlight Glow Pill */}
            {isActive && (
              <span className="absolute inset-0 bg-emerald-50/90 rounded-xl border border-emerald-500/20 -z-10 animate-in fade-in zoom-in-95 duration-150" />
            )}

            <Icon
              className={`w-4.5 h-4.5 transition-transform duration-150 ${
                isActive ? 'scale-110 text-emerald-600 stroke-[2.4]' : 'stroke-[1.75]'
              }`}
            />
            <span
              className={`text-[10px] tracking-tight mt-0.5 whitespace-nowrap ${
                isActive ? 'text-emerald-800 font-extrabold' : 'text-slate-500'
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
