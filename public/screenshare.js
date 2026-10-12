/* DarkChat — ekran ulashish (screen share) moduli.
   Alohida fayl: ekranni olish va to'xtatish mantig'i shu yerda.
   script.js faqat window.ScreenShare ni chaqiradi (1:1 qo'ng'iroq va guruh videochat uchun).

   API:
     ScreenShare.supported()          -> true/false (telefonlarda odatda false)
     await ScreenShare.start(opts)    -> { stream, track }
         opts: { width, height, frameRate, cursor, onEnded }
         onEnded — foydalanuvchi brauzerdagi "Ulashishni to'xtatish" tugmasini bossa chaqiriladi
     ScreenShare.stop(streamOrTrack)  -> trek/oqimni to'xtatadi
*/
(function () {
  'use strict';

  const DEFAULTS = { width: 1920, height: 1080, frameRate: 30, cursor: null };

  function supported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  }

  function stop(x) {
    if (!x) return;
    const tracks = typeof x.getTracks === 'function' ? x.getTracks() : [x];
    tracks.forEach((t) => { try { t.onended = null; t.stop(); } catch (_) {} });
  }

  async function start(opts) {
    if (!supported()) throw new Error('no-screen');
    const o = Object.assign({}, DEFAULTS, opts || {});
    const video = {
      width: { ideal: o.width },
      height: { ideal: o.height },
      frameRate: { ideal: o.frameRate },
    };
    if (o.cursor) video.cursor = o.cursor;
    const stream = await navigator.mediaDevices.getDisplayMedia({ video, audio: false });
    const track = stream.getVideoTracks()[0];
    if (!track) { stop(stream); throw new Error('no screen track'); }
    if (typeof o.onEnded === 'function') track.onended = o.onEnded;
    return { stream, track };
  }

  window.ScreenShare = { supported, start, stop };
})();
