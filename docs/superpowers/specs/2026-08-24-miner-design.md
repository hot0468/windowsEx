# 채굴 프로그램과 정리 — 설계

2026-08-24. 정부25 본인확인이 요구하는 보안 프로그램을 설치하면 채굴기가 함께 깔린다.
증상 → 작업 관리자에서 작업 끝내기 → 백신 검사·치료의 3단계.

## 감염

- `programs.anysign.bundles = 'miner'`. `Installer`가 설치를 마치면 `bundles`가 있을 때
  `startMining()`. 설치 완료 문구에 "함께 제공되는 최적화 도구도 설치했습니다" 한 줄.
- `store.mining`(실행 중) / `store.cleaned`(제거됨), 둘 다 PROGRESS에 포함.

## 증상

- `openWindow(app)`가 `mining`이면 창을 만들지 않고 에러음 + 토스트("마우스가 끊기고,
  창을 열면 곧바로 닫힙니다"). `SAFE_APPS = ['taskmgr', 'antivirus']`만 예외 —
  빠져나갈 길이 막히면 안 되니까.

## 작업 관리자 (`taskmgr`)

- `processList(miner, mining)`: 실행 중이면 `svchost32.exe`(CPU 96%, 1.8GB)를 맨 앞에
  얹고, 아니면 평범한 여섯 줄. 화면은 CPU 내림차순이라 첫 줄이 범인.
- 다른 줄은 전부 `system: true` — 고르면 "Windows가 실행 중입니다. 끝낼 수 없습니다".
- 채굴기를 고르면 하단에 출처("AnySign4PC 설치 시 함께 설치됨"), 확인 대화 후
  `killMiner()`: `mining=false`, 안내 배너, 5.2초 뒤 정보보안팀이 "작업을 끝낸 것만으로는
  지워지지 않습니다. 백신으로 전체 검사를 돌리세요."

## 백신 (`antivirus`)

- 전체 검사가 여섯 경로를 0.5초씩 훑고, `grants.anysign && !cleaned`이면
  `Trojan.CoinMiner.svchost32` 발견 → [치료 및 삭제] → `cleanPc()`:
  `cleaned=true`, `grant('cleanpc')`. 감염이 없으면 "발견된 위협이 없습니다".

## 테스트 (`test/miner.test.js`)

번들은 anysign 하나뿐, 한 번만 시작하고 청소 뒤엔 재발 없음, 등록된 모든 앱 중
taskmgr/antivirus만 채굴 중에 열림, 작업 종료 후 정상 복귀, 목록 정렬과 위장 이름,
작업 종료로는 요청이 끝나지 않고 백신 치료로만 끝남, 치료는 한 번만.
