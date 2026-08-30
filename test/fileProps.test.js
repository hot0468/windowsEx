import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import scenario from '../src/scenarios/workday.json'
import {
  PROGRESS, allFiles, fileCreated, fileKind, fileLocation, fileSize, fileStamp, findFile, fmtSize,
  fmtStampLong, fmtStampShort, gameWeekday, parseStamp
} from '../src/engine/store.js'

// 탐색기의 '자세히'와 속성 창이 읽는 값들. 시나리오에는 날짜도 크기도 거의 없어
// 지어내는데, 지어낸 값이 열 때마다 달라지거나, 달력 앱과 요일이 어긋나거나,
// 정작 단서인 사진 열세 장의 날짜가 틀리면 이 화면은 거짓말이 된다.

const explorer = readFileSync('src/apps/FileExplorer.jsx', 'utf8')
// 폰 갤러리만. 워크샵 사진(문서/개인)도 IMG_ 이름이다.
const gallery = scenario.fs['휴대폰'].find((e) => e.name === '갤러리').children.filter((f) => f.image)
const flight = /(\d{4})-(\d{2})-(\d{2})/.exec(findFile(scenario.fs, 'file_ticket').alt)
const backup = scenario.privateMessenger.sections.flatMap((s) => s.threads).find((t) => t.id === 'cloud')
  .messages[0].text

describe('사진 열세 장', () => {
  it('클라우드 알림이 세는 그 열세 장이다', () => {
    expect(backup).toContain('13장')
    expect(gallery).toHaveLength(13)
  })

  it('전부 백업(07/22 23:41) 직전에 찍혔다 — 부름이 인용하는 그 시각', () => {
    expect(backup).toContain('07/22 23:41')
    for (const f of gallery) {
      const st = fileStamp(f)
      expect(`${st.y}-${st.m}-${st.d}`, f.name).toBe('2026-7-22')
      expect(st.hh * 60 + st.mm, f.name).toBeLessThan(23 * 60 + 41)
    }
  })

  it('제주행 비행기보다 먼저 찍힌 제주 사진이다 — 그것이 균열이다', () => {
    expect(flight).toBeTruthy()
    const dayOfFlight = +flight[3]
    for (const f of gallery) expect(fileStamp(f).d, f.name).toBeLessThan(dayOfFlight)
  })

  it('만든 날짜와 수정한 날짜가 같다 — 손댄 적 없는 사진', () => {
    for (const f of gallery) expect(fileCreated(f)).toEqual(fileStamp(f))
  })
})

describe('지어내는 날짜', () => {
  it('같은 파일은 늘 같다', () => {
    for (const f of allFiles(scenario.fs).slice(0, 40)) expect(fileStamp(f)).toEqual(fileStamp(f))
  })

  it('적힌 날짜가 있으면 그것이 이긴다', () => {
    expect(parseStamp('2023-11-09 23:41:07')).toEqual({ y: 2023, m: 11, d: 9, hh: 23, mm: 41, ss: 7 })
    expect(fileStamp(findFile(scenario.fs, 'file_recover_1877'))).toMatchObject({ y: 2023, m: 11, d: 9, hh: 23, mm: 41 })
  })

  it('이름의 날짜를 읽는다 — 회의록_20231108, 견적서_구버전_0705', () => {
    expect(fileStamp({ id: 'a', name: '회의록_20231108.hwp' })).toMatchObject({ y: 2023, m: 11, d: 8 })
    expect(fileStamp({ id: 'b', name: '견적서_구버전_0705.hwp' })).toMatchObject({ y: 2026, m: 7, d: 5 })
  })

  it('연도 폴더 안의 파일은 그 해다', () => {
    const st = fileStamp({ id: 'c', name: '재고현황.xlsx' }, ['문서', '업무자료', '2023'])
    expect(st.y).toBe(2023)
  })

  it('아무 단서 없는 파일은 복귀 주 전에 끝난다 — 휴가 중에 고친 파일은 없다', () => {
    for (let i = 0; i < 200; i++) {
      const st = fileStamp({ id: 'x' + i, name: 'x' + i + '.hwp' })
      expect(st.y).toBe(2026)
      expect(st.m * 100 + st.d).toBeLessThan(823)
      expect(st.m).toBeGreaterThanOrEqual(6)
    }
  })
})

describe('요일', () => {
  it('첫날은 달력이 말하는 그 요일이다', () => {
    const a = /(\d+)월 (\d+)일 \((.)\)/.exec(scenario.days[0].date)
    expect(gameWeekday(scenario, { y: 2026, m: +a[1], d: +a[2] })).toBe(a[3])
  })

  it('한 주 뒤도, 한 주 전도 같은 요일이다', () => {
    const a = /(\d+)월 (\d+)일 \((.)\)/.exec(scenario.days[0].date)
    expect(gameWeekday(scenario, { y: 2026, m: +a[1], d: +a[2] + 7 })).toBe(a[3])
    expect(gameWeekday(scenario, { y: 2026, m: +a[1], d: +a[2] - 7 })).toBe(a[3])
  })

  it('달력 앱의 1일 요일과 맞는다', () => {
    const cal = scenario.sites.find((s) => s.layout === 'calendar').calendar
    const WEEK = ['일', '월', '화', '수', '목', '금', '토']
    expect(gameWeekday(scenario, { y: 2026, m: cal.month, d: 1 })).toBe(WEEK[cal.firstWeekday])
  })

  it('속성 창 표기 — 2026년 7월 22일 ?요일, 오후 11:19:00', () => {
    const text = fmtStampLong(scenario, { y: 2026, m: 7, d: 22, hh: 23, mm: 19, ss: 0 })
    expect(text).toMatch(/^2026년 7월 22일 .요일, 오후 11:19:00$/)
    expect(fmtStampShort({ y: 2026, m: 7, d: 22, hh: 9, mm: 5, ss: 0 })).toBe('2026-07-22 오전 9:05')
  })
})

describe('크기와 종류', () => {
  it('설치 파일은 마법사가 말하는 크기다', () => {
    const setup = findFile(scenario.fs, 'file_hangul_setup')
    expect(fmtSize(fileSize(scenario, setup))).toBe('312MB')
  })

  it('모든 파일이 크기를 갖고 폴더는 갖지 않는다', () => {
    for (const f of allFiles(scenario.fs)) expect(fileSize(scenario, f), f.name).toBeGreaterThan(0)
    expect(fileSize(scenario, { name: '문서', children: [] })).toBe(null)
  })

  it('윈도우처럼 KB 는 올림이다', () => {
    expect(fmtSize(194910)).toBe('191KB')
    expect(fmtSize(1)).toBe('1KB')
    expect(fmtSize(1.2 * 1048576)).toBe('1.2MB')
  })

  it('종류는 윈도우가 붙이는 이름이다', () => {
    expect(fileKind({ name: 'a.hwp' })).toBe('한글 문서')
    expect(fileKind({ name: 'a.jpg', image: 'x' })).toBe('JPG 파일')
    expect(fileKind({ name: 'hosts' })).toBe('파일')
    expect(fileKind({ name: '문서', children: [] })).toBe('파일 폴더')
  })

  it('위치는 이 PC 의 내 폴더 아래다', () => {
    expect(fileLocation(scenario, ['문서', '업무자료'])).toBe('C:\\Users\\김한별\\문서\\업무자료')
    expect(fileLocation(scenario, ['휴대폰', '갤러리'])).toContain('휴대폰')
    expect(fileLocation(scenario, ['로컬 디스크 (C:)', 'Windows'])).toBe('C:\\Windows')
  })
})

describe('탐색기', () => {
  it('보기 방식이 세이브에 실린다', () => {
    expect(PROGRESS).toContain('explorerView')
  })

  it('속성이 오른쪽 단추에 있고, 자세히 보기가 날짜를 그린다', () => {
    expect(explorer).toContain('>속성</button>')
    expect(explorer).toContain('fmtStampShort(fileStamp(f, nav.path))')
  })
})
