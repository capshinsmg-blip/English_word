// 에빙하우스 망각곡선 기반 스케줄 엔진 (SRS: Spaced Repetition System)
//
// 동작 방식:
//  - 매일 새 단어 N개(기본 5개)를 외우면 하나의 "배치(batch)"가 생성된다.
//  - 각 배치는 첫 암기 후 1일(1차), 7일(2차), 30일(3차) 뒤에 복습 시험이 도래한다.
//  - 3차 복습까지 끝난 배치는 "졸업"으로 처리된다.
//  - 한 달쯤 지나면 매일 약 20개(새 5 + 1차 5 + 2차 5 + 3차 5)를 공부하게 된다.

const SRS = (() => {
  const KEY = "ew_state_v1";
  const REVIEW_OFFSETS = { 1: 1, 2: 7, 3: 30 }; // 복습 차수별 경과 일수
  const STAGE_NAMES = { 1: "1차 복습", 2: "2차 복습", 3: "3차 복습" };

  // 경험치 규칙: 출석(하루 첫 활동) / 새 단어 1개 / 복습 통과 단어 1개
  const XP_RULES = { attend: 20, newWord: 5, reviewWord: 8 };

  // 스트릭 프리즈: XP로 구매해 하루 놓쳐도 연속 기록을 지키는 아이템
  const FREEZE_COST = 200;   // 1개 구매 비용 (XP)
  const FREEZE_MAX = 2;      // 최대 보유 수

  // 하루에 보여줄 복습 시험 상한 — 밀린 복습이 벽이 되지 않도록 초과분은 자동 순연
  const REVIEW_DAILY_CAP = 3;

  function todayStr(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  function daysBetween(from, to) {
    return Math.round((new Date(to) - new Date(from)) / 86400000);
  }

  function defaultState() {
    return {
      batches: [], activity: [],
      settings: { newPerDay: 5, startId: 1, selectedThemes: [], autoSpeak: true },
      xp: 0, perfect: 0, best: 0, onboarded: false, placement: null,
      wordStats: {},        // 단어별 이력: { [id]: { seen, wrong, fixed } } — fixed = 복습찬스에서 회복한 횟수
      freezes: 0,           // 보유 중인 스트릭 프리즈
      spentXp: 0,           // 프리즈 구매 등으로 쓴 XP (레벨은 누적 xp 기준이라 안 떨어짐)
      frozenDays: [],        // 프리즈로 지켜진 날짜들 (streak 계산에 출석으로 인정)
      questClaimedOn: null,  // 데일리 퀘스트 보너스를 받은 날짜 (하루 1회)
      defensePlayedOn: null  // 졸업 단어 방어전 보너스를 받은 날짜 (하루 1회, 연습은 무제한)
    };
  }

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (!raw) return defaultState();
      const s = defaultState();
      if (Array.isArray(raw.batches)) s.batches = raw.batches;
      if (Array.isArray(raw.activity)) s.activity = raw.activity;
      if (raw.settings && raw.settings.newPerDay) s.settings.newPerDay = raw.settings.newPerDay;
      if (raw.settings && raw.settings.startId) s.settings.startId = raw.settings.startId;
      if (raw.settings && Array.isArray(raw.settings.selectedThemes)) s.settings.selectedThemes = raw.settings.selectedThemes;
      // 레벨 시스템 도입 전 데이터는 기존 진도로 경험치를 보정해줌
      s.xp = typeof raw.xp === "number" ? raw.xp : estimateXp(s);
      s.perfect = typeof raw.perfect === "number" ? raw.perfect : 0;
      s.best = typeof raw.best === "number" ? raw.best : streak(s);
      // 레벨 테스트(온보딩): 기존 학습 기록이 있으면 이미 완료한 것으로 간주
      s.onboarded = raw.onboarded === true || (Array.isArray(raw.batches) && raw.batches.length > 0);
      s.placement = raw.placement || null;
      if (raw.wordStats && typeof raw.wordStats === "object") s.wordStats = raw.wordStats;
      if (typeof raw.freezes === "number") s.freezes = raw.freezes;
      if (typeof raw.spentXp === "number") s.spentXp = raw.spentXp;
      if (Array.isArray(raw.frozenDays)) s.frozenDays = raw.frozenDays;
      if (typeof raw.questClaimedOn === "string") s.questClaimedOn = raw.questClaimedOn;
      if (typeof raw.defensePlayedOn === "string") s.defensePlayedOn = raw.defensePlayedOn;
      if (raw.settings && typeof raw.settings.autoSpeak === "boolean") s.settings.autoSpeak = raw.settings.autoSpeak;
      return s;
    } catch {
      return defaultState();
    }
  }

  function estimateXp(s) {
    let xp = s.activity.length * XP_RULES.attend;
    for (const b of s.batches) {
      xp += b.wordIds.length * XP_RULES.newWord;
      xp += [1, 2, 3].filter(k => b.reviews[k]).length * b.wordIds.length * XP_RULES.reviewWord;
    }
    return xp;
  }

  // 누적 경험치 → 레벨/진행도 (다음 레벨까지 필요량은 레벨이 오를수록 증가)
  function levelInfo(xp) {
    let level = 1;
    let rest = xp;
    let need = 80 + 20 * level;
    while (rest >= need) {
      rest -= need;
      level++;
      need = 80 + 20 * level;
    }
    return { level: level, cur: rest, need: need };
  }

  function save(s) {
    localStorage.setItem(KEY, JSON.stringify(s));
  }

  function reset() {
    localStorage.removeItem(KEY);
  }

  // 아직 학습하지 않은 단어 중 오늘 외울 새 단어 목록
  // (레벨 테스트로 정한 시작 위치 이전의 쉬운 단어는 "이미 아는 것"으로 보고 건너뜀)
  // 순서는 id가 아니라 rank(커리큘럼 순서) 기준 — data.js의 WORDS_BY_RANK/RANK_OF 참조
  function nextNewWords(s) {
    const used = new Set(s.batches.flatMap(b => b.wordIds));
    const startId = (s.settings && s.settings.startId) || 1;
    const startRank = RANK_OF[startId] || 1;
    let pool = WORDS_BY_RANK.filter(w => w.rank >= startRank && !used.has(w.id));
    const sel = s.settings && s.settings.selectedThemes;
    if (sel && sel.length > 0) {
      const allowed = new Set();
      for (const t of THEMES) {
        if (sel.includes(t.name)) t.ids.forEach(id => allowed.add(id));
      }
      const filtered = pool.filter(w => allowed.has(w.id));
      if (filtered.length > 0) pool = filtered;
    }
    return pool.slice(0, s.settings.newPerDay);
  }

  // 오늘 이미 새 단어를 외웠는가
  function learnedToday(s) {
    return s.batches.some(b => b.learnedOn === todayStr());
  }

  // 오늘 복습이 도래한 배치 목록 (배치당 하루 1개 차수만) — 밀린 일수가 큰(급한) 순서로 정렬
  function dueReviews(s) {
    const out = [];
    for (const b of s.batches) {
      const elapsed = daysBetween(b.learnedOn, todayStr());
      for (const k of [1, 2, 3]) {
        if (!b.reviews[k] && elapsed >= REVIEW_OFFSETS[k]) {
          // 이전 차수 복습을 오늘 이미 했으면 다음 차수는 내일로 미룸
          if (b.reviews[k - 1] === todayStr()) break;
          out.push({ batch: b, stage: k, overdue: elapsed - REVIEW_OFFSETS[k] });
          break;
        }
      }
    }
    out.sort((a, b) => b.overdue - a.overdue);
    return out;
  }

  // 오늘 실제로 보여줄 복습 (상한 적용) — 초과분은 개수만 알려주고 자동 순연
  function dueReviewsToday(s) {
    const all = dueReviews(s);
    return { due: all.slice(0, REVIEW_DAILY_CAP), deferred: Math.max(0, all.length - REVIEW_DAILY_CAP) };
  }

  // 새 단어 암기 완료 → 배치 생성 (+경험치)
  function completeLearn(s, wordIds) {
    s.batches.push({
      id: s.batches.length + 1,
      wordIds: wordIds,
      learnedOn: todayStr(),
      reviews: { 1: null, 2: null, 3: null }
    });
    s.xp += wordIds.length * XP_RULES.newWord;
    markActivity(s);
    save(s);
  }

  // 복습 시험 완료 처리 (+경험치, perfect = 첫 시도 전부 정답)
  function completeReview(s, batchId, stage, perfect) {
    const b = s.batches.find(x => x.id === batchId);
    if (b) {
      b.reviews[stage] = todayStr();
      s.xp += b.wordIds.length * XP_RULES.reviewWord;
    }
    if (perfect) s.perfect++;
    markActivity(s);
    save(s);
  }

  function markActivity(s) {
    const t = todayStr();
    if (!s.activity.includes(t)) {
      s.activity.push(t);
      s.xp += XP_RULES.attend; // 출석 보너스
    }
    const st = streak(s);
    if (st > s.best) s.best = st; // 최고 연속 기록 갱신
  }

  // 그 날짜에 출석했는가 (실제 학습 또는 프리즈로 지켜진 날)
  function wasActive(s, dateStr) {
    return s.activity.includes(dateStr) || (s.frozenDays || []).includes(dateStr);
  }

  // 연속 학습일 계산 (프리즈로 지켜진 날도 이어진 것으로 인정)
  function streak(s) {
    let n = 0;
    const d = new Date();
    // 오늘 아직 학습 안 했어도 어제까지 이어졌으면 유지
    if (!wasActive(s, todayStr(d))) d.setDate(d.getDate() - 1);
    while (wasActive(s, todayStr(d))) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  // ===== 스트릭 프리즈 =====
  // 앱 시작 시 호출: 마지막 출석일과 오늘 사이의 공백을 보유 프리즈로 메운다.
  // 공백이 보유량보다 크면 어차피 끊긴 것이므로 소모하지 않는다. 소모한 일수를 반환.
  function applyFreezes(s) {
    if (!s.freezes || s.activity.length === 0) return 0;
    const gap = [];
    const d = new Date();
    d.setDate(d.getDate() - 1);                      // 어제부터 거꾸로 훑기
    while (!wasActive(s, todayStr(d))) {
      gap.push(todayStr(d));
      if (gap.length > s.freezes) return 0;          // 프리즈로 못 메우는 공백 → 소모 안 함
      d.setDate(d.getDate() - 1);
      // 최초 학습일 이전까지 내려가면 지킬 체인이 없음
      if (todayStr(d) < s.activity[0]) return 0;
    }
    if (gap.length === 0) return 0;                  // 공백 없음
    s.freezes -= gap.length;
    s.frozenDays.push(...gap);
    save(s);
    return gap.length;
  }

  // 프리즈 구매 (XP 소비 — 레벨 계산용 누적 xp는 유지, spentXp로 잔액만 차감)
  function buyFreeze(s) {
    if (s.freezes >= FREEZE_MAX) return false;
    if (xpBalance(s) < FREEZE_COST) return false;
    s.spentXp = (s.spentXp || 0) + FREEZE_COST;
    s.freezes++;
    save(s);
    return true;
  }

  // 쓸 수 있는 XP 잔액
  function xpBalance(s) {
    return s.xp - (s.spentXp || 0);
  }

  // ===== 단어별 이력 =====
  // 퀴즈 첫 시도 결과 기록 (재시험 라운드는 기록하지 않음 — app.js에서 제어)
  function recordAnswer(s, wordId, correct) {
    if (!s.wordStats) s.wordStats = {};
    const st = s.wordStats[wordId] || (s.wordStats[wordId] = { seen: 0, wrong: 0 });
    st.seen++;
    if (!correct) st.wrong++;
    save(s);
  }

  // ===== 리치 큐 (틀린 단어 재출제) =====
  // 미해결 오답(wrong > fixed) 단어를 미해결 횟수 큰 순으로 최대 n개 반환
  // → 다음 새 단어 확인 시험에 "복습 찬스"로 끼워 출제
  function leechWords(s, n) {
    if (!s.wordStats) return [];
    const ids = Object.keys(s.wordStats)
      .filter(id => (s.wordStats[id].wrong || 0) > (s.wordStats[id].fixed || 0))
      .sort((a, b) => {
        const pa = (s.wordStats[a].wrong || 0) - (s.wordStats[a].fixed || 0);
        const pb = (s.wordStats[b].wrong || 0) - (s.wordStats[b].fixed || 0);
        return pb - pa;
      })
      .slice(0, n)
      .map(Number);
    return ids.map(id => WORDS.find(w => w.id === id)).filter(Boolean);
  }

  // 복습 찬스에서 첫 시도 정답 → 미해결 오답 1회 회복
  function markLeechFixed(s, wordId) {
    const st = s.wordStats && s.wordStats[wordId];
    if (!st) return;
    st.fixed = (st.fixed || 0) + 1;
    save(s);
  }

  // ===== 데일리 퀘스트 =====
  // 3종(새 단어·복습·발음 듣기) 모두 달성 시 보너스 XP — 하루 1회
  const QUEST_BONUS_XP = 30;
  function claimDailyQuest(s) {
    if (s.questClaimedOn === todayStr()) return false;
    s.questClaimedOn = todayStr();
    s.xp += QUEST_BONUS_XP;
    save(s);
    return true;
  }

  // ===== 졸업 단어 방어전 =====
  // 3차 복습까지 끝낸(졸업) 단어들 — 장기 기억 유지를 위한 보너스 퀴즈 풀
  const DEFENSE_XP = 15;
  function graduatedWords(s) {
    const ids = s.batches.filter(b => b.reviews[3]).flatMap(b => b.wordIds);
    return ids.map(id => WORDS.find(w => w.id === id)).filter(Boolean);
  }

  // 방어전 완료 처리 — 보너스 XP는 하루 1회, 이후 도전은 XP 없이 연습만.
  // 방어전도 학습 활동이므로 출석(스트릭)으로 인정
  function completeDefense(s) {
    const first = s.defensePlayedOn !== todayStr();
    s.defensePlayedOn = todayStr();
    if (first) s.xp += DEFENSE_XP;
    markActivity(s);
    save(s);
    return first ? DEFENSE_XP : 0;
  }

  // 레벨 테스트 결과를 커리큘럼에 반영 (시작 단어 위치 + 하루 분량)
  function applyPlacement(s, placement) {
    s.placement = placement;               // { key, label, icon, vocab, startId, newPerDay, ... }
    s.settings.startId = placement.startId; // 이 단어부터 새로 외우기 시작
    s.settings.newPerDay = placement.newPerDay;
    s.onboarded = true;
    save(s);
  }

  // 레벨 테스트를 건너뛰고 왕초보(처음부터)로 시작
  function skipOnboarding(s) {
    s.onboarded = true;
    save(s);
  }

  // 레벨 테스트 다시 하기 (진도는 유지, 온보딩 화면만 다시 띄움)
  function clearOnboarding(s) {
    s.onboarded = false;
    save(s);
  }

  // 통계용 요약
  function summary(s) {
    const total = s.batches.reduce((n, b) => n + b.wordIds.length, 0);
    const graduated = s.batches.filter(b => b.reviews[3]).reduce((n, b) => n + b.wordIds.length, 0);
    return {
      totalLearned: total,
      graduated: graduated,
      inProgress: total - graduated,
      streak: streak(s),
      remaining: WORDS.length - total
    };
  }

  return {
    REVIEW_OFFSETS, STAGE_NAMES, XP_RULES,
    FREEZE_COST, FREEZE_MAX, REVIEW_DAILY_CAP, QUEST_BONUS_XP, DEFENSE_XP,
    todayStr, daysBetween,
    load, save, reset,
    nextNewWords, learnedToday, dueReviews, dueReviewsToday,
    completeLearn, completeReview,
    applyFreezes, buyFreeze, xpBalance, recordAnswer,
    leechWords, markLeechFixed, claimDailyQuest,
    graduatedWords, completeDefense,
    applyPlacement, skipOnboarding, clearOnboarding,
    summary, levelInfo
  };
})();
