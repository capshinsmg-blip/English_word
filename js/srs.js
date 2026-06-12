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
    return { batches: [], activity: [], settings: { newPerDay: 5 } };
  }

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (!raw) return defaultState();
      const s = defaultState();
      if (Array.isArray(raw.batches)) s.batches = raw.batches;
      if (Array.isArray(raw.activity)) s.activity = raw.activity;
      if (raw.settings && raw.settings.newPerDay) s.settings.newPerDay = raw.settings.newPerDay;
      return s;
    } catch {
      return defaultState();
    }
  }

  function save(s) {
    localStorage.setItem(KEY, JSON.stringify(s));
  }

  function reset() {
    localStorage.removeItem(KEY);
  }

  // 아직 학습하지 않은 단어 중 오늘 외울 새 단어 목록
  function nextNewWords(s) {
    const used = new Set(s.batches.flatMap(b => b.wordIds));
    return WORDS.filter(w => !used.has(w.id)).slice(0, s.settings.newPerDay);
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

  // 새 단어 암기 완료 → 배치 생성
  function completeLearn(s, wordIds) {
    s.batches.push({
      id: s.batches.length + 1,
      wordIds: wordIds,
      learnedOn: todayStr(),
      reviews: { 1: null, 2: null, 3: null }
    });
    markActivity(s);
    save(s);
  }

  // 복습 시험 완료 처리
  function completeReview(s, batchId, stage) {
    const b = s.batches.find(x => x.id === batchId);
    if (b) b.reviews[stage] = todayStr();
    markActivity(s);
    save(s);
  }

  function markActivity(s) {
    const t = todayStr();
    if (!s.activity.includes(t)) s.activity.push(t);
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
    REVIEW_OFFSETS, STAGE_NAMES,
    todayStr, daysBetween,
    load, save, reset,
    nextNewWords, learnedToday, dueReviews,
    completeLearn, completeReview,
    summary
  };
})();
