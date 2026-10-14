// Spreads an order-wide discount ("400¥ off" on 3 items) over the lines as whole-yen discounts per item, in proportion
// to each line's value. The yen left by rounding goes to lines bought one at a time first, so the lines add up to the
// card charge exactly. Returns null when that is impossible (every line has qty > 1 and none takes the leftover).
export function spreadDiscount(lines, discount) {
  const value = lines.map(l => l.qty * l.price);
  const sum = value.reduce((a, b) => a + b, 0);
  if (!sum || discount < 0 || discount > sum) return null;
  const per = lines.map((l, i) => Math.min(l.price, Math.floor((discount * value[i]) / sum / l.qty)));
  let left = discount - per.reduce((n, d, i) => n + d * lines[i].qty, 0);
  const order = lines.map((_, i) => i).sort((a, b) => lines[a].qty - lines[b].qty || value[b] - value[a]);
  for (const i of order) {
    const k = Math.min(lines[i].price - per[i], Math.floor(left / lines[i].qty));
    per[i] += k;
    left -= k * lines[i].qty;
  }
  return left === 0 ? per : null;
}
