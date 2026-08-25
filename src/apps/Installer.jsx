import { useEffect, useState } from 'react'
import { useGame, findFile } from '../engine/store.js'
import { play } from '../shell/sound.js'

const TICK = 55

// A `danger` program crashes the machine instead of finishing normally — the
// bluescreen covers the screen today, but the success panel should never be
// the thing sitting underneath it.
export const showsSuccess = (finished, spec) => Boolean(finished && !spec?.danger)

// Win32 dialog buttons: the default one gets the blue ring, the rest stay grey,
// and a wizard always shows the whole 뒤로/다음/취소 row even when most are dead.
const Btn = ({ primary, ...p }) => <button className={'wz-btn' + (primary ? ' default' : '')} {...p} />

// The two page shapes every setup wizard has: a banner page (welcome / finish,
// tall blue strip on the left) and a header page (everything in between —
// white band with a bold title and a small icon on the right).
const Banner = ({ title, lines, children, foot }) => (
  <div className="wz">
    <div className="wz-body">
      <div className="wz-side"><i className="wz-side-logo" /></div>
      <div className="wz-main">
        <h2 className="wz-hero">{title}</h2>
        {lines.map((l) => <p key={l} className="wz-line">{l}</p>)}
        {children}
      </div>
    </div>
    <div className="wz-foot">{foot}</div>
  </div>
)

const Header = ({ kind, title, sub, lines, code, children, foot }) => (
  <div className={'wz ' + (kind ?? '')}>
    <div className="wz-head">
      <div><b className="wz-head-title">{title}</b>{sub && <span className="wz-head-sub">{sub}</span>}</div>
      <i className={'wz-glyph ' + (kind ?? 'run')} />
    </div>
    <div className="wz-body">
      <div className="wz-main">
        {lines.map((l) => <p key={l} className="wz-line">{l}</p>)}
        {code && <div className="wz-code">{code}</div>}
        {children}
      </div>
    </div>
    <div className="wz-foot">{foot}</div>
  </div>
)

export default function Installer({ fileId, winId }) {
  const fs = useGame((s) => s.scenario.fs)
  const programs = useGame((s) => s.scenario.programs)
  const grants = useGame((s) => s.grants)
  const grant = useGame((s) => s.grant)
  const close = useGame((s) => s.closeWindow)
  const crash = useGame((s) => s.crash)
  const startMining = useGame((s) => s.startMining)
  const sawMissing = useGame((s) => s.sawMissing)
  const [step, setStep] = useState(-1)
  const file = findFile(fs, fileId)
  const spec = programs[file?.program]

  const running = spec && step >= 0 && step < spec.steps.length
  const finished = spec && step >= spec.steps.length

  // the progress bar walks the steps, then the install lands
  useEffect(() => {
    if (!running) return
    const t = setTimeout(() => setStep((s) => s + 1), TICK * 18)
    return () => clearTimeout(t)
  }, [step, running])

  useEffect(() => {
    if (!finished || grants[spec.grant]) return
    if (spec.danger) return crash(file.program)
    grant(spec.grant)
    play('ok')
    // some installers bring something else along
    if (spec.bundles) startMining()
  }, [finished])

  // The wizard turning the player away is the other way they learn the program
  // is not on this PC, and the other way the complaint becomes sayable.
  const walled = Boolean(spec?.needs && !grants[spec.needs])
  useEffect(() => { if (walled) sawMissing(file.program) }, [walled])

  const shut = () => close(winId)
  const closeOnly = <Btn primary onClick={shut}>닫기</Btn>

  if (!spec) return <Header kind="stop" title="실행할 수 없습니다" lines={['이 파일은 실행할 수 있는 프로그램이 아닙니다.']} foot={closeOnly} />

  if (grants[spec.grant] && step < 0) {
    return <Header kind="ok" title={spec.already.title} sub={spec.product} lines={spec.already.lines} foot={closeOnly} />
  }

  if (spec.needs && !grants[spec.needs]) {
    return <Header kind="stop" title={spec.blocked.title} sub={spec.product} lines={spec.blocked.lines} code={spec.blocked.code} foot={closeOnly} />
  }

  if (step < 0) {
    return (
      <Banner title={`${spec.product} 설치 마법사 시작`} lines={spec.intro}
        foot={<>
          <Btn disabled>{'< 뒤로(B)'}</Btn>
          <Btn primary onClick={() => { play('click'); setStep(0) }}>{'설치(I) >'}</Btn>
          <Btn onClick={shut}>취소</Btn>
        </>}>
        <dl className="wz-meta">
          <div><dt>게시자</dt><dd>{spec.publisher}</dd></div>
          <div><dt>버전</dt><dd>{spec.version}</dd></div>
          <div><dt>설치 파일</dt><dd>{file?.name ?? spec.setup}</dd></div>
          <div><dt>필요한 공간</dt><dd>{spec.size}</dd></div>
        </dl>
      </Banner>
    )
  }

  if (running) {
    const pct = Math.round(((step + 1) / spec.steps.length) * 100)
    return (
      <Header title={`${spec.product} 설치 중`} sub="선택한 프로그램 기능을 설치하는 동안 잠시 기다려 주십시오." lines={[]}
        foot={<>
          <Btn disabled>{'< 뒤로(B)'}</Btn>
          <Btn disabled>{'다음(N) >'}</Btn>
          <Btn disabled>취소</Btn>
        </>}>
        <p className="wz-line">설치 마법사가 {spec.product}을(를) 설치하는 동안 기다려 주십시오. 몇 분 정도 걸릴 수 있습니다.</p>
        <div className="wz-status">상태: <span>{spec.steps[step]}</span></div>
        <div className="wz-bar"><i style={{ width: `${pct}%` }} /></div>
      </Header>
    )
  }

  if (showsSuccess(finished, spec)) {
    return (
      <Banner title={spec.done.title} lines={[...spec.done.lines, '마법사를 끝내려면 [마침]을 클릭하십시오.']}
        foot={<>
          <Btn disabled>{'< 뒤로(B)'}</Btn>
          <Btn primary onClick={shut}>마침(F)</Btn>
          <Btn disabled>취소</Btn>
        </>} />
    )
  }

  // a `danger` install is mid-crash: leave the dialog blank under the bluescreen
  return <div className="wz" />
}
