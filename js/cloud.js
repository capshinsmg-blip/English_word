// ☁️ 클라우드 동기화 (Supabase Auth + 진도 저장)
//
// - GitHub Pages는 정적 호스팅이라 서버가 없으므로, 로그인과 진도 저장을 Supabase(BaaS)로 처리한다.
// - 설정값은 index.html의 window.SB_URL / window.SB_ANON_KEY 한 곳에서만 관리한다 (GA4 측정 ID와 동일 패턴).
// - 진도(localStorage "ew_state_v1")를 로그인한 계정에 자동 저장하고, 다른 기기에서 복원한다.
// - 미설정(placeholder) 상태에서는 아무 동작도 하지 않아 앱은 기존처럼 정상 작동한다.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SB_URL = window.SB_URL, SB_KEY = window.SB_ANON_KEY;
const CONFIGURED = /^https:\/\//.test(SB_URL || "") && (SB_KEY || "").length > 20;

const STATE_KEY = "ew_state_v1";   // SRS가 쓰는 localStorage 키와 동일해야 함
const REDIRECT = window.location.origin + window.location.pathname;

let sb = null;
let user = null;
let pushTimer = null;

function readLocal() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || "null"); } catch { return null; }
}

// 진도가 바뀐 뒤 1.5초 모아서 한 번만 클라우드로 전송 (연타 방지)
function schedulePush() {
  if (!sb || !user) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(doPush, 1500);
}

async function doPush() {
  const local = readLocal();
  if (!local) return;
  const { error } = await sb.from("progress").upsert({
    user_id: user.id,
    state: local,
    updated_at: new Date().toISOString()
  });
  if (error) console.warn("[cloud] 진도 저장 실패:", error.message);
}

// 로그인 직후/앱 시작 시: 로컬과 클라우드 중 "진도(xp)가 더 많은 쪽"을 채택해 유실을 막는다
async function pullAndReconcile() {
  if (!sb || !user) return;
  const { data, error } = await sb.from("progress").select("state").eq("user_id", user.id).maybeSingle();
  if (error) { console.warn("[cloud] 진도 불러오기 실패:", error.message); return; }

  const local = readLocal();
  const localXp = (local && local.xp) || 0;

  if (!data) { await doPush(); return; }            // 클라우드에 기록 없음 → 로컬을 올림
  const cloud = data.state;
  const cloudXp = (cloud && cloud.xp) || 0;

  if (cloudXp > localXp) {                           // 클라우드가 더 진도 많음 → 로컬 교체 후 화면 갱신
    localStorage.setItem(STATE_KEY, JSON.stringify(cloud));
    if (window.AppUI && window.AppUI.reload) window.AppUI.reload();
    else location.reload();
  } else if (localXp > cloudXp) {                    // 로컬이 더 진도 많음 → 클라우드로 올림
    await doPush();
  }
}

if (CONFIGURED) {
  sb = createClient(SB_URL, SB_KEY);

  // 진도가 바뀌는 모든 길목(SRS 메서드)을 감싸 자동 저장을 예약한다
  ["completeLearn", "completeReview", "applyPlacement", "skipOnboarding", "clearOnboarding", "save", "reset"]
    .forEach(name => {
      const orig = SRS[name];
      if (typeof orig === "function") {
        SRS[name] = function (...args) { const r = orig.apply(SRS, args); schedulePush(); return r; };
      }
    });

  // 로그인 상태 변화 감지 (앱 시작 시 현재 세션도 INITIAL_SESSION으로 여기 들어옴)
  sb.auth.onAuthStateChange((_event, session) => {
    user = (session && session.user) || null;
    window.dispatchEvent(new CustomEvent("cloud-auth"));
    if (user) pullAndReconcile();
  });
}

// 앱(app.js)에서 호출하는 공개 API
window.Cloud = {
  enabled: CONFIGURED,
  getUser() { return user; },
  signInGoogle() { if (sb) sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: REDIRECT } }); },
  signInKakao() { if (sb) sb.auth.signInWithOAuth({ provider: "kakao", options: { redirectTo: REDIRECT } }); },
  async signOut() {
    if (sb) await sb.auth.signOut();
    user = null;
    window.dispatchEvent(new CustomEvent("cloud-auth"));
  }
};
