import { current, shippedOrDone, lastSyncOf, awaitingReceipt, hoursToPay, payDueSoon, awaitingShipment, shipWaitDays, SLOW_SHIP_DAYS } from '../features/rakuma/guess';

// Everything the owner should act on, counted once for the dashboard's "Việc hôm nay", the Nhập hàng warning and the
// Rakuma sections.
export function computeAlerts(store) {
  const orders = store.rakuma;
  const lastSync = lastSyncOf(orders);
  const payDue = orders.filter(o => payDueSoon(o, lastSync)).sort((a, b) => hoursToPay(a) - hoursToPay(b));
  // Every paid order the seller has not shipped, longest wait first; slowShip is the part waiting SLOW_SHIP_DAYS or more
  const notShipped = orders.filter(o => awaitingShipment(o, lastSync)).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  return {
    lastSync,
    payDue,
    toReceive: orders.filter(o => awaitingReceipt(o, lastSync)),
    notShipped,
    slowShip: notShipped.filter(o => shipWaitDays(o) >= SLOW_SHIP_DAYS),
    unread: orders.filter(o => o.newMessages > 0),
    pendingReplies: orders.reduce((n, o) => n + o.replies.filter(r => r.status === 'PENDING').length, 0),
    stuck: orders.filter(o => !o.purchaseId && !o.dismissed && !o.status.startsWith('支払い')),
    // Not on any purchase row and not skipped: unpaid ones wait for payment, paid ones could not be written
    unmatched: orders.filter(o => !o.purchaseId && !o.dismissed),
    unpaidWaiting: orders.filter(o => !o.purchaseId && !o.dismissed && o.status.startsWith('支払い') && current(o, lastSync)),
    // Unpaid when last seen and gone from Rakuma since: payment expired or cancelled
    unpaidGone: orders.filter(o => !o.purchaseId && !o.dismissed && o.status.startsWith('支払い') && !current(o, lastSync)),
    skipped: orders.filter(o => o.dismissed && !o.purchaseId),
    // Skipped although the goods were shipped, delivered or received: a purchase may be missing from Nhập hàng
    skippedShipped: orders.filter(o => o.dismissed && !o.purchaseId && shippedOrDone(o)),
    unnamed: store.purchases.filter(r => r.noProduct),
    waitingRefund: store.purchases.filter(r => r.refundNote),
    // Every purchase is paid; once cards exist, a row of an open month without one is missing from the card ledger
    noCard: store.payCards.length ? store.purchases.filter(r => r.cardId === '0' && r.total > r.points && store.openPeriods.some(p => p.id === r.periodId)) : [],
    oddPrice: store.purchases.filter(r => r.oddPrice),
    negatives: store.negatives,
  };
}
