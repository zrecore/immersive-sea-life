import { useEffect, useState } from 'react'
import { simTime, mulberry32, lerp } from './sim'
import { MAMMALS, MAMMAL_IDS, MAMMAL_WEIGHT } from './mammals'

export type SeaEvent = {
  id: string
  kind: 'mammal' | 'school'
  species: string
  t0: number
  dur: number
  dir: 1 | -1
  y: number
  z: number
  seed: number
  /** Manual triggers replace whatever is currently on stage. */
  replace?: boolean
}

const subs = new Set<(e: SeaEvent) => void>()
export const subscribe = (f: (e: SeaEvent) => void) => {
  subs.add(f)
  return () => void subs.delete(f)
}
export const emit = (e: SeaEvent) => subs.forEach((f) => f(e))

export const SLOT = 30
export const PASS_SPECIES = ['anchovy', 'sardine', 'herring']

/** Deterministic: the same slot yields the same event in every window. */
export function eventForSlot(s: number): SeaEvent | null {
  const r = mulberry32(s * 7919 + 13)
  const a = r()
  const dir = r() < 0.5 ? 1 : -1
  const t0 = s * SLOT + r() * 6
  if (a < 0.55) {
    return { id: `s${s}`, kind: 'school', species: PASS_SPECIES[Math.floor(r() * PASS_SPECIES.length)], t0, dur: lerp(18, 26, r()), dir, y: lerp(4, 14, r()), z: lerp(-4, -24, r()), seed: s }
  }
  return null
}

/** Marine mammals share one lane: at most one species per 90s slot, and every pass ends inside its slot. */
export const MSLOT = 90
export function mammalForSlot(s: number): SeaEvent | null {
  const r = mulberry32(s * 104729 + 7)
  if (r() > 0.55) return null
  let w = r() * MAMMAL_WEIGHT
  const id = MAMMAL_IDS.find((k) => (w -= MAMMALS[k].weight) < 0) ?? MAMMAL_IDS[0]
  const m = MAMMALS[id]
  return { id: `m${s}`, kind: 'mammal', species: id, t0: s * MSLOT + r() * 12, dur: lerp(m.dur[0], m.dur[1], r()), dir: r() < 0.5 ? 1 : -1, y: lerp(m.y[0], m.y[1], r()), z: lerp(m.z[0], m.z[1], r()), seed: s }
}

export function useSeaEvents(kind: SeaEvent['kind']) {
  const [list, setList] = useState<SeaEvent[]>([])
  useEffect(() => {
    const live = (l: SeaEvent[]) => l.filter((x) => x.t0 + x.dur > simTime())
    const off = subscribe((e) => e.kind === kind && setList((l) => (e.replace ? [e] : [...live(l).filter((x) => x.id !== e.id), e])))
    const iv = setInterval(() => setList((l) => (live(l).length === l.length ? l : live(l))), 2000)
    return () => {
      off()
      clearInterval(iv)
    }
  }, [kind])
  return list
}
