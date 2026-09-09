import { Machine } from '../types';
import { preciousMetalImages } from './preciousMetalImages';

export const defaultCatalogProducts: Machine[] = [
  {
    id: 'gold-bullion-1kg',
    title: 'Gold Bullion 1KG Vault',
    subtitle: 'LBMA Good Delivery Gold Bars',
    category: 'VIP Products',
    image: preciousMetalImages.goldBullion,
    dailyRewardUGX: 125000,
    status: 'Active',
    estYearlyROI: 145,
    minInvestUGX: 5000000,
    minimum_investment_amount: 5000000,
    maxInvestUGX: 50000000,
    durationDays: 365,
    hashrate: 'N/A',
    powerSource: 'Secure Vault Storage',
    uptime: '99.99%',
    temperature: '20°C',
    efficiency: 99.9,
    totalMinedUGX: 0,
    unclaimedRewardsUGX: 0,
    isBoosted: false,
  },
  {
    id: 'silver-bullion-1000oz',
    title: 'Silver Bullion 1000oz Vault',
    subtitle: 'LBMA Good Delivery Silver Bars',
    category: 'VIP Products',
    image: preciousMetalImages.silverBullion,
    dailyRewardUGX: 45000,
    status: 'Active',
    estYearlyROI: 132,
    minInvestUGX: 1500000,
    minimum_investment_amount: 1500000,
    maxInvestUGX: 15000000,
    durationDays: 365,
    hashrate: 'N/A',
    powerSource: 'Secure Vault Storage',
    uptime: '99.99%',
    temperature: '20°C',
    efficiency: 99.9,
    totalMinedUGX: 0,
    unclaimedRewardsUGX: 0,
    isBoosted: false,
  },
  {
    id: 'platinum-palladium-mix',
    title: 'Platinum & Palladium Mix',
    subtitle: 'Industrial Precious Metals Portfolio',
    category: 'DS-Mining',
    image: preciousMetalImages.palladiumMetal,
    dailyRewardUGX: 78000,
    status: 'Active',
    estYearlyROI: 158,
    minInvestUGX: 3000000,
    minimum_investment_amount: 3000000,
    maxInvestUGX: 30000000,
    durationDays: 365,
    hashrate: 'N/A',
    powerSource: 'Secure Vault Storage',
    uptime: '99.99%',
    temperature: '20°C',
    efficiency: 99.5,
    totalMinedUGX: 0,
    unclaimedRewardsUGX: 0,
    isBoosted: false,
  },
  {
    id: 'mining-operation-alpha',
    title: 'DS Mining Operation Alpha',
    subtitle: 'Gold & Copper Mining Contract',
    category: 'DS-Mining',
    image: preciousMetalImages.platinumBar,
    dailyRewardUGX: 210000,
    status: 'Active',
    estYearlyROI: 185,
    minInvestUGX: 10000000,
    minimum_investment_amount: 10000000,
    maxInvestUGX: 100000000,
    durationDays: 730,
    hashrate: '2.5 PH/s',
    powerSource: 'Hydroelectric + Solar',
    uptime: '99.5%',
    temperature: '35°C',
    efficiency: 97.8,
    totalMinedUGX: 0,
    unclaimedRewardsUGX: 0,
    isBoosted: false,
  },
  {
    id: 'refining-facility-beta',
    title: 'Refining Facility Beta',
    subtitle: 'Precious Metals Refining Yield',
    category: 'Clean Energy',
    image: preciousMetalImages.platinumBar,
    dailyRewardUGX: 165000,
    status: 'Active',
    estYearlyROI: 168,
    minInvestUGX: 5000000,
    minimum_investment_amount: 5000000,
    maxInvestUGX: 50000000,
    durationDays: 540,
    hashrate: 'N/A',
    powerSource: 'Green Energy Grid',
    uptime: '99.8%',
    temperature: '45°C',
    efficiency: 98.2,
    totalMinedUGX: 0,
    unclaimedRewardsUGX: 0,
    isBoosted: false,
  },
  {
    id: 'bullion-vault-secure',
    title: 'High-Security Bullion Vault',
    subtitle: 'Multi-Metal Allocated Storage',
    category: 'Infrastructure',
    image: preciousMetalImages.goldBullion,
    dailyRewardUGX: 95000,
    status: 'Active',
    estYearlyROI: 125,
    minInvestUGX: 2000000,
    minimum_investment_amount: 2000000,
    maxInvestUGX: 20000000,
    durationDays: 365,
    hashrate: 'N/A',
    powerSource: 'Grid + Backup Generators',
    uptime: '99.99%',
    temperature: '18°C',
    efficiency: 99.9,
    totalMinedUGX: 0,
    unclaimedRewardsUGX: 0,
    isBoosted: false,
  },
  {
    id: 'precious-metals-portfolio',
    title: 'Diversified Precious Metals Portfolio',
    subtitle: 'Gold, Silver, Platinum, Palladium',
    category: 'Alpha Vaults',
    image: preciousMetalImages.silverBullion,
    dailyRewardUGX: 88000,
    status: 'Active',
    estYearlyROI: 142,
    minInvestUGX: 1000000,
    minimum_investment_amount: 1000000,
    maxInvestUGX: 10000000,
    durationDays: 365,
    hashrate: 'N/A',
    powerSource: 'Global Vault Network',
    uptime: '99.99%',
    temperature: '20°C',
    efficiency: 99.7,
    totalMinedUGX: 0,
    unclaimedRewardsUGX: 0,
    isBoosted: false,
  },
  {
    id: 'clean-energy-hydro',
    title: 'Clean Energy Hydro Mining',
    subtitle: 'Sustainable Gold Mining Power',
    category: 'Clean Energy',
    image: preciousMetalImages.platinumBar,
    dailyRewardUGX: 142000,
    status: 'Active',
    estYearlyROI: 155,
    minInvestUGX: 7500000,
    minimum_investment_amount: 7500000,
    maxInvestUGX: 75000000,
    durationDays: 540,
    hashrate: '1.8 PH/s',
    powerSource: '100% Hydroelectric',
    uptime: '99.7%',
    temperature: '32°C',
    efficiency: 98.5,
    totalMinedUGX: 0,
    unclaimedRewardsUGX: 0,
    isBoosted: false,
  },
];

const STORAGE_KEY = 'sunrise_capital_product_overrides';

export function getLocalProductOverrides(): Record<string, Machine> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveLocalProductOverride(product: Machine): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getLocalProductOverrides();
    current[product.id] = product;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.warn('[Storage] Failed to save product override:', err);
  }
}

export function removeLocalProductOverride(productId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getLocalProductOverrides();
    delete current[productId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.warn('[Storage] Failed to remove product override:', err);
  }
}

/** Merges defaults, DB records, and local admin edits into a unified product list. */
export function mergeCatalogWithOverrides(dbProducts: Machine[] = []): Machine[] {
  const overrides = getLocalProductOverrides();
  const productMap = new Map<string, Machine>();

  // 1. Seed with default products
  for (const def of defaultCatalogProducts) {
    productMap.set(def.id, { ...def });
  }

  // 2. Overlay remote database products
  for (const p of dbProducts) {
    const existing = productMap.get(p.id);
    productMap.set(p.id, {
      ...(existing || {}),
      ...p,
      minInvestUGX: p.minimum_investment_amount ?? p.minInvestUGX,
      minimum_investment_amount: p.minimum_investment_amount ?? p.minInvestUGX,
    });
  }

  // 3. Overlay any local administrator edits
  for (const [id, override] of Object.entries(overrides)) {
    const existing = productMap.get(id);
    productMap.set(id, {
      ...(existing || {}),
      ...override,
      minInvestUGX: override.minimum_investment_amount ?? override.minInvestUGX,
      minimum_investment_amount: override.minimum_investment_amount ?? override.minInvestUGX,
    });
  }

  const result = Array.from(productMap.values());
  result.sort((a, b) => (a.minInvestUGX || 0) - (b.minInvestUGX || 0));
  return result;
}
