import { useGame, findFile } from '../engine/store.js'

// A vendor's own document format: the file is right there and still unreadable
// until their viewer is installed. Same shape of refusal Windows gives for .hwp.
export default function Dcx({ fileId }) {
  const fs = useGame((s) => s.scenario.fs)
  const spec = useGame((s) => s.scenario.programs.dviewer)
  const installed = useGame((s) => Boolean(s.grants.dviewer))
  const file = findFile(fs, fileId)
  if (!file) return <div className="hwp-none">문서를 열 수 없습니다.</div>

  if (!installed) {
    return (
      <div className="hwp-missing">
        <div className="hwp-missing-card">
          <div className="hwp-missing-file">{file.name}</div>
          <h2>{spec.missing.title}</h2>
          {spec.missing.lines.map((line) => <p key={line}>{line}</p>)}
          <div className="hwp-missing-code">{spec.missing.code}</div>
        </div>
      </div>
    )
  }

  const [title, ...rest] = file.content.split('\n')
  return (
    <div className="dcx">
      <div className="hwp-bar">
        <span className="hwp-name">{file.name}</span>
        <span className="dcx-badge">DY Viewer</span>
      </div>
      <div className="hwp-canvas">
        <div className="dcx-page">
          <h1 className="dcx-title">{title}</h1>
          <pre className="dcx-text">{rest.join('\n').replace(/^\n+/, '')}</pre>
          <div className="dcx-foot">D유통 파트너 문서 · 무단 배포 금지</div>
        </div>
      </div>
    </div>
  )
}
