// Login + decryption. The data file is encrypted; only the right username and password unlock it.
(function () {
  const DEFAULT_PARAMS = {channel: '', metric: 'leads', range: '15'};
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const $ = (id) => document.getElementById(id);
  const fetchJSON = async (url) => {
    const r = await fetch(url + '?t=' + Date.now(), {cache: 'no-store'});
    if (!r.ok) throw new Error('Could not load ' + url + ' (' + r.status + ')');
    return r.json();
  };

  async function unlockPrivateKey(user, pass) {
    const k = await fetchJSON('keys.json');
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(user.trim().toLowerCase() + '\n' + pass), 'PBKDF2', false, ['deriveKey']);
    const aes = await crypto.subtle.deriveKey({name: 'PBKDF2', hash: 'SHA-256', salt: b64(k.salt), iterations: k.iterations}, base, {name: 'AES-GCM', length: 256}, false, ['decrypt']);
    return crypto.subtle.decrypt({name: 'AES-GCM', iv: b64(k.iv)}, aes, b64(k.wrapped)); // throws on wrong credentials
  }

  async function openData(pkcs8) {
    const priv = await crypto.subtle.importKey('pkcs8', pkcs8, {name: 'RSA-OAEP', hash: 'SHA-256'}, false, ['decrypt']);
    const d = await fetchJSON('data.enc.json');
    const raw = await crypto.subtle.decrypt({name: 'RSA-OAEP'}, priv, b64(d.ek));
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    const gz = await crypto.subtle.decrypt({name: 'AES-GCM', iv: b64(d.iv)}, key, b64(d.ct));
    const text = await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    return JSON.parse(text);
  }

  async function show(pkcs8) {
    const data = await openData(pkcs8);
    $('login').hidden = true;
    $('app').hidden = false;
    window.dash._load(data, DEFAULT_PARAMS);
  }

  $('login-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = $('login-btn'), err = $('login-err');
    err.textContent = ''; btn.disabled = true; btn.textContent = 'Signing in…';
    let pkcs8;
    try {
      pkcs8 = await unlockPrivateKey($('login-user').value, $('login-pass').value);
    } catch (e) {
      err.textContent = 'Incorrect username or password.';
      btn.disabled = false; btn.textContent = 'Sign in';
      return;
    }
    try { sessionStorage.setItem('gdk', toB64(pkcs8)); } catch (e) { /* private mode */ }
    try { await show(pkcs8); } catch (e) {
      console.error(e);
      err.textContent = 'Signed in, but the data could not be loaded. Please try again in a few minutes.';
      btn.disabled = false; btn.textContent = 'Sign in';
    }
  });

  $('logout').addEventListener('click', () => {
    try { sessionStorage.removeItem('gdk'); } catch (e) { /* ignore */ }
    location.reload();
  });

  // stay signed in for this browser tab
  let saved = null;
  try { saved = sessionStorage.getItem('gdk'); } catch (e) { /* ignore */ }
  if (saved) show(b64(saved).buffer).catch(() => { try { sessionStorage.removeItem('gdk'); } catch (e) {} });
})();
