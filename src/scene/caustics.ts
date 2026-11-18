import * as THREE from 'three'

export const FOG = '#0a5266'
export const SURFACE_Y = 26
export const U = { uTime: { value: 0 } }

// Analytic caustics from a sum of travelling surface waves. Light refracted through a height field h
// maps a seabed point p to p + D·∇h; the light density there is 1 / |det(I + D·Hess h)|, which spikes
// into bright filaments wherever the mapping folds (det -> 0). Hess h is a closed-form sum over waves.
const CAUSTIC = /* glsl */ `
// Returns det(I + D·Hess h): ~1 on calm water, -> 0 where light focuses.
float causticDet(vec2 p, float time) {
  float hxx = 0.0, hyy = 0.0, hxy = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float ang = 6.2831853 * fract(fi * 0.381966 + 0.13); // well-spread wave directions
    vec2 d = vec2(cos(ang), sin(ang));
    float k = 2.0 + fi * 0.9;                            // wavenumber
    float w = 0.8 + fi * 0.35;                           // angular speed
    float q = 0.75 / (1.0 + 0.15 * fi);                   // curvature strength of this wave
    float s = sin(k * dot(d, p) - w * time + fi * 1.7);
    hxx -= q * d.x * d.x * s;
    hyy -= q * d.y * d.y * s;
    hxy -= q * d.x * d.y * s;
  }
  return (1.0 + hxx) * (1.0 + hyy) - hxy * hxy;
}`

type Opts = { caustics?: number; vertexDecl?: string; vertex?: string }

/** Adds surface-filtered caustic light (and optional vertex animation) to a standard material. */
export function withCaustics<T extends THREE.Material>(mat: T, o: Opts = {}): T {
  const k = (o.caustics ?? 1).toFixed(2)
  mat.onBeforeCompile = (s) => {
    s.uniforms.uTime = U.uTime
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\nvarying vec3 vWPos;\n${o.vertexDecl ?? ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${o.vertex ?? ''}`)
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 wq = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
        wq = instanceMatrix * wq;
        #endif
        vWPos = (modelMatrix * wq).xyz;`,
      )
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\nvarying vec3 vWPos;\n${CAUSTIC}`)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float cdet = causticDet(vWPos.xz * 0.9 + vec2(vWPos.y * 0.08), uTime * 0.35);
        float cfade = exp(-length(vWPos - cameraPosition) * 0.02); // avoids shimmer at distance
        float cbroad = 0.9 / (abs(cdet) + 0.9);                     // wide pools of light and shade
        float cline = pow(0.25 / (abs(cdet) + 0.25), 1.5);          // bright focused folds
        diffuseColor.rgb *= mix(1.0, 0.5 + 0.7 * cbroad, min(${k}, 1.0) * cfade);
        totalEmissiveRadiance += diffuseColor.rgb * cline * cfade * ${k} * exp(-max(vWPos.y, 0.0) * 0.07) * vec3(0.8, 1.0, 0.9);`,
      )
  }
  mat.customProgramCacheKey = () => `caustic${k}${o.vertex ?? ''}`
  return mat
}
