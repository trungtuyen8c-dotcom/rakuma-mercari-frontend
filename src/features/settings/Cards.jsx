import { useState } from 'react';
import { useApp } from '../../store/app-store';
import { money } from '../../utils/format';
import Field, { invalidProps } from '../../components/Field';

// Payment cards shared with the order and yahoo projects. A card is the same card in every project when its name is
// exactly the same, so each project's charges add up on it; the opening balance lives in the order project.
export default function Cards() {
  const { store, api } = useApp();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('JPY');
  const [err, setErr] = useState('');
  const opens = new Set(store.openPeriods.map(p => p.id));
  const spent = {};
  const add1 = (id, v, r) => {
    if (id === '0' || v <= 0) return;
    const s = spent[id] || (spent[id] = { all: 0, open: 0 });
    s.all += v;
    if (opens.has(r.periodId)) s.open += v;
  };
  store.purchases.forEach(r => { add1(r.cardId, r.total - r.points, r); add1(r.pointCardId, r.points, r); });
  const noCard = store.purchases.filter(r => r.cardId === '0' && r.total > r.points && opens.has(r.periodId)).length;

  const add = async e => {
    e.preventDefault();
    const r = await api.addCard(name, currency);
    if (r.ok) { setName(''); setErr(''); } else setErr(r.errors?.name || r.errors?.currency || r.error);
  };

  return (
    <article aria-labelledby="set-card-h" className="card card--lg">
      <div className="stack-xxs">
        <h2 id="set-card-h" className="h-tile">Thẻ thanh toán</h2>
        <p className="caption">
          Thẻ dùng chung với hệ thống order và yahoo. Đặt tên <strong>giống hệt</strong> tên thẻ bên hệ thống order để số dư gộp đúng:
          mỗi dòng nhập có thẻ là một khoản trừ thẻ vào ngày đặt. Số dư đầu kỳ chỉ ghi bên hệ thống order. Thẻ tính bằng yên.
          <strong> Ví point</strong> (vd “Rakuma point”): point là vốn mua bằng VND; dòng trả một phần bằng point thì thẻ chỉ bị trừ phần còn lại,
          số point đã tiêu ghi vào ví point để hệ thống tổng quy ra vốn VND.
        </p>
      </div>
      <form onSubmit={add} noValidate aria-label="Thêm thẻ" className="form-grid" style={{ alignItems: 'start' }}>
        <Field id="card-kind" label="Loại">
          <select id="card-kind" className="input" value={currency} onChange={e => { setCurrency(e.target.value); setErr(''); }}>
            <option value="JPY">Thẻ (¥)</option>
            <option value="PT">Ví point</option>
          </select>
        </Field>
        <Field id="card-name" label="Tên thẻ *" error={err}>
          <input {...invalidProps('card-name', err)} type="text" autoComplete="off" placeholder={currency === 'PT' ? 'Rakuma point' : 'Rakuten Card'} className="input"
            value={name} onChange={e => { setName(e.target.value); setErr(''); }} />
        </Field>
        <div className="field">
          <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1.43, visibility: 'hidden' }}>.</span>
          <button type="submit" className="btn-primary" disabled={!name.trim()}>{currency === 'PT' ? 'Thêm ví point' : 'Thêm thẻ'}</button>
        </div>
      </form>
      {store.cards.length > 0 && (
        <div role="region" aria-label="Danh sách thẻ" tabIndex={0} className="table-wrap">
          <table className="table" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th scope="col">Thẻ</th>
                <th scope="col" className="r">Đã trừ kỳ đang mở</th>
                <th scope="col" className="r">Đã trừ từ đầu</th>
                <th scope="col" className="c">Mặc định</th>
                <th scope="col" className="r"><span className="sr-only">Thao tác</span></th>
              </tr>
            </thead>
            <tbody>
              {store.cards.map(c => (
                <tr key={c.id} className={c.active ? undefined : 'dim'}>
                  <td>
                    <span className="b">{c.name}</span>
                    <span className="cell-sub">{c.currency === 'PT' ? 'Ví point' : c.currency}{c.active ? '' : ' · đã ẩn'}</span>
                  </td>
                  <td className="r nw">{money(spent[c.id]?.open || 0, c.currency)}</td>
                  <td className="r nw">{money(spent[c.id]?.all || 0, c.currency)}</td>
                  <td className="c">
                    {c.currency !== 'PT' && <input type="radio" name="default-card" className="checkbox" checked={c.default} disabled={!c.active}
                      onChange={() => api.updateCard(c.id, { default: true })} aria-label={`Thẻ mặc định cho đơn Rakuma: ${c.name}`} />}
                  </td>
                  <td className="act nw">
                    <button type="button" className="btn-link btn-link--tight" onClick={() => api.updateCard(c.id, { active: !c.active })}>{c.active ? 'Ẩn' : 'Hiện'}</button>
                    {c.txCount === 0 && <button type="button" className="btn-link btn-link--tight btn-link--danger" onClick={() => api.deleteCard(c.id)}>Xóa</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="caption">
        Thẻ mặc định được gắn vào các dòng mà đồng bộ Rakuma tự ghi.
        {noCard > 0 && <> Kỳ đang mở còn <strong>{noCard} dòng nhập chưa ghi thẻ</strong>.</>}
      </p>
    </article>
  );
}
