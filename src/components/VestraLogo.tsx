import React from 'react';

interface VestraLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  variant?: 'light' | 'dark' | 'auto';
  className?: string;
}

export const VestraLogo: React.FC<VestraLogoProps> = ({
  size = 'md',
  showText = true,
  variant = 'auto',
  className = '',
}) => {
  const iconDimensions = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
    xl: 'w-14 h-14',
  }[size];

  const titleSizes = {
    sm: 'text-sm tracking-wider',
    md: 'text-lg tracking-wider',
    lg: 'text-2xl tracking-widest',
    xl: 'text-3xl tracking-widest',
  }[size];

  const subSizes = {
    sm: 'text-[9px]',
    md: 'text-[10px]',
    lg: 'text-[11px]',
    xl: 'text-xs',
  }[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Dynamic Geometric Vestra Emblem */}
      <div
        className={`${iconDimensions} relative rounded-xl bg-gradient-to-br from-[#0B132B] via-[#0F1C3F] to-[#0A1128] p-1.5 shadow-md shadow-emerald-950/20 border border-emerald-500/30 flex items-center justify-center shrink-0 group overflow-hidden`}
      >
        {/* Subtle ambient light glow */}
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-400/25 rounded-full blur-sm pointer-events-none" />
        <div className="absolute -bottom-1 -left-1 w-6 h-6 bg-cyan-400/20 rounded-full blur-sm pointer-events-none" />

        <svg viewBox="0 0 48 48" className="w-full h-full relative z-10" fill="none">
          <defs>
            <linearGradient id="vestraWingLeft" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="vestraWingRight" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>
            <linearGradient id="vestraCore" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#A7F3D0" />
            </linearGradient>
          </defs>
          {/* Faceted Left Wing */}
          <path
            d="M8 12 L24 40 L20 40 L6 16 Z"
            fill="url(#vestraWingLeft)"
          />
          {/* Faceted Right Wing */}
          <path
            d="M40 12 L24 40 L28 40 L42 16 Z"
            fill="url(#vestraWingRight)"
          />
          {/* Center Vault Facet */}
          <path
            d="M19 12 L24 23 L29 12 L24 8 Z"
            fill="url(#vestraCore)"
          />
          {/* Micro Luminous Node */}
          <circle cx="24" cy="27" r="2" fill="#34D399" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 leading-none">
            <span
              className={`font-extrabold ${titleSizes} uppercase text-slate-900 tracking-[0.14em] font-sans`}
            >
              VESTRA
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <span
            className={`${subSizes} font-bold text-slate-500 uppercase tracking-[0.18em] leading-tight font-sans`}
          >
            YIELD VAULTS
          </span>
        </div>
      )}
    </div>
  );
};
