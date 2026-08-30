import { describe, expect, it } from 'vitest'
import { SHEET_ERR, cellNumber, cellRef, evalFormula, sheetCell } from '../src/engine/store.js'

// 이 게임의 표는 숫자를 단위와 함께 쓴다. 합계를 손으로 세게 두면 자릿수 하나에
// 오답이 나므로 =SUM() 을 준다. 깨지는 방식은 셋 — 단위를 못 떼거나, 식이 서로를
// 가리켜 창이 멈추거나, 머리글 줄을 숫자로 세거나.

const rows = [
  ['품목', '수량', '금액'],            // 1행 (머리글)
  ['BS-200', '40대', '1,410,000원'],   // 2행
  ['BW-50', '20대', '256,000원'],      // 3행
  ['BS-200', '10대', '352,500원'],     // 4행
  ['합계', '', '']                      // 5행
]

describe('셀에서 숫자를 꺼낸다', () => {
  it('쉼표와 단위를 뗀다', () => {
    expect(cellNumber('1,410,000원')).toBe(1410000)
    expect(cellNumber('40대')).toBe(40)
    expect(cellNumber('-3,000')).toBe(-3000)
  })

  it('숫자가 없으면 0이다 — 글자는 더하기에서 빠진다', () => {
    expect(cellNumber('품목')).toBe(0)
    expect(cellNumber('')).toBe(0)
    expect(cellNumber(undefined)).toBe(0)
  })
})

describe('A1 표기', () => {
  it('화면의 줄 번호와 맞는다 — C2 는 2행 세 번째 칸이다', () => {
    expect(cellRef('C2')).toEqual({ r: 1, c: 2 })
    expect(cellRef('A1')).toEqual({ r: 0, c: 0 })
    expect(cellRef('AA3')).toEqual({ r: 2, c: 26 })
  })

  it('아닌 것은 아니라고 한다', () => {
    expect(cellRef('')).toBe(null)
    expect(cellRef('2C')).toBe(null)
  })
})

describe('=SUM()', () => {
  it('범위를 더한다', () => {
    expect(evalFormula('=SUM(C2:C4)', rows)).toBe('2,018,500')
  })

  it('나열도 더한다', () => {
    expect(evalFormula('=SUM(C2,C4)', rows)).toBe('1,762,500')
  })

  it('거꾸로 쓴 범위도 같다', () => {
    expect(evalFormula('=SUM(C4:C2)', rows)).toBe(evalFormula('=SUM(C2:C4)', rows))
  })

  it('소문자와 공백을 봐준다', () => {
    expect(evalFormula('= sum( C2:C4 )', rows)).toBe('2,018,500')
  })

  it('머리글이 섞여도 글자는 0으로 빠진다', () => {
    expect(evalFormula('=SUM(C1:C4)', rows)).toBe('2,018,500')
  })

  it('아는 식이 아니면 오류다 — 파서인 척하지 않는다', () => {
    expect(evalFormula('=C2+C3', rows)).toBe(SHEET_ERR)
    expect(evalFormula('=SUM()', rows)).toBe(SHEET_ERR)
    expect(evalFormula('=SUM(개나리)', rows)).toBe(SHEET_ERR)
  })
})

describe('식이 든 칸', () => {
  it('식이 아니면 적힌 그대로다', () => {
    expect(sheetCell(rows, 1, 2)).toBe('1,410,000원')
    expect(sheetCell(rows, 9, 9)).toBe('')
  })

  it('식이 든 칸을 다시 더할 수 있다', () => {
    const nested = [...rows.map((r) => [...r])]
    nested[4][2] = '=SUM(C2:C3)'
    expect(sheetCell(nested, 4, 2)).toBe('1,666,000')
    // 그 결과를 또 더해도 숫자로 읽힌다 (쉼표가 붙어 있어도)
    nested[5] = ['재합계', '', '=SUM(C5,C4)']
    expect(sheetCell(nested, 5, 2)).toBe('2,018,500')
  })

  it('자기를 도로 가리키면 멈춘다 — 안 그러면 창이 얼어붙는다', () => {
    const loop = [...rows.map((r) => [...r])]
    loop[4][2] = '=SUM(C5)'
    expect(sheetCell(loop, 4, 2)).toBe(SHEET_ERR)
  })

  it('둘이 서로를 가리켜도 멈춘다', () => {
    const loop = [...rows.map((r) => [...r])]
    loop[4][1] = '=SUM(C5)'
    loop[4][2] = '=SUM(B5)'
    expect(sheetCell(loop, 4, 2)).toBe(SHEET_ERR)
  })
})
