// 앱 UI 로직
(() => {
  const $screen = document.getElementById("screen");
  const $streak = document.getElementById("streak-badge");
  let state = SRS.load();
  let freezeNotice = 0;   // 이번 세션에 프리즈가 지켜준 일수 (홈에서 1회 안내 후 0)

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
    const fz = state.freezes > 0 ? ` · 🧊${state.freezes}` : "";
    $streak.textContent = `🔥 ${SRS.summary(state).streak}일${fz}`;
  }

  // ===== 발음 듣기 (Web Speech API — 브라우저 내장 TTS) =====
  // 오늘 하루 듣기 횟수 (데일리 퀘스트용, 기기 로컬)
  function getDaily() {
    try {
      const d = JSON.parse(localStorage.getItem("ew_daily_v1") || "null");
      if (d && d.date === SRS.todayStr()) return d;
    } catch {}
    return { date: SRS.todayStr(), listens: 0 };
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel(); // 이전 재생 중단
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.95;
    speechSynthesis.speak(u);
    const d = getDaily();
    d.listens++;
    localStorage.setItem("ew_daily_v1", JSON.stringify(d));
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

  // 로그인/로그아웃 등 클라우드 상태가 바뀌면 처리
  window.addEventListener("cloud-auth", () => {
    const isPending = !!localStorage.getItem("ew_pending_new_user");
    const noWelcome = !localStorage.getItem("ew_welcome_v1");
    if (noWelcome || isPending) {
      const u = window.Cloud && window.Cloud.getUser();
      if (u) {
        handlePostLogin();
      } else if (noWelcome && document.querySelector(".auth-root")) {
        // cloud.js 비동기 로드 완료 — 환영화면 재렌더해서 구글 버튼 표시
        renderWelcome();
      }
      return;
    }
    const active = document.querySelector(".tab.active");
    if (active && active.dataset.tab === "settings") renderSettings();
  });

  // ===== 레벨 테스트 (가입/첫 실행 온보딩) =====
  // rank(커리큘럼 순서)가 클수록 어려운 단어 → 난이도 사다리로 10개를 뽑아 자가진단
  // PLACEMENT_LADDER는 단어 id 목록 (난이도는 각 단어의 rank로 판단)
  // ※ 콘텐츠 확장(1만 단어) 완료 시 사다리·레벨 경계 재조정 필요 — CLAUDE.md 로드맵 참조
  const PLACEMENT_LADDER = [25, 130, 300, 480, 700, 980, 1350, 1750, 2250, 2800];
  // max = rank 상한. 최종(1만 단어) 목표 경계: 입문 600 / 초급 1800 / 중급 4200 / 중상급 7000 / 고급 ∞
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
        else startVerify();
      });
    });
  }

  // ===== 회상 검증: "알아요"라고 답한 단어 중 가장 어려운 2개를 4지선다로 실제 확인 =====
  // 자가 신고 과대평가를 보정 — 틀리면 그 단어는 "모름"으로 정정되어 배치가 내려감
  function startVerify() {
    const knowns = placeCtx.answers.filter(a => a.known);
    const targets = knowns.slice(-2).map(a => WORDS.find(w => w.id === a.id)).filter(Boolean);
    if (targets.length === 0) return renderAnalyzing();
    placeCtx.verify = { targets, idx: 0 };
    renderVerifyQ();
  }

  function renderVerifyQ() {
    const { targets, idx } = placeCtx.verify;
    const w = targets[idx];
    const choices = makeChoices(w);
    $screen.innerHTML = `
      <div class="onb test">
        <div class="onb-qnum">확인 문제 ${idx + 1} / ${targets.length}</div>
        <div class="onb-recall hint">아신다고 한 단어, 진짜 아는지 확인해볼게요 🙂</div>
        <div class="onb-word">${esc(w.w)} ${speakBtn(w.w)}</div>
        <div class="onb-pron">${esc(w.p)}</div>
        <div class="onb-ask">이 단어의 뜻은?</div>
        <div class="choices">
          ${choices.map(c => `<button class="choice" data-val="${esc(c)}">${esc(c)}</button>`).join("")}
        </div>
      </div>`;

    $screen.querySelectorAll(".choice").forEach(btn => {
      btn.addEventListener("click", () => {
        const correct = btn.dataset.val === w.m;
        $screen.querySelectorAll(".choice").forEach(b => {
          b.disabled = true;
          if (b.dataset.val === w.m) b.classList.add("correct");
        });
        if (!correct) {
          btn.classList.add("wrong");
          // 자가 신고 정정 → 레벨 산정이 실제 실력에 맞게 내려감
          const ans = placeCtx.answers.find(a => a.id === w.id);
          if (ans) ans.known = false;
        }
        setTimeout(() => {
          placeCtx.verify.idx++;
          if (placeCtx.verify.idx < targets.length) renderVerifyQ();
          else renderAnalyzing();
        }, 800);
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

  // 쉬운→어려운 순서로 답을 훑어, 2번 연속 모르기 전까지 아는 가장 어려운 단어 위치(rank)로 레벨 산정
  function computePlacement(answers) {
    let lastKnown = 0, misses = 0;
    for (const a of answers) {
      if (a.known) { lastKnown = a.id; misses = 0; }
      else { misses++; if (misses >= 2) break; }
    }
    const lastRank = lastKnown ? (RANK_OF[lastKnown] || 0) : 0;
    const lv = LEVELS.find(l => lastRank <= l.max) || LEVELS[LEVELS.length - 1];
    // 아는 단어 수 = lastRank 이하 rank를 가진 단어 개수 (rank가 희소해도 정확)
    const knownCount = lastRank ? WORDS_BY_RANK.filter(w => w.rank <= lastRank).length : 0;
    const startWord = WORDS_BY_RANK.find(w => w.rank > lastRank) || WORDS_BY_RANK[WORDS_BY_RANK.length - 1];
    const startId = startWord.id;
    const vocab = Math.max(30, Math.round(knownCount / 50) * 50);
    const totalDays = Math.ceil((WORDS_BY_RANK.length - knownCount) / lv.newPerDay);
    return { key: lv.key, icon: lv.icon, label: lv.label, desc: lv.desc, vocab, startId, skipCount: knownCount, newPerDay: lv.newPerDay, totalDays };
  }

  function renderPlaceResult(p) {
    const skipCount = p.skipCount != null ? p.skipCount : (p.startId - 1);
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
    if (!localStorage.getItem("ew_tutorial_v1")) renderTutorial(0);
    else goHomeTab();
  }

  // ===== 인증 공통 유틸 =====
  const GOOGLE_SVG = `<svg width="18" height="18" viewBox="0 0 18 18" style="flex-shrink:0"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/><path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>`;
  const EYE_SVG  = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const EYE_OFF  = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

  function mapAuthError(msg) {
    if (!msg) return "오류가 발생했어요. 다시 시도해주세요";
    if (msg.includes("Invalid login credentials"))      return "이메일 또는 비밀번호가 올바르지 않아요";
    if (msg.includes("Email not confirmed"))            return "이메일 인증이 필요해요. 받은 편지함을 확인해주세요";
    if (msg.includes("User already registered"))        return "이미 가입된 이메일이에요. 로그인해주세요";
    if (msg.includes("Password should be at least"))   return "비밀번호는 6자 이상이어야 해요";
    if (msg.includes("Unable to validate email"))      return "올바른 이메일 주소를 입력해주세요";
    if (msg.includes("cloud_disabled"))                return "로그인 기능을 사용할 수 없어요";
    if (msg.includes("rate limit"))                    return "잠시 후 다시 시도해주세요";
    if (msg.includes("Invalid phone"))                 return "올바른 전화번호를 입력해주세요 (예: 010-1234-5678)";
    if (msg.includes("Token has expired") || msg.includes("invalid"))  return "인증번호가 올바르지 않거나 만료됐어요";
    if (msg.includes("Signups not allowed"))            return "현재 가입이 제한돼 있어요";
    if (msg.includes("Phone provider"))                return "전화번호 인증 설정이 필요해요 (Supabase 대시보드)";
    return "오류가 발생했어요. 다시 시도해주세요";
  }

  function togglePwVisibility(inputId, btnEl) {
    const input = document.getElementById(inputId);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btnEl.innerHTML = show ? EYE_OFF : EYE_SVG;
  }

  // ===== 환영 화면 (최초 1회) — Duolingo·Notion 레퍼런스 기반 =====
  function renderWelcome() {
    document.body.classList.add("onboarding");
    const cloudOn = window.Cloud && window.Cloud.enabled;
    $screen.innerHTML = `
      <div class="auth-root">
        <div class="auth-hero">
          <img src="icons/icon-192.png" class="auth-hero-icon" alt="하루보카">
          <h1 class="auth-hero-title">하루보카</h1>
          <p class="auth-hero-sub">에빙하우스 망각곡선으로<br>영어 단어를 효율적으로 외워요</p>
          <div class="auth-hero-pills">
            <span>🧠 과학적 복습</span><span>📚 ${WORDS.length.toLocaleString()} 단어</span><span>🔔 맞춤 알림</span>
          </div>
        </div>
        <div class="auth-sheet">
          ${cloudOn ? `
            <button class="btn btn-google-login btn-block" id="btn-welcome-google">
              ${GOOGLE_SVG} 구글로 계속하기
            </button>
            <div class="auth-divider"><span>또는</span></div>
          ` : ""}
          <button class="btn btn-primary btn-block" id="btn-to-login">이메일로 로그인</button>
          <button class="btn btn-outline btn-block" id="btn-to-signup" style="margin-top:10px">회원가입</button>
          <button class="btn btn-ghost btn-block auth-guest-btn" id="btn-welcome-guest">비회원으로 시작</button>
        </div>
      </div>`;

    if (cloudOn) document.getElementById("btn-welcome-google").addEventListener("click", () => window.Cloud.signInGoogle());
    document.getElementById("btn-to-login").addEventListener("click", renderLogin);
    document.getElementById("btn-to-signup").addEventListener("click", renderSignup);
    document.getElementById("btn-welcome-guest").addEventListener("click", () => {
      localStorage.setItem("ew_welcome_v1", "guest");
      document.body.classList.remove("onboarding");
      afterWelcome();
    });
  }

  // ===== 이메일 로그인 =====
  function renderLogin() {
    const cloudOn = window.Cloud && window.Cloud.enabled;
    $screen.innerHTML = `
      <div class="auth-form-screen">
        <button class="auth-back" id="auth-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="auth-form-top">
          <div class="auth-form-emoji">🔑</div>
          <h2 class="auth-form-title">로그인</h2>
          <p class="auth-form-sub">하루보카 계정으로 로그인해요</p>
        </div>
        ${cloudOn ? `
          <button class="btn btn-google-login btn-block" id="login-google" style="margin-bottom:16px">
            ${GOOGLE_SVG} 구글로 계속하기
          </button>
          <div class="auth-divider"><span>또는 이메일로</span></div>
        ` : ""}
        <div class="auth-fields">
          <div class="auth-field">
            <label class="auth-label">이메일</label>
            <input type="email" id="login-email" class="auth-input" placeholder="example@email.com" autocomplete="email">
          </div>
          <div class="auth-field">
            <label class="auth-label">비밀번호</label>
            <div class="auth-input-row">
              <input type="password" id="login-pw" class="auth-input" placeholder="비밀번호" autocomplete="current-password">
              <button type="button" class="auth-eye" id="login-eye">${EYE_SVG}</button>
            </div>
          </div>
          <div id="login-error" class="auth-error"></div>
          <button class="btn btn-primary btn-block" id="login-submit" style="margin-top:4px">로그인</button>
          <button type="button" class="auth-text-btn" id="login-reset">비밀번호를 잊으셨나요?</button>
        </div>
        <div class="auth-switch">계정이 없으신가요? <button class="auth-link" id="to-signup">회원가입</button></div>
      </div>`;

    document.getElementById("auth-back").onclick = renderWelcome;
    if (cloudOn) document.getElementById("login-google").onclick = () => window.Cloud.signInGoogle();
    document.getElementById("to-signup").onclick = renderSignup;
    document.getElementById("login-eye").onclick = function() { togglePwVisibility("login-pw", this); };

    document.getElementById("login-reset").onclick = async () => {
      const email = document.getElementById("login-email").value.trim();
      const errEl = document.getElementById("login-error");
      if (!email) { errEl.textContent = "이메일을 먼저 입력해주세요"; errEl.className = "auth-error"; return; }
      const r = await window.Cloud.resetPasswordForEmail(email);
      errEl.textContent = r.ok ? "비밀번호 재설정 링크를 이메일로 보냈어요 ✓" : "이메일 전송에 실패했어요";
      errEl.className = r.ok ? "auth-error ok" : "auth-error";
    };

    document.getElementById("login-submit").onclick = async () => {
      const email = document.getElementById("login-email").value.trim();
      const pw    = document.getElementById("login-pw").value;
      const errEl = document.getElementById("login-error");
      const btn   = document.getElementById("login-submit");
      errEl.textContent = "";
      if (!email || !pw) { errEl.textContent = "이메일과 비밀번호를 입력해주세요"; return; }
      btn.disabled = true; btn.textContent = "로그인 중...";
      const r = await window.Cloud.signInWithEmail(email, pw);
      if (!r.ok) { errEl.textContent = mapAuthError(r.error); btn.disabled = false; btn.textContent = "로그인"; }
      // 성공 시 cloud-auth 이벤트가 처리함
    };

    ["login-email", "login-pw"].forEach(id =>
      document.getElementById(id).addEventListener("keydown", e => { if (e.key === "Enter") document.getElementById("login-submit").click(); })
    );
  }

  // ===== 이메일 + 전화번호 회원가입 =====
  function renderSignup() {
    const cloudOn = window.Cloud && window.Cloud.enabled;
    $screen.innerHTML = `
      <div class="auth-form-screen">
        <button class="auth-back" id="auth-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="auth-form-top">
          <div class="auth-form-emoji">✉️</div>
          <h2 class="auth-form-title">회원가입</h2>
          <p class="auth-form-sub">이메일로 하루보카를 시작해요</p>
        </div>
        ${cloudOn ? `
          <button class="btn btn-google-login btn-block" id="signup-google" style="margin-bottom:16px">
            ${GOOGLE_SVG} 구글로 가입하기
          </button>
          <div class="auth-divider"><span>또는 이메일로</span></div>
        ` : ""}
        <div class="auth-fields">
          <div class="auth-field">
            <label class="auth-label">이메일</label>
            <input type="email" id="signup-email" class="auth-input" placeholder="example@email.com" autocomplete="email">
          </div>
          <div class="auth-field">
            <label class="auth-label">비밀번호 <span class="auth-label-hint">(6자 이상)</span></label>
            <div class="auth-input-row">
              <input type="password" id="signup-pw" class="auth-input" placeholder="비밀번호" autocomplete="new-password">
              <button type="button" class="auth-eye" id="signup-eye">${EYE_SVG}</button>
            </div>
            <div class="pw-strength-wrap" id="pw-strength-wrap" style="display:none">
              <div class="pw-strength-bar"><div class="pw-strength-fill" id="pw-strength-fill"></div></div>
              <span class="pw-strength-label" id="pw-strength-label"></span>
            </div>
          </div>
          <div class="auth-field">
            <label class="auth-label">비밀번호 확인</label>
            <div class="auth-input-row">
              <input type="password" id="signup-pw2" class="auth-input" placeholder="비밀번호 재입력" autocomplete="new-password">
              <button type="button" class="auth-eye" id="signup-eye2">${EYE_SVG}</button>
            </div>
            <div id="pw2-status" class="auth-error"></div>
          </div>
          <div class="auth-field">
            <label class="auth-label">휴대폰 번호 <span class="auth-label-hint">(선택 · 번호 인증에 사용)</span></label>
            <div class="phone-input-row">
              <span class="phone-prefix">🇰🇷 +82</span>
              <input type="tel" id="signup-phone" placeholder="010-1234-5678" autocomplete="tel">
            </div>
          </div>
          <div id="signup-error" class="auth-error"></div>
          <button class="btn btn-primary btn-block" id="signup-submit" disabled style="margin-top:4px">회원가입</button>
        </div>
        <div class="auth-switch">이미 계정이 있으신가요? <button class="auth-link" id="to-login">로그인</button></div>
      </div>`;

    document.getElementById("auth-back").onclick = renderWelcome;
    if (cloudOn) document.getElementById("signup-google").onclick = () => window.Cloud.signInGoogle();
    document.getElementById("to-login").onclick = renderLogin;
    document.getElementById("signup-eye").onclick  = function() { togglePwVisibility("signup-pw", this); };
    document.getElementById("signup-eye2").onclick = function() { togglePwVisibility("signup-pw2", this); };

    function updateSubmitState() {
      const email  = document.getElementById("signup-email").value.trim();
      const pw     = document.getElementById("signup-pw").value;
      const pw2    = document.getElementById("signup-pw2").value;
      const status = document.getElementById("pw2-status");
      const btn    = document.getElementById("signup-submit");
      if (pw2.length === 0) { status.textContent = ""; btn.disabled = true; return; }
      if (pw !== pw2) {
        status.textContent = "비밀번호가 일치하지 않아요";
        status.className = "auth-error"; btn.disabled = true;
      } else {
        status.textContent = "✓ 비밀번호가 일치해요";
        status.className = "auth-error ok";
        btn.disabled = !(email && pw.length >= 6);
      }
    }
    ["signup-email","signup-pw","signup-pw2"].forEach(id =>
      document.getElementById(id).addEventListener("input", updateSubmitState)
    );

    // 비밀번호 강도
    document.getElementById("signup-pw").addEventListener("input", () => {
      const val = document.getElementById("signup-pw").value;
      const wrap = document.getElementById("pw-strength-wrap");
      if (!val) { wrap.style.display = "none"; return; }
      wrap.style.display = "flex";
      const str = val.length >= 12 && /[A-Z]/.test(val) && /[0-9]/.test(val) ? 3 :
                  val.length >= 8 ? 2 : val.length >= 6 ? 1 : 0;
      const colors = ["#ef5350","#fb8c00","#43a047","#1b5e20"];
      const labels = ["약함","보통","강함","매우 강함"];
      document.getElementById("pw-strength-fill").style.cssText = `width:${(str+1)*25}%;background:${colors[str]}`;
      const lbl = document.getElementById("pw-strength-label");
      lbl.textContent = labels[str]; lbl.style.color = colors[str];
    });

    document.getElementById("signup-submit").onclick = async () => {
      const email = document.getElementById("signup-email").value.trim();
      const pw    = document.getElementById("signup-pw").value;
      const phone = document.getElementById("signup-phone").value.trim();
      const errEl = document.getElementById("signup-error");
      const btn   = document.getElementById("signup-submit");
      errEl.textContent = "";
      btn.disabled = true; btn.textContent = "가입 중...";

      const r = await window.Cloud.signUpWithEmail(email, pw);
      if (!r.ok) {
        errEl.textContent = mapAuthError(r.error);
        btn.disabled = false; btn.textContent = "회원가입";
        return;
      }

      // 전화번호 입력했으면 SMS OTP 발송
      if (phone) {
        const e164 = phoneToE164(phone);
        if (e164) {
          const otpRes = await window.Cloud.sendPhoneOtp(e164);
          if (otpRes.ok) { renderPhoneOtp(e164); return; }
          // OTP 발송 실패해도 가입은 완료 — 그냥 진행
        }
      }

      if (r.needsConfirmation) {
        // 이메일 인증 대기 중임을 표시 + 재진입 감지용 플래그
        localStorage.setItem("ew_pending_new_user", "1");
        renderEmailConfirm(email);
      }
      // 즉시 세션 생성 시 cloud-auth가 처리
    };
  }

  function phoneToE164(raw) {
    const digits = raw.replace(/\D/g, "");
    if (digits.startsWith("0")) return "+82" + digits.slice(1);
    if (digits.startsWith("82")) return "+" + digits;
    return null;
  }

  // ===== 휴대폰 OTP 인증 화면 =====
  function renderPhoneOtp(phone) {
    $screen.innerHTML = `
      <div class="auth-form-screen">
        <button class="auth-back" id="auth-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="auth-form-top">
          <div class="auth-form-emoji">📱</div>
          <h2 class="auth-form-title">인증번호 입력</h2>
          <p class="auth-form-sub">${esc(phone)}로 전송된<br>6자리 인증번호를 입력해주세요</p>
        </div>
        <div class="otp-inputs">
          ${[0,1,2,3,4,5].map(i => `<input type="tel" maxlength="1" class="otp-digit" id="otp-${i}" inputmode="numeric">`).join("")}
        </div>
        <div id="otp-error" class="auth-error" style="text-align:center"></div>
        <button class="btn btn-primary btn-block" id="otp-submit" disabled>확인</button>
        <button type="button" class="auth-text-btn" id="otp-resend" style="margin-top:12px">인증번호 재발송</button>
        <div class="auth-switch">전화번호 없이 계속하기 — <button class="auth-link" id="otp-skip">건너뛰기</button></div>
      </div>`;

    document.getElementById("auth-back").onclick = renderSignup;
    document.getElementById("otp-skip").onclick = () => { localStorage.setItem("ew_pending_new_user", "1"); handlePostLogin(); };
    document.getElementById("otp-resend").onclick = async () => {
      await window.Cloud.sendPhoneOtp(phone);
      const errEl = document.getElementById("otp-error");
      errEl.textContent = "재발송했어요"; errEl.className = "auth-error ok";
    };

    // 6박스 OTP — 자동 포커스 이동
    const inputs = Array.from({ length: 6 }, (_, i) => document.getElementById(`otp-${i}`));
    inputs.forEach((el, i) => {
      el.addEventListener("input", e => {
        el.value = el.value.replace(/\D/, "").slice(-1);
        if (el.value) el.classList.add("filled"); else el.classList.remove("filled");
        if (el.value && i < 5) inputs[i + 1].focus();
        const code = inputs.map(x => x.value).join("");
        document.getElementById("otp-submit").disabled = code.length < 6;
      });
      el.addEventListener("keydown", e => {
        if (e.key === "Backspace" && !el.value && i > 0) inputs[i - 1].focus();
      });
    });
    inputs[0].focus();

    document.getElementById("otp-submit").onclick = async () => {
      const code  = inputs.map(x => x.value).join("");
      const errEl = document.getElementById("otp-error");
      const btn   = document.getElementById("otp-submit");
      btn.disabled = true; btn.textContent = "확인 중...";
      const r = await window.Cloud.verifyPhoneOtp(phone, code);
      if (r.ok) {
        localStorage.setItem("ew_pending_new_user", "1");
        handlePostLogin();
      } else {
        errEl.textContent = mapAuthError(r.error);
        errEl.className = "auth-error";
        btn.disabled = false; btn.textContent = "확인";
      }
    };
  }

  // ===== 이메일 인증 안내 =====
  function renderEmailConfirm(email) {
    $screen.innerHTML = `
      <div class="auth-form-screen">
        <div class="auth-confirm-wrap">
          <div class="auth-confirm-icon">📧</div>
          <h2 class="auth-form-title">이메일을 확인해주세요</h2>
          <p class="auth-confirm-email">${esc(email)}</p>
          <p class="auth-confirm-desc">위 주소로 인증 링크를 보냈어요.<br>링크를 클릭하면 가입이 완료돼요.</p>
          <div class="auth-confirm-hint">📬 이메일이 안 보이면 스팸함도 확인해보세요</div>
          <button class="btn btn-outline btn-block" id="back-to-welcome" style="margin-top:24px">돌아가기</button>
        </div>
      </div>`;
    document.getElementById("back-to-welcome").onclick = renderWelcome;
  }

  async function handlePostLogin() {
    const C = window.Cloud;
    if (!C || !C.enabled || !C.getUser()) {
      localStorage.setItem("ew_welcome_v1", "logged-in");
      document.body.classList.remove("onboarding");
      afterWelcome();
      return;
    }
    const nick = await C.getNickname();
    if (nick === null) {
      // 닉네임 없음 = 신규 계정 → 이전 로컬 진행 플래그 초기화하고 신규 흐름 강제
      localStorage.removeItem("ew_welcome_v1");
      localStorage.removeItem("ew_tutorial_v1");
      localStorage.removeItem("ew_pending_new_user");
      renderProfileSetup(false);
    } else {
      // 기존 계정 재로그인
      localStorage.setItem("ew_welcome_v1", "logged-in");
      localStorage.setItem("ew_nick_v1", nick);
      localStorage.removeItem("ew_pending_new_user");
      document.body.classList.remove("onboarding");
      afterWelcome();
    }
  }

  function afterWelcome() {
    state = SRS.load();
    if (!state.onboarded) renderOnboarding();
    else if (!localStorage.getItem("ew_tutorial_v1")) renderTutorial(0);
    else goHomeTab();
  }

  // ===== 프로필 설정 (닉네임 + 나이대 + 성별) =====
  function renderProfileSetup(fromSettings = false) {
    document.body.classList.add("onboarding");
    const AGE_GROUPS = ["10대","20대","30대","40대","50대 이상"];
    const GENDERS    = ["남성","여성","선택 안 함"];
    $screen.innerHTML = `
      <div class="auth-form-screen">
        <div class="auth-form-top">
          <div class="auth-form-emoji">👤</div>
          <h2 class="auth-form-title">프로필 설정</h2>
          <p class="auth-form-sub">하루보카에서 사용할 정보를 입력해주세요</p>
        </div>
        <div class="auth-fields">
          <div class="auth-field">
            <label class="auth-label">닉네임 <span class="auth-label-hint">(2~12자, 한글·영문·숫자)</span></label>
            <input type="text" id="nick-input" class="auth-input"
              placeholder="닉네임 입력" maxlength="12" autocomplete="off">
            <div id="nick-status" class="auth-error"></div>
          </div>
          <div class="auth-field">
            <label class="auth-label">나이대</label>
            <div class="profile-chip-group" id="age-chips">
              ${AGE_GROUPS.map(a => `<button type="button" class="profile-chip" data-age="${a}">${a}</button>`).join("")}
            </div>
          </div>
          <div class="auth-field">
            <label class="auth-label">성별</label>
            <div class="profile-chip-group" id="gender-chips">
              ${GENDERS.map(g => `<button type="button" class="profile-chip" data-gender="${g}">${g}</button>`).join("")}
            </div>
          </div>
        </div>
        <div style="margin-top:24px">
          <button class="btn btn-primary btn-block" id="nick-confirm" disabled>완료</button>
          <button class="btn btn-ghost btn-block" id="nick-skip" style="margin-top:8px">
            ${fromSettings ? "취소" : "나중에 설정"}
          </button>
        </div>
      </div>`;

    const input      = document.getElementById("nick-input");
    const status     = document.getElementById("nick-status");
    const confirmBtn = document.getElementById("nick-confirm");
    let checkTimer;
    let nickValid    = false;
    let selectedAge  = "";
    let selectedGender = "";

    function refreshConfirmBtn() {
      confirmBtn.disabled = !nickValid;
    }

    // 나이대 칩
    document.getElementById("age-chips").addEventListener("click", e => {
      const chip = e.target.closest(".profile-chip");
      if (!chip) return;
      document.querySelectorAll("#age-chips .profile-chip").forEach(c => c.classList.remove("selected"));
      chip.classList.add("selected");
      selectedAge = chip.dataset.age;
    });

    // 성별 칩
    document.getElementById("gender-chips").addEventListener("click", e => {
      const chip = e.target.closest(".profile-chip");
      if (!chip) return;
      document.querySelectorAll("#gender-chips .profile-chip").forEach(c => c.classList.remove("selected"));
      chip.classList.add("selected");
      selectedGender = chip.dataset.gender;
    });

    input.addEventListener("input", () => {
      const val = input.value.trim();
      clearTimeout(checkTimer);
      nickValid = false; refreshConfirmBtn();
      if (val.length < 2) {
        status.textContent = val.length ? "2자 이상 입력해주세요" : "";
        status.className = "auth-error"; return;
      }
      if (!/^[가-힣a-zA-Z0-9]+$/.test(val)) {
        status.textContent = "한글, 영문, 숫자만 사용 가능해요";
        status.className = "auth-error"; return;
      }
      status.textContent = "확인 중..."; status.className = "auth-error";
      checkTimer = setTimeout(async () => {
        const avail = await window.Cloud.checkNicknameAvailable(val);
        if (avail) {
          status.textContent = "✓ 사용 가능한 닉네임이에요";
          status.className = "auth-error ok";
          nickValid = true;
        } else {
          status.textContent = "이미 사용 중인 닉네임이에요";
          status.className = "auth-error";
        }
        refreshConfirmBtn();
      }, 600);
    });

    confirmBtn.addEventListener("click", async () => {
      const val = input.value.trim();
      confirmBtn.disabled = true; confirmBtn.textContent = "저장 중...";
      const C = window.Cloud;
      let ok;
      if (C && C.enabled && C.getUser()) {
        ok = await C.setProfile({ nickname: val, ageGroup: selectedAge, gender: selectedGender });
      } else {
        localStorage.setItem("ew_nick_v1", val);
        ok = true;
      }
      if (ok) {
        if (fromSettings) { document.body.classList.remove("onboarding"); renderSettings(); }
        else { localStorage.setItem("ew_welcome_v1", "logged-in"); document.body.classList.remove("onboarding"); afterWelcome(); }
      } else {
        status.textContent = "저장에 실패했어요. 다시 시도해주세요";
        status.className = "auth-error";
        confirmBtn.disabled = false; confirmBtn.textContent = "완료";
      }
    });

    document.getElementById("nick-skip").addEventListener("click", () => {
      if (fromSettings) { document.body.classList.remove("onboarding"); renderSettings(); }
      else { localStorage.setItem("ew_welcome_v1", "skipped"); document.body.classList.remove("onboarding"); afterWelcome(); }
    });
  }

  // 설정에서 닉네임 변경 시 사용 (이전 API 이름 유지)
  function renderNicknameSetup(fromSettings) { renderProfileSetup(fromSettings); }

  // ===== 튜토리얼 (5단계) =====
  const TUTORIAL_STEPS = [
    {
      emoji: "🧠", title: "왜 반복 학습이 필요할까요?",
      body: "사람은 외운 것의 67%를 하루 만에 잊어요. 에빙하우스 망각곡선에 따르면, 적절한 타이밍에 복습할수록 기억이 훨씬 오래 남아요.",
      visual: `<div class="tut-curve">
        <svg viewBox="0 0 260 110" xmlns="http://www.w3.org/2000/svg">
          <path d="M10,15 Q50,15 80,50 Q110,80 160,90 Q200,96 250,98" fill="none" stroke="#ddd" stroke-width="3" stroke-dasharray="6,3"/>
          <path d="M10,15 Q30,14 45,22 Q60,32 70,26 Q85,18 105,28 Q125,38 148,34 Q175,30 210,32 Q235,33 250,34" fill="none" stroke="var(--primary)" stroke-width="3"/>
          <circle cx="45" cy="22" r="4" fill="var(--primary)"/>
          <circle cx="105" cy="28" r="4" fill="var(--primary)"/>
          <circle cx="148" cy="34" r="4" fill="var(--primary)"/>
          <text x="38" y="38" fill="var(--primary)" font-size="9">1일</text>
          <text x="98" y="44" fill="var(--primary)" font-size="9">7일</text>
          <text x="141" y="50" fill="var(--primary)" font-size="9">30일</text>
          <text x="190" y="25" fill="var(--primary)" font-size="9">복습 O</text>
          <text x="175" y="94" fill="#bbb" font-size="9">복습 X</text>
        </svg>
      </div>`
    },
    {
      emoji: "📅", title: "이렇게 복습이 이어져요",
      body: "새 단어를 배운 뒤 1일, 7일, 30일 뒤에 복습 시험이 열려요. 3번 복습을 완료하면 졸업! 장기 기억으로 저장돼요.",
      visual: `<div class="tut-timeline">
        <div class="tl-node new"><span class="tl-day">오늘</span><span class="tl-lbl">새 단어</span></div>
        <div class="tl-line"></div>
        <div class="tl-node r1"><span class="tl-day">1일</span><span class="tl-lbl">1차</span></div>
        <div class="tl-line"></div>
        <div class="tl-node r2"><span class="tl-day">7일</span><span class="tl-lbl">2차</span></div>
        <div class="tl-line"></div>
        <div class="tl-node r3"><span class="tl-day">30일</span><span class="tl-lbl">3차</span></div>
        <div class="tl-line"></div>
        <div class="tl-node grad"><span class="tl-day">🎓</span><span class="tl-lbl">졸업</span></div>
      </div>`
    },
    {
      emoji: "📂", title: "원하는 주제만 골라서 배워요",
      body: "설정 탭 > 카테고리 필터에서 카페, 여행, 비즈니스 등 내 상황에 맞는 주제를 고르면 그 단어를 집중 학습할 수 있어요.",
      visual: `<div class="tut-chips">
        <span class="tut-chip">☕ 카페</span><span class="tut-chip on">✈️ 여행</span>
        <span class="tut-chip">💼 비즈니스</span><span class="tut-chip on">🏥 의료</span>
        <span class="tut-chip">🛍️ 쇼핑</span><span class="tut-chip">🎭 문화</span>
      </div>`
    },
    {
      emoji: "⚙️", title: "하루에 몇 단어씩 배울까요?",
      body: "설정 탭에서 하루 새 단어 개수를 조절할 수 있어요. 처음엔 하루 5개를 추천해요. 적더라도 꾸준히 하는 게 가장 중요해요!",
      visual: `<div class="tut-setting-box">
        <div class="tut-setting-row"><span>하루 새 단어</span><strong>5개 ✓</strong></div>
        <p class="tut-setting-tip">하루 5개 × 365일 = <b>연간 1,825단어</b></p>
      </div>`
    },
    {
      emoji: "🔔", title: "매일 알림으로 습관을 만들어요",
      body: "설정 탭 > 매일 알림에서 원하는 시간을 정하면 매일 공부 시간에 알림을 보내드려요. 습관이 되면 영어가 달라져요!",
      visual: `<div class="tut-notif-mock">
        <div class="tut-notif-bar"><span class="tut-notif-app">📚 하루보카</span><span class="tut-notif-time">오전 8:00</span></div>
        <div class="tut-notif-body">오늘 단어 5개, 내일의 나를 위한 투자 💪</div>
      </div>`
    }
  ];

  function renderTutorial(step = 0) {
    document.body.classList.add("onboarding");
    const s = TUTORIAL_STEPS[step];
    const isLast = step === TUTORIAL_STEPS.length - 1;
    const dots = TUTORIAL_STEPS.map((_, i) =>
      `<span class="tut-dot${i === step ? " on" : ""}"></span>`).join("");

    $screen.innerHTML = `
      <div class="tutorial-screen">
        <div class="tut-dots">${dots}</div>
        <div class="tut-emoji">${s.emoji}</div>
        <h2 class="tut-title">${s.title}</h2>
        <p class="tut-body">${s.body}</p>
        ${s.visual}
        <div class="tut-btns">
          <button class="btn btn-primary btn-block" id="tut-next">
            ${isLast ? "시작하기 🚀" : "다음 →"}
          </button>
          ${step > 0 ? `<button class="btn btn-ghost btn-block" id="tut-prev" style="margin-top:8px">← 이전</button>` : ""}
          ${!isLast ? `<button class="btn btn-ghost btn-block" id="tut-skip" style="margin-top:8px;font-size:13px;color:var(--text-sub)">건너뛰기</button>` : ""}
        </div>
      </div>`;

    document.getElementById("tut-next").addEventListener("click", () => {
      if (isLast) {
        localStorage.setItem("ew_tutorial_v1", "done");
        document.body.classList.remove("onboarding");
        goHomeTab();
      } else renderTutorial(step + 1);
    });
    const prev = document.getElementById("tut-prev");
    if (prev) prev.addEventListener("click", () => renderTutorial(step - 1));
    const skip = document.getElementById("tut-skip");
    if (skip) skip.addEventListener("click", () => {
      localStorage.setItem("ew_tutorial_v1", "done");
      document.body.classList.remove("onboarding");
      goHomeTab();
    });
  }

  // ===== 홈 화면 =====
  // 3일 이상 공백 후 복습이 밀린 채 돌아온 사용자 감지
  function comebackInfo() {
    if (state.activity.length === 0) return null;
    const last = state.activity[state.activity.length - 1];
    const awayDays = SRS.daysBetween(last, SRS.todayStr()) - 1;   // 마지막 학습일과 오늘 사이 공백
    if (awayDays < 3) return null;
    const { due, deferred } = SRS.dueReviewsToday(state);
    const total = due.length + deferred;
    if (total < 2) return null;
    return { awayDays, total };
  }

  // 복귀 환영 화면 — 밀린 복습이 벽이 아니라 계단으로 보이게
  function renderComeback(cb) {
    $screen.innerHTML = `
      <div class="result-box comeback-box">
        <div class="emoji">😊</div>
        <h2>다시 만나 반가워요!</h2>
        <p>${cb.awayDays}일 만이에요. 밀린 복습 <b>${cb.total}개</b>가 있지만<br>
        하루 <b>최대 ${SRS.REVIEW_DAILY_CAP}개씩</b>만 나눠서 나와요.<br>
        오늘은 가볍게 다시 시작하면 충분해요 🌱</p>
        <button class="btn btn-primary btn-block" id="btn-comeback-go" style="margin-top:14px">가볍게 시작하기</button>
      </div>`;
    document.getElementById("btn-comeback-go").addEventListener("click", renderHome);
  }

  // iOS Safari에서 홈 화면 미설치 상태면 설치 안내 배너 (알림 수신을 위해 필요)
  function iosBannerHtml() {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.navigator.standalone === true ||
      (window.matchMedia && matchMedia("(display-mode: standalone)").matches);
    if (!isIos || standalone || localStorage.getItem("ew_ios_banner_v1")) return "";
    return `
      <div class="card ios-banner">
        <button class="ios-banner-x" id="btn-ios-close" aria-label="닫기">✕</button>
        <div class="card-title">📲 홈 화면에 추가하고 알림 받기</div>
        <div class="card-sub">Safari 하단 <b>공유 버튼</b> → <b>'홈 화면에 추가'</b>를 누르면 앱처럼 쓰고 복습 알림도 받을 수 있어요.</div>
      </div>`;
  }

  function renderHome() {
    state = SRS.load();
    updateStreak();

    // 복귀 사용자에게는 하루 1회 환영 화면 먼저
    const cb = comebackInfo();
    if (cb && localStorage.getItem("ew_comeback_v1") !== SRS.todayStr()) {
      localStorage.setItem("ew_comeback_v1", SRS.todayStr());
      return renderComeback(cb);
    }

    const newWords = SRS.nextNewWords(state);
    const learnedToday = SRS.learnedToday(state);
    const { due: reviews, deferred } = SRS.dueReviewsToday(state);

    let html = `
      <div class="greeting">
        <h2>오늘의 학습 🎯</h2>
        <p>${SRS.todayStr()} · 에빙하우스 곡선으로 똑똑하게 외우기</p>
      </div>
      ${iosBannerHtml()}`;

    // 프리즈가 연속 기록을 지켜준 경우 1회 알림
    if (freezeNotice > 0) {
      html += `
        <div class="card freeze-notice">
          <div class="card-title">🧊 스트릭 프리즈가 ${freezeNotice}일을 지켜줬어요!</div>
          <div class="card-sub">연속 ${SRS.summary(state).streak}일 기록이 그대로 이어져요.</div>
        </div>`;
      freezeNotice = 0;
    }

    html += charCardHtml(true);

    // 데일리 퀘스트 (3종 달성 → 보너스 XP)
    const daily = getDaily();
    const q1 = learnedToday;
    const q2 = reviews.length === 0;               // 오늘 도래분을 모두 끝냈으면 달성 (도래 0인 날도 달성)
    const q3 = daily.listens >= 5;
    const questAll = q1 && q2 && q3;
    const questClaimed = state.questClaimedOn === SRS.todayStr();
    html += `
      <div class="card quest-card">
        <div class="card-title" style="font-size:15px">📋 오늘의 퀘스트${questClaimed ? ` <span class="quest-done-tag">완료 🎉</span>` : ""}</div>
        <div class="quest-row${q1 ? " done" : ""}"><span>${q1 ? "✅" : "⬜"}</span> 새 단어 외우기</div>
        <div class="quest-row${q2 ? " done" : ""}"><span>${q2 ? "✅" : "⬜"}</span> 오늘의 복습 모두 끝내기</div>
        <div class="quest-row${q3 ? " done" : ""}"><span>${q3 ? "✅" : "⬜"}</span> 발음 5회 듣기 <span class="quest-count">${Math.min(daily.listens, 5)}/5</span></div>
        ${questAll && !questClaimed ? `<button class="btn btn-primary btn-block btn-sm" id="btn-quest-claim" style="margin-top:10px">🎁 보너스 +${SRS.QUEST_BONUS_XP} XP 받기</button>` : ""}
      </div>`;

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

    // 복습 카드들 (하루 최대 3개 — 초과분은 자동 순연)
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
      if (deferred > 0) {
        html += `
          <div class="card deferred-note">
            <div class="card-sub">⏳ 밀린 복습 ${deferred}개는 내일부터 이어서 나와요. 하루 최대 ${SRS.REVIEW_DAILY_CAP}개씩만 — 부담 없이 가요!</div>
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
    const btnQuest = document.getElementById("btn-quest-claim");
    if (btnQuest) btnQuest.addEventListener("click", () => {
      if (SRS.claimDailyQuest(state)) {
        state = SRS.load();
        renderHome();
      }
    });
    const btnIosClose = document.getElementById("btn-ios-close");
    if (btnIosClose) btnIosClose.addEventListener("click", () => {
      localStorage.setItem("ew_ios_banner_v1", "closed");
      renderHome();
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
        // 리치 큐: 예전에 틀렸던 단어 최대 2개를 "복습 찬스"로 확인 시험에 끼움 (배치에는 미포함)
        const leech = SRS.leechWords(state, 2).filter(lw => !learnCtx.words.some(x => x.id === lw.id));
        startQuiz(learnCtx.words.concat(leech), {
          batchId: null, stage: 0,
          learnXp: state.xp - xpBefore,
          leechIds: new Set(leech.map(w => w.id))
        });
      } else {
        learnCtx.idx++;
        renderLearnCard();
      }
    });

    // 자동 발음 (설정에서 끌 수 있음)
    if (state.settings.autoSpeak !== false) speak(w.w);
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
      round: 1,
      types: {},                                    // 단어별 문제 유형 (재시험에도 같은 유형 유지)
      leechIds: meta.leechIds || new Set()          // 이번 시험에 끼운 "복습 찬스" 단어
    };
    quiz.queue.forEach((w, i) => { quiz.types[w.id] = quizTypeFor(meta.stage, i); });
    track("quiz_start", { stage: meta.stage });
    renderQuizQuestion();
  }

  // ===== 인출 사다리: 복습 차수가 오를수록 더 깊은 인출을 요구 =====
  //  0·1차 = mc(영→한 4지선다, 인지) → 2차 = rev(한→영)·listen(듣기) 교차 → 3차 = spell(철자 입력, 산출)
  function quizTypeFor(stage, i) {
    if (stage <= 1) return "mc";
    if (stage === 2) return i % 2 === 0 ? "rev" : "listen";
    return "spell";
  }

  function makeChoices(word) {
    const wrongPool = shuffle(WORDS.filter(x => x.id !== word.id)).slice(0, 3).map(x => x.m);
    return shuffle([word.m, ...wrongPool]);
  }

  // 한→영: 영단어 선택지 4개
  function makeChoicesRev(word) {
    const wrongPool = shuffle(WORDS.filter(x => x.id !== word.id)).slice(0, 3).map(x => x.w);
    return shuffle([word.w, ...wrongPool]);
  }

  // 공통 채점 처리 (이력 기록·복습찬스 회복·오답 적재)
  function settleAnswer(w, correct) {
    if (quiz.round === 1) {
      SRS.recordAnswer(state, w.id, correct);
      if (correct && quiz.leechIds.has(w.id)) SRS.markLeechFixed(state, w.id);
      if (correct) quiz.firstCorrect++;
    }
    if (!correct) quiz.wrong.push(w);
  }

  function quizHeaderHtml(w) {
    const stageName = quiz.meta.stage === 0 ? "확인 시험" : SRS.STAGE_NAMES[quiz.meta.stage];
    const leech = quiz.leechIds.has(w.id) ? ` · <span class="leech-tag">🔁 복습 찬스</span>` : "";
    return `<div class="learn-progress">${stageName}${quiz.round > 1 ? ` · 재시험 ${quiz.round - 1}회차` : ""} · ${quiz.idx + 1} / ${quiz.queue.length}${leech}</div>`;
  }

  function renderQuizQuestion() {
    const w = quiz.queue[quiz.idx];
    const qtype = quiz.types[w.id] || "mc";
    if (qtype === "spell") return renderSpellQuestion(w);

    // 선택형 3종: mc(영→한) / rev(한→영) / listen(듣고 뜻 고르기)
    let questionHtml, choices, answerVal;
    if (qtype === "rev") {
      choices = makeChoicesRev(w);
      answerVal = w.w;
      questionHtml = `
        <div class="label">이 뜻의 단어는?</div>
        <div class="word quiz-mean">${esc(w.m)}</div>`;
    } else if (qtype === "listen") {
      choices = makeChoices(w);
      answerVal = w.m;
      questionHtml = `
        <div class="label">발음을 듣고 뜻을 고르세요</div>
        <button class="listen-play" id="listen-play" aria-label="발음 다시 듣기">🔊</button>`;
    } else {
      choices = makeChoices(w);
      answerVal = w.m;
      questionHtml = `
        <div class="label">이 단어의 뜻은?</div>
        <div class="word">${esc(w.w)} ${speakBtn(w.w)}</div>`;
    }

    $screen.innerHTML = `
      ${quizHeaderHtml(w)}
      <div class="quiz-q">${questionHtml}</div>
      <div class="choices">
        ${choices.map(c => `<button class="choice" data-val="${esc(c)}">${esc(c)}</button>`).join("")}
      </div>
      <div class="quiz-feedback" id="feedback"></div>
      <button class="btn btn-primary btn-block" id="btn-quiz-next" style="display:none">다음 →</button>`;

    const $fb = document.getElementById("feedback");
    const $next = document.getElementById("btn-quiz-next");

    if (qtype === "listen") {
      speak(w.w);
      document.getElementById("listen-play").addEventListener("click", () => speak(w.w));
    }

    document.querySelectorAll(".choice").forEach(btn => {
      btn.addEventListener("click", () => {
        const correct = btn.dataset.val === answerVal;
        settleAnswer(w, correct);
        document.querySelectorAll(".choice").forEach(b => {
          b.disabled = true;
          if (b.dataset.val === answerVal) b.classList.add("correct");
        });
        if (correct) {
          $fb.textContent = qtype === "listen" ? `⭕ 정답! ${w.w}` : "⭕ 정답!";
          $fb.className = "quiz-feedback ok";
        } else {
          btn.classList.add("wrong");
          $fb.textContent = qtype === "rev" ? `❌ 오답! 정답: ${w.w}` : `❌ 오답! 정답: ${qtype === "listen" ? w.w + " — " : ""}${w.m}`;
          $fb.className = "quiz-feedback no";
        }
        $next.style.display = "block";
      });
    });

    $next.addEventListener("click", advanceQuiz);
  }

  // 3차: 철자 입력 (예문 빈칸 우선, 없으면 뜻 보고 입력)
  function renderSpellQuestion(w) {
    const sent = w.ex && w.ex[0] ? w.ex[0][0] : "";
    const re = new RegExp(w.w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const blanked = sent && re.test(sent) ? sent.replace(re, "_____") : null;

    $screen.innerHTML = `
      ${quizHeaderHtml(w)}
      <div class="quiz-q">
        <div class="label">뜻을 보고 단어를 입력하세요</div>
        <div class="word quiz-mean">${esc(w.m)}</div>
        ${blanked ? `
          <div class="example" style="margin-top:10px">
            <div class="en">${esc(blanked)}</div>
            <div class="ko">${esc(w.ex[0][1])}</div>
          </div>` : ""}
      </div>
      <div class="spell-row">
        <input type="text" id="spell-input" class="spell-input" placeholder="영어로 입력"
          autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
        <button class="btn btn-primary" id="spell-submit">확인</button>
      </div>
      <button type="button" class="auth-text-btn" id="spell-idk">모르겠어요</button>
      <div class="quiz-feedback" id="feedback"></div>
      <button class="btn btn-primary btn-block" id="btn-quiz-next" style="display:none">다음 →</button>`;

    const $input = document.getElementById("spell-input");
    const $fb = document.getElementById("feedback");
    const $next = document.getElementById("btn-quiz-next");
    let done = false;

    function grade(giveUp) {
      if (done) return;
      done = true;
      const typed = $input.value.trim().toLowerCase();
      const correct = !giveUp && typed === w.w.toLowerCase();
      settleAnswer(w, correct);
      $input.disabled = true;
      document.getElementById("spell-submit").disabled = true;
      document.getElementById("spell-idk").style.display = "none";
      if (correct) {
        $fb.textContent = "⭕ 정답!";
        $fb.className = "quiz-feedback ok";
      } else {
        $fb.textContent = `❌ ${giveUp ? "" : "오답! "}정답: ${w.w}`;
        $fb.className = "quiz-feedback no";
        speak(w.w);
      }
      $next.style.display = "block";
    }

    document.getElementById("spell-submit").addEventListener("click", () => {
      if ($input.value.trim()) grade(false);
    });
    $input.addEventListener("keydown", e => {
      if (e.key === "Enter" && $input.value.trim()) grade(false);
    });
    document.getElementById("spell-idk").addEventListener("click", () => grade(true));
    $input.focus();

    $next.addEventListener("click", advanceQuiz);
  }

  function advanceQuiz() {
    quiz.idx++;
    if (quiz.idx < quiz.queue.length) {
      renderQuizQuestion();
    } else if (quiz.wrong.length > 0) {
      renderRestudy();
    } else {
      finishQuiz();
    }
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
      const nick = localStorage.getItem("ew_nick_v1");
      return `
        <div class="card">
          <div class="setting-row">
            <div>
              <div class="card-title" style="font-size:15px">☁️ 클라우드 저장 켜짐</div>
              <div class="card-sub">${esc(name)} · 진도가 자동으로 저장돼요</div>
            </div>
            <button class="btn btn-ghost btn-sm" id="btn-logout">로그아웃</button>
          </div>
          <div style="border-top:1px solid var(--border);margin-top:12px;padding-top:12px;display:flex;align-items:center;justify-content:space-between">
            <div class="card-sub">${nick ? `닉네임: <b>${esc(nick)}</b>` : "닉네임 미설정"}</div>
            <button class="btn btn-ghost btn-sm" id="btn-edit-nick">${nick ? "변경" : "설정"}</button>
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
            <div class="card-title" style="font-size:15px">🧊 스트릭 프리즈 <span class="freeze-count">${state.freezes} / ${SRS.FREEZE_MAX}개 보유</span></div>
            <div class="card-sub">하루 놓쳐도 연속 기록을 지켜줘요 · 내 XP ${SRS.xpBalance(state).toLocaleString()}</div>
          </div>
          ${state.freezes >= SRS.FREEZE_MAX
            ? `<button class="btn btn-ghost btn-sm" disabled>보유 한도</button>`
            : SRS.xpBalance(state) < SRS.FREEZE_COST
              ? `<button class="btn btn-ghost btn-sm" disabled>${SRS.FREEZE_COST} XP 필요</button>`
              : `<button class="btn btn-primary btn-sm" id="btn-buy-freeze">${SRS.FREEZE_COST} XP로 구매</button>`}
        </div>
      </div>
      <div class="card">
        <div class="setting-row">
          <div>
            <div class="card-title" style="font-size:15px">🔊 단어 자동 발음</div>
            <div class="card-sub">학습 카드가 넘어갈 때 자동으로 읽어줘요</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="autospeak-toggle" ${state.settings.autoSpeak !== false ? "checked" : ""}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
      <div class="card" id="card-notif">
        <div class="setting-row">
          <div>
            <div class="card-title" style="font-size:15px">🔔 매일 알림</div>
            <div class="card-sub" id="notif-status-text">확인 중...</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="notif-toggle">
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div id="notif-time-row" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <div class="card-sub">알림 시간</div>
            <select id="notif-hour-sel" class="notif-hour-sel">
              ${Array.from({length:24},(_,i)=>`<option value="${i}">${String(i).padStart(2,"0")}:00</option>`).join("")}
            </select>
          </div>
        </div>
      </div>
      <div class="card" id="card-theme-filter">
        <div class="setting-row">
          <div>
            <div class="card-title" style="font-size:15px">📂 카테고리 필터</div>
            <div class="card-sub" id="theme-filter-summary">${(() => { const n = (state.settings.selectedThemes||[]).length; return n ? n+"개 카테고리 선택됨" : "전체 출제 중"; })()}</div>
          </div>
          <button class="btn btn-ghost btn-sm" id="btn-theme-open">선택하기</button>
        </div>
        <div id="theme-filter-body" style="display:none">
          <div style="height:1px;background:var(--border);margin:12px 0 16px"></div>
          ${THEME_GROUPS.map(group => `
            <div class="theme-filter-group">
              <div class="theme-filter-group-label">${group.name}</div>
              <div class="theme-filter-grid">
                ${group.themes.map(t => {
                  const isActive = (state.settings.selectedThemes || []).includes(t.name);
                  return `<button class="theme-btn${isActive ? " active" : ""}" data-name="${t.name.replace(/"/g,'&quot;')}">${t.name}</button>`;
                }).join("")}
              </div>
            </div>`).join("")}
          <div style="margin-top:12px;display:flex;gap:8px">
            <button class="btn btn-ghost btn-sm" id="btn-theme-all">전체 선택</button>
            <button class="btn btn-ghost btn-sm" id="btn-theme-none">전체 해제</button>
          </div>
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
        <div class="setting-row">
          <div>
            <div class="card-title" style="font-size:15px">앱 사용법 안내</div>
            <div class="card-sub">에빙하우스 학습법 · 기능 설명</div>
          </div>
          <button class="btn btn-ghost btn-sm" id="btn-show-tutorial">다시 보기</button>
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
    const btnEditNick = document.getElementById("btn-edit-nick");
    if (btnEditNick) btnEditNick.addEventListener("click", () => renderNicknameSetup(true));
    const btnTutorial = document.getElementById("btn-show-tutorial");
    if (btnTutorial) btnTutorial.addEventListener("click", () => renderTutorial(0));

    document.getElementById("sel-perday").addEventListener("change", e => {
      state.settings.newPerDay = Number(e.target.value);
      SRS.save(state);
    });
    document.getElementById("btn-retest").addEventListener("click", () => {
      SRS.clearOnboarding(state);
      state = SRS.load();
      renderOnboarding();
    });
    const btnBuyFreeze = document.getElementById("btn-buy-freeze");
    if (btnBuyFreeze) btnBuyFreeze.addEventListener("click", () => {
      if (SRS.buyFreeze(state)) {
        state = SRS.load();
        updateStreak();
        renderSettings();
      }
    });
    document.getElementById("autospeak-toggle").addEventListener("change", e => {
      state.settings.autoSpeak = e.target.checked;
      SRS.save(state);
    });
    document.getElementById("btn-reset").addEventListener("click", () => {
      if (confirm("정말 모든 학습 기록을 초기화할까요?")) {
        SRS.reset();
        state = SRS.load();
        goHomeTab();
      }
    });

    // 알림 설정 초기화 (비동기)
    if (window.Notif) {
      (async () => {
        const toggleEl = document.getElementById("notif-toggle");
        const statusText = document.getElementById("notif-status-text");
        const timeRow = document.getElementById("notif-time-row");
        const hourSel = document.getElementById("notif-hour-sel");
        const toggleLabel = toggleEl && toggleEl.closest("label");
        if (!toggleEl) return;

        function applyStatus(s) {
          toggleEl.checked = s.enabled;
          if (hourSel) hourSel.value = s.hour;
          timeRow.style.display = s.enabled ? "block" : "none";
          if (!s.supported) {
            statusText.textContent = "이 기기에서는 알림을 지원하지 않아요";
            toggleEl.disabled = true;
            if (toggleLabel) toggleLabel.style.opacity = "0.4";
            return;
          }
          if (!s.vapidOk) {
            statusText.textContent = "알림 서버 미설정 (관리자 설정 필요)";
            toggleEl.disabled = true;
            if (toggleLabel) toggleLabel.style.opacity = "0.4";
            return;
          }
          if (s.permission === "denied") {
            statusText.textContent = "알림 권한 거부됨 — 기기 설정에서 허용해주세요";
            toggleEl.disabled = true;
            if (toggleLabel) toggleLabel.style.opacity = "0.4";
            return;
          }
          toggleEl.disabled = false;
          if (toggleLabel) toggleLabel.style.opacity = "";
          statusText.textContent = s.enabled
            ? `매일 ${String(s.hour).padStart(2, "0")}:00에 알림`
            : "매일 정해진 시간에 공부 알림을 받아요";
        }

        const status = await Notif.getStatus();
        applyStatus(status);

        toggleEl.addEventListener("change", async () => {
          if (toggleEl.checked) {
            statusText.textContent = "알림 구독 중...";
            toggleEl.disabled = true;
            const result = await Notif.subscribe(hourSel ? +hourSel.value : 8);
            toggleEl.disabled = false;
            if (result.ok) {
              applyStatus(await Notif.getStatus());
            } else {
              toggleEl.checked = false;
              timeRow.style.display = "none";
              const msgs = {
                denied: "알림 권한이 거부됐어요 — 기기 설정에서 허용해주세요",
                no_vapid_key: "알림 서버 미설정 상태예요",
                unsupported: "이 기기/브라우저에서는 알림을 지원하지 않아요",
                ios_not_installed: "iPhone은 홈 화면에 앱 추가 후 사용 가능해요 (공유 → 홈 화면에 추가)",
                failed: `구독 실패: ${result.detail || "HTTPS 환경에서 다시 시도해주세요"}`
              };
              statusText.textContent = msgs[result.reason] || "알림 설정에 실패했어요";
            }
          } else {
            statusText.textContent = "구독 해제 중...";
            await Notif.unsubscribe();
            applyStatus(await Notif.getStatus());
          }
        });

        if (hourSel) {
          hourSel.addEventListener("change", async () => {
            await Notif.updateHour(+hourSel.value);
            statusText.textContent = `매일 ${String(+hourSel.value).padStart(2, "0")}:00에 알림`;
          });
        }
      })();
    }

    function updateThemeSummary() {
      const n = document.querySelectorAll(".theme-btn.active").length;
      const el = document.getElementById("theme-filter-summary");
      if (el) el.textContent = n ? n + "개 카테고리 선택됨" : "전체 출제 중";
    }
    document.getElementById("btn-theme-open").addEventListener("click", () => {
      const body = document.getElementById("theme-filter-body");
      const btn = document.getElementById("btn-theme-open");
      const isOpen = body.style.display !== "none";
      body.style.display = isOpen ? "none" : "block";
      btn.textContent = isOpen ? "선택하기" : "닫기";
    });
    function saveThemeFilter() {
      state.settings.selectedThemes = [...document.querySelectorAll(".theme-btn.active")].map(el => el.dataset.name);
      SRS.save(state);
      updateThemeSummary();
    }
    document.querySelectorAll(".theme-btn").forEach(btn => btn.addEventListener("click", () => {
      btn.classList.toggle("active");
      saveThemeFilter();
    }));
    document.getElementById("btn-theme-all").addEventListener("click", () => {
      document.querySelectorAll(".theme-btn").forEach(btn => btn.classList.add("active"));
      saveThemeFilter();
    });
    document.getElementById("btn-theme-none").addEventListener("click", () => {
      document.querySelectorAll(".theme-btn").forEach(btn => btn.classList.remove("active"));
      saveThemeFilter();
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
    const startId = (state.settings && state.settings.startId) || 1;
    if ((RANK_OF[id] || 0) < (RANK_OF[startId] || 1)) return `<span class="badge badge-known">이미 알아요</span>`;
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

  // 시작
  state = SRS.load();

  // 공백일을 프리즈로 자동 방어 (소모 시 홈에서 1회 안내)
  freezeNotice = SRS.applyFreezes(state);
  if (freezeNotice > 0) state = SRS.load();

  if (localStorage.getItem("ew_pending_new_user")) {
    // 이메일 가입 후 인증 대기 상태로 재진입 — 레거시 감지 건너뛰고 환영화면 표시
    // cloud-auth 이벤트가 로그인 감지 후 handlePostLogin → renderProfileSetup으로 라우팅
    localStorage.removeItem("ew_welcome_v1");
    localStorage.removeItem("ew_tutorial_v1");
    renderWelcome();
  } else {
    // 기존 사용자 마이그레이션 — 이미 학습 이력 있으면 환영·튜토리얼 건너뜀
    if (state.onboarded && !localStorage.getItem("ew_welcome_v1")) {
      localStorage.setItem("ew_welcome_v1", "legacy");
      localStorage.setItem("ew_tutorial_v1", "done");
    }
    if (!localStorage.getItem("ew_welcome_v1")) renderWelcome();
    else if (!state.onboarded) renderOnboarding();
    else if (!localStorage.getItem("ew_tutorial_v1")) renderTutorial(0);
    else renderHome();
  }
})();
