import { useStore } from '../state/store'

/** Draggable corner handles for the in-browser warp. */
export function Calibration() {
  const corners = useStore((s) => s.corners)
  const set = useStore((s) => s.set)
  const drag = (i: number) => (e: React.PointerEvent) => {
    const move = (ev: PointerEvent) => {
      const next = useStore.getState().corners.map((c) => [...c]) as typeof corners
      next[i] = [Math.min(1.5, Math.max(-0.5, ev.clientX / innerWidth)), Math.min(1.5, Math.max(-0.5, ev.clientY / innerHeight))]
      set({ corners: next })
    }
    const up = () => {
      removeEventListener('pointermove', move)
      removeEventListener('pointerup', up)
    }
    addEventListener('pointermove', move)
    addEventListener('pointerup', up)
    e.preventDefault()
  }
  return (
    <>
      {corners.map(([x, y], i) => (
        <div key={i} className="handle" style={{ left: `${x * 100}%`, top: `${y * 100}%` }} onPointerDown={drag(i)} />
      ))}
    </>
  )
}
