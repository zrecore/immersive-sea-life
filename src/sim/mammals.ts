export type Sound = 'humpback' | 'moan' | 'deep' | 'orca' | 'dolphin' | 'click' | 'bark' | 'roar' | 'none'
/** Cetacean body proportions relative to length 1 (w/h = full width/height, cut = how high the pale belly reaches). */
export type CetShape = { w: number; h: number; dorsal: number; beak: number; fin: number; fluke: number; cut: number }
export type Mammal = {
  label: string
  kind: 'cetacean' | 'pinniped'
  len: number
  top: string
  belly: string
  group: [number, number]
  dur: [number, number]
  span: number // distance travelled across the scene
  y: [number, number]
  z: [number, number]
  weight: number
  sound: Sound
  bob: number // vertical bobbing amplitude (m)
  shape?: CetShape
  fore?: number // pinniped fore-flipper length
  otter?: boolean
}

const c = (w: number, h: number, dorsal: number, beak: number, fin: number, fluke: number, cut = 0): CetShape => ({ w, h, dorsal, beak, fin, fluke, cut })

// One marine mammal is on stage at a time (see mammalForSlot); durations stay under the 90s lane slot.
export const MAMMALS: Record<string, Mammal> = {
  gray: { label: 'Gray whale', kind: 'cetacean', len: 13, top: '#6c777a', belly: '#8a9496', group: [2, 3], dur: [52, 60], span: 190, y: [12, 17], z: [-8, -22], weight: 3, sound: 'moan', bob: 1.5, shape: c(0.3, 0.27, 0.0, 0, 0.12, 0.4) },
  humpback: { label: 'Humpback whale', kind: 'cetacean', len: 14, top: '#2c3846', belly: '#9aa8b2', group: [2, 3], dur: [52, 60], span: 190, y: [12, 17], z: [-8, -22], weight: 3, sound: 'humpback', bob: 1.5, shape: c(0.26, 0.25, 0.03, 0, 0.3, 0.45, 0.1) },
  blue: { label: 'Blue whale', kind: 'cetacean', len: 24, top: '#4a6076', belly: '#7e93a4', group: [1, 1], dur: [62, 68], span: 210, y: [14, 19], z: [-14, -26], weight: 1, sound: 'deep', bob: 1, shape: c(0.15, 0.14, 0.02, 0, 0.1, 0.38) },
  fin: { label: 'Fin whale', kind: 'cetacean', len: 19, top: '#3a4048', belly: '#c2c9cc', group: [1, 2], dur: [58, 64], span: 200, y: [13, 18], z: [-12, -24], weight: 1, sound: 'deep', bob: 1, shape: c(0.16, 0.15, 0.035, 0, 0.1, 0.35, 0.05) },
  minke: { label: 'Minke whale', kind: 'cetacean', len: 8, top: '#4a5058', belly: '#c8ced0', group: [1, 1], dur: [40, 48], span: 170, y: [8, 14], z: [-6, -16], weight: 1, sound: 'moan', bob: 1.2, shape: c(0.17, 0.16, 0.05, 0, 0.1, 0.3, 0.05) },
  orca: { label: 'Orca', kind: 'cetacean', len: 7, top: '#0c0f14', belly: '#eef1f2', group: [3, 5], dur: [38, 46], span: 180, y: [6, 13], z: [-5, -16], weight: 1.5, sound: 'orca', bob: 1.2, shape: c(0.22, 0.21, 0.15, 0, 0.17, 0.32, 0.12) },
  whitesided: { label: 'Pacific white-sided dolphin', kind: 'cetacean', len: 2.3, top: '#4e5d6b', belly: '#d2dadf', group: [6, 10], dur: [22, 28], span: 160, y: [5, 13], z: [2, -8], weight: 2, sound: 'dolphin', bob: 1.2, shape: c(0.2, 0.19, 0.09, 0.06, 0.13, 0.3, 0.05) },
  risso: { label: "Risso's dolphin", kind: 'cetacean', len: 3.2, top: '#8d99a2', belly: '#c9d0d4', group: [4, 7], dur: [26, 32], span: 150, y: [5, 12], z: [2, -8], weight: 1, sound: 'dolphin', bob: 0.8, shape: c(0.22, 0.22, 0.1, 0, 0.12, 0.3, 0.0) },
  rightwhale: { label: 'Northern right whale dolphin', kind: 'cetacean', len: 2.8, top: '#14181c', belly: '#f2f4f5', group: [6, 10], dur: [22, 28], span: 160, y: [5, 13], z: [2, -8], weight: 1, sound: 'dolphin', bob: 1.2, shape: c(0.14, 0.13, 0, 0.03, 0.12, 0.28, 0.15) },
  harborporpoise: { label: 'Harbor porpoise', kind: 'cetacean', len: 1.7, top: '#3f4850', belly: '#c8ced0', group: [2, 4], dur: [30, 36], span: 120, y: [4, 10], z: [5, -3], weight: 1.5, sound: 'click', bob: 0.6, shape: c(0.22, 0.2, 0.07, 0, 0.1, 0.28, 0.0) },
  dalls: { label: "Dall's porpoise", kind: 'cetacean', len: 2, top: '#10151a', belly: '#f0f3f4', group: [3, 6], dur: [20, 26], span: 160, y: [4, 11], z: [4, -4], weight: 1.5, sound: 'click', bob: 0.8, shape: c(0.27, 0.24, 0.08, 0, 0.1, 0.28, 0.1) },
  harborseal: { label: 'Harbor seal', kind: 'pinniped', len: 1.6, top: '#7a7d78', belly: '#b4b3a8', group: [1, 3], dur: [38, 44], span: 100, y: [3, 9], z: [7, 0], weight: 2, sound: 'none', bob: 1, fore: 0.07 },
  sealion: { label: 'California sea lion', kind: 'pinniped', len: 2.2, top: '#4a3524', belly: '#6a4e38', group: [2, 5], dur: [30, 36], span: 120, y: [3, 10], z: [7, 0], weight: 2, sound: 'bark', bob: 1.5, fore: 0.16 },
  steller: { label: 'Steller sea lion', kind: 'pinniped', len: 3, top: '#a8804e', belly: '#c09a68', group: [1, 3], dur: [38, 44], span: 110, y: [3, 10], z: [6, -1], weight: 1, sound: 'bark', bob: 1.2, fore: 0.17 },
  elephantseal: { label: 'Northern elephant seal', kind: 'pinniped', len: 3.8, top: '#6d6159', belly: '#8a7d72', group: [1, 2], dur: [52, 58], span: 90, y: [4, 10], z: [6, 0], weight: 1, sound: 'roar', bob: 0.6, fore: 0.08 },
  furseal: { label: 'Northern fur seal', kind: 'pinniped', len: 1.6, top: '#2e2a28', belly: '#4a4440', group: [2, 4], dur: [28, 34], span: 130, y: [5, 12], z: [6, -1], weight: 1, sound: 'none', bob: 1.4, fore: 0.15 },
  otter: { label: 'Sea otter', kind: 'pinniped', len: 1.2, top: '#4b3a2c', belly: '#6d5844', group: [1, 3], dur: [42, 48], span: 60, y: [2.5, 6], z: [9, 3], weight: 1, sound: 'none', bob: 0.8, fore: 0.05, otter: true },
}
export const MAMMAL_IDS = Object.keys(MAMMALS)
export const MAMMAL_WEIGHT = MAMMAL_IDS.reduce((a, k) => a + MAMMALS[k].weight, 0)
