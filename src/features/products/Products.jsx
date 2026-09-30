import { useState } from 'react';
import { useApp } from '../../store/app-store';
import { useFocusOn } from '../../hooks/use-focus-on';

export default function Products({ composerOpen, composerSeq, closeComposer }) {
  const { store, api } = useApp();
  const [name, setName] = useState('');
  const [addErr, setAddErr] = useState('');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState({ id: null, draft: '', err: '' });
  const firstRef = useFocusOn(composerOpen, composerSeq);

  const submit = async e => {
    e.preventDefault();
    const r = await api.addProduct(name);
    if (r.ok) { setName(''); setAddErr(''); firstRef.current?.focus(); } else setAddErr(r.error);
  };
  const saveEdit = async id => {
    const r = await api.renameProduct(id, edit.draft);
    if (r.ok) setEdit({ id: null, draft: '', err: '' }); else setEdit(x => ({ ...x, err: r.error }));
  };
  const cancelEdit = () => setEdit(x => ({ ...x, id: null, err: '' }));

  const needle = q.trim().toLowerCase();
  const rows = store.products.filter(p => !needle || p.name.toLowerCase().includes(needle));
  const active = store.products.filter(p => p.active).length;

  return (
    <section aria-label="Danh mục sản phẩm" className="page page--narrow">
      {composerOpen && (
        <form onSubmit={submit} noValidate aria-labelledby="prod-form-h" className="card">
          <h2 id="prod-form-h" className="h-tile">Thêm sản phẩm</h2>
          <div className="field">
            <label htmlFor="prod-name" className="label">Tên sản phẩm *</label>
            <div className="row-wrap">
              <input
                id="prod-name" ref={firstRef} type="text" autoComplete="off" placeholder="30th Celebration" className="input" style={{ flex: '1 1 240px', width: 'auto' }}
                value={name} onChange={e => { setName(e.target.value); setAddErr(''); }}
                aria-invalid={addErr ? 'true' : 'false'} aria-describedby="prod-name-hint prod-name-err"
              />
              <button type="submit" className="btn-primary" disabled={!name.trim()}>Lưu</button>
              <button type="button" className="btn-secondary" onClick={() => { setName(''); setAddErr(''); closeComposer(); }}>Đóng</button>
            </div>
            <p id="prod-name-hint" className="caption" style={{ letterSpacing: 'inherit' }}>Sản phẩm mới có ngay trong ô chọn ở Nhập hàng, Bán hàng và có dòng tồn kho với tồn đầu = 0.</p>
            {addErr && <p id="prod-name-err" role="alert" className="text-danger">{addErr}</p>}
          </div>
        </form>
      )}

      <div className="stack-md">
        <div className="row-between">
          <input type="search" aria-label="Tìm sản phẩm" placeholder="Tìm sản phẩm" className="pill pill--search" value={q} onChange={e => setQ(e.target.value)} />
          <p className="caption">{`${store.products.length} sản phẩm · ${active} đang dùng`}</p>
        </div>
        <p id="prod-del-note" className="caption">Sản phẩm đã có giao dịch chỉ có thể ẩn, không xóa được.</p>
        <div role="region" aria-label="Bảng danh mục sản phẩm" tabIndex={0} className="table-wrap">
          <table className="table table--hover table--compact" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th scope="col" className="r">STT</th>
                <th scope="col">Tên sản phẩm</th>
                <th scope="col">Trạng thái</th>
                <th scope="col" className="r">Số giao dịch</th>
                <th scope="col"><span className="sr-only">Thao tác</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(p => {
                const editing = edit.id === p.id;
                const dim = p.active ? undefined : 'dim';
                return (
                  <tr key={p.id}>
                    <td className="r dim">{p.stt}</td>
                    <td>
                      {editing ? (
                        <div className="stack-xxs">
                          <input
                            type="text" autoFocus className="input" style={{ height: 36, minWidth: 160, padding: '0 10px', fontSize: 14 }}
                            value={edit.draft} onChange={e => setEdit(x => ({ ...x, draft: e.target.value, err: '' }))}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); saveEdit(p.id); }
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            aria-label={`Tên mới cho ${p.name}`} aria-invalid={edit.err ? 'true' : 'false'}
                          />
                          {edit.err && <p role="alert" className="text-danger">{edit.err}</p>}
                        </div>
                      ) : (
                        <span className={'b ' + (dim || '')}>{p.name}</span>
                      )}
                    </td>
                    <td className={dim}>{p.active ? 'Đang dùng' : 'Ẩn'}</td>
                    <td className="r">{p.txCount}</td>
                    <td className="act-tight">
                      <div className="table-actions">
                        {editing ? (
                          <>
                            <button type="button" className="btn-link" onClick={() => saveEdit(p.id)}>Lưu</button>
                            <button type="button" className="btn-link btn-link--muted" onClick={cancelEdit}>Hủy</button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="btn-link" onClick={() => setEdit({ id: p.id, draft: p.name, err: '' })} aria-label={`Sửa tên ${p.name}`}>Sửa tên</button>
                            <button type="button" className="btn-link" onClick={() => api.toggleProductActive(p.id, !p.active)} aria-label={`${p.active ? 'Ẩn' : 'Hiện lại'} ${p.name}`}>{p.active ? 'Ẩn' : 'Hiện lại'}</button>
                            <button type="button" className="btn-link btn-link--danger" disabled={p.txCount > 0} onClick={() => api.deleteProduct(p.id)} aria-label={`Xóa ${p.name}`} aria-describedby="prod-del-note">Xóa</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
