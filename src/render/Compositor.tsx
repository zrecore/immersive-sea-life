import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../state/store'
import { SURFACES } from '../config/surfaces'
import { simTime } from '../sim/sim'
import { FOG } from '../scene/caustics'
import { cornersToMatrix } from './homography'

const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
const fovFor = (aspect: number) =>
  aspect >= 1 ? Math.min(55, deg(2 * Math.atan(Math.tan(rad(55)) / aspect))) : Math.min(85, deg(2 * Math.atan(Math.tan(rad(31)) / aspect)))

function makeWarp() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { tMap: { value: null }, uM: { value: new THREE.Matrix3() }, uBlend: { value: 0 }, uGrid: { value: 0 } },
    depthTest: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tMap; uniform mat3 uM; uniform float uBlend, uGrid; varying vec2 vUv;
      void main(){
        vec3 q = uM * vec3(vUv, 1.);
        vec2 s = q.xy / q.z;
        vec3 c = vec3(0.);
        if (s.x >= 0. && s.x <= 1. && s.y >= 0. && s.y <= 1.) {
          c = texture2D(tMap, s).rgb;
          if (uBlend > 0.) c *= smoothstep(0., uBlend, s.x) * smoothstep(0., uBlend, 1. - s.x); // ramp in linear light
          if (uGrid > .5) {
            vec2 g = abs(fract(s * 10. - .5) - .5) / fwidth(s * 10.);
            c = mix(c, vec3(1., .25, .25), 1. - min(min(g.x, g.y), 1.));
          }
        }
        gl_FragColor = vec4(c, 1.);
        #include <colorspace_fragment>
      }`,
  })
  const scene = new THREE.Scene()
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
  quad.frustumCulled = false
  scene.add(quad)
  return { scene, cam: new THREE.Camera(), mat }
}

/** Takes over rendering: draws each surface view into its viewport, then optionally warps/blends. */
export function Compositor() {
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const cams = useMemo(() => [0, 1, 2].map(() => new THREE.PerspectiveCamera(55, 1, 0.1, 400)), [])
  const warp = useMemo(makeWarp, [])
  const rt = useRef<THREE.WebGLRenderTarget | null>(null)

  useEffect(() => {
    gl.autoClear = false
    return () => {
      gl.autoClear = true
      rt.current?.dispose()
    }
  }, [gl])

  useFrame(({ scene }) => {
    const st = useStore.getState()
    const t = simTime()
    const w = size.width, h = size.height
    const useWarp = st.mapping === 'warp'
    const slice = st.mapping === 'multiWindow' ? st.slice : null

    let target: THREE.WebGLRenderTarget | null = null
    if (useWarp) {
      const pr = gl.getPixelRatio()
      const pw = Math.round(w * pr), ph = Math.round(h * pr)
      if (!rt.current || rt.current.width !== pw || rt.current.height !== ph) {
        rt.current?.dispose()
        rt.current = new THREE.WebGLRenderTarget(pw, ph, { type: THREE.HalfFloatType, samples: 4 })
      }
      target = rt.current
    }

    gl.setRenderTarget(target)
    gl.setScissorTest(false)
    gl.setViewport(0, 0, w, h)
    gl.setClearColor(FOG)
    gl.clear()
    gl.setScissorTest(true)

    SURFACES[st.surface].views.forEach((v, i) => {
      const cam = cams[i]
      const vx = v.x * w, vy = v.y * h, vw = v.w * w, vh = v.h * h
      const aspect = vw / vh
      cam.position.set(v.pos?.[0] ?? Math.sin(t * 0.04) * 4, v.pos?.[1] ?? 4 + Math.sin(t * 0.07) * 0.4, v.pos?.[2] ?? 16)
      cam.rotation.set(v.pitch + Math.sin(t * 0.05) * 0.01, v.yaw, 0, 'YXZ')
      cam.fov = v.hfov ? deg(2 * Math.atan(Math.tan(rad(v.hfov / 2)) / aspect)) : fovFor(slice ? aspect * slice.n : aspect)
      if (slice) {
        cam.aspect = aspect * slice.n
        cam.setViewOffset(vw * slice.n, vh, vw * slice.i, 0, vw, vh)
      } else {
        cam.aspect = aspect
        cam.clearViewOffset()
      }
      cam.updateProjectionMatrix()
      gl.setViewport(vx, vy, vw, vh)
      gl.setScissor(vx, vy, vw, vh)
      gl.render(scene, cam)
    })
    gl.setScissorTest(false)

    if (useWarp && target) {
      gl.setRenderTarget(null)
      gl.setViewport(0, 0, w, h)
      gl.clear()
      warp.mat.uniforms.tMap.value = target.texture
      warp.mat.uniforms.uM.value.copy(cornersToMatrix(st.corners))
      warp.mat.uniforms.uBlend.value = st.blend
      warp.mat.uniforms.uGrid.value = st.calibrate ? 1 : 0
      gl.render(warp.scene, warp.cam)
    }
  }, 1)
  return null
}
