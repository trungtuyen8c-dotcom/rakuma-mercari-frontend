import { Fragment, useDeferredValue, useEffect, useRef, useState } from 'react';
import { useApp } from '../../store/app-store';
import { yen, fmtDate } from '../../utils/format';
import Field, { invalidProps } from '../../components/Field';
import Warnings from '../../components/Warnings';
import PeriodField from '../../components/PeriodField';
import './rakuma.css';
import { guessProduct, guessQty, orderGaps, awaitingReceipt, hoursToPay, payDueSoon, slowShipping, shipWaitDays, SLOW_SHIP_DAYS, current, shippedOrDone, transactionUrl } from './guess';

export const RATINGS = [['', 'Chưa đánh giá'], ['GOOD', 'Tốt'], ['NORMAL', 'Bình thường'], ['BAD', 'Không tốt']];

const queued = o => !o.purchaseId && !o.dismissed;
const pendingReplies = o => o.replies.filter(r => r.status === 'PENDING').length;
// Unfinished order that no longer appears in the Rakuma purchase lists (cancelled, payment expired): check it on Rakuma
const missing = o => !!o.missingSince;
const unpaid = o => o.status.startsWith('支払い');
const problem = o => !!o.issueNote || missing(o);
// For the menu badge: orders the latest sync did not read (gone from Rakuma, or another account) do not count
export const needsAttention = (o, lastSync) => problem(o) || current(o, lastSync) && (o.newMessages > 0 || queued(o));

// Orders arrive from Claude's Rakuma sync (POST /rakuma/sync). The owner reads seller messages, writes replies in
// Vietnamese (Claude translates and posts them on the next sync), tracks problems, and turns queued orders into purchases.
// Owner's after-purchase steps, as in the Excel sheet: goods arrive OK (purchase "Đã kiểm") -> seller rated -> done.
export const progress = (o, index) => {
  const p = o.purchaseId ? index.byId[o.purchaseId] || null : null;
  return { purchase: p, received: !!p?.checked, rated: !!o.rating, done: !!p?.checked && !!o.rating && !o.issueNote };
};

const FILTERS = [
  ['all', 'Tất cả (theo mục)'],
  ['unreceived', 'Chưa kiểm hàng'],
  ['unrated', 'Chưa đánh giá'],
  ['issue', 'Có vấn đề'],
  ['missing', 'Mất khỏi Rakuma'],
  ['unpaid', 'Chưa thanh toán'],
  ['paydue', 'Sắp hết hạn thanh toán'],
  ['receive', 'Đã giao, chưa nhận hàng'],
  ['slowship', 'Shop chậm gửi hàng'],
  ['notracking', 'Đã gửi, chưa có mã vận đơn'],
  ['noinfo', 'Thiếu tên hoặc giá'],
  ['queue', 'Chờ duyệt'],
  ['unmatched', 'Chưa ghép dòng nhập'],
  ['skipped', 'Đã bỏ qua'],
  ['skippedshipped', 'Đã bỏ qua nhưng có vận đơn / đã giao'],
  ['done', 'Hoàn tất'],
  ['closed', 'Chat đã đóng'],
];

const matchFilter = (o, f, index, lastSync) => {
  const g = progress(o, index);
  switch (f) {
    case 'unreceived': return !!o.purchaseId && !g.received;
    case 'unrated': return !o.dismissed && !g.rated;
    case 'issue': return !!o.issueNote;
    case 'missing': return missing(o);
    case 'unpaid': return unpaid(o);
    case 'paydue': return payDueSoon(o, lastSync);
    case 'receive': return awaitingReceipt(o, lastSync);
    case 'slowship': return slowShipping(o, lastSync);
    case 'notracking': return orderGaps(o).noTracking;
    case 'noinfo': { const gap = orderGaps(o); return gap.noTitle || gap.noPrice; }
    case 'queue': return queued(o);
    case 'unmatched': return !o.purchaseId && !o.dismissed;
    case 'skipped': return o.dismissed && !o.purchaseId;
    case 'skippedshipped': return o.dismissed && !o.purchaseId && shippedOrDone(o);
    case 'done': return g.done;
    case 'closed': return !o.chatOpen;
    default: return true;
  }
};

const matchText = (o, q) => !q || [o.title, o.seller, o.orderNo, o.tracking, o.issueNote, o.link, ...o.messages.map(m => m.body)]
  .some(v => (v || '').toLowerCase().includes(q));

export default function Rakuma() {
  const { store } = useApp();
  const [showOthers, setShowOthers] = useState(false);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  // the list follows the search box a beat later, so typing stays smooth with many orders
  const q = useDeferredValue(query).trim().toLowerCase();
  const filtering = filter !== 'all' || query.trim() !== '';
  const orders = store.rakuma;
  const alerts = store.alerts;
  const { lastSync } = alerts;
  const found = filtering ? orders.filter(o => matchFilter(o, filter, store.purchaseIndex, lastSync) && matchText(o, q)) : [];
  const issues = orders.filter(problem);
  // A reply still waiting to be sent keeps its chat listed; otherwise only orders the latest sync read
  const chats = orders.filter(o => !problem(o) && !o.dismissed && (pendingReplies(o) > 0 || o.newMessages > 0 && current(o, lastSync)));
  const inChats = new Set(chats);
  const queue = orders.filter(o => !problem(o) && !inChats.has(o) && queued(o) && current(o, lastSync));
  const stale = orders.filter(o => !o.dismissed && !current(o, lastSync) && !inChats.has(o) && !problem(o) && (o.newMessages > 0 || queued(o))).length;
  const listed = new Set([...issues, ...chats, ...queue, ...alerts.skipped]);
  const others = orders.filter(o => !listed.has(o));

  return (
    <section aria-label="Rakuma" className="page">
      <p className="caption">
        {lastSync ? <>Lần đồng bộ gần nhất: <strong>{lastSync}</strong> (giờ Nhật).</> : 'Chưa đồng bộ lần nào.'}
        {' '}Bấm “Đồng bộ lên Sổ kho” trên extension Rakuma để cập nhật đơn mua, mã vận đơn và tin nhắn.
        {stale > 0 && <> {stale} đơn không có trong lần đồng bộ này (đã xong, đã huỷ hoặc thuộc tài khoản Rakuma khác) nên không hiện trong các mục dưới; xem bằng bộ lọc.</>}
      </p>

      <div role="search" aria-label="Lọc đơn Rakuma" className="row-wrap">
        <input type="search" aria-label="Tìm đơn" className="pill pill--search" placeholder="Tìm tên món, shop, mã đơn, vận đơn, ghi chú…" value={query} onChange={e => setQuery(e.target.value)} />
        <select aria-label="Trạng thái" className="pill" value={filter} onChange={e => setFilter(e.target.value)}>
          {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {filtering && <button type="button" className="btn-link btn-link--tight" onClick={() => { setFilter('all'); setQuery(''); }}>Xóa lọc</button>}
      </div>

      {filtering && (
        <div className="stack-md">
          <p className="caption"><strong>{found.length} đơn</strong> khớp bộ lọc.</p>
          <Capped items={found} render={o => <OrderCard key={o.id} order={o} collapsed />} />
        </div>
      )}

      {!filtering && <>

      <TodoSections alerts={alerts} />

      {issues.length > 0 && (
        <div className="stack-md">
          <h2 className="h-tile rk-h-issue">Cần xử lý <span className="rk-count rk-count--danger">{issues.length}</span></h2>
          {issues.map(o => <OrderCard key={o.id} order={o} />)}
        </div>
      )}

      <div className="stack-md">
        <h2 className="h-tile">Tin nhắn <span className="muted">· {chats.length}</span></h2>
        {chats.length === 0 && <p className="caption">Không có tin nhắn mới hay câu trả lời đang chờ gửi.</p>}
        <Capped items={chats} render={o => <ChatCard key={o.id} order={o} />} />
      </div>

      <div className="stack-md">
        <h2 className="h-tile">Chờ duyệt <span className="muted">· {queue.length}</span></h2>
        <p className="caption">Đơn đã thanh toán tự vào Nhập hàng khi đồng bộ (tên chưa rõ thì để trống). Ở đây chỉ còn đơn chưa thanh toán hoặc không tự nhập được.</p>
        {queue.length === 0 && <p className="caption">Không có đơn nào chờ duyệt.</p>}
        <Capped items={queue} render={o => <OrderCard key={o.id} order={o} collapsed />} />
      </div>

      <Broadcast orders={orders} />

      <div className="stack-md">
        <h2 className="h-tile">Đã bỏ qua <span className="muted">· {alerts.skipped.length}</span>
          {alerts.skippedShipped.length > 0 && <span className="rk-count rk-count--danger" title="Có vận đơn hoặc đã giao/nhận">{alerts.skippedShipped.length} có vận đơn</span>}
        </h2>
        <p className="caption">Đơn không đưa vào Nhập hàng, kèm lúc nào, ai bỏ qua và lý do. “Khôi phục” đưa về hàng chờ (hoặc nối luôn vào dòng nhập cùng link); “Tạo dòng nhập hàng” ghi đơn vào Nhập hàng.</p>
        {alerts.skipped.length === 0 && <p className="caption">Không có đơn nào bị bỏ qua.</p>}
        <Capped items={alerts.skipped} render={o => <OrderCard key={o.id} order={o} collapsed />} />
      </div>

      {others.length > 0 && (
        <div className="stack-md">
          <button type="button" className="btn-link btn-link--tight" aria-expanded={showOthers} onClick={() => setShowOthers(v => !v)}>
            {showOthers ? 'Ẩn' : 'Xem'} {others.length} đơn khác (đã nhập)
          </button>
          {showOthers && <Capped items={others} render={o => <OrderCard key={o.id} order={o} collapsed />} />}
        </div>
      )}
      </>}
    </section>
  );
}

// Long lists show the first 20 cards and add more on demand, so the screen opens fast with hundreds of orders.
const PAGE = 20;
function Capped({ items, render }) {
  const [n, setN] = useState(PAGE);
  return <>
    {items.slice(0, n).map(render)}
    {items.length > n && (
      <button type="button" className="btn-secondary btn-sm rk-more" onClick={() => setN(v => v + PAGE)}>
        Xem thêm {Math.min(PAGE, items.length - n)} đơn (còn {items.length - n})
      </button>
    )}
  </>;
}

function OrderCard({ order, collapsed }) {
  const [open, setOpen] = useState(!collapsed);
  const cls = 'card rk-card' + (problem(order) ? ' rk-card--issue' : '');
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

// BR-05/06: a queued order whose link or tracking number is already on a purchase row was probably entered by hand;
// an approved one shows its row's own duplicate flags (merged shipments are not flagged). null = no duplicate.
const duplicates = (o, index, purchase) => {
  if (purchase) return { link: purchase.dupLink ? [] : null, tracking: purchase.dupTracking ? [] : null };
  return { link: index.byLink[o.link] || null, tracking: o.tracking ? index.byTracking[o.tracking] || null : null };
};

const rowRefs = rows => rows.length ? ` (dòng ${rows.map(r => `${r.stt} kỳ ${r.periodLabel}`).join(', ')})` : '';

function OrderHead({ order }) {
  const { store } = useApp();
  const g = progress(order, store.purchaseIndex);
  const dup = duplicates(order, store.purchaseIndex, g.purchase);
  const gap = orderGaps(order);
  return (
    <div className="rk-head">
      {order.image
        ? <img className="rk-thumb" src={order.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
        : <div className="rk-thumb" aria-hidden="true" />}
      <div className="rk-head-text">
        <h3 className="rk-title">
          <a href={order.link} target="_blank" rel="noopener noreferrer">{order.title || 'Chưa đọc được tên món'}</a>
        </h3>
        {(dup.link || dup.tracking || missing(order) || unpaid(order) || gap.noTitle || gap.noPrice || gap.noTracking) && (
          <p className="rk-steps">
            {gap.noTitle && <span className="rk-step rk-step--dup">Thiếu tên món</span>}
            {gap.noPrice && <span className="rk-step rk-step--dup">Thiếu giá</span>}
            {gap.noTracking && <span className="rk-step rk-step--dup">Đã gửi, chưa có mã vận đơn</span>}
            {missing(order) && <span className="rk-step rk-step--dup">Không còn trên Rakuma từ {order.missingSince}, kiểm tra xem bị huỷ hay hết hạn</span>}
            {unpaid(order) && <span className="rk-step rk-step--dup">Chưa thanh toán</span>}
            {dup.link && <span className="rk-step rk-step--dup">Trùng link{rowRefs(dup.link)}</span>}
            {dup.tracking && <span className="rk-step rk-step--dup">Trùng vận đơn{rowRefs(dup.tracking)}</span>}
          </p>
        )}
        <p className="caption">
          {order.status || '—'} · Đặt {fmtDate(order.date)} · {order.price ? yen(order.price) : 'Chưa đọc được giá'}
          {order.discount > 0 && ` − ${yen(order.discount)} coupon`}
        </p>
        <p className="caption">
          {order.seller || 'Người bán ?'} · Đơn {order.orderNo}
          {order.carrier && ` · ${order.carrier}`}
          {' · '}{order.tracking ? <>Vận đơn <strong>{order.tracking}</strong></> : 'Chưa có mã vận đơn'}
          {order.purchaseId && ' · Đã nhập'}
          {!order.chatOpen && ' · Chat đã đóng'}
        </p>
        {order.purchaseId && (
          <p className="rk-steps">
            <span className={'rk-step' + (g.received ? ' rk-step--on' : '')}>{g.received ? 'Hàng OK' : 'Chưa kiểm hàng'}</span>
            <span className={'rk-step' + (g.rated ? ' rk-step--on' : '')}>{g.rated ? 'Đã đánh giá' : 'Chưa đánh giá'}</span>
            {g.done && <span className="rk-step rk-step--done">Done</span>}
          </p>
        )}
        <p className="caption">
          <a href={order.link} target="_blank" rel="noopener noreferrer">Mở trang món</a>
        </p>
      </div>
    </div>
  );
}

// Seller rating + the owner's problem note. A non-empty note turns the whole card red and lists it under "Cần xử lý".
function IssuePanel({ order }) {
  const { store, api } = useApp();
  const { purchase } = progress(order, store.purchaseIndex);
  const [note, setNote] = useState(order.issueNote);
  useEffect(() => { setNote(order.issueNote); }, [order.issueNote]);
  const id = k => `rk-${order.id}-${k}`;
  const dirty = note.trim() !== order.issueNote;

  return (
    <div className={'rk-issue' + (order.issueNote ? ' rk-issue--open' : '')}>
      {purchase && (
        <label className="check">
          <input type="checkbox" className="checkbox" checked={purchase.checked} disabled={purchase.locked}
            onChange={() => api.togglePurchase(purchase.id, 'checked', !purchase.checked)} />
          <span>Hàng đã về, kiểm OK (cột “Đã kiểm” ở Nhập hàng)</span>
        </label>
      )}
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

// A short to-do list of orders: one line each (shop, item, detail) with the action that clears it.
function ActionList({ title, note, label, orders, detail, action }) {
  return (
    <div className="stack-md">
      <h2 className="h-tile rk-h-issue">{title} <span className="rk-count rk-count--danger">{orders.length}</span></h2>
      {note && <p className="caption">{note}</p>}
      <ul className="rk-receive" aria-label={label}>
        {orders.map(o => (
          <li key={o.id}>
            <strong>{o.seller || 'Người bán ?'}</strong>
            <span className="rk-receive-title">{o.title || o.orderNo}</span>
            <span className="caption">{detail(o)}</span>
            {action(o)}
          </li>
        ))}
      </ul>
    </div>
  );
}

const leftText = h => (h < 0 ? `quá hạn ${Math.ceil(-h)} giờ` : h < 1 ? `còn ${Math.max(1, Math.round(h * 60))} phút` : `còn ${Math.floor(h)} giờ`);

function TodoSections({ alerts }) {
  const open = o => <a href={transactionUrl(o.link)} target="_blank" rel="noopener noreferrer">{'Mở giao dịch ↗'}</a>;
  return <>
    {alerts.payDue.length > 0 && (
      <ActionList title="Sắp hết hạn thanh toán" label="Đơn sắp hết hạn thanh toán" orders={alerts.payDue}
        note="Quá hạn thì đơn bị huỷ và có thể bị đánh giá xấu."
        detail={o => `${o.price ? yen(o.price) : ''} · ${leftText(hoursToPay(o))}`} action={open} />
    )}
    {alerts.toReceive.length > 0 && (
      <ActionList title="Đã giao tới, chưa bấm nhận hàng" label="Đơn đã giao, chưa nhận hàng" orders={alerts.toReceive}
        note="Kiểm hàng xong thì bấm 受取評価 (nhận hàng và đánh giá) trên Rakuma. Đồng bộ lần sau đơn tự biến khỏi danh sách."
        detail={o => o.status.replace(/^商品の受取\s*/, '')} action={open} />
    )}
    {alerts.notShipped.length > 0 && (
      <ActionList title={`Shop chưa gửi hàng${alerts.slowShip.length ? ` · ${alerts.slowShip.length} chậm` : ''}`} label="Đơn shop chưa gửi hàng" orders={alerts.notShipped}
        note={`Đã thanh toán mà shop chưa báo gửi hàng, chờ lâu nhất ở trên. Từ ${SLOW_SHIP_DAYS} ngày trở lên là chậm. Bấm “Mở giao dịch” để xem và nhắn shop ngay trên Rakuma.`}
        detail={o => { const d = shipWaitDays(o); return <>Thanh toán {fmtDate(o.date)} · {d < 1 ? 'hôm nay' : `chờ ${d} ngày`}{d >= SLOW_SHIP_DAYS && <strong className="neg"> · chậm</strong>}</>; }}
        action={open} />
    )}
  </>;
}

// Inbox card for the "Tin nhắn" list: shop, item link and the new messages only, so many chats read fast. Older
// messages open on demand; rating, problems and the purchase stay on the full card (filters, other sections).
function ChatCard({ order }) {
  const { api } = useApp();
  const [all, setAll] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const seller = order.seller || 'Người bán';
  const msgs = order.messages;
  const firstNew = msgs.findIndex(m => m.new);
  // the unread messages plus the one before them for context; the last 3 when nothing is unread
  const start = all ? 0 : Math.max(0, firstNew >= 0 ? firstNew - 1 : msgs.length - 3);
  const pending = order.replies.filter(r => r.status === 'PENDING');
  const id = `rk-${order.id}-reply`;
  const send = async () => {
    const r = await api.replyRakuma(order.id, body);
    if (r.ok) { setBody(''); setError(''); } else setError(r.errors?.body || r.error);
  };

  return (
    <article className="card rk-inbox" aria-label={`Đơn Rakuma ${order.orderNo}`}>
      <header className="rk-inbox-head">
        <strong className="rk-inbox-shop">{seller}</strong>
        {order.newMessages > 0 && <span className="rk-inbox-badge">{order.newMessages} mới</span>}
        <a className="rk-inbox-link" href={order.link} target="_blank" rel="noopener noreferrer" title={order.title}>{order.title || 'Mở trang món'} ↗</a>
      </header>
      <section aria-label={`Tin nhắn với ${seller}`}>
        {start > 0 && <button type="button" className="btn-link btn-link--tight" onClick={() => setAll(true)}>Xem {start} tin cũ hơn</button>}
        <ol className="rk-inbox-msgs">
          {msgs.slice(start).map((m, i) => {
            const me = m.from === 'buyer';
            return (
              <Fragment key={m.id}>
                {start + i === firstNew && <li className="rk-chat-divider"><span>Tin mới</span></li>}
                <li className={'rk-inbox-msg' + (me ? ' rk-inbox-msg--me' : '') + (m.new ? ' rk-inbox-msg--new' : '')}>
                  <span className="rk-inbox-who">{me ? 'Bạn' : 'Shop'} · {m.at}</span>
                  <p className="rk-inbox-text">{m.body}</p>
                </li>
              </Fragment>
            );
          })}
          {pending.map(r => (
            <li key={'r' + r.id} className="rk-inbox-msg rk-inbox-msg--me rk-inbox-msg--pending">
              <span className="rk-inbox-who">
                Bạn · {r.bodyJa ? 'đã dịch, gửi bằng extension' : 'chờ dịch (/rk-dich)'} ·{' '}
                <button type="button" className="btn-link btn-link--tight btn-link--danger" onClick={() => api.deleteRakumaReply(r.id)}>Hủy</button>
              </span>
              <p className="rk-inbox-text">{r.bodyVi}</p>
              {r.bodyJa && <p className="rk-inbox-text" lang="ja">{r.bodyJa}</p>}
            </li>
          ))}
        </ol>
      </section>
      {order.chatOpen ? (
        <div className="rk-inbox-reply">
          <label htmlFor={id} className="sr-only">Trả lời người bán (viết tiếng Việt)</label>
          <textarea {...invalidProps(id, error)} className="input rk-textarea" rows={1} value={body} placeholder="Trả lời bằng tiếng Việt…"
            onChange={e => { setBody(e.target.value); setError(''); }} />
          <button type="button" className="btn-primary btn-sm" disabled={!body.trim()} onClick={send}>Gửi trả lời</button>
          {order.newMessages > 0 && <button type="button" className="btn-secondary btn-sm" onClick={() => api.handleRakuma(order.id)}>Đã đọc</button>}
          {error && <p id={id + '-err'} className="text-danger">{error}</p>}
        </div>
      ) : <p className="caption">Chat đã đóng trên Rakuma.</p>}
    </article>
  );
}

// "2026/10/06 15:56" -> day "06/10/2026" and time "15:56"
const splitAt = at => { const m = (at || '').match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{1,2}:\d{2})/); return m ? { day: `${m[3]}/${m[2]}/${m[1]}`, time: m[4] } : { day: '', time: at || '' }; };

// Chat with the seller, laid out like a messenger: seller on the left, you on the right, a day divider when the date
// changes, a "Tin mới" divider before the first unread seller message, and replies still waiting to be sent at the end.
function ChatPanel({ order, onCancelReply }) {
  const scroller = useRef(null);
  const pending = order.replies.filter(r => r.status === 'PENDING');
  const firstNew = order.messages.findIndex(m => m.new);
  const seller = order.seller || 'Người bán';
  useEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight; }, [order.messages.length, pending.length]);

  let lastDay = '';
  return (
    <section className="rk-chat" aria-label={`Tin nhắn với ${seller}`}>
      <header className="rk-chat-head">
        <span className="rk-avatar" aria-hidden="true">{seller.slice(0, 1)}</span>
        <span className="rk-chat-name">{seller}</span>
        <span className="rk-chat-meta">{order.messages.length} tin{order.newMessages > 0 && <> · <strong className="rk-new-count">{order.newMessages} mới</strong></>}{!order.chatOpen && ' · chat đã đóng'}</span>
      </header>
      <ol ref={scroller} className="rk-chat-body" tabIndex={0} aria-label="Tin nhắn giao dịch">
        {order.messages.map((m, i) => {
          const { day, time } = splitAt(m.at);
          const showDay = day && day !== lastDay;
          if (day) lastDay = day;
          const me = m.from === 'buyer';
          return (
            <Fragment key={'m' + m.id}>
              {showDay && <li className="rk-chat-day" aria-hidden="true"><span>{day}</span></li>}
              {i === firstNew && <li className="rk-chat-divider"><span>Tin mới</span></li>}
              <li className={'rk-bubble-row' + (me ? ' rk-bubble-row--me' : '')}>
                <div className={'rk-bubble' + (me ? ' rk-bubble--me' : '') + (m.new ? ' rk-bubble--new' : '')}>
                  <span className="sr-only">{me ? 'Bạn' : seller}{day && `, ${day}`}: </span>
                  <p className="rk-bubble-text">{m.body}</p>
                  <span className="rk-bubble-time">{time}{m.new && <span className="rk-bubble-new"> · mới</span>}</span>
                </div>
              </li>
            </Fragment>
          );
        })}
        {pending.map(r => (
          <li key={'r' + r.id} className="rk-bubble-row rk-bubble-row--me">
            <div className="rk-bubble rk-bubble--pending">
              <p className="rk-bubble-text">{r.bodyVi}</p>
              {r.bodyJa && <p className="rk-bubble-text rk-bubble-ja" lang="ja">{r.bodyJa}</p>}
              <span className="rk-bubble-time">
                {r.kind === 'BROADCAST' ? 'Hỏi hàng loạt · ' : ''}{r.bodyJa ? 'Đã dịch, gửi bằng extension' : 'Chờ dịch (/rk-dich)'} ·{' '}
                <button type="button" className="btn-link btn-link--tight btn-link--danger" onClick={() => onCancelReply(r.id)}>Hủy</button>
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
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
  const done = order.replies.filter(r => r.status !== 'PENDING');

  return (
    <div className="stack-md">
      {order.summary && <p className="rk-summary"><strong>Tóm tắt:</strong> {order.summary}</p>}
      {hasThread && <ChatPanel order={order} onCancelReply={api.deleteRakumaReply} />}
      {done.length > 0 && (
        <details className="rk-sent">
          <summary className="caption">Đã xử lý {done.length} câu trả lời (xem bản tiếng Việt và tiếng Nhật)</summary>
          {done.map(r => (
            <div key={r.id} className="rk-sent-item">
              <p className="caption">{r.sentAt} · {r.status === 'SENT' ? 'Đã gửi' : <span className="text-danger">Không gửi được: {r.reason}</span>}</p>
              <p className="rk-body">{r.bodyVi}</p>
              {r.bodyJa && <p className="rk-body muted">{r.bodyJa}</p>}
            </div>
          ))}
        </details>
      )}
      {!order.chatOpen && <p className="note">Rakuma đã đóng chat của đơn này, không gửi tin được nữa.</p>}
      {order.chatOpen && (<>
      <Field id={id} label="Trả lời người bán (viết tiếng Việt)" error={error}>
        <textarea {...invalidProps(id, error)} className="input rk-textarea" rows={2} value={body} onChange={e => { setBody(e.target.value); setError(''); }}
          placeholder="Viết tiếng Việt. Claude dịch sang tiếng Nhật (/rk-dich), rồi bạn gửi bằng extension Rakuma → Sổ kho." />
      </Field>
      <div className="row-wrap">
        <button type="button" className="btn-primary btn-sm" disabled={!body.trim()} onClick={send}>Gửi trả lời</button>
        {order.newMessages > 0 && (
          <button type="button" className="btn-secondary btn-sm" onClick={() => api.handleRakuma(order.id)}>Đã đọc, không cần trả lời</button>
        )}
      </div>
      </>)}
    </div>
  );
}

const inOpen = (date, opens) => !!date && opens.some(p => date >= p.start && date <= p.end);

// Product from the owner's keywords and quantity from "4BOX"-style titles; the lump price is split per unit only when
// it divides evenly, otherwise the price is left empty for the owner
const initial = (o, opens, guess) => {
  const qty = guess.qty || 1;
  const price = !o.price ? '' : qty === 1 ? String(o.price) : o.price % qty === 0 ? String(o.price / qty) : '';
  const discount = !o.discount ? '' : String(qty === 1 ? o.discount : Math.floor(o.discount / qty));
  return {
    periodId: '', productId: guess.product ? guess.product.product.id : '', source: 'REGULAR', qty: String(qty), price, discount,
    date: inOpen(o.date, opens) ? o.date : '', note: o.title ? `Rakuma ${o.orderNo} · ${o.title}` : `Rakuma ${o.orderNo}`,
  };
};

function ApproveForm({ order }) {
  const { store, api } = useApp();
  const [guess] = useState(() => ({ product: guessProduct(order.title, store.activeProducts), qty: guessQty(order.title) }));
  const [form, setForm] = useState(() => initial(order, store.openPeriods, guess));
  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState([]);
  const [skipping, setSkipping] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const id = k => `rk-${order.id}-${k}`;

  const set = patch => { setForm(f => ({ ...f, ...patch })); setWarnings([]); setErrors({}); };
  const on = k => e => set({ [k]: e.target.value });
  // Changing qty splits the order totals into per-unit figures when they divide evenly
  const onQty = e => {
    const q = Number(e.target.value);
    const patch = { qty: e.target.value };
    if (q >= 1 && Number.isInteger(q) && order.price > 0 && order.price % q === 0) {
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
      {(guess.product || guess.qty) && (
        <p className="caption">
          {guess.product && `Tự chọn “${guess.product.product.name}” theo từ khóa trong tên món. `}
          {guess.qty && `Tên món ghi ${guess.qty} hộp: tự đặt số lượng ${guess.qty}${order.price && order.price % guess.qty !== 0 ? ', giá chia không chẵn nên để trống, bạn điền giá mỗi cái' : ' và chia giá mỗi cái'}. `}
          Kiểm tra lại trước khi lưu.
        </p>
      )}
      {!guess.product && <p className="caption">Chưa nhận ra sản phẩm. Chọn tay, hoặc thêm từ khóa cho sản phẩm ở màn Sản phẩm để lần sau tự chọn.</p>}
      {order.date && !form.date && (
        <p className="note">Ngày đặt {fmtDate(order.date)} không thuộc kỳ nào đang mở ({store.openPeriods.map(p => p.label).join(', ')}), nên ô Ngày đặt để trống. Dòng nhập sẽ ghi vào kỳ {store.openPeriod.label} nếu bạn không chọn kỳ khác.</p>
      )}
      <div className="form-grid">
        <PeriodField id={id('period')} store={store} value={form.periodId} onChange={on('periodId')} error={errors.periodId} />
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
      {skipping && (
        <div className="row-wrap" role="group" aria-label="Bỏ qua đơn này">
          <input type="text" className="input" aria-label="Lý do bỏ qua" placeholder="Lý do (không bắt buộc): đơn huỷ, trùng dòng nhập tay…"
            value={skipReason} onChange={e => setSkipReason(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
          <button type="button" className="btn-secondary" onClick={() => api.dismissRakuma(order.id, true, skipReason)}>Xác nhận bỏ qua</button>
        </div>
      )}
      <div className="form-foot">
        <p aria-live="polite" className="form-total">
          Tổng tiền: <strong>{valid ? yen(total) : '—'}</strong>
          {valid && order.price > 0 && total !== paid && <span className="text-danger"> · khác số đã trả trên Rakuma {yen(paid)}</span>}
        </p>
        <div className="row-wrap">
          {!order.dismissed && <button type="button" className="btn-secondary" aria-expanded={skipping} onClick={() => setSkipping(v => !v)}>Bỏ qua</button>}
          <button type="submit" className="btn-primary" disabled={!form.productId || !valid}>Lưu vào Nhập hàng</button>
        </div>
      </div>
    </form>
  );
}

const KIND = { manual: 'Bấm Bỏ qua', row_deleted: 'Xoá dòng nhập', refund_removed: 'Hoàn tiền rồi xoá dòng', unknown: 'Không rõ' };

// A skipped order: why it is not in Nhập hàng, and the way back
function Restore({ order }) {
  const { api } = useApp();
  const [making, setMaking] = useState(false);
  return (
    <div className="stack-md" style={{ gap: 'var(--s-xs)' }}>
      <p className={'caption' + (shippedOrDone(order) ? ' text-danger' : '')}>
        <strong>Đã bỏ qua</strong>{order.dismissedAt && <> lúc {order.dismissedAt}</>}{order.dismissedBy && <> bởi {order.dismissedBy}</>}
        {' · '}{KIND[order.dismissKind] || 'Không rõ'}: {order.dismissReason || '—'}
        {shippedOrDone(order) && <> · <strong>đơn có vận đơn hoặc đã giao/nhận, có thể thiếu trong Nhập hàng</strong></>}
      </p>
      <div className="row-wrap">
        <button type="button" className="btn-secondary btn-sm" onClick={() => api.dismissRakuma(order.id, false)}>Khôi phục</button>
        <button type="button" className="btn-primary btn-sm" aria-expanded={making} onClick={() => setMaking(v => !v)}>Tạo dòng nhập hàng</button>
      </div>
      {making && <ApproveForm order={order} />}
    </div>
  );
}

// One message to many sellers. Only orders whose chat is still open are listed, one per seller (the latest order),
// so a shop with several orders is asked once.
function Broadcast({ orders }) {
  const { api } = useApp();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const bySeller = new Map();
  orders.filter(o => o.chatOpen).forEach(o => {
    const key = o.seller || o.id;
    const cur = bySeller.get(key);
    if (!cur || (o.date || '') > (cur.date || '')) bySeller.set(key, o);
  });
  const targets = [...bySeller.values()];
  const waiting = orders.reduce((n, o) => n + o.replies.filter(r => r.kind === 'BROADCAST' && r.status === 'PENDING').length, 0);
  const toggle = id => setPicked(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allPicked = targets.length > 0 && targets.every(o => picked.has(o.id));
  const send = async () => {
    const r = await api.broadcastRakuma([...picked], body);
    if (r.ok) { setPicked(new Set()); setBody(''); setError(''); setOpen(false); } else setError(r.errors?.body || r.errors?.orderIds || r.error);
  };

  return (
    <div className="stack-md">
      <h2 className="h-tile">Hỏi hàng nhiều shop <span className="muted">· {targets.length} shop còn mở chat</span></h2>
      <p className="caption">
        Gửi một câu hỏi tới các shop bạn đã mua. Chỉ hiện đơn còn mở chat, mỗi shop một lần. Claude dịch và thêm tên shop, tên món (/rk-dich); bạn gửi từng tin bằng extension, nên cách nhau vài phút và mỗi ngày chỉ vài shop để tránh bị coi là spam.
        {waiting > 0 && <> Đang chờ gửi: <strong>{waiting} tin</strong>.</>}
      </p>
      {!open && <button type="button" className="btn-secondary btn-sm" disabled={!targets.length} onClick={() => setOpen(true)}>Chọn shop để hỏi</button>}
      {open && (
        <div className="card">
          <p className="note">Rakuma cấm dùng tin nhắn giao dịch cho việc ngoài giao dịch. Gửi hàng loạt có thể bị coi là spam và khóa tài khoản. Chỉ chọn shop bạn thật sự muốn hỏi.</p>
          <label className="check">
            <input type="checkbox" className="checkbox" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(targets.map(o => o.id)))} />
            <span>Chọn tất cả ({targets.length})</span>
          </label>
          <ul className="rk-pick">
            {targets.map(o => (
              <li key={o.id}>
                <label className="check">
                  <input type="checkbox" className="checkbox" checked={picked.has(o.id)} onChange={() => toggle(o.id)} />
                  <span><strong>{o.seller || 'Người bán ?'}</strong> · {o.title} · {fmtDate(o.date)}</span>
                </label>
              </li>
            ))}
          </ul>
          <Field id="rk-bc-body" label="Tin nhắn (viết tiếng Việt)" error={error}>
            <textarea {...invalidProps('rk-bc-body', error)} className="input rk-textarea" rows={3} value={body} onChange={e => { setBody(e.target.value); setError(''); }}
              placeholder="Ví dụ: Shop còn món này không? Mình muốn mua thêm 5 hộp." />
          </Field>
          <div className="row-wrap">
            <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(false)}>Đóng</button>
            <button type="button" className="btn-primary btn-sm" disabled={!picked.size || !body.trim()} onClick={send}>Xếp hàng gửi cho {picked.size} shop</button>
          </div>
        </div>
      )}
    </div>
  );
}
