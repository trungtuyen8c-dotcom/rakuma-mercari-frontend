import { useState } from 'react';
import { useApp } from '../../store/app-store';
import { yen, fmtDate, shortUrl } from '../../utils/format';
import Field, { invalidProps } from '../../components/Field';
import Warnings from '../../components/Warnings';
import './rakuma.css';

// Orders arrive from Claude's Rakuma sync (POST /rakuma/sync). Here the owner reads seller messages and turns each
// queued order into a purchase by picking the product; a lump listing ("5BOX") is split by setting the qty.
export default function Rakuma() {
  const { store } = useApp();
  const [showDismissed, setShowDismissed] = useState(false);
  const orders = store.rakuma;
  const withNews = orders.filter(o => o.newMessages > 0);
  const queue = orders.filter(o => !o.purchaseId && !o.dismissed);
  const dismissed = orders.filter(o => !o.purchaseId && o.dismissed);
  const lastSync = orders.reduce((a, o) => (o.syncedAt > a ? o.syncedAt : a), '');

  return (
    <section aria-label="Rakuma" className="page">
      <p className="caption">
        {lastSync ? <>Lần đồng bộ gần nhất: <strong>{lastSync}</strong> (giờ Nhật).</> : 'Chưa đồng bộ lần nào.'}
        {' '}Nhắn Claude “sync Rakuma” để cập nhật đơn mua, mã vận đơn và tin nhắn.
      </p>

      <div className="stack-md">
        <h2 className="h-tile">Tin nhắn mới <span className="muted">· {withNews.length}</span></h2>
        {withNews.length === 0 && <p className="caption">Không có tin nhắn nào chưa xử lý.</p>}
        {withNews.map(o => <MessageCard key={o.id} order={o} />)}
      </div>

      <div className="stack-md">
        <h2 className="h-tile">Chờ duyệt <span className="muted">· {queue.length}</span></h2>
        {queue.length === 0 && <p className="caption">Không có đơn nào chờ duyệt.</p>}
        {queue.map(o => <ApproveCard key={o.id} order={o} />)}
        {dismissed.length > 0 && (
          <button type="button" className="btn-link btn-link--tight" aria-expanded={showDismissed} onClick={() => setShowDismissed(v => !v)}>
            {showDismissed ? 'Ẩn' : 'Xem'} {dismissed.length} đơn đã bỏ qua
          </button>
        )}
        {showDismissed && dismissed.map(o => <DismissedRow key={o.id} order={o} />)}
      </div>
    </section>
  );
}

function OrderHead({ order }) {
  return (
    <div className="rk-head">
      <h3 className="rk-title">
        <a href={order.link} target="_blank" rel="noopener noreferrer">{order.title}</a>
      </h3>
      <p className="caption">
        {order.status || '—'} · Đặt {fmtDate(order.date)} · {yen(order.price)}
        {order.discount > 0 && ` − ${yen(order.discount)} coupon`}
        {order.tracking && ` · Vận đơn ${order.tracking}`}
        {order.seller && ` · ${order.seller}`} · Đơn {order.orderNo}
      </p>
    </div>
  );
}

function MessageCard({ order }) {
  const { api } = useApp();
  return (
    <article className="card" aria-label={`Tin nhắn đơn ${order.orderNo}`}>
      <OrderHead order={order} />
      {order.summary && <p className="rk-summary">{order.summary}</p>}
      <ol className="rk-thread">
        {order.messages.map(m => (
          <li key={m.id} className={'rk-msg' + (m.from === 'buyer' ? ' rk-msg--me' : '') + (m.new ? ' rk-msg--new' : '')}>
            <p className="caption">{m.from === 'buyer' ? 'Bạn' : 'Người bán'}{m.at && ` · ${m.at}`}{m.new && ' · mới'}</p>
            <p className="rk-body">{m.body}</p>
          </li>
        ))}
      </ol>
      {order.replyDraft && (
        <div className="rk-draft">
          <p className="label">Câu trả lời Claude soạn sẵn</p>
          <p className="rk-body">{order.replyDraft}</p>
          <p className="caption">Muốn gửi thì duyệt trong chat với Claude. Claude không tự gửi.</p>
        </div>
      )}
      <div className="row-wrap">
        <button type="button" className="btn-secondary btn-sm" onClick={() => api.handleRakuma(order.id)}>Đã xử lý</button>
        <a className="btn-link btn-link--tight" href={order.link} target="_blank" rel="noopener noreferrer">Mở trên Rakuma</a>
      </div>
    </article>
  );
}

const initial = (o, open) => ({
  productId: '', source: 'REGULAR', qty: '1', price: String(o.price), discount: o.discount ? String(o.discount) : '',
  date: o.date && o.date >= open.start && o.date <= open.end ? o.date : '', note: `Rakuma ${o.orderNo} · ${o.title}`,
});

function ApproveCard({ order }) {
  const { store, api } = useApp();
  const [form, setForm] = useState(() => initial(order, store.openPeriod));
  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState([]);
  const id = k => `rk-${order.id}-${k}`;

  const set = patch => { setForm(f => ({ ...f, ...patch })); setWarnings([]); setErrors({}); };
  const on = k => e => set({ [k]: e.target.value });
  // Changing qty splits the order totals into per-unit figures when they divide evenly
  const onQty = e => {
    const q = Number(e.target.value);
    const patch = { qty: e.target.value };
    if (q >= 1 && Number.isInteger(q) && order.price % q === 0) {
      patch.price = String(order.price / q);
      patch.discount = order.discount ? String(Math.floor(order.discount / q)) : '';
    }
    set(patch);
  };
  const save = async force => {
    const res = await api.approveRakuma(order.id, form, force);
    if (!res.ok) { setErrors(res.errors || {}); setWarnings(res.warnings || (res.error && !res.errors ? [res.error] : [])); }
  };

  const price = Number(form.price), qty = Number(form.qty), disc = form.discount === '' ? 0 : Number(form.discount);
  const total = (price - disc) * qty;
  const paid = order.price - order.discount;
  const valid = form.price !== '' && price > 0 && qty >= 1 && disc >= 0 && disc <= price;

  return (
    <form className="card" noValidate aria-label={`Duyệt đơn ${order.orderNo}`} onSubmit={e => { e.preventDefault(); save(false); }}>
      <OrderHead order={order} />
      {order.date && !form.date && (
        <p className="note">Ngày đặt {fmtDate(order.date)} nằm ngoài kỳ đang mở {store.openPeriod.label}, nên ô Ngày đặt để trống. Dòng nhập vẫn ghi vào kỳ {store.openPeriod.label}.</p>
      )}
      <div className="form-grid">
        <Field id={id('product')} label="Sản phẩm *" error={errors.productId}>
          <select {...invalidProps(id('product'), errors.productId)} className="input" value={form.productId} onChange={on('productId')}>
            <option value="">Chọn sản phẩm</option>
            {store.activeProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field id={id('source')} label="Nguồn">
          <select id={id('source')} className="input" value={form.source} onChange={on('source')}>
            <option value="REGULAR">Nhập hàng</option>
            <option value="BULK">Nhập lô lớn</option>
          </select>
        </Field>
        <Field id={id('qty')} label="Số lượng *" error={errors.qty}>
          <input {...invalidProps(id('qty'), errors.qty)} type="number" inputMode="numeric" min="1" step="1" className="input" value={form.qty} onChange={onQty} />
        </Field>
        <Field id={id('price')} label="Giá nhập mỗi cái (¥) *" error={errors.price}>
          <input {...invalidProps(id('price'), errors.price)} type="number" inputMode="numeric" min="1" step="1" className="input" value={form.price} onChange={on('price')} />
        </Field>
        <Field id={id('discount')} label="Giảm giá mỗi cái (¥)" error={errors.discount}>
          <input {...invalidProps(id('discount'), errors.discount)} type="number" inputMode="numeric" min="0" step="1" className="input" value={form.discount} onChange={on('discount')} />
        </Field>
        <Field id={id('date')} label="Ngày đặt" error={errors.date}>
          <input {...invalidProps(id('date'), errors.date)} type="date" className="input" value={form.date} onChange={on('date')} />
        </Field>
        <Field id={id('note')} label="Ghi chú" full>
          <input id={id('note')} type="text" className="input" value={form.note} onChange={on('note')} />
        </Field>
      </div>
      <Warnings items={warnings} onForce={() => save(true)} forceLabel="Vẫn lưu dòng này" />
      <div className="form-foot">
        <p aria-live="polite" className="form-total">
          Tổng tiền: <strong>{valid ? yen(total) : '—'}</strong>
          {valid && total !== paid && <span className="text-danger"> · khác số đã trả trên Rakuma {yen(paid)}</span>}
        </p>
        <div className="row-wrap">
          <button type="button" className="btn-secondary" onClick={() => api.dismissRakuma(order.id, true)}>Bỏ qua</button>
          <button type="submit" className="btn-primary" disabled={!form.productId || !valid}>Lưu vào Nhập hàng</button>
        </div>
      </div>
      {order.link && <p className="caption">Link: {shortUrl(order.link)}</p>}
    </form>
  );
}

function DismissedRow({ order }) {
  const { api } = useApp();
  return (
    <div className="row-between">
      <p className="caption">{order.title} · {yen(order.price)} · Đơn {order.orderNo}</p>
      <button type="button" className="btn-link btn-link--tight" onClick={() => api.dismissRakuma(order.id, false)}>Đưa về hàng chờ</button>
    </div>
  );
}
