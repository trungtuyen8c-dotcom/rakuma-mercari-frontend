import { useEffect, useState } from 'react';
import { useApp } from '../../store/app-store';
import { yen, fmtDate } from '../../utils/format';
import Field, { invalidProps } from '../../components/Field';
import Warnings from '../../components/Warnings';
import './rakuma.css';

export const RATINGS = [['', 'Chưa đánh giá'], ['GOOD', 'Tốt'], ['NORMAL', 'Bình thường'], ['BAD', 'Không tốt']];

const queued = o => !o.purchaseId && !o.dismissed;
const pendingReplies = o => o.replies.filter(r => r.status === 'PENDING').length;
export const needsAttention = o => !!o.issueNote || o.newMessages > 0 || queued(o);

// Orders arrive from Claude's Rakuma sync (POST /rakuma/sync). The owner reads seller messages, writes replies in
// Vietnamese (Claude translates and posts them on the next sync), tracks problems, and turns queued orders into purchases.
export default function Rakuma() {
  const { store } = useApp();
  const [showOthers, setShowOthers] = useState(false);
  const orders = store.rakuma;
  const issues = orders.filter(o => o.issueNote);
  const chats = orders.filter(o => !o.issueNote && (o.newMessages > 0 || pendingReplies(o) > 0));
  const queue = orders.filter(o => !o.issueNote && !chats.includes(o) && queued(o));
  const others = orders.filter(o => !issues.includes(o) && !chats.includes(o) && !queue.includes(o));
  const lastSync = orders.reduce((a, o) => (o.syncedAt > a ? o.syncedAt : a), '');

  return (
    <section aria-label="Rakuma" className="page">
      <p className="caption">
        {lastSync ? <>Lần đồng bộ gần nhất: <strong>{lastSync}</strong> (giờ Nhật).</> : 'Chưa đồng bộ lần nào.'}
        {' '}Nhắn Claude “sync Rakuma” để cập nhật đơn mua, mã vận đơn, tin nhắn và gửi các câu trả lời đang chờ.
      </p>

      {issues.length > 0 && (
        <div className="stack-md">
          <h2 className="h-tile rk-h-issue">Cần xử lý <span className="rk-count rk-count--danger">{issues.length}</span></h2>
          {issues.map(o => <OrderCard key={o.id} order={o} />)}
        </div>
      )}

      <div className="stack-md">
        <h2 className="h-tile">Tin nhắn <span className="muted">· {chats.length}</span></h2>
        {chats.length === 0 && <p className="caption">Không có tin nhắn mới hay câu trả lời đang chờ gửi.</p>}
        {chats.map(o => <OrderCard key={o.id} order={o} />)}
      </div>

      <div className="stack-md">
        <h2 className="h-tile">Chờ duyệt <span className="muted">· {queue.length}</span></h2>
        {queue.length === 0 && <p className="caption">Không có đơn nào chờ duyệt.</p>}
        {queue.map(o => <OrderCard key={o.id} order={o} />)}
      </div>

      {others.length > 0 && (
        <div className="stack-md">
          <button type="button" className="btn-link btn-link--tight" aria-expanded={showOthers} onClick={() => setShowOthers(v => !v)}>
            {showOthers ? 'Ẩn' : 'Xem'} {others.length} đơn khác (đã nhập hoặc đã bỏ qua)
          </button>
          {showOthers && others.map(o => <OrderCard key={o.id} order={o} collapsed />)}
        </div>
      )}
    </section>
  );
}

function OrderCard({ order, collapsed }) {
  const [open, setOpen] = useState(!collapsed);
  const cls = 'card rk-card' + (order.issueNote ? ' rk-card--issue' : '');
  return (
    <article className={cls} aria-label={`Đơn Rakuma ${order.orderNo}`}>
      <OrderHead order={order} />
      {collapsed && (
        <button type="button" className="btn-link btn-link--tight" aria-expanded={open} onClick={() => setOpen(v => !v)}>
          {open ? 'Thu gọn' : 'Mở chi tiết'}
        </button>
      )}
      {open && (
        <>
          <IssuePanel order={order} />
          <Thread order={order} />
          {queued(order) && <ApproveForm order={order} />}
          {order.dismissed && <Restore order={order} />}
        </>
      )}
    </article>
  );
}

function OrderHead({ order }) {
  return (
    <div className="rk-head">
      {order.image
        ? <img className="rk-thumb" src={order.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
        : <div className="rk-thumb" aria-hidden="true" />}
      <div className="rk-head-text">
        <h3 className="rk-title">
          <a href={order.link} target="_blank" rel="noopener noreferrer">{order.title}</a>
        </h3>
        <p className="caption">
          {order.status || '—'} · Đặt {fmtDate(order.date)} · {yen(order.price)}
          {order.discount > 0 && ` − ${yen(order.discount)} coupon`}
        </p>
        <p className="caption">
          {order.seller || 'Người bán ?'} · Đơn {order.orderNo}
          {order.carrier && ` · ${order.carrier}`}
          {' · '}{order.tracking ? <>Vận đơn <strong>{order.tracking}</strong></> : 'Chưa có mã vận đơn'}
          {order.purchaseId && ' · Đã nhập'}
        </p>
        <p className="caption">
          <a href={order.link} target="_blank" rel="noopener noreferrer">Mở trang món</a>
        </p>
      </div>
    </div>
  );
}

// Seller rating + the owner's problem note. A non-empty note turns the whole card red and lists it under "Cần xử lý".
function IssuePanel({ order }) {
  const { api } = useApp();
  const [note, setNote] = useState(order.issueNote);
  useEffect(() => { setNote(order.issueNote); }, [order.issueNote]);
  const id = k => `rk-${order.id}-${k}`;
  const dirty = note.trim() !== order.issueNote;

  return (
    <div className={'rk-issue' + (order.issueNote ? ' rk-issue--open' : '')}>
      <div className="form-grid">
        <Field id={id('rating')} label="Đánh giá người bán">
          <select id={id('rating')} className="input" value={order.rating} onChange={e => api.updateRakuma(order.id, { rating: e.target.value })}>
            {RATINGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field id={id('issue')} label={order.issueNote ? 'Vấn đề đang mở' : 'Vấn đề cần giải quyết'} full>
          <textarea id={id('issue')} className="input rk-textarea" rows={2} value={note} onChange={e => setNote(e.target.value)}
            placeholder="Ví dụ: hộp bị móp, thiếu hàng, giao trễ… Ghi vào đây để đơn này nổi lên mục Cần xử lý." />
        </Field>
      </div>
      <div className="row-wrap">
        <button type="button" className="btn-secondary btn-sm" disabled={!dirty} onClick={() => api.updateRakuma(order.id, { issueNote: note })}>Lưu ghi chú</button>
        {order.issueNote && (
          <button type="button" className="btn-link btn-link--tight" onClick={() => api.updateRakuma(order.id, { issueNote: '' })}>Đã giải quyết</button>
        )}
      </div>
    </div>
  );
}

function Thread({ order }) {
  const { api } = useApp();
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const id = `rk-${order.id}-reply`;
  const send = async () => {
    const r = await api.replyRakuma(order.id, body);
    if (r.ok) { setBody(''); setError(''); } else setError(r.errors?.body || r.error);
  };
  const hasThread = order.messages.length > 0 || order.replies.length > 0;

  return (
    <div className="stack-md">
      {order.summary && <p className="rk-summary"><strong>Tóm tắt:</strong> {order.summary}</p>}
      {hasThread && (
        <ol className="rk-thread" aria-label="Tin nhắn giao dịch">
          {order.messages.map(m => (
            <li key={'m' + m.id} className={'rk-msg' + (m.from === 'buyer' ? ' rk-msg--me' : '') + (m.new ? ' rk-msg--new' : '')}>
              <p className="caption">{m.from === 'buyer' ? 'Bạn' : 'Người bán'}{m.at && ` · ${m.at}`}{m.new && ' · mới'}</p>
              <p className="rk-body">{m.body}</p>
            </li>
          ))}
          {order.replies.filter(r => r.status === 'PENDING').map(r => (
            <li key={'r' + r.id} className="rk-msg rk-msg--me rk-msg--pending">
              <p className="caption">Bạn · chờ Claude dịch và gửi</p>
              <p className="rk-body">{r.bodyVi}</p>
              <button type="button" className="btn-link btn-link--tight btn-link--danger" onClick={() => api.deleteRakumaReply(r.id)}>Hủy</button>
            </li>
          ))}
        </ol>
      )}
      {order.replies.some(r => r.status === 'SENT') && (
        <details className="rk-sent">
          <summary className="caption">Đã gửi {order.replies.filter(r => r.status === 'SENT').length} câu trả lời (xem bản tiếng Việt và tiếng Nhật)</summary>
          {order.replies.filter(r => r.status === 'SENT').map(r => (
            <div key={r.id} className="rk-sent-item">
              <p className="caption">{r.sentAt}</p>
              <p className="rk-body">{r.bodyVi}</p>
              <p className="rk-body muted">{r.bodyJa}</p>
            </div>
          ))}
        </details>
      )}
      <Field id={id} label="Trả lời người bán (viết tiếng Việt)" error={error}>
        <textarea {...invalidProps(id, error)} className="input rk-textarea" rows={2} value={body} onChange={e => { setBody(e.target.value); setError(''); }}
          placeholder="Claude sẽ dịch sang tiếng Nhật lịch sự và gửi vào khung chat của đơn này ở lần sync tới." />
      </Field>
      <div className="row-wrap">
        <button type="button" className="btn-primary btn-sm" disabled={!body.trim()} onClick={send}>Gửi trả lời</button>
        {order.newMessages > 0 && (
          <button type="button" className="btn-secondary btn-sm" onClick={() => api.handleRakuma(order.id)}>Đã đọc, không cần trả lời</button>
        )}
      </div>
    </div>
  );
}

const initial = (o, open) => ({
  productId: '', source: 'REGULAR', qty: '1', price: String(o.price), discount: o.discount ? String(o.discount) : '',
  date: o.date && o.date >= open.start && o.date <= open.end ? o.date : '', note: `Rakuma ${o.orderNo} · ${o.title}`,
});

function ApproveForm({ order }) {
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
    <form className="rk-approve" noValidate aria-label={`Duyệt đơn ${order.orderNo}`} onSubmit={e => { e.preventDefault(); save(false); }}>
      <h4 className="label">Đưa vào Nhập hàng</h4>
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
    </form>
  );
}

function Restore({ order }) {
  const { api } = useApp();
  return (
    <div className="row-wrap">
      <p className="caption">Đơn này đã bỏ qua, không đưa vào Nhập hàng.</p>
      <button type="button" className="btn-link btn-link--tight" onClick={() => api.dismissRakuma(order.id, false)}>Đưa về hàng chờ</button>
    </div>
  );
}
