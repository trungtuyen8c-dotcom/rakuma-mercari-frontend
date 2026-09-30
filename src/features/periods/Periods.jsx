import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../store/app-store';
import { yen, fmtDate, qtyText } from '../../utils/format';

export default function Periods() {
  const { store, api } = useApp();
  const [confirming, setConfirming] = useState(false);
  const confirmRef = useRef(null);
  const t = store.totals, o = store.openPeriod, neg = store.negatives;

  useEffect(() => {
    if (confirming) requestAnimationFrame(() => confirmRef.current && confirmRef.current.focus());
  }, [confirming]);

  const cost = yen(t.totalCost), revenue = yen(t.totalRevenue);
  const history = store.periods.map((p, i, all) => {
    const st = store.statsFor(p.id), nx = all[i + 1];
    const chain = !nx || (nx.openingCost === p.closingCost && nx.openingRevenue === p.closingRevenue);
    const ok = st.matches && chain, isOpen = p.status === 'OPEN';
    return { p, st, isOpen, ok };
  }).reverse();

  return (
    <section aria-label="Chốt kỳ" className="page page--narrow">
      <article aria-labelledby="per-open-h" className="card">
        <div className="stack-xxs">
          <h2 id="per-open-h" className="h-tile">Tháng {o.label} · Đang mở</h2>
          <p className="caption">{`${fmtDate(o.start)} – ${fmtDate(o.end)}`}</p>
        </div>
        <dl className="dl-rows">
          <div><dt>Tổng vốn hiện tại</dt><dd>{cost}</dd></div>
          <div><dt>Tổng doanh thu hiện tại</dt><dd>{revenue}</dd></div>
          <div><dt>SL còn tồn kho</dt><dd>{qtyText(t.stockTotal)} món</dd></div>
        </dl>
        {!confirming ? (
          <div className="row-wrap" style={{ alignItems: 'center', gap: 'var(--s-md)' }}>
            <button type="button" className="btn-primary" onClick={() => setConfirming(true)}>Chốt kỳ {o.label}</button>
            <p className="caption" style={{ letterSpacing: 'inherit' }}>Làm vào cuối tháng, sau khi đã ghi đủ nhập và bán.</p>
          </div>
        ) : (
          <div role="alertdialog" aria-labelledby="per-confirm-h" aria-describedby="per-confirm-d" className="note stack-md" style={{ padding: 'var(--s-md)', gap: 'var(--s-sm)' }}>
            <h3 id="per-confirm-h" style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Chốt kỳ {o.label}?</h3>
            <ul id="per-confirm-d" className="stack-xxs" style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.43 }}>
              <li>Vốn kỳ trước của kỳ {store.nextLabel} = {cost}; doanh thu kỳ trước = {revenue}.</li>
              <li>Tồn đầu kỳ {store.nextLabel} của từng sản phẩm = SL hiện tại.</li>
              <li>Dòng nhập và bán của kỳ {o.label} bị khóa, chỉ xem.</li>
            </ul>
            {neg.length > 0 && (
              <p className="text-danger">{`Lưu ý: ${neg.map(n => `“${n.name}” đang âm ${Math.abs(n.current)} cái`).join(', ')}. Số âm sẽ được chuyển sang tồn đầu kỳ mới.`}</p>
            )}
            <div className="row-wrap">
              <button type="button" ref={confirmRef} className="btn-primary" onClick={async () => { await api.closePeriod(o.label, t); setConfirming(false); }}>Xác nhận chốt</button>
              <button type="button" className="btn-secondary" style={{ background: 'transparent' }} onClick={() => setConfirming(false)}>Hủy</button>
            </div>
          </div>
        )}
      </article>

      <div className="stack-md">
        <div className="stack-xxs">
          <h2 className="h-tile">Lịch sử các tháng</h2>
          <p className="caption">Mỗi kỳ là một tháng dương lịch. Đối chiếu: vốn đầu kỳ + nhập trong tháng phải bằng vốn lúc chốt, và bằng vốn đầu kỳ của tháng sau.</p>
        </div>
        <div role="region" aria-label="Bảng lịch sử kỳ" tabIndex={0} className="table-wrap">
          <table className="table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th scope="col">Kỳ</th>
                <th scope="col">Trạng thái</th>
                <th scope="col" className="r">Vốn đầu kỳ</th>
                <th scope="col" className="r">Doanh thu đầu kỳ</th>
                <th scope="col" className="r">Nhập trong tháng</th>
                <th scope="col" className="r">Bán trong tháng</th>
                <th scope="col" className="r">Vốn lúc chốt</th>
                <th scope="col" className="r">Doanh thu lúc chốt</th>
                <th scope="col">Đối chiếu</th>
              </tr>
            </thead>
            <tbody>
              {history.map(({ p, st, isOpen, ok }) => (
                <tr key={p.id}>
                  <td><span className="b">{p.label}</span><br /><span className="dim">{`${fmtDate(p.start)} – ${fmtDate(p.end)}`}</span></td>
                  <td>{isOpen ? 'Đang mở' : `Đã chốt ${fmtDate(p.closedAt)}`}</td>
                  <td className="r">{yen(p.openingCost)}</td>
                  <td className="r">{yen(p.openingRevenue)}</td>
                  <td className="r">{yen(st.totals.periodCost)}</td>
                  <td className="r">{yen(st.totals.periodRevenue)}</td>
                  <td className="r">{p.closingCost == null ? '—' : yen(p.closingCost)}</td>
                  <td className="r">{p.closingRevenue == null ? '—' : yen(p.closingRevenue)}</td>
                  <td className={'b' + (!isOpen && !ok ? ' neg' : '')}>{isOpen ? 'Đang ghi' : ok ? 'Khớp' : 'Lệch'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
