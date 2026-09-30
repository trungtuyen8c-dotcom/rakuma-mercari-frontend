import { useState } from 'react';
import { useApp } from '../../store/app-store';
import { yen, qtyText, periodStatusText } from '../../utils/format';
import './dashboard.css';

export default function Dashboard() {
  const { store } = useApp();
  const [pid, setPid] = useState('');
  // Closed periods are recomputed from that month's raw rows
  const st = store.statsFor(pid || store.openPeriod.id), p = st.period, t = st.totals, isOpen = p.status === 'OPEN';
  const idx = store.periods.findIndex(x => x.id === p.id), prev = idx > 0 ? store.periods[idx - 1] : null;
  const stockUnits = qtyText(t.stockTotal);

  return (
    <>
      <section aria-labelledby="dash-total-h" className="dash-hero">
        <div className="wrap dash-hero-inner">
          <div className="dash-hero-head">
            <div className="stack-xxs" style={{ gap: 'var(--s-xs)' }}>
              <h2 id="dash-total-h" className="h-tile">{isOpen ? 'Tổng cộng từ đầu' : `Tổng cộng đến hết tháng ${p.label}`}</h2>
              <p className="dash-hero-sub">
                {isOpen ? `Kỳ trước + tháng ${p.label} (đang mở)` : `Tháng ${p.label} đã chốt · ${st.matches ? 'số tính lại khớp số chốt' : 'số tính lại LỆCH số chốt, cần kiểm tra'}`}
              </p>
            </div>
            <div className="field">
              <label htmlFor="dash-period" className="dash-hero-sub" style={{ lineHeight: 1.47 }}>Xem theo tháng</label>
              <select id="dash-period" className="dash-period" value={p.id} onChange={e => setPid(e.target.value)}>
                {[...store.periods].reverse().map(x => <option key={x.id} value={x.id}>{`Tháng ${x.label} · ${periodStatusText(x)}`}</option>)}
              </select>
            </div>
          </div>
          <dl className="dash-kpis">
            <div><dt>Tổng vốn</dt><dd>{yen(t.totalCost)}</dd></div>
            <div><dt>Tổng doanh thu</dt><dd>{yen(t.totalRevenue)}</dd></div>
            <div><dt>Lợi nhuận</dt><dd>{yen(t.totalProfit)}</dd></div>
          </dl>
          <p className="dash-hero-sub" style={{ maxWidth: 720 }}>
            Lợi nhuận đang tính theo dòng tiền: Tổng doanh thu − Tổng vốn. Tiền mua {stockUnits} món {isOpen ? 'còn trong kho' : `tồn cuối tháng ${p.label}`} cũng đã bị trừ.{' '}
            <a href="#inventory" style={{ color: 'var(--c-primary-on-dark)' }}>Xem tồn kho</a>
          </p>
        </div>
      </section>

      <section aria-label="Chi tiết theo kỳ" className="dash-detail">
        <div className="wrap dash-grid">
          <article aria-labelledby="dash-prev-h" className="card">
            <div className="stack-xxs">
              <h2 id="dash-prev-h" className="h-tile">{prev ? `Kỳ trước (${prev.label})` : 'Kỳ trước'}</h2>
              <p className="caption">{prev ? `Số chốt cuối tháng ${prev.label}` : 'Số đầu kỳ chuyển từ file Excel'}</p>
            </div>
            <dl className="dl-rows">
              <div><dt>Vốn</dt><dd>{yen(t.prevCost)}</dd></div>
              <div><dt>Doanh thu</dt><dd>{yen(t.prevRevenue)}</dd></div>
              <div><dt className="strong">Lợi nhuận</dt><dd className="strong">{yen(t.prevProfit)}</dd></div>
            </dl>
          </article>

          <article aria-labelledby="dash-cur-h" className="card">
            <div className="stack-xxs">
              <h2 id="dash-cur-h" className="h-tile">{`Trong tháng ${p.label}`}</h2>
              <p className="caption">Chỉ tính dòng nhập và bán của tháng này</p>
            </div>
            <dl className="dl-rows">
              <div><dt>Tiền nhập hàng</dt><dd>{yen(t.periodCost)}</dd></div>
              <div><dt>Tiền bán hàng</dt><dd>{yen(t.periodRevenue)}</dd></div>
              <div><dt className="strong">Chênh lệch</dt><dd className="strong">{yen(t.periodProfit)}</dd></div>
            </dl>
            <p className="caption" style={{ letterSpacing: 'inherit' }}>{t.salesCount} đơn bán trong tháng</p>
          </article>

          <article aria-labelledby="dash-stock-h" className="card">
            <h2 id="dash-stock-h" className="h-tile">{isOpen ? 'SL còn tồn kho' : `SL tồn cuối tháng ${p.label}`}</h2>
            <p className="dash-stock">{stockUnits} <span>món</span></p>
            {st.negatives.length > 0 && (
              <div role="alert" className="alert alert--tight">
                {st.negatives.map(n => (
                  <p key={n.productId} className="text-danger">{`Sản phẩm “${n.name}” ${isOpen ? 'đang' : 'cuối tháng'} âm ${Math.abs(n.current)} cái.`}</p>
                ))}
              </div>
            )}
            <a href="#inventory" style={{ fontSize: 14 }}>Xem tồn kho theo sản phẩm</a>
          </article>
        </div>
      </section>
    </>
  );
}
