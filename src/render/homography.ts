import * as THREE from 'three'
import type { Corner } from '../state/store'

/** Matrix mapping output screen uv (y up) -> source uv, so the 4 corners land on the unit square. */
export function cornersToMatrix(c: Corner[]): THREE.Matrix3 {
  const src = c.map(([x, y]) => [x, 1 - y])
  const dst = [[0, 1], [1, 1], [1, 0], [0, 0]]
  const A: number[][] = []
  src.forEach(([x, y], i) => {
    const [u, v] = dst[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u])
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v])
  })
  for (let i = 0; i < 8; i++) {
    let p = i
    for (let r = i + 1; r < 8; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r
    ;[A[i], A[p]] = [A[p], A[i]]
    for (let r = 0; r < 8; r++) {
      if (r === i) continue
      const f = A[r][i] / (A[i][i] || 1e-9)
      for (let k = i; k < 9; k++) A[r][k] -= f * A[i][k]
    }
  }
  const h = A.map((row, i) => row[8] / (row[i] || 1e-9))
  return new THREE.Matrix3().set(h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1)
}
