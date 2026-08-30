// vitest 리포터 — 실패한 것과 합계만 찍는다.
//
// 기본 리포터는 파일마다 한 줄씩 백 줄 넘게 찍고, dot 리포터도 TTY 가 아니면
// 같은 짓을 한다. 전체 테스트를 도는 것은 "다 통과했나"를 묻는 것이라 대답은
// 한 줄이면 된다. 실패하면 그 이름과 첫 줄만 — 자세한 건 그 파일만 다시 돌린다.
// 쓰는 법: npm run test:q
export default class Quiet {
  onFinished(files = [], errors = []) {
    let pass = 0
    const bad = []
    const walk = (t, file) => {
      if (t.type === 'test') {
        if (t.result?.state === 'fail') {
          const why = t.result.errors?.[0]?.message?.split('\n')[0] ?? ''
          bad.push(`× ${file.name} > ${t.name}\n    ${why}`)
        } else if (t.result?.state === 'pass') pass++
      }
      for (const c of t.tasks ?? []) walk(c, file)
    }
    for (const f of files) walk(f, f)
    for (const line of bad) console.log(line)
    for (const e of errors) console.log('! ' + (e?.message ?? e))
    console.log(`${pass} passed, ${bad.length} failed, ${files.length} files`)
  }
}
