import { useGame, findFile } from '../engine/store.js'

export default function Notepad({ fileId }) {
  const scenario = useGame((s) => s.scenario)
  const file = findFile(scenario.fs, fileId)
  if (!file) return <div style={{ padding: 20 }}>파일을 찾을 수 없습니다.</div>
  return (
    <div className="notepad">
      <div className="np-name">{file.name}</div>
      <pre className="np-body">{file.content}</pre>
    </div>
  )
}
