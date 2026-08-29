// 사람이 아직 거기 있다는 신호.
//
// 키와 클릭만 듣던 때에는, 휠이나 손가락으로 읽기만 하는 4분 동안 화면이
// 잠겼다 — 하필 끝까지 내려야 하는 긴 글(여행 블로그·부고)이 그 길에 있다.
// 읽는 것도 사람이 하는 일이므로 여기에 넣는다.
export const ACTIVITY = ['keydown', 'pointerdown', 'wheel', 'touchmove', 'scroll']

// scroll 은 버블링하지 않는다. 창에서 들으려면 캡처로 받아야 창 안쪽에서
// 굴러가는 스크롤까지 보인다. 어느 것도 기본 동작을 막지 않으므로 passive.
const OPTS = { passive: true, capture: true }

// 되감기 신호를 모두 걸고, 걷어내는 함수를 돌려준다.
export function watchActivity(target, arm) {
  for (const ev of ACTIVITY) target.addEventListener(ev, arm, OPTS)
  return () => {
    for (const ev of ACTIVITY) target.removeEventListener(ev, arm, OPTS)
  }
}
