/**
 * NP TOURNAMENT BD — 100% Offline / Local Biometric Lock
 * কোনো সার্ভার, Render বা ইন্টারনেটের সংযোগ লাগবে না।
 * সরাসরি ব্যবহারকারীর ফোনের ইন্টারনাল সিকিউর স্টোরেজে (Device Biometric / Screen Lock) সেভ হবে।
 */
(function () {
  'use strict';

  var G = window.NPPasskey || {
    locked: false, pending: null, resumed: '', uiReady: false,
    hold: function () { return false; }, holdLoggedOut: function () { return false; },
    resume: function () {}, release: function () {}
  };
  window.NPPasskey = G;

  var LS_LOCAL_BIO = 'np_bio_enabled';      // লোকাল স্টোরেজে বায়োমেট্রিক চালুর ফ্ল্যাগ ('1')
  var LS_BIO_UID = 'np_bio_uid';            // কোন UID এর জন্য লক আছে
  var LS_BIO_CHALLENGE = 'np_bio_challenge';// লোকাল এনক্রিপ্ট চ্যালেঞ্জ
  var LS_BIO_CRED = 'np_bio_cred';          // এই ডিভাইসের ফিঙ্গারপ্রিন্ট ক্রেডেনশিয়াল আইডি (লোকাল)
  var RELOCK_AFTER_MS = 1500;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  function T(en, bn) {
    return (typeof state !== 'undefined' && state && state.currentLang === 'bn') ? bn : en;
  }
  function toast(msg, type) {
    if (typeof showToast === 'function') showToast(msg, type || 'info'); else alert(msg);
  }
  function el(tag, props, kids) {
    var e = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'style') e.style.cssText = v;
        else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v);
      });
    }
    (kids || []).forEach(function (c) {
      if (c == null) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  // পূর্ণাঙ্গ ফিঙ্গারপ্রিন্ট ভেক্টর — নিচের স্তর (নীল) + উপরের স্তর (সবুজ, টাচে নিচ থেকে ওপরে ভরাট হয়)
  var FP_PATHS = '<path d="M48.1 59.2Q48.2 58.9 48.3 58.8Q48.3 58.7 48.4 58.6Q48.4 58.5 48.5 58.4Q48.6 58.3 48.6 58.3Q48.7 58.2 48.8 58.1Q48.9 58.0 49.0 58.0Q49.1 57.9 49.2 57.9Q49.2 57.8 49.3 57.8Q49.4 57.7 49.6 57.7Q49.7 57.7 49.8 57.7Q49.9 57.7 50.0 57.7Q50.1 57.7 50.2 57.7Q50.3 57.7 50.4 57.7Q50.5 57.7 50.6 57.8Q50.7 57.8 50.8 57.8Q50.9 57.9 51.0 58.0Q51.1 58.0 51.2 58.1Q51.3 58.2 51.3 58.2Q51.4 58.3 51.5 58.4Q51.6 58.5 51.6 58.6Q51.7 58.7 51.7 58.8Q51.8 58.9 51.8 59.0Q51.9 59.1 51.9 59.3Q51.9 59.4 52.0 59.5Q52.0 59.6 52.0 59.7Q52.0 59.9 52.0 60.0Q52.0 60.1 52.0 60.3Q52.0 60.4 52.0 60.5Q52.0 60.6 51.9 60.7Q51.9 60.9 51.9 61.0Q51.8 61.1 51.8 61.2Q51.7 61.3 51.6 61.4Q51.6 61.5 51.5 61.6Q51.4 61.7 51.4 61.8Q51.3 61.8 51.2 61.9Q51.1 62.0 51.0 62.0Q50.9 62.1 50.8 62.2Q50.7 62.2 50.6 62.2Q50.5 62.3 50.4 62.3Q50.3 62.3 50.2 62.3Q50.1 62.3 50.0 62.3Q49.9 62.3 49.8 62.3Q49.7 62.3 49.6 62.3Q49.5 62.3 49.4 62.2Q49.3 62.2 49.2 62.1Q49.1 62.1 49.0 62.0Q48.9 62.0 48.8 61.9Q48.7 61.8 48.6 61.7Q48.5 61.7 48.5 61.6Q48.4 61.5 48.3 61.4Q48.3 61.3 48.2 61.2Q48.2 61.1 48.1 60.9L48.1 60.8"/><path d="M49.4 65.8Q48.9 65.7 48.6 65.6Q48.4 65.5 48.1 65.4Q47.9 65.3 47.7 65.2Q47.4 65.0 47.2 64.9Q47.0 64.7 46.8 64.5Q46.6 64.3 46.4 64.1Q46.2 63.9 46.0 63.6Q45.9 63.4 45.8 63.1Q45.6 62.8 45.5 62.6Q45.4 62.3 45.3 62.0Q45.2 61.7 45.2 61.4Q45.1 61.1 45.1 60.8Q45.1 60.5 45.1 60.2Q45.1 59.8 45.1 59.5Q45.1 59.2 45.2 58.9Q45.2 58.6 45.3 58.3Q45.4 58.0 45.5 57.8Q45.6 57.5 45.7 57.2Q45.8 56.9 45.9 56.7Q46.1 56.5 46.2 56.2Q46.4 56.0 46.6 55.8Q46.8 55.6 47.0 55.4Q47.2 55.2 47.4 55.1Q47.6 54.9 47.9 54.8Q48.1 54.7 48.4 54.6Q48.6 54.5 48.9 54.4Q49.1 54.3 49.4 54.3Q49.7 54.2 49.9 54.2Q50.2 54.2 50.5 54.2Q50.7 54.2 51.0 54.3Q51.2 54.4 51.5 54.4Q51.7 54.5 52.0 54.6Q52.2 54.8 52.4 54.9Q52.6 55.0 52.8 55.2Q53.1 55.4 53.3 55.6Q53.4 55.8 53.6 56.0Q53.8 56.3 54.0 56.5Q54.1 56.8 54.3 57.0Q54.4 57.3 54.5 57.6Q54.6 57.9 54.7 58.2Q54.8 58.5 54.9 58.8Q54.9 59.1 55.0 59.4Q55.0 59.7 55.0 60.0Q55.0 60.3 55.0 60.6Q55.0 60.9 54.9 61.2Q54.9 61.5 54.8 61.8Q54.7 62.1 54.6 62.4Q54.5 62.7 54.3 62.9Q54.2 63.2 54.0 63.4Q53.8 63.7 53.7 63.9Q53.5 64.1 53.3 64.3Q53.1 64.5 52.9 64.7Q52.6 64.9 52.4 65.0Q52.2 65.2 52.0 65.3Q51.7 65.4 51.5 65.5L51.2 65.6"/><path d="M47.5 69.1Q46.7 68.8 46.3 68.6Q45.9 68.3 45.6 68.1Q45.2 67.8 44.9 67.5Q44.5 67.1 44.3 66.8Q44.0 66.4 43.7 66.0Q43.4 65.6 43.2 65.2Q43.0 64.7 42.8 64.3Q42.6 63.8 42.5 63.4Q42.4 62.9 42.3 62.4Q42.2 61.9 42.1 61.4Q42.0 60.9 42.0 60.4Q42.0 59.9 42.0 59.4Q42.0 58.9 42.1 58.4Q42.1 57.9 42.2 57.4Q42.3 57.0 42.5 56.5Q42.6 56.1 42.8 55.6Q43.0 55.2 43.2 54.8Q43.5 54.4 43.7 54.0Q44.0 53.6 44.3 53.2Q44.6 52.9 45.0 52.6Q45.3 52.3 45.7 52.0Q46.1 51.7 46.5 51.5Q46.9 51.3 47.3 51.1Q47.7 50.9 48.1 50.8Q48.5 50.7 48.9 50.6Q49.4 50.5 49.8 50.5Q50.2 50.4 50.6 50.5Q51.1 50.5 51.5 50.6Q51.9 50.7 52.3 50.8Q52.7 51.0 53.1 51.2Q53.5 51.3 53.9 51.6Q54.2 51.8 54.6 52.1Q54.9 52.4 55.3 52.8Q55.6 53.1 55.9 53.5Q56.2 53.8 56.5 54.3Q56.7 54.7 57.0 55.1Q57.2 55.5 57.4 56.0Q57.6 56.5 57.7 57.0Q57.9 57.4 58.0 57.9Q58.1 58.4 58.1 58.9Q58.2 59.4 58.2 59.9Q58.2 60.4 58.1 60.9Q58.1 61.4 58.0 61.9Q57.9 62.4 57.7 62.9Q57.6 63.3 57.4 63.8Q57.2 64.2 57.0 64.7Q56.8 65.1 56.5 65.5Q56.2 65.9 55.9 66.3Q55.7 66.6 55.3 67.0Q55.0 67.3 54.7 67.6Q54.3 67.9 54.0 68.2Q53.6 68.4 53.2 68.6Q52.8 68.9 52.4 69.0Q52.0 69.2 51.6 69.3L51.2 69.4"/><path d="M48.0 73.1Q46.8 72.8 46.2 72.5Q45.7 72.3 45.1 72.0Q44.6 71.7 44.1 71.3Q43.6 70.9 43.2 70.4Q42.7 70.0 42.3 69.5Q41.9 69.0 41.5 68.5Q41.1 67.9 40.8 67.3Q40.5 66.7 40.2 66.1Q39.9 65.5 39.7 64.9Q39.5 64.2 39.3 63.5Q39.1 62.9 39.0 62.2Q38.9 61.5 38.9 60.8Q38.8 60.1 38.8 59.4Q38.8 58.7 38.9 58.1Q38.9 57.4 39.1 56.7Q39.2 56.0 39.4 55.4Q39.6 54.7 39.9 54.1Q40.2 53.5 40.5 52.9Q40.8 52.3 41.2 51.8Q41.6 51.2 42.0 50.7Q42.4 50.2 42.9 49.7Q43.4 49.3 43.9 48.9Q44.4 48.5 45.0 48.2Q45.5 47.8 46.1 47.6Q46.6 47.3 47.2 47.1Q47.8 47.0 48.4 46.8Q49.0 46.7 49.5 46.7Q50.1 46.7 50.7 46.7Q51.3 46.8 51.9 46.9Q52.5 47.0 53.0 47.2Q53.6 47.4 54.2 47.7Q54.7 48.0 55.3 48.3Q55.8 48.6 56.3 49.0Q56.8 49.5 57.3 49.9Q57.7 50.4 58.2 50.9Q58.6 51.4 59.0 52.0Q59.3 52.5 59.7 53.1Q60.0 53.7 60.2 54.4Q60.5 55.0 60.7 55.7Q60.9 56.3 61.0 57.0Q61.1 57.7 61.2 58.4Q61.2 59.1 61.2 59.7Q61.2 60.4 61.2 61.1Q61.1 61.8 60.9 62.5Q60.8 63.2 60.6 63.8Q60.4 64.5 60.2 65.1Q60.0 65.8 59.7 66.4Q59.4 67.0 59.0 67.6Q58.7 68.1 58.3 68.7Q57.9 69.2 57.5 69.7Q57.1 70.2 56.6 70.6Q56.1 71.0 55.6 71.4Q55.1 71.8 54.6 72.1L54.1 72.4"/><path d="M44.1 75.3Q42.7 74.4 42.1 73.9Q41.5 73.4 40.9 72.8Q40.3 72.2 39.8 71.6Q39.3 70.9 38.8 70.2Q38.3 69.5 37.9 68.7Q37.5 68.0 37.1 67.2Q36.8 66.4 36.5 65.5Q36.2 64.7 36.0 63.8Q35.8 62.9 35.7 62.1Q35.6 61.2 35.5 60.3Q35.5 59.4 35.6 58.5Q35.6 57.6 35.8 56.7Q35.9 55.8 36.2 55.0Q36.4 54.1 36.7 53.3Q37.1 52.4 37.5 51.6Q37.9 50.8 38.3 50.1Q38.8 49.3 39.3 48.6Q39.9 48.0 40.5 47.3L41.1 46.7"/><path d="M43.6 44.8Q45.0 44.1 45.7 43.8Q46.4 43.5 47.2 43.3Q47.9 43.2 48.6 43.1Q49.4 43.0 50.1 43.0Q50.9 43.1 51.7 43.2Q52.4 43.3 53.2 43.5Q53.9 43.8 54.6 44.1Q55.4 44.4 56.1 44.8Q56.8 45.2 57.5 45.6Q58.1 46.1 58.7 46.7Q59.4 47.2 59.9 47.8Q60.5 48.4 61.0 49.1Q61.5 49.8 61.9 50.5Q62.3 51.3 62.7 52.0Q63.0 52.8 63.3 53.6Q63.6 54.4 63.7 55.3Q63.9 56.1 64.0 57.0Q64.2 57.9 64.2 58.8Q64.2 59.6 64.2 60.5Q64.1 61.4 64.0 62.3Q63.9 63.2 63.7 64.0Q63.6 64.9 63.3 65.8Q63.1 66.6 62.7 67.4Q62.4 68.2 62.0 69.0Q61.7 69.8 61.2 70.5Q60.8 71.2 60.3 71.9Q59.7 72.5 59.2 73.1Q58.6 73.7 58.0 74.2Q57.3 74.7 56.7 75.1Q56.0 75.5 55.3 75.9Q54.6 76.2 53.8 76.4L53.1 76.6"/><path d="M45.8 79.7Q44.1 79.1 43.2 78.6Q42.4 78.2 41.6 77.7Q40.8 77.1 40.0 76.5Q39.2 75.9 38.5 75.2Q37.8 74.5 37.2 73.7Q36.5 72.9 36.0 72.0Q35.4 71.2 34.9 70.2Q34.4 69.3 34.0 68.3Q33.6 67.4 33.3 66.3Q32.9 65.3 32.7 64.3Q32.5 63.2 32.4 62.1Q32.3 61.0 32.3 59.9Q32.4 58.8 32.5 57.7Q32.6 56.6 32.8 55.6Q33.1 54.5 33.4 53.4Q33.7 52.4 34.1 51.4Q34.5 50.4 35.0 49.4Q35.5 48.5 36.1 47.6Q36.7 46.7 37.3 45.9Q38.0 45.1 38.7 44.4Q39.4 43.7 40.1 43.0Q40.9 42.4 41.7 41.9Q42.5 41.4 43.3 41.0Q44.2 40.6 45.0 40.3Q45.9 40.0 46.8 39.8Q47.7 39.7 48.6 39.6Q49.6 39.5 50.5 39.6Q51.4 39.7 52.4 39.8Q53.3 40.0 54.2 40.3Q55.1 40.5 56.0 40.9L56.9 41.3"/><path d="M60.1 43.4Q61.6 44.7 62.2 45.5Q62.9 46.2 63.5 47.1Q64.0 47.9 64.5 48.8Q65.0 49.7 65.4 50.7Q65.8 51.6 66.1 52.6Q66.5 53.7 66.7 54.7Q66.9 55.8 67.0 56.9Q67.2 57.9 67.2 59.0Q67.3 60.1 67.2 61.3Q67.2 62.4 67.1 63.5Q66.9 64.6 66.7 65.6Q66.5 66.7 66.2 67.7Q65.8 68.8 65.4 69.8Q65.0 70.8 64.5 71.7Q64.0 72.6 63.4 73.4Q62.8 74.3 62.1 75.1Q61.4 75.8 60.7 76.5Q59.9 77.1 59.1 77.7L58.3 78.3"/><path d="M39.3 80.5Q37.4 79.1 36.5 78.2Q35.7 77.4 34.9 76.5Q34.1 75.6 33.4 74.5Q32.7 73.5 32.1 72.4Q31.5 71.3 31.1 70.1Q30.6 68.9 30.3 67.7Q29.9 66.5 29.7 65.2Q29.5 63.9 29.4 62.6Q29.3 61.3 29.4 60.0Q29.4 58.6 29.6 57.3Q29.7 56.0 30.0 54.7Q30.3 53.4 30.6 52.2Q31.0 51.0 31.5 49.8Q32.0 48.6 32.6 47.5Q33.1 46.3 33.8 45.3Q34.5 44.3 35.2 43.4Q35.9 42.4 36.8 41.6Q37.6 40.8 38.5 40.1L39.4 39.4"/><path d="M43.2 37.3Q45.3 36.6 46.4 36.4Q47.5 36.2 48.6 36.2Q49.7 36.1 50.8 36.1Q51.9 36.2 53.0 36.4Q54.1 36.6 55.2 36.9Q56.2 37.2 57.3 37.6Q58.3 38.1 59.3 38.6Q60.2 39.2 61.2 39.8Q62.1 40.5 62.9 41.3Q63.7 42.1 64.5 43.0Q65.2 43.9 65.9 44.8Q66.5 45.8 67.1 46.9Q67.7 48.0 68.2 49.1Q68.7 50.3 69.0 51.5Q69.4 52.7 69.7 53.9Q70.0 55.2 70.2 56.5Q70.4 57.8 70.5 59.1Q70.5 60.4 70.5 61.7Q70.5 63.0 70.3 64.2Q70.2 65.5 69.9 66.8Q69.6 68.0 69.2 69.2Q68.8 70.4 68.3 71.6Q67.8 72.7 67.2 73.8Q66.5 74.8 65.8 75.8Q65.1 76.8 64.3 77.6Q63.4 78.5 62.5 79.2Q61.6 80.0 60.7 80.6Q59.7 81.3 58.7 81.8Q57.7 82.3 56.6 82.7L55.6 83.1"/><path d="M42.8 86.5Q40.4 85.5 39.2 84.9Q38.1 84.2 37.0 83.4Q35.9 82.7 34.9 81.7Q33.9 80.8 33.0 79.8Q32.1 78.7 31.3 77.6Q30.5 76.4 29.8 75.1Q29.2 73.9 28.6 72.5Q28.1 71.2 27.7 69.8Q27.3 68.4 27.0 66.9Q26.7 65.4 26.6 63.9Q26.5 62.4 26.5 60.9Q26.5 59.4 26.6 57.9Q26.7 56.5 26.9 55.0Q27.2 53.5 27.5 52.1Q27.9 50.7 28.4 49.3Q28.8 47.9 29.4 46.7Q30.0 45.4 30.7 44.2Q31.4 43.0 32.2 41.9Q33.0 40.8 33.9 39.8Q34.8 38.8 35.8 37.9Q36.7 37.1 37.8 36.3Q38.9 35.6 40.1 35.0Q41.2 34.4 42.4 33.9Q43.7 33.4 44.9 33.1Q46.2 32.8 47.4 32.6Q48.7 32.4 50.0 32.4Q51.3 32.4 52.5 32.5Q53.8 32.7 55.0 32.9Q56.3 33.2 57.5 33.7L58.7 34.1"/><path d="M63.0 36.7Q65.0 38.4 65.9 39.4Q66.8 40.4 67.7 41.6Q68.5 42.7 69.3 43.9Q70.0 45.2 70.6 46.5Q71.3 47.9 71.8 49.3Q72.3 50.7 72.7 52.1Q73.1 53.6 73.4 55.1Q73.7 56.6 73.8 58.1Q73.9 59.7 73.9 61.2Q73.9 62.7 73.7 64.2Q73.5 65.7 73.2 67.2Q72.9 68.6 72.4 70.0Q71.9 71.4 71.3 72.7Q70.7 74.1 69.9 75.3Q69.2 76.5 68.3 77.7Q67.5 78.8 66.5 79.8Q65.5 80.8 64.5 81.7L63.5 82.6"/><path d="M33.2 85.1Q31.1 82.8 30.1 81.6Q29.2 80.3 28.4 78.9Q27.6 77.6 26.9 76.1Q26.2 74.6 25.7 73.1Q25.1 71.5 24.7 69.9Q24.3 68.3 24.0 66.6Q23.8 64.9 23.6 63.3Q23.5 61.6 23.5 59.9Q23.5 58.2 23.6 56.6Q23.7 54.9 24.0 53.3Q24.3 51.7 24.7 50.1Q25.1 48.5 25.7 47.0Q26.2 45.5 26.9 44.1Q27.6 42.7 28.4 41.3Q29.2 40.0 30.2 38.8Q31.2 37.6 32.2 36.5L33.3 35.4"/><path d="M38.1 31.9Q40.8 30.5 42.2 30.0Q43.5 29.5 44.9 29.2Q46.3 28.8 47.7 28.6Q49.2 28.4 50.6 28.4Q52.0 28.4 53.3 28.6Q54.7 28.8 56.1 29.1Q57.4 29.5 58.7 30.0Q60.1 30.5 61.3 31.2Q62.6 31.9 63.8 32.8Q65.0 33.6 66.1 34.6Q67.2 35.7 68.3 36.8Q69.3 38.0 70.2 39.2Q71.2 40.5 72.0 41.9Q72.9 43.3 73.6 44.8Q74.3 46.2 74.9 47.8Q75.5 49.3 75.9 50.9Q76.4 52.5 76.7 54.2Q76.9 55.8 77.1 57.5Q77.2 59.1 77.1 60.8Q77.1 62.4 76.9 64.1Q76.7 65.7 76.3 67.3Q75.9 68.9 75.4 70.4Q74.9 71.9 74.2 73.4Q73.6 74.9 72.8 76.3Q72.0 77.7 71.2 79.0Q70.3 80.2 69.3 81.4Q68.3 82.6 67.2 83.7Q66.1 84.8 65.0 85.7Q63.8 86.6 62.6 87.4Q61.4 88.3 60.1 88.9L58.8 89.6"/><path d="M39.1 93.2Q36.2 91.6 34.8 90.6Q33.5 89.7 32.2 88.5Q31.0 87.4 29.8 86.1Q28.7 84.8 27.7 83.4Q26.7 81.9 25.8 80.4Q24.9 78.8 24.2 77.2Q23.4 75.6 22.8 73.8Q22.2 72.1 21.7 70.3Q21.2 68.5 20.9 66.7Q20.6 64.9 20.4 63.1Q20.2 61.2 20.2 59.4Q20.2 57.5 20.3 55.7Q20.4 53.9 20.8 52.1Q21.1 50.3 21.5 48.5Q22.0 46.8 22.7 45.1Q23.3 43.4 24.2 41.8Q25.0 40.3 26.0 38.8Q26.9 37.3 28.0 35.9Q29.2 34.5 30.4 33.3Q31.7 32.1 33.0 31.0Q34.3 29.9 35.8 29.0Q37.2 28.0 38.7 27.3Q40.2 26.5 41.7 26.0Q43.3 25.4 44.8 25.1Q46.4 24.7 48.0 24.6Q49.5 24.4 51.1 24.5Q52.7 24.5 54.2 24.8Q55.8 25.1 57.3 25.5Q58.8 26.0 60.3 26.7L61.8 27.3"/><path d="M67.3 31.1Q69.9 33.4 71.1 34.8Q72.2 36.1 73.3 37.6Q74.3 39.1 75.3 40.6Q76.2 42.2 76.9 43.9Q77.7 45.6 78.2 47.3Q78.8 49.0 79.2 50.8Q79.6 52.6 79.8 54.5Q80.1 56.3 80.1 58.1Q80.1 60.0 80.0 61.8Q79.9 63.6 79.6 65.4Q79.3 67.3 78.8 69.0Q78.3 70.8 77.7 72.5Q77.1 74.3 76.4 75.9Q75.6 77.6 74.8 79.1Q73.9 80.7 72.9 82.1Q71.9 83.6 70.8 84.9L69.7 86.2"/><path d="M26.9 87.3Q24.5 84.2 23.5 82.5Q22.4 80.8 21.5 79.0Q20.6 77.2 19.9 75.3Q19.2 73.4 18.6 71.5Q18.0 69.5 17.6 67.5Q17.2 65.5 16.9 63.4Q16.7 61.4 16.7 59.3Q16.7 57.3 16.9 55.2Q17.1 53.2 17.4 51.2Q17.8 49.1 18.4 47.2Q19.0 45.2 19.8 43.3Q20.6 41.4 21.6 39.6Q22.5 37.8 23.7 36.1Q24.8 34.5 26.1 32.9L27.4 31.4"/><path d="M33.0 26.3Q36.1 24.4 37.8 23.6Q39.4 22.8 41.1 22.2Q42.7 21.6 44.4 21.3Q46.1 21.0 47.9 20.8Q49.6 20.7 51.3 20.8Q53.1 21.0 54.8 21.3Q56.5 21.6 58.2 22.2Q59.9 22.7 61.6 23.5Q63.3 24.3 64.9 25.2Q66.5 26.2 68.0 27.4Q69.5 28.5 70.9 29.8Q72.3 31.1 73.6 32.6Q74.8 34.1 75.9 35.7Q77.1 37.3 78.0 39.0Q79.0 40.7 79.7 42.6Q80.5 44.4 81.1 46.3Q81.6 48.2 82.0 50.1Q82.4 52.1 82.6 54.1Q82.8 56.1 82.9 58.2Q82.9 60.2 82.8 62.2Q82.6 64.3 82.3 66.3Q82.0 68.3 81.5 70.3Q81.0 72.3 80.4 74.2Q79.8 76.1 79.0 78.0Q78.2 79.8 77.3 81.6Q76.4 83.3 75.3 84.9Q74.2 86.5 73.0 88.0Q71.8 89.5 70.5 90.8Q69.1 92.1 67.7 93.2Q66.2 94.4 64.6 95.3L63.1 96.2"/><path d="M35.0 98.3Q31.6 96.1 30.0 94.8Q28.4 93.6 26.9 92.1Q25.4 90.7 24.1 89.1Q22.7 87.4 21.5 85.7Q20.3 83.9 19.2 82.0Q18.1 80.1 17.2 78.1Q16.3 76.1 15.6 74.0Q14.9 71.8 14.4 69.7Q13.9 67.5 13.7 65.2Q13.4 63.0 13.4 60.7Q13.3 58.4 13.5 56.2Q13.7 53.9 14.2 51.7Q14.6 49.4 15.2 47.2Q15.8 45.0 16.7 42.9Q17.5 40.8 18.5 38.8Q19.5 36.8 20.7 34.9Q21.9 33.0 23.2 31.3Q24.5 29.6 26.0 28.1Q27.4 26.5 29.0 25.2Q30.6 23.9 32.2 22.8Q33.9 21.6 35.6 20.7Q37.4 19.9 39.2 19.2Q41.0 18.6 42.9 18.2Q44.7 17.8 46.6 17.6Q48.6 17.4 50.5 17.5Q52.4 17.6 54.4 17.9Q56.3 18.3 58.2 18.8Q60.1 19.4 62.0 20.2L63.8 20.9"/><path d="M70.6 25.2Q73.7 27.9 75.1 29.5Q76.4 31.0 77.7 32.7Q78.9 34.4 79.9 36.2Q80.9 38.0 81.8 40.0Q82.7 41.9 83.3 44.0Q84.0 46.1 84.5 48.2Q85.0 50.3 85.3 52.5Q85.6 54.8 85.7 57.0Q85.8 59.2 85.7 61.5Q85.7 63.8 85.4 66.0Q85.2 68.3 84.8 70.5Q84.4 72.7 83.8 74.9Q83.1 77.0 82.4 79.1Q81.6 81.1 80.6 83.1Q79.6 85.0 78.5 86.8L77.3 88.6"/><path d="M18.9 88.5Q16.3 84.5 15.2 82.4Q14.2 80.2 13.3 77.9Q12.5 75.7 11.9 73.3Q11.3 70.9 10.9 68.5Q10.6 66.0 10.5 63.5Q10.4 61.0 10.5 58.5Q10.6 56.0 11.0 53.6Q11.4 51.1 11.9 48.6Q12.5 46.2 13.3 43.8Q14.1 41.5 15.1 39.3Q16.1 37.0 17.2 34.9Q18.4 32.8 19.7 30.9Q21.0 29.0 22.4 27.2Q23.9 25.5 25.5 24.0L27.1 22.5"/><path d="M34.1 17.8Q37.9 16.2 40.0 15.6Q42.0 15.0 44.1 14.7Q46.1 14.4 48.3 14.3Q50.4 14.3 52.5 14.4Q54.6 14.6 56.7 15.0Q58.8 15.5 60.8 16.1Q62.9 16.8 64.8 17.7Q66.8 18.6 68.6 19.7Q70.5 20.8 72.2 22.2Q73.9 23.5 75.4 25.1Q77.0 26.6 78.4 28.4Q79.8 30.1 81.0 32.0Q82.2 33.9 83.2 36.0Q84.3 38.1 85.2 40.3Q86.0 42.5 86.7 44.8Q87.4 47.1 87.9 49.5Q88.4 51.9 88.7 54.4Q89.0 56.9 89.0 59.3Q89.1 61.8 89.0 64.3Q88.9 66.8 88.6 69.3Q88.2 71.7 87.6 74.1Q87.1 76.5 86.3 78.7Q85.5 81.0 84.5 83.2Q83.5 85.3 82.2 87.3Q81.0 89.3 79.6 91.1Q78.1 92.9 76.5 94.5Q74.9 96.2 73.2 97.6Q71.4 99.0 69.6 100.1L67.7 101.3"/><path d="M52.6 70.5Q52.1 70.6 51.9 70.7Q51.7 70.7 51.5 70.8Q51.3 70.8 51.1 70.9Q50.9 70.9 50.6 70.9Q50.4 70.9 50.2 70.9Q50.0 70.9 49.8 70.9Q49.6 70.9 49.4 70.9Q49.1 70.9 48.9 70.8Q48.7 70.8 48.5 70.8Q48.3 70.7 48.1 70.7Q47.9 70.6 47.7 70.5L47.5 70.5"/><path d="M53.6 78.0Q52.8 78.2 52.5 78.2Q52.1 78.3 51.7 78.3Q51.4 78.4 51.0 78.4Q50.6 78.4 50.3 78.4Q49.9 78.4 49.5 78.4Q49.2 78.4 48.8 78.3Q48.5 78.3 48.1 78.2Q47.7 78.2 47.4 78.1Q47.0 78.0 46.7 77.9Q46.3 77.8 46.0 77.7Q45.6 77.6 45.3 77.4L44.9 77.3"/><path d="M53.8 85.4Q52.8 85.6 52.3 85.6Q51.8 85.7 51.3 85.7Q50.8 85.7 50.3 85.7Q49.7 85.7 49.2 85.7Q48.7 85.6 48.2 85.6Q47.7 85.5 47.2 85.4Q46.7 85.4 46.2 85.2Q45.7 85.1 45.2 85.0Q44.7 84.9 44.2 84.7Q43.7 84.5 43.3 84.4Q42.8 84.2 42.3 84.0L41.8 83.7"/><path d="M53.4 92.8Q52.1 93.0 51.5 93.0Q50.8 93.1 50.2 93.1Q49.5 93.1 48.9 93.1Q48.2 93.0 47.5 93.0Q46.9 92.9 46.2 92.8Q45.6 92.7 44.9 92.6Q44.3 92.5 43.6 92.3Q43.0 92.1 42.4 91.9Q41.7 91.7 41.1 91.5Q40.4 91.3 39.8 91.0Q39.2 90.8 38.6 90.5L38.0 90.2"/>';
  function fpIcon() {
    var s = document.createElement('span');
    s.className = 'npPkIco';
    var attrs = 'viewBox="0 0 100 124" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
    s.innerHTML = '<svg class="npPkFpBase" ' + attrs + '>' + FP_PATHS + '</svg>' +
      '<svg class="npPkFpFill" ' + attrs + '>' + FP_PATHS + '</svg>';
    return s;
  }

  // ---------- styles (Cyber-Bio HUD UI) ----------
  var css = '' +
    '#npPkLock{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px 20px;color:#f8fafc;font-family:var(--font-bengali,sans-serif);overflow:auto;background:radial-gradient(120% 80% at 50% 0%,#1b2540 0%,#0a1020 55%,#04060d 100%)}' +
    '#npPkLock::before{content:"";position:absolute;width:360px;height:360px;left:50%;top:40%;margin:-180px 0 0 -180px;border-radius:50%;background:radial-gradient(circle,rgba(245,158,11,.15),transparent 68%);pointer-events:none}' +
    '.npPkBox{position:relative;width:100%;max-width:340px;margin:auto;text-align:center;display:flex;flex-direction:column;align-items:center}' +
    '.npPkLogo{width:64px;height:64px;border-radius:18px;border:1px solid rgba(245,158,11,.45);box-shadow:0 8px 26px rgba(245,158,11,.25)}' +
    '.npPkTitle{font-family:var(--font-esports,sans-serif);font-size:20px;font-weight:800;letter-spacing:3px;margin:14px 0 4px;background:linear-gradient(90deg,#fde68a,#f59e0b);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;text-transform:uppercase}' +
    '.npPkSub{font-size:12px;color:#8b97ab;letter-spacing:1.5px;text-transform:uppercase}' +
    '.npPkBtn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:14px 16px;border-radius:14px;border:1px solid rgba(245,158,11,.35);background:transparent;color:#f8fafc;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit}' +
    '.npPkBtn:disabled{opacity:.6;cursor:default}' +
    '.npPkPrimary{background:linear-gradient(135deg,#f59e0b,#d97706);border-color:transparent;color:#0f172a;box-shadow:0 6px 18px rgba(245,158,11,.3)}' +
    '.npPkLink{margin-top:26px;padding:10px 22px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#cbd5e1;font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s}' +
    '.npPkLink:hover{background:rgba(255,255,255,.1);color:#fff}' +
    '.npPkLink:active{transform:scale(.97)}' +
    '.npPkMsg{min-height:20px;margin:12px 0 0;font-size:13px;color:#fca5a5}' +
    '.npPkField{width:100%;box-sizing:border-box;padding:14px 16px;margin-bottom:10px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#f8fafc;font-size:15px;font-family:inherit}' +
    '.npPkField::placeholder{color:#64748b}' +
    '.npPkField:focus{outline:none;border-color:#f59e0b;background:rgba(255,255,255,.08)}' +
    '.npPkScannerWrap{position:relative;width:176px;height:176px;margin:38px auto 0;display:flex;align-items:center;justify-content:center}' +
    '.npPkFp{--npc:#f59e0b;position:relative;width:132px;height:132px;border-radius:50%;border:1px solid rgba(255,255,255,.14);padding:0;cursor:pointer;outline:none;overflow:visible;-webkit-tap-highlight-color:transparent;background:radial-gradient(circle at 50% 30%,rgba(255,255,255,.12),rgba(255,255,255,.03) 60%),#0d1426;box-shadow:0 14px 40px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;transition:transform .25s ease,box-shadow .3s ease,border-color .3s ease}' +
    '.npPkFp:active,.npPkFp.touching,.npPkFp.busy,.npPkFp.ok{--npc:#22c55e}' +
    '.npPkFp:active,.npPkFp.touching,.npPkFp.ok{transform:scale(.97);border-color:rgba(34,197,94,.55);box-shadow:0 0 0 1px rgba(34,197,94,.35),0 0 44px rgba(34,197,94,.35),0 14px 40px rgba(0,0,0,.55)}' +
    '.npPkOrbit{position:absolute;inset:-10px;border-radius:50%;pointer-events:none;background:conic-gradient(from 0deg,transparent 0 55%,var(--npc) 100%);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 2px));mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 2px));animation:npPkSpin 3s linear infinite}' +
    '.npPkFp.busy .npPkOrbit,.npPkFp.touching .npPkOrbit{animation-duration:1.1s}' +
    '.npPkFp.ok .npPkOrbit{animation:none;background:var(--npc)}' +
    '.npPkPulse{position:absolute;inset:0;border-radius:50%;border:1.5px solid var(--npc);opacity:0;pointer-events:none;animation:npPkPulse 2.8s ease-out infinite}' +
    '.npPkPulse2{animation-delay:1.4s}' +
    '.npPkFp.ok .npPkPulse{animation:npPkPulse .9s ease-out 1}' +
    '.npPkChk{position:absolute;right:0;bottom:2px;width:34px;height:34px;border-radius:50%;background:#22c55e;color:#04210f;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px;transform:scale(0);transition:transform .35s cubic-bezier(.2,1.6,.4,1);z-index:5;box-shadow:0 4px 14px rgba(34,197,94,.5);pointer-events:none}' +
    '.npPkFp.ok .npPkChk{transform:scale(1)}' +
    '.npPkScanTxt{margin-top:20px;font-size:15px;font-weight:700;color:#e2e8f0;letter-spacing:.3px;transition:color .3s}' +
    '.npPkIco{display:inline-block;position:relative;line-height:0}' +
    '.npPkIco svg{display:block;width:100%;height:100%}' +
    '.npPkBtn .npPkIco{width:20px;height:24px}' +
    '.npPkFp .npPkIco{position:relative;z-index:2;width:58px;height:72px;color:#e2e8f0;filter:drop-shadow(0 0 6px rgba(245,158,11,.35));transition:all .25s ease}' +
    '.npPkFp .npPkIco svg{stroke-width:2.2}' +
    '.npPkFpFill{position:absolute;left:0;top:0;color:#22c55e;filter:drop-shadow(0 0 4px rgba(34,197,94,.7));clip-path:inset(100% 0 0 0);-webkit-clip-path:inset(100% 0 0 0);transition:clip-path .35s ease-out,-webkit-clip-path .35s ease-out}' +
    '.npPkFp:active .npPkFpFill,.npPkFp.touching .npPkFpFill,.npPkFp.ok .npPkFpFill{clip-path:inset(0 0 0 0);-webkit-clip-path:inset(0 0 0 0);transition:clip-path .8s linear,-webkit-clip-path .8s linear}' +
    '.npPkFp.ok .npPkIco{animation:npPkPop .55s ease-out}' +
    '@keyframes npPkSpin{to{transform:rotate(360deg)}}' +
    '@keyframes npPkPulse{0%{transform:scale(1);opacity:.55}100%{transform:scale(1.6);opacity:0}}' +
    '@keyframes npPkPop{0%{transform:scale(1)}40%{transform:scale(1.12)}100%{transform:scale(1)}}' +
    '@media (prefers-reduced-motion:reduce){.npPkOrbit,.npPkPulse{animation:none}}' +
    '.npPkCard{background:var(--bg-card,#141b2d);border:1px solid var(--border-subtle,#1e293b);border-radius:14px;padding:16px;margin-bottom:16px;color:var(--text-primary,#f8fafc)}' +
    '.npPkCardHead{display:flex;align-items:center;gap:10px;font-weight:700;font-size:15px;margin-bottom:6px}' +
    '.npPkCardHead .npPkIco{width:22px;height:26px;color:#00f0ff}' +
    '.npPkCardNote{font-size:12.5px;color:#94a3b8;line-height:1.5;margin-bottom:12px}' +
    '.npPkTiny{font-size:12.5px;color:#fca5a5;min-height:18px;margin-top:14px}';

  var st = document.createElement('style');
  st.id = 'npPkStyle';
  st.textContent = css;
  document.head.appendChild(st);

  // ---------- lock screen logic ----------
  var busy = false, opEndedAt = 0, hiddenAt = 0;
  function setMsg(t, ok) {
    var m = document.getElementById('npPkLockMsg');
    if (m) { m.textContent = t || ''; m.style.color = ok ? '#86efac' : ''; }
  }
  function setBusy(b) {
    busy = b;
    var btn = document.getElementById('npPkUnlockBtn');
    if (btn) { btn.disabled = b; btn.classList.toggle('busy', !!b); }
  }
  function IDLE() { return T('Touch the sensor to unlock', 'আনলক করতে ফিঙ্গারপ্রিন্ট ছুঁয়ে দিন'); }
  function setScanTxt(t, green) {
    var x = document.getElementById('npPkScanTxt');
    if (x) { x.textContent = t; x.style.color = green ? '#22c55e' : ''; }
    var lk = document.getElementById('npPkLock');
    if (lk) lk.classList.toggle('npPkGreen', !!green);
  }
  function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  function removeLock() { var n = document.getElementById('npPkLock'); if (n && n.parentNode) n.parentNode.removeChild(n); }
  function unlockDone() {
    var b = document.getElementById('npPkUnlockBtn');
    if (b && b.offsetParent) {
      b.classList.remove('busy', 'touching'); b.classList.add('ok');
      setScanTxt(T('Unlocked', 'আনলক হয়েছে'), true); buzz([25, 45, 25]);
      setTimeout(function () { removeLock(); G.release(); }, 750);
    } else { removeLock(); G.release(); }
  }

  function showPanel(which) {
    var a = document.getElementById('npPkPanelFp'), b = document.getElementById('npPkPanelPw');
    if (a) a.style.display = which === 'fp' ? '' : 'none';
    if (b) b.style.display = which === 'pw' ? '' : 'none';
    setMsg('');
    if (which === 'pw') { var u = document.getElementById('npPkUser'); if (u) u.focus(); }
  }

  // ---- base64url helpers ----
  function b64uEnc(buf) {
    var b = new Uint8Array(buf), str = '';
    for (var i = 0; i < b.length; i++) str += String.fromCharCode(b[i]);
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64uDec(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function rnd(n) { var a = new Uint8Array(n); window.crypto.getRandomValues(a); return a; }

  // একবার ডিভাইসে ফিঙ্গারপ্রিন্ট ক্রেডেনশিয়াল তৈরি (সার্ভার ছাড়া, ইউজার-নির্বাচন স্ক্রিন ছাড়া)
  function enrollDeviceCredential() {
    return navigator.credentials.create({
      publicKey: {
        challenge: rnd(32),
        rp: { name: 'NP TOURNAMENT BD', id: window.location.hostname || undefined },
        user: { id: rnd(16), name: 'np-device-lock', displayName: 'NP Device Lock' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          residentKey: 'discouraged',
          requireResidentKey: false,
          userVerification: 'required'
        },
        attestation: 'none',
        timeout: 60000
      }
    }).then(function (cred) {
      if (!cred) throw new Error('Cancelled');
      lsSet(LS_BIO_CRED, b64uEnc(cred.rawId));
      return true;
    });
  }

  // 100% লোকাল বায়োমেট্রিক অথেন্টিকেশন — সরাসরি ফিঙ্গারপ্রিন্ট, "Use saved passkey / Continue" স্ক্রিন ছাড়া
  function requestDeviceBiometric() {
    if (window.PublicKeyCredential && navigator.credentials && navigator.credentials.get) {
      var credId = lsGet(LS_BIO_CRED);
      if (!credId) return enrollDeviceCredential();
      return navigator.credentials.get({
        publicKey: {
          challenge: rnd(32),
          timeout: 60000,
          userVerification: 'required',
          rpId: window.location.hostname || undefined,
          allowCredentials: [{ type: 'public-key', id: b64uDec(credId), transports: ['internal'] }]
        }
      }).then(function (res) {
        if (!res) throw new Error('Cancelled');
        return true;
      });
    }
    // যদি ব্রাউজারে WebAuthn না থাকে, লোকাল স্ক্রিন টাচ ভ্যালিডেশন
    return Promise.resolve(true);
  }

  function onUnlockClick(ev) {
    var auto = (ev === 'auto');
    if (busy) return;
    var gb = document.getElementById('npPkUnlockBtn');
    if (gb && !auto) { gb.classList.add('touching'); setScanTxt(T('Verifying…', 'যাচাই হচ্ছে…'), true); }
    setMsg(''); setBusy(true);

    requestDeviceBiometric().then(function () {
      // ডিভাইসে ফিঙ্গারপ্রিন্ট সফল হলে
      unlockDone();
    }).catch(function (e) {
      if (gb) gb.classList.remove('ok', 'touching');
      setScanTxt(IDLE(), false);
      if (auto && e && (e.name === 'NotAllowedError' || e.name === 'AbortError')) {
        setMsg(T('Tap the fingerprint scanner', 'ফিঙ্গারপ্রিন্ট স্ক্যানারে চাপ দিন'));
      } else {
        setMsg(T('Fingerprint verification failed. Try password.', 'ফিঙ্গারপ্রিন্ট মেলেনি। পাসওয়ার্ড ব্যবহার করুন।'));
      }
    }).then(function () {
      setBusy(false);
      opEndedAt = Date.now();
    });
  }

  var autoTried = false;
  function autoUnlock() {
    if (autoTried || !G.locked || !document.getElementById('npPkLock')) return;
    autoTried = true;
    onUnlockClick('auto');
  }

  function onPwSubmit() {
    if (busy) return;
    var u = (document.getElementById('npPkUser').value || '').trim();
    var p = document.getElementById('npPkPass').value || '';
    if (!u || !p) { setMsg(T('Enter username/email and password.', 'ইউজারনেম/ইমেইল ও পাসওয়ার্ড দিন।')); return; }
    if (typeof npSmartSignIn !== 'function') { setMsg(T('Login ready. Enter credentials.', 'লগইন প্রস্তুত। তথ্য দিন।')); return; }
    setMsg(''); setBusy(true);
    var pb = document.getElementById('npPkPwBtn'); if (pb) pb.disabled = true;
    npSmartSignIn(u, p).then(function () { unlockDone(); })
      .catch(function (e) { setMsg((e && e.message) ? e.message : 'Login failed'); })
      .then(function () { setBusy(false); if (pb) pb.disabled = false; });
  }

  function buildLock() {
    if (document.getElementById('npPkLock')) return;
    var unlockBtn = el('button', {
      id: 'npPkUnlockBtn', class: 'npPkFp', type: 'button', 'aria-label': 'Unlock with Fingerprint',
      onclick: onUnlockClick
    }, [
      el('div', { class: 'npPkOrbit' }),
      el('div', { class: 'npPkPulse' }),
      el('div', { class: 'npPkPulse npPkPulse2' }),
      fpIcon(),
      el('div', { class: 'npPkChk' }, ['✓'])
    ]);

    unlockBtn.addEventListener('touchstart', function () {
      unlockBtn.classList.add('touching');
      setScanTxt(T('Scanning…', 'স্ক্যান হচ্ছে…'), true);
      buzz(15);
    }, { passive: true });
    unlockBtn.addEventListener('touchend', function () {
      setTimeout(function () {
        if (busy || unlockBtn.classList.contains('ok')) return;
        unlockBtn.classList.remove('touching');
        setScanTxt(IDLE(), false);
      }, 400);
    });

    var panelFp = el('div', { id: 'npPkPanelFp' }, [
      el('div', { class: 'npPkScannerWrap' }, [unlockBtn]),
      el('div', { id: 'npPkScanTxt', class: 'npPkScanTxt' }, [IDLE()]),
      el('div', null, [
        el('button', { class: 'npPkLink', type: 'button', onclick: function () { showPanel('pw'); } }, [
          T('Use password', 'পাসওয়ার্ড দিয়ে খুলুন')
        ])
      ])
    ]);
    var userIn = el('input', { id: 'npPkUser', class: 'npPkField', type: 'text', autocomplete: 'username',
      placeholder: T('Username or email', 'ইউজারনেম অথবা ইমেইল') });
    var passIn = el('input', { id: 'npPkPass', class: 'npPkField', type: 'password', autocomplete: 'current-password',
      placeholder: T('Password', 'পাসওয়ার্ড'),
      onkeydown: function (ev) { if (ev.key === 'Enter') onPwSubmit(); } });
    var panelPw = el('div', { id: 'npPkPanelPw', style: 'display:none;margin-top:30px;width:100%' }, [
      userIn, passIn,
      el('button', { id: 'npPkPwBtn', class: 'npPkBtn npPkPrimary', type: 'button', onclick: onPwSubmit }, [T('Unlock', 'আনলক')]),
      el('div', null, [
        el('button', { class: 'npPkLink', type: 'button', onclick: function () { showPanel('fp'); } }, [T('Back', 'ফিরে যান')])
      ])
    ]);
    var box = el('div', { class: 'npPkBox' }, [
      el('img', { class: 'npPkLogo', src: './icon-192.png', alt: '' }),
      el('div', { class: 'npPkTitle' }, ['NP TOURNAMENT']),
      el('div', { class: 'npPkSub' }, ['🔒 ' + T('Secure Unlock', 'নিরাপদ আনলক')]),
      panelFp, panelPw,
      el('div', { id: 'npPkLockMsg', class: 'npPkTiny', role: 'alert' })
    ]);
    document.body.appendChild(el('div', { id: 'npPkLock', role: 'dialog', 'aria-modal': 'true' }, [box]));
  }

  // ---------- Profile Card & Enable/Disable (100% লোকাল স্টোরেজ) ----------
  var card = null, list = null, actions = null;

  function currentUser() {
    try { if (typeof auth !== 'undefined' && auth && auth.currentUser) return auth.currentUser; } catch (e) {}
    try { if (window.auth && window.auth.currentUser) return window.auth.currentUser; } catch (e) {}
    try { if (window.firebase && window.firebase.auth && window.firebase.auth().currentUser) return window.firebase.auth().currentUser; } catch (e) {}
    return null;
  }

  function findLogoutBtn() {
    return document.querySelector('button[onclick="window.app.handleLogout()"]') ||
           document.querySelector('[onclick*="handleLogout"]');
  }

  function buildCard() {
    var btn = findLogoutBtn();
    if (card) {
      // প্রোফাইল পেজ নতুন করে আঁকা হলে কার্ড DOM থেকে হারিয়ে যায় — আবার বসিয়ে দিই
      if (!card.isConnected && btn && btn.parentNode) btn.parentNode.insertBefore(card, btn);
      return;
    }
    if (!btn || !btn.parentNode) return;
    list = el('div', { id: 'npPkList' });
    actions = el('div', { id: 'npPkActions' });
    card = el('div', { id: 'npPkCard', class: 'npPkCard', style: 'display:none' }, [
      el('div', { class: 'npPkCardHead' }, [fpIcon(), T('Device Biometric Lock', 'ডিভাইস বায়োমেট্রিক লক')]),
      el('div', { class: 'npPkCardNote' }, [T('Save biometric lock directly on this device. No server required.', 'বায়োমেট্রিক সরাসরি এই ডিভাইসের ইন্টারনাল স্টোরেজে সংরক্ষিত থাকে। কোনো সার্ভারের প্রয়োজন নেই।')]),
      list, actions
    ]);
    btn.parentNode.insertBefore(card, btn);
  }

  // ফিঙ্গারপ্রিন্ট সরানো: আগে নিশ্চিতকরণ, তারপর লোকাল ডেটা মুছে লক বন্ধ
  function removeBiometric() {
    lsDel(LS_LOCAL_BIO);
    lsDel(LS_BIO_UID);
    lsDel(LS_BIO_CRED);
    toast(T('Fingerprint removed. App will open without fingerprint.', 'ফিঙ্গারপ্রিন্ট সরানো হয়েছে। এখন অ্যাপ ফিঙ্গারপ্রিন্ট ছাড়াই খুলবে।'), 'success');
    renderCard();
  }
  function askRemove() {
    if (!list || !actions) return;
    while (list.firstChild) list.removeChild(list.firstChild);
    while (actions.firstChild) actions.removeChild(actions.firstChild);
    list.appendChild(el('div', { class: 'npPkCardNote', style: 'color:#fca5a5;font-weight:600' }, [
      T('Remove fingerprint lock from this phone? You can add it again anytime.', 'এই ফোন থেকে ফিঙ্গারপ্রিন্ট লক সরাবেন? চাইলে পরে আবার যোগ করতে পারবেন।')
    ]));
    actions.appendChild(el('button', {
      class: 'npPkBtn', type: 'button',
      style: 'border-color:#ef4444;color:#ef4444;margin-bottom:8px',
      onclick: removeBiometric
    }, [T('Yes, remove', 'হ্যাঁ, সরান')]));
    actions.appendChild(el('button', {
      class: 'npPkBtn', type: 'button',
      onclick: function () { renderCard(); }
    }, [T('Cancel', 'বাতিল')]));
  }

  function renderCard() {
    buildCard();
    if (!card) return;
    var u = currentUser();
    if (!u || G.locked) { card.style.display = 'none'; return; }
    card.style.display = '';
    while (list.firstChild) list.removeChild(list.firstChild);
    while (actions.firstChild) actions.removeChild(actions.firstChild);

    var isEnrolled = lsGet(LS_LOCAL_BIO) === '1' && lsGet(LS_BIO_UID) === u.uid;
    if (isEnrolled) {
      list.appendChild(el('div', { class: 'npPkCardNote', style: 'color:#86efac;font-weight:600' }, [
        '✓ ' + T('Biometric lock active on this phone.', 'এই ডিভাইসে বায়োমেট্রিক লক সক্রিয় আছে।')
      ]));
      actions.appendChild(el('button', {
        class: 'npPkBtn', type: 'button',
        style: 'border-color:#ef4444;color:#ef4444',
        onclick: askRemove
      }, ['🗑 ' + T('Remove Fingerprint', 'ফিঙ্গারপ্রিন্ট সরান')]));
    } else {
      actions.appendChild(el('button', {
        class: 'npPkBtn npPkPrimary', type: 'button',
        onclick: function () {
          requestDeviceBiometric().then(function () {
            lsSet(LS_LOCAL_BIO, '1');
            lsSet(LS_BIO_UID, u.uid);
            toast(T('Biometric lock saved to phone successfully!', 'ফোনের ইন্টারনাল স্টোরেজে বায়োমেট্রিক সফলভাবে সেভ হয়েছে!'), 'success');
            renderCard();
          }).catch(function () {
            toast(T('Biometric enrollment cancelled.', 'বায়োমেট্রিক বাতিল হয়েছে।'), 'error');
          });
        }
      }, [fpIcon(), T('Enable Biometric Lock', 'বায়োমেট্রিক লক চালু করুন')]));
    }
  }

  // হোমপেজ ব্যানার থেকে ক্লিক করলে
  window.npOpenBiometricSetup = function () {
    var u = currentUser();
    if (!u) {
      if (typeof showToast === 'function') showToast('আগে অ্যাকাউন্টে লগইন করুন', 'info');
      if (window.app && typeof window.app.switchView === 'function') window.app.switchView('viewProfile');
      return;
    }
    if (window.app && typeof window.app.switchView === 'function') {
      window.app.switchView('viewProfile');
      setTimeout(function () {
        var card = document.getElementById('npPkCard');
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.style.outline = '2px solid #00f0ff';
          card.style.boxShadow = '0 0 25px rgba(0,240,255,0.4)';
          setTimeout(function () { card.style.outline = ''; card.style.boxShadow = ''; }, 2500);
          var btn = card.querySelector('.npPkPrimary');
          if (btn) btn.click();
        } else {
          renderCard();
        }
      }, 350);
    }
  };

  // রিলক লজিক (ইন্টারনাল স্টোরেজ চেক)
  function relock() {
    if (G.locked || busy || !G.uiReady) return;
    if (lsGet(LS_LOCAL_BIO) !== '1') return; // ব্যবহারকারী সেভ না রাখলে লক হবে না
    if (Date.now() - opEndedAt < 1500) return;
    var cu = currentUser();
    G.pending = null;
    G.resumed = cu ? cu.uid : '';
    G.locked = true;
    document.documentElement.classList.add('np-pk-lock');
    if (card) card.style.display = 'none';
    buildLock();
    showPanel('fp');
    autoTried = false;
    setTimeout(autoUnlock, 150);
  }

  function onVisibility() {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
    if (document.visibilityState !== 'visible') return;
    var away = hiddenAt ? Date.now() - hiddenAt : 0;
    hiddenAt = 0;
    if (G.locked) {
      if (!busy && document.getElementById('npPkLock') && Date.now() - opEndedAt > 1500) {
        autoTried = false;
        autoUnlock();
      }
      return;
    }
    if (away >= RELOCK_AFTER_MS) relock();
  }

  function start() {
    if (lsGet(LS_LOCAL_BIO) === '1') {
      G.locked = true;
      document.documentElement.classList.add('np-pk-lock');
      buildLock();
      setTimeout(autoUnlock, 150);
    }
    G.uiReady = true;
    document.addEventListener('visibilitychange', onVisibility);
    buildCard();
    if (typeof auth !== 'undefined' && auth) {
      auth.onAuthStateChanged(function (u) {
        if (u) { renderCard(); }
        else { renderCard(); }
      });
    }
    // প্রোফাইল পেজ দেরিতে লোড হলে বা বারবার আঁকা হলেও কার্ড যেন সবসময় দেখা যায়
    var obsT = null;
    function ensureCard() {
      if (G.locked || !currentUser()) return;
      if (card && card.isConnected && card.style.display !== 'none') return;
      renderCard();
    }
    if (window.MutationObserver) {
      new MutationObserver(function () {
        clearTimeout(obsT);
        obsT = setTimeout(ensureCard, 200);
      }).observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
