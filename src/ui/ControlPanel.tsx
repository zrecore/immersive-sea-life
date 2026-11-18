import { useState } from 'react'
import { ActionButton, Button, NumberField, Picker, PickerItem, Slider, Switch } from '@react-spectrum/s2'
import { useStore, DEFAULT_CORNERS, type Quality } from '../state/store'
import { SURFACES, type SurfaceId } from '../config/surfaces'
import { MAPPING_LABELS, type MappingMode } from '../config/mapping'
import { emit, PASS_SPECIES, type SeaEvent } from '../sim/events'
import { MAMMALS, MAMMAL_IDS } from '../sim/mammals'
import { simTime } from '../sim/sim'

let n = 0
const trigger = (kind: SeaEvent['kind'], species: string) => {
  const m = kind === 'mammal' ? MAMMALS[species] : null
  // Mammal passes start part-way across so the animal is on screen right away.
  const dur = m ? m.dur[0] : 22
  const lead = m ? (dur * (m.span > 150 ? 0.35 : 0.2)) : 0
  emit({ id: `dev${n++}`, kind, species, t0: simTime() - lead, dur, dir: Math.random() < 0.5 ? 1 : -1, y: m ? (m.y[0] + m.y[1]) / 2 : 8, z: m ? (m.z[0] + m.z[1]) / 2 : -12, seed: n, replace: kind === 'mammal' })
}

export function ControlPanel() {
  const s = useStore()
  const [open, setOpen] = useState(false)
  const [mammal, setMammal] = useState('gray')
  const toggleFullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())

  return (
    <>
      <ActionButton onPress={() => setOpen(!open)}>{open ? 'Close' : 'Controls'}</ActionButton>
      {open && (
        <div className="panel">
          <Picker label="Projection surface" selectedKey={s.surface} onSelectionChange={(k) => s.set({ surface: k as SurfaceId })}>
            {(Object.keys(SURFACES) as SurfaceId[]).map((k) => (
              <PickerItem key={k} id={k}>{SURFACES[k].label}</PickerItem>
            ))}
          </Picker>
          <Picker label="Mapping" selectedKey={s.mapping} onSelectionChange={(k) => s.set({ mapping: k as MappingMode, calibrate: false })}>
            {(Object.keys(MAPPING_LABELS) as MappingMode[]).map((k) => (
              <PickerItem key={k} id={k}>{MAPPING_LABELS[k]}</PickerItem>
            ))}
          </Picker>
          {s.mapping === 'warp' && (
            <>
              <Switch isSelected={s.calibrate} onChange={(v) => s.set({ calibrate: v })}>Calibrate (grid + corners)</Switch>
              <Slider label="Edge blend" minValue={0} maxValue={0.4} step={0.01} value={s.blend} onChange={(v) => s.set({ blend: v })} />
              <Button variant="secondary" onPress={() => s.set({ corners: DEFAULT_CORNERS })}>Reset corners</Button>
            </>
          )}
          {s.mapping === 'multiWindow' && (
            <div className="row">
              <NumberField label="Window #" minValue={0} value={s.slice.i} onChange={(i) => s.set({ slice: { ...s.slice, i: Math.min(i, s.slice.n - 1) } })} />
              <NumberField label="Of" minValue={1} value={s.slice.n} onChange={(n) => s.set({ slice: { n, i: Math.min(s.slice.i, n - 1) } })} />
            </div>
          )}
          <Picker label="Quality" selectedKey={s.quality} onSelectionChange={(k) => s.set({ quality: k as Quality })}>
            {['auto', 'low', 'medium', 'high'].map((k) => (
              <PickerItem key={k} id={k}>{k}</PickerItem>
            ))}
          </Picker>
          <Slider label="Volume" minValue={0} maxValue={1} step={0.05} value={s.volume} onChange={(v) => s.set({ volume: v })} />
          <Switch isSelected={s.muted} onChange={(v) => s.set({ muted: v })}>Mute</Switch>
          <Picker label="Marine mammal" selectedKey={mammal} onSelectionChange={(k) => setMammal(String(k))}>
            {MAMMAL_IDS.map((k) => (
              <PickerItem key={k} id={k}>{MAMMALS[k].label}</PickerItem>
            ))}
          </Picker>
          <div className="row">
            <Button variant="secondary" onPress={() => trigger('mammal', mammal)}>Show mammal</Button>
            {PASS_SPECIES.map((k) => (
              <Button key={k} variant="secondary" onPress={() => trigger('school', k)}>{k}</Button>
            ))}
          </div>
          <Button variant="accent" onPress={toggleFullscreen}>Toggle fullscreen</Button>
          <Button variant="negative" onPress={s.reset}>Reset all settings to defaults</Button>
        </div>
      )}
    </>
  )
}
