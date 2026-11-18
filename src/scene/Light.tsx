import { useMemo } from 'react'
import * as THREE from 'three'
import { useStore, effectiveTier } from '../state/store'
import { TIERS } from '../config/quality'
import { FOG, SURFACE_Y, U } from './caustics'
import { mulberry32 } from '../sim/sim'

const surfaceMat = new THREE.ShaderMaterial({
  uniforms: { ...U, uFog: { value: new THREE.Color(FOG).lerp(new THREE.Color('#5fc4c8'), 0.35) } },
  side: THREE.DoubleSide,
  vertexShader: /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: /* glsl */ `
    uniform float uTime; uniform vec3 uFog; varying vec3 vW;
    float wave(vec2 p, float t){ return sin(p.x*.9+t*1.1)*.5 + sin(p.y*1.3-t*.8+p.x*.4)*.35 + sin((p.x+p.y)*2.1+t*1.9)*.15; }
    void main(){
      vec2 p = vW.xz * 0.25;
      float e = 0.02;
      vec2 n = vec2(wave(p+vec2(e,0.),uTime)-wave(p-vec2(e,0.),uTime), wave(p+vec2(0.,e),uTime)-wave(p-vec2(0.,e),uTime)) / (2.*e);
      float glint = pow(clamp(1. - length(n)*.45, 0., 1.), 3.);
      vec3 col = mix(vec3(.25,.75,.8), vec3(.85,1.,.95), glint);
      float d = length(vW - cameraPosition);
      gl_FragColor = vec4(mix(col, uFog, 1. - exp(-pow(d * 0.011, 2.))), 1.);
    }`,
})

function Surface() {
  return (
    <mesh position={[0, SURFACE_Y, -60]} rotation={[Math.PI / 2, 0, 0]} material={surfaceMat}>
      <planeGeometry args={[2400, 2000]} />
    </mesh>
  )
}

function Rays() {
  const rays = useMemo(() => {
    const r = mulberry32(3)
    return Array.from({ length: 16 }, () => ({
      x: (r() - 0.5) * 110,
      z: -r() * 55 + 4,
      w: 3 + r() * 7,
      phase: r() * 10,
      mat: new THREE.ShaderMaterial({
        uniforms: { ...U, uPhase: { value: r() * 10 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime, uPhase; varying vec2 vUv;
          void main(){
            float edge = 1. - abs(vUv.x * 2. - 1.);
            float a = smoothstep(0., 1., vUv.y) * pow(edge, 1.5);
            a *= .55 + .45 * sin(uTime * .45 + uPhase + vUv.y * 3.);
            gl_FragColor = vec4(vec3(.55, 1., .85) * a * .16, 1.);
          }`,
      }),
    }))
  }, [])
  return (
    <>
      {rays.map((r, i) => (
        <mesh key={i} position={[r.x, SURFACE_Y, r.z]} rotation={[0, 0.4, 0.22]} material={r.mat}>
          <planeGeometry args={[r.w, 42]} onUpdate={(g) => g.translate(0, -21, 0)} />
        </mesh>
      ))}
    </>
  )
}

function Snow() {
  const n = TIERS[useStore((s) => effectiveTier(s))].snow
  const geo = useMemo(() => {
    const r = mulberry32(8)
    const a = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) a.set([(r() - 0.5) * 90, r() * SURFACE_Y, 18 - r() * 60], i * 3)
    return new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(a, 3))
  }, [n])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: U,
        transparent: true,
        depthWrite: false,
        vertexShader: /* glsl */ `
          uniform float uTime;
          void main(){
            vec3 p = position;
            p.y = mod(p.y - uTime * .15, ${SURFACE_Y.toFixed(1)});
            p.x += sin(uTime * .2 + p.z) * .6;
            vec4 mv = modelViewMatrix * vec4(p, 1.);
            gl_PointSize = clamp(28. / -mv.z, 1., 4.);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `void main(){ gl_FragColor = vec4(.8, 1., .95, .35); }`,
      }),
    [],
  )
  return <points geometry={geo} material={mat} frustumCulled={false} />
}

export function Light() {
  return (
    <>
      <hemisphereLight args={['#9ff2e8', '#10353c', 0.9]} />
      <directionalLight position={[8, 30, 4]} intensity={1.6} color="#d8fff0" />
      <Surface />
      <Rays />
      <Snow />
    </>
  )
}
