import { useState } from 'react';
import { useApp } from '../../store/app-store';
import { yen, fmtDate, qtyText } from '../../utils/format';
import './analysis.css';

export default function Analysis() {
  const { store } = useApp();
  const [sel, setSel] = useState('');
  const def = store.products.find(p => p.name === '30th Celebration') || store.products[0];
  const pid = sel || (def && def.id);
  const sales = store.sales.filter(r => r.productId === pid);
  const purs = store.purchases.filter(r => r.productId === pid);
  const soldQty = sales.reduce((a, r) => a + r.qty, 0), soldAmt = sales.reduce((a, r) => a + r.total, 0);
  const inQty = purs.reduce((a, r) => a + r.qty, 0), inAmt = purs.reduce((a, r) => a + r.total, 0);

  // BR-15 LIFO: walk from the newest purchase back until the sold quantity is covered; the last lot is taken partially
  let need = soldQty, cogs = 0;
  const lots = [];
  for (let i = purs.length - 1; i >= 0 && need > 0; i--) {
    const r = purs[i], take = Math.min(need, r.qty), unit = r.price - (r.discount || 0);
    cogs += take * unit;
    need -= take;
    lots.push({ id: r.id, date: r.date, ref: `${r.periodLabel} · ${r.stt}`, unit, qty: r.qty, take, cost: take * unit });
  }
  const avg = v => (soldQty ? yen(v / soldQty) : '—');
  const profit = soldAmt - cogs;
  const metrics = [
    ['SL đã bán', `${qtyText(soldQty)} món`], ['Tiền bán', yen(soldAmt)],
    ['SL đã nhập', `${qtyText(inQty)} món`], ['Tiền nhập', yen(inAmt)],
    ['Giá vốn hàng đã bán', yen(cogs)], ['Giá vốn TB mỗi món', avg(cogs)],
    ['Giá bán TB mỗi món', avg(soldAmt)], ['Tổng lãi', yen(profit)], ['Lãi TB mỗi món', avg(profit)],
  ];

  return (
    <section aria-label="Phân tích sản phẩm" className="page">
      <div className="row-between" style={{ alignItems: 'flex-end', gap: 'var(--s-md)' }}>
        <div className="field" style={{ flex: '0 1 320px' }}>
          <label htmlFor="an-product" className="label">Sản phẩm</label>
          <select id="an-product" className="pill" style={{ width: '100%', fontSize: 17 }} value={pid} onChange={e => setSel(e.target.value)}>
            {store.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <p className="caption" style={{ maxWidth: 520 }}>Tính trên toàn bộ dữ liệu mọi kỳ. Giá vốn lấy từ các lần nhập gần nhất trước (LIFO), lô cuối chỉ lấy phần cần dùng.</p>
      </div>

      <dl className="an-metrics">
        {metrics.map(([label, value]) => (
          <div key={label} className="card" style={{ gap: 'var(--s-xs)' }}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {need > 0 && (
        <p role="alert" className="alert-inline">{`Đã bán nhiều hơn số đã nhập ${need} món. Phần này chưa có giá vốn (tính là 0¥), kiểm tra lại tồn đầu kỳ hoặc dòng nhập còn thiếu.`}</p>
      )}

      <div className="stack-md">
        <h2 className="h-tile">Các lần nhập dùng để tính giá vốn</h2>
        {lots.length > 0 ? (
          <div role="region" aria-label="Bảng lô tính giá vốn" tabIndex={0} className="table-wrap">
            <table className="table" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th scope="col">Ngày đặt</th>
                  <th scope="col">Kỳ · STT</th>
                  <th scope="col" className="r">Giá sau giảm</th>
                  <th scope="col" className="r">SL nhập</th>
                  <th scope="col" className="r">SL tính vốn</th>
                  <th scope="col" className="r">Giá vốn</th>
                </tr>
              </thead>
              <tbody>
                {lots.map(l => (
                  <tr key={l.id}>
                    <td className="nw">{fmtDate(l.date)}</td>
                    <td className="nw">{l.ref}</td>
                    <td className="r">{yen(l.unit)}</td>
                    <td className="r">{l.qty}</td>
                    <td className="r b">{l.take}</td>
                    <td className="r">{yen(l.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="caption">Sản phẩm này chưa bán món nào nên chưa có giá vốn.</p>
        )}
      </div>
    </section>
  );
}
