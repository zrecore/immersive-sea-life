import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { Button, Provider } from '@react-spectrum/s2'
import { useStore, effectiveTier } from './state/store'
import { TIERS } from './config/quality'
import { World } from './scene/World'
import { Compositor } from './render/Compositor'
import { ControlPanel } from './ui/ControlPanel'
import { Calibration } from './ui/Calibration'
import { audio } from './audio/AudioEngine'
import { subscribe } from './sim/events'

export function App() {
  const started = useStore((s) => s.started)
  const mapping = useStore((s) => s.mapping)
  const calibrate = useStore((s) => s.calibrate)
  const volume = useStore((s) => s.volume)
  const muted = useStore((s) => s.muted)
  const tier = useStore((s) => effectiveTier(s))
  const set = useStore((s) => s.set)
  const [idle, setIdle] = useState(false)
  const hideUi = new URLSearchParams(location.search).get('ui') === '0'

  useEffect(() => subscribe(audio.onEvent), [])
  useEffect(() => audio.setVolume(volume, muted), [volume, muted])

  // Auto-hide controls and cursor after inactivity (projection use).
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const wake = () => {
      setIdle(false)
      clearTimeout(t)
      t = setTimeout(() => setIdle(true), 4000)
    }
    wake()
    for (const ev of ['pointermove', 'pointerdown', 'keydown']) addEventListener(ev, wake)
    return () => {
      clearTimeout(t)
      for (const ev of ['pointermove', 'pointerdown', 'keydown']) removeEventListener(ev, wake)
    }
  }, [])

  const enter = () => {
    set({ started: true })
    void audio.start()
  }

  return (
    <Provider colorScheme="dark">
      <div className={`stage${idle ? ' idle' : ''}`}>
        <Canvas flat dpr={[1, TIERS[tier].dpr]} gl={{ antialias: true, powerPreference: 'high-performance' }}>
          <PerformanceMonitor
            onDecline={() => {
              const { quality, autoTier } = useStore.getState()
              if (quality === 'auto') set({ autoTier: autoTier === 'high' ? 'medium' : 'low' })
            }}
          />
          <World />
          <Compositor />
        </Canvas>
      </div>
      {mapping === 'warp' && calibrate && <Calibration />}
      {started && !hideUi && (
        <div className={`panel-wrap${idle && !calibrate ? ' hidden' : ''}`}>
          <ControlPanel />
        </div>
      )}
      {!started && (
        <div className="overlay">
          <h1>Immersive Sea Life</h1>
          <p>A kelp forest off the Northern California coast. Sound on, headphones or speakers recommended.</p>
          <Button variant="accent" size="XL" onPress={enter}>Enter the kelp forest</Button>
        </div>
      )}
    </Provider>
  )
}
