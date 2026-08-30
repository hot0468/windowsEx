import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // host: true 는 루프백과 랜 주소 양쪽으로 연다. 폰 셸을 실제 폰에서 보려면
  // 같은 공유기에 붙은 기기가 이 PC 로 들어올 수 있어야 한다. 'localhost' 로
  // 두면 윈도우에서 ::1 로만 잡혀 브라우저가 치는 127.0.0.1 이 거절당한다.
  //
  // 세이브는 localStorage 에 있고 브라우저가 그것을 출처(origin)별로 나눈다.
  // 127.0.0.1:5173 과 172.30.x.x:5173 은 다른 출처라 진행 상황이 서로 넘어가지
  // 않는다 — 폰에서 열면 빈 주에서 시작한다. 버그가 아니다.
  //
  // 포트를 고정하는 것도 같은 이유다. 5173 이 차 있다고 vite 가 5174 로
  // 옮겨 가면 게임이 그 주의 기억 없이 뜬다. 조용히 옮기느니 시끄럽게 실패한다.
  //
  // 캡처 이미지를 assets 에 떨어뜨리는 동안 파일이 아직 잠겨 있으면 감시자가
  // EBUSY 로 죽고 서버가 통째로 내려간다. 게임이 읽는 것은 webp 뿐이고 png 는
  // 변환되기 전에 잠깐 머무는 것이라, 감시에서 뺀다.
  // 번들이 1MB 를 넘는다고 빌드마다 다섯 줄을 찍는다. 한 화면짜리 게임이라 쪼갤
  // 것이 없고, 그 경고가 문법 오류를 덮어 가린다.
  build: { chunkSizeWarningLimit: 2000 },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    watch: { ignored: ['**/src/assets/**/*.png'] }
  }
})
