import type { SeaEvent } from '../sim/events'
import { simTime } from '../sim/sim'
import { MAMMALS, type Sound } from '../sim/mammals'

const rnd = (a: number, b: number) => a + Math.random() * (b - a)

/** Procedural underwater soundscape (no sample licensing): rumble, surface wash, bubbles, whale calls, fish swishes. */
export class AudioEngine {
  private ctx?: AudioContext
  private master!: GainNode
  private bus!: GainNode
  private noise!: AudioBuffer
  private vol = 0.7
  private muted = false
  private timer?: ReturnType<typeof setTimeout>
  private mammalId = ''

  async start() {
    if (this.ctx) return void (await this.ctx.resume())
    const ctx = (this.ctx = new AudioContext())
    this.master = ctx.createGain()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 4200
    this.bus = ctx.createGain()
    const verb = ctx.createConvolver()
    verb.buffer = this.impulse(3.2)
    const wet = ctx.createGain()
    wet.gain.value = 0.4
    this.bus.connect(this.master)
    this.bus.connect(verb).connect(wet).connect(this.master)
    this.master.connect(lp).connect(ctx.destination)
    this.applyVolume()

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 6, ctx.sampleRate)
    const d = this.noise.getChannelData(0)
    let last = 0
    for (let i = 0; i < d.length; i++) d[i] = (last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02) * 3.5

    this.loop(160, 'lowpass', 0.9, 0.07, 70)
    this.loop(520, 'bandpass', 0.07, 0.11, 200)
    this.bubbles()
  }

  private impulse(sec: number) {
    const ctx = this.ctx!
    const b = ctx.createBuffer(2, ctx.sampleRate * sec, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c)
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3)
    }
    return b
  }

  private loop(freq: number, type: BiquadFilterType, gain: number, lfoHz: number, lfoDepth: number) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = 0.4
    const g = ctx.createGain()
    g.gain.value = gain
    const lfo = ctx.createOscillator()
    lfo.frequency.value = lfoHz
    const depth = ctx.createGain()
    depth.gain.value = lfoDepth
    lfo.connect(depth).connect(f.frequency)
    src.connect(f).connect(g).connect(this.bus)
    src.start()
    lfo.start()
  }

  private bubbles() {
    const ctx = this.ctx!
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    const f = rnd(500, 1500)
    o.frequency.setValueAtTime(f, t)
    o.frequency.exponentialRampToValueAtTime(f * 1.8, t + 0.07)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(rnd(0.02, 0.06), t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
    const p = ctx.createStereoPanner()
    p.pan.value = rnd(-1, 1)
    o.connect(g).connect(p).connect(this.bus)
    o.start(t)
    o.stop(t + 0.1)
    this.timer = setTimeout(() => this.bubbles(), rnd(300, 2800))
  }

  private panner(dir: number, remaining: number, dur: number) {
    const p = this.ctx!.createStereoPanner()
    const a = dir * (-1 + 2 * (1 - remaining / dur)) * 0.9
    p.pan.setValueAtTime(a, this.ctx!.currentTime)
    p.pan.linearRampToValueAtTime(dir * 0.9, this.ctx!.currentTime + remaining)
    p.connect(this.bus)
    return p
  }

  private whaleCall(out: AudioNode, kind: string) {
    const ctx = this.ctx!
    let t = ctx.currentTime + 0.1
    const notes = kind === 'humpback' ? Math.floor(rnd(3, 6)) : Math.floor(rnd(1, 3))
    for (let i = 0; i < notes; i++) {
      const d = rnd(2.2, 4.2)
      const f0 = kind === 'humpback' ? rnd(90, 230) : kind === 'deep' ? rnd(45, 75) : rnd(70, 130)
      const f1 = f0 * rnd(0.7, 1.5)
      // Harmonically rich source shaped by a slowly sweeping low-pass, like a throaty groan.
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(f0, t)
      o.frequency.linearRampToValueAtTime(f1, t + d)
      const vib = ctx.createOscillator()
      const vibAmt = ctx.createGain()
      vib.frequency.value = rnd(0.6, 1.4)
      vibAmt.gain.value = f0 * 0.015
      vib.connect(vibAmt).connect(o.frequency)
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.Q.value = 2
      lp.frequency.setValueAtTime(260, t)
      lp.frequency.linearRampToValueAtTime(rnd(600, 950), t + d * 0.5)
      lp.frequency.linearRampToValueAtTime(240, t + d)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(0.09, t + d * 0.35)
      g.gain.linearRampToValueAtTime(0.0001, t + d + 0.8)
      o.connect(lp).connect(g).connect(out)
      o.start(t)
      vib.start(t)
      o.stop(t + d + 0.9)
      vib.stop(t + d + 0.9)
      t += d + rnd(0.8, 2)
    }
    return t - ctx.currentTime
  }

  private tone(out: AudioNode, type: OscillatorType, f0: number, f1: number, at: number, d: number, amp: number, lpHz = 3000) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(f0, at)
    o.frequency.exponentialRampToValueAtTime(f1, at + d)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = lpHz
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(amp, at + Math.min(0.05, d / 3))
    g.gain.exponentialRampToValueAtTime(0.0001, at + d)
    o.connect(lp).connect(g).connect(out)
    o.start(at)
    o.stop(at + d + 0.05)
  }

  /** Short vocalisations for non-baleen species; returns the time the call takes (s). */
  private call(out: AudioNode, sound: Sound): number {
    const t = this.ctx!.currentTime + 0.05
    switch (sound) {
      case 'humpback':
      case 'moan':
      case 'deep':
        return this.whaleCall(out, sound === 'humpback' ? 'humpback' : sound === 'deep' ? 'deep' : 'gray')
      case 'dolphin': {
        let at = t
        for (let i = 0; i < 4; i++) {
          const f = rnd(3500, 6500)
          this.tone(out, 'sine', f, f * rnd(1.3, 1.8), at, rnd(0.25, 0.5), 0.035, 9000)
          at += rnd(0.3, 0.7)
        }
        return at - t
      }
      case 'click': {
        for (let i = 0; i < 14; i++) this.tone(out, 'square', 5200, 4800, t + i * 0.045, 0.012, 0.012, 7000)
        return 0.7
      }
      case 'orca': {
        let at = t
        for (let i = 0; i < 3; i++) {
          this.tone(out, 'sawtooth', rnd(900, 1400), rnd(1800, 2800), at, rnd(0.4, 0.8), 0.04, 3500)
          at += rnd(0.6, 1.1)
        }
        return at - t
      }
      case 'bark': {
        const n = Math.floor(rnd(3, 7))
        for (let i = 0; i < n; i++) this.tone(out, 'sawtooth', rnd(260, 340), rnd(170, 220), t + i * 0.32, 0.22, 0.1, 900)
        return n * 0.32
      }
      case 'roar': {
        this.tone(out, 'sawtooth', 75, 62, t, 1.6, 0.12, 380)
        this.tone(out, 'square', 38, 34, t, 1.6, 0.07, 200)
        return 1.6
      }
      default:
        return 0
    }
  }

  private swish(out: AudioNode, dur: number) {
    const ctx = this.ctx!
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.Q.value = 1.2
    f.frequency.setValueAtTime(700, t)
    f.frequency.linearRampToValueAtTime(1900, t + dur * 0.5)
    f.frequency.linearRampToValueAtTime(900, t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.35, t + dur * 0.4)
    g.gain.linearRampToValueAtTime(0.0001, t + dur)
    src.connect(f).connect(g).connect(out)
    src.start(t)
    src.stop(t + dur + 0.1)
  }

  onEvent = (e: SeaEvent) => {
    if (!this.ctx) return
    const remaining = e.t0 + e.dur - simTime()
    if (remaining <= 0) return
    const p = this.panner(e.dir, remaining, e.dur)
    const delay = Math.max(0, e.t0 - simTime()) * 1000
    if (e.kind === 'mammal') {
      this.mammalId = e.id
      const sound = MAMMALS[e.species].sound
      if (sound === 'none') return
      const quick = sound === 'dolphin' || sound === 'click' || sound === 'bark'
      const next = () => {
        if (this.mammalId !== e.id || simTime() > e.t0 + e.dur - 3) return
        const len = this.call(p, sound)
        setTimeout(next, (len + (quick ? rnd(1.5, 4) : rnd(6, 12))) * 1000)
      }
      setTimeout(next, delay + 500)
    } else {
      setTimeout(() => this.swish(p, Math.min(remaining, 8)), delay)
    }
  }

  setVolume(v: number, muted: boolean) {
    this.vol = v
    this.muted = muted
    this.applyVolume()
  }
  private applyVolume() {
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol, this.ctx.currentTime, 0.1)
  }
}

export const audio = new AudioEngine()
