import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { simTime } from '../sim/sim'
import { emit, eventForSlot, mammalForSlot, MSLOT, SLOT } from '../sim/events'
import { FOG, U } from './caustics'
import { Seabed } from './Seabed'
import { Kelp } from './Kelp'
import { Benthos } from './Benthos'
import { Light } from './Light'
import { Schools } from './life/Schools'
import { Mammals } from './life/Mammals'

function Scheduler() {
  const seen = useRef(new Set<number>()).current
  const seenM = useRef(new Set<number>()).current
  useFrame(() => {
    const now = simTime()
    for (let s = Math.floor((now - 60) / SLOT); s <= Math.floor(now / SLOT); s++) {
      if (seen.has(s)) continue
      seen.add(s)
      const ev = eventForSlot(s)
      if (ev && ev.t0 + ev.dur > now) emit(ev)
    }
    for (let s = Math.floor((now - 90) / MSLOT); s <= Math.floor(now / MSLOT); s++) {
      if (seenM.has(s)) continue
      seenM.add(s)
      const ev = mammalForSlot(s)
      if (ev && ev.t0 + ev.dur > now) emit(ev)
    }
  })
  return null
}

export function World() {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    scene.fog = new THREE.FogExp2(FOG, 0.027)
  }, [scene])
  useFrame(() => {
    U.uTime.value = simTime()
  })
  return (
    <>
      <Light />
      <Seabed />
      <Kelp />
      <Benthos />
      <Schools />
      <Mammals />
      <Scheduler />
    </>
  )
}
