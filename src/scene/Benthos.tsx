import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useStore, effectiveTier } from '../state/store'
import { TIERS } from '../config/quality'
import { mulberry32, lerp } from '../sim/sim'
import { BOULDERS, seabedHeight, type Boulder } from './terrain'
import { withCaustics } from './caustics'

type Rng = () => number
type Spot = { p: THREE.Vector3; n: THREE.Vector3 }
const UP = new THREE.Vector3(0, 1, 0)

/** A point on a boulder (approximated as a squashed ellipsoid) with outward normal. */
function onBoulder(b: Boulder, r: Rng, minUp: number): Spot {
  const th = r() * 6.283, dy = minUp + r() * (1 - minUp), rr = Math.sqrt(1 - dy * dy)
  const n = new THREE.Vector3(rr * Math.cos(th), dy, rr * Math.sin(th))
  return { n, p: new THREE.Vector3(b.x + n.x * b.s * 0.9, b.y + n.y * b.s * 0.62, b.z + n.z * b.s * 0.9) }
}
function onSand(r: Rng): Spot {
  const x = (r() - 0.5) * 36, z = 11 - r() * 18
  return { p: new THREE.Vector3(x, seabedHeight(x, z), z), n: UP.clone() }
}
const pick = <T,>(r: Rng, a: T[]) => a[Math.floor(r() * a.length)]

function populate(mesh: THREE.InstancedMesh, spots: { spot: Spot; s: number; color: string }[]) {
  const d = new THREE.Object3D()
  const c = new THREE.Color()
  spots.forEach(({ spot, s, color }, i) => {
    d.position.copy(spot.p)
    d.quaternion.setFromUnitVectors(UP, spot.n)
    d.rotateY(((i * 2.399) % 6.283))
    d.scale.setScalar(s)
    d.updateMatrix()
    mesh.setMatrixAt(i, d.matrix)
    mesh.setColorAt(i, c.set(color))
  })
  mesh.frustumCulled = false
  return mesh
}

function mat(roughness: number, vertex?: string, side?: THREE.Side) {
  return withCaustics(new THREE.MeshStandardMaterial(side === undefined ? { roughness } : { roughness, side }), { caustics: 0.7, vertex })
}
const ni = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g)

function seaStarGeo() {
  const sh = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5, rr = i % 2 ? 0.17 : 0.5
    i ? sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.035, bevelSegments: 2 }).rotateX(-Math.PI / 2)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + 0.1 * Math.max(0, 1 - Math.hypot(p.getX(i), p.getZ(i)) / 0.5))
  g.computeVertexNormals()
  return g
}

function abaloneGeo() {
  const g = new THREE.SphereGeometry(0.5, 24, 14).scale(0.9, 0.38, 0.65)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), ang = Math.atan2(z, x)
    p.setXYZ(i, x * (1 + 0.04 * Math.cos(ang * 10)), Math.max(0, p.getY(i)) * (1 + 0.1 * Math.cos(ang * 10)), z + (x > 0 ? 0 : x * 0.15 * 0)) // flat underside, ridged back
  }
  g.computeVertexNormals()
  return g
}

function scallopGeo() {
  const g = new THREE.SphereGeometry(0.5, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.3, 0.92)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const k = Math.cos(Math.atan2(p.getZ(i), p.getX(i)) * 12)
    p.setXYZ(i, p.getX(i) * (1 + 0.035 * k), p.getY(i) * (1 + 0.15 * k), p.getZ(i) * (1 + 0.035 * k))
  }
  g.computeVertexNormals()
  return g
}

function anemoneGeo() {
  const parts: THREE.BufferGeometry[] = []
  const paint = (g: THREE.BufferGeometry, lo: number, hi: number, h: number) => {
    const p = g.attributes.position
    const col = new Float32Array(p.count * 3)
    for (let i = 0; i < p.count; i++) col.fill(lerp(lo, hi, Math.min(1, p.getY(i) / h)), i * 3, i * 3 + 3)
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }
  const col = new THREE.CylinderGeometry(0.11, 0.14, 0.16, 12).translate(0, 0.08, 0)
  parts.push(paint(col, 0.55, 0.7, 0.16))
  ;[[0.04, 8, 0.15], [0.1, 16, 0.4], [0.17, 24, 0.75]].forEach(([rad, n, lean], ring) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring
      const t = new THREE.ConeGeometry(0.02, 0.3, 5).translate(0, 0.15, 0).rotateZ(-lean).rotateY(-a).translate(Math.cos(a) * rad, 0.14, Math.sin(a) * rad)
      parts.push(paint(t, 0.7, 1.15, 0.45))
    }
  })
  return mergeGeometries(parts.map(ni))!
}
const ANEMONE_SWAY = /* glsl */ `
  float aphs = dot(instanceMatrix[3].xz, vec2(0.2, 0.15)) - uTime * 0.8;
  float ah = max(transformed.y - 0.14, 0.0);
  vec3 adisp = vec3(0.8, 0.0, 0.6) * (sin(aphs) * 0.3 + 0.1) * ah;
  transformed += inverse(mat3(instanceMatrix)) * adisp;
`

function surfgrassGeo() {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 7; i++) {
    const g = new THREE.PlaneGeometry(0.06, 1.2, 1, 6).translate(0, 0.6, 0)
    const p = g.attributes.position
    const col = new Float32Array(p.count * 3)
    for (let v = 0; v < p.count; v++) {
      p.setX(v, p.getX(v) * (1 - (p.getY(v) / 1.2) * 0.7))
      col.set([0.18 + 0.12 * (p.getY(v) / 1.2), 0.5 + 0.2 * (p.getY(v) / 1.2), 0.2], v * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    parts.push(g.rotateZ(0.12 + (i % 3) * 0.1).rotateY(i * 0.9))
  }
  return mergeGeometries(parts)!
}
// Same swell as the kelp so the whole reef moves together.
const GRASS_SWAY = /* glsl */ `
  vec2 gwd = vec2(0.8, 0.6);
  float gphs = dot(instanceMatrix[3].xz, gwd) * 0.25 - uTime * 0.8;
  vec3 gdisp = vec3(gwd.x, 0.0, gwd.y) * (sin(gphs) * 0.35 + 0.1) * transformed.y;
  transformed += inverse(mat3(instanceMatrix)) * gdisp;
`

function urchinGeo() {
  const parts: THREE.BufferGeometry[] = [new THREE.SphereGeometry(0.32, 10, 8).toNonIndexed()]
  const q = new THREE.Quaternion(), m = new THREE.Matrix4()
  for (let i = 0; i < 46; i++) {
    const y = 1 - (i / 45) * 2, rr = Math.sqrt(1 - y * y), a = i * 2.39996
    const d = new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr)
    q.setFromUnitVectors(UP, d)
    parts.push(new THREE.ConeGeometry(0.018, 0.34, 4).translate(0, 0.17, 0).applyMatrix4(m.compose(d.clone().multiplyScalar(0.28), q, new THREE.Vector3(1, 1, 1))).toNonIndexed())
  }
  return mergeGeometries(parts)!.translate(0, 0.3, 0)
}

/** Rocky-reef bottom life: anemones, sea stars, abalone, urchins, mussels, barnacles, scallops, surfgrass, cobble. */
export function Benthos() {
  const k = TIERS[useStore((s) => effectiveTier(s))].fish
  const group = useMemo(() => {
    const r = mulberry32(21)
    const near = BOULDERS.filter((b) => Math.abs(b.x) < 30 && b.z > -14)
    const rock = (minUp: number) => onBoulder(pick(r, near), r, minUp)
    const n = (base: number) => Math.round(base * k)
    const g = new THREE.Group()
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, spots: Parameters<typeof populate>[1]) => {
      g.add(populate(new THREE.InstancedMesh(geo, m, spots.length), spots))
    }

    add(seaStarGeo(), mat(0.85), Array.from({ length: n(55) }, () => ({
      spot: r() < 0.6 ? rock(0.05) : onSand(r),
      s: lerp(0.6, 1.3, r()),
      color: pick(r, ['#e0702a', '#8a4d96', '#c23b2e', '#d9a066', '#e88a3a']),
    })))
    add(abaloneGeo(), mat(0.4), Array.from({ length: n(26) }, () => ({
      spot: rock(0.05), s: lerp(0.35, 0.55, r()), color: pick(r, ['#8a3b2a', '#7a4030', '#9a5a3c']),
    })))
    add(scallopGeo(), mat(0.6, undefined, THREE.DoubleSide), Array.from({ length: n(34) }, () => ({
      spot: onSand(r), s: lerp(0.22, 0.36, r()), color: pick(r, ['#e8a48a', '#d9b48c', '#c98a6a', '#e6c9a8']),
    })))
    add(anemoneGeo(), mat(0.6, ANEMONE_SWAY), Array.from({ length: n(46) }, () => ({
      spot: r() < 0.75 ? rock(0.15) : onSand(r),
      s: lerp(1.4, 2.6, r()),
      color: pick(r, ['#58b36a', '#4fa86a', '#ecc9c8', '#e6a9b4', '#a8d98a']),
    })))

    // Mussel beds and barnacle patches in tight clusters on rock.
    const mussels: Parameters<typeof populate>[1] = []
    const barn: Parameters<typeof populate>[1] = []
    for (let c = 0; c < n(22); c++) {
      const b = pick(r, near)
      const base = onBoulder(b, r, 0.2)
      for (let i = 0; i < 12; i++) {
        const s = onBoulder({ ...b, s: b.s }, r, 0.2)
        s.p.lerp(base.p, 0.8 + r() * 0.15)
        mussels.push({ spot: { p: s.p, n: base.n }, s: lerp(0.15, 0.25, r()), color: pick(r, ['#1b2740', '#232f4a', '#2a2c3a']) })
      }
      for (let i = 0; i < 10; i++) {
        const s = onBoulder(b, r, 0.2)
        s.p.lerp(base.p, 0.7 + r() * 0.2)
        barn.push({ spot: { p: s.p, n: base.n }, s: lerp(0.06, 0.1, r()), color: pick(r, ['#c9c6b8', '#b5b3a6']) })
      }
    }
    add(urchinGeo(), mat(0.7), Array.from({ length: n(40) }, () => ({
      spot: r() < 0.7 ? rock(0.05) : onSand(r), s: lerp(0.3, 0.5, r()), color: pick(r, ['#6a2c8f', '#7b3a9a', '#5c2a80', '#a83232']),
    })))
    // Surfgrass tufts around the base of reef boulders and across the sand.
    const grass = Array.from({ length: n(170) }, () => {
      const b = pick(r, near), a = r() * 6.283, dist = b.s * (0.9 + r() * 1.3)
      const x = r() < 0.7 ? b.x + Math.cos(a) * dist : (r() - 0.5) * 40
      const z = r() < 0.7 ? b.z + Math.sin(a) * dist : 12 - r() * 22
      return { spot: { p: new THREE.Vector3(x, seabedHeight(x, z) - 0.05, z), n: UP.clone() }, s: lerp(0.7, 1.6, r()), color: pick(r, ['#ffffff', '#e8f5e0', '#d4ecc8']) }
    })
    add(surfgrassGeo(), withCaustics(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6 }), { caustics: 0.5, vertex: GRASS_SWAY }), grass)
    // Cobble and gravel between the boulders.
    const rocks = ['#4a5a58', '#56605a', '#5e5450', '#6a6a5c', '#7a5a66']
    add(new THREE.IcosahedronGeometry(1, 1).scale(1, 0.6, 0.85), mat(0.95), Array.from({ length: n(300) }, () => {
      const x = (r() - 0.5) * 44, z = 12 - r() * 34, s = lerp(0.06, 0.32, r() * r())
      return { spot: { p: new THREE.Vector3(x, seabedHeight(x, z) + s * 0.1, z), n: UP.clone() }, s, color: pick(r, rocks) }
    }))
    add(ni(new THREE.SphereGeometry(0.5, 10, 8).scale(0.42, 0.36, 1).translate(0, 0.04, 0)), mat(0.35), mussels)
    add(new THREE.ConeGeometry(0.5, 0.7, 7).translate(0, 0.25, 0), mat(0.95), barn)
    return g
  }, [k])
  return <primitive object={group} />
}
