import { useMemo } from 'react'
import * as THREE from 'three'
import { useStore, effectiveTier } from '../state/store'
import { TIERS } from '../config/quality'
import { mulberry32 } from '../sim/sim'
import { BOULDERS, fbm, reefAt, seabedHeight } from './terrain'
import { withCaustics } from './caustics'

const SAND = new THREE.Color('#b9a67c')
const ROCK = new THREE.Color('#3b4a4c')
const ALGAE = new THREE.Color('#4d6a45')
// Wet basalt/sandstone greys, rusty iron stain, and pink coralline crust.
const ROCKS = ['#4a5a58', '#56605a', '#5e5450', '#7a5a66', '#44585a', '#6a6a5c']

export function Seabed() {
  const tier = useStore((s) => effectiveTier(s))
  const [sx, sz] = TIERS[tier].seg
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(220, 140, sx, sz)
    g.rotateX(-Math.PI / 2)
    g.translate(0, 0, -40)
    const p = g.attributes.position
    const col = new Float32Array(p.count * 3)
    const c = new THREE.Color()
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i)
      p.setY(i, seabedHeight(x, z))
      const r = Math.min(1, reefAt(x, z) / 3)
      c.copy(SAND).lerp(ALGAE, Math.min(1, fbm(x * 0.2, z * 0.2) * 0.9) * 0.35).lerp(ROCK, r)
      col.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.computeVertexNormals()
    return g
  }, [sx, sz])
  const mat = useMemo(() => withCaustics(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })), [])

  const n = TIERS[tier].boulders
  const boulders = useMemo(() => {
    const r = mulberry32(5)
    const g = new THREE.IcosahedronGeometry(1, 2)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const k = 0.75 + fbm(p.getX(i) * 1.7 + 4, p.getY(i) * 1.7 + p.getZ(i)) * 0.5
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k)
    }
    g.computeVertexNormals()
    const m = new THREE.InstancedMesh(g, withCaustics(new THREE.MeshStandardMaterial({ roughness: 0.95 }), { caustics: 0.8 }), n)
    const d = new THREE.Object3D()
    const col = new THREE.Color()
    BOULDERS.slice(0, n).forEach((b, i) => {
      d.position.set(b.x, b.y, b.z)
      d.rotation.set(r() * 3, r() * 6, r() * 3)
      d.scale.setScalar(b.s)
      d.updateMatrix()
      m.setMatrixAt(i, d.matrix)
      m.setColorAt(i, col.set(ROCKS[Math.floor(r() * ROCKS.length)]))
    })
    return m
  }, [n])

  const spires = useMemo(() => {
    const r = mulberry32(77)
    const g = new THREE.IcosahedronGeometry(1, 3)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const t = (p.getY(i) + 1) / 2
      const k = (1 - 0.5 * t) * (0.75 + fbm(p.getX(i) * 2 + 7, p.getY(i) * 3 + p.getZ(i) * 2) * 0.6)
      p.setXYZ(i, p.getX(i) * k, p.getY(i), p.getZ(i) * k)
    }
    g.computeVertexNormals()
    const m = new THREE.InstancedMesh(g, withCaustics(new THREE.MeshStandardMaterial({ roughness: 0.95 }), { caustics: 0.6 }), 13)
    const d = new THREE.Object3D()
    const col = new THREE.Color()
    for (let i = 0; i < 13; i++) {
      const stack = i >= 10 // tall sea stacks well back from the camera
      let x = (r() - 0.5) * (stack ? 130 : 100)
      if (Math.abs(x) < (stack ? 20 : 12)) x += x < 0 ? -14 : 14
      const z = stack ? -48 - r() * 14 : -16 - r() * 30
      const h = stack ? 8 + r() * 2 : 5 + r() * 8
      d.position.set(x, seabedHeight(x, z) + h * 0.5, z)
      d.rotation.y = r() * 6
      d.scale.set((stack ? 3 : 1.6) + r() * 2.2, h, (stack ? 3 : 1.6) + r() * 2.2)
      d.updateMatrix()
      m.setMatrixAt(i, d.matrix)
      m.setColorAt(i, col.set(ROCKS[Math.floor(r() * ROCKS.length)]))
    }
    return m
  }, [])

  return (
    <>
      <primitive object={spires} />
      <mesh geometry={geo} material={mat} />
      <primitive object={boulders} />
    </>
  )
}
