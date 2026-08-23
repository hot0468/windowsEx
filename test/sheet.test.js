import { describe, expect, it } from 'vitest'
import { cellKey, cellMatches, findFile, useGame } from '../src/engine/store.js'
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
