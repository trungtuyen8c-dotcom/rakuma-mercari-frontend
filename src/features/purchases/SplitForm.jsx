import { useState } from 'react';
import { yen } from '../../utils/format';
import { invalidProps } from '../../components/Field';

const emptyLine = () => ({ productId: '', qty: '1', price: '' });

// Splits a combined order ("đơn gộp") into one row per product, like the owner's sheet: the first row keeps the link,
// the others share the tracking number. The lines must add up to the order total, which does not change.
export default function SplitForm({ row, store, api, onClose }) {
  const [lines, setLines] = useState(() => [{ ...emptyLine(), productId: row.noProduct ? '' : row.productId }, emptyLine()]);
  const [errors, setErrors] = useState({});
  const set = (i, k) => e => {
    const v = e.target.value;
    setLines(ls => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
    setErrors({});
  };
  const lineTotal = l => (Number(l.qty) > 0 && Number(l.price) > 0 ? Number(l.qty) * Number(l.price) : 0);
  const sum = lines.reduce((n, l) => n + lineTotal(l), 0);
  const left = row.total - sum;
  const filled = lines.every(l => l.productId && lineTotal(l) > 0);

  const save = async () => {
    const res = await api.splitPurchase(row.id, lines);
    if (res.ok) onClose();
    else setErrors(res.errors || { lines: res.error });
  };

  return (
    <form onSubmit={e => { e.preventDefault(); save(); }} noValidate aria-labelledby="split-h" className="card card--lg">
      <div className="form-head">
        <h2 id="split-h" className="h-tile">{`Tách đơn gộp · dòng ${row.stt} · kỳ ${row.periodLabel}`}</h2>
        <p className="caption">Mỗi sản phẩm một dòng, giá là giá mỗi cái. Dòng đầu giữ link, các dòng sau chung mã vận đơn và đánh dấu gộp. Tổng phải bằng tổng đơn {yen(row.total)}.</p>
      </div>
      <div className="split-lines">
        {lines.map((l, i) => {
          const id = k => `split-${i}-${k}`;
          const err = k => errors[`lines.${i}.${k}`];
          return (
            <div key={i} role="group" aria-label={`Sản phẩm ${i + 1}`} className="split-line">
              <select {...invalidProps(id('productId'), err('productId'))} aria-label={`Sản phẩm ${i + 1}`} className="input" value={l.productId} onChange={set(i, 'productId')}>
                <option value="">Chọn sản phẩm</option>
                {store.activeProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input {...invalidProps(id('qty'), err('qty'))} aria-label={`Số lượng sản phẩm ${i + 1}`} type="number" min="1" inputMode="numeric" className="input" value={l.qty} onChange={set(i, 'qty')} />
              <input {...invalidProps(id('price'), err('price'))} aria-label={`Giá mỗi cái sản phẩm ${i + 1} (¥)`} type="number" min="1" inputMode="numeric" className="input" placeholder="Giá mỗi cái ¥" value={l.price} onChange={set(i, 'price')} />
              <span className="split-total">{lineTotal(l) ? yen(lineTotal(l)) : '—'}</span>
              {lines.length > 2
                ? <button type="button" className="btn-link btn-link--tight btn-link--danger" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))} aria-label={`Bỏ sản phẩm ${i + 1}`}>Bỏ</button>
                : <span />}
              {['productId', 'qty', 'price'].map(k => err(k) && <p key={k} id={id(k) + '-err'} className="text-danger split-err">{err(k)}</p>)}
            </div>
          );
        })}
        <button type="button" className="btn-link btn-link--tight" onClick={() => setLines(ls => [...ls, emptyLine()])}>+ Thêm sản phẩm</button>
      </div>
      {errors.lines && <p role="alert" className="text-danger">{errors.lines}</p>}
      <div className="form-foot">
        <p aria-live="polite" className="form-total">
          Đã chia <strong>{yen(sum)}</strong> / {yen(row.total)}
          {left !== 0 && <span className={left < 0 ? 'neg' : 'dim'}>{` · ${left > 0 ? 'còn thiếu' : 'thừa'} ${yen(Math.abs(left))}`}</span>}
        </p>
        <div className="row-wrap">
          <button type="button" className="btn-secondary" onClick={onClose}>Đóng</button>
          <button type="submit" className="btn-primary" disabled={!filled || left !== 0}>Lưu {lines.length} dòng</button>
        </div>
      </div>
    </form>
  );
}
