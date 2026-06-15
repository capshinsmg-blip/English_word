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
    return { batches: [], activity: [], settings: { newPerDay: 5, startId: 1 }, xp: 0, perfect: 0, best: 0, onboarded: false, placement: null };
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
      // 레벨 시스템 도입 전 데이터는 기존 진도로 경험치를 보정해줌
      s.xp = typeof raw.xp === "number" ? raw.xp : estimateXp(s);
      s.perfect = typeof raw.perfect === "number" ? raw.perfect : 0;
      s.best = typeof raw.best === "number" ? raw.best : streak(s);
      // 레벨 테스트(온보딩): 기존 학습 기록이 있으면 이미 완료한 것으로 간주
      s.onboarded = raw.onboarded === true || (Array.isArray(raw.batches) && raw.batches.length > 0);
      s.placement = raw.placement || null;
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
  // (레벨 테스트로 정한 startId 이전의 쉬운 단어는 "이미 아는 것"으로 보고 건너뜀)
  function nextNewWords(s) {
    const used = new Set(s.batches.flatMap(b => b.wordIds));
    const startId = (s.settings && s.settings.startId) || 1;
    return WORDS.filter(w => w.id >= startId && !used.has(w.id)).slice(0, s.settings.newPerDay);
  }

  // 오늘 이미 새 단어를 외웠는가
  function learnedToday(s) {
    return s.batches.some(b => b.learnedOn === todayStr());
  }

  // 오늘 복습이 도래한 배치 목록 (배치당 하루 1개 차수만)
  function dueReviews(s) {
    const out = [];
    for (const b of s.batches) {
      const elapsed = daysBetween(b.learnedOn, todayStr());
      for (const k of [1, 2, 3]) {
        if (!b.reviews[k] && elapsed >= REVIEW_OFFSETS[k]) {
          // 이전 차수 복습을 오늘 이미 했으면 다음 차수는 내일로 미룸
          if (b.reviews[k - 1] === todayStr()) break;
          out.push({ batch: b, stage: k });
          break;
        }
      }
    }
    return out;
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

  // 연속 학습일 계산
  function streak(s) {
    let n = 0;
    const d = new Date();
    // 오늘 아직 학습 안 했어도 어제까지 이어졌으면 유지
    if (!s.activity.includes(todayStr(d))) d.setDate(d.getDate() - 1);
    while (s.activity.includes(todayStr(d))) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
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
    todayStr, daysBetween,
    load, save, reset,
    nextNewWords, learnedToday, dueReviews,
    completeLearn, completeReview,
    applyPlacement, skipOnboarding, clearOnboarding,
    summary, levelInfo
  };
})();
