# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Projection-mapped sea life: a full-window React Three Fiber scene of a Northern California kelp forest, with a React Spectrum (S2) control overlay.

## Commands

- `npm run dev` — Vite dev server (add `?autostart=1` to skip the audio-unlock screen, `?ui=0` to hide controls, `?slice=i/n` for multi-window mapping)
- `npm run build` — `tsc --noEmit` then `vite build`; `npm run typecheck` for types only
- No test or lint setup yet. Verify visually in a browser.

## Architecture

- **Rendering is owned by `src/render/Compositor.tsx`** (a priority-1 `useFrame`, `gl.autoClear=false`). It renders the same scene once per view of the chosen surface preset (`src/config/surfaces.ts`) using scissor/viewports, then either outputs directly (pass-through for an external mapper), runs a homography corner-pin + edge-blend pass (`warp`, `render/homography.ts`), or offsets the camera frustum for a window slice (`multiWindow`). The Canvas's default camera is unused.
- **Shared clock**: all animation derives from `simTime()` (wall clock, `src/sim/sim.ts`). Events come from `eventForSlot()` in `src/sim/events.ts`, a seeded per-30s-slot generator, so separate browser windows stay in sync with no networking. `Scheduler` (in `scene/World.tsx`) emits events on a tiny bus; `Schools`/`Mammals` mount per event via `useSeaEvents`; marine mammals (`sim/mammals.ts` registry) share one 90s lane so only one species is on stage at a time, and `audio/AudioEngine` subscribes to the same bus.
- **Lighting**: `scene/caustics.ts` `withCaustics()` patches any MeshStandardMaterial via `onBeforeCompile` (analytic wave-focusing caustics from world position + optional vertex animation snippet). All materials share the `U.uTime` uniform.
- **Audio is fully procedural** (Web Audio synthesis), so there are no sample files or licenses to track.
- **State**: `state/store.ts` (zustand, persisted subset in localStorage). Quality tiers in `config/quality.ts`; `quality: 'auto'` is downgraded by drei `PerformanceMonitor`.
- Vite config needs `unplugin-parcel-macros` for React Spectrum S2.

## Deployment

Static site on GitHub Pages (https://zrecore.github.io/immersive-sea-life/). `.github/workflows/deploy.yml` builds and publishes `dist/` on every push to `main`; Vite `base` is `./` so the build works from a subpath. Pages source is set to "GitHub Actions" in repo settings.

## Verifying visually

Project skills in `.claude/skills/`: `verify-scene` (headless screenshot, with `--mammal`/`--school` triggers) and `add-marine-mammal` (registry-driven species). The notes below are the details behind `verify-scene`.

There is no test suite. To check rendering headlessly, use `playwright-core` (installed outside the repo) with `channel: 'chrome'` and args `--use-angle=swiftshader --enable-unsafe-swiftshader`; it runs on software WebGL, so it validates correctness, not frame rate. Dev events can be triggered by importing the app's own module URLs from `performance.getEntriesByType('resource')` (a plain `import('/src/...')` yields a second module instance), then calling `emit()` from `sim/events.ts`.

## Conventions

- MIT licensed; keep shaders original (no copied Shadertoy code, whose default license is non-commercial).
- Audio stays procedural; any added recordings need their license recorded.
