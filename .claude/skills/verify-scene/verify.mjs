// Headless screenshot of the running dev server. See SKILL.md for usage.
import { createRequire } from 'node:module'
const { chromium } = createRequire((process.env.PW_DIR ?? process.cwd()) + '/')('playwright-core')

const [out, ...rest] = process.argv.slice(2)
const opt = (k, d) => (rest.includes(`--${k}`) ? rest[rest.indexOf(`--${k}`) + 1] : d)
const [w, h] = opt('size', '1280x720').split('x').map(Number)
const clip = opt('clip') && Object.fromEntries(['x', 'y', 'width', 'height'].map((k, i) => [k, +opt('clip').split(',')[i]]))
const url = opt('url', 'http://localhost:5180/?autostart=1&ui=0')

const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: w, height: h } })
if (opt('state')) await ctx.addInitScript((s) => localStorage.setItem('immersive-sea-life', JSON.stringify({ state: s, version: 0 })), JSON.parse(opt('state')))
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 300)))
p.on('console', (m) => m.type() === 'error' && !/404/.test(m.text()) && errs.push(m.text().slice(0, 300)))
await p.goto(url)
await p.waitForTimeout(2500)

const species = opt('mammal') ?? opt('school')
if (species) {
  await p.evaluate(async ([kind, id]) => {
    const mod = (n) => import(performance.getEntriesByType('resource').map((r) => r.name).find((u) => u.includes(`/src/sim/${n}.ts`)))
    const [ev, mm, sm] = await Promise.all([mod('events'), mod('mammals'), mod('sim')])
    const m = kind === 'mammal' ? mm.MAMMALS[id] : null
    const dur = m ? m.dur[0] : 22
    ev.emit({ id: 'verify', kind, species: id, t0: sm.simTime() - (m ? dur * 0.5 : 0), dur, dir: 1, y: m ? (m.y[0] + m.y[1]) / 2 : 8, z: m ? (m.z[0] + m.z[1]) / 2 : -12, seed: 3, replace: true })
  }, [opt('mammal') ? 'mammal' : 'school', species])
}
await p.waitForTimeout(+opt('wait', 3000))
await p.screenshot({ path: out, ...(clip ? { clip } : {}) })
console.log(errs.join('\n') || 'no console errors')
await b.close()
