import { useState } from 'react';
import { useApp } from '../../store/app-store';
import { useFocusOn } from '../../hooks/use-focus-on';
import { yen, fmtDate, shortUrl, periodStatusText } from '../../utils/format';
import Field, { invalidProps } from '../../components/Field';
import Warnings from '../../components/Warnings';
import PeriodField, { targetPeriod } from '../../components/PeriodField';

const blank = keep => ({ periodId: keep ? keep.periodId : '', productId: '', source: keep ? keep.source : 'REGULAR', date: keep ? keep.date : '', price: '', qty: '1', discount: '', tracking: '', merged: false, link: '', note: '' });

export default function Purchases({ composerOpen, composerSeq, closeComposer }) {
  const { store, api } = useApp();
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null); // the row being edited, or null when adding
  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState([]);
  const [filter, setFilter] = useState({ period: '', source: 'all', product: 'all', status: 'all', q: '' });
  const firstRef = useFocusOn(composerOpen, composerSeq);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setWarnings([]);
    setErrors(e => ({ ...e, [k]: undefined }));
  };
  const on = k => e => set(k, k === 'merged' ? e.target.checked : e.target.value);
  const save = async force => {
    const res = editing ? await api.updatePurchase(editing.id, form, force) : await api.addPurchase(form, force);
    if (res.ok) {
      if (editing) { setEditing(null); setForm(blank()); setErrors({}); setWarnings([]); return; }
      setForm(f => blank(f));
      setErrors({});
      setWarnings([]);
      firstRef.current?.focus();
    } else {
      setErrors(res.errors || {});
      setWarnings(res.warnings || []);
    }
  };
  const cancel = () => { setForm(blank()); setEditing(null); setErrors({}); setWarnings([]); closeComposer(); };
  // Any row is editable, closed months too; the totals of later months are recomputed from the rows
  const startEdit = r => {
    if (r.locked && !window.confirm(`Dòng này thuộc kỳ ${r.periodLabel} đã chốt. Sửa sẽ làm thay đổi số của các kỳ sau. Tiếp tục?`)) return;
    setForm({ periodId: r.periodId, productId: r.productId, source: r.source, date: r.date, price: String(r.price), qty: String(r.qty),
      discount: r.discount ? String(r.discount) : '', tracking: r.tracking, merged: r.merged, link: r.link, note: r.note });
    setEditing(r); setErrors({}); setWarnings([]);
    window.scrollTo(0, 0);
  };
  const remove = r => {
    if (r.locked && !window.confirm(`Dòng này thuộc kỳ ${r.periodLabel} đã chốt. Xóa sẽ làm thay đổi số của các kỳ sau. Tiếp tục?`)) return;
    api.deletePurchase(r.id);
  };
  const formOpen = composerOpen || !!editing;

  const allPeriods = filter.period === 'all';
  const period = store.periods.find(p => p.id === (filter.period || store.openPeriod.id)) || store.openPeriod;
  const q = filter.q.trim().toLowerCase();
  const match = r => (allPeriods || r.periodId === period.id)
    && (!q || [r.productName, r.link, r.tracking, r.note].some(v => (v || '').toLowerCase().includes(q)))
    && (filter.source === 'all' || r.source === filter.source)
    && (filter.product === 'all' || r.productId === filter.product)
    && (filter.status === 'all'
      || (filter.status === 'unchecked' && !r.checked)
      || (filter.status === 'unreviewed' && !r.reviewed)
      || (filter.status === 'done' && r.checked && r.reviewed)
      || (filter.status === 'dup' && (r.dupLink || r.dupTracking)));
  const rows = store.purchases.filter(match);
  const setF = k => e => setFilter(f => ({ ...f, [k]: e.target.value }));

  // Preview total per BR-03
  const price = Number(form.price), qty = Number(form.qty), disc = form.discount === '' ? 0 : Number(form.discount);
  const valid = form.price !== '' && form.qty !== '' && price > 0 && qty >= 1 && disc >= 0 && disc <= price;

  return (
    <section aria-label="Nhập hàng" className="page">
      {formOpen && (
        <form onSubmit={e => { e.preventDefault(); save(false); }} noValidate aria-labelledby="pur-form-h" className="card card--lg">
          <div className="form-head">
            <h2 id="pur-form-h" className="h-tile">{editing ? `Sửa dòng ${editing.stt} · kỳ ${editing.periodLabel}` : 'Thêm dòng nhập'}</h2>
            <p className="caption">{editing ? `Dòng thuộc kỳ ${editing.periodLabel}` : `Ghi vào kỳ ${targetPeriod(store, form.periodId, form.date).label}`}. Tổng tiền = (Giá nhập − Giảm giá) × Số lượng.</p>
          </div>
          <div className="form-grid">
            {!editing && <PeriodField id="pur-period" store={store} value={form.periodId} onChange={on('periodId')} error={errors.periodId} />}
            <Field id="pur-product" label="Sản phẩm *" error={errors.productId}>
              <select {...invalidProps('pur-product', errors.productId)} ref={firstRef} className="input" value={form.productId} onChange={on('productId')}>
                <option value="">Chọn sản phẩm</option>
                {store.activeProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field id="pur-source" label="Nguồn">
              <select id="pur-source" className="input" value={form.source} onChange={on('source')}>
                <option value="REGULAR">Nhập hàng</option>
                <option value="BULK">Nhập lô lớn</option>
              </select>
            </Field>
            <Field id="pur-date" label="Ngày đặt" error={errors.date}>
              <input {...invalidProps('pur-date', errors.date)} type="date" className="input" value={form.date} onChange={on('date')} />
            </Field>
            <Field id="pur-price" label="Giá nhập mỗi cái (¥) *" error={errors.price}>
              <input {...invalidProps('pur-price', errors.price)} type="number" inputMode="numeric" min="1" step="1" className="input" value={form.price} onChange={on('price')} />
            </Field>
            <Field id="pur-qty" label="Số lượng *" error={errors.qty}>
              <input {...invalidProps('pur-qty', errors.qty)} type="number" inputMode="numeric" min="1" step="1" className="input" value={form.qty} onChange={on('qty')} />
            </Field>
            <Field id="pur-discount" label="Giảm giá mỗi cái (¥)" error={errors.discount}>
              <input {...invalidProps('pur-discount', errors.discount)} type="number" inputMode="numeric" min="0" step="1" className="input" value={form.discount} onChange={on('discount')} />
            </Field>
            <Field id="pur-tracking" label="Mã vận đơn" error={errors.tracking}>
              <input {...invalidProps('pur-tracking', errors.tracking)} type="text" inputMode="numeric" autoComplete="off" placeholder="622955047890" className="input" value={form.tracking} onChange={on('tracking')} />
            </Field>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <label className="check">
                <input type="checkbox" className="checkbox" checked={form.merged} onChange={on('merged')} />
                <span>Đơn gộp (chung một kiện)</span>
              </label>
            </div>
            <Field id="pur-link" label="Link sản phẩm Rakuma/Mercari" error={errors.link} full>
              <input {...invalidProps('pur-link', errors.link)} type="url" autoComplete="off" placeholder="https://jp.mercari.com/item/m21525628171" className="input" value={form.link} onChange={on('link')} />
            </Field>
            <Field id="pur-note" label="Ghi chú" full>
              <input id="pur-note" type="text" className="input" value={form.note} onChange={on('note')} />
            </Field>
          </div>
          <Warnings items={warnings} onForce={() => save(true)} forceLabel="Vẫn lưu dòng này" />
          <div className="form-foot">
            <p aria-live="polite" className="form-total">Tổng tiền: <strong>{valid ? yen((price - disc) * qty) : '—'}</strong></p>
            <div className="row-wrap">
              <button type="button" className="btn-secondary" onClick={cancel}>Đóng</button>
              <button type="submit" className="btn-primary" disabled={!form.productId || form.price === '' || form.qty === ''}>{editing ? 'Lưu thay đổi' : 'Lưu dòng nhập'}</button>
            </div>
          </div>
        </form>
      )}

      <div className="stack-md">
        <div role="group" aria-label="Bộ lọc" className="row-wrap">
          <input type="search" aria-label="Tìm dòng nhập" className="pill pill--search" placeholder="Tìm sản phẩm, link, vận đơn, ghi chú…" value={filter.q} onChange={setF('q')} />
          <select aria-label="Kỳ" className="pill" value={allPeriods ? 'all' : period.id} onChange={setF('period')}>
            <option value="all">Tất cả kỳ</option>
            {store.periods.map(p => <option key={p.id} value={p.id}>{`Kỳ ${p.label} · ${periodStatusText(p)}`}</option>)}
          </select>
          <select aria-label="Nguồn" className="pill" value={filter.source} onChange={setF('source')}>
            <option value="all">Tất cả nguồn</option>
            <option value="REGULAR">Nhập hàng</option>
            <option value="BULK">Nhập lô lớn</option>
          </select>
          <select aria-label="Sản phẩm" className="pill" value={filter.product} onChange={setF('product')}>
            <option value="all">Tất cả sản phẩm</option>
            {store.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select aria-label="Trạng thái" className="pill" value={filter.status} onChange={setF('status')}>
            <option value="all">Mọi trạng thái</option>
            <option value="unchecked">Chưa kiểm hàng</option>
            <option value="unreviewed">Chưa đánh giá</option>
            <option value="done">Hoàn tất</option>
            <option value="dup">Có ô trùng</option>
          </select>
        </div>
        <div className="row-between row-between--loose">
          <p className="caption"><strong>{rows.length} dòng</strong> · Tổng tiền {yen(rows.reduce((a, r) => a + r.total, 0))}</p>
          <p className="caption">Ô đỏ có chữ “trùng”: link hoặc mã vận đơn đã có ở dòng khác.</p>
        </div>
        {!allPeriods && period.status === 'CLOSED' && (
          <p className="note">{`Kỳ ${period.label} đã chốt ngày ${fmtDate(period.closedAt)}. Dữ liệu chỉ xem, không thể sửa.`}</p>
        )}
        <div role="region" aria-label="Bảng nhập hàng" tabIndex={0} className="table-wrap">
          <table className="table table--hover table--nowrap-head" style={{ minWidth: 1120 }}>
            <thead>
              <tr>
                <th scope="col" className="r">STT</th>
                <th scope="col">Ngày đặt</th>
                <th scope="col">Nguồn</th>
                <th scope="col">Sản phẩm</th>
                <th scope="col" className="r">Giá nhập</th>
                <th scope="col" className="r">SL</th>
                <th scope="col" className="r">Giảm giá</th>
                <th scope="col" className="r">Tổng tiền</th>
                <th scope="col">Link</th>
                <th scope="col">Mã vận đơn</th>
                <th scope="col" className="c">Đã kiểm</th>
                <th scope="col" className="c">Đã đánh giá</th>
                <th scope="col" className="r"><span className="sr-only">Thao tác</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td className="r dim nw">{allPeriods ? `${r.periodLabel} · ${r.stt}` : r.stt}</td>
                  <td className="nw">{fmtDate(r.date)}</td>
                  <td className="nw">{r.source === 'BULK' ? 'Lô lớn' : 'Thường'}</td>
                  <td className="b">{r.productName}</td>
                  <td className="r nw">{yen(r.price)}</td>
                  <td className="r">{r.qty}</td>
                  <td className="r nw">{r.discount ? yen(r.discount) : '—'}</td>
                  <td className="r nw b">{yen(r.total)}</td>
                  <td className={'nw' + (r.dupLink ? ' cell-dup' : '')}>
                    {r.link
                      ? <a href={r.link} target="_blank" rel="noopener noreferrer" style={r.dupLink ? { color: 'var(--c-danger)' } : undefined}>{shortUrl(r.link)}</a>
                      : <span className="dim">—</span>}
                    {r.dupLink && <span className="b neg"> · trùng</span>}
                  </td>
                  <td className={'nw' + (r.dupTracking ? ' cell-dup' : '')}>
                    {r.tracking || '—'}
                    <span className="b">{r.dupTracking ? ' · trùng' : r.merged ? ' · gộp' : ''}</span>
                  </td>
                  <td className="c">
                    <input type="checkbox" className="checkbox" checked={r.checked} onChange={() => api.togglePurchase(r.id, 'checked', !r.checked)} aria-label={`Đã kiểm hàng dòng ${r.stt} (${r.productName})`} />
                  </td>
                  <td className="c">
                    <input type="checkbox" className="checkbox" checked={r.reviewed} onChange={() => api.togglePurchase(r.id, 'reviewed', !r.reviewed)} aria-label={`Đã đánh giá người bán dòng ${r.stt} (${r.productName})`} />
                  </td>
                  <td className="act">
                    <button type="button" className="btn-link" onClick={() => startEdit(r)} aria-label={`Sửa dòng ${r.stt} (${r.productName})`}>Sửa</button>
                    <button type="button" className="btn-link btn-link--danger" onClick={() => remove(r)} aria-label={`Xóa dòng ${r.stt} (${r.productName})`}>Xóa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="caption">Không có dòng nào khớp bộ lọc.</p>}
      </div>
    </section>
  );
}
