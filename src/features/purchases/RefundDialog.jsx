import { useState } from 'react';
import { yen, fmtDate } from '../../utils/format';
import Field, { invalidProps } from '../../components/Field';
import Warnings from '../../components/Warnings';

const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

// Refund of a purchase paid by card. While waiting, a note sits next to the row; when the money is back on the card,
// "Ghi hoàn tiền" books it on that day. A full refund removes the row (the goods are not coming) and the card ledger
// keeps both the charge and the refund, as the card statement shows them.
export default function RefundDialog({ row, api, onClose }) {
  const [note, setNote] = useState(row.refundNote);
  const [f, setF] = useState({ date: today(), amount: String(row.total), note: row.refundNote, removeRow: true });
  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState([]);
  const full = Number(f.amount) === row.total;
  const set = k => e => { const v = k === 'removeRow' ? e.target.checked : e.target.value; setF(x => ({ ...x, [k]: v })); setErrors({}); setWarnings([]); };

  const saveNote = async v => { const r = await api.setRefundNote(row.id, v); if (r.ok) onClose(); else setErrors(r.errors || { note: r.error }); };
  const book = async force => {
    const r = await api.recordRefund(row.id, { ...f, removeRow: full && f.removeRow }, force);
    if (r.ok) onClose();
    else { setErrors(r.errors || {}); setWarnings(r.warnings || []); }
  };

  return (
    <div className="card card--lg">
      <div className="form-head">
        <h2 className="h-tile">{`Hoàn tiền · dòng ${row.stt} · kỳ ${row.periodLabel}`}</h2>
        <p className="caption">{row.productName} · {yen(row.total)} · thẻ {row.cardName} · trừ ngày {fmtDate(row.chargeDate)}</p>
      </div>

      <section aria-labelledby="rf-wait-h" className="stack-md">
        <h3 id="rf-wait-h" className="label">Đang chờ hoàn tiền</h3>
        <Field id="rf-wait" label="Ghi chú (lý do, ngày hẹn hoàn…)" error={errors.note && !errors.amount ? errors.note : undefined}>
          <textarea {...invalidProps('rf-wait', errors.note)} className="input rk-textarea" rows={2} value={note} onChange={e => setNote(e.target.value)}
            placeholder="Ví dụ: Shop huỷ đơn 10/10, Rakuma hoàn trong 3-5 ngày" />
        </Field>
        <div className="row-wrap">
          <button type="button" className="btn-secondary btn-sm" disabled={!note.trim() || note.trim() === row.refundNote} onClick={() => saveNote(note)}>Lưu ghi chú chờ hoàn</button>
          {row.refundNote && <button type="button" className="btn-link btn-link--tight" onClick={() => saveNote('')}>Bỏ ghi chú</button>}
        </div>
      </section>

      <form onSubmit={e => { e.preventDefault(); book(false); }} noValidate aria-labelledby="rf-book-h" className="stack-md rf-book">
        <h3 id="rf-book-h" className="label">Tiền đã về thẻ {row.cardName}</h3>
        <div className="form-grid">
          <Field id="rf-date" label="Ngày tiền về" error={errors.date}>
            <input {...invalidProps('rf-date', errors.date)} type="date" className="input" value={f.date} onChange={set('date')} />
          </Field>
          <Field id="rf-amount" label="Số tiền hoàn (¥)" error={errors.amount}>
            <input {...invalidProps('rf-amount', errors.amount)} type="number" inputMode="numeric" min="1" max={row.total} className="input" value={f.amount} onChange={set('amount')} />
          </Field>
          <Field id="rf-note" label="Ghi chú hoàn tiền" full>
            <input id="rf-note" type="text" className="input" value={f.note} onChange={set('note')} />
          </Field>
        </div>
        <label className="check">
          <input type="checkbox" className="checkbox" checked={full && f.removeRow} disabled={!full} onChange={set('removeRow')} />
          <span>{full ? 'Xoá dòng nhập này (hàng không về): bỏ khỏi tiền nhập và tồn kho' : 'Hoàn một phần: dòng nhập giữ nguyên'}</span>
        </label>
        {errors.card && <p role="alert" className="alert-inline">{errors.card}</p>}
        <Warnings items={warnings} onForce={() => book(true)} forceLabel="Vẫn ghi hoàn tiền" />
        <div className="form-foot">
          <p className="caption">Sổ thẻ giữ khoản trừ ngày {fmtDate(row.chargeDate)} và thêm khoản hoàn ngày {fmtDate(f.date)}.</p>
          <div className="row-wrap">
            <button type="button" className="btn-secondary" onClick={onClose}>Đóng</button>
            <button type="submit" className="btn-primary" disabled={!f.amount}>Ghi hoàn tiền</button>
          </div>
        </div>
      </form>
    </div>
  );
}
