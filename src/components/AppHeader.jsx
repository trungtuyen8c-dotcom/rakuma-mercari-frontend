import { useEffect, useState } from 'react';
import { NAV } from '../routes/nav';
import { useWindowWidth } from '../hooks/use-window-width';

export default function AppHeader({ screen, email, onSignOut }) {
  const narrow = useWindowWidth() < 1024;
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [screen]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = e => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const links = NAV.map(([id, label]) => (
    <li key={id}>
      <a href={'#' + id} className="gnav-link" aria-current={screen === id ? 'page' : undefined}>{label}</a>
    </li>
  ));

  return (
    <header className="gnav">
      <div className="wrap gnav-bar">
        <a href="#dashboard" className="gnav-brand">Rakuma · Sổ kho</a>
        {!narrow && (
          <>
            <nav aria-label="Điều hướng chính" className="gnav-nav">
              <ul className="gnav-list">{links}</ul>
            </nav>
            <button type="button" className="gnav-signout" onClick={onSignOut} aria-label={`Đăng xuất ${email}`}>Đăng xuất</button>
          </>
        )}
        {narrow && (
          <button type="button" className="gnav-menu-btn" aria-expanded={menuOpen} aria-controls="mobile-menu" onClick={() => setMenuOpen(o => !o)}>
            {menuOpen ? 'Đóng' : 'Menu'}
          </button>
        )}
      </div>
      {narrow && menuOpen && (
        <nav id="mobile-menu" aria-label="Điều hướng chính" className="gnav-mobile">
          <ul>{links}</ul>
          <div className="gnav-mobile-foot">
            <p>{email}</p>
            <button type="button" onClick={onSignOut}>Đăng xuất</button>
          </div>
        </nav>
      )}
    </header>
  );
}
