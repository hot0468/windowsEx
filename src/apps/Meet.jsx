import { useEffect, useRef, useState } from 'react'
import { useGame, answerFits, hintAfter } from '../engine/store.js'

// 화상회의. 링크를 누르면 열리고, 회의 첫머리에 주최자가 어제 보낸 자료를
// 봤는지 몇 가지 묻는다. 질문은 이 앱의 것이 아니다 — 주최자 스레드에 걸린
// 보통의 질문(pendingAsks)에 meet: <id> 가 붙어 있는 것이고, 정답 판정도
// 오답의 값도 채팅과 같다(answerFits · slip · 3단계 힌트). 여기가 다른 것은
// 답을 치는 자리뿐이다.

// 이 회의에서 답할 차례인 질문. 같은 사람이 다른 일로 물어 둔 질문이 회의
// 화면에 새어 들어오면 안 되므로, 이 회의(id)에 붙은 것만 고른다.
export const meetAskOf = (pendingAsks, meeting, id) => {
  const ask = meeting ? pendingAsks?.[meeting.host] : null
  return ask && ask.meet === id ? ask : null
}

// 참석자 타일에 쓸 이름과 색. 스레드가 이미 들고 있는 것을 그대로 쓰고,
// 나는 맨 끝에 선다 — 실제 화상회의가 자기 화면을 끝에 두는 그 자리.
export const peopleOf = (scenario, meeting) => {
  const threads = scenario.workMessenger.sections.flatMap((x) => x.threads)
  const named = (meeting?.people ?? [])
    .map((tid) => threads.find((t) => t.id === tid)).filter(Boolean)
    .map((t) => ({ id: t.id, name: t.name, color: t.color ?? '#556170' }))
  const me = scenario.workMessenger.me
  return [...named, { id: 'me', name: me.name, color: me.color ?? '#3f6fb5', me: true }]
}

// 타일 한가운데 글자. '박 팀장'은 성만, '이준호'는 이름만.
const face = (name) => (name.includes(' ') ? name.split(' ')[0] : name.slice(-2))

// 자막이 한 줄씩 뜨는 간격. 채팅의 SAY_GAP 과 같은 감각으로.
const SAY = 1100

export default function Meet({ id, winId }) {
  const scenario = useGame((s) => s.scenario)
  const pendingAsks = useGame((s) => s.pendingAsks)
  const grants = useGame((s) => s.grants)
  const mercy = useGame((s) => s.mercy)
  const windows = useGame((s) => s.windows)
  const setAsk = useGame((s) => s.setAsk)
  const grant = useGame((s) => s.grant)
  const slip = useGame((s) => s.slip)
  const closeWindow = useGame((s) => s.closeWindow)

  const meeting = scenario.meetings?.[id]
  const people = peopleOf(scenario, meeting)
  const host = people.find((p) => p.id === meeting?.host) ?? people[0]
  const ask = meetAskOf(pendingAsks, meeting, id)
  const finished = Boolean(meeting?.grants && grants[meeting.grants])

  // 'waiting' 아직 질문이 오지 않았다 · 'quiz' 묻는 중 · 'done' 다 끝났다
  // 처음엔 'quiz' 로 시작하지 않는다 — 질문이 이미 걸린 채 열리는 것이 보통이고,
  // 그때 여는 말은 아래 전환 효과가 한다(마운트 직후에도 한 번 돈다).
  const [phase, setPhase] = useState(finished ? 'done' : 'waiting')
  const [said, setSaid] = useState([])       // [{ who, text, me? }]
  const [speaking, setSpeaking] = useState(false)
  const [draft, setDraft] = useState('')
  const [wrongs, setWrongs] = useState(0)
  const [mic, setMic] = useState(true)
  const [cam, setCam] = useState(true)
  const timers = useRef([])
  const endRef = useRef(null)
  // 말은 줄을 선다. 정답 뒤의 ok 와 그 뒤의 본론 인사가 같은 순간에 예약되면
  // 서로 끼어들므로, 새 말은 앞 말이 끝난 뒤에 시작한다.
  const clock = useRef(0)
  const pending = useRef(0)

  // 주최자가 한 줄씩 말한다. 창을 닫으면 남은 말은 사라진다 — 회의 자막이
  // 그렇듯, 나간 뒤에 들려올 것은 없다.
  const say = (lines = []) => {
    if (!lines.length) return
    setSpeaking(true)
    const start = Math.max(Date.now(), clock.current) + 500
    pending.current += lines.length
    lines.forEach((text, i) => {
      timers.current.push(setTimeout(() => {
        setSaid((prev) => [...prev, { who: host.name, text }])
        if (--pending.current === 0) setSpeaking(false)
      }, start + i * SAY - Date.now()))
    })
    clock.current = start + (lines.length - 1) * SAY + 300
  }
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // 질문이 오면 회의가 열리고, 질문이 다 끝나면 본론으로 넘어간다.
  useEffect(() => {
    if (ask && phase !== 'quiz') { setPhase('quiz'); say(meeting.open) }
    if (!ask && phase === 'quiz') { setPhase('done'); say(meeting.done) }
  }, [Boolean(ask)])

  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }) }, [said])

  const answer = () => {
    const text = draft.trim()
    if (!text || !ask) return
    setDraft('')
    setSaid((prev) => [...prev, { who: '나', text, me: true }])
    if (answerFits(ask, text)) {
      // 채팅의 solved 와 같은 순서: 다음 질문을 걸고, 줄 것을 주고, 말한다.
      say(ask.ok)
      setWrongs(0)
      setAsk(meeting.host, ask.then ?? null)
      if (ask.grants) grant(ask.grants)
    } else {
      // 채팅의 missed 와 같다 — 틀린 만큼 값을 치르고, 다음 단계 힌트를 듣는다.
      slip()
      say(hintAfter(ask, wrongs, mercy))
      setWrongs((n) => n + 1)
    }
  }

  const leave = () => closeWindow(winId ?? windows.find((w) => w.app === 'meet')?.id)

  if (!meeting) return <div className="mt mt-none">회의를 찾을 수 없습니다.</div>

  return (
    <div className="mt">
      <header className="mt-top">
        <span className="mt-live"><i />{phase === 'waiting' ? '대기 중' : '진행 중'}</span>
        <span className="mt-title">{meeting.title}</span>
        <span className="mt-at">{meeting.at}</span>
        <span className="mt-url">{meeting.link}</span>
      </header>

      <div className="mt-body">
        <div className="mt-grid">
          {people.map((p) => (
            <div key={p.id} className={'mt-tile' + (speaking && p.id === host.id ? ' on' : '') + (p.me && !cam ? ' off' : '')}
                 style={{ '--c': p.color }}>
              <span className="mt-face">{face(p.name)}</span>
              <span className="mt-name">{p.name}{p.me && ' (나)'}{p.id === host.id && <em>주최자</em>}</span>
              <span className={'mt-mic' + (p.me && !mic ? ' muted' : '')} aria-hidden="true" />
            </div>
          ))}
        </div>

        <aside className="mt-side">
          <div className="mt-cap">
            {phase === 'waiting' && (meeting.waiting ?? []).map((t, i) => <p key={'w' + i} className="mt-sys">{t}</p>)}
            {said.map((l, i) => (
              <p key={i} className={l.me ? 'me' : ''}><b>{l.who}</b>{l.text}</p>
            ))}
            {speaking && <p className="mt-typing"><b>{host.name}</b><span className="spinner sm" /></p>}
            {phase === 'done' && !speaking && (meeting.after ?? []).map((t, i) => <p key={'a' + i} className="mt-sys">{t}</p>)}
            <i ref={endRef} />
          </div>
          {phase === 'quiz' && ask && (
            <div className="mt-ask">
              <label>{ask.placeholder}</label>
              <div className="mt-ask-row">
                <input value={draft} disabled={speaking} onChange={(e) => setDraft(e.target.value)}
                       onKeyDown={(e) => e.key === 'Enter' && !speaking && answer()}
                       placeholder={speaking ? '' : '답을 입력하세요'} aria-label={ask.placeholder} />
                <button disabled={speaking || !draft.trim()} onClick={answer}>답하기</button>
              </div>
            </div>
          )}
        </aside>
      </div>

      <footer className="mt-bar">
        <button className={mic ? '' : 'off'} onClick={() => setMic(!mic)} aria-pressed={!mic}>{mic ? '마이크 끄기' : '마이크 켜기'}</button>
        <button className={cam ? '' : 'off'} onClick={() => setCam(!cam)} aria-pressed={!cam}>{cam ? '카메라 끄기' : '카메라 켜기'}</button>
        <span className="mt-count">참석 {people.length}명</span>
        <button className="mt-leave" onClick={leave}>{phase === 'done' ? '회의 나가기' : '나가기'}</button>
      </footer>
    </div>
  )
}
