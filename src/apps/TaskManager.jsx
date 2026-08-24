import { useState } from 'react'
import { useGame, processList } from '../engine/store.js'

// Sorted by CPU the way Windows opens it, so the thing eating the machine is
// the first row you see.
export default function TaskManager() {
  const miner = useGame((s) => s.scenario.miner)
  const mining = useGame((s) => s.mining)
  const killMiner = useGame((s) => s.killMiner)
  const [picked, setPicked] = useState(null)
  const [asking, setAsking] = useState(false)
  const [killed, setKilled] = useState(false)

  const rows = processList(miner, mining).sort((a, b) => b.cpu - a.cpu)
  const selected = rows.find((r) => r.name === picked) ?? null
  const total = rows.reduce((n, r) => n + r.cpu, 0)

  const end = () => {
    if (!selected) return
    if (!selected.miner) return setAsking('system')
    setAsking('confirm')
  }
  const confirm = () => {
    killMiner()
    setAsking(false)
    setPicked(null)
    setKilled(true)
  }

  return (
    <div className="tm">
      <div className="tm-tabs">
        <span className="on">프로세스</span><span>성능</span><span>시작프로그램</span><span>서비스</span>
      </div>
      <div className="tm-head">
        <span className="tm-col-name">이름</span>
        <span className={'tm-col-n' + (total > 50 ? ' hot' : '')}>CPU {total}%</span>
        <span className="tm-col-n">메모리</span>
        <span className="tm-col-n">디스크</span>
      </div>
      <div className="tm-list">
        {rows.map((r) => (
          <button key={r.name}
                  className={'tm-row' + (r.name === picked ? ' sel' : '') + (r.miner ? ' hot' : '')}
                  onClick={() => setPicked(r.name)}>
            <span className="tm-col-name">
              <b>{r.name}</b>
              <i>{r.detail}</i>
            </span>
            <span className={'tm-col-n' + (r.cpu > 50 ? ' hot' : '')}>{r.cpu}%</span>
            <span className="tm-col-n">{r.memory}</span>
            <span className="tm-col-n">{r.disk}</span>
          </button>
        ))}
      </div>

      {killed && !mining && (
        <div className="tm-note">
          <b>{miner.killed.title}</b>
          {miner.killed.lines.map((line) => <span key={line}>{line}</span>)}
        </div>
      )}

      <div className="tm-foot">
        {selected && selected.miner && <span className="tm-warn">{selected.from}</span>}
        <button className="btn-primary" disabled={!selected} onClick={end}>작업 끝내기</button>
      </div>

      {asking === 'system' && (
        <div className="mg-ask" onPointerDown={() => setAsking(false)}>
          <div className="mg-ask-card" onPointerDown={(e) => e.stopPropagation()}>
            <p>이 프로세스는 Windows가 실행 중입니다. 끝낼 수 없습니다.</p>
            <div className="mg-ask-row">
              <button className="sm-cancel" onClick={() => setAsking(false)}>확인</button>
            </div>
          </div>
        </div>
      )}
      {asking === 'confirm' && (
        <div className="mg-ask" onPointerDown={() => setAsking(false)}>
          <div className="mg-ask-card" onPointerDown={(e) => e.stopPropagation()}>
            <p><b>{miner.process.name}</b> 작업을 끝내시겠습니까?</p>
            <p className="tm-warn">{miner.process.warn}</p>
            <div className="mg-ask-row">
              <button className="btn-primary" onClick={confirm}>작업 끝내기</button>
              <button className="sm-cancel" onClick={() => setAsking(false)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
