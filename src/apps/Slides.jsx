import { useState } from 'react'
import { useGame, findFile } from '../engine/store.js'
import { ChevronLeft, ChevronRight } from '../icons/line.jsx'

export default function Slides({ fileId }) {
  const fs = useGame((s) => s.scenario.fs)
  const [at, setAt] = useState(0)
  const file = findFile(fs, fileId)
  if (!file?.slides?.length) return <div className="sl-none">슬라이드를 열 수 없습니다.</div>

  const deck = file.slides
  const slide = deck[at]
  const step = (by) => setAt((i) => Math.min(deck.length - 1, Math.max(0, i + by)))

  return (
    <div className="sl">
      <div className="sl-strip">
        {deck.map((s, i) => (
          <button key={i} className={'sl-thumb' + (i === at ? ' on' : '')} onClick={() => setAt(i)}>
            <span className="sl-thumb-no">{i + 1}</span>
            <span className="sl-thumb-title">{s.title}</span>
          </button>
        ))}
      </div>

      <div className="sl-main">
        <div className="sl-stage">
          <div className="sl-slide">
            <h2>{slide.title}</h2>
            {slide.bullets?.length > 0 && (
              <ul>{slide.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
            )}
          </div>
        </div>
        <div className="sl-bar">
          <span className="sl-name">{file.name}</span>
          <button onClick={() => step(-1)} disabled={at === 0} title="이전 슬라이드">
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
          <span className="sl-count">{at + 1} / {deck.length}</span>
          <button onClick={() => step(1)} disabled={at === deck.length - 1} title="다음 슬라이드">
            <ChevronRight size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  )
}
