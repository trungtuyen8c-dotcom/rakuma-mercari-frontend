import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useApp, useNotice } from './store/app-store';
import { NAV, CTA, readHash } from './routes/nav';
import AppHeader from './components/AppHeader';
import SignIn from './features/auth/SignIn';
import Dashboard from './features/dashboard/Dashboard';
import Purchases from './features/purchases/Purchases';
import Sales from './features/sales/Sales';
// Screens used now and then load on first visit, so the daily ones open sooner. After a deploy the old chunk files
// are gone; a tab opened before it reloads once to pick up the new ones.
const lazyScreen = load => lazy(() => load().then(m => { try { sessionStorage.removeItem('chunk-reload'); } catch { /* storage off */ } return m; }, err => {
  let again = false;
  try { again = !sessionStorage.getItem('chunk-reload'); if (again) sessionStorage.setItem('chunk-reload', '1'); } catch { /* storage off */ }
  if (again) { location.reload(); return new Promise(() => {}); }
  throw err;
}));
const Inventory = lazyScreen(() => import('./features/stock/Inventory'));
const Products = lazyScreen(() => import('./features/products/Products'));
const Analysis = lazyScreen(() => import('./features/analysis/Analysis'));
const Periods = lazyScreen(() => import('./features/periods/Periods'));
const Settings = lazyScreen(() => import('./features/settings/Settings'));
const CardLedger = lazyScreen(() => import('./features/cards/CardLedger'));
import Rakuma, { needsAttention } from './features/rakuma/Rakuma';

const SCREENS = { dashboard: Dashboard, purchases: Purchases, sales: Sales, inventory: Inventory, products: Products, analysis: Analysis, cards: CardLedger, periods: Periods, settings: Settings, rakuma: Rakuma };

export default function App() {
  const { status, store, api } = useApp();
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
      <AppHeader screen={screen} email={store.user.email} onSignOut={signOut} badges={{ rakuma: store.rakuma.filter(o => needsAttention(o, store.alerts.lastSync)).length }} />
      <div className="subnav" role="region" aria-label="Tiêu đề trang">
        <div className="wrap subnav-bar">
          <div className="subnav-title">
            <h1 className="h-tile">{NAV.find(n => n[0] === screen)[1]}</h1>
            <span className="subnav-badge">Kỳ {store.openPeriods.map(p => p.label).join(' và ')} · Đang mở</span>
          </div>
          {cta && <button type="button" className="btn-primary btn-sm" onClick={() => openComposer(cta[0])}>{cta[1]}</button>}
        </div>
      </div>
      <NoticeBar />
      <main id="main" tabIndex={-1} className="main">
        <Suspense fallback={<p className="caption wrap" aria-busy="true">Đang tải…</p>}>
          <Screen composerOpen={composer.open} composerSeq={composer.seq} closeComposer={() => setComposer(c => ({ ...c, open: false }))} />
        </Suspense>
      </main>
    </>
  );
}

function NoticeBar() {
  const { notice, dismiss } = useNotice();
  return (
    <div role="status" aria-live="polite">
      {notice && (
        <div className="notice">
          <div className="wrap notice-bar">
            <p>{notice}</p>
            <button type="button" className="btn-link" onClick={dismiss} aria-label="Đóng thông báo">Đóng</button>
          </div>
        </div>
      )}
    </div>
  );
}
