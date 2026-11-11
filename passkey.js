/**
 * NP TOURNAMENT BD — Professional Cyber Biometric Fingerprint (Passkey / WebAuthn)
 * সম্পূর্ণ প্রফেশনাল স্ক্যানার অ্যানিমেশন, সাইবার গ্রিড ও নিখুঁত পজিশন সহ
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
  var LS_ENR = 'np_pk_enrolled';
  var LS_CRED = 'np_pk_cred';
  var RELOCK_AFTER_MS = 1500;

  if (!SUPPORTED || !CONFIGURED) {
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

  // প্রফেশনাল হাই-টেক ফিঙ্গারপ্রিন্ট SVG (ফটো ২ এর অনুরূপ)
  function fpIcon() {
    var s = document.createElement('span');
    s.className = 'npPkIco';
    s.innerHTML = '<svg viewBox="0 0 100 125" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M50 8C30.5 8 16 23.2 16 43.5C16 53.8 20.2 64.2 24.5 73.2C27.2 78.8 30.1 84.1 31.8 88.5" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M84 43.5C84 33.2 79.8 22.8 75.5 13.8C72.8 8.2 69.9 2.9 68.2 -1.5" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M50 16C35.2 16 24 28.5 24 44.5C24 57.5 29.5 70 34.2 80C36.8 85.5 39 90.2 40.5 94.5" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M76 44.5C76 31.5 70.5 19 65.8 9" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M50 24C39.8 24 32 33.2 32 45.5C32 59 38.5 71 43.2 80.5" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M68 45.5C68 33.5 60.2 24 50 24" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M50 32C44.5 32 40 37.8 40 46.5C40 58.2 46 68.5 49 75.5" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M60 46.5C60 37.8 55.5 32 50 32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M50 40C47.8 40 46 42.5 46 47C46 54 49 61 50 64" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M54 47C54 42.5 52.2 40 50 40" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' +
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
    var lc = lsGet(LS_CRED);
    if (lc && (!out.allowCredentials || !out.allowCredentials.length)) {
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

  // ---------- styles (High-Tech Futuristic Biometric Design) ----------
  var css = '' +
    '#npPkLock{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-start;justify-content:center;padding:16px 20px 24px;' +
    'background:radial-gradient(ellipse at 50% 28%, #131d33 0%, #070b14 60%, #03060a 100%);color:#f8fafc;font-family:var(--font-bengali,sans-serif);overflow-y:auto;overflow-x:hidden}' +
    '.npPkBox{width:100%;max-width:360px;margin:max(30px, 6vh) auto 20px;text-align:center;display:flex;flex-direction:column;align-items:center;position:relative}' +
    '.npPkLogoWrap{position:relative;margin-bottom:12px;filter:drop-shadow(0 6px 18px rgba(0,0,0,0.6))}' +
    '.npPkLogo{width:86px;height:86px;border-radius:22px;border:1.5px solid rgba(245,158,11,0.4);object-fit:cover;display:block}' +
    '.npPkTitle{font-family:var(--font-esports,sans-serif);font-size:20px;font-weight:800;letter-spacing:1.5px;margin:0 0 2px;color:#fcd34d;text-transform:uppercase}' +
    '.npPkSub{font-size:12px;color:#94a3b8;margin-bottom:14px;letter-spacing:0.5px}' +
    
    /* সাইবার বায়োমেট্রিক স্ক্যানার ফ্রেম (ফটো ২ এর হুবহু ডিজাইন) */
    '.npCyberFrame{position:relative;width:170px;height:190px;margin:8px auto 14px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 50%, rgba(6,182,212,0.14) 0%, rgba(15,23,42,0) 70%);border-radius:18px}' +
    '.npCyberGrid{position:absolute;inset:8px;background-size:14px 14px;background-image:linear-gradient(to right, rgba(6,182,212,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(6,182,212,0.12) 1px, transparent 1px);pointer-events:none;border-radius:12px}' +
    '.npCorner{position:absolute;width:18px;height:18px;border-color:#06b6d4;border-style:solid;pointer-events:none}' +
    '.npC-tl{top:0;left:0;border-width:3px 0 0 3px;border-top-left-radius:6px}' +
    '.npC-tr{top:0;right:0;border-width:3px 3px 0 0;border-top-right-radius:6px}' +
    '.npC-bl{bottom:0;left:0;border-width:0 0 3px 3px;border-bottom-left-radius:6px}' +
    '.npC-br{bottom:0;right:0;border-width:0 3px 3px 0;border-bottom-right-radius:6px}' +
    
    /* লেজার স্ক্যানিং বিম */
    '.npLaserLine{position:absolute;left:-4px;right:-4px;height:3px;background:#38bdf8;box-shadow:0 0 12px #06b6d4, 0 0 22px #0284c7;pointer-events:none;border-radius:2px;animation:npLaserSweep 2.2s ease-in-out infinite}' +
    '.npLaserLine::before,.npLaserLine::after{content:"";position:absolute;top:-3px;width:9px;height:9px;border-radius:50%;background:#38bdf8;box-shadow:0 0 8px #38bdf8}' +
    '.npLaserLine::before{left:0}.npLaserLine::after{right:0}' +
    '@keyframes npLaserSweep{0%,100%{top:8%;opacity:0.3}50%{top:88%;opacity:1}}' +
    
    /* স্ক্যানার ইন্টারঅ্যাক্টিভ বাটন */
    '.npPkFp{position:relative;width:120px;height:120px;background:transparent;border:none;color:#06b6d4;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;-webkit-tap-highlight-color:transparent;transition:all 0.25s ease;filter:drop-shadow(0 0 12px rgba(6,182,212,0.4))}' +
    '.npPkFp .npPkIco{width:76px;height:95px;color:#22d3ee;transition:color 0.2s}' +
    '.npPkFp.busy{color:#38bdf8;animation:npScanPulse 0.9s ease-in-out infinite}' +
    '.npPkFp.busy .npLaserLine{animation-duration:1s}' +
    '.npPkFp.ok{color:#22c55e;filter:drop-shadow(0 0 22px rgba(34,197,94,0.85))}' +
    '.npPkFp.ok .npPkIco{color:#22c55e}' +
    '.npPkFp.ok .npCorner{border-color:#22c55e}' +
    '.npPkFp.ok .npLaserLine{background:#22c55e;box-shadow:0 0 16px #22c55e}' +
    '@keyframes npScanPulse{0%,100%{transform:scale(0.98)}50%{transform:scale(1.03)}}' +

    /* স্ট্যাটাস ও প্রগ্রেস বার (ফটো ২) */
    '.npScanText{font-family:var(--font-esports,sans-serif);font-size:11.5px;letter-spacing:1.8px;font-weight:700;color:#38bdf8;margin-top:2px;text-transform:uppercase}' +
    '.npScanBarWrap{width:130px;height:5px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;margin:6px auto 0;position:relative;border:1px solid rgba(6,182,212,0.2)}' +
    '.npScanBarFill{height:100%;width:60%;background:linear-gradient(90deg, #06b6d4, #38bdf8);border-radius:4px;animation:npBarMove 1.8s ease-in-out infinite}' +
    '@keyframes npBarMove{0%{width:15%;transform:translateX(0)}50%{width:85%;transform:translateX(15%)}100%{width:25%;transform:translateX(240%)}}' +

    /* টেক্সট লিংক ও ফিল্ড */
    '.npPkLink{background:none;border:none;color:#94a3b8;font-size:13.5px;margin-top:14px;cursor:pointer;text-decoration:underline;font-family:inherit;transition:color .2s}' +
    '.npPkLink:hover{color:#f59e0b}' +
    '.npPkTiny{font-size:12.5px;color:#fca5a5;min-height:18px;margin-top:10px;line-height:1.4}' +
    '.npPkField{width:100%;box-sizing:border-box;padding:12px 14px;margin-bottom:10px;border-radius:12px;border:1px solid #1e293b;background:#0a0f1a;color:#f8fafc;font-size:14.5px;font-family:inherit}' +
    '.npPkField:focus{outline:none;border-color:#f59e0b}' +
    '.npPkBtn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:12px 16px;border-radius:14px;border:1px solid rgba(245,158,11,.35);background:transparent;color:#f8fafc;font-size:14.5px;font-weight:700;cursor:pointer;font-family:inherit}' +
    '.npPkPrimary{background:linear-gradient(135deg,#f59e0b,#d97706);border-color:transparent;color:#0f172a;box-shadow:0 4px 16px rgba(245,158,11,.35)}' +
    '#npPkOverlay,#npPkPwOverlay{position:fixed;inset:0;z-index:2147482000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(3,6,12,.78)}' +
    '.npPkModal{width:100%;max-width:280px;background:var(--bg-card,#141b2d);color:var(--text-primary,#f8fafc);border:1px solid var(--border-gold,rgba(245,158,11,.3));border-radius:18px;padding:20px 18px;text-align:center}' +
    '.npPkModal h3{margin:8px 0 6px;font-size:17px;color:var(--color-primary,#f59e0b)}' +
    '.npPkModal p{margin:0 0 14px;font-size:12.5px;line-height:1.55;color:var(--text-secondary,#94a3b8)}' +
    '.npPkCard{background:var(--bg-card,#141b2d);border:1px solid var(--border-subtle,#1e293b);border-radius:var(--radius-md,14px);padding:16px;margin-bottom:16px;color:var(--text-primary,#f8fafc)}' +
    '.npPkCardHead{display:flex;align-items:center;gap:10px;font-weight:700;font-size:15px;margin-bottom:6px}' +
    '.npPkCardHead .npPkIco{width:22px;height:22px;color:var(--color-primary,#f59e0b)}' +
    '.npPkCardNote{font-size:12.5px;color:var(--text-secondary,#94a3b8);line-height:1.5;margin-bottom:12px}' +
    '.npPkDev{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid var(--border-subtle,#1e293b)}' +
    '.npPkDevName{font-size:14px;font-weight:600}.npPkDevMeta{font-size:11.5px;color:var(--text-muted,#64748b);margin-top:2px}' +
    '.npPkSmall{padding:6px 12px;width:auto;font-size:12px;border-radius:10px;border-color:var(--color-accent,#ef4444);color:var(--color-accent,#ef4444);white-space:nowrap}' +
    '.npPkCard .npPkBtn{color:var(--text-primary,#f8fafc)}.npPkCard .npPkPrimary{color:#0f172a}.npPkCard .npPkBtn+.npPkBtn{margin-top:10px}';

  var st = document.createElement('style');
  st.id = 'npPkStyle';
  st.textContent = css;
  document.head.appendChild(st);

  // ---------- lock screen logic ----------
  var busy = false, inEnroll = false, opEndedAt = 0, hiddenAt = 0;
  function setMsg(t, ok) {
    var m = document.getElementById('npPkLockMsg');
    if (m) { m.textContent = t || ''; m.style.color = ok === 'n' ? '#94a3b8' : (ok ? '#86efac' : ''); }
  }
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
      b.classList.remove('busy'); b.classList.add('ok');
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

  var pre = null;
  function prefetchOpts() {
    if (pre && Date.now() - pre.t < 45000) return pre.p;
    var p = api('/api/passkey/login/options', {});
    pre = { p: p, t: Date.now() };
    p.catch(function () { if (pre && pre.p === p) pre = null; });
    return p;
  }
  function takeOpts() {
    var cur = (pre && Date.now() - pre.t < 45000) ? pre.p : null;
    pre = null;
    if (!cur) return api('/api/passkey/login/options', {});
    return cur.catch(function () { return api('/api/passkey/login/options', {}); });
  }

  function onUnlockClick(ev) {
    var auto = (ev === 'auto');
    if (busy) return;
    setMsg(''); setBusy(true);
    takeOpts().then(function (r) {
      return navigator.credentials.get({ publicKey: toGet(r.options) }).then(function (cred) {
        if (!cred) throw cancelErr();
        var gb = document.getElementById('npPkUnlockBtn');
        if (gb) { gb.classList.remove('busy'); gb.classList.add('ok'); }
        if (cred.id) lsSet(LS_CRED, cred.id);
        return api('/api/passkey/login/verify', { sid: r.sid, response: getResult(cred) });
      });
    }).then(function (r) {
      var cu = (typeof auth !== 'undefined' && auth) ? auth.currentUser : null;
      var p = (cu && cu.uid === r.uid) ? Promise.resolve() : auth.signInWithCustomToken(r.token);
      return p.then(function () { lsSet(LS_ENR, r.uid); unlockDone(); });
    }).catch(function (e) {
      var gb = document.getElementById('npPkUnlockBtn'); 
      if (gb) { gb.classList.remove('ok'); gb.classList.remove('busy'); }
      if (e && e.status === 401) {
        lsDel(LS_CRED);
      }
      if (auto && e && (e.name === 'NotAllowedError' || e.name === 'AbortError')) {
        setMsg(T('Tap the fingerprint scanner', 'ফিঙ্গারপ্রিন্ট স্ক্যানারে চাপ দিন'), 'n');
      } else { 
        setMsg(errText(e)); 
      }
    }).then(function () { 
      setBusy(false); 
      opEndedAt = Date.now(); 
      if (G.locked) { try { prefetchOpts(); } catch (e) {} } 
    });
  }

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

  // স্ক্রিনের উপরের দিকে প্রফেশনাল সাইবার-স্ক্যানার UI বিল্ড করা
  function buildLock() {
    if (document.getElementById('npPkLock')) return;

    // স্ক্যানার কন্টেইনার উইথ সাইবার ব্র্যাকেটস ও লেজার (ফটো ২)
    var cyberFrame = el('div', { class: 'npCyberFrame' }, [
      el('div', { class: 'npCyberGrid' }),
      el('span', { class: 'npCorner npC-tl' }),
      el('span', { class: 'npCorner npC-tr' }),
      el('span', { class: 'npCorner npC-bl' }),
      el('span', { class: 'npCorner npC-br' }),
      el('span', { class: 'npLaserLine' }),
      el('button', { id: 'npPkUnlockBtn', class: 'npPkFp', type: 'button', 'aria-label': 'Unlock with Fingerprint', onclick: onUnlockClick }, [fpIcon()])
    ]);

    var panelFp = el('div', { id: 'npPkPanelFp', style: 'width:100%' }, [
      cyberFrame,
      el('div', { class: 'npScanText' }, ['BIOMETRIC SCANNING...']),
      el('div', { class: 'npScanBarWrap' }, [
        el('div', { class: 'npScanBarFill' })
      ]),
      el('div', null, [
        el('button', { class: 'npPkLink', type: 'button', style: 'margin-top:20px', onclick: function () { showPanel('pw'); } }, [
          T('Use password', 'পাসওয়ার্ড দিয়ে খুলুন')
        ])
      ])
    ]);

    var userIn = el('input', { id: 'npPkUser', class: 'npPkField', type: 'text', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false',
      placeholder: T('Username or email', 'ইউজারনেম অথবা ইমেইল') });
    var passIn = el('input', { id: 'npPkPass', class: 'npPkField', type: 'password', autocomplete: 'current-password',
      placeholder: T('Password', 'পাসওয়ার্ড'),
      onkeydown: function (ev) { if (ev.key === 'Enter') onPwSubmit(); } });

    var panelPw = el('div', { id: 'npPkPanelPw', style: 'display:none;margin-top:16px;width:100%' }, [
      userIn, passIn,
      el('button', { id: 'npPkPwBtn', class: 'npPkBtn npPkPrimary', type: 'button', onclick: onPwSubmit }, [T('Unlock', 'আনলক')]),
      el('button', { class: 'npPkLink', type: 'button', onclick: onForgot }, [T('Forgot password?', 'পাসওয়ার্ড ভুলে গেছেন?')]),
      el('div', null, [
        el('button', { class: 'npPkLink', type: 'button', onclick: function () { showPanel('fp'); } }, [T('Back', 'ফিরে যান')])
      ])
    ]);

    var box = el('div', { class: 'npPkBox' }, [
      el('div', { class: 'npPkLogoWrap' }, [
        el('img', { class: 'npPkLogo', src: './icon-192.png', alt: 'App Logo' })
      ]),
      el('div', { class: 'npPkTitle' }, ['NP TOURNAMENT']),
      el('div', { class: 'npPkSub' }, ['SECURITY AUTHENTICATION']),
      panelFp, panelPw,
      el('div', { id: 'npPkLockMsg', class: 'npPkTiny', role: 'alert' })
    ]);

    document.body.appendChild(el('div', { id: 'npPkLock', role: 'dialog', 'aria-modal': 'true' }, [box]));
  }

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
      setEnrolled(user.uid, cred.id);
      var payload = createResult(cred), label = deviceLabel();
      function send(n) {
        return user.getIdToken().then(function (t2) {
          return api('/api/passkey/register/verify', { response: payload, label: label }, t2);
        }).catch(function (e) {
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
  function googleOnly(u) {
    try { return !!(u && u.providerData && u.providerData.length && !u.providerData.some(function (p) { return p && p.providerId === 'password'; })); } catch (e) { return false; }
  }
  function maybeOffer(u) {
    if (offered || G.locked || !u || googleOnly(u)) return;
    if (lsGet(LS_ENR) === u.uid || lsGet('np_pk_later_' + u.uid)) return;
    offered = true;
    platformOK().then(function (ok) {
      if (!ok) return;
      setTimeout(function () {
        var cu = (typeof auth !== 'undefined' && auth) ? auth.currentUser : null;
        if (!cu || cu.uid !== u.uid || G.locked) return;
        waitFree(function () { showSetup(u); });
      }, 2500);
    });
  }

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
    if (!lsGet(LS_ENR)) return;
    if (Date.now() - opEndedAt < 1500) return;
    var cu = currentUser();
    G.pending = null;
    G.resumed = cu ? cu.uid : '';
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
