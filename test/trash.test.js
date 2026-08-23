import { describe, expect, it } from 'vitest'
import { entriesAt, fsView, useGame } from '../src/engine/store.js'
import scenario from '../src/scenarios/workday.json'

const fs = {
  문서: [{ name: 'B', children: [{ id: 'q', name: 'q.hwp', content: 'x', deleted: true }] }],
  휴지통: [{ id: 'old', name: 'old.hwp', content: 'y' }],
  바탕화면: []
}

describe('recycle bin view', () => {
  it('shows a deleted file in the bin, not in its folder', () => {
    const v = fsView(fs, {})
    expect(entriesAt(v, ['문서', 'B'])).toEqual([])
    expect(entriesAt(v, ['휴지통']).map((f) => f.id)).toEqual(['old', 'q'])
  })

  it('puts it back once restored', () => {
    const v = fsView(fs, { restored: { q: true } })
    expect(entriesAt(v, ['문서', 'B']).map((f) => f.id)).toEqual(['q'])
    expect(entriesAt(v, ['휴지통']).map((f) => f.id)).toEqual(['old'])
  })

  it('leaves the scenario data untouched', () => {
    fsView(fs, {})
    expect(fs['문서'][0].children).toHaveLength(1)
    expect(fs['휴지통']).toHaveLength(1)
  })

  it('still stacks the pinned work folder on top', () => {
    const v = fsView(fs, { pinned: ['old'] })
    expect(entriesAt(v, ['바탕화면', '작업 폴더']).map((f) => f.id)).toEqual(['old'])
  })

  it('restoreFile records the restore', () => {
    useGame.setState({ restored: {} })
    useGame.getState().restoreFile('q')
    expect(useGame.getState().restored.q).toBe(true)
  })

  it("day 2's quote starts in the bin and nothing else does", () => {
    const binned = entriesAt(fsView(scenario.fs, {}), ['휴지통']).filter((f) => f.deleted)
    expect(binned.map((f) => f.id)).toEqual(['file_qb'])
  })
})
