import { useState } from 'react';
import { useApp } from '../../store/app-store';
import { useFocusOn } from '../../hooks/use-focus-on';
import { yen, fmtDate, periodStatusText } from '../../utils/format';
import Field, { invalidProps } from '../../components/Field';
import Warnings from '../../components/Warnings';
import PeriodField, { targetPeriod } from '../../components/PeriodField';

const blank = keep => ({ periodId: keep ? keep.periodId : '', productId: '', date: keep ? keep.date : '', qty: '1', price: '', ship: '', customer: '', note: '' });
const noFilter = { period: '', product: 'all', date: '', customer: '' };

export default function Sales({ composerOpen, composerSeq, closeComposer }) {
  const { store, api } = useApp();
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState([]);
  const [filter, setFilter] = useState(noFilter);
  const firstRef = useFocusOn(composerOpen, composerSeq);

  const on = k => e => {
    const v = e.target.value;
    setForm(f => ({ ...f, [k]: v }));
    setWarnings([]);
    setErrors(x => ({ ...x, [k]: undefined }));
  };
  const save = async force => {
    const res = editing ? await api.updateSale(editing.id, form, force) : await api.addSale(form, force);
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
  const startEdit = r => {
    if (r.locked && !window.confirm(`Đơn này thuộc kỳ ${r.periodLabel} đã chốt. Sửa sẽ làm thay đổi số của các kỳ sau. Tiếp tục?`)) return;
    setForm({ periodId: r.periodId, productId: r.productId, date: r.date, qty: String(r.qty), price: String(r.price),
      ship: r.ship ? String(r.ship) : '', customer: r.customer, note: r.note });
    setEditing(r); setErrors({}); setWarnings([]);
    window.scrollTo(0, 0);
  };
  const remove = r => {
    if (r.locked && !window.confirm(`Đơn này thuộc kỳ ${r.periodLabel} đã chốt. Xóa sẽ làm thay đổi số của các kỳ sau. Tiếp tục?`)) return;
    api.deleteSale(r.id);
  };
  const formOpen = composerOpen || !!editing;

  const period = store.periods.find(p => p.id === (filter.period || store.openPeriod.id)) || store.openPeriod;
  const inPeriod = store.sales.filter(r => r.periodId === period.id);
  const q = filter.customer.trim().toLowerCase();
  const rows = inPeriod.filter(r => (filter.product === 'all' || r.productId === filter.product) && (!filter.date || r.date === filter.date) && (!q || (r.customer || '').toLowerCase().includes(q)));
  const hasFilter = filter.product !== 'all' || !!filter.date || !!q;
  const setF = k => e => setFilter(f => ({ ...f, [k]: e.target.value }));

  // Current stock hint as soon as a product is picked (BR-09)
  const inv = form.productId ? store.inventory.find(i => i.productId === form.productId) : null;
  const qty = Number(form.qty), price = Number(form.price), ship = form.ship === '' ? 0 : Number(form.ship);
  const valid = form.qty !== '' && form.price !== '' && qty >= 1 && price >= 0 && ship >= 0;
  const short = inv && valid && inv.current - qty < 0;

  return (
    <section aria-label="Bán hàng" className="page">
      {formOpen && (
        <form onSubmit={e => { e.preventDefault(); save(false); }} noValidate aria-labelledby="sale-form-h" className="card card--lg">
          <div className="form-head">
            <h2 id="sale-form-h" className="h-tile">{editing ? `Sửa đơn bán ${editing.stt} · kỳ ${editing.periodLabel}` : 'Thêm đơn bán'}</h2>
            <p className="caption">{editing ? `Đơn thuộc kỳ ${editing.periodLabel}` : `Ghi vào kỳ ${targetPeriod(store, form.periodId, form.date).label}`}. Tổng tiền = Số lượng × Đơn giá − Phí ship.</p>
          </div>
          <div className="form-grid">
            {!editing && <PeriodField id="sale-period" store={store} value={form.periodId} onChange={on('periodId')} error={errors.periodId} />}
            <Field
              id="sale-product" label="Sản phẩm *" error={errors.productId}
              hint={inv ? `Tồn hiện tại: ${inv.current} cái` : 'Chọn sản phẩm để xem tồn hiện tại.'}
              hintColor={(inv && inv.current <= 0) || short ? 'var(--c-danger)' : undefined}
            >
              <select id="sale-product" ref={firstRef} className="input" value={form.productId} onChange={on('productId')} aria-invalid={errors.productId ? 'true' : 'false'} aria-describedby="sale-product-hint sale-product-err">
                <option value="">Chọn sản phẩm</option>
                {store.activeProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field id="sale-date" label="Ngày bán" error={errors.date}>
              <input {...invalidProps('sale-date', errors.date)} type="date" className="input" value={form.date} onChange={on('date')} />
            </Field>
            <Field id="sale-qty" label="Số lượng bán *" error={errors.qty}>
              <input {...invalidProps('sale-qty', errors.qty)} type="number" inputMode="numeric" min="1" step="1" className="input" value={form.qty} onChange={on('qty')} />
            </Field>
            <Field id="sale-price" label="Đơn giá mỗi cái (¥) *" error={errors.price} hint="Nhập 0 nếu là hàng bóc (chỉ trừ tồn kho).">
              <input {...invalidProps('sale-price', errors.price)} aria-describedby="sale-price-hint sale-price-err" type="number" inputMode="numeric" min="0" step="1" className="input" value={form.price} onChange={on('price')} />
            </Field>
            <Field id="sale-ship" label="Phí ship shop chịu (¥)" error={errors.ship}>
              <input {...invalidProps('sale-ship', errors.ship)} type="number" inputMode="numeric" min="0" step="1" className="input" value={form.ship} onChange={on('ship')} />
            </Field>
            <Field id="sale-customer" label="Khách mua">
              <input id="sale-customer" type="text" autoComplete="off" placeholder="masai" className="input" value={form.customer} onChange={on('customer')} />
            </Field>
            <Field id="sale-note" label="Ghi chú" full>
              <input id="sale-note" type="text" className="input" value={form.note} onChange={on('note')} />
            </Field>
          </div>
          <Warnings items={warnings} onForce={() => save(true)} forceLabel="Vẫn lưu đơn này" />
          <div className="form-foot">
            <p aria-live="polite" className="form-total">Tổng tiền: <strong>{valid ? yen(qty * price - ship) : '—'}</strong></p>
            <div className="row-wrap">
              <button type="button" className="btn-secondary" onClick={cancel}>Đóng</button>
              <button type="submit" className="btn-primary" disabled={!form.productId || form.qty === '' || form.price === ''}>{editing ? 'Lưu thay đổi' : 'Lưu đơn bán'}</button>
            </div>
          </div>
        </form>
      )}

      <div className="stack-md">
        <div role="group" aria-label="Bộ lọc" className="row-wrap">
          <select aria-label="Kỳ" className="pill" value={period.id} onChange={setF('period')}>
            {store.periods.map(p => <option key={p.id} value={p.id}>{`Kỳ ${p.label} · ${periodStatusText(p)}`}</option>)}
          </select>
          <select aria-label="Sản phẩm" className="pill" value={filter.product} onChange={setF('product')}>
            <option value="all">Tất cả sản phẩm</option>
            {store.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="date" aria-label="Lọc theo ngày bán" className="pill" value={filter.date} onChange={setF('date')} />
          <input type="search" aria-label="Tìm khách mua" placeholder="Tìm khách mua" className="pill pill--search" value={filter.customer} onChange={setF('customer')} />
          {hasFilter && (
            <button type="button" className="btn-link" style={{ minHeight: 44 }} onClick={() => setFilter(f => ({ ...noFilter, period: f.period }))}>Xóa bộ lọc</button>
          )}
        </div>
        <div className="row-between row-between--loose">
          <p className="caption">Tổng số đơn bán kỳ {period.label}: <strong>{inPeriod.length}</strong></p>
          <p className="caption">Đang hiện {rows.length} đơn · Tổng tiền {yen(rows.reduce((a, r) => a + r.total, 0))}</p>
        </div>
        {period.status === 'CLOSED' && <p className="note">{`Kỳ ${period.label} đã chốt. Dữ liệu chỉ xem, không thể sửa.`}</p>}
        <div role="region" aria-label="Bảng bán hàng" tabIndex={0} className="table-wrap">
          <table className="table table--hover table--nowrap-head table--dense" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th scope="col" className="r">STT</th>
                <th scope="col">Ngày bán</th>
                <th scope="col">Sản phẩm</th>
                <th scope="col" className="r">SL</th>
                <th scope="col" className="r">Đơn giá</th>
                <th scope="col" className="r">Phí ship</th>
                <th scope="col" className="r">Tổng tiền</th>
                <th scope="col">Khách mua</th>
                <th scope="col">Ghi chú</th>
                <th scope="col"><span className="sr-only">Thao tác</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td className="r dim">{r.stt}</td>
                  <td className={'nw' + (r.date ? '' : ' dim')}>{fmtDate(r.date, 'Chưa có ngày')}</td>
                  <td className="b">{r.productName}</td>
                  <td className="r">{r.qty}</td>
                  <td className="r nw">{yen(r.price)}</td>
                  <td className="r nw">{r.ship ? yen(r.ship) : '—'}</td>
                  <td className="r nw b">{yen(r.total)}</td>
                  <td>{r.customer || '—'}</td>
                  <td className="dim">{r.note || '—'}</td>
                  <td className="act nw">
                    <button type="button" className="btn-link btn-link--tight" onClick={() => startEdit(r)} aria-label={`Sửa đơn bán ${r.stt} (${r.productName})`}>Sửa</button>
                    <button type="button" className="btn-link btn-link--tight btn-link--danger" onClick={() => remove(r)} aria-label={`Xóa đơn bán ${r.stt} (${r.productName})`}>Xóa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="caption">Không có đơn bán nào khớp bộ lọc.</p>}
      </div>
    </section>
  );
}
