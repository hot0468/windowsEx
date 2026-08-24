// Query the scenario without dumping 14k lines of JSON into a terminal.
// Usage: node scripts/query.mjs <command> [arg]
import { readFileSync } from 'node:fs'

const s = JSON.parse(readFileSync(new URL('../src/scenarios/workday.json', import.meta.url), 'utf8'))
const [cmd, arg] = process.argv.slice(2)

const steps = (ask) => (ask ? [ask, ...steps(ask.then)] : [])
const threads = [s.workMessenger, s.privateMessenger].flatMap((m) => m.sections.flatMap((x) => x.threads))
const allFiles = () => {
  const out = []
  const walk = (es, trail) => es.forEach((e) => (e.children ? walk(e.children, trail + '/' + e.name) : out.push({ ...e, trail })))
  Object.entries(s.fs).forEach(([root, es]) => walk(es, root))
  return out
}
const everyAsk = () => [
  ...threads.flatMap((t) => [t.ask, ...(t.reactions ?? []).map((r) => r.ask)]).flatMap(steps).map((a) => ({ ...a, where: 'thread' })),
  ...s.days.flatMap((d) => (d.asks ?? []).flatMap((a) => steps(a.ask).map((x) => ({ ...x, where: 'day' + d.n })))),
  ...Object.entries(s.overtime.days).flatMap(([n, d]) => d.asks.flatMap((a) => steps(a.ask).map((x) => ({ ...x, where: 'ot' + n })))),
  ...s.pool.requests.flatMap((r) => steps(r.beat.ask).map((x) => ({ ...x, where: 'pool:' + r.id })))
].filter((a) => a.placeholder)

const cmds = {
  help: () => console.log(Object.keys(cmds).join('  ')),
  // the lay of the land, in ~20 lines
  summary: () => {
    console.log('days:', s.days.map((d) => `${d.n}:${d.requests.length}fixed`).join(' '), '| pool', s.pool.requests.length, 'sizes', JSON.stringify(s.pool.sizes))
    console.log('objectives:', s.objectives.length, '| ripples:', s.ripples.map((r) => r.id).join(' '))
    console.log('endings:', Object.keys(s.ending).join(' '))
    console.log('sites:', s.sites.map((x) => `${x.url}(${x.layout})`).join(' '))
    console.log('threads:', threads.map((t) => t.id + (t.bot ? '*' : '')).join(' '))
    console.log('top-level keys:', Object.keys(s).join(' '))
  },
  // every accept string, with where it lives — collision checks start here
  accepts: () => everyAsk().forEach((a) => (a.accept ?? []).flat().forEach((x) => console.log(`${x}\t${a.where}\t${a.grants ?? ''}`))),
  grants: () => everyAsk().forEach((a) => a.grants && console.log(`${a.grants}\t${a.where}`)),
  objectives: () => s.objectives.forEach((o) => console.log(`${o.id}\t${o.grant ?? o.site ?? 'cell'}\t${o.title}`)),
  files: () => allFiles().forEach((f) => console.log(`${f.id}\t${f.trail}/${f.name}`)),
  pool: () => s.pool.requests.forEach((r) => console.log(`${r.id}\t${r.beat.thread}\t${steps(r.beat.ask).length}단계\t${s.pool.after[r.id] ? 'day>=' + s.pool.after[r.id] : ''}`)),
  ripples: () => s.ripples.forEach((r) => console.log(`${r.id}\t${JSON.stringify(r.when)}\t${JSON.stringify(r.effect ?? {})}`)),
  thread: () => {
    const t = threads.find((x) => x.id === arg)
    if (!t) return console.log('threads:', threads.map((x) => x.id).join(' '))
    console.log(JSON.stringify(t, null, 1))
  },
  ending: () => console.log(JSON.stringify(arg ? s.ending[arg] : Object.keys(s.ending), null, 1)),
  day: () => {
    const d = s.days[(+arg || 1) - 1]
    console.log(JSON.stringify({ ...d, asks: (d.asks ?? []).map((a) => a.thread + ':' + (a.ask?.grants ?? 'beat')) }, null, 1))
  },
  // grep the whole scenario, print short pointers instead of content
  find: () => {
    if (!arg) return console.log('usage: find <text>')
    const hits = []
    const walk = (node, path) => {
      if (typeof node === 'string') { if (node.includes(arg)) hits.push(path + '  …' + node.slice(Math.max(0, node.indexOf(arg) - 12), node.indexOf(arg) + arg.length + 20).replace(/\n/g, ' ')) }
      else if (Array.isArray(node)) node.forEach((v, i) => walk(v, `${path}[${i}]`))
      else if (node && typeof node === 'object') Object.entries(node).forEach(([k, v]) => walk(v, `${path}.${k}`))
    }
    walk(s, '$')
    hits.slice(0, 40).forEach((h) => console.log(h))
    if (hits.length > 40) console.log(`… ${hits.length - 40} more`)
    if (!hits.length) console.log('(no hits)')
  },
  file: () => {
    const f = allFiles().find((x) => x.id === arg || x.name === arg)
    console.log(f ? JSON.stringify(f, null, 1) : 'not found — try: files')
  }
}

;(cmds[cmd] ?? cmds.help)()
