// Payload REST client. JWT-based auth:
//  - User login qua /login page → POST /api/users/login → token vào localStorage.
//  - Mỗi fetch attach `Authorization: JWT <token>`.
//  - 401 trả về → clear token + reload (LoginPage sẽ redirect).
//
// Backward compat: nếu localStorage rỗng nhưng có VITE_DEV_EMAIL/PASSWORD
// trong env (dev local), tự login bằng cred đó. Production = đã build mà
// không có VITE_DEV → bắt buộc qua /login.

const API_BASE = '/api';
const TOKEN_KEY = 'xhr-portal-token';
const USER_KEY = 'xhr-portal-user';

let _token = null;
let _user = null;
let _loginPromise = null;
const _listeners = new Set();

// Khởi tạo từ localStorage (giữ session qua reload)
if (typeof window !== 'undefined') {
  try {
    _token = window.localStorage.getItem(TOKEN_KEY) ?? null;
    const userJson = window.localStorage.getItem(USER_KEY);
    if (userJson) _user = JSON.parse(userJson);
  } catch {
    _token = null;
    _user = null;
  }
}

function notify() {
  for (const cb of _listeners) {
    try { cb({ token: _token, user: _user }); } catch { /* ignore */ }
  }
}

export function subscribeAuth(cb) {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

export function getAuthState() {
  return { token: _token, user: _user };
}

function persistAuth(token, user) {
  _token = token ?? null;
  _user = user ?? null;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
    if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(USER_KEY);
  } catch { /* ignore quota / private mode */ }
  notify();
}

function devCreds() {
  return {
    email: import.meta.env.VITE_DEV_EMAIL,
    password: import.meta.env.VITE_DEV_PASSWORD,
  };
}

/** Login một user (gọi từ LoginPage). Throw nếu sai cred. */
export async function login(email, password) {
  const res = await fetch(`${API_BASE}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.token) {
    const msg = json?.errors?.[0]?.message || json?.message || 'Email hoặc mật khẩu không đúng';
    throw new Error(msg);
  }
  persistAuth(json.token, json.user ?? null);
  return json.user ?? null;
}

/** Logout: clear token + user, redirect /login. */
export function logout() {
  persistAuth(null, null);
}

/** Refresh user info (vd sau khi đổi role). */
export async function refreshMe() {
  if (!_token) return null;
  const res = await fetch(`${API_BASE}/users/me`, {
    headers: { Authorization: `JWT ${_token}` },
  });
  if (!res.ok) {
    persistAuth(null, null);
    return null;
  }
  const json = await res.json();
  const user = json?.user ?? null;
  persistAuth(_token, user);
  return user;
}

async function ensureLoginLegacyFallback() {
  if (_token) return _token;
  if (_loginPromise) return _loginPromise;
  const creds = devCreds();
  if (!creds.email || !creds.password) return null;
  _loginPromise = (async () => {
    try {
      const u = await login(creds.email, creds.password);
      return _token;
    } catch {
      return null;
    } finally {
      _loginPromise = null;
    }
  })();
  return _loginPromise;
}

function flattenWhere(where, params, prefix = 'where') {
  for (const [k, v] of Object.entries(where ?? {})) {
    if (v == null) continue;
    const key = `${prefix}[${k}]`;
    if (Array.isArray(v)) {
      if (v.length > 0 && typeof v[0] === 'object' && v[0] !== null) {
        v.forEach((item, idx) => flattenWhere(item, params, `${key}[${idx}]`));
      } else {
        params.set(key, v.join(','));
      }
    } else if (typeof v === 'object') {
      flattenWhere(v, params, key);
    } else {
      params.set(key, String(v));
    }
  }
}

export async function fetchPayload(path, init = {}) {
  let token = _token;
  if (!token) token = await ensureLoginLegacyFallback();
  const headers = { ...(init.headers || {}) };
  if (token) headers.Authorization = `JWT ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  // 401 → token hết hạn / bị revoke → clear + để UI redirect /login
  if (res.status === 401 && token) {
    persistAuth(null, null);
  }
  return res;
}

export async function countDocs(collection, where = {}) {
  const params = new URLSearchParams({ limit: '0', depth: '0' });
  flattenWhere(where, params);
  const res = await fetchPayload(`/${collection}?${params}`);
  if (!res.ok) return null;
  const j = await res.json();
  return typeof j.totalDocs === 'number' ? j.totalDocs : null;
}

export async function listDocs(collection, opts = {}) {
  const { where = {}, limit = 25, page = 1, sort, depth = 1 } = opts;
  const params = new URLSearchParams({
    limit: String(limit),
    page: String(page),
    depth: String(depth),
  });
  if (sort) params.set('sort', sort);
  flattenWhere(where, params);
  const res = await fetchPayload(`/${collection}?${params}`);
  if (!res.ok) return { docs: [], totalDocs: 0, totalPages: 1, page };
  return res.json();
}

export async function getDoc(collection, id, depth = 2) {
  const res = await fetchPayload(`/${collection}/${encodeURIComponent(id)}?depth=${depth}`);
  if (!res.ok) return null;
  return res.json();
}

export async function createDoc(collection, body) {
  const res = await fetchPayload(`/${collection}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.errors?.[0]?.message || json?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json.doc ?? json;
}

export async function deleteDoc(collection, id) {
  const res = await fetchPayload(`/${collection}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    const msg = json?.errors?.[0]?.message || json?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return true;
}

export { API_BASE };
