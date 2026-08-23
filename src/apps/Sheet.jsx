import { useState } from 'react'
import { useGame, findFile } from '../engine/store.js'

const colName = (i) => String.fromCharCode(65 + i)

export default function Sheet({ fileId }) {
  const fs = useGame((s) => s.scenario.fs)
  const [tab, setTab] = useState(0)
  const [cell, setCell] = useState({ r: 0, c: 0 })
  const file = findFile(fs, fileId)
  if (!file?.sheets?.length) return <div className="xl-none">시트를 열 수 없습니다.</div>

  const sheet = file.sheets[Math.min(tab, file.sheets.length - 1)]
  // the header counts as row 1, the way it does in a real spreadsheet
  const rows = [sheet.columns, ...sheet.rows]
  const at = rows[cell.r]?.[cell.c] ?? ''

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
                      onClick={() => setCell({ r, c })}>
                    {value}
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
                  onClick={() => { setTab(i); setCell({ r: 0, c: 0 }) }}>
            {s.name}
          </button>
        ))}
      </div>
    </div>
  )
}
