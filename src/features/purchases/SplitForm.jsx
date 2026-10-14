import { useState } from 'react';
import { yen } from '../../utils/format';
import { invalidProps } from '../../components/Field';
import { spreadDiscount } from './spread';

const emptyLine = () => ({ productId: '', qty: '1', price: '', discount: '' });

// Splits a combined order ("đơn gộp") into one row per product, like the owner's sheet: the first row keeps the link,
// the others share the tracking number. The lines must add up to the order total, which does not change.
export default function SplitForm({ row, store, api, onClose }) {
  const [lines, setLines] = useState(() => [{ ...emptyLine(), productId: row.noProduct ? '' : row.productId }, emptyLine()]);
  const [errors, setErrors] = useState({});
  const [orderDiscount, setOrderDiscount] = useState(() => (row.discount ? String(row.discount * row.qty) : ''));
  const [spreadErr, setSpreadErr] = useState('');
  const set = (i, k) => e => {
    const v = e.target.value;
    setLines(ls => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
    setErrors({});
  };
  const lineTotal = l => (Number(l.qty) > 0 && Number(l.price) > 0 ? Number(l.qty) * (Number(l.price) - Number(l.discount || 0)) : 0);
  const priced = lines.every(l => Number(l.qty) >= 1 && Number(l.price) > 0);
  // Order-wide discount -> whole-yen discount per item on each line, adding up exactly
  const spread = () => {
    const per = spreadDiscount(lines.map(l => ({ qty: Number(l.qty), price: Number(l.price) })), Number(orderDiscount || 0));
    if (!per) { setSpreadErr('Không chia được cho khớp: thêm một dòng số lượng 1 hoặc nhập giảm giá từng dòng.'); return; }
    setLines(ls => ls.map((l, i) => ({ ...l, discount: per[i] ? String(per[i]) : '' })));
    setSpreadErr(''); setErrors({});
  };
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
        <p className="caption">Mỗi sản phẩm một dòng: giá gốc mỗi cái và giảm giá mỗi cái. Dòng đầu giữ link, các dòng sau chung mã vận đơn và đánh dấu gộp. Tổng phải bằng tổng đơn {yen(row.total)} (số đã trừ thẻ).</p>
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
              <input {...invalidProps(id('discount'), err('discount'))} aria-label={`Giảm giá mỗi cái sản phẩm ${i + 1} (¥)`} type="number" min="0" inputMode="numeric" className="input" placeholder="Giảm/cái ¥" value={l.discount} onChange={set(i, 'discount')} />
              <span className="split-total">{lineTotal(l) ? yen(lineTotal(l)) : '—'}</span>
              {lines.length > 2
                ? <button type="button" className="btn-link btn-link--tight btn-link--danger" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))} aria-label={`Bỏ sản phẩm ${i + 1}`}>Bỏ</button>
                : <span />}
              {['productId', 'qty', 'price', 'discount'].map(k => err(k) && <p key={k} id={id(k) + '-err'} className="text-danger split-err">{err(k)}</p>)}
            </div>
          );
        })}
        <button type="button" className="btn-link btn-link--tight" onClick={() => setLines(ls => [...ls, emptyLine()])}>+ Thêm sản phẩm</button>
      </div>
      <div role="group" aria-label="Giảm giá cả đơn" className="row-wrap split-spread">
        <label htmlFor="split-order-discount" className="label">Giảm giá cả đơn (¥)</label>
        <input id="split-order-discount" type="number" min="0" inputMode="numeric" className="input" style={{ width: 140 }} value={orderDiscount}
          onChange={e => { setOrderDiscount(e.target.value); setSpreadErr(''); }} aria-describedby="split-spread-hint" />
        <button type="button" className="btn-secondary btn-sm" disabled={!priced || orderDiscount === ''} onClick={spread}>Chia giảm giá</button>
        <p id="split-spread-hint" className="caption" style={{ flexBasis: '100%', margin: 0 }}>
          Nhập giá gốc từng món rồi bấm “Chia giảm giá”: chia theo giá, phần lẻ dồn vào một món để tổng khớp đúng số trên thẻ. Sửa tay từng dòng vẫn được.
        </p>
        {spreadErr && <p role="alert" className="text-danger" style={{ flexBasis: '100%', margin: 0 }}>{spreadErr}</p>}
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
