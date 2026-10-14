// Guesses for the approve form, from the Rakuma item title and the owner's product keywords (Sản phẩm screen).
// A guess is only made when it is unambiguous; otherwise the field stays empty for the owner to fill.

const norm = s => (s || '').normalize('NFKC').toLowerCase();

// The product whose name or keyword is found in the title; the longest match wins, a tie between products gives none.
export function guessProduct(title, products) {
  const t = norm(title);
  if (!t) return null;
  let best = null, bestLen = 0, tie = false;
  for (const p of products) {
    const words = [p.name, ...(p.keywords || '').split(',')].map(w => norm(w).trim()).filter(w => w.length >= 3 || /[^\x00-\x7f]/.test(w) && w.length >= 2);
    for (const w of words) {
      if (!t.includes(w)) continue;
      if (w.length > bestLen) { best = p; bestLen = w.length; tie = false; }
      else if (w.length === bestLen && best && best.id !== p.id) tie = true;
    }
  }
  return best && !tie ? { product: best, matched: bestLen } : null;
}

// Quantity written next to a box word, e.g. "4BOX", "2箱", "3ボックス". "151 BOX" (a set name, with a space) is not a quantity.
export function guessQty(title) {
  const m = norm(title).match(/(?<![\d.])(\d{1,2})(?:box|箱|ボックス)/);
  const q = m ? Number(m[1]) : 0;
  return q >= 2 && q <= 50 ? q : null;
}

// Missing pieces worth a warning on an order card.
export function orderGaps(o) {
  // 商品の受取 alone is the receipt page before any shipping notice: not shipped yet
  const shipped = /発送済み|配達/.test(o.status || '');
  return {
    noTitle: !o.title,
    noPrice: !o.price,
    noTracking: shipped && !o.tracking,
  };
}

// Shipped, delivered or received on Rakuma: such an order should be on a purchase row.
export const shippedOrDone = o => !!o.tracking || /発送済み|配達|取引完了/.test(o.status || '');

// Shipped (seller's own carrier, not らくまパック) with no tracking number on the order or its purchase row, even after
// reading the seller's messages: the owner types it in.
export const shippedNoTracking = (o, lastSync, purchase) =>
  /発送済み|配達/.test(o.status || '') && !o.tracking && !purchase?.tracking && current(o, lastSync);

// Latest sync time over all orders ("YYYY-MM-DD HH:MM", Japan time).
export const lastSyncOf = orders => orders.reduce((a, o) => (o.syncedAt > a ? o.syncedAt : a), '');

const minutes = at => { const t = Date.parse((at || '').replace(' ', 'T')); return Number.isNaN(t) ? 0 : t / 60000; };

// Read in the latest sync and not dropped by the owner (row deleted or order skipped). An order the latest sync did not
// read has left the Rakuma lists (done, cancelled, payment expired) or belongs to another Rakuma account, so its status
// is old news and it raises no alert.
export const current = (o, lastSync) => !o.dismissed && !!lastSync && minutes(lastSync) - minutes(o.syncedAt) <= 30;

// Delivered but the owner has not done 受取評価 (receive + rate) on Rakuma yet: the seller is waiting and usually nags.
export const awaitingReceipt = (o, lastSync) =>
  /配達済み/.test(o.status || '') && (o.status || '').startsWith('商品の受取') && current(o, lastSync);

// The order's transaction page on Rakuma, where 受取評価 is done.
export const transactionUrl = link => `https://fril.jp/transaction?item_id=${(link || '').split('/').pop()}`;

// Japan wall-clock time as a UTC timestamp, so Rakuma's JST dates compare without time zones.
const jstNow = () => Date.now() + 9 * 3600e3;

// Hours left to pay an unpaid order ("支払い (期限 10/12 23:59)"); negative when overdue, null when not unpaid.
export const hoursToPay = (o, now = jstNow()) => {
  const m = (o.status || '').match(/^支払い.*?期限\s*(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const year = new Date(now).getUTCFullYear();
  let due = Date.UTC(year, m[1] - 1, m[2], m[3], m[4]);
  if (due - now > 180 * 864e5) due = Date.UTC(year - 1, m[1] - 1, m[2], m[3], m[4]); // a December deadline seen in January
  return (due - now) / 3600e3;
};
export const PAY_SOON_HOURS = 24;
// Unpaid with under PAY_SOON_HOURS left (or overdue), still on Rakuma, and no purchase row yet (a row means it was paid).
export const payDueSoon = (o, lastSync) => {
  const h = hoursToPay(o);
  return h !== null && h < PAY_SOON_HOURS && !o.purchaseId && current(o, lastSync);
};

// Paid and the seller has not shipped yet: 商品発送待ち, or the receipt page before any shipping notice.
export const awaitingShipment = (o, lastSync) => {
  const s = o.status || '';
  return !!o.date && current(o, lastSync) && (s.startsWith('商品発送待ち') || s.startsWith('商品の受取') && !/発送済み|配達/.test(s));
};
// Whole days since payment (purchase date, JST).
export const shipWaitDays = (o, now = jstNow()) => Math.floor((now - Date.parse(o.date + 'T00:00:00Z')) / 864e5);
export const SLOW_SHIP_DAYS = 3;
// Waiting for the seller to ship for SLOW_SHIP_DAYS days or more.
export const slowShipping = (o, lastSync, now = jstNow()) => awaitingShipment(o, lastSync) && shipWaitDays(o, now) >= SLOW_SHIP_DAYS;
