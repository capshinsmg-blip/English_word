// 앱 UI 로직
(() => {
  const $screen = document.getElementById("screen");
  const $streak = document.getElementById("streak-badge");
  let state = SRS.load();

  // ===== 캐릭터 진화 단계 (레벨 도달 시 진화) =====
  const EVOS = [
    { lv: 1, icon: "🥚", name: "알" },
    { lv: 3, icon: "🐣", name: "병아리" },
    { lv: 6, icon: "🐥", name: "꼬마새" },
    { lv: 10, icon: "🦜", name: "수다왕 앵무" },
    { lv: 15, icon: "🦉", name: "지혜 부엉이" },
    { lv: 20, icon: "🦅", name: "하늘제왕 독수리" },
    { lv: 30, icon: "🐉", name: "전설의 용" }
  ];

  function evoFor(level) {
    let cur = EVOS[0];
    for (const e of EVOS) if (level >= e.lv) cur = e;
    return cur;
  }

  function nextEvo(level) {
    return EVOS.find(e => e.lv > level) || null;
  }

  // ===== 뱃지 (달성 조건) =====
  const BADGES = [
    { icon: "🌱", name: "첫 걸음", desc: "첫 단어 학습", test: (s, sum) => sum.totalLearned > 0 },
    { icon: "🔥", name: "7일 연속", desc: "연속 7일 출석", test: s => s.best >= 7 },
    { icon: "🌋", name: "30일 연속", desc: "연속 30일 출석", test: s => s.best >= 30 },
    { icon: "📖", name: "단어 50", desc: "누적 50개 학습", test: (s, sum) => sum.totalLearned >= 50 },
    { icon: "📚", name: "단어 100", desc: "누적 100개 학습", test: (s, sum) => sum.totalLearned >= 100 },
    { icon: "🏰", name: "단어 300", desc: "누적 300개 학습", test: (s, sum) => sum.totalLearned >= 300 },
    { icon: "🎓", name: "첫 졸업", desc: "3차 복습까지 완료", test: (s, sum) => sum.graduated > 0 },
    { icon: "👑", name: "졸업 50", desc: "졸업 단어 50개", test: (s, sum) => sum.graduated >= 50 },
    { icon: "💯", name: "퍼펙트", desc: "복습 첫 시도 100%", test: s => s.perfect >= 1 },
    { icon: "🏆", name: "퍼펙트 10", desc: "퍼펙트 10회", test: s => s.perfect >= 10 },
    { icon: "⭐", name: "레벨 5", desc: "레벨 5 도달", test: s => SRS.levelInfo(s.xp).level >= 5 },
    { icon: "🌟", name: "레벨 10", desc: "레벨 10 도달", test: s => SRS.levelInfo(s.xp).level >= 10 }
  ];

  // 캐릭터 + 경험치 바 카드 HTML
  function charCardHtml(compact) {
    const info = SRS.levelInfo(state.xp);
    const evo = evoFor(info.level);
    const next = nextEvo(info.level);
    const pct = Math.min(100, Math.round((info.cur / info.need) * 100));
    return `
      <div class="char-card${compact ? " compact" : ""}">
        <div class="char-icon">${evo.icon}</div>
        <div class="char-info">
          <div class="char-name"><span class="char-lv">Lv.${info.level}</span> ${evo.name}</div>
          <div class="xp-bar"><div class="xp-fill" style="width:${pct}%"></div></div>
          <div class="xp-text">${info.cur} / ${info.need} XP${next ? ` · Lv.${next.lv}에 ${next.icon} 진화!` : " · 최종 진화 완료!"}</div>
        </div>
      </div>`;
  }

  // ===== 유틸 =====
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function wordsByIds(ids) {
    return ids.map(id => WORDS.find(w => w.id === id)).filter(Boolean);
  }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function updateStreak() {
    $streak.textContent = `🔥 ${SRS.summary(state).streak}일`;
  }

  // ===== 발음 듣기 (Web Speech API — 브라우저 내장 TTS) =====
  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel(); // 이전 재생 중단
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.95;
    speechSynthesis.speak(u);
  }

  function speakBtn(text, small) {
    return `<button class="speak-btn${small ? " sm" : ""}" data-say="${esc(text)}" aria-label="발음 듣기">🔊</button>`;
  }

  // 화면이 바뀌어도 동작하도록 문서 전체에서 클릭 위임
  document.addEventListener("click", e => {
    const btn = e.target.closest(".speak-btn");
    if (btn) speak(btn.dataset.say);
  });

  // ===== 탭 =====
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      track("tab_view", { tab });
      if (tab === "home") renderHome();
      else if (tab === "dict") { dictSel = null; renderWordList(); }
      else if (tab === "stats") renderStats();
      else renderSettings();
    });
  });

  function goHomeTab() {
    document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === "home"));
    renderHome();
  }

  // 로그인/로그아웃 등 클라우드 상태가 바뀌면, 설정 화면을 보고 있을 때 다시 그려준다
  window.addEventListener("cloud-auth", () => {
    const active = document.querySelector(".tab.active");
    if (active && active.dataset.tab === "settings") renderSettings();
  });

  // ===== 레벨 테스트 (가입/첫 실행 온보딩) =====
  // 단어 id가 클수록 어렵고 덜 빈출 → 난이도 사다리로 10개를 뽑아 자가진단
  const PLACEMENT_LADDER = [25, 130, 300, 480, 700, 980, 1350, 1750, 2250, 2800];
  const LEVELS = [
    { key: "beginner",     icon: "🐣", label: "입문 (왕초보)", max: 299,      newPerDay: 5,  desc: "기초 회화 단어부터 차근차근 시작해요!" },
    { key: "elementary",   icon: "🌱", label: "초급",          max: 799,      newPerDay: 5,  desc: "일상에서 자주 쓰는 단어로 탄탄하게!" },
    { key: "intermediate", icon: "🌿", label: "중급",          max: 1499,     newPerDay: 8,  desc: "표현의 폭을 넓혀 더 자연스럽게!" },
    { key: "upper",        icon: "🌳", label: "중상급",        max: 2299,     newPerDay: 8,  desc: "고급 표현에 본격적으로 도전!" },
    { key: "advanced",     icon: "🏆", label: "고급",          max: Infinity, newPerDay: 10, desc: "전문·심화 어휘까지 완전 정복!" }
  ];

  let placeCtx = null;

  function renderOnboarding() {
    document.body.classList.add("onboarding");
    $screen.innerHTML = `
      <div class="onb intro">
        <div class="onb-emoji">🎯</div>
        <h2>내 영어 단어 레벨 테스트</h2>
        <p class="onb-sub">딱 10단어, 1분이면 끝나요.<br>내 수준에 <b>딱 맞는 단어</b>부터 외우게 도와드릴게요!</p>
        <div class="onb-hooks">
          <div class="onb-hook"><span>📊</span> 내 예상 어휘량 분석</div>
          <div class="onb-hook"><span>📅</span> 레벨별 맞춤 커리큘럼</div>
          <div class="onb-hook"><span>⏩</span> 이미 아는 단어는 건너뛰기</div>
        </div>
        <button class="btn btn-primary btn-block" id="onb-start">테스트 시작하기 →</button>
        <button class="btn btn-ghost btn-block" id="onb-skip" style="margin-top:8px">건너뛰고 왕초보로 시작</button>
      </div>`;
    document.getElementById("onb-start").addEventListener("click", startPlacement);
    document.getElementById("onb-skip").addEventListener("click", () => {
      SRS.skipOnboarding(state); state = SRS.load(); finishOnboarding();
    });
  }

  function startPlacement() {
    const words = PLACEMENT_LADDER.map(id => WORDS.find(w => w.id === id)).filter(Boolean);
    placeCtx = { words, idx: 0, answers: [], lastWord: null };
    renderPlaceQ();
  }

  function renderPlaceQ() {
    const { words, idx, lastWord } = placeCtx;
    const w = words[idx];
    const pct = Math.round((idx / words.length) * 100);
    $screen.innerHTML = `
      <div class="onb test">
        <div class="onb-bar"><div class="onb-bar-fill" style="width:${pct}%"></div></div>
        <div class="onb-qnum">${idx + 1} / ${words.length}</div>
        ${lastWord
          ? `<div class="onb-recall">방금 본 단어 · <b>${esc(lastWord.w)}</b> = ${esc(lastWord.m)}</div>`
          : `<div class="onb-recall hint">아는 만큼 솔직하게 골라주세요 🙂</div>`}
        <div class="onb-word">${esc(w.w)} ${speakBtn(w.w)}</div>
        <div class="onb-pron">${esc(w.p)}</div>
        <div class="onb-ask">이 단어, 뜻을 알고 있나요?</div>
        <div class="onb-choices">
          <button class="btn onb-know" data-known="1">😎 알아요</button>
          <button class="btn onb-no" data-known="0">🤔 몰라요</button>
        </div>
      </div>`;
    $screen.querySelectorAll(".onb-choices button").forEach(b => {
      b.addEventListener("click", () => {
        placeCtx.answers.push({ id: w.id, known: b.dataset.known === "1" });
        placeCtx.lastWord = w;
        placeCtx.idx++;
        if (placeCtx.idx < words.length) renderPlaceQ();
        else renderAnalyzing();
      });
    });
  }

  function renderAnalyzing() {
    $screen.innerHTML = `
      <div class="onb analyzing">
        <div class="onb-spinner">📊</div>
        <h2>결과 분석 중...</h2>
        <p class="onb-sub">딱 맞는 커리큘럼을 짜고 있어요</p>
      </div>`;
    setTimeout(() => renderPlaceResult(computePlacement(placeCtx.answers)), 1300);
  }

  // 쉬운→어려운 순서로 답을 훑어, 2번 연속 모르기 전까지 아는 가장 어려운 단어 위치로 레벨 산정
  function computePlacement(answers) {
    let lastKnown = 0, misses = 0;
    for (const a of answers) {
      if (a.known) { lastKnown = a.id; misses = 0; }
      else { misses++; if (misses >= 2) break; }
    }
    const lv = LEVELS.find(l => lastKnown <= l.max) || LEVELS[LEVELS.length - 1];
    const startId = Math.min(lastKnown + 1, WORDS.length);
    const vocab = Math.max(30, Math.round(lastKnown / 50) * 50);
    const totalDays = Math.ceil((WORDS.length - startId + 1) / lv.newPerDay);
    return { key: lv.key, icon: lv.icon, label: lv.label, desc: lv.desc, vocab, startId, newPerDay: lv.newPerDay, totalDays };
  }

  function renderPlaceResult(p) {
    const skipCount = p.startId - 1;
    $screen.innerHTML = `
      <div class="onb result">
        <div class="onb-emoji pop">${p.icon}</div>
        <div class="onb-sub">당신의 단어 레벨은</div>
        <h2 class="onb-level">${p.label}</h2>
        <div class="onb-vocab">예상 어휘량 <b>약 ${p.vocab.toLocaleString()}단어</b></div>
        <p class="onb-desc">${esc(p.desc)}</p>
        <div class="onb-plan">
          <div class="onb-plan-row"><span>📅 하루 학습량</span><b>${p.newPerDay}단어</b></div>
          <div class="onb-plan-row"><span>⏩ 건너뛰는 쉬운 단어</span><b>${skipCount.toLocaleString()}개</b></div>
          <div class="onb-plan-row"><span>🏁 전체 코스</span><b>약 ${p.totalDays.toLocaleString()}일</b></div>
        </div>
        <button class="btn btn-primary btn-block" id="onb-go">이 커리큘럼으로 시작하기 🚀</button>
        <button class="btn btn-ghost btn-block" id="onb-retry" style="margin-top:8px">다시 테스트</button>
      </div>`;
    document.getElementById("onb-go").addEventListener("click", () => {
      SRS.applyPlacement(state, p); state = SRS.load(); finishOnboarding();
    });
    document.getElementById("onb-retry").addEventListener("click", renderOnboarding);
  }

  function finishOnboarding() {
    document.body.classList.remove("onboarding");
    goHomeTab();
  }

  // ===== 홈 화면 =====
  function renderHome() {
    state = SRS.load();
    updateStreak();

    const newWords = SRS.nextNewWords(state);
    const learnedToday = SRS.learnedToday(state);
    const reviews = SRS.dueReviews(state);

    let html = `
      <div class="greeting">
        <h2>오늘의 학습 🎯</h2>
        <p>${SRS.todayStr()} · 에빙하우스 곡선으로 똑똑하게 외우기</p>
      </div>
      ${charCardHtml(true)}`;

    // 새 단어 카드
    if (learnedToday) {
      html += `
        <div class="card done">
          <span class="badge badge-done">완료</span>
          <div class="card-title">✅ 오늘의 새 단어</div>
          <div class="card-sub">오늘 분량을 다 외웠어요. 내일 새 단어가 열려요!</div>
        </div>`;
    } else if (newWords.length > 0) {
      html += `
        <div class="card">
          <span class="badge badge-new">NEW</span>
          <div class="card-row">
            <div>
              <div class="card-title">📖 새 단어 ${newWords.length}개 외우기</div>
              <div class="card-sub">${newWords.map(w => esc(w.w)).join(", ")}</div>
            </div>
            <button class="btn btn-primary btn-sm" id="btn-learn">시작</button>
          </div>
        </div>`;
    } else {
      html += `
        <div class="card done">
          <div class="card-title">🎉 모든 단어를 학습했어요!</div>
          <div class="card-sub">곧 새 단어가 추가될 예정이에요.</div>
        </div>`;
    }

    // 복습 카드들
    if (reviews.length > 0) {
      for (const r of reviews) {
        const ws = wordsByIds(r.batch.wordIds);
        html += `
          <div class="card">
            <span class="badge badge-r${r.stage}">${SRS.STAGE_NAMES[r.stage]}</span>
            <div class="card-row">
              <div>
                <div class="card-title">✏️ ${r.batch.learnedOn} 단어 시험</div>
                <div class="card-sub">${ws.map(w => esc(w.w)).join(", ")}</div>
              </div>
              <button class="btn btn-green btn-sm btn-review" data-batch="${r.batch.id}" data-stage="${r.stage}">시험</button>
            </div>
          </div>`;
      }
    } else {
      html += `
        <div class="card done">
          <div class="card-title">📭 오늘 복습할 단어 없음</div>
          <div class="card-sub">복습 시기가 되면 여기에 시험이 나타나요. (1일 → 7일 → 30일)</div>
        </div>`;
    }

    if (!learnedToday && reviews.length === 0 && newWords.length === 0) {
      html += `<div class="empty"><div class="emoji">🌙</div>오늘 할 일을 모두 끝냈어요!</div>`;
    }

    $screen.innerHTML = html;

    const btnLearn = document.getElementById("btn-learn");
    if (btnLearn) btnLearn.addEventListener("click", () => startLearn(newWords));
    document.querySelectorAll(".btn-review").forEach(btn => {
      btn.addEventListener("click", () => {
        const batch = state.batches.find(b => b.id === Number(btn.dataset.batch));
        startQuiz(wordsByIds(batch.wordIds), { batchId: batch.id, stage: Number(btn.dataset.stage) });
      });
    });
  }

  // ===== 학습 화면 (새 단어 카드 넘기기) =====
  let learnCtx = null;

  function startLearn(words) {
    learnCtx = { words, idx: 0 };
    track("learn_start", { count: words.length });
    renderLearnCard();
  }

  function renderLearnCard() {
    const { words, idx } = learnCtx;
    const w = words[idx];
    const isLast = idx === words.length - 1;

    $screen.innerHTML = `
      <div class="learn-progress">새 단어 암기 · ${idx + 1} / ${words.length}</div>
      <div class="word-card">
        <div class="word">${esc(w.w)} ${speakBtn(w.w)}</div>
        <div class="pron">${esc(w.p)}</div>
        <div class="mean">${esc(w.m)}</div>
        ${w.ex.map(e => `
          <div class="example">
            <div class="en">${esc(e[0])} ${speakBtn(e[0], true)}</div>
            <div class="ko">${esc(e[1])}</div>
          </div>`).join("")}
      </div>
      <div class="learn-nav">
        <button class="btn btn-ghost" id="btn-prev" ${idx === 0 ? "disabled" : ""}>← 이전</button>
        <button class="btn ${isLast ? "btn-green" : "btn-primary"}" id="btn-next">
          ${isLast ? "암기 완료 → 바로 확인 시험" : "다음 →"}
        </button>
      </div>`;

    document.getElementById("btn-prev").addEventListener("click", () => {
      if (learnCtx.idx > 0) { learnCtx.idx--; renderLearnCard(); }
    });
    document.getElementById("btn-next").addEventListener("click", () => {
      if (isLast) {
        // 첫 암기 완료 → 배치 생성 후 바로 확인 시험 (스케줄에는 영향 없음)
        const xpBefore = state.xp;
        SRS.completeLearn(state, learnCtx.words.map(w => w.id));
        state = SRS.load();
        updateStreak();
        track("learn_complete", { count: learnCtx.words.length });
        startQuiz(learnCtx.words, { batchId: null, stage: 0, learnXp: state.xp - xpBefore });
      } else {
        learnCtx.idx++;
        renderLearnCard();
      }
    });
  }

  // ===== 퀴즈 (시험 → 틀린 단어 재암기 → 재시험) =====
  let quiz = null;

  function startQuiz(words, meta) {
    quiz = {
      meta,                       // { batchId, stage } (stage 0 = 첫 암기 직후 확인 시험)
      queue: shuffle(words),      // 이번 라운드 출제 단어
      idx: 0,
      wrong: [],                  // 이번 라운드에서 틀린 단어
      firstTotal: words.length,
      firstCorrect: 0,
      round: 1
    };
    track("quiz_start", { stage: meta.stage });
    renderQuizQuestion();
  }

  function makeChoices(word) {
    const wrongPool = shuffle(WORDS.filter(x => x.id !== word.id)).slice(0, 3).map(x => x.m);
    return shuffle([word.m, ...wrongPool]);
  }

  function renderQuizQuestion() {
    const w = quiz.queue[quiz.idx];
    const choices = makeChoices(w);
    const stageName = quiz.meta.stage === 0 ? "확인 시험" : SRS.STAGE_NAMES[quiz.meta.stage];

    $screen.innerHTML = `
      <div class="learn-progress">${stageName}${quiz.round > 1 ? ` · 재시험 ${quiz.round - 1}회차` : ""} · ${quiz.idx + 1} / ${quiz.queue.length}</div>
      <div class="quiz-q">
        <div class="label">이 단어의 뜻은?</div>
        <div class="word">${esc(w.w)} ${speakBtn(w.w)}</div>
      </div>
      <div class="choices">
        ${choices.map(c => `<button class="choice" data-mean="${esc(c)}">${esc(c)}</button>`).join("")}
      </div>
      <div class="quiz-feedback" id="feedback"></div>
      <button class="btn btn-primary btn-block" id="btn-quiz-next" style="display:none">다음 →</button>`;

    const $fb = document.getElementById("feedback");
    const $next = document.getElementById("btn-quiz-next");

    document.querySelectorAll(".choice").forEach(btn => {
      btn.addEventListener("click", () => {
        const picked = btn.dataset.mean;
        const correct = picked === w.m;
        document.querySelectorAll(".choice").forEach(b => {
          b.disabled = true;
          if (b.dataset.mean === w.m) b.classList.add("correct");
        });
        if (correct) {
          $fb.textContent = "⭕ 정답!";
          $fb.className = "quiz-feedback ok";
          if (quiz.round === 1) quiz.firstCorrect++;
        } else {
          btn.classList.add("wrong");
          $fb.textContent = `❌ 오답! 정답: ${w.m}`;
          $fb.className = "quiz-feedback no";
          quiz.wrong.push(w);
        }
        $next.style.display = "block";
      });
    });

    $next.addEventListener("click", () => {
      quiz.idx++;
      if (quiz.idx < quiz.queue.length) {
        renderQuizQuestion();
      } else if (quiz.wrong.length > 0) {
        renderRestudy();
      } else {
        finishQuiz();
      }
    });
  }

  // 틀린 단어 재암기 화면
  function renderRestudy() {
    $screen.innerHTML = `
      <div class="learn-progress">😅 틀린 단어 ${quiz.wrong.length}개 다시 외우기</div>
      ${quiz.wrong.map(w => `
        <div class="card">
          <div class="card-title">${esc(w.w)} ${speakBtn(w.w, true)} <span style="font-weight:400;font-size:13px;color:var(--text-sub)">${esc(w.p)}</span></div>
          <div class="batch-words">${esc(w.m)}</div>
          <div class="example">
            <div class="en">${esc(w.ex[0][0])} ${speakBtn(w.ex[0][0], true)}</div>
            <div class="ko">${esc(w.ex[0][1])}</div>
          </div>
        </div>`).join("")}
      <button class="btn btn-green btn-block" id="btn-requiz">다 외웠어요 → 재시험</button>`;

    document.getElementById("btn-requiz").addEventListener("click", () => {
      quiz.queue = shuffle(quiz.wrong);
      quiz.wrong = [];
      quiz.idx = 0;
      quiz.round++;
      renderQuizQuestion();
    });
  }

  function finishQuiz() {
    const { meta, firstTotal, firstCorrect } = quiz;
    const perfect = firstCorrect === firstTotal;
    let xpGained = meta.learnXp || 0;
    if (meta.stage >= 1 && meta.batchId) {
      const xpBefore = state.xp;
      SRS.completeReview(state, meta.batchId, meta.stage, perfect);
      state = SRS.load();
      xpGained = state.xp - xpBefore;
    }
    updateStreak();

    const rate = Math.round((firstCorrect / firstTotal) * 100);
    const isFirstLearn = meta.stage === 0;
    track("quiz_complete", { stage: meta.stage, rate, perfect: perfect ? 1 : 0 });
    $screen.innerHTML = `
      <div class="result-box">
        <div class="emoji">${rate === 100 ? "🏆" : "💪"}</div>
        <h2>${isFirstLearn ? "오늘의 새 단어 암기 완료!" : SRS.STAGE_NAMES[meta.stage] + " 완료!"}</h2>
        ${xpGained > 0 ? `<div class="xp-gain">⚡ +${xpGained} XP${perfect && !isFirstLearn ? " · 💯 퍼펙트!" : ""}</div>` : ""}
        <p>첫 시도 정답률 ${rate}% (${firstCorrect}/${firstTotal})<br>
        ${isFirstLearn ? "내일 1차 복습 시험이 열려요." : nextReviewMessage(meta.stage)}</p>
        ${charCardHtml(true)}
        <button class="btn btn-primary btn-block" id="btn-home" style="margin-top:14px">홈으로</button>
      </div>`;
    document.getElementById("btn-home").addEventListener("click", goHomeTab);
  }

  function nextReviewMessage(stage) {
    if (stage === 1) return "7일 뒤 2차 복습이 열려요.";
    if (stage === 2) return "30일 뒤 3차(마지막) 복습이 열려요.";
    return "이 단어들은 졸업했어요! 🎓";
  }

  // ===== 나의 학습 화면 =====
  function renderStats() {
    state = SRS.load();
    const s = SRS.summary(state);
    const earned = BADGES.filter(b => b.test(state, s)).length;

    let html = `
      <div class="greeting"><h2>나의 학습 📖</h2><p>꾸준함이 캐릭터를 키워요</p></div>
      ${charCardHtml(false)}
      <div class="stat-grid three">
        <div class="stat-box"><div class="num">${s.totalLearned}</div><div class="lbl">학습한 단어</div></div>
        <div class="stat-box"><div class="num">${s.graduated}</div><div class="lbl">졸업한 단어 🎓</div></div>
        <div class="stat-box"><div class="num">${s.streak}</div><div class="lbl">연속 학습일 🔥</div></div>
      </div>
      <h3 class="section-title">뱃지 <span class="section-sub">${earned} / ${BADGES.length}</span></h3>
      <div class="badge-grid">
        ${BADGES.map(b => {
          const ok = b.test(state, s);
          return `
            <div class="badge-item ${ok ? "" : "locked"}">
              <div class="bi-icon">${b.icon}</div>
              <div class="bi-name">${b.name}</div>
              <div class="bi-desc">${b.desc}</div>
            </div>`;
        }).join("")}
      </div>
      <h3 class="section-title">학습 기록</h3>`;

    if (state.batches.length > 0) {
      html += `<div class="batch-list">`;
      for (const b of state.batches.slice().reverse()) {
        const ws = wordsByIds(b.wordIds);
        const doneCount = [1, 2, 3].filter(k => b.reviews[k]).length;
        const status = b.reviews[3] ? "🎓 졸업" : `복습 ${doneCount}/3`;
        html += `
          <div class="card">
            <div class="card-row">
              <div>
                <div class="card-sub">${b.learnedOn} 학습</div>
                <div class="batch-words">${ws.map(w => esc(w.w)).join(", ")}</div>
              </div>
              <span class="badge ${b.reviews[3] ? "badge-done" : "badge-new"}" style="margin:0">${status}</span>
            </div>
          </div>`;
      }
      html += `</div>`;
    } else {
      html += `<div class="empty"><div class="emoji">🌱</div>아직 학습 기록이 없어요.<br>홈에서 첫 단어를 외워보세요!</div>`;
    }

    $screen.innerHTML = html;
  }

  // 로그인/클라우드 저장 카드 (Supabase 미설정 시 자동 숨김)
  function accountCardHtml() {
    const C = window.Cloud;
    if (!C || !C.enabled) return "";
    const u = C.getUser();
    if (u) {
      const name = (u.user_metadata && (u.user_metadata.name || u.user_metadata.full_name)) || u.email || "사용자";
      return `
        <div class="card">
          <div class="setting-row">
            <div>
              <div class="card-title" style="font-size:15px">☁️ 클라우드 저장 켜짐</div>
              <div class="card-sub">${esc(name)} · 진도가 자동으로 저장돼요</div>
            </div>
            <button class="btn btn-ghost btn-sm" id="btn-logout">로그아웃</button>
          </div>
        </div>`;
    }
    return `
      <div class="card">
        <div class="card-title" style="font-size:15px">☁️ 진도 클라우드 저장</div>
        <div class="card-sub" style="margin:6px 0 12px">로그인하면 기기를 바꿔도 학습 진도가 그대로 이어져요.</div>
        <button class="btn btn-primary btn-block" id="btn-login-google">구글로 로그인</button>
      </div>`;
  }

  // ===== 설정 화면 =====
  function renderSettings() {
    state = SRS.load();
    $screen.innerHTML = `
      <div class="greeting"><h2>설정 ⚙️</h2><p>학습 방식을 조절해요</p></div>
      ${accountCardHtml()}
      <div class="card">
        <div class="setting-row">
          <div>
            <div class="card-title" style="font-size:15px">하루 새 단어 개수</div>
            <div class="card-sub">기본 5개 추천</div>
          </div>
          <select id="sel-perday">
            ${[3, 5, 7, 10].map(n => `<option value="${n}" ${state.settings.newPerDay === n ? "selected" : ""}>${n}개</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="card">
        <div class="setting-row">
          <div>
            <div class="card-title" style="font-size:15px">내 단어 레벨</div>
            <div class="card-sub">${state.placement ? `${state.placement.icon} ${state.placement.label} · 예상 어휘량 약 ${Number(state.placement.vocab).toLocaleString()}단어` : "레벨 테스트 미완료"}</div>
          </div>
          <button class="btn btn-ghost btn-sm" id="btn-retest">다시 테스트</button>
        </div>
      </div>
      <div class="card">
        <div class="setting-row">
          <div>
            <div class="card-title" style="font-size:15px">학습 기록 초기화</div>
            <div class="card-sub">모든 진도가 삭제돼요 (단어 데이터는 유지)</div>
          </div>
          <button class="btn btn-danger btn-sm" id="btn-reset">초기화</button>
        </div>
      </div>
      <div class="card">
        <div class="card-sub" style="text-align:center">
          하루보카 v0.1<br>에빙하우스 망각곡선 기반 영어회화 단어암기
        </div>
      </div>`;

    const btnGoogle = document.getElementById("btn-login-google");
    if (btnGoogle) btnGoogle.addEventListener("click", () => window.Cloud.signInGoogle());
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) btnLogout.addEventListener("click", async () => {
      await window.Cloud.signOut();
      renderSettings();
    });

    document.getElementById("sel-perday").addEventListener("change", e => {
      state.settings.newPerDay = Number(e.target.value);
      SRS.save(state);
    });
    document.getElementById("btn-retest").addEventListener("click", () => {
      SRS.clearOnboarding(state);
      state = SRS.load();
      renderOnboarding();
    });
    document.getElementById("btn-reset").addEventListener("click", () => {
      if (confirm("정말 모든 학습 기록을 초기화할까요?")) {
        SRS.reset();
        state = SRS.load();
        goHomeTab();
      }
    });
  }

  // ===== 단어장 (상황별 카테고리 → 단어 페이지) =====
  let dictSel = null; // null = 카테고리 목록 화면, 아니면 { name, ids } = 단어 페이지

  function wordStatusBadge(id) {
    for (const b of state.batches) {
      if (b.wordIds.includes(id)) {
        if (b.reviews[3]) return `<span class="badge badge-done">🎓 졸업</span>`;
        const done = [1, 2, 3].filter(k => b.reviews[k]).length;
        return `<span class="badge badge-r1">학습중 ${done}/3</span>`;
      }
    }
    if (id < ((state.settings && state.settings.startId) || 1)) return `<span class="badge badge-known">이미 알아요</span>`;
    return `<span class="badge badge-new">미학습</span>`;
  }

  function wordItemHtml(w) {
    return `
      <details class="word-item">
        <summary>
          <div class="wi-main">
            <div class="wi-word">${esc(w.w)} <span class="wi-pron">${esc(w.p)}</span></div>
            <div class="wi-mean">${esc(w.m)}</div>
          </div>
          ${wordStatusBadge(w.id)}
        </summary>
        <div class="wi-body">
          ${w.ex.map(e => `
            <div class="example">
              <div class="en">${esc(e[0])} ${speakBtn(e[0], true)}</div>
              <div class="ko">${esc(e[1])}</div>
            </div>`).join("")}
        </div>
      </details>`;
  }

  function renderWordList() {
    state = SRS.load();
    if (dictSel) renderWordPage();
    else renderWordIndex();
  }

  // 카테고리 목록 화면 (상황별 그룹 → 주제 카드)
  function renderWordIndex() {
    $screen.innerHTML = `
      <div class="greeting"><h2>단어장 📖</h2><p>주제를 고르면 그 단어만 모아서 보여줘요 · 총 ${WORDS.length.toLocaleString()}개</p></div>
      <input type="search" id="word-search" class="search-input" placeholder="🔍 전체 단어에서 검색">
      <div id="dict-body"></div>`;

    const $search = document.getElementById("word-search");
    const $body = document.getElementById("dict-body");

    function openTheme(theme) { dictSel = theme; renderWordList(); }

    function renderCategories() {
      let html = `
        <button class="cat-card all" data-all="1">
          <span class="cat-emoji">📚</span>
          <span class="cat-text"><span class="cat-name">전체 단어 보기</span><span class="cat-count">${WORDS.length.toLocaleString()}개</span></span>
          <span class="cat-arrow">›</span>
        </button>`;
      for (const g of THEME_GROUPS) {
        html += `<div class="cat-section">${esc(g.name)}</div><div class="cat-grid">`;
        for (const t of g.themes) {
          html += `
            <button class="cat-card" data-theme="${esc(t.name)}">
              <span class="cat-text"><span class="cat-name">${esc(t.name)}</span><span class="cat-count">${t.ids.length}개</span></span>
              <span class="cat-arrow">›</span>
            </button>`;
        }
        html += `</div>`;
      }
      $body.innerHTML = html;
      $body.querySelectorAll(".cat-card").forEach(c => {
        c.addEventListener("click", () => {
          if (c.dataset.all) openTheme({ name: "전체 단어", ids: WORDS.map(w => w.id) });
          else openTheme(THEMES.find(t => t.name === c.dataset.theme));
        });
      });
    }

    function renderSearch(q) {
      const items = WORDS.filter(w => w.w.toLowerCase().includes(q) || w.m.toLowerCase().includes(q));
      $body.innerHTML = `<p class="card-sub" style="margin:4px 0 10px">검색 결과 ${items.length}개</p>` +
        (items.map(wordItemHtml).join("") || `<div class="empty"><div class="emoji">🔍</div>검색 결과가 없어요.</div>`);
    }

    $search.addEventListener("input", () => {
      const q = $search.value.trim().toLowerCase();
      if (q) renderSearch(q); else renderCategories();
    });
    renderCategories();
  }

  // 선택한 주제의 단어만 모아 보여주는 별도 페이지
  function renderWordPage() {
    const ids = new Set(dictSel.ids);
    const all = WORDS.filter(w => ids.has(w.id));
    $screen.innerHTML = `
      <button class="back-btn" id="dict-back">← 단어장</button>
      <div class="greeting"><h2>${esc(dictSel.name)}</h2><p>${all.length.toLocaleString()}개 · 단어를 누르면 예문이 펼쳐져요</p></div>
      <input type="search" id="word-search" class="search-input" placeholder="🔍 이 주제 안에서 검색">
      <div id="word-list"></div>`;

    const $list = document.getElementById("word-list");
    const $search = document.getElementById("word-search");

    function renderItems() {
      const q = $search.value.trim().toLowerCase();
      const items = all.filter(w => !q || w.w.toLowerCase().includes(q) || w.m.toLowerCase().includes(q));
      $list.innerHTML = items.map(wordItemHtml).join("") || `<div class="empty"><div class="emoji">🔍</div>검색 결과가 없어요.</div>`;
    }

    renderItems();
    $search.addEventListener("input", renderItems);
    document.getElementById("dict-back").addEventListener("click", () => { dictSel = null; renderWordList(); });
  }

  // ===== PWA 서비스워커 등록 =====
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  // 클라우드(cloud.js)에서 더 최신 진도를 받아왔을 때 호출 — 현재 상태로 화면을 다시 그린다
  window.AppUI = {
    reload() {
      state = SRS.load();
      updateStreak();
      if (!state.onboarded) renderOnboarding();
      else goHomeTab();
    }
  };

  // 시작 — 첫 실행(레벨 테스트 전)이면 온보딩, 아니면 홈
  state = SRS.load();
  if (!state.onboarded) renderOnboarding();
  else renderHome();
})();
