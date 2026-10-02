import { useEffect, useRef, useState } from 'react';
import { useApp } from './store/app-store';
import { NAV, CTA, readHash } from './routes/nav';
import AppHeader from './components/AppHeader';
import SignIn from './features/auth/SignIn';
import Dashboard from './features/dashboard/Dashboard';
import Purchases from './features/purchases/Purchases';
import Sales from './features/sales/Sales';
import Inventory from './features/stock/Inventory';
import Products from './features/products/Products';
import Analysis from './features/analysis/Analysis';
import Periods from './features/periods/Periods';
import Settings from './features/settings/Settings';
import Rakuma, { needsAttention } from './features/rakuma/Rakuma';

const SCREENS = { dashboard: Dashboard, purchases: Purchases, sales: Sales, inventory: Inventory, products: Products, analysis: Analysis, periods: Periods, settings: Settings, rakuma: Rakuma };

export default function App() {
  const { status, store, api, notice } = useApp();
  const [screen, setScreen] = useState(readHash);
  const [composer, setComposer] = useState({ open: false, seq: 0 });
  const pendingComposer = useRef(false);

  // Hash routing so links and the Back button work
  useEffect(() => {
    const onHash = () => {
      const pending = pendingComposer.current;
      pendingComposer.current = false;
      setScreen(readHash());
      setComposer(c => ({ open: pending, seq: c.seq + (pending ? 1 : 0) }));
      const m = document.getElementById('main');
      if (m && !pending) m.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (status === 'loading') return <main id="main" className="signin-page" aria-busy="true" />;
  if (status === 'signedOut') return <SignIn />;
  if (status === 'error') {
    return (
      <main id="main" className="signin-page">
        <div className="signin-card">
          <p role="alert" className="alert-inline">Không kết nối được máy chủ.</p>
          <button type="button" className="btn-primary" onClick={api.reload}>Thử lại</button>
        </div>
      </main>
    );
  }

  const cta = CTA[screen];
  const openComposer = target => {
    if (screen === target) setComposer(c => ({ open: true, seq: c.seq + 1 }));
    else { pendingComposer.current = true; location.hash = target; }
  };
  const signOut = () => { setComposer({ open: false, seq: 0 }); api.signOut(); };
  const Screen = SCREENS[screen];

  return (
    <>
      <button type="button" className="skip-link" onClick={() => document.getElementById('main')?.focus()}>Bỏ qua tới nội dung chính</button>
      <AppHeader screen={screen} email={store.user.email} onSignOut={signOut} badges={{ rakuma: store.rakuma.filter(needsAttention).length }} />
      <div className="subnav">
        <div className="wrap subnav-bar">
          <div className="subnav-title">
            <h1 className="h-tile">{NAV.find(n => n[0] === screen)[1]}</h1>
            <span className="subnav-badge">Kỳ {store.openPeriod.label} · Đang mở</span>
          </div>
          {cta && <button type="button" className="btn-primary btn-sm" onClick={() => openComposer(cta[0])}>{cta[1]}</button>}
        </div>
      </div>
      <div role="status" aria-live="polite">
        {notice && (
          <div className="notice">
            <div className="wrap notice-bar">
              <p>{notice}</p>
              <button type="button" className="btn-link" onClick={api.dismissNotice} aria-label="Đóng thông báo">Đóng</button>
            </div>
          </div>
        )}
      </div>
      <main id="main" tabIndex={-1} className="main">
        <Screen composerOpen={composer.open} composerSeq={composer.seq} closeComposer={() => setComposer(c => ({ ...c, open: false }))} />
      </main>
    </>
  );
}
