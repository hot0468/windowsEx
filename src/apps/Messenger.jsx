import { useState } from 'react'
import { useGame } from '../engine/store.js'

const QUICK = ['넵, 확인하겠습니다!', '팀장님 감사합니다 🙇']

export default function Messenger() {
  const scenario = useGame((s) => s.scenario)
  const msgCount = useGame((s) => s.msgCount)
  const [mine, setMine] = useState([])
  const msgs = scenario.messenger.slice(0, msgCount)
  return (
    <div className="messenger">
      <div className="msg-list">
        {msgs.length === 0 && <div className="msg-empty">아직 메시지가 없습니다</div>}
        {msgs.map((m, i) => (
          <div key={i} className="bubble them"><b>{m.from}</b>{m.text}</div>
        ))}
        {mine.map((t, i) => (
          <div key={'m' + i} className="bubble me">{t}</div>
        ))}
      </div>
      <div className="quick">
        {QUICK.map((q) => (
          <button key={q} onClick={() => setMine((p) => [...p, q])}>{q}</button>
        ))}
      </div>
    </div>
  )
}
