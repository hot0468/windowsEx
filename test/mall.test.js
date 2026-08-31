import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { cartTotal, checkoutError } from '../src/apps/Mall.jsx'

// 복지몰. 포인트로 물건을 담고 주문까지 가지만 마지막에서 막힌다.
// 퍼즐이 아니다 — 아무것도 잠그지 않고 아무것도 열지 않는다. 다만
// 막히는 자리가 아무 데나여서는 안 된다.

const scenario = JSON.parse(
  readFileSync(new URL('../src/scenarios/workday.json', import.meta.url), 'utf8'))

const mall = scenario.sites.find((s) => s.layout === 'mall')
const welfare = scenario.sites.find((s) => s.layout === 'portal')
  .pages['/hr/welfare'].welfare

describe('복지몰', () => {
  it('물건이 있다', () => {
    expect(mall).toBeTruthy()
    expect(mall.mall.items.length).toBeGreaterThan(5)
  })

  it('물건마다 값과 이름이 있다', () => {
    for (const it_ of mall.mall.items) {
      expect(it_.name?.trim(), it_.id).toBeTruthy()
      expect(it_.point, it_.name).toBeGreaterThan(0)
      expect(it_.category?.trim(), it_.name).toBeTruthy()
    }
  })

  // 잔액으로 아무것도 못 사면 담아 볼 수조차 없다. 반대로 전부 살 수
  // 있으면 고르는 재미가 없다.
  it('잔액으로 살 수 있는 것과 없는 것이 섞여 있다', () => {
    const pts = mall.mall.items.map((i) => i.point)
    expect(pts.some((p) => p <= welfare.balance)).toBe(true)
    expect(pts.some((p) => p > welfare.balance)).toBe(true)
  })

  it('담은 것의 합을 센다', () => {
    const [a, b] = mall.mall.items
    expect(cartTotal([], mall.mall.items)).toBe(0)
    expect(cartTotal([a.id], mall.mall.items)).toBe(a.point)
    expect(cartTotal([a.id, b.id], mall.mall.items)).toBe(a.point + b.point)
    // 같은 것을 두 번 담으면 두 번 센다
    expect(cartTotal([a.id, a.id], mall.mall.items)).toBe(a.point * 2)
  })
})

describe('주문은 마지막에서 막힌다', () => {
  it('빈 장바구니로는 주문할 수 없다', () => {
    expect(checkoutError({ total: 0, balance: 615000 })).toBe('empty')
  })

  it('잔액을 넘으면 그 자리에서 알려 준다', () => {
    expect(checkoutError({ total: 700000, balance: 615000 })).toBe('short')
  })

  // 담을 수 있고 잔액도 넉넉한데 마지막에서 막힌다. 재직 상태를 확인할
  // 수 없다는 이유로 — 이 계정에 무슨 일이 있는지 몰의 서버는 모른다.
  it('살 수 있어도 결제가 되지 않는다', () => {
    expect(checkoutError({ total: 120000, balance: 615000 })).toBe('account')
  })

  it('막히는 이유가 게임 안에 적혀 있다', () => {
    expect(mall.mall.fail?.title?.trim()).toBeTruthy()
    expect(mall.mall.fail.lines.length).toBeGreaterThan(1)
    expect(mall.mall.fail.code?.trim()).toBeTruthy()
  })

  // 몰이 결론을 대신 말해 버리면 플레이어가 알아챌 자리가 없다.
  it('몰이 이유를 설명해 버리지 않는다', () => {
    const said = JSON.stringify(mall.mall)
    for (const word of ['사고', '사망', '별세', '의식', '퇴사']) {
      expect(said, word).not.toContain(word)
    }
  })
})
