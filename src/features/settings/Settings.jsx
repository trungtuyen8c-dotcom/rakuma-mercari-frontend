import { useState } from 'react';
import { useApp } from '../../store/app-store';
import { yen, fmtDate } from '../../utils/format';
import Field, { invalidProps } from '../../components/Field';

const DEF = [
  ['rate', 'Tỷ giá (¥ → ₫)', '0.01'],
  ['serviceFee', 'Phí dịch vụ mặc định mỗi đơn (¥)', '1'],
  ['shipping', 'Phí ship Nhật → VN mặc định (¥)', '1'],
  ['tax', 'Thuế nhập khẩu (0,1 = 10%)', '0.01'],
];
const SCOPE = { read: 'Chỉ đọc', write: 'Đọc và ghi' };

export default function Settings() {
  const { store, api } = useApp();
  const s = store.settings, t = store.totals, u = store.user || {};
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState({});
  const [key, setKey] = useState({ name: '', scope: 'read', err: '' });
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);
  const [confirmId, setConfirmId] = useState(null);

  const cur = draft || { rate: String(s.rate), serviceFee: String(s.serviceFee), shipping: String(s.shipping), tax: String(s.tax) };
  const clean = DEF.every(([k]) => String(s[k]) === String(cur[k]));

  const createKey = async e => {
    e.preventDefault();
    const r = await api.createApiKey(key.name, key.scope);
    if (r.ok) { setCreated({ key: r.key, name: r.record.name }); setKey(k => ({ ...k, name: '', err: '' })); setCopied(false); }
    else setKey(k => ({ ...k, err: r.error }));
  };
  const copy = () => {
    const done = () => setCopied(true);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(created.key).then(done, done); else done();
  };
  const submit = async e => {
    e.preventDefault();
    const r = await api.saveSettings(cur);
    if (r.ok) { setDraft(null); setErrors({}); } else setErrors(r.errors || {});
  };

  return (
    <section aria-label="Cài đặt" className="page page--narrow">
      <article aria-labelledby="set-acc-h" className="card">
        <div className="stack-xxs">
          <h2 id="set-acc-h" className="h-tile">Tài khoản &amp; đăng nhập</h2>
          <p className="caption">Đăng nhập bằng Google. Chỉ email chủ shop được cấp phiên; tài khoản khác bị từ chối ở máy chủ.</p>
        </div>
        <dl className="dl-rows dl-rows--wrap">
          <div><dt>Đang đăng nhập</dt><dd>{u.email || '—'}</dd></div>
          <div><dt>Email chủ shop được phép</dt><dd>{s.ownerEmail}</dd></div>
          <div><dt>Vai trò</dt><dd>owner</dd></div>
          <div><dt>Đăng nhập lúc</dt><dd>{u.signedInAt ? new Date(u.signedInAt).toLocaleString('vi-VN') : '—'}</dd></div>
        </dl>
        <div>
          <button type="button" className="btn-secondary" onClick={api.signOut}>Đăng xuất</button>
        </div>
      </article>

      <article aria-labelledby="set-key-h" className="card card--lg">
        <div className="stack-xxs">
          <h2 id="set-key-h" className="h-tile">API key cho MCP</h2>
          <p className="caption">
            Cho máy chủ MCP hoặc công cụ khác đọc/ghi dữ liệu thay bạn. Gửi key trong header{' '}
            <code style={{ fontFamily: 'var(--f-mono)', fontSize: 13 }}>Authorization: Bearer &lt;key&gt;</code>. Key chỉ hiện đầy đủ một lần lúc tạo.
          </p>
        </div>
        <form onSubmit={createKey} noValidate aria-label="Tạo API key" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: 'var(--s-md)', alignItems: 'start' }}>
          <Field id="key-name" label="Tên key *" error={key.err}>
            <input {...invalidProps('key-name', key.err)} type="text" autoComplete="off" placeholder="Claude Desktop MCP" className="input" value={key.name} onChange={e => setKey(k => ({ ...k, name: e.target.value, err: '' }))} />
          </Field>
          <Field
            id="key-scope" label="Quyền"
            hint={key.scope === 'write'
              ? 'Xem mọi dữ liệu và thêm dòng nhập, đơn bán, sản phẩm. Không chốt kỳ, không đổi cài đặt.'
              : 'Xem sản phẩm, nhập hàng, bán hàng, tồn kho và báo cáo. Không sửa được gì.'}
          >
            <select id="key-scope" className="input" value={key.scope} onChange={e => setKey(k => ({ ...k, scope: e.target.value }))} aria-describedby="key-scope-hint">
              <option value="read">Chỉ đọc</option>
              <option value="write">Đọc và ghi</option>
            </select>
          </Field>
          <div className="field">
            <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1.43, visibility: 'hidden' }}>.</span>
            <button type="submit" className="btn-primary" disabled={!key.name.trim()}>Tạo key</button>
          </div>
        </form>

        {created && (
          <div role="status" className="note stack-md" style={{ padding: 'var(--s-md)', gap: 'var(--s-sm)' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Key “{created.name}” đã tạo. Sao chép và lưu ngay, đóng lại sẽ không xem được nữa.</p>
            <code style={{ display: 'block', padding: 'var(--s-sm)', background: 'var(--c-canvas)', border: '1px solid var(--c-hairline)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--f-mono)', fontSize: 14, lineHeight: 1.43, overflowWrap: 'anywhere', userSelect: 'all' }}>{created.key}</code>
            <div className="row-wrap">
              <button type="button" className="btn-primary btn-sm" onClick={copy}>{copied ? 'Đã sao chép' : 'Sao chép key'}</button>
              <button type="button" className="btn-link" onClick={() => { setCreated(null); setCopied(false); }}>Tôi đã lưu key</button>
            </div>
          </div>
        )}

        <div role="region" aria-label="Danh sách API key" tabIndex={0} className="table-wrap">
          <table className="table" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th scope="col">Tên</th>
                <th scope="col">Key</th>
                <th scope="col">Quyền</th>
                <th scope="col">Ngày tạo</th>
                <th scope="col">Dùng lần cuối</th>
                <th scope="col">Trạng thái</th>
                <th scope="col"><span className="sr-only">Thao tác</span></th>
              </tr>
            </thead>
            <tbody>
              {store.apiKeys.map(k => {
                const f = k.revoked ? ' faded' : '';
                return (
                  <tr key={k.id}>
                    <td className={'b' + f}>{k.name}</td>
                    <td className={'mono' + f}>{k.masked}</td>
                    <td className={f}>{SCOPE[k.scope]}</td>
                    <td className={'nw' + f}>{fmtDate(k.createdAt)}</td>
                    <td className={'nw' + f}>{k.lastUsed ? fmtDate(k.lastUsed) : 'Chưa dùng'}</td>
                    <td className={f}>{k.revoked ? `Đã thu hồi ${fmtDate(k.revokedAt)}` : 'Đang hoạt động'}</td>
                    <td className="act-tight r nw">
                      {confirmId === k.id ? (
                        <div className="table-actions">
                          <button type="button" className="btn-link btn-link--strong-danger" onClick={async () => { await api.revokeApiKey(k.id); setConfirmId(null); }}>Xác nhận thu hồi</button>
                          <button type="button" className="btn-link btn-link--muted" onClick={() => setConfirmId(null)}>Hủy</button>
                        </div>
                      ) : (
                        <button type="button" className="btn-link btn-link--danger" disabled={k.revoked} onClick={() => setConfirmId(k.id)} aria-label={`Thu hồi key ${k.name}`}>Thu hồi</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {store.apiKeys.length === 0 && <p className="caption">Chưa có API key nào.</p>}
      </article>

      <form onSubmit={submit} noValidate aria-labelledby="set-h" className="card card--lg">
        <div className="stack-xxs">
          <h2 id="set-h" className="h-tile">Thông số chung</h2>
          <p className="caption">Các thông số này đang được lưu nhưng chưa tham gia công thức vốn hay lãi (chờ trả lời Q-08).</p>
        </div>
        <div className="form-grid">
          {DEF.map(([k, label, step]) => (
            <Field key={k} id={'set-' + k} label={label} error={errors[k]}>
              <input
                {...invalidProps('set-' + k, errors[k])} type="number" step={step} min="0" className="input" value={cur[k]}
                onChange={e => { const v = e.target.value; setDraft({ ...cur, [k]: v }); setErrors(x => ({ ...x, [k]: undefined })); }}
              />
            </Field>
          ))}
        </div>
        <div className="row-wrap">
          <button type="submit" className="btn-primary" disabled={clean}>Lưu cài đặt</button>
          <button type="button" className="btn-secondary" disabled={clean} onClick={() => { setDraft(null); setErrors({}); }}>Hoàn tác</button>
        </div>
      </form>

      <article aria-labelledby="set-prev-h" className="card">
        <div className="stack-xxs">
          <h2 id="set-prev-h" className="h-tile">Số kỳ trước</h2>
          <p className="caption">Chỉ xem. Số này do thao tác <a href="#periods">Chốt kỳ</a> sinh ra.</p>
        </div>
        <dl className="dl-rows">
          <div><dt>Vốn kỳ trước</dt><dd>{yen(t.prevCost)}</dd></div>
          <div><dt>Doanh thu kỳ trước</dt><dd>{yen(t.prevRevenue)}</dd></div>
          <div><dt className="strong">Lợi nhuận kỳ trước</dt><dd className="strong">{yen(t.prevProfit)}</dd></div>
        </dl>
      </article>
    </section>
  );
}
