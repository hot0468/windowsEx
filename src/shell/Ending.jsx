import { useEffect, useState } from 'react'
import { useGame } from '../engine/store.js'

// The lines of a scene land one at a time; a click (or Enter/Space) either
// finishes the scene early or moves on to the next one.
const LINE_MS = 1400

// 한 줄에 문장이 여럿이면 문장마다 끊어 앉힌다. 가운데로 모아 놓은 화면에서
// 줄이 문장 한가운데를 자르면 "이직이었습니 / 다."가 되어 읽는 눈이 걸린다.
//
// 끊는 자리는 마침표 다음의 빈칸이다. 빈칸을 조건으로 두어야 2026.08.27 같은
// 것이 셋으로 쪼개지지 않는다.
export const sentences = (line) => {
  const bits = String(line).split(/([.!?]["'”’]?)\s+/)
  const out = []
  for (let i = 0; i < bits.length; i += 2) {
    const s = (bits[i] ?? '') + (bits[i + 1] ?? '')
    if (s) out.push(s)
  }
  return out
}

const Said = ({ className, children }) => (
  <p className={className}>
    {sentences(children).map((s, i) => <span key={i} className="end-sent">{s}</span>)}
  </p>
)

export default function Ending() {
  const kind = useGame((s) => s.ended)
  const ending = useGame((s) => {
    const [name, pick] = String(s.ended).split(':')
    return name === 'layoff'
      ? s.scenario.ending.layoff.choices.find((c) => c.id === pick)
      : s.scenario.ending[name] ?? s.scenario.ending.plain
  })
  const newGame = useGame((s) => s.newGame)
  // 열 갈래 중 몇 번째인지. 목록 밖의 것(구련보등)은 번외다.
  const order = useGame((s) => s.scenario.ending.order ?? [])
  const no = order.indexOf(String(kind)) + 1
  const [i, setI] = useState(0)
  const [shown, setShown] = useState(0)
  const scene = ending.scenes[i]
  const finished = i >= ending.scenes.length
  const whole = scene && shown >= scene.lines.length

  useEffect(() => {
    if (!scene || whole) return
    const t = setTimeout(() => setShown((n) => n + 1), i === 0 && shown === 0 ? 600 : LINE_MS)
    return () => clearTimeout(t)
  }, [i, shown, scene, whole])

  const advance = () => {
    if (finished) return
    if (!whole) return setShown(scene.lines.length)
    setI(i + 1)
    setShown(0)
  }

  useEffect(() => {
    const onKey = (e) => (e.key === 'Enter' || e.key === ' ') && advance()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (finished) {
    return (
      <div className="end end-final">
        <h1>{ending.end.title}</h1>
        <p className="end-sub">{ending.end.sub}</p>
        <p className="end-no">{no ? `${no} / ${order.length}` : '번외'}</p>
        <button className="end-btn" onClick={newGame}>{ending.end.button}</button>
      </div>
    )
  }

  return (
    <div className={'end end-' + scene.style} onClick={advance}>
      <div className="end-body" key={i}>
        {scene.style === 'article' && (
          <div className="end-art-head">
            <span>{scene.press}</span><span>{scene.date}</span>
            <h2>{scene.title}</h2>
          </div>
        )}
        {scene.who && <div className="end-who">{scene.who}</div>}
        {scene.lines.slice(0, shown).map((line, k) => (
          <Said key={k} className="end-line">{line}</Said>
        ))}
        {whole && scene.note && <Said className="end-note">{scene.note}</Said>}
      </div>
      <div className="end-hint">{whole ? '클릭하여 계속' : ''}</div>
    </div>
  )
}
