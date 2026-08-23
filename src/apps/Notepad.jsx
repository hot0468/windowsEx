import { useGame, findFile } from '../engine/store.js'

export default function Notepad({ fileId }) {
  const scenario = useGame((s) => s.scenario)
  const scratch = useGame((s) => s.scratch)
  const setScratch = useGame((s) => s.setScratch)

  // Opened with no file: a blank pad the player can jot clues into.
  if (!fileId) {
    return (
      <div className="notepad">
        <div className="np-name">제목 없음</div>
        <textarea className="np-body np-edit" value={scratch} aria-label="메모"
                  onChange={(e) => setScratch(e.target.value)}
                  placeholder="메모를 입력하세요" spellCheck={false} />
      </div>
    )
  }

  const file = findFile(scenario.fs, fileId)
  if (!file) return <div style={{ padding: 20 }}>파일을 찾을 수 없습니다.</div>
  return (
    <div className="notepad">
      <div className="np-name">{file.name}</div>
      <pre className="np-body">{file.content}</pre>
    </div>
  )
}
