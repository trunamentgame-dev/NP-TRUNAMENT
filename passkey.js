/**
 * NP TOURNAMENT BD — Fingerprint (Passkey / WebAuthn) Login module
 * আলাদা মডিউল: index.html এর শেষে একটি <script src="./passkey.js"> দিয়ে লোড হয়।
 * মূল অ্যাপের সাথে সংযোগ: index.html এর <head> এর NPPasskey গেট + onAuthStateChanged এর ২টি ছোট হুক।
 *
 * সীমাবদ্ধতা: WebAuthn ব্রাউজারকে জানায় না আসলে আঙুলের ছাপ নাকি ডিভাইসের PIN/স্ক্রিন লক ব্যবহার হয়েছে।
 * তাই এখানে কোথাও "ফিঙ্গারপ্রিন্ট যাচাই হয়েছে" বলে নিশ্চিত দাবি করা হয়নি।
 * এটি অ্যাপ-লেভেল (UI) লক; Firebase সেশন/Persistence অপরিবর্তিত।
 */
(function () {
  'use strict';

  // ===== Deploy করার পর শুধু এই লাইনটি আপনার Render URL দিয়ে বদলান =====
  var API = 'https://np-passkey-server.onrender.com';
  // =====================================================================

  var G = window.NPPasskey || {
    locked: false, pending: null, resumed: '', uiReady: false,
    hold: function () { return false; }, holdLoggedOut: function () { return false; },
    resume: function () {}, release: function () {}
  };
  window.NPPasskey = G;

  var SUPPORTED = !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create && window.isSecureContext);
  var CONFIGURED = API.indexOf('REPLACE') === -1;
  var LS_ENR = 'np_pk_enrolled';   // এই ডিভাইসে কোন UID-এর Passkey আছে
  var LS_CRED = 'np_pk_cred';      // এই ডিভাইসের credential id
  var RELOCK_AFTER_MS = 1500;      // অ্যাপ থেকে বের হয়ে এতক্ষণ বা বেশি পর ফিরলে আবার ফিঙ্গারপ্রিন্ট চাইবে (০ দিলে সাথে সাথে)

  if (!SUPPORTED || !CONFIGURED) {
    // কিছু না দেখিয়ে স্বাভাবিক অ্যাপ চলবে (পাসওয়ার্ড লগইন অপরিবর্তিত)
    G.uiReady = true;
    if (G.locked) G.release();
    return;
  }

  // ---------- helpers ----------
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
  function fpIcon() {
    var s = document.createElement('span');
    s.className = 'npPkIco';
    s.innerHTML = '<svg viewBox="0 0 100 120" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path stroke-width="3" d="M50 55 C46 55 42 59 42 66 C42 75 42 85 43 95" />' +
      '<path stroke-width="3" d="M50 50 C44 50 37 56 37 66 C37 77 36 88 35 97" />' +
      '<path stroke-width="3" d="M50 45 C41 45 32 53 32 66 C32 80 30 89 28 99" />' +
      '<path stroke-width="3" d="M50 40 C38 40 27 50 27 66 C27 80 24 91 21 100" />' +
      '<path stroke-width="3" d="M50 35 C35 35 22 47 22 66 C22 79 18 90 14 100" />' +
      '<path stroke-width="3" d="M50 30 C32 30 17 44 17 66 C17 76 13 88 8 98" />' +
      '<path stroke-width="3" d="M50 25 C29 25 12 42 12 66 C12 73 9 84 3 95" />' +
      '<path stroke-width="3" d="M50 55 C54 55 58 59 58 66 C58 76 57 86 56 96" />' +
      '<path stroke-width="3" d="M50 50 C56 50 63 56 63 66 C63 78 64 89 65 98" />' +
      '<path stroke-width="3" d="M50 45 C59 45 68 53 68 66 C68 80 70 89 72 99" />' +
      '<path stroke-width="3" d="M50 40 C62 40 73 50 73 66 C73 80 76 91 79 100" />' +
      '<path stroke-width="3" d="M50 35 C65 35 78 47 78 66 C78 79 82 90 86 100" />' +
      '<path stroke-width="3" d="M50 30 C68 30 83 44 83 66 C83 76 87 88 92 98" />' +
      '<path stroke-width="3" d="M50 25 C71 25 88 42 88 66 C88 73 91 84 97 95" />' +
      '<path stroke-width="3" d="M50 20 C24 20 7 39 7 66" />' +
      '<path stroke-width="3" d="M50 20 C76 20 93 39 93 66" />' +
      '<path stroke-width="3" d="M50 15 C20 15 2 36 2 66" />' +
      '<path stroke-width="3" d="M50 15 C80 15 98 36 98 66" />' +
      '</svg>';
    return s;
  }

  function b64uToBuf(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var b = atob(s), a = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
    return a.buffer;
  }
  function bufToB64u(buf) {
    var a = new Uint8Array(buf), s = '';
    for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function descs(list) {
    return (list || []).map(function (c) {
      var d = { type: 'public-key', id: b64uToBuf(c.id) };
      if (c.transports) d.transports = c.transports;
      return d;
    });
  }
  function toCreate(o) {
    return {
      rp: o.rp,
      user: { id: b64uToBuf(o.user.id), name: o.user.name, displayName: o.user.displayName },
      challenge: b64uToBuf(o.challenge),
      pubKeyCredParams: o.pubKeyCredParams,
      timeout: o.timeout,
      attestation: o.attestation,
      excludeCredentials: descs(o.excludeCredentials),
      authenticatorSelection: o.authenticatorSelection
    };
  }
  function toGet(o) {
    var out = {
      challenge: b64uToBuf(o.challenge),
      rpId: o.rpId,
      timeout: o.timeout,
      userVerification: o.userVerification,
      allowCredentials: descs(o.allowCredentials)
    };
    // এই ডিভাইসের credential id জানা থাকলে সেটাই দিই: তাহলে অ্যাকাউন্ট বেছে নেওয়ার ধাপ বাদ যায়,
    // সরাসরি ফিঙ্গারপ্রিন্ট চায়। সার্ভার যাচাই এতে বদলায় না (সার্ভার credential id থেকেই UID খোঁজে)।
    var lc = lsGet(LS_CRED);
    if (lc && !out.allowCredentials.length) {
      try { out.allowCredentials = [{ type: 'public-key', id: b64uToBuf(lc), transports: ['internal'] }]; } catch (e) {}
    }
    return out;
  }
  function createResult(c) {
    var r = c.response;
    return {
      id: c.id, rawId: bufToB64u(c.rawId), type: c.type,
      response: {
        clientDataJSON: bufToB64u(r.clientDataJSON),
        attestationObject: bufToB64u(r.attestationObject),
        transports: (r.getTransports ? r.getTransports() : [])
      },
      clientExtensionResults: (c.getClientExtensionResults ? c.getClientExtensionResults() : {}),
      authenticatorAttachment: c.authenticatorAttachment || undefined
    };
  }
  function getResult(c) {
    var r = c.response;
    return {
      id: c.id, rawId: bufToB64u(c.rawId), type: c.type,
      response: {
        clientDataJSON: bufToB64u(r.clientDataJSON),
        authenticatorData: bufToB64u(r.authenticatorData),
        signature: bufToB64u(r.signature),
        userHandle: r.userHandle ? bufToB64u(r.userHandle) : undefined
      },
      clientExtensionResults: (c.getClientExtensionResults ? c.getClientExtensionResults() : {}),
      authenticatorAttachment: c.authenticatorAttachment || undefined
    };
  }

  function api(path, body, token, method) {
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var tm = ctl ? setTimeout(function () { try { ctl.abort(); } catch (e) {} }, 40000) : null;
    return fetch(API + path, {
      method: method || 'POST', headers: headers, cache: 'no-store',
      signal: ctl ? ctl.signal : undefined,
      body: (method === 'GET') ? undefined : JSON.stringify(body || {})
    }).then(function (r) {
      if (tm) clearTimeout(tm);
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.error || ('HTTP ' + r.status)); e.status = r.status; throw e; }
        return j;
      });
    }, function (e) { if (tm) clearTimeout(tm); throw e; });
  }
  function warmUp() { try { fetch(API + '/health', { mode: 'no-cors', cache: 'no-store' }).catch(function () {}); } catch (e) {} }

  function cancelErr() { var e = new Error('cancelled'); e.name = 'NotAllowedError'; return e; }
  function errText(e) {
    var n = e && e.name, m = e && e.message;
    if (n === 'NotAllowedError' || n === 'AbortError') return T('Cancelled or timed out. Please try again.', 'বাতিল হয়েছে বা সময় শেষ। আবার চেষ্টা করুন।');
    if (n === 'InvalidStateError') return T('This device is already registered.', 'এই ডিভাইস আগেই নিবন্ধিত।');
    if (n === 'NotSupportedError' || n === 'SecurityError') return T('This browser or device does not support fingerprint login.', 'এই ব্রাউজার বা ডিভাইসে ফিঙ্গারপ্রিন্ট লগইন সাপোর্ট করে না।');
    if (e && e.status === 429) return T('Too many attempts. Please wait a few minutes.', 'অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ অপেক্ষা করুন।');
    if (e && e.status === 401 && m === 'Passkey verification failed') return T('Fingerprint verification failed. Use your password instead.', 'ফিঙ্গারপ্রিন্ট যাচাই হয়নি। পাসওয়ার্ড ব্যবহার করুন।');
    if (e && e.status === 403 && m === 'REAUTH_REQUIRED') return T('Please confirm your password and try again.', 'পাসওয়ার্ড নিশ্চিত করে আবার চেষ্টা করুন।');
    if (e && e.status && m) return m;
    if (e && /Failed to fetch|NetworkError|Load failed/i.test(m || '')) return T('Cannot reach the server. Check your internet and try again.', 'সার্ভারে পৌঁছানো যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।');
    return T('Something went wrong. Please try again.', 'কিছু ভুল হয়েছে। আবার চেষ্টা করুন।');
  }
  function authErrText(e) {
    var c = e && e.code;
    if (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found') return T('Wrong username/email or password.', 'ইউজারনেম/ইমেইল বা পাসওয়ার্ড ভুল।');
    if (c === 'auth/too-many-requests') return T('Too many attempts. Please wait and try again.', 'অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।');
    if (c === 'auth/network-request-failed') return T('No internet connection.', 'ইন্টারনেট সংযোগ নেই।');
    return (e && e.message) ? e.message : T('Login failed.', 'লগইন ব্যর্থ হয়েছে।');
  }
  function deviceLabel() {
    var ua = navigator.userAgent || '';
    var os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : 'Device';
    var br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    return os + ' ' + br;
  }
  function platformOK() {
    try {
      return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }
  function fmtDate(ms) {
    if (!ms) return '—';
    try { return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return '—'; }
  }

  // ---------- styles (Cyber-Bio scanner & active laser touch) ----------
  var css = '' +
    '#npPkLock{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-start;justify-content:center;padding:12vh 20px 20px;' +
    'background:radial-gradient(circle at 50% 30%,#151d33 0%,#040711 75%);color:#f8fafc;font-family:var(--font-bengali,sans-serif);overflow:auto}' +
    '.npPkBox{width:100%;max-width:360px;text-align:center;display:flex;flex-direction:column;align-items:center}' +
    '.npPkLogo{width:76px;height:76px;border-radius:18px;box-shadow:0 8px 24px rgba(245,158,11,.22);margin-bottom:8px}' +
    '.npPkTitle{font-family:var(--font-esports,sans-serif);font-size:19px;font-weight:700;letter-spacing:1.5px;margin:10px 0 2px;color:#00f0ff;text-transform:uppercase}' +
    '.npPkSub{font-size:12px;color:#64748b;letter-spacing:2px;margin-bottom:24px;text-transform:uppercase}' +
    '.npPkBtn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:14px 16px;border-radius:14px;border:1px solid rgba(245,158,11,.35);' +
    'background:transparent;color:#f8fafc;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit}' +
    '.npPkBtn:disabled{opacity:.6;cursor:default}' +
    '.npPkPrimary{background:linear-gradient(135deg,#f59e0b,#d97706);border-color:transparent;color:#0f172a;box-shadow:0 6px 18px rgba(245,158,11,.3)}' +
    '.npPkLink{background:none;border:none;color:#94a3b8;font-size:14px;margin-top:20px;cursor:pointer;text-decoration:underline;font-family:inherit;transition:color .2s}' +
    '.npPkLink:hover{color:#f8fafc}' +
    '.npPkIco{display:inline-flex;width:68px;height:84px;color:#00f0ff;transition:all .2s ease}.npPkIco svg{width:100%;height:100%}' +
    '.npPkMsg{min-height:20px;margin:12px 0 0;font-size:13px;color:#fca5a5}' +
    '.npPkField{width:100%;box-sizing:border-box;padding:13px 14px;margin-bottom:10px;border-radius:12px;border:1px solid #1e293b;background:#0a0f1a;color:#f8fafc;font-size:15px;font-family:inherit}' +
    '.npPkField:focus{outline:none;border-color:#00f0ff}' +
    '#npPkOverlay,#npPkPwOverlay{position:fixed;inset:0;z-index:2147482000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(3,6,12,.78)}' +
    '.npPkModal{width:100%;max-width:340px;background:var(--bg-card,#141b2d);color:var(--text-primary,#f8fafc);border:1px solid rgba(0,240,255,.3);border-radius:20px;padding:24px 20px;text-align:center}' +
    '.npPkModal h3{margin:10px 0 8px;font-size:18px;color:#00f0ff}' +
    '.npPkModal p{margin:0 0 16px;font-size:13.5px;line-height:1.55;color:#94a3b8}' +
    '.npPkBigIco{display:inline-flex;width:56px;height:70px;color:#00f0ff}.npPkBigIco svg{width:100%;height:100%}' +
    '.npPkCard{background:var(--bg-card,#141b2d);border:1px solid var(--border-subtle,#1e293b);border-radius:14px;padding:16px;margin-bottom:16px;color:var(--text-primary,#f8fafc)}' +
    '.npPkCardHead{display:flex;align-items:center;gap:10px;font-weight:700;font-size:15px;margin-bottom:6px}' +
    '.npPkCardHead .npPkIco{width:22px;height:26px;color:#00f0ff}' +
    '.npPkCardNote{font-size:12.5px;color:#94a3b8;line-height:1.5;margin-bottom:12px}' +
    '.npPkDev{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid #1e293b}' +
    '.npPkDevName{font-size:14px;font-weight:600}.npPkDevMeta{font-size:11.5px;color:#64748b;margin-top:2px}' +
    '.npPkSmall{padding:8px 12px;width:auto;font-size:12.5px;border-radius:10px;border-color:#ef4444;color:#ef4444;white-space:nowrap}' +
    '.npPkCard .npPkBtn{color:#f8fafc}.npPkCard .npPkPrimary{color:#0f172a}.npPkCard .npPkBtn+.npPkBtn{margin-top:10px}' +
    
    /* স্ক্যানার বাটন ও রিয়ালিস্টিক লাইটিং এফেক্ট */
    '.npPkScannerWrap{position:relative;width:150px;height:150px;display:flex;align-items:center;justify-content:center;margin:16px auto 0}' +
    '.npPkFp{position:relative;width:140px;height:140px;border-radius:50%;border:2px solid rgba(0,240,255,.4);' +
    'background:radial-gradient(circle at 50% 50%, rgba(0,240,255,0.18) 0%, rgba(0,240,255,0.02) 65%, transparent 75%);' +
    'display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;outline:none;' +
    '-webkit-tap-highlight-color:transparent;transition:all 0.25s cubic-bezier(0.4,0,0.2,1);' +
    'box-shadow:0 0 25px rgba(0,240,255,0.25), inset 0 0 20px rgba(0,240,255,0.15)}' +
    
    /* স্পর্শ করলে বা স্ক্যান চলার সময় তীব্র জ্বলন্ত লাইটিং */
    '.npPkFp:active, .npPkFp.touching, .npPkFp.busy{' +
    'transform:scale(0.96);border-color:#00f0ff;color:#ffffff;' +
    'background:radial-gradient(circle at 50% 50%, rgba(0,240,255,0.45) 0%, rgba(0,240,255,0.12) 60%, transparent 75%);' +
    'box-shadow:0 0 45px rgba(0,240,255,0.7), inset 0 0 30px rgba(0,240,255,0.5)}' +
    '.npPkFp:active .npPkIco, .npPkFp.touching .npPkIco, .npPkFp.busy .npPkIco{' +
    'filter:drop-shadow(0 0 14px #00f0ff) drop-shadow(0 0 25px rgba(0,240,255,0.9));color:#ffffff}' +

    /* স্ক্যানিং লেজার রশ্মি ও রিং */
    '.npPkFp::before{content:"";position:absolute;inset:-8px;border-radius:50%;border:2px solid rgba(0,240,255,0.45);pointer-events:none;animation:npPkRing 2s ease-out infinite}' +
    '.npPkFp::after{content:"";position:absolute;left:0;right:0;height:4px;background:linear-gradient(90deg, transparent, #00f0ff 50%, transparent);' +
    'box-shadow:0 0 14px #00f0ff, 0 0 24px #00f0ff;pointer-events:none;animation:npPkLaser 2.2s ease-in-out infinite}' +
    
    '.npPkFp.busy::after{animation-duration:1s;box-shadow:0 0 20px #00f0ff, 0 0 35px #00f0ff}' +
    '.npPkFp.ok{border-color:#22c55e;background:radial-gradient(circle, rgba(34,197,94,0.3) 0%, transparent 70%);box-shadow:0 0 40px rgba(34,197,94,0.75)}' +
    '.npPkFp.ok .npPkIco{color:#22c55e;filter:drop-shadow(0 0 16px rgba(34,197,94,0.9))}' +
    '.npPkFp.ok::before, .npPkFp.ok::after{animation:none;display:none}' +

    '@keyframes npPkLaser{0%{top:15%;opacity:0.2}50%{top:80%;opacity:1}100%{top:15%;opacity:0.2}}' +
    '@keyframes npPkRing{0%{transform:scale(0.92);opacity:0.9}100%{transform:scale(1.24);opacity:0}}' +
    '.npPkSpin{display:inline-block;width:14px;height:14px;border-radius:50%;border:2px solid rgba(15,23,42,.3);border-top-color:#0f172a;animation:npPkSpinA .7s linear infinite;margin-right:8px;vertical-align:-2px}' +
    '@keyframes npPkSpinA{to{transform:rotate(360deg)}}' +
    '.npPkTiny{font-size:12.5px;color:#fca5a5;min-height:18px;margin-top:14px}';
  var st = document.createElement('style');
  st.id = 'npPkStyle';
  st.textContent = css;
  document.head.appendChild(st);

  // ---------- lock screen ----------
  var busy = false, inEnroll = false, opEndedAt = 0, hiddenAt = 0;
  function setMsg(t, ok) {
    var m = document.getElementById('npPkLockMsg');
    if (m) { m.textContent = t || ''; m.style.color = ok === 'n' ? '#94a3b8' : (ok ? '#86efac' : ''); }
  }
  // পাসওয়ার্ড রিসেট: বিদ্যমান handleForgotPassword এর মতোই একই Firebase ফাংশন; লক স্ক্রিনে টোস্ট লুকানো থাকে বলে বার্তা এখানেই দেখাই
  function onForgot() {
    var email = prompt(T('Enter your registered email:', 'আপনার নিবন্ধিত ইমেইল লিখুন:'));
    if (!email) return;
    if (typeof auth === 'undefined' || !auth) return;
    auth.sendPasswordResetEmail(email.trim()).then(function () {
      setMsg(T('Password reset link sent to your email.', 'পাসওয়ার্ড রিসেট লিংক আপনার ইমেইলে পাঠানো হয়েছে।'), true);
    }).catch(function (e) { setMsg(authErrText(e)); });
  }
  function setBusy(b) {
    busy = b;
    var btn = document.getElementById('npPkUnlockBtn');
    if (btn) { btn.disabled = b; btn.classList.toggle('busy', !!b); }
  }
  function removeLock() { var n = document.getElementById('npPkLock'); if (n && n.parentNode) n.parentNode.removeChild(n); }
  function unlockDone() {
    var b = document.getElementById('npPkUnlockBtn');
    if (b && b.offsetParent) {
      b.classList.remove('busy', 'touching'); b.classList.add('ok');
      setTimeout(function () { removeLock(); G.release(); }, 200);
    } else { removeLock(); G.release(); }
  }

  function showPanel(which) {
    var a = document.getElementById('npPkPanelFp'), b = document.getElementById('npPkPanelPw');
    if (a) a.style.display = which === 'fp' ? '' : 'none';
    if (b) b.style.display = which === 'pw' ? '' : 'none';
    setMsg('');
    if (which === 'pw') { var u = document.getElementById('npPkUser'); if (u) u.focus(); }
  }

  // সার্ভার থেকে চ্যালেঞ্জ আগেই এনে রাখি, যাতে ফিঙ্গারপ্রিন্ট সাথে সাথে চায় (Render ধীর হলেও দেরি হয় না)
  var pre = null;
  function prefetchOpts() {
    if (pre && Date.now() - pre.t < 90000) return pre.p;
    var p = api('/api/passkey/login/options', {});
    pre = { p: p, t: Date.now() };
    p.catch(function () { if (pre && pre.p === p) pre = null; });
    return p;
  }
  function takeOpts() {
    var cur = (pre && Date.now() - pre.t < 90000) ? pre.p : null;
    pre = null;
    if (!cur) return api('/api/passkey/login/options', {});
    return cur.catch(function () { return api('/api/passkey/login/options', {}); });
  }

  function onUnlockClick(ev) {
    var auto = (ev === 'auto');
    if (busy) return;
    var gb = document.getElementById('npPkUnlockBtn');
    if (gb) gb.classList.add('touching');
    setMsg(''); setBusy(true);
    takeOpts().then(function (r) {
      return navigator.credentials.get({ publicKey: toGet(r.options) }).then(function (cred) {
        if (!cred) throw cancelErr();
        // আঙুল দেওয়ার সাথে সাথে সবুজ
        var gb = document.getElementById('npPkUnlockBtn');
        if (gb) { gb.classList.remove('busy'); gb.classList.add('ok'); }
        if (cred.id) lsSet(LS_CRED, cred.id);   // পরের বার সরাসরি ফিঙ্গারপ্রিন্ট (Continue/অ্যাকাউন্ট বাছাই ছাড়া)
        return api('/api/passkey/login/verify', { sid: r.sid, response: getResult(cred) });
      });
    }).then(function (r) {
      var cu = (typeof auth !== 'undefined' && auth) ? auth.currentUser : null;
      var p = (cu && cu.uid === r.uid) ? Promise.resolve() : auth.signInWithCustomToken(r.token);
      return p.then(function () { lsSet(LS_ENR, r.uid); unlockDone(); });
    }).catch(function (e) {
      var gb = document.getElementById('npPkUnlockBtn'); if (gb) gb.classList.remove('ok', 'touching');
      // অটো-চালুর সময় ব্রাউজার আটকালে বা বাতিল হলে ভয় না দেখিয়ে বাটন চাপতে বলি
      if (auto && e && (e.name === 'NotAllowedError' || e.name === 'AbortError')) {
        setMsg(T('Tap the fingerprint', 'ফিঙ্গারপ্রিন্টে চাপ দিন'), 'n');
      } else { setMsg(errText(e)); }
    }).then(function () { setBusy(false); opEndedAt = Date.now(); if (G.locked) { try { prefetchOpts(); } catch (e) {} } });
  }

  // অ্যাপ খুললেই নিজে থেকে ফিঙ্গারপ্রিন্ট চায় (একবারই); ব্রাউজার না দিলে বাটন থাকে
  var autoTried = false;
  function autoUnlock() {
    if (autoTried || !G.locked || !document.getElementById('npPkLock')) return;
    if (document.visibilityState && document.visibilityState !== 'visible') {
      document.addEventListener('visibilitychange', function once() {
        if (document.visibilityState === 'visible') { document.removeEventListener('visibilitychange', once); autoUnlock(); }
      });
      return;
    }
    autoTried = true;
    onUnlockClick('auto');
  }

  function onPwSubmit() {
    if (busy) return;
    var u = (document.getElementById('npPkUser').value || '').trim();
    var p = document.getElementById('npPkPass').value || '';
    if (!u || !p) { setMsg(T('Enter username/email and password.', 'ইউজারনেম/ইমেইল ও পাসওয়ার্ড দিন।')); return; }
    if (typeof npSmartSignIn !== 'function') { setMsg(T('Login is not ready. Reload the page.', 'লগইন প্রস্তুত নয়। পেজ রিলোড করুন।')); return; }
    setMsg(''); setBusy(true);
    var pb = document.getElementById('npPkPwBtn'); if (pb) pb.disabled = true;
    npSmartSignIn(u, p).then(function () { unlockDone(); })
      .catch(function (e) { setMsg(authErrText(e)); })
      .then(function () { setBusy(false); if (pb) pb.disabled = false; });
  }

  function buildLock() {
    if (document.getElementById('npPkLock')) return;
    var unlockBtn = el('button', {
      id: 'npPkUnlockBtn', class: 'npPkFp', type: 'button', 'aria-label': 'Unlock with Fingerprint',
      onclick: onUnlockClick
    }, [fpIcon()]);

    unlockBtn.addEventListener('touchstart', function () { unlockBtn.classList.add('touching'); }, { passive: true });
    unlockBtn.addEventListener('touchend', function () { setTimeout(function () { unlockBtn.classList.remove('touching'); }, 400); });

    var panelFp = el('div', { id: 'npPkPanelFp' }, [
      el('div', { class: 'npPkScannerWrap' }, [unlockBtn]),
      el('div', null, [
        el('button', { class: 'npPkLink', type: 'button', onclick: function () { showPanel('pw'); } }, [
          T('Use password', 'পাসওয়ার্ড দিয়ে খুলুন')
        ])
      ])
    ]);
    var userIn = el('input', { id: 'npPkUser', class: 'npPkField', type: 'text', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false',
      placeholder: T('Username or email', 'ইউজারনেম অথবা ইমেইল') });
    var passIn = el('input', { id: 'npPkPass', class: 'npPkField', type: 'password', autocomplete: 'current-password',
      placeholder: T('Password', 'পাসওয়ার্ড'),
      onkeydown: function (ev) { if (ev.key === 'Enter') onPwSubmit(); } });
    var panelPw = el('div', { id: 'npPkPanelPw', style: 'display:none;margin-top:22px' }, [
      userIn, passIn,
      el('button', { id: 'npPkPwBtn', class: 'npPkBtn npPkPrimary', type: 'button', onclick: onPwSubmit }, [T('Unlock', 'আনলক')]),
      el('button', { class: 'npPkLink', type: 'button', onclick: onForgot }, [T('Forgot password?', 'পাসওয়ার্ড ভুলে গেছেন?')]),
      el('div', null, [
        el('button', { class: 'npPkLink', type: 'button', onclick: function () { showPanel('fp'); } }, [T('Back', 'ফিরে যান')])
      ])
    ]);
    var box = el('div', { class: 'npPkBox' }, [
      el('img', { class: 'npPkLogo', src: './icon-192.png', alt: '' }),
      el('div', { class: 'npPkTitle' }, ['NP TOURNAMENT']),
      el('div', { class: 'npPkSub' }, ['SECURITY AUTHENTICATION']),
      panelFp, panelPw,
      el('div', { id: 'npPkLockMsg', class: 'npPkTiny', role: 'alert' })
    ]);
    document.body.appendChild(el('div', { id: 'npPkLock', role: 'dialog', 'aria-modal': 'true' }, [box]));
  }

  // ---------- password confirm dialog (for sensitive actions) ----------
  function askPassword() {
    return new Promise(function (resolve) {
      var input = el('input', { class: 'npPkField', type: 'password', autocomplete: 'current-password', placeholder: T('Password', 'পাসওয়ার্ড') });
      var msg = el('div', { class: 'npPkMsg' });
      var ov;
      function close(v) { if (ov && ov.parentNode) ov.parentNode.removeChild(ov); resolve(v); }
      function ok() { if (!input.value) { msg.textContent = T('Enter your password.', 'পাসওয়ার্ড দিন।'); return; } close(input.value); }
      input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') ok(); });
      ov = el('div', { id: 'npPkPwOverlay' }, [
        el('div', { class: 'npPkModal' }, [
          el('h3', null, [T('Confirm your password', 'পাসওয়ার্ড নিশ্চিত করুন')]),
          el('p', null, [T('For your security, please enter your password to continue.', 'নিরাপত্তার জন্য চালিয়ে যেতে আপনার পাসওয়ার্ড দিন।')]),
          input, msg,
          el('button', { class: 'npPkBtn npPkPrimary', type: 'button', onclick: ok }, [T('Confirm', 'নিশ্চিত করুন')]),
          el('button', { class: 'npPkBtn', type: 'button', onclick: function () { close(null); } }, [T('Cancel', 'বাতিল')])
        ])
      ]);
      document.body.appendChild(ov);
      setTimeout(function () { input.focus(); }, 50);
    });
  }

  function jwtPayload(t) {
    try {
      var p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      while (p.length % 4) p += '=';
      return JSON.parse(decodeURIComponent(escape(atob(p))));
    } catch (e) { return {}; }
  }
  // সাম্প্রতিক পাসওয়ার্ড লগইন না থাকলে Firebase reauthentication
  function freshToken(user) {
    return user.getIdToken().then(function (t) {
      var p = jwtPayload(t);
      var age = Math.floor(Date.now() / 1000) - (p.auth_time || 0);
      var prov = p.firebase && p.firebase.sign_in_provider;
      if (age >= 0 && age <= 240 && prov === 'password') return t;
      if (!user.email) throw new Error(T('This account cannot confirm a password.', 'এই অ্যাকাউন্টে পাসওয়ার্ড নিশ্চিত করা যায় না।'));
      return askPassword().then(function (pw) {
        if (!pw) throw cancelErr();
        var cred = firebase.auth.EmailAuthProvider.credential(user.email, pw);
        return user.reauthenticateWithCredential(cred).then(function () { return user.getIdToken(true); });
      });
    });
  }

  // ---------- enrollment ----------
  function setEnrolled(uid, credId) { lsSet(LS_ENR, uid); if (credId) lsSet(LS_CRED, credId); }
  function clearEnrolled() { lsDel(LS_ENR); lsDel(LS_CRED); }

  function enroll() {
    inEnroll = true;
    return enrollInner().then(function (r) { inEnroll = false; opEndedAt = Date.now(); return r; },
      function (e) { inEnroll = false; opEndedAt = Date.now(); throw e; });
  }
  function enrollInner() {
    var user = (typeof auth !== 'undefined' && auth) ? auth.currentUser : null;
    if (!user) return Promise.reject(new Error(T('Please login first.', 'আগে লগইন করুন।')));
    return freshToken(user).then(function (tok) {
      return api('/api/passkey/register/options', {}, tok);
    }).then(function (r) {
      return navigator.credentials.create({ publicKey: toCreate(r.options) });
    }).then(function (cred) {
      if (!cred) throw cancelErr();
      // আঙুল দেওয়ার সাথে সাথেই এই ডিভাইসে সেভ; সার্ভারে নিবন্ধন পেছনে চলে (UI আটকে থাকে না)
      setEnrolled(user.uid, cred.id);
      var payload = createResult(cred), label = deviceLabel();
      function send(n) {
        return user.getIdToken().then(function (t2) {
          return api('/api/passkey/register/verify', { response: payload, label: label }, t2);
        }).catch(function (e) {
          // নেটওয়ার্ক/টাইমআউট হলে একবার আবার চেষ্টা (সার্ভার চ্যালেঞ্জ আগেই খরচ হলে retry কাজ করবে না, তখন নিচে বাতিল হবে)
          if (n < 1 && e && !e.status) return send(n + 1);
          throw e;
        });
      }
      send(0).then(function () {
        refreshCard(true);
      }).catch(function (e) {
        if (lsGet(LS_CRED) === cred.id) clearEnrolled();
        toast(errText(e), 'error');
        refreshCard(true);
      });
      return { ok: true };
    });
  }

  // ---------- setup popup ----------
  var offered = false;
  function hideSetup() { var n = document.getElementById('npPkOverlay'); if (n && n.parentNode) n.parentNode.removeChild(n); }
  function showSetup(user) {
    if (document.getElementById('npPkOverlay')) return;
    warmUp();
    var msg = el('div', { class: 'npPkMsg', role: 'alert' });
    var enableBtn, laterBtn;
    function later() { lsSet('np_pk_later_' + user.uid, '1'); hideSetup(); toast(T('You can enable it later from Profile > Security.', 'পরে প্রোফাইল > সিকিউরিটি থেকে চালু করতে পারবেন।'), 'info'); }
    function enable() {
      enableBtn.disabled = true; laterBtn.disabled = true; msg.textContent = '';
      enableBtn.textContent = ''; enableBtn.appendChild(el('span', { class: 'npPkSpin' })); enableBtn.appendChild(document.createTextNode(T('Enabling…', 'চালু হচ্ছে…')));
      enroll().then(function () {
        hideSetup();
        toast(T('Fingerprint login enabled on this device.', 'এই ডিভাইসে ফিঙ্গারপ্রিন্ট লগইন চালু হয়েছে।'), 'success');
        refreshCard(true);
      }).catch(function (e) {
        if (e && e.name === 'InvalidStateError') { setEnrolled(user.uid, null); hideSetup(); refreshCard(true); return; }
        msg.textContent = (e && e.message === 'cancelled') ? errText(e) : errText(e);
        enableBtn.disabled = false; laterBtn.disabled = false; enableBtn.textContent = T('Enable', 'চালু করুন');
      });
    }
    enableBtn = el('button', { class: 'npPkBtn npPkPrimary', type: 'button', onclick: enable }, [T('Enable', 'চালু করুন')]);
    laterBtn = el('button', { class: 'npPkBtn', type: 'button', onclick: later }, [T('Maybe Later', 'পরে')]);
    var ov = el('div', { id: 'npPkOverlay', role: 'dialog', 'aria-modal': 'true' }, [
      el('div', { class: 'npPkModal' }, [
        el('span', { class: 'npPkBigIco' }, [fpIcon()]),
        el('h3', null, [T('Enable fingerprint?', 'ফিঙ্গারপ্রিন্ট চালু করবেন?')]),
        enableBtn, laterBtn, msg
      ])
    ]);
    document.body.appendChild(ov);
  }
  function waitFree(cb, n) {
    n = n || 0;
    if (document.querySelector('[id^="modal"].active') && n < 24) { setTimeout(function () { waitFree(cb, n + 1); }, 1500); return; }
    cb();
  }
  // Google দিয়ে ঢোকা (পাসওয়ার্ডবিহীন) অ্যাকাউন্টে এখানে ফিঙ্গারপ্রিন্ট সেটআপ চালু নেই — সেটআপে পাসওয়ার্ড নিশ্চিতকরণ লাগে
  function googleOnly(u) {
    try { return !!(u && u.providerData && u.providerData.length && !u.providerData.some(function (p) { return p && p.providerId === 'password'; })); } catch (e) { return false; }
  }
  function maybeOffer(u) {
    // স্বয়ংক্রিয় পপআপ বন্ধ রাখা হয়েছে - ব্যবহারকারী হোমপেজ ব্যানার থেকে যুক্ত করতে পারবেন
    return;
  }

  // হোম ব্যানার থেকে সরাসরি ফিঙ্গারপ্রিন্ট যোগ করার গ্লোবাল হেল্পার
  window.npOpenBiometricSetup = function () {
    var u = currentUser();
    if (!u) {
      if (typeof showToast === 'function') showToast(T('Please login first', 'আগে লগইন করুন'), 'info');
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
          onEnableClick();
        }
      }, 350);
    }
  };

  // ---------- Profile > Security card ----------
  var card = null, list = null, actions = null, lastFetch = 0, supportsHere = null;

  function buildCard() {
    if (card) return;
    var btn = document.querySelector('button[onclick="window.app.handleLogout()"]');
    if (!btn || !btn.parentNode) return;
    list = el('div', { id: 'npPkList' });
    actions = el('div', { id: 'npPkActions' });
    card = el('div', { id: 'npPkCard', class: 'npPkCard', style: 'display:none' }, [
      el('div', { class: 'npPkCardHead' }, [fpIcon(), T('Fingerprint Login', 'ফিঙ্গারপ্রিন্ট লগইন')]),
      el('div', { class: 'npPkCardNote' }, [T('Fingerprint or screen lock. Password always works.', 'ফিঙ্গারপ্রিন্ট বা স্ক্রিন লক। পাসওয়ার্ড সবসময় চলবে।')]),
      list, actions
    ]);
    btn.parentNode.insertBefore(card, btn);
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (en) {
        if (en[0] && en[0].isIntersecting && Date.now() - lastFetch > 30000) refreshCard(false);
      }).observe(card);
    }
  }

  function currentUser() { return (typeof auth !== 'undefined' && auth) ? auth.currentUser : null; }

  function renderCard(devices, failed) {
    buildCard();
    if (!card) return;
    var u = currentUser();
    if (!u || G.locked || googleOnly(u)) { card.style.display = 'none'; return; }
    card.style.display = '';
    while (list.firstChild) list.removeChild(list.firstChild);
    while (actions.firstChild) actions.removeChild(actions.firstChild);

    if (supportsHere === false) {
      list.appendChild(el('div', { class: 'npPkCardNote' }, [T(
        'This browser or device does not support fingerprint login.', 'এই ব্রাউজার বা ডিভাইসে ফিঙ্গারপ্রিন্ট লগইন সাপোর্ট করে না।')]));
      return;
    }
    if (failed || !devices) {
      list.appendChild(el('div', { class: 'npPkCardNote' }, [T('Could not load devices.', 'ডিভাইসের তালিকা আনা যায়নি।')]));
      actions.appendChild(el('button', { class: 'npPkBtn', type: 'button', onclick: function () { refreshCard(true); } }, [T('Retry', 'আবার চেষ্টা')]));
      return;
    }
    var localCred = lsGet(LS_CRED);
    devices.forEach(function (d) {
      var here = localCred && d.id === localCred;
      list.appendChild(el('div', { class: 'npPkDev' }, [
        el('div', null, [
          el('div', { class: 'npPkDevName' }, [d.deviceName + (here ? T(' (this device)', ' (এই ডিভাইস)') : '')]),
          el('div', { class: 'npPkDevMeta' }, [T('Added: ', 'যুক্ত: ') + fmtDate(d.createdAt) + ' · ' + T('Last used: ', 'শেষ ব্যবহার: ') + fmtDate(d.lastUsedAt)])
        ]),
        el('button', { class: 'npPkBtn npPkSmall', type: 'button', onclick: function () { removeDevice(d); } }, [T('Remove', 'মুছুন')])
      ]));
    });
    if (!devices.length) {
      list.appendChild(el('div', { class: 'npPkCardNote' }, [T('No device registered yet.', 'এখনো কোনো ডিভাইস নিবন্ধিত নেই।')]));
    }
    var enrolledHere = lsGet(LS_ENR) === u.uid;
    if (!enrolledHere) {
      actions.appendChild(el('button', { class: 'npPkBtn npPkPrimary', type: 'button', onclick: onEnableClick }, [fpIcon(), T('Enable Fingerprint Login', 'ফিঙ্গারপ্রিন্ট লগইন চালু করুন')]));
    }
    if (devices.length) {
      actions.appendChild(el('button', { class: 'npPkBtn', type: 'button', onclick: disableAll }, [T('Disable Fingerprint Login', 'ফিঙ্গারপ্রিন্ট লগইন বন্ধ করুন')]));
    }
  }

  function refreshCard(force) {
    var u = currentUser();
    if (!u || G.locked) { renderCard(null, false); return; }
    buildCard();
    if (supportsHere === null) {
      platformOK().then(function (ok) { supportsHere = !!ok; refreshCard(true); });
      return;
    }
    if (supportsHere === false) { renderCard([], false); return; }
    if (!force && Date.now() - lastFetch < 5000) return;
    lastFetch = Date.now();
    u.getIdToken().then(function (tok) {
      return api('/api/passkey/devices', null, tok, 'GET');
    }).then(function (r) {
      var devices = r.devices || [];
      // অন্য জায়গা থেকে মুছে ফেলা হলে এই ডিভাইসের লক-ফ্ল্যাগ সরিয়ে দিই (আটকে না যাওয়ার জন্য)
      var lc = lsGet(LS_CRED);
      if (lsGet(LS_ENR) === u.uid) {
        if (lc ? !devices.some(function (d) { return d.id === lc; }) : !devices.length) clearEnrolled();
      }
      renderCard(devices, false);
    }).catch(function () { renderCard(null, true); });
  }

  function onEnableClick() {
    var btns = actions.querySelectorAll('button'); btns.forEach(function (b) { b.disabled = true; });
    if (btns[0]) { btns[0].textContent = ''; btns[0].appendChild(el('span', { class: 'npPkSpin' })); btns[0].appendChild(document.createTextNode(T('Enabling…', 'চালু হচ্ছে…'))); }
    warmUp();
    enroll().then(function () {
      toast(T('Fingerprint login enabled on this device.', 'এই ডিভাইসে ফিঙ্গারপ্রিন্ট লগইন চালু হয়েছে।'), 'success');
    }).catch(function (e) {
      if (e && e.name === 'InvalidStateError') { var u = currentUser(); if (u) setEnrolled(u.uid, null); return; }
      toast(errText(e), 'error');
    }).then(function () { refreshCard(true); });
  }
  function removeDevice(d) {
    if (!confirm(T('Remove this device?', 'এই ডিভাইসটি মুছে ফেলবেন?'))) return;
    var u = currentUser(); if (!u) return;
    freshToken(u).then(function (tok) {
      return api('/api/passkey/remove', { credentialId: d.id }, tok);
    }).then(function () {
      if (lsGet(LS_CRED) === d.id) clearEnrolled();
      toast(T('Device removed.', 'ডিভাইস মুছে ফেলা হয়েছে।'), 'success');
    }).catch(function (e) {
      if (!(e && e.name === 'NotAllowedError' && e.message === 'cancelled')) toast(errText(e), 'error');
    }).then(function () { refreshCard(true); });
  }
  function disableAll() {
    if (!confirm(T('Disable fingerprint login and remove all devices?', 'ফিঙ্গারপ্রিন্ট লগইন বন্ধ করে সব ডিভাইস মুছে ফেলবেন?'))) return;
    var u = currentUser(); if (!u) return;
    freshToken(u).then(function (tok) {
      return api('/api/passkey/remove', { all: true }, tok);
    }).then(function () {
      clearEnrolled();
      toast(T('Fingerprint login disabled.', 'ফিঙ্গারপ্রিন্ট লগইন বন্ধ করা হয়েছে।'), 'success');
    }).catch(function (e) {
      if (!(e && e.name === 'NotAllowedError' && e.message === 'cancelled')) toast(errText(e), 'error');
    }).then(function () { refreshCard(true); });
  }

  // ---------- অ্যাপ থেকে বের হয়ে ফিরলে আবার লক ----------
  function relock() {
    if (G.locked || busy || inEnroll || !G.uiReady) return;
    if (!lsGet(LS_ENR)) return;                         // এই ডিভাইসে Passkey চালু না থাকলে লক নয়
    if (Date.now() - opEndedAt < 1500) return;          // ফিঙ্গারপ্রিন্ট শিটের নিজের ঝলকে নয়
    var cu = currentUser();
    G.pending = null;
    G.resumed = cu ? cu.uid : '';                       // আগে থেকে চালু ডাটা/লিসেনার দ্বিতীয়বার চালু হবে না
    G.locked = true;
    try { sessionStorage.removeItem('np_pk_unlocked'); } catch (e) {}
    document.documentElement.classList.add('np-pk-lock');
    hideSetup();
    var pw = document.getElementById('npPkPwOverlay'); if (pw && pw.parentNode) pw.parentNode.removeChild(pw);
    if (card) card.style.display = 'none';
    buildLock(); showPanel('fp');
    autoTried = false; try { prefetchOpts(); } catch (e) {} setTimeout(autoUnlock, 120);
  }
  function onVisibility() {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
    if (document.visibilityState !== 'visible') return;
    var away = hiddenAt ? Date.now() - hiddenAt : 0; hiddenAt = 0;
    if (G.locked) {
      if (!busy && document.getElementById('npPkLock') && Date.now() - opEndedAt > 1500) { autoTried = false; autoUnlock(); }
      return;
    }
    if (away >= RELOCK_AFTER_MS) relock();
  }

  // ---------- start ----------
  function afterLogin(u) { warmUp(); refreshCard(true); maybeOffer(u); }
  G.afterRelease = function () { var u = currentUser(); if (u) afterLogin(u); };

  function start() {
    if (G.locked) { buildLock(); warmUp(); try { prefetchOpts(); } catch (e) {} setTimeout(autoUnlock, 120); }
    G.uiReady = true;
    document.addEventListener('visibilitychange', onVisibility);
    buildCard();
    if (typeof auth !== 'undefined' && auth) {
      auth.onAuthStateChanged(function (u) {
        if (u) { if (!G.locked) afterLogin(u); }
        else { hideSetup(); offered = false; renderCard(null, false); }
      });
    }
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
