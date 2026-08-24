import { useEffect, useState } from 'react'
import { useGame } from '../engine/store.js'

// The lines of a scene land one at a time; a click (or Enter/Space) either
// finishes the scene early or moves on to the next one.
const LINE_MS = 1400

export default function Ending() {
  const kind = useGame((s) => s.ended)
  const ending = useGame((s) => {
    const [name, pick] = String(s.ended).split(':')
    return name === 'layoff'
      ? s.scenario.ending.layoff.choices.find((c) => c.id === pick)
      : s.scenario.ending[name] ?? s.scenario.ending.plain
  })
  const newGame = useGame((s) => s.newGame)
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
          <p key={k} className="end-line">{line}</p>
        ))}
        {whole && scene.note && <p className="end-note">{scene.note}</p>}
      </div>
      <div className="end-hint">{whole ? '클릭하여 계속' : ''}</div>
    </div>
  )
}
