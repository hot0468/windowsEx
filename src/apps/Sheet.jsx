import { useState } from 'react'
import { useGame, cellKey, fileById, sheetCell } from '../engine/store.js'
import { Save } from '../icons/line.jsx'

const colName = (i) => String.fromCharCode(65 + i)

export default function Sheet({ fileId }) {
  const edits = useGame((s) => s.sheetEdits)
  const drafts = useGame((s) => s.sheetDrafts)
  const draftCell = useGame((s) => s.draftCell)
  const saveSheet = useGame((s) => s.saveSheet)
  const [tab, setTab] = useState(0)
  const [cell, setCell] = useState({ r: 0, c: 0 })
  const [editing, setEditing] = useState(null)   // { r, c, text } while a cell is being typed into
  const file = useGame((s) => fileById(s, fileId))
  if (!file?.sheets?.length) return <div className="xl-none">시트를 열 수 없습니다.</div>

  const sheet = file.sheets[Math.min(tab, file.sheets.length - 1)]
  // the header counts as row 1, the way it does in a real spreadsheet; edits
  // are keyed on the data row, so the header is never editable
  // 저장 안 한 것이 저장된 것을 덮어 보인다 — 화면은 지금 치고 있는 것을
  // 보여주고, 문서에 들어간 것은 저장을 눌러야 바뀐다.
  const key = (r, c) => cellKey(fileId, sheet.name, r - 1, c)
  const shown = (r, c, value) => (r === 0 ? value : drafts[key(r, c)] ?? edits[key(r, c)] ?? value)
  const dirty = Object.keys(drafts).some((k) => k.startsWith(fileId + ':'))
  const rows = [sheet.columns, ...sheet.rows].map((row, r) => row.map((v, c) => shown(r, c, v)))
  const at = rows[cell.r]?.[cell.c] ?? ''

  const commit = () => {
    // 고친 것이 없으면 저장할 것도 없다 — 값을 그대로 두고 나온 것까지
    // 미저장으로 세면 닫을 때마다 쓸데없이 물어보게 된다.
    if (editing && editing.text !== rows[editing.r][editing.c]) {
      draftCell(fileId, sheet.name, editing.r - 1, editing.c, editing.text)
    }
    setEditing(null)
  }
  const save = () => { commit(); saveSheet(fileId) }

  return (
    <div className="xl" tabIndex={-1}
         onKeyDown={(e) => {
           if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
             e.preventDefault()
             save()
           }
         }}>
      <div className="xl-bar">
        <button className="xl-save" onClick={save} disabled={!dirty}
                title={dirty ? '저장 (Ctrl+S)' : '저장할 변경 내용이 없습니다'}>
          <Save size={14} strokeWidth={1.9} />저장
        </button>
        <span className="xl-ref">{colName(cell.c)}{cell.r + 1}</span>
        <span className="xl-fx">fx</span>
        <span className="xl-value">{at}</span>
        {dirty && <span className="xl-dirty">저장되지 않음</span>}
      </div>

      <div className="xl-grid">
        <table>
          <thead>
            <tr>
              <th className="xl-corner" />
              {sheet.columns.map((_, i) => <th key={i} className="xl-col">{colName(i)}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                <th className="xl-row">{r + 1}</th>
                {row.map((value, c) => (
                  <td key={c}
                      className={(r === 0 ? 'xl-head ' : '') + (cell.r === r && cell.c === c ? 'sel' : '')}
                      onClick={() => setCell({ r, c })}
                      onDoubleClick={() => r > 0 && setEditing({ r, c, text: value })}>
                    {editing && editing.r === r && editing.c === c ? (
                      <input autoFocus value={editing.text} aria-label="셀 편집"
                             onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                             onBlur={commit}
                             onKeyDown={(e) => {
                               if (e.key === 'Enter') commit()
                               if (e.key === 'Escape') setEditing(null)
                             }} />
                    ) : sheetCell(rows, r, c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="xl-tabs">
        {file.sheets.map((s, i) => (
          <button key={s.name} className={'xl-tab' + (i === tab ? ' on' : '')}
                  onClick={() => { setTab(i); setCell({ r: 0, c: 0 }); setEditing(null) }}>
            {s.name}
          </button>
        ))}
      </div>
    </div>
  )
}
