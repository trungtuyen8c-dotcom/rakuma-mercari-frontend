import { lastSyncOf, awaitingReceipt, hoursToPay, PAY_SOON_HOURS, slowShipping } from '../features/rakuma/guess';

// Everything the owner should act on, counted once for the dashboard's "Việc hôm nay", the Nhập hàng warning and the
// Rakuma sections.
export function computeAlerts(store) {
  const orders = store.rakuma;
  const lastSync = lastSyncOf(orders);
  const payDue = orders.filter(o => { const h = hoursToPay(o); return h !== null && h < PAY_SOON_HOURS; })
    .sort((a, b) => hoursToPay(a) - hoursToPay(b));
  return {
    lastSync,
    payDue,
    toReceive: orders.filter(o => awaitingReceipt(o, lastSync)),
    slowShip: orders.filter(o => slowShipping(o, lastSync)),
    unread: orders.filter(o => o.newMessages > 0),
    pendingReplies: orders.reduce((n, o) => n + o.replies.filter(r => r.status === 'PENDING').length, 0),
    stuck: orders.filter(o => !o.purchaseId && !o.dismissed && !o.status.startsWith('支払い')),
    unnamed: store.purchases.filter(r => r.noProduct),
    oddPrice: store.purchases.filter(r => r.oddPrice),
    negatives: store.negatives,
  };
}
