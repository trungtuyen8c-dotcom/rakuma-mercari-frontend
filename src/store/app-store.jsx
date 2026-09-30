import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { computeStore } from './compute';
import { api as http } from '../services/api';
import { yen } from '../utils/format';

const AppContext = createContext(null);

// The server validates every write and is the source of truth (BR-xx, E-xx).
// The UI loads all rows once (GET /state), derives its views in compute.js, and reloads after each write.
function buildApi(reload, notify, setSignedOut) {
  // Turns an HTTP result into the { ok, errors, warnings, error } shape the screens use.
  const result = async (res, successMsg) => {
    if (res.status === 401) { setSignedOut(); return { ok: false, error: res.error }; }
    if (res.ok) {
      await reload();
      if (successMsg) notify(typeof successMsg === 'function' ? successMsg(res.data) : successMsg);
      return { ok: true, data: res.data };
    }
    return { ok: false, errors: res.errors, warnings: res.warnings, error: res.error };
  };
  // Row actions without a form: show the server's message in the notice bar.
  const act = async (res, successMsg) => {
    const r = await result(res, successMsg);
    if (!r.ok && r.error) notify(r.error);
    return r;
  };
  const force = f => (f ? '?force=true' : '');

  return {
    authConfig: () => http.get('/auth/config'),
    devLogin: async acc => {
      const res = await http.post('/auth/dev-login', { email: acc.email, name: acc.name });
      if (res.ok) await reload();
      return res;
    },
    googleLoginUrl: '/api/v1/auth/google/login',
    signOut: async () => { await http.post('/auth/logout'); setSignedOut(); },

    addPurchase: async (d, f) => result(await http.post('/purchases' + force(f), d), r => `Đã thêm dòng nhập “${r.productName}”: ${yen(r.total)}.`),
    deletePurchase: async id => act(await http.del('/purchases/' + id), 'Đã xóa dòng nhập.'),
    togglePurchase: async (id, field, value) => act(await http.patch('/purchases/' + id, { [field]: value })),

    addSale: async (d, f) => result(await http.post('/sales' + force(f), d), r => `Đã ghi bán ${r.qty} “${r.productName}”: ${yen(r.total)}.`),
    deleteSale: async id => act(await http.del('/sales/' + id), 'Đã xóa đơn bán.'),

    addProduct: async name => {
      const r = await result(await http.post('/products', { name }), p => `Đã thêm “${p.name}” vào danh mục.`);
      return r.ok ? r : { ok: false, error: r.errors?.name || r.error };
    },
    renameProduct: async (id, name) => {
      const r = await result(await http.patch('/products/' + id, { name }));
      return r.ok ? r : { ok: false, error: r.errors?.name || r.error };
    },
    toggleProductActive: async (id, active) => act(await http.patch('/products/' + id, { active })),
    deleteProduct: async id => act(await http.del('/products/' + id), 'Đã xóa sản phẩm.'),

    setOpening: async (pid, value) => {
      const r = await result(await http.put(`/stock/${pid}/opening`, { qty: value }));
      return r.ok ? r : { ok: false, error: r.errors?.qty || r.error };
    },

    saveSettings: async d => result(await http.put('/settings', d), 'Đã lưu cài đặt.'),

    createApiKey: async (name, scope) => {
      const r = await result(await http.post('/api-keys', { name, scope }));
      return r.ok ? { ok: true, key: r.data.key, record: r.data.record } : { ok: false, error: r.errors?.name || r.error };
    },
    revokeApiKey: async id => act(await http.post(`/api-keys/${id}/revoke`), k => `Đã thu hồi key “${k.name}”. Công cụ đang dùng key này sẽ bị từ chối ngay.`),

    closePeriod: async (closing, totals) => act(await http.post('/periods/close'),
      p => `Đã chốt kỳ ${closing}: vốn ${yen(totals.totalCost)}, doanh thu ${yen(totals.totalRevenue)}. Kỳ ${p.label} đã mở.`),
  };
}

export function AppProvider({ children }) {
  // status: 'loading' | 'signedOut' | 'ready' | 'error'
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState('');
  const timer = useRef(null);

  const reload = useCallback(async () => {
    const res = await http.get('/state');
    if (res.ok) { setData(res.data); setStatus('ready'); }
    else if (res.status === 401 || res.status === 403) { setData(null); setStatus('signedOut'); }
    else setStatus(s => (s === 'ready' ? s : 'error'));
  }, []);

  const api = useMemo(() => {
    const notify = msg => {
      clearTimeout(timer.current);
      setNotice(msg);
      timer.current = setTimeout(() => setNotice(''), 7000);
    };
    const setSignedOut = () => { setData(null); setStatus('signedOut'); };
    return { ...buildApi(reload, notify, setSignedOut), reload, notify, dismissNotice: () => setNotice('') };
  }, [reload]);

  useEffect(() => { reload(); return () => clearTimeout(timer.current); }, [reload]);

  const store = useMemo(() => (data ? computeStore(data) : null), [data]);
  const value = useMemo(() => ({ status, store, api, notice }), [status, store, api, notice]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
