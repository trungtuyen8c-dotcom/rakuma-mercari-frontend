export const yen = n => {
  const v = Math.round(n || 0);
  return (v < 0 ? '−' : '') + Math.abs(v).toLocaleString('vi-VN') + '¥';
};

export const qtyText = n => n.toLocaleString('vi-VN');

// yyyy-mm-dd -> dd/mm/yyyy
export const fmtDate = (d, empty = '—') => {
  if (!d) return empty;
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${day}/${m}/${y}`;
};

// Which marketplace a link points to, as a short label for narrow tables.
export const siteLabel = u => {
  const host = u.replace(/^https?:\/\//, '').split('/')[0];
  if (host.includes('fril.jp')) return 'Rakuma';
  if (host.includes('mercari')) return 'Mercari';
  return host.replace(/^www\./, '');
};

export const shortUrl = u => {
  const t = u.replace(/^https?:\/\//, '');
  return t.length > 30 ? t.slice(0, 29) + '…' : t;
};

export const purTotal = r => (r.price - (r.discount || 0)) * r.qty; // BR-03
export const saleTotal = r => r.qty * r.price - (r.ship || 0); // BR-04

export const nextLabel = label => {
  const [m, y] = label.split('/').map(Number);
  return m === 12 ? `01/${y + 1}` : `${String(m + 1).padStart(2, '0')}/${y}`;
};

export const monthRange = label => {
  const [m, y] = label.split('/').map(Number);
  const mm = String(m).padStart(2, '0');
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${new Date(y, m, 0).getDate()}` };
};

export const periodStatusText = p => (p.status === 'OPEN' ? 'Đang mở' : 'Đã chốt');
