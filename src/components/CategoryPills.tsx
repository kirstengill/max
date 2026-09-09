import React from 'react';
import { getPreciousMetalCategoryLabel } from '../constants/preciousMetalImages';

export type CategoryType = 'VIP Products' | 'Clean Energy' | 'DS-Mining' | 'All';

interface CategoryPillsProps {
  selectedCategory: CategoryType;
  onSelectCategory: (category: CategoryType) => void;
  counts: {
    vip: number;
    cleanEnergy: number;
    dsMining: number;
    all: number;
  };
}

export const CategoryPills: React.FC<CategoryPillsProps> = ({
  selectedCategory,
  onSelectCategory,
  counts,
}) => {
  const categories: { key: CategoryType; label: string; count?: number }[] = [
    { key: 'VIP Products', label: getPreciousMetalCategoryLabel('VIP Products'), count: counts.vip },
    { key: 'Clean Energy', label: getPreciousMetalCategoryLabel('Clean Energy'), count: counts.cleanEnergy },
    { key: 'DS-Mining', label: getPreciousMetalCategoryLabel('DS-Mining'), count: counts.dsMining },
    { key: 'All', label: getPreciousMetalCategoryLabel('All'), count: undefined },
  ];

  return (
    <div className="px-5 mb-4">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.key;
          const displayLabel = cat.count !== undefined ? `${cat.label} (${cat.count})` : cat.label;

          return (
            <button
              key={cat.key}
              id={`pill-cat-${cat.key.toLowerCase().replace(/\s+/g, '-')}`}
              onClick={() => onSelectCategory(cat.key)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-[13.5px] font-medium transition-all duration-200 shrink-0 ${
                isActive
                  ? 'bg-[#DBEAFE] text-[#0F172A] border border-[#BFDBFE] font-semibold shadow-xs'
                  : 'bg-white/80 hover:bg-white text-slate-600 border border-slate-200/80'
              }`}
            >
              {displayLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
};
