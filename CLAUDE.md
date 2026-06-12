# 매일 영단어 (english_word)

에빙하우스 망각곡선 기반 영어회화 단어암기 PWA 웹앱.

## 배포
- GitHub: https://github.com/capshinsmg-blip/English_word
- 배포 URL: https://capshinsmg-blip.github.io/English_word/ (GitHub Pages, main 브랜치 루트)

## 핵심 컨셉 (에빙하우스 스케줄)
- 매일 새 단어 5개 = 1개 배치(batch)
- 배치별 복습: 첫 암기 후 **1일(1차) → 7일(2차) → 30일(3차)** 뒤 시험
- 복습 시험에서 틀린 단어는 그 자리에서 재암기 → 재시험 (전부 맞을 때까지)
- 3차 복습 완료 시 졸업. 한 달 후 정상 궤도에서 하루 약 20개 학습 (새5+1차5+2차5+3차5)

## 구조
- `index.html` — 단일 페이지, 화면은 JS로 렌더링
- `css/style.css` — 모바일 우선 디자인 (max-width 480px)
- `js/data.js` — 단어 데이터 (`WORDS` 배열: id, w=단어, p=발음, m=뜻, ex=예문[[en,ko]])
- `js/srs.js` — 에빙하우스 스케줄 엔진 (`SRS` 모듈, localStorage 키: `ew_state_v1`)
- `js/app.js` — UI 로직 (홈/학습/퀴즈/통계/설정)
- `manifest.json`, `sw.js`, `icon.svg` — PWA (홈화면 설치, 오프라인 지원)

## 규칙
- 빌드 도구 없음 — 순수 HTML/CSS/JS 유지 (입문자 프로젝트)
- 진도 데이터는 localStorage에만 저장 (서버 없음)
- 커밋 메시지는 한국어 (`update: ...`)
- UI 텍스트는 한국어
- 광고 배너 자리는 `#ad-banner` (하단 고정) — 추후 영어회화 강의 광고 부착 예정

## 로드맵
- [x] v0.1 뼈대: 학습/복습/퀴즈/통계/PWA
- [ ] 단어 데이터 확장 (60개 → 1000개+)
- [ ] 단어 발음 듣기 (Web Speech API)
- [ ] 알림 (복습 시간 푸시)
- [ ] 광고 영역 실연동
