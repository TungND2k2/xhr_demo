// Payload REST client cho portal khách hàng.
// Token-based auth: POST /api/users/login → cache JWT → gửi qua Authorization
// header. Cookies không qua được Vite proxy cross-domain.

const API_BASE = '/api';

let _token = null;
let _loginPromise = null;

function devCreds() {
  return {
    email: import.meta.env.VITE_DEV_EMAIL,
    password: import.meta.env.VITE_DEV_PASSWORD,
  };
}

async function ensureLogin() {
  if (_token) return _token;
  if (_loginPromise) return _loginPromise;
  const creds = devCreds();
  if (!creds.email || !creds.password) {
    console.warn('[portal] Thiếu VITE_DEV_EMAIL / VITE_DEV_PASSWORD trong .env.local');
    return null;
  }
  _loginPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds),
      });
      if (!res.ok) {
        console.error('[portal] Login fail HTTP', res.status, await res.text().catch(() => ''));
        return null;
      }
      const j = await res.json();
      _token = j.token || null;
      return _token;
    } catch (e) {
      console.error('[portal] Login error', e);
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
      // Mảng object (vd where[and] = [{...}, {...}]) — đệ quy theo index
      if (v.length > 0 && typeof v[0] === 'object' && v[0] !== null) {
        v.forEach((item, idx) => flattenWhere(item, params, `${key}[${idx}]`));
      } else {
        // Mảng scalar (vd in:[a,b,c]) — comma-joined
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
  const token = await ensureLogin();
  const headers = { ...(init.headers || {}) };
  if (token) headers.Authorization = `JWT ${token}`;
  return fetch(`${API_BASE}${path}`, { ...init, headers });
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
