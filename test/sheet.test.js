import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { cellKey, cellMatches, findFile, unsavedFile, useGame } from '../src/engine/store.js'
import scenario from '../src/scenarios/workday.json'

const orders = scenario.objectives.find((o) => o.cell)

describe('sheet edits', () => {
  it('keys a cell by file, sheet and position', () => {
    expect(cellKey('f', '2026', 1, 3)).toBe('f:2026:1:3')
  })

  it('matches an objective loosely on whitespace', () => {
    const { file, sheet, row, col, value } = orders.cell
    expect(cellMatches(orders, { [cellKey(file, sheet, row, col)]: ` ${value} ` })).toBe(true)
    expect(cellMatches(orders, { [cellKey(file, sheet, row, col)]: '견적 회신 대기' })).toBe(false)
    expect(cellMatches(orders, {})).toBe(false)
  })

  it('points at a real cell in a real workbook', () => {
    const file = findFile(scenario.fs, orders.cell.file)
    const sheet = file.sheets.find((s) => s.name === orders.cell.sheet)
    expect(sheet.rows[orders.cell.row][orders.cell.col]).toBeTruthy()
  })

  it('editing the right cell grants the objective, a wrong one does not', () => {
    const { file, sheet, row, col, value } = orders.cell
    useGame.setState({ sheetEdits: {}, grants: {} })
    useGame.getState().editCell(file, sheet, row + 1, col, value)
    expect(useGame.getState().grants[orders.grant]).toBeUndefined()
    useGame.getState().editCell(file, sheet, row, col, value)
    expect(useGame.getState().grants[orders.grant]).toBe(true)
    expect(useGame.getState().sheetEdits[cellKey(file, sheet, row, col)]).toBe(value)
  })
})

// 셀을 고치면 곧바로 문서에 들어가던 것을, 저장을 눌러야 들어가게 바꿨다.
// 그러면 "고쳐 놓고 저장을 안 한" 상태가 처음으로 생긴다 — 그 상태에서 목표가
// 열려 버리면 저장 버튼이 장식이 되고, 닫을 때 물어보는 것도 뜻이 없어진다.
describe('시트 저장', () => {
  const { file, sheet, row, col, value } = orders.cell
  const win = { app: 'sheet', props: { fileId: file } }
  const fresh = () => useGame.setState({ sheetEdits: {}, sheetDrafts: {}, grants: {} })

  it('고쳐 놓고 저장을 안 했으면 아직 안 고친 것이다', () => {
    fresh()
    useGame.getState().draftCell(file, sheet, row, col, value)
    expect(useGame.getState().grants[orders.grant]).toBeUndefined()
    expect(useGame.getState().sheetEdits[cellKey(file, sheet, row, col)]).toBeUndefined()
  })

  it('저장하면 문서에 들어가고 목표가 열린다', () => {
    fresh()
    useGame.getState().draftCell(file, sheet, row, col, value)
    useGame.getState().saveSheet(file)
    expect(useGame.getState().sheetEdits[cellKey(file, sheet, row, col)]).toBe(value)
    expect(useGame.getState().grants[orders.grant]).toBe(true)
    expect(useGame.getState().sheetDrafts).toEqual({})
  })

  it('저장 안 함으로 닫으면 고친 것이 사라진다', () => {
    fresh()
    useGame.getState().draftCell(file, sheet, row, col, value)
    useGame.getState().dropDrafts(file)
    expect(useGame.getState().sheetDrafts).toEqual({})
    expect(useGame.getState().sheetEdits[cellKey(file, sheet, row, col)]).toBeUndefined()
    expect(useGame.getState().grants[orders.grant]).toBeUndefined()
  })

  // 창틀이 닫기 전에 물어볼지 판단하는 자리.
  it('창은 자기가 저장 안 한 것을 들고 있는지 안다', () => {
    fresh()
    expect(unsavedFile(useGame.getState(), win)).toBe(null)
    useGame.getState().draftCell(file, sheet, row, col, value)
    expect(unsavedFile(useGame.getState(), win)).toBe(file)
    useGame.getState().saveSheet(file)
    expect(unsavedFile(useGame.getState(), win)).toBe(null)
  })

  it('다른 파일의 미저장은 이 창과 상관없다', () => {
    fresh()
    useGame.getState().draftCell('file_other', sheet, row, col, value)
    expect(unsavedFile(useGame.getState(), win)).toBe(null)
    useGame.getState().saveSheet(file)
    expect(useGame.getState().sheetDrafts['file_other:' + sheet + ':' + row + ':' + col]).toBe(value)
  })

  // 저장 안 한 것이 다음 세션까지 살아남으면 '저장'이라는 말이 뜻을 잃는다.
  it('저장 안 한 것은 세이브에 실리지 않는다', () => {
    const src = readFileSync('src/engine/store.js', 'utf8')
    const listed = src.match(/export const PROGRESS = \[([\s\S]*?)\]/)[1]
    expect(listed.includes('sheetDrafts')).toBe(false)
    expect(listed.includes('sheetEdits')).toBe(true)
  })
})
