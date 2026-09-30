export const NAV = [
  ['dashboard', 'Tổng quan'],
  ['purchases', 'Nhập hàng'],
  ['sales', 'Bán hàng'],
  ['inventory', 'Tồn kho'],
  ['products', 'Sản phẩm'],
  ['analysis', 'Phân tích'],
  ['periods', 'Chốt kỳ'],
  ['settings', 'Cài đặt'],
];

// Primary action on the sub-nav: [target screen, label]
export const CTA = {
  dashboard: ['sales', 'Ghi đơn bán'],
  purchases: ['purchases', 'Thêm dòng nhập'],
  sales: ['sales', 'Thêm đơn bán'],
  products: ['products', 'Thêm sản phẩm'],
};

export const readHash = () => {
  const h = (location.hash || '').slice(1);
  return NAV.some(n => n[0] === h) ? h : 'dashboard';
};
