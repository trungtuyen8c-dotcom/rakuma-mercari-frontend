import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../store/app-store';
import { yen, fmtDate, qtyText } from '../../utils/format';

export default function Periods() {
  const { store, api } = useApp();
  const [confirming, setConfirming] = useState(false);
  const [cutStart, setCutStart] = useState('');
  const confirmRef = useRef(null);
  // Closing always applies to the oldest open period; its successor may already be open
  const o = store.openPeriods[0], st0 = store.statsFor(o.id), t = st0.totals, neg = st0.negatives;
  const nextLabel = store.openPeriods[1]?.label || store.nextLabel;
  const canOpenNext = store.openPeriods.length < 2;

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
              <li>Vốn kỳ trước của kỳ {nextLabel} = {cost}; doanh thu kỳ trước = {revenue}.</li>
              <li>Tồn đầu kỳ {nextLabel} của từng sản phẩm = SL hiện tại.</li>
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

      <article aria-labelledby="per-next-h" className="card">
        <h2 id="per-next-h" className="h-tile">{canOpenNext ? `Mở trước kỳ ${store.nextLabel}` : `Kỳ ${nextLabel} đã mở trước`}</h2>
        {canOpenNext ? (
          <>
            <p className="caption">Dùng khi sang tháng mới mà kỳ {o.label} còn đơn chưa xong (chưa nhận hàng, chưa đánh giá). Hai kỳ cùng mở: giao dịch tự vào kỳ theo ngày. Vốn, doanh thu và tồn đầu kỳ {store.nextLabel} tạm tính theo kỳ {o.label} cho tới khi bạn chốt kỳ {o.label}.</p>
            <div className="row-wrap" style={{ alignItems: 'flex-end' }}>
              <div className="field">
                <label htmlFor="per-next-start" className="label">Bắt đầu từ ngày (tùy chọn)</label>
                <input id="per-next-start" type="date" className="input" value={cutStart} onChange={e => setCutStart(e.target.value)} />
              </div>
              <button type="button" className="btn-secondary" onClick={async () => { const r = await api.openNextPeriod(cutStart); if (r.ok) setCutStart(''); }}>Mở kỳ {store.nextLabel}</button>
            </div>
            <p className="caption">Để trống = bắt đầu từ ngày 1. Chọn ngày khác khi muốn mốc riêng, ví dụ hôm nay vẫn tính kỳ {o.label} thì chọn ngày mai; kỳ {o.label} sẽ kéo dài tới hôm nay.</p>
          </>
        ) : (
          <p className="caption">Kỳ {o.label} và {nextLabel} đang cùng mở. Số đầu kỳ {nextLabel} đang tạm tính theo kỳ {o.label}; chốt kỳ {o.label} ở trên khi mọi đơn đã xong. Muốn mở kỳ mới nữa thì phải chốt kỳ {o.label} trước.</p>
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
