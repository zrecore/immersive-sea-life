import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SurfaceId } from '../config/surfaces'
import { initialTier, type Tier } from '../config/quality'
import { sliceFromUrl, type MappingMode } from '../config/mapping'

export type Corner = [number, number]
export type Quality = 'auto' | Tier

type State = {
  started: boolean
  surface: SurfaceId
  mapping: MappingMode
  quality: Quality
  autoTier: Tier
  volume: number
  muted: boolean
  corners: Corner[] // tl, tr, br, bl in screen fractions (y down)
  blend: number
  calibrate: boolean
  slice: { i: number; n: number }
  set: (p: Partial<State>) => void
  /** Restore all user settings to defaults (keeps the session started). */
  reset: () => void
}

const urlSlice = sliceFromUrl()
export const DEFAULT_CORNERS: Corner[] = [[0, 0], [1, 0], [1, 1], [0, 1]]

const defaults = () => ({
  surface: 'wideWall' as SurfaceId,
  mapping: (urlSlice ? 'multiWindow' : 'passthrough') as MappingMode,
  quality: 'auto' as Quality,
  volume: 0.7,
  muted: false,
  corners: DEFAULT_CORNERS,
  blend: 0,
  calibrate: false,
  slice: urlSlice ?? { i: 0, n: 2 },
})

export const useStore = create<State>()(
  persist(
    (set) => ({
      started: new URLSearchParams(location.search).has('autostart'),
      surface: 'wideWall',
      mapping: 'passthrough',
      quality: 'auto',
      autoTier: initialTier(),
      volume: 0.7,
      muted: false,
      corners: DEFAULT_CORNERS,
      blend: 0,
      calibrate: false,
      slice: urlSlice ?? { i: 0, n: 2 },
      set: (p) => set(p),
      reset: () => set({ ...defaults(), autoTier: initialTier() }),
    }),
    {
      name: 'immersive-sea-life',
      partialize: (s) => ({ surface: s.surface, mapping: s.mapping, quality: s.quality, volume: s.volume, corners: s.corners, blend: s.blend, slice: s.slice }),
      merge: (saved, cur) => {
        const m = { ...cur, ...(saved as object) }
        return urlSlice ? { ...m, mapping: 'multiWindow' as const, slice: urlSlice } : m
      },
    },
  ),
)

export const effectiveTier = (s: Pick<State, 'quality' | 'autoTier'>): Tier => (s.quality === 'auto' ? s.autoTier : s.quality)
