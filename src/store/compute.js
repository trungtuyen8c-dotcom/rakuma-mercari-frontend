import { purTotal, saleTotal, nextLabel } from '../utils/format';

// Stats of any period: stock + money totals. Closed periods are recomputed from raw rows, so they must match the closing figures.
function periodStats(s, pid, purchases, sales) {
  const p = s.periods.find(x => x.id === pid);
  const inc = {}, out = {};
  let periodCost = 0, periodRevenue = 0, salesCount = 0;
  purchases.forEach(r => { if (r.periodId === pid) { inc[r.productId] = (inc[r.productId] || 0) + r.qty; periodCost += r.total; } });
  sales.forEach(r => { if (r.periodId === pid) { out[r.productId] = (out[r.productId] || 0) + r.qty; periodRevenue += r.total; salesCount++; } });
  // Openings come from the server already chained from the previous period; adjustments are the owner's corrections
  const openings = s.openings[pid] || {}, adjusts = (s.stockAdjusts || {})[pid] || {};
  const inventory = s.products.map((pr, i) => {
    const opening = openings[pr.id] || 0, incoming = inc[pr.id] || 0, sold = out[pr.id] || 0, adjust = adjusts[pr.id] || 0;
    return { productId: pr.id, stt: i + 1, name: pr.name, active: pr.active, opening, incoming, sold, adjust, current: opening + incoming - sold + adjust }; // BR-07, BR-08
  });
  const adjustCost = p.adjustCost || 0, adjustRevenue = p.adjustRevenue || 0;
  const totals = {
    prevCost: p.openingCost, prevRevenue: p.openingRevenue, prevProfit: p.openingRevenue - p.openingCost, // BR-13
    periodCost, periodRevenue, periodProfit: periodRevenue - periodCost, adjustCost, adjustRevenue,
    totalCost: p.openingCost + periodCost + adjustCost, // BR-10
    totalRevenue: p.openingRevenue + periodRevenue + adjustRevenue, // BR-11
    stockTotal: inventory.reduce((a, b) => a + b.current, 0),
    salesCount,
  };
  totals.totalProfit = totals.totalRevenue - totals.totalCost; // BR-12 (cash-flow profit)
  const matches = p.status !== 'CLOSED' || (p.closingCost === totals.totalCost && p.closingRevenue === totals.totalRevenue);
  return { period: p, inventory, totals, negatives: inventory.filter(i => i.current < 0), matches };
}

export function computeStore(s) {
  // Up to two periods can be open (an old month finishing while the next has started). New rows default to the newest.
  const opens = s.periods.filter(p => p.status === 'OPEN').sort((a, b) => a.start.localeCompare(b.start));
  const open = opens[opens.length - 1];
  const latest = [...s.periods].sort((a, b) => a.start.localeCompare(b.start)).pop();
  const closed = s.periods.filter(p => p.status === 'CLOSED');
  const perById = {};
  s.periods.forEach(p => { perById[p.id] = p; });
  const prodById = {};
  s.products.forEach(p => { prodById[p.id] = p; });
  const links = {}, tracks = {}, seq = {};
  s.purchases.forEach(r => {
    if (r.link) (links[r.link] = links[r.link] || []).push(r);
    if (r.tracking) (tracks[r.tracking] = tracks[r.tracking] || []).push(r);
  });
  const stt = (kind, r) => { const k = kind + r.periodId; seq[k] = (seq[k] || 0) + 1; return seq[k]; }; // BR-02
  const purchases = s.purchases.map(r => {
    const g = r.tracking ? tracks[r.tracking] : [];
    return {
      ...r, stt: stt('p', r), productName: (prodById[r.productId] || {}).name || '—', total: r.total ?? purTotal(r),
      dupLink: !!r.link && links[r.link].length > 1, // BR-05
      dupTracking: g.length > 1 && !g.every(x => x.merged), // BR-06: merged shipments are not flagged
      locked: perById[r.periodId].status === 'CLOSED', periodLabel: perById[r.periodId].label,
    };
  });
  // Lookups for the Rakuma screen, which checks every order against the purchase rows
  const purchaseIndex = { byId: {}, byLink: {}, byTracking: {} };
  purchases.forEach(r => {
    purchaseIndex.byId[r.id] = r;
    if (r.link) (purchaseIndex.byLink[r.link] = purchaseIndex.byLink[r.link] || []).push(r);
    if (r.tracking) (purchaseIndex.byTracking[r.tracking] = purchaseIndex.byTracking[r.tracking] || []).push(r);
  });
  const sales = s.sales.map(r => ({
    ...r, stt: stt('s', r), productName: (prodById[r.productId] || {}).name || '—', total: r.total ?? saleTotal(r),
    locked: perById[r.periodId].status === 'CLOSED', periodLabel: perById[r.periodId].label,
  }));
  const tx = {};
  [...s.purchases, ...s.sales].forEach(r => { tx[r.productId] = (tx[r.productId] || 0) + 1; });
  const cache = {};
  const statsFor = pid => cache[pid] || (cache[pid] = periodStats(s, pid, purchases, sales));
  const cur = statsFor(open.id);
  const products = s.products.map((p, i) => ({ ...p, stt: i + 1, txCount: tx[p.id] || 0 }));
  return {
    openPeriod: open, openPeriods: opens, prevPeriod: closed[closed.length - 1] || null, nextLabel: nextLabel(latest.label), periods: s.periods,
    products, activeProducts: products.filter(p => p.active), purchases, purchaseIndex, sales,
    inventory: cur.inventory, negatives: cur.negatives, totals: cur.totals, statsFor,
    settings: s.settings, user: s.user, apiKeys: s.apiKeys, rakuma: s.rakuma || [],
  };
}
