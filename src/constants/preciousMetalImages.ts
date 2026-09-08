export const preciousMetalImages = {
  goldBullion: 'https://upload.wikimedia.org/wikipedia/commons/a/af/Gold_bullion_bars.jpg',
  silverBullion: 'https://upload.wikimedia.org/wikipedia/commons/0/03/2020_SILVER_EAGLE_MS70_UNCIRCULATED_BULLION.jpg',
  palladiumMetal: 'https://upload.wikimedia.org/wikipedia/commons/1/17/Palladium_%28Element_-_46%29_1.jpg',
  platinumBar: 'https://upload.wikimedia.org/wikipedia/commons/b/bb/Platinum-Iridium_meter_bar.jpg',
} as const;

export const legacyImageMap: Record<string, string> = {
  '/images/gold-bars.svg': preciousMetalImages.goldBullion,
  '/images/silver-bars.svg': preciousMetalImages.silverBullion,
  '/images/palladium-bars.svg': preciousMetalImages.palladiumMetal,
  '/images/mining-operation.svg': preciousMetalImages.platinumBar,
  '/images/refining-facility.svg': preciousMetalImages.platinumBar,
  '/images/bullion-vault.svg': preciousMetalImages.goldBullion,
  '/images/precious-metals-portfolio.svg': preciousMetalImages.silverBullion,
};