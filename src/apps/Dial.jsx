import { useEffect, useRef, useState } from 'react'
import { useGame } from '../engine/store.js'
import { PhoneOff, Send } from '../icons/line.jsx'

// 전화. 폰에만 있는 앱이다 — 메일로 묻던 것을 목소리로 묻는 자리이자,
// 하루에 한두 번 남이 먼저 거는 자리.
//
// 통화 중 화면은 이 앱 안에 있지만, 걸려오는 전화의 벨은 App 의 오버레이가
// 울린다(다른 앱을 보고 있어도 울려야 하므로).
const TABS = [['recent', '최근 기록'], ['contacts', '연락처'], ['keypad', '키패드']]
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']

function Talking() {
  const call = useGame((s) => s.call)
  const hangUp = useGame((s) => s.hangUp)
  const sayOnCall = useGame((s) => s.sayOnCall)
  const [text, setText] = useState('')
  const tail = useRef(null)

  useEffect(() => { tail.current?.scrollIntoView({ block: 'end' }) }, [call?.said.length])

  const say = () => {
    if (!text.trim()) return
    sayOnCall(text.trim())
    setText('')
  }

  return (
    <div className="cl-talk">
      <div className="cl-who">
        <div className="cl-who-name">{call.name}</div>
        <div className="cl-who-num">{call.number} · 통화 중</div>
      </div>
      <div className="cl-said">
        {call.said.map((line, i) => (
          <p key={i} className={line.them ? 'cl-them' : 'cl-me'}>{line.text}</p>
        ))}
        <span ref={tail} />
      </div>
      {call.asking && (
        <div className="cl-say">
          <input value={text} autoFocus placeholder="말할 내용을 입력하세요" aria-label="말할 내용"
                 onChange={(e) => setText(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && say()} />
          <button className="btn-primary" onClick={say} aria-label="말하기">
            <Send size={16} strokeWidth={1.9} />
          </button>
        </div>
      )}
      <button className="cl-end" onClick={hangUp}>
        <PhoneOff size={20} strokeWidth={1.9} />통화 종료
      </button>
    </div>
  )
}

export default function Dial() {
  const scenario = useGame((s) => s.scenario)
  const call = useGame((s) => s.call)
  const callLog = useGame((s) => s.callLog)
  const dial = useGame((s) => s.dial)
  const [tab, setTab] = useState('recent')
  const [typed, setTyped] = useState('')

  if (call) return <Talking />

  const contacts = scenario.calls?.contacts ?? []
  const nameOf = (number) => contacts.find((c) => c.number === number)?.name

  return (
    <div className="cl">
      <div className="cl-tabs">
        {TABS.map(([id, label]) => (
          <button key={id} className={'cl-tab' + (tab === id ? ' on' : '')} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'recent' && (
        <div className="cl-list">
          {callLog.length === 0 && <p className="cl-none">통화 기록이 없습니다</p>}
          {callLog.map((c, i) => (
            <button key={i} className="cl-row" onClick={() => dial(c.number)}>
              <span className="cl-row-mid">
                <b className={c.dir === 'missed' ? 'cl-missed' : undefined}>{c.name}</b>
                <em>{c.number}</em>
              </span>
              <span className="cl-row-day">
                {c.dir === 'missed' ? '부재중' : c.dir === 'in' ? '수신' : '발신'} · {c.day}일차
              </span>
            </button>
          ))}
        </div>
      )}

      {tab === 'contacts' && (
        <div className="cl-list">
          {contacts.map((c) => (
            <button key={c.id} className="cl-row" onClick={() => dial(c.number)}>
              <span className="cl-row-mid">
                <b>{c.name}</b>
                <em>{c.org} · {c.number}</em>
              </span>
            </button>
          ))}
        </div>
      )}

      {tab === 'keypad' && (
        <div className="cl-pad">
          <div className="cl-typed">{typed || <i>번호를 누르세요</i>}</div>
          <div className="cl-keys">
            {KEYS.map((k) => (
              <button key={k} onClick={() => setTyped((t) => t + k)}>{k}</button>
            ))}
          </div>
          <div className="cl-pad-row">
            <button className="cl-back" onClick={() => setTyped((t) => t.slice(0, -1))}
                    disabled={!typed}>지우기</button>
            <button className="cl-go" onClick={() => { dial(typed); setTyped('') }} disabled={!typed}>
              {nameOf(typed) ?? '전화 걸기'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
