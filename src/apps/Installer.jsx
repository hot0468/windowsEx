import { useEffect, useState } from 'react'
import { useGame, findFile } from '../engine/store.js'
import { play } from '../shell/sound.js'

const TICK = 55

// A refused install and a finished one look nothing alike in Windows, so they
// each get their own panel rather than one screen with a swapped message.
const Panel = ({ kind, title, lines, code, children }) => (
  <div className={'ins-panel ' + kind}>
    <h2 className="ins-title">{title}</h2>
    {lines.map((line) => <p key={line} className="ins-line">{line}</p>)}
    {code && <div className="ins-code">{code}</div>}
    {children}
  </div>
)

export default function Installer({ fileId, winId }) {
  const fs = useGame((s) => s.scenario.fs)
  const programs = useGame((s) => s.scenario.programs)
  const grants = useGame((s) => s.grants)
  const grant = useGame((s) => s.grant)
  const close = useGame((s) => s.closeWindow)
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
    grant(spec.grant)
    play('ok')
  }, [finished])

  const shut = () => close(winId)

  if (!spec) return <div className="ins"><Panel kind="stop" title="실행할 수 없습니다"
    lines={['이 파일은 실행할 수 있는 프로그램이 아닙니다.']} /></div>

  if (grants[spec.grant] && step < 0) {
    return (
      <div className="ins">
        <Panel kind="ok" title={spec.already.title} lines={spec.already.lines}>
          <div className="ins-foot"><button className="btn-primary" onClick={shut}>닫기</button></div>
        </Panel>
      </div>
    )
  }

  if (spec.needs && !grants[spec.needs]) {
    return (
      <div className="ins">
        <Panel kind="stop" title={spec.blocked.title} lines={spec.blocked.lines} code={spec.blocked.code}>
          <div className="ins-foot"><button className="sm-cancel" onClick={shut}>닫기</button></div>
        </Panel>
      </div>
    )
  }

  return (
    <div className="ins">
      <div className="ins-head">
        <span className="ins-product">{spec.product}</span>
        <span className="ins-pub">{spec.publisher}</span>
      </div>

      {step < 0 && (
        <Panel kind="intro" title="설치 마법사" lines={spec.intro}>
          <dl className="ins-meta">
            <div><dt>버전</dt><dd>{spec.version}</dd></div>
            <div><dt>설치 파일</dt><dd>{file?.name ?? spec.setup}</dd></div>
            <div><dt>필요 공간</dt><dd>{spec.size}</dd></div>
          </dl>
          <div className="ins-foot">
            <button className="btn-primary" onClick={() => { play('click'); setStep(0) }}>설치</button>
            <button className="sm-cancel" onClick={shut}>취소</button>
          </div>
        </Panel>
      )}

      {running && (
        <Panel kind="run" title="설치하는 중" lines={[spec.steps[step]]}>
          <div className="ins-bar">
            <i style={{ width: `${((step + 1) / spec.steps.length) * 100}%` }} />
          </div>
          <div className="ins-pct">{Math.round(((step + 1) / spec.steps.length) * 100)}%</div>
        </Panel>
      )}

      {finished && (
        <Panel kind="ok" title={spec.done.title} lines={spec.done.lines}>
          <div className="ins-foot"><button className="btn-primary" onClick={shut}>마침</button></div>
        </Panel>
      )}
    </div>
  )
}
