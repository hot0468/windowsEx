import { useState } from 'react'
import { useGame } from '../engine/store.js'

// 담은 것의 합. 같은 것을 두 번 담으면 두 번 센다.
export const cartTotal = (cart, items) =>
  cart.reduce((n, id) => n + (items.find((i) => i.id === id)?.point ?? 0), 0)

// 주문을 누르면 무엇이 막는가. 빈 장바구니와 잔액 부족은 그 자리에서
// 알려 주고, 그 둘이 아니면 마지막에서 계정이 막는다 — 몰의 서버는 이
// 계정에 무슨 일이 있는지 모른 채 인사 시스템과 대조하지 못할 뿐이다.
export const checkoutError = ({ total, balance }) =>
  total <= 0 ? 'empty' : total > balance ? 'short' : 'account'

const pt = (n) => n.toLocaleString() + 'P'

export default function Mall({ site }) {
  const m = site.mall
  const scenario = useGame((s) => s.scenario)
  const welfare = scenario.sites.find((x) => x.layout === 'portal')
    ?.pages['/hr/welfare']?.welfare
  const balance = welfare?.balance ?? 0

  const [cart, setCart] = useState([])
  const [at, setAt] = useState('shop')      // shop | cart | fail
  const [pick, setPick] = useState('전체')

  const total = cartTotal(cart, m.items)
  const cats = ['전체', ...new Set(m.items.map((i) => i.category))]
  const shown = pick === '전체' ? m.items : m.items.filter((i) => i.category === pick)

  const add = (id) => setCart((c) => [...c, id])
  const drop = (idx) => setCart((c) => c.filter((_, i) => i !== idx))

  const order = () => {
    const err = checkoutError({ total, balance })
    // 빈 장바구니와 잔액 부족은 장바구니 안에서 말해 준다. 계정 문제만
    // 주문을 눌러 본 사람에게 전용 화면으로 나온다.
    if (err === 'account') setAt('fail')
  }
  const err = checkoutError({ total, balance })

  return (
    <div className="ml">
      <header className="ml-top">
        <button className="ml-brand" onClick={() => setAt('shop')}>{m.brand}</button>
        <span className="ml-bal">사용 가능 <b>{pt(balance)}</b></span>
        <button className={'ml-cart' + (cart.length ? ' on' : '')}
                onClick={() => setAt('cart')}>
          장바구니{cart.length > 0 && <i>{cart.length}</i>}
        </button>
      </header>
      <p className="ml-note">{m.note}</p>

      {at === 'shop' && (
        <>
          <nav className="ml-cats">
            {cats.map((c) => (
              <button key={c} className={c === pick ? 'on' : ''} onClick={() => setPick(c)}>{c}</button>
            ))}
          </nav>
          <ul className="ml-grid">
            {shown.map((i) => {
              const over = i.point > balance
              return (
                <li key={i.id} className={over ? 'over' : ''}>
                  <div className="ml-name">{i.name}</div>
                  <div className="ml-desc">{i.desc}</div>
                  <div className="ml-row">
                    <span className="ml-pt">{pt(i.point)}</span>
                    <button disabled={over} onClick={() => add(i.id)}>
                      {over ? '포인트 부족' : '담기'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {at === 'cart' && (
        <div className="ml-cartview">
          <h2>장바구니</h2>
          {cart.length === 0 ? (
            <p className="ml-empty">담은 것이 없습니다.</p>
          ) : (
            <>
              <ul className="ml-lines">
                {cart.map((id, idx) => {
                  const i = m.items.find((x) => x.id === id)
                  return (
                    <li key={id + idx}>
                      <span>{i.name}</span>
                      <span className="ml-pt">{pt(i.point)}</span>
                      <button onClick={() => drop(idx)} aria-label="빼기">✕</button>
                    </li>
                  )
                })}
              </ul>
              <div className="ml-total">
                <span>합계</span><b>{pt(total)}</b>
              </div>
              <div className="ml-total ml-after">
                <span>결제 후 잔액</span>
                <b className={total > balance ? 'short' : ''}>{pt(balance - total)}</b>
              </div>
            </>
          )}
          {err === 'short' && (
            <p className="ml-warn">포인트가 모자랍니다. 담은 것을 줄여 주세요.</p>
          )}
          <button className="ml-order" disabled={err !== 'account'} onClick={order}>
            주문하기
          </button>
        </div>
      )}

      {at === 'fail' && (
        <div className="ml-fail">
          <div className="ml-fail-mark">!</div>
          <h2>{m.fail.title}</h2>
          {m.fail.lines.map((line, i) => <p key={i}>{line}</p>)}
          <div className="ml-fail-code">{m.fail.code}</div>
          <button className="ml-back" onClick={() => setAt('cart')}>장바구니로</button>
        </div>
      )}
    </div>
  )
}
