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
  const shipped = /発送済み|配達|商品の受取/.test(o.status || '');
  return {
    noTitle: !o.title,
    noPrice: !o.price,
    noTracking: shipped && !o.tracking,
  };
}
