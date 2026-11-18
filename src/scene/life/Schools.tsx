import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useStore, effectiveTier } from '../../state/store'
import { TIERS } from '../../config/quality'
import { mulberry32, simTime } from '../../sim/sim'
import { useSeaEvents, type SeaEvent } from '../../sim/events'
import { withCaustics } from '../caustics'

type Species = { count: number; size: number; color: string; spread: [number, number, number]; swirl: number }
export const SPECIES: Record<string, Species> = {
  anchovy: { count: 380, size: 0.28, color: '#9fb8c4', spread: [3.2, 2.4, 3.2], swirl: 0.5 }, // tight bait ball
  sardine: { count: 240, size: 0.4, color: '#aab6b0', spread: [9, 1.6, 2.2], swirl: 0.12 }, // long ribbon
  herring: { count: 200, size: 0.45, color: '#8fa7a0', spread: [5, 2.5, 3.5], swirl: 0.25 },
  rockfish: { count: 45, size: 0.55, color: '#5d6f8f', spread: [4, 2.5, 4], swirl: 0.18 }, // resident blue rockfish
}

// Fish are 2 long along z (nose +z); tail wag grows toward the tail.
const WIGGLE = /* glsl */ `
  float k = smoothstep(0.1, -1.0, transformed.z);
  transformed.x += sin(uTime * 9.0 + float(gl_InstanceID) * 1.7 + transformed.z * 3.0) * 0.3 * k;
`
let fishGeo: THREE.BufferGeometry | undefined
function fishGeometry() {
  if (!fishGeo) {
    const body = new THREE.SphereGeometry(0.5, 10, 8).scale(0.45, 0.8, 2).toNonIndexed()
    const tail = new THREE.ConeGeometry(0.6, 0.7, 3).rotateX(-Math.PI / 2).scale(0.12, 1, 1).translate(0, 0, -1.2).toNonIndexed()
    fishGeo = mergeGeometries([body, tail])!
  }
  return fishGeo
}

type Props = { sp: Species; centerAt: (t: number) => THREE.Vector3Like; seed: number }

function School({ sp, centerAt, seed }: Props) {
  const mult = TIERS[useStore((s) => effectiveTier(s))].fish
  const n = Math.max(8, Math.round(sp.count * mult))
  const ref = useRef<THREE.InstancedMesh>(null)
  const material = useMemo(
    () => withCaustics(new THREE.MeshStandardMaterial({ color: sp.color, emissive: sp.color, emissiveIntensity: 0.25, roughness: 0.4, metalness: 0.3 }), { caustics: 0.6, vertex: WIGGLE }),
    [sp.color],
  )
  const fish = useMemo(() => {
    const r = mulberry32(seed + 1)
    const g = () => (r() + r() + r() - 1.5) / 1.5
    return Array.from({ length: n }, () => ({ o: [g() * sp.spread[0], g() * sp.spread[1], g() * sp.spread[2]], ph: r() * 6.28, sc: 0.75 + r() * 0.5, sw: 0.5 + r() }))
  }, [n, seed, sp])
  const d = useMemo(() => new THREE.Object3D(), [])
  const a = useMemo(() => new THREE.Vector3(), [])
  const b = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const m = ref.current
    if (!m) return
    const t = simTime()
    const place = (f: (typeof fish)[number], tt: number, out: THREE.Vector3) => {
      const c = centerAt(tt)
      const ang = tt * sp.swirl * f.sw + f.ph
      const bre = 1 + 0.2 * Math.sin(tt * 0.8 + f.ph)
      const [ox, oy, oz] = f.o
      const cx = Math.cos(ang), sx = Math.sin(ang)
      out.set(c.x + (ox * cx - oz * sx) * bre, c.y + oy * bre + Math.sin(tt * 1.3 + f.ph) * 0.3, c.z + (ox * sx + oz * cx) * bre)
    }
    fish.forEach((f, i) => {
      place(f, t, a)
      place(f, t + 0.15, b)
      d.position.copy(a)
      d.lookAt(b)
      d.scale.setScalar(sp.size * f.sc)
      d.updateMatrix()
      m.setMatrixAt(i, d.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh key={n} ref={ref} args={[fishGeometry(), material, n]} frustumCulled={false} />
}

function Pass({ ev }: { ev: SeaEvent }) {
  const centerAt = useMemo(() => {
    const c = new THREE.Vector3()
    return (t: number) => {
      const p = (t - ev.t0) / ev.dur
      return c.set(ev.dir * (-85 + 170 * p), ev.y + Math.sin(t * 0.4 + ev.seed) * 1.5, ev.z + Math.sin(t * 0.25 + ev.seed) * 4)
    }
  }, [ev])
  const sp = SPECIES[ev.species]
  const alive = useAlive(ev)
  return alive ? <School sp={sp} centerAt={centerAt} seed={ev.seed} /> : null
}

/** Only render while the pass is in progress. */
function useAlive(ev: SeaEvent) {
  const [alive, setAlive] = useState(simTime() >= ev.t0)
  useEffect(() => {
    const iv = setInterval(() => setAlive(simTime() >= ev.t0 && simTime() < ev.t0 + ev.dur), 500)
    return () => clearInterval(iv)
  }, [ev])
  return alive
}

export function Schools() {
  const events = useSeaEvents('school')
  const resident = useMemo(() => {
    const c = new THREE.Vector3()
    return (t: number) => c.set(-14 + Math.sin(t * 0.08) * 8, 6 + Math.sin(t * 0.13) * 1.5, -9 + Math.cos(t * 0.08) * 5)
  }, [])
  return (
    <>
      <School sp={SPECIES.rockfish} centerAt={resident} seed={99} />
      {events.map((e) => (
        <Pass key={e.id} ev={e} />
      ))}
    </>
  )
}
