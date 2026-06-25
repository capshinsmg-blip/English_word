// 하루보카 — 매일 알림 발송 Edge Function
// Supabase Dashboard > Edge Functions 에서 배포하거나:
//   supabase functions deploy send-daily-reminder
//
// 필요한 환경변수 (Dashboard > Settings > Edge Function Secrets):
//   VAPID_PUBLIC_KEY   — npx web-push generate-vapid-keys 의 publicKey
//   VAPID_PRIVATE_KEY  — 위 명령의 privateKey
//   VAPID_EMAIL        — mailto:your@email.com 형식
//
// cron 설정 (Supabase SQL Editor):
//   select cron.schedule(
//     'send-daily-reminders',
//     '0 * * * *',   -- 매시 정각 실행
//     $$ select net.http_post(
//          url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-daily-reminder',
//          headers := '{"Authorization":"Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
//          body := '{}'::jsonb
//        ); $$
//   );

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webPush from "npm:web-push";

// 동기부여 메시지 100개 (짧고 굵게, 모바일 알림에 최적화)
const MESSAGES = [
  "오늘 단어 5개, 내일의 나를 위한 투자 💪",
  "1일 1단어, 쌓이면 달라진다 📈",
  "지금이 최고의 영어 공부 시간 ⚡",
  "원어민처럼 말하려면 오늘 시작해 🌟",
  "단어를 알면 세상이 넓어진다 🌍",
  "5분만 투자해, 평생이 달라져 🎯",
  "오늘 배운 단어, 내일 써먹어 보자 🗣️",
  "포기하지 마, 어제보다 강해졌어 🔥",
  "연속 학습 이어가자, 할 수 있어! 🏃",
  "작은 습관이 큰 변화를 만든다 🌱",
  "영어는 근육이야, 매일 써야 강해져 💪",
  "오늘도 하루보카와 함께! 고고씽 🚀",
  "잊기 전에 복습! 에빙하우스의 법칙 🧠",
  "1년 후의 나는 오늘 결정된다 🌅",
  "단어 하나가 기회 하나를 만든다 🔑",
  "천리길도 한 걸음부터, 오늘 그 걸음 👣",
  "영어로 생각하면 세계가 작아진다 ✈️",
  "오늘 배운 단어, 내 인생의 도구 🛠️",
  "완벽한 시간 없어, 지금이 완벽해 ✨",
  "3초면 돼, 앱 열기만 해도 시작이야 📱",
  "꾸준함이 재능을 이긴다 🏆",
  "아는 단어가 많아질수록 자신감 UP! 😎",
  "오늘 안 하면 내일이 두 배 힘들어 📚",
  "영어 한 문장, 오늘의 목표 달성! 🎉",
  "단어 공부 = 미래의 나에게 보내는 선물 🎁",
  "졸려도 5분, 바빠도 5분! 시작해 보자 ⏰",
  "틀려도 괜찮아, 틀려야 외워지니까 🔄",
  "오늘 외운 단어, 영영 잊지 않을 거야 💡",
  "비가 와도 눈이 와도 단어는 외워야지 ☔",
  "영어 공부는 마라톤, 오늘도 한 걸음 🏅",
  "지금 이 순간 세계 어딘가서 영어 배우는 중 🌐",
  "하루보카가 기다리고 있어! 어서 와 😊",
  "단어 5개로 하루를 열어볼까? ☀️",
  "복습 날이야! 빠짐없이 기억하자 🔁",
  "자기 전에 단어 하나, 꿈에서도 외워져 🌙",
  "영어 점수보다 영어 실력이 먼저야 🎓",
  "알림 봤으면 이미 반은 한 거야 📲",
  "오늘의 단어가 내일의 대화가 돼 💬",
  "100일 후 달라진 나를 상상해봐 🔮",
  "영어 자신감은 어휘력에서 나와 💎",
  "새로운 단어 = 새로운 가능성 🌈",
  "못 외웠어? 오늘 다시 도전해! ♻️",
  "게임처럼 즐기자, 오늘 몇 점 맞나? 🎮",
  "단어장 꽉 채우는 그날까지! 📖",
  "아침에 단어 외우면 하루가 풍요로워 🌤️",
  "영어로 말하는 날이 올 거야, 반드시 🙌",
  "생각날 때 해야 해, 지금이 그때야! ⏳",
  "오늘도 포기하지 않은 나, 최고야 🥇",
  "단어 하나하나가 모여 유창함이 돼 🌊",
  "배움엔 늦음이 없어, 오늘부터 시작 🛤️",
  "가장 빠른 영어 공부법? 매일 하는 것 📅",
  "잊기 전에 복습! 지금 바로 ⚡",
  "단어를 외울수록 영어가 재밌어져 😄",
  "오늘 학습 완료하면 연속 기록 유지! 🔥",
  "5분이 60분보다 나을 때가 있어 ⏱️",
  "모르는 단어가 줄어드는 기쁨 🎊",
  "영어 뇌를 만들어가는 중! 계속 가자 🧩",
  "기억력이 좋아지는 건 연습 덕분이야 🧠",
  "오늘도 단어 외우고 뿌듯한 하루 보내 🌸",
  "작심삼일? 오늘이 네 번째 날이야! 💥",
  "영어 자막 없이 영화 보는 날 기대해 🎬",
  "단어 하나가 면접을 바꿀 수도 있어 📋",
  "외국 친구랑 수다 떨 날이 멀지 않아 👫",
  "영어로 SNS 댓글 달기, 도전해볼까? 📸",
  "오늘 배운 단어로 일기 써봐 📓",
  "단어 왕이 되는 길, 하루 5개씩! 👑",
  "부지런한 새가 벌레 잡는다 — 단어도 마찬가지 🐦",
  "힘들 때일수록 단어 한 개가 위로가 돼 💙",
  "오늘 하루 5분, 10년 후의 나에게 선물 🎀",
  "공부가 싫어도 단어 하나는 OK! 📝",
  "영어를 사랑하게 되는 건 시간문제야 ❤️",
  "매일 단어 = 매일 성장 🌿",
  "오늘 외운 단어, 진짜 내 것이 될 거야 🏠",
  "어려운 단어도 세 번 보면 친구가 돼 🤝",
  "알림 무시하면 후회해! 일단 열어봐 👀",
  "영어는 지름길이 없어, 매일이 지름길이야 🗺️",
  "오늘 단어 외우고 맛있는 거 먹을 자격 생겼다 🍜",
  "복습 완료 = 장기기억 저장 완료 💾",
  "나는 할 수 있어, 오늘도 증명해 보자 🌟",
  "영어로 꿈꾸는 날이 올 거야 🛌",
  "커피 한 잔 마실 시간이면 단어 5개 충분해 ☕",
  "어제보다 단어 5개 더 아는 나, 멋진데? 😉",
  "영어 공부 = 자신에게 드리는 투자 💰",
  "세상은 영어를 쓰는 사람에게 더 넓어 🗺️",
  "오늘 안 하면 에빙하우스가 가져간다 👻",
  "기억이 흐려지기 전에 복습하자 ⏰",
  "단어를 알면 두려움이 사라진다 😤",
  "오늘도 한 걸음, 내일도 한 걸음 🚶",
  "영어 한마디가 인생을 바꿀 수 있어 🔮",
  "귀찮아도 3초만! 하면 계속돼 🔃",
  "졸업한 단어는 영원히 내 것이야 🎓",
  "오늘의 5단어가 내일의 자신감 😤",
  "영어는 하면 할수록 쉬워져 📉",
  "어휘력이 곧 경쟁력이야 💼",
  "하루보카와 1000일 챌린지, 함께해! 🏁",
  "알림 봤으면 시작한 거야, 이미 절반! 🔔",
  "오늘도 꾸준히, 나를 믿어 🤜",
  "틈새 시간을 잡아라! 지금 이 순간 ⚡",
  "모르는 단어가 아는 단어 되는 그 순간 ✨",
  "100일 후 나는 달라져 있을 거야 🌅",
];

Deno.serve(async () => {
  // 환경변수 확인
  const vapidPublic  = Deno.env.get("VAPID_PUBLIC_KEY")  ?? "";
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  const vapidEmail   = Deno.env.get("VAPID_EMAIL")       ?? "mailto:admin@haruv.app";

  if (!vapidPublic || !vapidPrivate) {
    return new Response(JSON.stringify({ error: "VAPID keys not set" }), { status: 500 });
  }

  webPush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);

  // 현재 KST 시각 (UTC+9)
  const kstHour = (new Date().getUTCHours() + 9) % 24;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("subscription")
    .eq("notify_hour", kstHour)
    .eq("enabled", true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
  const payload = JSON.stringify({ title: "하루보카 📚", body: msg });

  const results = await Promise.allSettled(
    (subs ?? []).map(row => webPush.sendNotification(row.subscription, payload))
  );

  const sent     = results.filter(r => r.status === "fulfilled").length;
  const failures = results.filter(r => r.status === "rejected").length;

  return new Response(JSON.stringify({ kstHour, sent, failures }), {
    headers: { "Content-Type": "application/json" }
  });
});
