import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mulberry32, simTime } from '../../sim/sim'
import { useSeaEvents, type SeaEvent } from '../../sim/events'
import { MAMMALS, type Mammal } from '../../sim/mammals'
import { withCaustics } from '../caustics'

/** Paint a part with a top→belly gradient (belly = lower body), `cut` raising the belly line. */
function paint(g: THREE.BufferGeometry, top: string, belly: string, h: number, cut: number) {
  g = g.index ? g.toNonIndexed() : g
  const p = g.attributes.position
  const a = new THREE.Color(top), b = new THREE.Color(belly), c = new THREE.Color()
  const col = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) {
    const t = THREE.MathUtils.smoothstep(p.getY(i) / h, cut - 0.1, cut + 0.12)
    c.copy(b).lerp(a, t)
    col.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}
const solid = (g: THREE.BufferGeometry, color: string) => paint(g, color, color, 1, 0)

/** Unit-length (nose +z) cetacean: tapered body, optional beak and dorsal fin, pectoral fins and flukes. */
function cetaceanGeometry(m: Mammal) {
  const s = m.shape!
  const body = new THREE.SphereGeometry(0.5, 36, 22).scale(s.w, s.h, 1)
  const p = body.attributes.position
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i)
    const k = z < 0 ? Math.max(0.1, 1 + z * 1.7) : 1 - Math.max(0, z - 0.3) * 0.8
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, z)
  }
  body.computeVertexNormals()
  const parts = [paint(body, m.top, m.belly, s.h / 2, s.cut)]
  const sh = new THREE.Shape()
  const f = s.fluke / 2
  sh.moveTo(0, 0.04).lineTo(f, -0.05).lineTo(f - 0.03, -0.08).lineTo(0, -0.025).lineTo(-(f - 0.03), -0.08).lineTo(-f, -0.05).closePath()
  parts.push(solid(new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, 0, -0.5), m.top))
  for (const sx of [1, -1]) {
    parts.push(solid(new THREE.SphereGeometry(0.5, 8, 6).scale(s.fin, 0.012, 0.07).rotateZ(sx * 0.6).translate(sx * (s.w * 0.45 + s.fin * 0.4), -s.h * 0.35, 0.18), m.top))
  }
  if (s.dorsal > 0) {
    const d = new THREE.Shape()
    d.moveTo(0.05, 0).lineTo(-0.07, 0).lineTo(-0.045, s.dorsal).closePath()
    parts.push(solid(new THREE.ExtrudeGeometry(d, { depth: 0.008, bevelEnabled: false }).translate(0, 0, -0.004).rotateY(-Math.PI / 2).translate(0, s.h * 0.42, 0.0), m.top))
  }
  if (s.beak > 0) parts.push(solid(new THREE.ConeGeometry(0.02, s.beak, 8).rotateX(Math.PI / 2).translate(0, -s.h * 0.1, 0.5 + s.beak / 2 - 0.02), m.top))
  return mergeGeometries(parts)!
}

/** Unit-length (nose +z) seal / sea lion / otter: tapered body, head, hind and fore flippers (or otter tail). */
function pinnipedGeometry(m: Mammal) {
  const w = m.otter ? 0.16 : 0.22
  const body = new THREE.SphereGeometry(0.5, 28, 18).scale(w, w * 0.92, 1)
  const p = body.attributes.position
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i)
    const k = z < 0 ? Math.max(0.12, 1 + z * 1.5) : 1
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, z)
  }
  body.computeVertexNormals()
  const parts = [paint(body, m.top, m.belly, w / 2, 0), solid(new THREE.SphereGeometry(0.5, 14, 10).scale(w * 0.62, w * 0.55, 0.2).translate(0, w * 0.1, 0.5), m.otter ? '#c9b8a0' : m.top)]
  const fl = m.fore ?? 0.1
  for (const sx of [1, -1]) {
    parts.push(solid(new THREE.SphereGeometry(0.5, 8, 6).scale(fl, 0.012, 0.08).rotateZ(sx * 0.7).translate(sx * (w * 0.5 + fl * 0.35), -w * 0.3, 0.2), m.top))
    if (!m.otter) parts.push(solid(new THREE.SphereGeometry(0.5, 8, 6).scale(0.12, 0.012, 0.11).rotateY(sx * 0.5).translate(sx * 0.06, 0, -0.55), m.top))
  }
  if (m.otter) parts.push(solid(new THREE.SphereGeometry(0.5, 8, 6).scale(0.05, 0.025, 0.28).translate(0, 0, -0.62), m.top))
  return mergeGeometries(parts)!
}

const geoCache = new Map<string, THREE.BufferGeometry>()
const geometryFor = (id: string) => {
  if (!geoCache.has(id)) geoCache.set(id, MAMMALS[id].kind === 'cetacean' ? cetaceanGeometry(MAMMALS[id]) : pinnipedGeometry(MAMMALS[id]))
  return geoCache.get(id)!
}

// Cetaceans beat their flukes up and down; seals and otters wag side to side.
const UNDULATE = /* glsl */ `
  float tk = smoothstep(0.15, -0.5, transformed.z);
  float wph = modelMatrix[3].z * 3.1;
  transformed.y += sin(uTime * 1.3 + transformed.z * 5.0 + wph) * (0.008 + 0.07 * tk);
`
const WAG = /* glsl */ `
  float tk = smoothstep(0.2, -0.5, transformed.z);
  float wph = modelMatrix[3].z * 3.1;
  transformed.x += sin(uTime * 2.4 + transformed.z * 5.0 + wph) * (0.01 + 0.08 * tk);
`

function Group({ ev }: { ev: SeaEvent }) {
  const m = MAMMALS[ev.species]
  const group = useRef<THREE.Group>(null)
  const geo = useMemo(() => geometryFor(ev.species), [ev.species])
  const mat = useMemo(
    () => withCaustics(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: m.kind === 'pinniped' ? 0.45 : 0.6, side: THREE.DoubleSide }), { caustics: 0.5, vertex: m.kind === 'cetacean' ? UNDULATE : WAG }),
    [m],
  )
  const members = useMemo(() => {
    const r = mulberry32(ev.seed + 5)
    const n = m.group[0] + Math.floor(r() * (m.group[1] - m.group[0] + 1))
    return Array.from({ length: n }, (_, i) => ({
      along: -i * m.len * (0.7 + r() * 0.5) * ev.dir,
      side: (r() - 0.5) * m.len * 0.8 + i * m.len * 0.12,
      dy: (r() - 0.5) * m.len * 0.25 - i * m.len * 0.05,
      ph: r() * 6,
      sc: 0.85 + r() * 0.3,
    }))
  }, [ev, m])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const t = simTime() - ev.t0
    g.visible = t >= 0 && t <= ev.dur
    const x0 = ev.dir * (-m.span / 2 + (m.span * t) / ev.dur)
    g.children.forEach((c, i) => {
      const k = members[i]
      c.position.set(x0 + k.along, ev.y + k.dy + Math.sin(t * 0.5 + k.ph) * m.bob, ev.z - k.side)
      const roll = m.kind === 'pinniped' ? Math.sin(t * 0.6 + k.ph) * 0.5 : Math.sin(t * 0.2 + k.ph) * 0.08
      c.rotation.set(Math.cos(t * 0.5 + k.ph) * (m.bob > 1 ? 0.12 : 0.05), (ev.dir * Math.PI) / 2, roll, 'YXZ')
    })
  })
  return (
    <group ref={group} visible={false}>
      {members.map((k, i) => (
        <mesh key={i} geometry={geo} material={mat} scale={m.len * k.sc} frustumCulled={false} />
      ))}
    </group>
  )
}

export function Mammals() {
  const events = useSeaEvents('mammal')
  return (
    <>
      {events.map((e) => (
        <Group key={e.id} ev={e} />
      ))}
    </>
  )
}
