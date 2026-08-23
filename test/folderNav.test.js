import { describe, expect, it } from 'vitest'
import { navInit, navReduce } from '../src/apps/folderNav.js'
import scenario from '../src/scenarios/ep1.json'
import { searchFiles } from '../src/engine/store.js'

const go = (s, ...path) => navReduce(s, { type: 'go', path })
const back = (s) => navReduce(s, { type: 'back' })
const forward = (s) => navReduce(s, { type: 'forward' })

describe('folder navigation', () => {
  it('walks back through where it has been', () => {
    let s = go(navInit('문서'), '문서', '업무자료')
    s = go(s, '문서', '업무자료', '2026')
    expect(back(s).path).toEqual(['문서', '업무자료'])
    expect(back(back(s)).path).toEqual(['문서'])
  })

  it('replays the trail forward again', () => {
    const s = go(navInit('문서'), '문서', '개인')
    expect(forward(back(s)).path).toEqual(['문서', '개인'])
  })

  it('drops the forward trail once you go somewhere new', () => {
    const s = back(go(navInit('문서'), '문서', '개인'))
    expect(s.fwd).toHaveLength(1)
    expect(go(s, '다운로드').fwd).toEqual([])
  })

  it('stays put at the ends of the history', () => {
    const start = navInit('문서')
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
