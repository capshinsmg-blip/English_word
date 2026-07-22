# 하루보카 (english_word)

에빙하우스 망각곡선 기반 영어회화 단어암기 PWA 웹앱.

## 브랜드
- 앱 이름: **하루보카** (HARU VOCA)
- 브랜드 컬러: **#967BD9** (보라) — CSS `--primary`, 아이콘 배경색과 동일
- 아이콘 원본: `하루보카 이미지(반전).png` (1024px, 사용자가 직접 제작) → `icons/`에 512/192/180/32 리사이즈본

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
- `js/data/words-N.js` — 단어 원본 청크 (id 구간별 분할, `WORDS_CHUNK_N` 배열. data.js보다 먼저 로드)
- `js/data.js` — 단어 조립(`WORDS` = 청크 concat) + rank 채움 + `WORDS_BY_RANK`/`RANK_OF` + 테마 정의
  - 단어 형식: `{ id, w: 단어, p: 발음, m: 뜻, ex: [[en,ko],...], rank?: 커리큘럼 순서 }`
- `js/srs.js` — 에빙하우스 스케줄 엔진 (`SRS` 모듈, localStorage 키: `ew_state_v1`)
- `js/app.js` — UI 로직 (홈/학습/퀴즈/통계/설정)
- `js/cloud.js` — Supabase 로그인 + 진도 클라우드 동기화 (ESM 모듈)
- `supabase/schema.sql` — 진도 저장 테이블 + RLS (Supabase SQL Editor에서 1회 실행)
- `manifest.json`, `sw.js`, `icons/` — PWA (홈화면 설치, 오프라인 지원)

## id / rank 원칙 (콘텐츠 확장의 핵심 — 반드시 지킬 것)
- **id = 영구 식별자.** 사용자 진도(`batches.wordIds`, `settings.startId`)가 id로 저장됨 → **한번 배포된 id는 절대 변경/재사용 금지**
- **rank = 커리큘럼(난이도) 순서.** 진도에 저장되지 않으므로 **언제든 자유롭게 재배열 가능**
- rank 생략 시 `rank = id` (data.js가 채움). 새 단어 삽입 시: id는 "기존 최대 id + 1"부터, rank는 난이도에 맞는 위치로 지정
- 정렬·레벨 경계·레벨테스트·"이미 알아요" 판정은 전부 rank 기준 (`WORDS_BY_RANK`, `RANK_OF[id]`)
- 새 청크 추가 절차: ① `js/data/words-N.js` 생성 → ② data.js의 concat에 등록 → ③ index.html `<script>` 추가 → ④ sw.js ASSETS 추가 + 캐시 버전 올리기

## 규칙
- 빌드 도구 없음 — 순수 HTML/CSS/JS 유지 (입문자 프로젝트)
- 진도 데이터는 localStorage(`ew_state_v1`)가 기본. 로그인 시 Supabase로 자동 동기화(아래 참고)
- 커밋 메시지는 한국어 (`update: ...`)
- UI 텍스트는 한국어
- 광고 배너 자리는 `#ad-banner` (하단 고정) — 추후 영어회화 강의 광고 부착 예정
- 탭 4개: 홈 / 단어장 / 나의 학습 / 설정
  - 단어장: 카테고리 목록(상황 그룹별 주제 카드) → 주제 카드를 누르면 그 단어만 모인 **별도 페이지로 이동**(`dictSel`, 뒤로가기 버튼). 인덱스 상단 검색은 전체 단어 대상, 주제 페이지 검색은 해당 주제 내. (`renderWordIndex`/`renderWordPage` in app.js)
  - 테마 구조(data.js): `_RAW_THEMES`(원본 112종, id 목록) → `_pick()`으로 합쳐 `THEME_GROUPS`(14개 상황 그룹 × 묶음 테마 43종) → `THEMES`는 `THEME_GROUPS`에서 평평하게 파생
- 레벨 테스트(온보딩): 첫 실행 시 `renderOnboarding` — 난이도 사다리 10단어 자가진단(`PLACEMENT_LADDER`, id 목록) → 레벨/예상 어휘량 산정(`computePlacement`, `LEVELS` — **rank 기준**) → `SRS.applyPlacement`로 `settings.startId`(시작 단어 id)·`newPerDay` 세팅. 기존 학습 기록 있으면 자동으로 온보딩 완료 처리. 설정에서 "다시 테스트"(`clearOnboarding`). rank가 클수록 어려운 단어라는 전제 활용 (위 "id / rank 원칙" 참조)
- 게임화: 경험치(`XP_RULES`: 출석 20, 새 단어 5, 복습 단어 8) → 레벨(`levelInfo`) → 캐릭터 진화(`EVOS`), 뱃지(`BADGES`) — 진화/뱃지는 app.js, XP는 srs.js
- 유지(리텐션) 장치 (srs.js):
  - **스트릭 프리즈**: XP 200으로 구매(최대 2개, `buyFreeze`), 공백일을 자동 방어(`applyFreezes` — 앱 시작 시 호출, `frozenDays`에 기록). 레벨용 누적 `xp`는 유지하고 `spentXp`로 잔액만 차감(`xpBalance`) — 캐릭터 레벨은 안 떨어짐
  - **복습 상한**: 하루 최대 3개 배치(`REVIEW_DAILY_CAP`, `dueReviewsToday`) — 초과분 자동 순연, 급한(밀린 일수 큰) 순. 홈에 순연 안내 카드
  - **복귀 화면**: 3일+ 공백 && 밀린 복습 2개+ → 하루 1회 환영 화면(`renderComeback`, localStorage `ew_comeback_v1`)
  - **단어별 이력**: `state.wordStats[id] = { seen, wrong, fixed }` — 퀴즈 세션 첫 시도만 기록(`recordAnswer`, 재시험 제외). fixed = 복습 찬스에서 회복한 횟수(`markLeechFixed`)
- 인출 사다리 (app.js `quizTypeFor`): 복습 차수가 오를수록 깊은 인출 요구 — 0·1차 = 영→한 4지선다(mc) / 2차 = 한→영(rev)·듣기(listen) 교차 / 3차 = 철자 입력(spell, 예문 빈칸 우선). 재시험도 같은 유형 유지
- 리치 큐: 미해결 오답(wrong > fixed) 단어를 새 단어 확인 시험에 최대 2개 "🔁 복습 찬스"로 끼움(`leechWords`) — 배치에는 미포함, 첫 시도 정답 시 회복
- 데일리 퀘스트 (홈 카드): 새 단어 완료 / 오늘 복습 완료 / 발음 5회 듣기(localStorage `ew_daily_v1`) → 3종 달성 시 +30 XP 1회(`claimDailyQuest`, `questClaimedOn`)
  - 홈 카드 순서 = 캐릭터 → 새 단어 → 복습(본편) → 퀘스트 → 방어전(보조). 퀘스트는 기본 접힘("n/3" 요약), 3종 달성+미수령일 때만 자동 펼침
- 설정 탭 구조: 섹션 그룹 5개(계정 / 학습 / 알림·소리 / 기타 / 위험 구역) — 그룹당 카드 1장에 `setting-row` 여러 개(구분선 자동). 펼침 body 앞 행은 `setting-row tail`(구분선 제거). 초기화는 위험 구역 카드로 격리
- 자동 발음: 학습 카드 렌더 시 자동 TTS (`settings.autoSpeak`, 기본 on, 설정 토글)
- 레벨테스트 회상 검증: 자가 신고 후 "알아요" 중 가장 어려운 2개를 4지선다로 검증(`startVerify`) — 틀리면 모름으로 정정
- iOS 설치 배너: iOS Safari && 미설치 시 홈에 "홈 화면에 추가" 안내 (localStorage `ew_ios_banner_v1`로 닫기 기억)
- 졸업 단어 방어전 (홈 카드, 졸업 10개+): 랜덤 10문제 4유형 믹스, 첫 완료 +15 XP/일(`completeDefense`, `defensePlayedOn`) + 출석 인정. 틀리면 wordStats에 기록 → 리치 큐로 순환
- 오답노트 (단어장 최상단 카드): 취약(wrong > fixed) 단어 목록 + "🎯 집중 연습"(stage "practice", XP 없음) — 첫 시도 정답 시 fixed 회복으로 노트에서 빠짐. 단어 배지에 "🔺 취약" 우선 표시(`isWeakWord`)
- 리그·발음평가·홈위젯은 유저 풀 확보·네이티브 전환 후 과제 (UX 분석 P2 후순위)

## 분석 (GA4)
- 측정 ID는 `index.html` 상단 `window.GA_ID` 한 곳에서 관리 (placeholder면 GA 미로드)
- 이벤트 헬퍼: 전역 `track(name, params)` — app.js에서 호출
- 추적 이벤트: `tab_view`, `learn_start`, `learn_complete`, `quiz_start`, `quiz_complete`(rate·perfect)
- 자동 수집: 첫방문/세션/리텐션 등은 GA4 기본 제공

## 로그인 / 클라우드 저장 (Supabase)
- 설정값은 `index.html` 상단 `window.SB_URL` / `window.SB_ANON_KEY` 한 곳에서 관리 (placeholder면 비활성 → 앱은 로컬로 정상 작동)
- 제공자: 구글 (카카오는 추후). `js/cloud.js`의 `window.Cloud.signInGoogle()` / `signInKakao()` / `signOut()` / `getUser()`
- 동기화: `cloud.js`가 `SRS`의 진도 변경 메서드를 감싸 1.5초 debounce 후 `progress` 테이블에 upsert
- 충돌 해결: 로그인/시작 시 로컬 vs 클라우드 중 **`xp`가 큰 쪽 채택**(진도 유실 방지). 클라우드가 최신이면 `window.AppUI.reload()`로 화면 갱신
- 로그인 UI: 설정 화면 `accountCardHtml()` (미설정 시 자동 숨김), 상태 변화는 `cloud-auth` 이벤트로 갱신
- DB: `supabase/schema.sql` (사용자당 1행 `progress(user_id, state jsonb, updated_at)`, RLS로 본인 행만 접근)

## 로드맵
- [x] v0.1 뼈대: 학습/복습/퀴즈/통계/PWA
- [x] 단어 발음 듣기 (Web Speech API — 단어/예문 🔊 버튼, 온라인 필요할 수 있음)
- [x] 단어 데이터 확장 — 현재 4000개 (테마 112종)
- [x] 단어장 주제별 페이지 이동 + 가입 시 레벨 테스트/맞춤 커리큘럼
- [x] GA4 애널리틱스 연동 (참여 이벤트 추적)
- [~] 로그인 + 진도 클라우드 저장 (Supabase) — 구글 완료, 카카오 예정
- [ ] 알림 (복습 시간 푸시)
- [ ] 광고 영역 실연동

## 콘텐츠 확장 로드맵 (총 12,500개 목표)
**구성: 단어 10,000 + 숙어 2,000 + 슬랭 500. 숙어·슬랭은 별도 트랙**(설정 토글로 오늘의 학습에 포함, 숙어는 중급부터 추천 — 메인 커리큘럼에 섞지 않음)

최종 레벨 경계 (rank 기준, CEFR 정렬 — 1만 단어 완성 시 `LEVELS`/`PLACEMENT_LADDER` 재조정):
| 레벨 | rank 구간 | CEFR |
|---|---|---|
| 🐣 입문 | 1~600 | A1 |
| 🌱 초급 | 601~1,800 | A2 |
| 🌿 중급 | 1,801~4,200 | B1 |
| 🌳 중상급 | 4,201~7,000 | B2 |
| 🏆 고급 | 7,001~10,000 | C1+ |

진행 상태:
- [x] Phase 0 — rank 필드 도입 + data.js 청크 분할 (`js/data/words-1.js` id 1~2000, `words-2.js` id 2001~4000)
- [ ] Phase 1~6 — 새 단어 6,000개 생성 (세션당 ~1,000개, id 4001~10000, 난이도별 rank 지정 + 테마 등록)
  - 우선순위: B1 보강 → B2 대량 → C1. 각 배치마다 `_RAW_THEMES`에 새 테마(또는 기존 테마에 id 추가) 등록 필수
- [ ] Phase 7~8 — 숙어 2,000개 (`js/data/idioms.js`, `IDIOMS` 배열, id 10001~12000, 별도 트랙 UI)
- [ ] Phase 9 — 슬랭 500개 (`js/data/slang.js`, `SLANG` 배열, id 20001~20500) + 트랙 토글 설정 UI
- 완료 시 — 레벨 경계·사다리 최종 재조정 + 슬랭은 3~5년 주기 갱신 (유행 지난 표현 교체)
