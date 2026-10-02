import { useState } from 'react';
import { useApp } from '../../store/app-store';
import { qtyText, periodStatusText } from '../../utils/format';

const COLS = [['stt', 'STT', 'right'], ['name', 'Tên sản phẩm', 'left'], ['opening', 'Tồn đầu kỳ', 'right'], ['incoming', 'Nhập thêm', 'right'], ['sold', 'Đã bán', 'right'], ['adjust', 'Điều chỉnh', 'right'], ['current', 'SL hiện tại', 'right']];

export default function Inventory() {
  const { store, api } = useApp();
  const [sort, setSort] = useState({ key: 'stt', dir: 1 });
  const [q, setQ] = useState('');
  const [onlyNeg, setOnlyNeg] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [err, setErr] = useState('');
  const [pid, setPid] = useState('');

  const stats = store.statsFor(pid || store.openPeriod.id), closed = stats.period.status === 'CLOSED';
  const needle = q.trim().toLowerCase();
  const list = stats.inventory
    .filter(i => (!needle || i.name.toLowerCase().includes(needle)) && (!onlyNeg || i.current < 0))
    .sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      return (typeof x === 'string' ? x.localeCompare(y, 'vi') : x - y) * sort.dir;
    });

  const clearDraft = id => { setDrafts(d => { const n = { ...d }; delete n[id]; return n; }); setErr(''); };
  // Save opening stock on blur / Enter; the draft lives only until saved
  const commit = async (id, original) => {
    const d = drafts[id];
    if (d === undefined || String(d) === String(original)) return clearDraft(id);
    if (closed && !window.confirm(`Tháng ${stats.period.label} đã chốt. Sửa tồn sẽ làm thay đổi tồn đầu kỳ của các tháng sau. Tiếp tục?`)) return clearDraft(id);
    const res = await api.setStock(stats.period.id, id, d);
    if (res.ok) clearDraft(id); else setErr(res.error);
  };

  return (
    <section aria-label="Tồn kho" className="page page--tight">
      {stats.negatives.length > 0 && (
        <div role="alert" className="alert alert--tight">
          {stats.negatives.map(n => <p key={n.productId} className="text-danger">{`Sản phẩm “${n.name}” ${closed ? 'cuối tháng' : 'đang'} âm ${Math.abs(n.current)} cái.`}</p>)}
        </div>
      )}
      <div className="row-between">
        <div role="group" aria-label="Bộ lọc" className="row-wrap" style={{ alignItems: 'center', flex: '1 1 320px' }}>
          <select aria-label="Tháng" className="pill" value={stats.period.id} onChange={e => { setPid(e.target.value); setDrafts({}); setErr(''); }}>
            {[...store.periods].reverse().map(p => <option key={p.id} value={p.id}>{`Tháng ${p.label} · ${periodStatusText(p)}`}</option>)}
          </select>
          <input type="search" aria-label="Tìm sản phẩm" placeholder="Tìm sản phẩm" className="pill pill--search" value={q} onChange={e => setQ(e.target.value)} />
          <label className="check">
            <input type="checkbox" className="checkbox" checked={onlyNeg} onChange={e => setOnlyNeg(e.target.checked)} />
            <span>Chỉ hiện sản phẩm tồn âm</span>
          </label>
        </div>
        <p className="caption">Kỳ {stats.period.label} · Tổng tồn <strong>{qtyText(stats.totals.stockTotal)} món</strong></p>
      </div>
      <p className="caption">
        SL hiện tại = Tồn đầu kỳ + Nhập thêm − Đã bán + Điều chỉnh. Kiểm kê thấy lệch thì sửa thẳng ô SL hiện tại rồi nhấn Enter: phần chênh ghi vào cột Điều chỉnh, các tháng sau tự tính lại.
      </p>
      <div role="region" aria-label="Bảng tồn kho" tabIndex={0} className="table-wrap">
        <table className="table table--hover table--compact table--nowrap-head" style={{ minWidth: 680 }}>
          <thead>
            <tr>
              {COLS.map(([key, label, align]) => {
                const on = sort.key === key;
                return (
                  <th key={key} scope="col" aria-sort={on ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} style={{ padding: '4px 8px', textAlign: align }}>
                    <button type="button" className="sort-btn" onClick={() => setSort(s => ({ key, dir: s.key === key ? -s.dir : 1 }))}>
                      {label}{on ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {list.map(i => {
              const neg = i.current < 0, draft = drafts[i.productId];
              const bad = draft !== undefined && !(draft !== '' && Number.isInteger(Number(draft)));
              return (
                <tr key={i.productId} className={neg ? 'row-neg' : undefined}>
                  <td className="r dim">{i.stt}</td>
                  <td className="b">{i.name}{!i.active && <span className="dim" style={{ fontWeight: 400 }}> (ẩn)</span>}</td>
                  <td className="r">{i.opening}</td>
                  <td className="r">{i.incoming}</td>
                  <td className="r">{i.sold}</td>
                  <td className="r dim">{i.adjust ? (i.adjust > 0 ? `+${i.adjust}` : i.adjust) : '—'}</td>
                  <td className={'r b' + (neg ? ' neg' : '')} style={{ padding: '6px 12px' }}>
                    <input
                      type="number" inputMode="numeric" step="1" className={'cell-input' + (neg ? ' neg' : '')}
                      value={draft !== undefined ? draft : String(i.current)}
                      onChange={e => { const v = e.target.value; setDrafts(d => ({ ...d, [i.productId]: v })); }}
                      onBlur={() => commit(i.productId, i.current)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); commit(i.productId, i.current); }
                        if (e.key === 'Escape') clearDraft(i.productId);
                      }}
                      aria-label={`SL hiện tại của ${i.name}`} aria-invalid={bad ? 'true' : 'false'}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {err && <p role="alert" className="text-danger">{err}</p>}
      {list.length === 0 && <p className="caption">Không có sản phẩm nào khớp bộ lọc.</p>}
    </section>
  );
}
