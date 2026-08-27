import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import scenario from '../src/scenarios/workday.json'
import { PROGRESS, allFiles, endingFor, fsView, tileShots, useGame } from '../src/engine/store.js'

const gates = scenario.nineGates
const ids = gates.shots.map((s) => s.id)

beforeEach(() => useGame.setState({ tiles: [], ended: false, grants: {} }))

describe('구련보등', () => {
  it('열네 장이고, 사진 한 장에 패 하나다', () => {
    expect(gates.shots).toHaveLength(14)
    for (const s of gates.shots) {
      expect(typeof s.tile, s.id).toBe('number')
      expect(s.tile).toBeGreaterThanOrEqual(1)
      expect(s.tile).toBeLessThanOrEqual(9)
    }
    expect(new Set(ids).size).toBe(14)
  })

  it('만수 1112345678999 + 중복 한 장이다', () => {
    // 이 형태라야 1~9 어느 패가 와도 화료가 된다. 그래서 아홉 개의 문이다.
    const hand = gates.shots.map((s) => s.tile).sort((a, b) => a - b).join('')
    expect(hand).toBe('11123455678999')
  })

  it('한 자리에 여러 장이 몰려 있다', () => {
    // 흩뿌리면 수집 목록이 된다. 하나를 찾으면 근처를 더 뒤지게 만들어야 한다.
    const where = {}
    for (const s of gates.shots) {
      const key = s.blog ?? s.at.join('/')
      where[key] = (where[key] ?? 0) + 1
    }
    const spots = Object.values(where)
    expect(spots.some((n) => n >= 3), '서넛이 몰린 자리가 있어야 한다').toBe(true)
    expect(Math.max(...spots)).toBeLessThanOrEqual(4)
  })

  it('퍼즐이 쓰는 사진과 겹치지 않는다', () => {
    const shots = new Set(gates.shots.map((s) => s.shot))
    // 꿈이 빌려 가는 제주 사진과 퍼즐이 쓰는 고양이·귤은 건드리지 않는다
    for (const id of scenario.dream.photos) expect(shots.has(id)).toBe(false)
    for (const name of ['cat1', 'cat2', 'gyul']) expect(shots.has(name)).toBe(false)
  })

  it('사진이 실제 폴더와 블로그에 놓인다', () => {
    for (const s of gates.shots) {
      if (s.blog) {
        expect(scenario.blogs.some((b) => b.id === s.blog), s.id + '의 블로그').toBe(true)
      } else {
        expect(Array.isArray(s.at), s.id).toBe(true)
        expect(s.name, s.id).toBeTruthy()
      }
    }
  })

  it('폴더는 한 장이라도 모으기 전에는 바탕화면에 없다', () => {
    const empty = fsView(scenario.fs, { tiles: [] })
    expect(empty['바탕화면'].some((e) => e.name === gates.folder)).toBe(false)

    const some = fsView(scenario.fs, { tiles: [ids[0]] })
    const folder = some['바탕화면'].find((e) => e.name === gates.folder)
    expect(folder).toBeTruthy()
    expect(folder.children).toHaveLength(1)
  })

  it('열세 장까지는 끝나지 않고, 열네 장째에 끝난다', () => {
    const g = () => useGame.getState()
    for (const id of ids.slice(0, 13)) g().takeTile(id)
    expect(g().tiles).toHaveLength(13)
    expect(g().ended).toBe(false)

    g().takeTile(ids[13])
    expect(g().tiles).toHaveLength(14)
    expect(g().ended).toBe(gates.ending)
  })

  it('어떤 순서로 모아도 열네 장째에 끝난다', () => {
    const g = () => useGame.getState()
    const shuffled = [...ids].reverse()
    for (const id of shuffled.slice(0, 13)) g().takeTile(id)
    expect(g().ended).toBe(false)
    g().takeTile(shuffled[13])
    expect(g().ended).toBe(gates.ending)
  })

  it('같은 사진을 두 번 복사해도 한 장으로 센다', () => {
    const g = () => useGame.getState()
    g().takeTile(ids[0])
    g().takeTile(ids[0])
    expect(g().tiles).toEqual([ids[0]])
    expect(g().ended).toBe(false)
  })

  it('엔딩 판정에는 끼지 않는다 — 별도 발동이다', () => {
    const base = { grants: {}, locks: 3, overtime: {}, days: 5, digging: {}, rumor: {} }
    expect(endingFor(scenario.ending, base)).not.toBe(gates.ending)
    expect(endingFor(scenario.ending, { ...base, tiles: ids })).not.toBe(gates.ending)
  })

  it('죽음을 한 마디도 말하지 않는다', () => {
    const said = JSON.stringify(scenario.ending.nine_gates)
    for (const w of ['부고', '죽', '사망', '장례', '병원', '사고', '의식', '빈소', '영정']) {
      expect(said, w).not.toContain(w)
    }
  })

  it('모은 사진은 저장에 실린다', () => {
    expect(PROGRESS).toContain('tiles')
  })

  it('폴더에 들어간 사진에도 원래 이름이 남는다', () => {
    const all = fsView(scenario.fs, { tiles: ids })
    const folder = all['바탕화면'].find((e) => e.name === gates.folder)
    expect(folder.children).toHaveLength(14)
    for (const child of folder.children) expect(child.name).toBeTruthy()
  })

  it('사진이 든 파일은 폴더에서도 찾을 수 있다', () => {
    // 폴더 안 사진은 원본 파일이 그대로 들어간 것이어야 한다
    const placed = gates.shots.filter((s) => s.at)
    const files = allFiles(fsView(scenario.fs, { tiles: [] }))
    for (const s of placed) {
      expect(files.some((f) => f.id === s.id), s.id + ' 가 폴더에 없다').toBe(true)
    }
  })

  it('블로그 본문에 사진이 실제로 박혀 있다', () => {
    for (const s of gates.shots.filter((x) => x.blog)) {
      const blog = scenario.blogs.find((b) => b.id === s.blog)
      const has = blog.body.some((part) => part.tile === s.id)
      expect(has, s.id + ' 가 ' + s.blog + ' 본문에 없다').toBe(true)
    }
  })

  it('tileShots가 자리별로 골라 준다', () => {
    expect(tileShots(scenario, 'blog', 'b_nogari')).toHaveLength(3)
    expect(tileShots(scenario, 'blog', 'b_jeju_cafe')).toHaveLength(2)
    expect(tileShots(scenario, 'blog', 'b_ar')).toHaveLength(0)
  })

  it('찍을 사람에게 무슨 패인지 알려 준다', () => {
    for (const s of gates.shots) {
      expect(s.shotNote, s.id).toBeTruthy()
      expect(s.shotNote, s.id).toContain(s.shot + '.webp')
    }
  })

  it('그 메모가 화면으로는 새지 않는다', () => {
    // 뷰어는 파일의 alt를 그대로 그린다. 거기에 무슨 패인지 적으면 답이 샌다.
    const HAN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
    const walk = (entries, out = []) => {
      for (const e of entries ?? []) {
        if (e.children) walk(e.children, out)
        else if (e.tile) out.push(e)
      }
      return out
    }
    for (const f of walk(Object.values(scenario.fs).flat())) {
      expect(f.alt, f.id).toBeTruthy()
      expect(f.alt, f.id + ' 의 alt가 패를 지목한다').not.toContain(HAN[f.tile])
      expect(f.alt, f.id).not.toContain('마작')
      expect(f.alt, f.id).not.toContain('shotNote')
    }
  })

  it('폴더마다 제 드롭을 받는다', () => {
    // 전에는 바탕화면 폴더가 전부 작업 폴더의 드롭 핸들러를 달고 있어서, 패
    // 폴더에 떨군 파일이 엉뚱하게 작업 폴더로 들어갔다.
    const src = readFileSync('src/shell/Desktop.jsx', 'utf8')
    expect(src).toContain('dropFor')
    expect(src).toContain('name === gates?.folder ? gather')
  })

  it('패가 아닌 파일은 폴더가 받지 않고, 왜인지 말해 준다', () => {
    const g = () => useGame.getState()
    // takeTile은 패가 아닌 것을 조용히 무시한다 — 화면 쪽에서 말을 해 줘야 한다
    g().takeTile('file_memo')
    expect(g().tiles).toEqual([])
    expect(gates.refuse).toBeTruthy()
    // 몇 장 남았는지는 말하지 않는다
    expect(gates.refuse).not.toMatch(/[0-9]/)
  })
})
