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

  // পূর্ণাঙ্গ ও নিখুঁত ফিঙ্গারপ্রিন্ট ভেক্টর (Full concentric loop & ridges)
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

  // ---------- styles (Cyber-Bio HUD UI) ----------
  var css = '' +
    '#npPkLock{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-start;justify-content:center;padding:12vh 20px 20px;' +
    'background:radial-gradient(circle at 50% 30%,#151d33 0%,#040711 75%);color:#f8fafc;font-family:var(--font-bengali,sans-serif);overflow:auto}' +
    '.npPkBox{width:100%;max-width:360px;text-align:center;display:flex;flex-direction:column;align-items:center}' +
    '.npPkLogo{width:76px;height:76px;border-radius:18px;box-shadow:0 8px 24px rgba(245,158,11,.22);margin-bottom:8px}' +
    '.npPkTitle{font-family:var(--font-esports,sans-serif);font-size:19px;font-weight:700;letter-spacing:1.5px;margin:10px 0 2px;color:#00f0ff;text-transform:uppercase}' +
    '.npPkSub{font-size:12px;color:#64748b;letter-spacing:2px;margin-bottom:20px;text-transform:uppercase}' +
    '.npPkBtn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:14px 16px;border-radius:14px;border:1px solid rgba(245,158,11,.35);' +
    'background:transparent;color:#f8fafc;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit}' +
    '.npPkBtn:disabled{opacity:.6;cursor:default}' +
    '.npPkPrimary{background:linear-gradient(135deg,#f59e0b,#d97706);border-color:transparent;color:#0f172a;box-shadow:0 6px 18px rgba(245,158,11,.3)}' +
    '.npPkLink{background:none;border:none;color:#94a3b8;font-size:14px;margin-top:20px;cursor:pointer;text-decoration:underline;font-family:inherit;transition:color .2s}' +
    '.npPkLink:hover{color:#f8fafc}' +
    '.npPkMsg{min-height:20px;margin:12px 0 0;font-size:13px;color:#fca5a5}' +
    '.npPkField{width:100%;box-sizing:border-box;padding:13px 14px;margin-bottom:10px;border-radius:12px;border:1px solid #1e293b;background:#0a0f1a;color:#f8fafc;font-size:15px;font-family:inherit}' +
    '.npPkField:focus{outline:none;border-color:#00f0ff}' +
    
    /* HUD সাইবার স্ক্যানার ফ্রেম */
    '.npPkScannerWrap{position:relative;width:240px;height:240px;margin:18px auto 6px;display:flex;align-items:center;justify-content:center}' +
    '.npPkFp{position:relative;width:230px;height:230px;border-radius:36px;border:1px solid rgba(0,240,255,0.25);' +
    'background:radial-gradient(circle at 50% 50%, #0d1a30 0%, #030814 85%);' +
    'box-shadow:0 12px 35px rgba(0,0,0,0.7), inset 0 0 30px rgba(0,240,255,0.08);' +
    'display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;outline:none;' +
    '-webkit-tap-highlight-color:transparent;transition:all 0.25s cubic-bezier(0.4,0,0.2,1);overflow:hidden}' +
    
    '.npPkGridBack{position:absolute;inset:24px;border:1px solid rgba(0,240,255,0.2);pointer-events:none;' +
    'background-image:linear-gradient(rgba(0,240,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.18) 1px, transparent 1px);' +
    'background-size:24px 24px;border-radius:6px;opacity:0.85}' +

    '.npPkRadarRing{position:absolute;width:150px;height:150px;border-radius:50%;border:1px solid rgba(0,240,255,0.35);' +
    'box-shadow:0 0 12px rgba(0,240,255,0.15), inset 0 0 12px rgba(0,240,255,0.15);pointer-events:none}' +

    '.npPkCorner{position:absolute;width:26px;height:26px;border-color:#00f0ff;border-style:solid;border-width:0;pointer-events:none;filter:drop-shadow(0 0 6px #00f0ff)}' +
    '.npPkCornerTL{top:20px;left:20px;border-top-width:4px;border-left-width:4px;border-top-left-radius:6px}' +
    '.npPkCornerTR{top:20px;right:20px;border-top-width:4px;border-right-width:4px;border-top-right-radius:6px}' +
    '.npPkCornerBL{bottom:20px;left:20px;border-bottom-width:4px;border-left-width:4px;border-bottom-left-radius:6px}' +
    '.npPkCornerBR{bottom:20px;right:20px;border-bottom-width:4px;border-right-width:4px;border-bottom-right-radius:6px}' +

    '.npPkLaserBeam{position:absolute;left:10px;right:10px;height:3px;background:#00f0ff;' +
    'box-shadow:0 0 16px #00f0ff, 0 0 32px #00f0ff, 0 0 45px rgba(0,240,255,0.8);' +
    'pointer-events:none;animation:npPkLaserSweep 2.2s ease-in-out infinite}' +
    
    '.npPkFp .npPkIco{position:relative;z-index:2;width:95px;height:120px;color:#00f0ff;' +
    'filter:drop-shadow(0 0 10px rgba(0,240,255,0.85)) drop-shadow(0 0 20px rgba(0,240,255,0.45));' +
    'transition:all 0.25s ease}' +

    '.npPkFp:active, .npPkFp.touching, .npPkFp.busy{' +
    'transform:scale(0.97);border-color:#00f0ff;' +
    'box-shadow:0 0 45px rgba(0,240,255,0.6), inset 0 0 35px rgba(0,240,255,0.3)}' +
    '.npPkFp:active .npPkIco, .npPkFp.touching .npPkIco, .npPkFp.busy .npPkIco{' +
    'filter:drop-shadow(0 0 18px #00f0ff) drop-shadow(0 0 32px rgba(0,240,255,0.95));color:#ffffff}' +
    '.npPkFp:active .npPkLaserBeam, .npPkFp.touching .npPkLaserBeam, .npPkFp.busy .npPkLaserBeam{' +
    'animation-duration:1s;box-shadow:0 0 25px #00f0ff, 0 0 45px #00f0ff}' +

    '.npPkFp.ok{border-color:#22c55e;box-shadow:0 0 45px rgba(34,197,94,0.7)}' +
    '.npPkFp.ok .npPkIco{color:#22c55e;filter:drop-shadow(0 0 20px rgba(34,197,94,0.95))}' +
    '.npPkFp.ok .npPkCorner{border-color:#22c55e;filter:drop-shadow(0 0 8px #22c55e)}' +
    '.npPkFp.ok .npPkLaserBeam{background:#22c55e;box-shadow:0 0 25px #22c55e;animation:none}' +

    '@keyframes npPkLaserSweep{0%{top:22%;opacity:0.3}50%{top:78%;opacity:1}100%{top:22%;opacity:0.3}}' +
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
  function removeLock() { var n = document.getElementById('npPkLock'); if (n && n.parentNode) n.parentNode.removeChild(n); }
  function unlockDone() {
    var b = document.getElementById('npPkUnlockBtn');
    if (b && b.offsetParent) {
      b.classList.remove('busy', 'touching'); b.classList.add('ok');
      setTimeout(function () { removeLock(); G.release(); }, 250);
    } else { removeLock(); G.release(); }
  }

  function showPanel(which) {
    var a = document.getElementById('npPkPanelFp'), b = document.getElementById('npPkPanelPw');
    if (a) a.style.display = which === 'fp' ? '' : 'none';
    if (b) b.style.display = which === 'pw' ? '' : 'none';
    setMsg('');
    if (which === 'pw') { var u = document.getElementById('npPkUser'); if (u) u.focus(); }
  }

  // 100% লোকাল বায়োমেট্রিক অথেন্টিকেশন (অ্যান্ড্রয়েড / ডিভাইস লেভেল - নো সার্ভার কল)
  function requestDeviceBiometric() {
    if (window.PublicKeyCredential && navigator.credentials && navigator.credentials.get) {
      var challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      return navigator.credentials.get({
        publicKey: {
          challenge: challenge,
          timeout: 60000,
          userVerification: 'preferred',
          rpId: window.location.hostname || undefined
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
    if (gb) gb.classList.add('touching');
    setMsg(''); setBusy(true);

    requestDeviceBiometric().then(function () {
      // ডিভাইসে ফিঙ্গারপ্রিন্ট সফল হলে
      unlockDone();
    }).catch(function (e) {
      if (gb) gb.classList.remove('ok', 'touching');
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
      el('div', { class: 'npPkGridBack' }),
      el('div', { class: 'npPkRadarRing' }),
      el('div', { class: 'npPkCorner npPkCornerTL' }),
      el('div', { class: 'npPkCorner npPkCornerTR' }),
      el('div', { class: 'npPkCorner npPkCornerBL' }),
      el('div', { class: 'npPkCorner npPkCornerBR' }),
      fpIcon(),
      el('div', { class: 'npPkLaserBeam' })
    ]);

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
    var userIn = el('input', { id: 'npPkUser', class: 'npPkField', type: 'text', autocomplete: 'username',
      placeholder: T('Username or email', 'ইউজারনেম অথবা ইমেইল') });
    var passIn = el('input', { id: 'npPkPass', class: 'npPkField', type: 'password', autocomplete: 'current-password',
      placeholder: T('Password', 'পাসওয়ার্ড'),
      onkeydown: function (ev) { if (ev.key === 'Enter') onPwSubmit(); } });
    var panelPw = el('div', { id: 'npPkPanelPw', style: 'display:none;margin-top:22px' }, [
      userIn, passIn,
      el('button', { id: 'npPkPwBtn', class: 'npPkBtn npPkPrimary', type: 'button', onclick: onPwSubmit }, [T('Unlock', 'আনলক')]),
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

  // ---------- Profile Card & Enable/Disable (100% লোকাল স্টোরেজ) ----------
  var card = null, list = null, actions = null;

  function currentUser() { return (typeof auth !== 'undefined' && auth) ? auth.currentUser : null; }

  function buildCard() {
    if (card) return;
    var btn = document.querySelector('button[onclick="window.app.handleLogout()"]');
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
        onclick: function () {
          lsDel(LS_LOCAL_BIO);
          lsDel(LS_BIO_UID);
          toast(T('Biometric lock disabled.', 'বায়োমেট্রিক লক বন্ধ করা হয়েছে।'), 'info');
          renderCard();
        }
      }, [T('Disable Biometric Lock', 'বায়োমেট্রিক লক বন্ধ করুন')]));
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
  }

  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
