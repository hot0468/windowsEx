import { useEffect, useState } from 'react'
import { useGame, contentOf, findFile } from '../engine/store.js'

export default function Notepad({ fileId }) {
  const scenario = useGame((s) => s.scenario)
  const scratch = useGame((s) => s.scratch)
  const setScratch = useGame((s) => s.setScratch)
  const edits = useGame((s) => s.edits)
  const editFile = useGame((s) => s.editFile)
  const unlockSite = useGame((s) => s.unlockSite)
  const file = fileId ? findFile(scenario.fs, fileId) : null
  const [draft, setDraft] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (file?.editable) setDraft(contentOf(file, edits))
  }, [fileId])

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

  if (!file) return <div style={{ padding: 20 }}>파일을 찾을 수 없습니다.</div>

  // A file the system lets you change — hosts, and nothing else so far.
  if (file.editable) {
    const save = () => {
      editFile(file.id, draft)
      setSaved(true)
      setTimeout(() => setSaved(false), 2400)
    }
    return (
      <div className="notepad">
        <div className="np-name">
          {file.name}
          <button className="np-save" onClick={save}>저장</button>
          {saved && <span className="np-saved">저장되었습니다</span>}
        </div>
        <textarea className="np-body np-edit np-mono" value={draft} aria-label={file.name}
                  onChange={(e) => setDraft(e.target.value)} spellCheck={false} />
      </div>
    )
  }

  return (
    <div className="notepad">
      <div className="np-name">{file.name}</div>
      <pre className="np-body">{contentOf(file, edits)}</pre>
    </div>
  )
}
