export type MappingMode = 'passthrough' | 'warp' | 'multiWindow'
export const MAPPING_LABELS: Record<MappingMode, string> = {
  passthrough: 'Pass-through (external mapper)',
  warp: 'In-browser warp + blend',
  multiWindow: 'Multi-window slice',
}
/** `?slice=i/n` selects multi-window mode where this window renders slice i of n. */
export function sliceFromUrl(): { i: number; n: number } | null {
  const m = new URLSearchParams(location.search).get('slice')?.match(/^(\d+)\/(\d+)$/)
  return m && +m[2] > 0 && +m[1] < +m[2] ? { i: +m[1], n: +m[2] } : null
}
