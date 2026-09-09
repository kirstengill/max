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

  // Reset error state when src changes
  useEffect(() => {
    setHasError(false);
  }, [src]);

  const isInvalid = !src || typeof src !== 'string' || src.trim() === '' || hasError;
  const resolvedSrc = typeof src === 'string' ? legacyImageMap[src] || src : src;

  const fallbackImageUrl = fallbackCategory ? fallbackImages[fallbackCategory] || '/images/precious-metals-portfolio.svg' : '/images/precious-metals-portfolio.svg';
  const FallbackIcon = fallbackCategory ? fallbackIcons[fallbackCategory] || Gem : Gem;

  if (isInvalid) {
    return (
      <div className={`relative flex items-center justify-center overflow-hidden ${containerClassName}`} title={alt}>
        <img
          src={fallbackImageUrl}
          alt={alt}
          referrerPolicy="no-referrer"
          className={className}
        />
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