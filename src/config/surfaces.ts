export type View = {
  /** Fractions of the output canvas; y measured from the bottom. */
  x: number; y: number; w: number; h: number
  yaw: number; pitch: number
  hfov?: number // degrees; otherwise derived from aspect
  pos?: [number, number, number]
}
export type SurfaceId = 'wideWall' | 'wallFloor' | 'multiWall'
export type Surface = { label: string; views: View[] }

const H = Math.PI / 2
export const SURFACES: Record<SurfaceId, Surface> = {
  wideWall: { label: 'Single wide wall', views: [{ x: 0, y: 0, w: 1, h: 1, yaw: 0, pitch: 0.06 }] },
  wallFloor: {
    label: 'Wall + floor',
    views: [
      { x: 0, y: 0.38, w: 1, h: 0.62, yaw: 0, pitch: 0.12 },
      { x: 0, y: 0, w: 1, h: 0.38, yaw: 0, pitch: -1.25, pos: [0, 9, 4] },
    ],
  },
  multiWall: {
    label: 'Three walls',
    views: [
      { x: 0, y: 0, w: 1 / 3, h: 1, yaw: H, pitch: 0.1, hfov: 90 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 1, yaw: 0, pitch: 0.1, hfov: 90 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 1, yaw: -H, pitch: 0.1, hfov: 90 },
    ],
  },
}
