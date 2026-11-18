import { mulberry32, smooth } from '../sim/sim'

const hash2 = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
export function fbm(x: number, y: number, oct = 4) {
  let a = 0.5, f = 1, s = 0
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x * f, y * f)
    a *= 0.5
    f *= 2
  }
  return s
}

export const reefAt = (x: number, z: number) => Math.max(0, fbm(x * 0.05, z * 0.05 + 9) - 0.52) * 16

/** Seabed height: rolling sand, rocky reef outcrops, rising backdrop; flat near the camera. */
export function seabedHeight(x: number, z: number) {
  const ripple = Math.sin(x * 0.9 + fbm(x * 0.1, z * 0.1) * 6) * 0.05
  const rolling = fbm(x * 0.02 + 3, z * 0.02) * 5 - 2
  const full = rolling + reefAt(x, z) + smooth(-35, -85, z) * 13
  const flat = smooth(12, -8, z)
  return -1.5 + ripple + (full + 1.5) * flat
}

export type Boulder = { x: number; y: number; z: number; s: number }
/** Half the boulders cluster near the camera so benthic life is visible. */
export const BOULDERS: Boulder[] = (() => {
  const r = mulberry32(5)
  return Array.from({ length: 70 }, (_, i) => {
    const near = i % 2 === 0
    const x = near ? (r() - 0.5) * 60 : (r() - 0.5) * 140
    const z = near ? 8 - r() * 28 : 6 - r() * 70
    const s = 0.6 + r() * r() * 3
    return { x, z, s, y: seabedHeight(x, z) + s * 0.2 }
  })
})()
