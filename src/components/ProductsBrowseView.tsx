import React, { useState } from 'react';
import { Machine } from '../types';
import { AVAILABLE_CATALOG } from '../data/initialData';
import { InvestmentCard } from './InvestmentCard';
import { Search, Sparkles, Filter, ShieldCheck, Zap, ArrowUpDown, Layers } from 'lucide-react';

interface ProductsBrowseViewProps {
  machines: Machine[];
  catalog?: Machine[];
  onSelectMachine: (m: Machine) => void;
  onInvestInMachine: (m: Machine) => void;
}

export const ProductsBrowseView: React.FC<ProductsBrowseViewProps> = ({
  machines,
  catalog,
  onSelectMachine,
  onInvestInMachine,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'reward_desc' | 'min_asc' | 'duration'>('default');

  const catalogList = (catalog && catalog.length > 0)
    ? catalog
    : AVAILABLE_CATALOG.length > 0
    ? AVAILABLE_CATALOG
    : machines;

  // Extract unique categories dynamically
  const uniqueCategories = ['All', ...Array.from(new Set(catalogList.map((m) => m.category)))];

  const filteredMachines = catalogList
    .filter((m) => {
      const matchesCat =
        selectedCategory === 'All' ? true : m.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.subtitle && m.subtitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCat && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'reward_desc') return b.dailyRewardUGX - a.dailyRewardUGX;
      if (sortBy === 'min_asc') return a.minInvestUGX - b.minInvestUGX;
      if (sortBy === 'duration') return (a.durationDays || 30) - (b.durationDays || 30);
      return 0;
    });

  return (
    <div className="space-y-4 px-4 sm:px-6 py-4 pb-12 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-5 text-white shadow-md border border-slate-700/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                Institutional Marketplace
              </span>
              <span className="text-xs text-slate-300">
                {catalogList.length} Active Yield Vaults
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              VESTRA Yield Vaults Catalog
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Select an institutional-grade algorithmic vault or computing node to deploy capital and generate daily UGX yields.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Principal Safeguarded</span>
          </div>
        </div>
      </div>

      {/* Controls: Search, Category Pills, and Sort */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search VESTRA yield vaults, arbitrage contracts, compute nodes..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-emerald-500 shadow-2xs"
            />
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 shrink-0 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500 font-medium">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="font-bold text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
            >
              <option value="default">Recommended</option>
              <option value="reward_desc">Highest Daily Yield</option>
              <option value="min_asc">Lowest Min Entry</option>
              <option value="duration">Shortest Duration</option>
            </select>
          </div>
        </div>

        {/* Dynamic Category Pills */}
        <div className="flex flex-wrap gap-1.5">
          {uniqueCategories.map((cat) => {
            const catStr = String(cat || '');
            const count =
              catStr === 'All'
                ? catalogList.length
                : catalogList.filter((m) => String(m.category || '').toLowerCase() === catStr.toLowerCase()).length;
            const isSelected = selectedCategory.toLowerCase() === catStr.toLowerCase();

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-slate-900 text-emerald-400 font-bold shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                    isSelected ? 'bg-slate-800 text-emerald-300' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Vaults Grid */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>Available Investment Contracts ({filteredMachines.length})</span>
          </h3>
          <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            Instant Daily Payouts
          </span>
        </div>

        {filteredMachines.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center text-slate-500">
            <p className="text-sm font-semibold mb-1">No VESTRA vaults match your filter.</p>
            <p className="text-xs text-slate-400 mb-3">Try clearing search terms or selecting another category.</p>
            <button
              onClick={() => {
                setSelectedCategory('All');
                setSearchQuery('');
              }}
              className="px-4 py-2 rounded-xl bg-slate-900 text-emerald-400 font-bold text-xs"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMachines.map((machine) => (
              <InvestmentCard
                key={machine.id}
                machine={machine}
                onManage={(m) => onInvestInMachine(m)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
