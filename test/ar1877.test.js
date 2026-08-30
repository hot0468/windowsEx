import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import scenario from '../src/scenarios/workday.json'
import { PROGRESS, findFile, noteOpens, useGame } from '../src/engine/store.js'

// 메모 서버의 끊긴 문장은 그 사람의 흔적을 충분히 본 사람에게만 이어진다.
// 깨지는 방식은 셋 — 이어지는 글이 답이나 결론을 말하거나, 흔적이 가리키는
// 것이 사라지거나, 8층 로그(열면 끝나는 것)가 조건에 끼거나.

const notes = scenario.sites.find((s) => s.layout === 'notes').notes
const last = notes.entries.at(-1)
const sotongPosts = scenario.sites.find((s) => s.url === 'sotong.ar.local').board.posts

describe('이어지는 글', () => {
  it('끊긴 마지막 글에 붙는다', () => {
    expect(last.cut).toBe(true)
    expect(last.more?.length).toBeGreaterThan(1)
  })

  it('결론을 말하지 않는다 — 부름의 마지막 질문과 같은 자리다', () => {
    const blob = last.more.join(' ')
    expect(blob).not.toMatch(/올라가지 마|올라와|올라오|올라가라|올라가 봐라/)
  })

  it('이미 본 것끼리만 잇는다 — 새 사실을 흘리지 않는다', () => {
    // 아홉 시 이 분은 출입 로그와 엄마의 읽음 표시가 공유하는 시각이고,
    // 센서등은 소통방 글이 말한 것이다.
    const blob = last.more.join(' ')
    expect(scenario.ending.missing.scenes.some((sc) => JSON.stringify(sc).includes('9시 2분'))).toBe(true)
    expect(sotongPosts.some((p) => p.body.join(' ').includes('센서등'))).toBe(true)
    expect(blob).toContain('센서등')
  })
  // 주소·정답 누출은 notes.test.js 가 notes 전체를 문자열로 검사한다 — more 도 거기 든다.
})

describe('흔적', () => {
  it('가리키는 파일과 글이 실존한다', () => {
    expect(findFile(scenario.fs, notes.traces.recover)?.name).toMatch(/hwp$/)
    expect(sotongPosts.some((p) => p.id === notes.traces.sotong)).toBe(true)
  })

  it('복구 문서는 실제로 AR-1877 의 것이다', () => {
    expect(findFile(scenario.fs, notes.traces.recover).content).toContain('AR-1877')
  })

  it('세이브에 실린다', () => {
    expect(PROGRESS).toContain('traces')
  })

  it('훅이 실제로 달려 있다 — 없으면 두 흔적은 영영 안 세진다', () => {
    expect(readFileSync('src/apps/Hwp.jsx', 'utf8')).toContain("sawTrace('recover')")
    expect(readFileSync('src/apps/Board.jsx', 'utf8')).toContain("sawTrace('sotong')")
  })
})

describe('열리는 조건', () => {
  const at = (digging, traces) => noteOpens(scenario, { digging, traces })

  it('아무것도 안 봤으면 닫혀 있다', () => {
    expect(at({}, {})).toBe(false)
  })

  it('둘로는 안 열린다', () => {
    expect(at({ asked: true, found: true }, {})).toBe(false)
    expect(at({}, { recover: true, sotong: true })).toBe(false)
  })

  it('넷 중 어느 셋이든 연다', () => {
    expect(at({ asked: true, found: true }, { recover: true })).toBe(true)
    expect(at({ asked: true }, { recover: true, sotong: true })).toBe(true)
    expect(at({ found: true }, { recover: true, sotong: true })).toBe(true)
  })

  it('8층 로그를 연 것은 세지 않는다 — 그건 조건이 아니라 끝이다', () => {
    expect(at({ entered: true, asked: true }, { recover: true })).toBe(false)
  })

  it('같은 흔적을 두 번 봐도 한 번이다', () => {
    useGame.setState({ traces: {} })
    useGame.getState().sawTrace('recover')
    useGame.getState().sawTrace('recover')
    expect(Object.keys(useGame.getState().traces)).toEqual(['recover'])
  })
})
