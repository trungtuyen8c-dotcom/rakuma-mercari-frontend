import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../store/app-store';
import { yen, fmtDate } from '../../utils/format';
import './cards.css';

const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const jstToday = () => new Date(Date.now() + 9 * 3600e3);
const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

// First day of the day/week/month a date falls in; weeks run Monday to Sunday (same as the server's totals).
function bucket(date, group) {
  const d = new Date(date + 'T00:00:00Z');
  if (group === 'week') d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  if (group === 'month') d.setUTCDate(1);
  return iso(d);
}
function label(start, group) {
  const d = new Date(start + 'T00:00:00Z');
  if (group === 'month') return `Tháng ${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  if (group === 'week') { const e = new Date(d); e.setUTCDate(e.getUTCDate() + 6); return `Tuần ${fmtDate(start).slice(0, 5)} – ${fmtDate(iso(e)).slice(0, 5)}`; }
  return `${DOW[d.getUTCDay()]} ${fmtDate(start)}`;
}

// Card ledger for checking against the card statement: this project's charges on each shared card, added up per
// day, week or month. It reads the same ledger the order project adds into the card balance, so the numbers match.
export default function CardLedger() {
  const { store, api } = useApp();
  const today = jstToday();
  const [q, setQ] = useState({ from: iso(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))), to: iso(today), card: 'all', group: 'day' });
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const set = k => e => { const v = e.target.value; setQ(x => ({ ...x, [k]: v })); setOpen(null); };

  useEffect(() => {
    let live = true;
    const wallet = q.card === 'all' ? '' : q.card;
    api.cardLedger({ from: q.from, to: q.to, wallet }).then(r => {
      if (!live) return;
      if (r.ok) { setRows(Array.isArray(r.data) ? r.data : []); setError(''); } else setError(r.error || 'Không tải được sổ thẻ.');
    });
    return () => { live = false; };
  }, [api, q.from, q.to, q.card, store.purchases]);

  const groups = useMemo(() => {
    const out = new Map();
    (rows || []).forEach(r => {
      const start = bucket(r.date, q.group), k = start + '|' + r.wallet;
      const g = out.get(k) || { key: k, start, wallet: r.wallet, count: 0, amount: 0, charged: 0, refunded: 0, rows: [] };
      g.count++; g.amount += r.amount; g.rows.push(r);
      if (r.amount < 0) g.charged -= r.amount; else g.refunded += r.amount;
      out.set(k, g);
    });
    return [...out.values()].sort((a, b) => a.start.localeCompare(b.start) || a.wallet.localeCompare(b.wallet));
  }, [rows, q.group]);
  const perCard = useMemo(() => {
    const m = {};
    (rows || []).forEach(r => { m[r.wallet] = (m[r.wallet] || 0) + r.amount; });
    return Object.entries(m).sort();
  }, [rows]);
  const waiting = store.purchases.filter(r => r.refundNote && r.cardId !== '0');
  const cardByName = Object.fromEntries(store.cards.map(c => [c.name, c]));
  const checked = Object.fromEntries(store.cardReconciliations.map(x => [x.cardId + '|' + x.month, x]));
  const noCard = store.purchases.filter(r => r.cardId === '0' && r.date && r.date >= q.from && r.date <= q.to).length;

  const download = () => {
    const esc = v => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [['id', 'wallet', 'currency', 'project', 'date', 'amount', 'category', 'note'].join(',')]
      .concat((rows || []).map(r => [r.id, r.wallet, r.currency, r.project, r.date, r.amount, r.category, r.note].map(esc).join(',')));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = `so-the-${q.card === 'all' ? 'tat-ca' : q.card}-${q.from}-${q.to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section aria-label="Sổ thẻ" className="page">
      <p className="caption">
        Tiền đã trừ từng thẻ từ các dòng nhập có ghi thẻ, tính theo ngày đặt. Đem tổng ngày, tuần hoặc tháng so với sao kê thẻ.
        Thẻ dùng chung với hệ thống order và yahoo: số dư thật = số dư đầu kỳ (bên order) + tiền trừ của cả 3 dự án.
      </p>
      <div role="group" aria-label="Bộ lọc sổ thẻ" className="row-wrap">
        <label className="cl-field"><span className="caption">Từ</span><input type="date" className="pill" value={q.from} onChange={set('from')} /></label>
        <label className="cl-field"><span className="caption">Đến</span><input type="date" className="pill" value={q.to} onChange={set('to')} /></label>
        <select aria-label="Thẻ" className="pill" value={q.card} onChange={set('card')}>
          <option value="all">Mọi thẻ</option>
          {store.cards.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <div role="radiogroup" aria-label="Cộng theo" className="cl-seg">
          {[['day', 'Ngày'], ['week', 'Tuần'], ['month', 'Tháng']].map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={q.group === v} className={'cl-seg-btn' + (q.group === v ? ' is-on' : '')}
              onClick={() => { setQ(x => ({ ...x, group: v })); setOpen(null); }}>{l}</button>
          ))}
        </div>
        <button type="button" className="btn-secondary btn-sm" disabled={!rows?.length} onClick={download}>Tải CSV</button>
      </div>

      {store.cards.length === 0 && <p className="note">Chưa có thẻ nào. Thêm thẻ ở <a href="#settings" className="link-inline">Cài đặt</a>, rồi chọn thẻ cho dòng nhập.</p>}
      {noCard > 0 && (
        <p className="alert-inline">{noCard} dòng nhập trong khoảng này chưa ghi thẻ nên chưa tính vào sổ. <a href="#purchases" className="link-inline">Mở Nhập hàng</a> (lọc Thẻ: Chưa ghi thẻ).</p>
      )}
      {error && <p role="alert" className="alert-inline">{error}</p>}

      {waiting.length > 0 && (
        <div className="note stack-md" style={{ gap: 'var(--s-xs)' }}>
          <p className="b" style={{ margin: 0 }}>Đang chờ hoàn tiền về thẻ: {waiting.length} đơn · {yen(waiting.reduce((n, r) => n + r.total, 0))}</p>
          <ul className="cl-wait">
            {waiting.map(r => (
              <li key={r.id}><strong>{r.cardName}</strong> · {yen(r.total)} · {r.productName} (kỳ {r.periodLabel} dòng {r.stt}) · {r.refundNote}</li>
            ))}
          </ul>
          <p className="caption" style={{ margin: 0 }}>Tiền về rồi thì mở <a href="#purchases" className="link-inline">Nhập hàng</a>, bấm “Hoàn tiền” ở dòng đó.</p>
        </div>
      )}

      {perCard.length > 0 && (
        <dl className="cl-totals" aria-label="Tổng trong khoảng">
          {perCard.map(([w, a]) => <div key={w}><dt>{w}</dt><dd>{yen(-a)}</dd></div>)}
        </dl>
      )}

      <div role="region" aria-label="Bảng sổ thẻ" tabIndex={0} className="table-wrap">
        <table className="table" style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <th scope="col">{q.group === 'day' ? 'Ngày' : q.group === 'week' ? 'Tuần' : 'Tháng'}</th>
              <th scope="col">Thẻ</th>
              <th scope="col" className="r">Số dòng</th>
              <th scope="col" className="r">Trừ</th>
              <th scope="col" className="r">Hoàn</th>
              <th scope="col" className="r">Còn trừ</th>
              {q.group === 'month' && <th scope="col">Đối soát sao kê</th>}
              <th scope="col" className="r"><span className="sr-only">Chi tiết</span></th>
            </tr>
          </thead>
          <tbody>
            {groups.map(g => (
              <GroupRows key={g.key} g={g} group={q.group} open={open === g.key} onToggle={() => setOpen(o => (o === g.key ? null : g.key))}
                card={cardByName[g.wallet]} check={checked[(cardByName[g.wallet] || {}).id + '|' + g.start.slice(0, 7)]} api={api} />
            ))}
          </tbody>
        </table>
      </div>
      {rows && groups.length === 0 && <p className="caption">Không có khoản trừ thẻ nào trong khoảng này.</p>}
    </section>
  );
}

function GroupRows({ g, group, open, onToggle, card, check, api }) {
  const month = g.start.slice(0, 7);
  const removeRefund = async id => {
    if (!window.confirm('Xoá khoản hoàn tiền này? Nếu dòng nhập đã bị xoá khi hoàn, khoản trừ của nó cũng bị xoá khỏi sổ thẻ.')) return;
    const r = await api.deleteRefund(id);
    if (r.warnings?.length && window.confirm(r.warnings.join('\n') + '\n\nVẫn xoá?')) api.deleteRefund(id, true);
  };
  return <>
    <tr>
      <td className="nw b">{label(g.start, group)}</td>
      <td>{g.wallet}</td>
      <td className="r">{g.count}</td>
      <td className="r nw">{yen(g.charged)}</td>
      <td className="r nw">{g.refunded ? yen(g.refunded) : '—'}</td>
      <td className="r nw b">{yen(-g.amount)}</td>
      {group === 'month' && (
        <td className="cl-check">
          {check && check.amount === g.amount && <span className="cl-ok">Đã đối soát {check.at.slice(0, 10)}</span>}
          {check && check.amount !== g.amount && (
            <span className="cl-bad">Đổi sau đối soát: {yen(-check.amount)} → {yen(-g.amount)}</span>
          )}
          {card && (!check || check.amount !== g.amount) && (
            <button type="button" className="btn-link btn-link--tight" onClick={() => api.reconcile(card.id, month)}>{check ? 'Đối soát lại' : 'Đánh dấu đã khớp sao kê'}</button>
          )}
          {card && check && <button type="button" className="btn-link btn-link--tight" onClick={() => api.unreconcile(card.id, month)}>Bỏ</button>}
        </td>
      )}
      <td className="act nw">
        <button type="button" className="btn-link btn-link--tight" aria-expanded={open} onClick={onToggle}>{open ? 'Ẩn' : 'Xem dòng'}</button>
      </td>
    </tr>
    {open && g.rows.map(r => (
      <tr key={r.id} className="cl-detail">
        <td className="nw dim">{fmtDate(r.date)}</td>
        <td colSpan={2} className="cl-note">{r.category === 'Hoàn tiền' ? <strong>Hoàn tiền · </strong> : null}{r.note}</td>
        <td className="r nw">{r.amount < 0 ? yen(-r.amount) : ''}</td>
        <td className="r nw">{r.amount > 0 ? yen(r.amount) : ''}</td>
        <td />
        {group === 'month' && <td />}
        <td className="act nw">
          {/^rakuma:refund:\d+$/.test(r.id) && <button type="button" className="btn-link btn-link--tight btn-link--danger" onClick={() => removeRefund(r.id.split(':')[2])}>Xoá hoàn</button>}
        </td>
      </tr>
    ))}
  </>;
}
