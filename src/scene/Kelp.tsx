import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useStore, effectiveTier } from '../state/store'
import { TIERS } from '../config/quality'
import { mulberry32, lerp } from '../sim/sim'
import { fbm, seabedHeight } from './terrain'
import { SURFACE_Y, withCaustics } from './caustics'

const H = 18 // strand height in metres at scale 1 (instances scale uniformly)

// One swell travels across the forest (~25 m wavelength, ~8 s period); every plant surges along it,
// leaning downstream, with the tip moving most. Displacement is built in world space, then taken into
// the instance's local frame.
const SWAY = /* glsl */ `
  float h01 = transformed.y / ${H}.0;
  vec2 wd = vec2(0.8, 0.6);
  float phs = dot(instanceMatrix[3].xz, wd) * 0.25 - uTime * 0.8;
  float surge = sin(phs) + 0.3 * sin(2.0 * phs + 1.0);
  float amp = h01 * h01;
  vec3 wdisp = vec3(wd.x, 0.0, wd.y) * (surge * 1.5 + 0.8) * amp
             + vec3(-wd.y, 0.0, wd.x) * 0.2 * sin(phs * 0.5 + uTime * 0.2) * amp;
  transformed += inverse(mat3(instanceMatrix)) * wdisp;
`

function paint(g: THREE.BufferGeometry, from: string, to: string, along: (y: number) => number) {
  const p = g.attributes.position
  const a = new THREE.Color(from), b = new THREE.Color(to), c = new THREE.Color()
  const col = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) {
    c.copy(a).lerp(b, along(p.getY(i)))
    col.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

// Bull-kelp-like: tapered stipes, a bulb, and a crown of blades along the upper stipe.
function kelpGeometry() {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 3; i++) {
    const g = new THREE.PlaneGeometry(0.16, H, 1, 18).translate(0, H / 2, 0)
    const p = g.attributes.position
    for (let v = 0; v < p.count; v++) p.setX(v, p.getX(v) * (1 - (p.getY(v) / H) * 0.6))
    parts.push(paint(g.rotateY((i * Math.PI) / 3), '#4a3a1a', '#a89636', (y) => Math.pow(y / H, 0.8)))
  }
  // Crown: a bulb with long ribbon blades streaming up and out from it.
  const top = H * 0.97
  for (let k = 0; k < 9; k++) {
    const L = 3.6 + (k % 3) * 0.7
    const g = new THREE.PlaneGeometry(0.3, L, 1, 12).translate(0, L / 2, 0)
    const p = g.attributes.position
    for (let v = 0; v < p.count; v++) {
      const t = p.getY(v) / L
      p.setXYZ(v, p.getX(v) * Math.sin(t * Math.PI * 0.85 + 0.35) * 1.4, p.getY(v), 0.22 * Math.sin(t * 9 + k) * t)
    }
    paint(g, '#8a7a2a', '#c9bd4c', (y) => y / L)
    parts.push(g.rotateZ(0.35 + (k % 4) * 0.18).rotateY(k * 2.4).translate(0, top, 0))
  }
  parts.push(paint(new THREE.SphereGeometry(0.2, 10, 8).scale(1, 1.3, 1).translate(0, top, 0), '#6b5a22', '#6b5a22', () => 0))
  return mergeGeometries(parts)!
}

export function Kelp() {
  const count = TIERS[useStore((s) => effectiveTier(s))].kelp
  const mesh = useMemo(() => {
    const r = mulberry32(11)
    const mat = withCaustics(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.7 }), {
      caustics: 0.5,
      vertex: SWAY,
    })
    const m = new THREE.InstancedMesh(kelpGeometry(), mat, count)
    m.frustumCulled = false
    const d = new THREE.Object3D()
    const c = new THREE.Color()
    let i = 0
    while (i < count) {
      const x = (r() - 0.5) * 140, z = 6 - r() * 55
      if (fbm(x * 0.045 + 20, z * 0.045) < 0.48) continue // clustered stands
      const y = seabedHeight(x, z)
      d.position.set(x, y - 0.2, z)
      d.rotation.y = r() * 6
      d.scale.setScalar(Math.min(lerp(0.5, 1.25, r()), (SURFACE_Y - 1.5 - y) / H))
      d.updateMatrix()
      m.setMatrixAt(i, d.matrix)
      const t = lerp(0.8, 1.2, r())
      m.setColorAt(i, c.setRGB(t, t * lerp(0.95, 1.05, r()), t * 0.9))
      i++
    }
    return m
  }, [count])
  return <primitive object={mesh} />
}
