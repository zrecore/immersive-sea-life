export type Tier = 'low' | 'medium' | 'high'
export const TIERS: Record<Tier, { dpr: number; kelp: number; fish: number; boulders: number; seg: [number, number]; snow: number }> = {
  low: { dpr: 1, kelp: 130, fish: 0.4, boulders: 30, seg: [96, 60], snow: 400 },
  medium: { dpr: 1.5, kelp: 220, fish: 0.7, boulders: 50, seg: [150, 90], snow: 900 },
  high: { dpr: 2, kelp: 340, fish: 1, boulders: 70, seg: [200, 120], snow: 1600 },
}
export const initialTier = (): Tier =>
  matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600 ? 'low' : 'high'
