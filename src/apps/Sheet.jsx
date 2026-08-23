import { useState } from 'react'
import { useGame, cellKey, findFile } from '../engine/store.js'

const colName = (i) => String.fromCharCode(65 + i)

export default function Sheet({ fileId }) {
  const fs = useGame((s) => s.scenario.fs)
  const edits = useGame((s) => s.sheetEdits)
  const editCell = useGame((s) => s.editCell)
  const [tab, setTab] = useState(0)
  const [cell, setCell] = useState({ r: 0, c: 0 })
  const [editing, setEditing] = useState(null)   // { r, c, text } while a cell is being typed into
  const file = findFile(fs, fileId)
  if (!file?.sheets?.length) return <div className="xl-none">시트를 열 수 없습니다.</div>

  const sheet = file.sheets[Math.min(tab, file.sheets.length - 1)]
  // the header counts as row 1, the way it does in a real spreadsheet; edits
  // are keyed on the data row, so the header is never editable
  const shown = (r, c, value) => (r === 0 ? value : edits[cellKey(fileId, sheet.name, r - 1, c)] ?? value)
  const rows = [sheet.columns, ...sheet.rows].map((row, r) => row.map((v, c) => shown(r, c, v)))
  const at = rows[cell.r]?.[cell.c] ?? ''

  const commit = () => {
    if (editing) editCell(fileId, sheet.name, editing.r - 1, editing.c, editing.text)
    setEditing(null)
  }

  return (
    <div className="xl">
      <div className="xl-bar">
        <span className="xl-ref">{colName(cell.c)}{cell.r + 1}</span>
        <span className="xl-fx">fx</span>
        <span className="xl-value">{at}</span>
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
                    ) : value}
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
