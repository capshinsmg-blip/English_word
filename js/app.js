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
      else if (tab === "dict") renderWordList();
      else if (tab === "stats") renderStats();
      else renderSettings();
    });
  });

  function goHomeTab() {
    document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === "home"));
    renderHome();
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

  // ===== 설정 화면 =====
  function renderSettings() {
    state = SRS.load();
    $screen.innerHTML = `
      <div class="greeting"><h2>설정 ⚙️</h2><p>학습 방식을 조절해요</p></div>
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

    document.getElementById("sel-perday").addEventListener("change", e => {
      state.settings.newPerDay = Number(e.target.value);
      SRS.save(state);
    });
    document.getElementById("btn-reset").addEventListener("click", () => {
      if (confirm("정말 모든 학습 기록을 초기화할까요?")) {
        SRS.reset();
        state = SRS.load();
        goHomeTab();
      }
    });
  }

  // ===== 단어장 (전체 공개 — 테마 선택 + 검색) =====
  function wordStatusBadge(id) {
    for (const b of state.batches) {
      if (b.wordIds.includes(id)) {
        if (b.reviews[3]) return `<span class="badge badge-done">🎓 졸업</span>`;
        const done = [1, 2, 3].filter(k => b.reviews[k]).length;
        return `<span class="badge badge-r1">학습중 ${done}/3</span>`;
      }
    }
    return `<span class="badge badge-new">미학습</span>`;
  }

  let dictTheme = "전체"; // 단어장에서 마지막으로 고른 테마 기억

  function renderWordList() {
    state = SRS.load();
    const themedIds = new Set(THEMES.flatMap(t => t.ids));
    const etcIds = WORDS.filter(w => !themedIds.has(w.id)).map(w => w.id);
    const chipNames = ["전체", ...THEMES.map(t => t.name)];
    if (etcIds.length > 0) chipNames.push("기타");
    if (!chipNames.includes(dictTheme)) dictTheme = "전체";

    $screen.innerHTML = `
      <div class="greeting"><h2>단어장 📖</h2><p>총 ${WORDS.length}개 · 단어를 누르면 예문이 펼쳐져요</p></div>
      <input type="search" id="word-search" class="search-input" placeholder="🔍 단어 또는 뜻으로 검색">
      <div class="theme-chips">
        ${chipNames.map(n => `<button class="chip ${n === dictTheme ? "active" : ""}" data-theme="${esc(n)}">${esc(n)}</button>`).join("")}
      </div>
      <p class="card-sub" id="word-count" style="margin-bottom:10px"></p>
      <div id="word-list"></div>`;

    const $list = document.getElementById("word-list");
    const $search = document.getElementById("word-search");
    const $count = document.getElementById("word-count");

    function themeIdSet() {
      if (dictTheme === "전체") return null;
      if (dictTheme === "기타") return new Set(etcIds);
      return new Set(THEMES.find(t => t.name === dictTheme).ids);
    }

    function renderItems() {
      const query = $search.value.trim().toLowerCase();
      const tset = themeIdSet();
      const items = WORDS.filter(w =>
        (!tset || tset.has(w.id)) &&
        (!query || w.w.toLowerCase().includes(query) || w.m.toLowerCase().includes(query))
      );
      $count.textContent = `${dictTheme} ${items.length}개`;
      $list.innerHTML = items.map(w => `
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
        </details>`).join("") || `<div class="empty"><div class="emoji">🔍</div>검색 결과가 없어요.</div>`;
    }

    renderItems();
    $search.addEventListener("input", renderItems);
    document.querySelectorAll(".theme-chips .chip").forEach(chip => {
      chip.addEventListener("click", () => {
        dictTheme = chip.dataset.theme;
        document.querySelectorAll(".theme-chips .chip").forEach(c =>
          c.classList.toggle("active", c.dataset.theme === dictTheme)
        );
        renderItems();
      });
    });
  }

  // ===== PWA 서비스워커 등록 =====
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  // 시작
  renderHome();
})();
