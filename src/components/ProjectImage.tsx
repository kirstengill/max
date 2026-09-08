import React, { useState, useEffect } from 'react';
import { Cpu, Gem, Building2, Factory, Shield, Mountain } from 'lucide-react';
import { legacyImageMap, preciousMetalImages } from '../constants/preciousMetalImages';

interface ProjectImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  containerClassName?: string;
  fallbackCategory?: string;
}

const fallbackImages: Record<string, string> = {
  'VIP Products': preciousMetalImages.goldBullion,
  'DS-Mining': preciousMetalImages.palladiumMetal,
  'Clean Energy': preciousMetalImages.platinumBar,
  'Infrastructure': preciousMetalImages.goldBullion,
  'Private Wealth': preciousMetalImages.silverBullion,
  'Liquid Yield': preciousMetalImages.palladiumMetal,
  'Alpha Vaults': preciousMetalImages.platinumBar,
  'All': preciousMetalImages.silverBullion,
};

const fallbackIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'VIP Products': Gem,
  'DS-Mining': Mountain,
  'Clean Energy': Factory,
  'Infrastructure': Building2,
  'Private Wealth': Shield,
  'Liquid Yield': Gem,
  'Alpha Vaults': Gem,
  'All': Gem,
};

export const ProjectImage: React.FC<ProjectImageProps> = ({
  src,
  alt,
  className = 'w-full h-full object-contain',
  containerClassName = 'w-full h-full',
  fallbackCategory,
}) => {
  const [hasError, setHasError] = useState(false);
  const [useFallbackImage, setUseFallbackImage] = useState(false);

  // Reset error state when src changes
  useEffect(() => {
    setHasError(false);
    setUseFallbackImage(false);
  }, [src]);

  const isInvalid = !src || typeof src !== 'string' || src.trim() === '' || hasError;
  const resolvedSrc = typeof src === 'string' ? legacyImageMap[src] || src : src;

  const fallbackImageUrl = fallbackCategory ? fallbackImages[fallbackCategory] || '/images/precious-metals-portfolio.svg' : '/images/precious-metals-portfolio.svg';
  const FallbackIcon = fallbackCategory ? fallbackIcons[fallbackCategory] || Gem : Gem;

  if (isInvalid) {
    if (useFallbackImage) {
      return (
        <div
          className={`relative flex items-center justify-center overflow-hidden ${containerClassName}`}
          title={alt}
        >
          <img
            src={fallbackImageUrl}
            alt={alt}
            referrerPolicy="no-referrer"
            onError={() => setUseFallbackImage(false)}
            className={className}
          />
        </div>
      );
    }

    return (
      <div
        className={`bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center text-slate-400 p-4 select-none border border-slate-700/60 rounded-xl ${containerClassName}`}
        title={alt}
        onClick={() => setUseFallbackImage(true)}
        style={{ cursor: 'pointer' }}
      >
        <div className="w-12 h-12 rounded-xl bg-slate-800/80 shadow-2xs flex items-center justify-center text-amber-500 mb-2 border border-slate-600/50 shrink-0">
          <FallbackIcon className="w-6 h-6" />
        </div>
        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider text-center truncate max-w-full px-2">
          {fallbackCategory || 'Precious Metals'}
        </span>
        <span className="text-[8px] text-slate-500 mt-1">Click to load image</span>
      </div>
    );
  }

  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${containerClassName}`}>
      <img
        src={resolvedSrc}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
        className={className}
      />
    </div>
  );
};