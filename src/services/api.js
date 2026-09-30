// Single HTTP client for the backend (/api/v1). The session is an HttpOnly cookie, so requests just include credentials.
// Every call resolves to { ok, status, data, errors, warnings, error } and never throws.
const BASE = '/api/v1';

export async function request(method, path, body) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, status: 0, error: 'Chưa lưu được, vui lòng thử lại.' }; // E13: network error
  }
  let data = null;
  if (res.status !== 204) {
    try { data = await res.json(); } catch { data = null; }
  }
  if (res.ok) return { ok: true, status: res.status, data };
  return {
    ok: false,
    status: res.status,
    errors: data?.errors,
    warnings: data?.warnings,
    error: data?.error || 'Chưa lưu được, vui lòng thử lại.',
  };
}

export const api = {
  get: path => request('GET', path),
  post: (path, body = {}) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: path => request('DELETE', path),
};
