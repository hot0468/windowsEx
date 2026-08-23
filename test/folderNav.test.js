import { describe, expect, it } from 'vitest'
import { historyInit, historyReduce } from '../src/apps/folderNav.js'
import scenario from '../src/scenarios/ep1.json'
import { WORK_FOLDER, entriesAt, fsWithPinned, searchFiles } from '../src/engine/store.js'

const go = (s, ...path) => historyReduce(s, { type: 'go', to: path })
const back = (s) => historyReduce(s, { type: 'back' })
const forward = (s) => historyReduce(s, { type: 'forward' })

describe('folder navigation', () => {
  it('walks back through where it has been', () => {
    let s = go(historyInit(['문서']), '문서', '업무자료')
    s = go(s, '문서', '업무자료', '2026')
    expect(back(s).at).toEqual(['문서', '업무자료'])
    expect(back(back(s)).at).toEqual(['문서'])
  })

  it('replays the trail forward again', () => {
    const s = go(historyInit(['문서']), '문서', '개인')
    expect(forward(back(s)).at).toEqual(['문서', '개인'])
  })

  it('drops the forward trail once you go somewhere new', () => {
    const s = back(go(historyInit(['문서']), '문서', '개인'))
    expect(s.fwd).toHaveLength(1)
    expect(go(s, '다운로드').fwd).toEqual([])
  })

  it('stays put at the ends of the history', () => {
    const start = historyInit(['문서'])
    expect(back(start)).toBe(start)
    expect(forward(start)).toBe(start)
  })
})

describe('searchFiles', () => {
  it('reaches files buried in subfolders', () => {
    const hits = searchFiles(scenario.fs, ['문서'], '견적서')
    expect(hits.map((h) => h.file.id)).toContain(scenario.goal.requiredAttachment)
    expect(hits.find((h) => h.file.id === scenario.goal.requiredAttachment).trail)
      .toEqual(['업무자료', '2026', 'A상사'])
  })

  it('is scoped to the folder being searched', () => {
    expect(searchFiles(scenario.fs, ['다운로드'], '사원증')).toEqual([])
  })

  it('returns nothing for a blank term', () => {
    expect(searchFiles(scenario.fs, ['문서'], '   ')).toEqual([])
  })
})

describe('work folder', () => {
  const pin = (...ids) => fsWithPinned(scenario.fs, ids)

  it('appears on the desktop holding copies of the pinned files', () => {
    const goal = scenario.goal.requiredAttachment
    const work = pin(goal)['바탕화면'].find((e) => e.name === WORK_FOLDER)
    expect(work.children.map((f) => f.id)).toEqual([goal])
  })

  it('leaves the original where it was', () => {
    const goal = scenario.goal.requiredAttachment
    expect(entriesAt(pin(goal), ['문서', '업무자료', '2026', 'A상사']).map((e) => e.id))
      .toContain(goal)
  })

  it('is reachable as a path once pinned', () => {
    const goal = scenario.goal.requiredAttachment
    expect(entriesAt(pin(goal), ['바탕화면', WORK_FOLDER]).map((f) => f.id)).toEqual([goal])
  })

  it('shows up empty rather than missing when nothing is pinned', () => {
    const work = pin()['바탕화면'].find((e) => e.name === WORK_FOLDER)
    expect(work.children).toEqual([])
  })

  it('ignores ids that no longer resolve to a file', () => {
    const work = pin('does_not_exist')['바탕화면'].find((e) => e.name === WORK_FOLDER)
    expect(work.children).toEqual([])
  })
})

describe('browser history', () => {
  const home = { kind: 'home' }
  const site = { kind: 'site', url: 'wiki.hanbit.co.kr' }
  const found = { kind: 'search', q: '맥주' }

  it('walks back through visited pages of any shape', () => {
    let h = historyReduce(historyInit(home), { type: 'go', to: found })
    h = historyReduce(h, { type: 'go', to: site })
    expect(historyReduce(h, { type: 'back' }).at).toEqual(found)
  })

  it('replays forward after going back', () => {
    const h = historyReduce(historyInit(home), { type: 'go', to: site })
    const back = historyReduce(h, { type: 'back' })
    expect(back.at).toEqual(home)
    expect(historyReduce(back, { type: 'forward' }).at).toEqual(site)
  })

  it('drops the forward trail once you navigate somewhere new', () => {
    const back = historyReduce(historyReduce(historyInit(home), { type: 'go', to: site }), { type: 'back' })
    expect(back.fwd).toHaveLength(1)
    expect(historyReduce(back, { type: 'go', to: found }).fwd).toEqual([])
  })
})
