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
const roots = () => [
  ...threads.flatMap((t) => [{ ask: t.ask, where: 'thread:' + t.id }, ...(t.reactions ?? []).map((r) => ({ ask: r.ask, where: 'thread:' + t.id + ':reaction' }))]),
  ...s.days.flatMap((d) => (d.asks ?? []).map((a) => ({ ask: a.ask, where: 'day' + d.n + ':' + a.thread }))),
  ...Object.entries(s.overtime.days).flatMap(([n, d]) => d.asks.map((a) => ({ ask: a.ask, where: 'ot' + n + ':' + a.thread }))),
  ...s.pool.requests.map((r) => ({ ask: r.beat.ask, where: 'pool:' + r.id })),
  ...Object.entries(s.summons.nights ?? {}).map(([n, b]) => ({ ask: b.ask, where: 'summons:밤' + n }))
].filter((r) => r.ask)
const everyAsk = () => roots().flatMap((r) => steps(r.ask).map((x) => ({ ...x, where: r.where }))).filter((a) => a.placeholder)

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
  pool: () => s.pool.requests.forEach((r) => console.log(`${r.id}\t${r.beat.thread}\t${steps(r.beat.ask).length}단계\t${r.beat.ask.deed ? '행동' : ''}\t${s.pool.after[r.id] ? 'day>=' + s.pool.after[r.id] : ''}`)),
  ripples: () => s.ripples.forEach((r) => console.log(`${r.id}\t${JSON.stringify(r.when)}\t${JSON.stringify(r.effect ?? {})}`)),
  // 찍어야 할 사진 목록. 어느 패이고 어디에 놓이는지 한눈에 본다.
  tiles: () => s.nineGates.shots.forEach((t) =>
    console.log(`${t.shot}.webp\t${t.tile}萬\t${t.blog ? 'blog:' + t.blog : t.at.join('/') + '/' + t.name}\n\t${t.shotNote.split('— ')[1] ?? ''}`)),
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
  // 한 요청의 전 단계(체인)를 본다: ask <grants|pool id|where 조각> — JSON을 직접 열 필요가 없다
  ask: () => {
    if (!arg) return console.log('usage: ask <grants|pool id|where>  (예: ask expense_sheet / ask pool:quote)')
    const hit = roots().find((r) => steps(r.ask).some((a) => a.grants === arg)) ?? roots().find((r) => r.where.includes(arg))
    if (!hit) return console.log('not found — try: grants / pool')
    console.log(hit.where)
    console.log(JSON.stringify(steps(hit.ask).map(({ then, ...a }) => a), null, 1))
  },
  chatter: () => s.chatter.forEach((c) => console.log(`${c.id}\t${c.days ? 'days:' + c.days.join(',') : 'after:' + c.after}\t${c.egg}\t${c.beat.thread}`)),
  summons: () => Object.values(s.summons.nights ?? {}).flatMap((b) => steps(b.ask)).forEach((a, i) =>
    console.log(`${i + 1}. ${a.free ? '(free)' : (a.accept ?? []).flat().join(' | ')}\t${a.placeholder ?? ''}${a.grants ? '\t→' + a.grants : ''}`)),
  file: () => {
    const f = allFiles().find((x) => x.id === arg || x.name === arg)
    console.log(f ? JSON.stringify(f, null, 1) : 'not found — try: files')
  },
  // 전화. 업무 연락처(메일 목표와 짝) · 아는 사람 · 이스터에그 · 걸려오는 것 · 스팸.
  calls: () => {
    const c = s.calls ?? {}
    for (const [kind, list] of Object.entries({ contacts: c.contacts, people: c.people, eggs: c.eggs, incoming: c.incoming, spam: c.spam })) {
      for (const x of list ?? []) {
        console.log(`${kind}	${x.id}	${x.number}	${x.name ?? x.from ?? ''}	${x.mail ?? x.after ?? x.group ?? ''}	${x.needsMail ? '메일필요' : x.asking ? '통화가능' : ''}`)
      }
    }
    if (c.busy) console.log(`busy	${c.busy.join(' / ')}`)
  },
  // 잡담. 인자 없으면 인물별 화제 수, 인물 id 를 주면 그 사람의 화제·맞장구.
  smalltalk: () => {
    const t = s.smalltalk ?? {}
    if (!arg) return Object.entries(t).forEach(([id, v]) => console.log(`${id}	화제 ${v.topics.length}	맞장구 ${v.any.length}	되풀이 ${v.again?.length ?? 0}	${v.topics.map((x) => x.when[0]).join(',')}`))
    console.log(JSON.stringify(t[arg] ?? `없음 — 있는 것: ${Object.keys(t).join(', ')}`, null, 1))
  },
  // 대화 상대 한눈에. 두 메신저의 스레드 id · 이름 · 정적 메시지 수 · 요청 유무.
  threads: () => [s.workMessenger, s.privateMessenger].forEach((m, i) =>
    m.sections.flatMap((x) => x.threads).forEach((t) =>
      console.log(`${i ? '개인' : '업무'}	${t.id}	${t.name}	메시지 ${t.messages?.length ?? 0}	${t.ask ? '요청' : ''}${t.reactions?.length ? '	반응 ' + t.reactions.length : ''}`)))
}

;(cmds[cmd] ?? cmds.help)()
