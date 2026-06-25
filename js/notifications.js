// 📲 Web Push 알림 — 앱이 꺼져있어도 매일 정해진 시간에 알림 수신
// 필수 설정: index.html 상단 window.VAPID_PUBLIC_KEY를 실제 공개키로 교체
// 서버 설정: supabase/push_schema.sql 실행 + functions/send-daily-reminder 배포 + cron 설정

window.Notif = (() => {
  const KEY = "ew_notif_v1";

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch { return {}; }
  }
  function save(p) { localStorage.setItem(KEY, JSON.stringify(p)); }

  function urlB64ToUint8(b64) {
    const pad = "=".repeat((4 - b64.length % 4) % 4);
    const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }

  function isSupported() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  }

  async function getStatus() {
    if (!isSupported()) return { supported: false };
    const pref = load();
    const vapidOk = !!(window.VAPID_PUBLIC_KEY && !window.VAPID_PUBLIC_KEY.startsWith("YOUR_"));
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return {
      supported: true,
      vapidOk,
      permission: Notification.permission,
      subscribed: !!sub,
      hour: typeof pref.hour === "number" ? pref.hour : 8,
      enabled: !!sub && pref.enabled === true
    };
  }

  async function subscribe(hour) {
    if (!isSupported()) return { ok: false, reason: "unsupported" };
    const vapidKey = window.VAPID_PUBLIC_KEY;
    if (!vapidKey || vapidKey.startsWith("YOUR_")) return { ok: false, reason: "no_vapid_key" };

    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, reason: "denied" };

    const reg = await navigator.serviceWorker.ready;
    let sub;
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8(vapidKey)
      });
    } catch (e) {
      return { ok: false, reason: "failed", detail: e.message };
    }

    save({ hour, enabled: true, endpoint: sub.endpoint });
    if (window.Cloud && window.Cloud.savePushSub) {
      await window.Cloud.savePushSub(sub.endpoint, sub.toJSON(), hour);
    }
    return { ok: true };
  }

  async function updateHour(hour) {
    const pref = load();
    save({ ...pref, hour });
    if (pref.endpoint && window.Cloud && window.Cloud.savePushSub) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await window.Cloud.savePushSub(pref.endpoint, sub.toJSON(), hour);
    }
  }

  async function unsubscribe() {
    const pref = load();
    if (pref.endpoint && window.Cloud && window.Cloud.removePushSub) {
      await window.Cloud.removePushSub(pref.endpoint);
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    save({ ...pref, enabled: false, endpoint: null });
  }

  return { getStatus, subscribe, updateHour, unsubscribe };
})();
