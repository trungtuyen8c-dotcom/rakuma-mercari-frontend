import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../store/app-store';

// Accounts offered by the dev-login chooser (only when the server has no Google client configured).
const DEV_ACCOUNTS = [
  { name: 'Chủ shop', email: 'chushop.rakuma@gmail.com' },
  { name: 'Người phụ nhập đơn', email: 'phuban.rakuma@gmail.com' },
];

const readAuthError = () => new URLSearchParams(location.search).get('auth_error') || '';

// Google OAuth 2.0: the server verifies the Google account and only issues a session to the owner email (GD-01, E1).
export default function SignIn() {
  const { api } = useApp();
  const [cfg, setCfg] = useState(null);
  const [step, setStep] = useState('idle');
  const [error, setError] = useState(readAuthError);
  const firstAcc = useRef(null);

  useEffect(() => {
    api.authConfig().then(r => setCfg(r.ok ? r.data : { google: false, devLogin: false }));
    if (readAuthError()) history.replaceState(null, '', location.pathname + location.hash);
  }, [api]);

  useEffect(() => {
    if (step !== 'choose') return;
    requestAnimationFrame(() => firstAcc.current && firstAcc.current.focus());
    const onKey = e => { if (e.key === 'Escape') setStep('idle'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  const start = () => {
    setError('');
    if (cfg?.google) { setStep('loading'); location.href = api.googleLoginUrl; return; }
    if (cfg?.devLogin) { setStep('choose'); return; }
    setError('Máy chủ chưa cấu hình đăng nhập Google.');
  };
  const pick = async acc => {
    setStep('loading');
    const res = await api.devLogin(acc);
    if (!res.ok) { setStep('idle'); setError(res.error); }
  };

  return (
    <main id="main" tabIndex={-1} className="signin-page">
      <div className="signin-card">
        <div className="stack-xxs" style={{ gap: 'var(--s-xs)' }}>
          <p className="signin-eyebrow">Rakuma · Sổ kho</p>
          <h1 className="h-display">Đăng nhập</h1>
          <p className="signin-lead">Quản lý nhập, bán, tồn kho và lãi lỗ hàng Rakuma/Mercari. Chỉ tài khoản Google của chủ shop được vào hệ thống.</p>
        </div>
        {step === 'idle' && (
          <button type="button" className="btn-primary signin-google" onClick={start} disabled={!cfg}>Tiếp tục với Google</button>
        )}
        {step === 'choose' && (
          <div role="group" aria-labelledby="auth-choose-h" className="stack-md" style={{ gap: 'var(--s-sm)' }}>
            <h2 id="auth-choose-h" style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Chọn tài khoản Google</h2>
            <ul className="signin-accounts">
              {DEV_ACCOUNTS.map((a, i) => (
                <li key={a.email}>
                  <button type="button" ref={i === 0 ? firstAcc : undefined} className="signin-account" onClick={() => pick(a)}>
                    <span className="n">{a.name}</span>
                    <span className="e">{a.email}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="btn-link btn-link--tight" style={{ alignSelf: 'flex-start' }} onClick={() => setStep('idle')}>Hủy</button>
          </div>
        )}
        {step === 'loading' && <p role="status" style={{ margin: 0 }}>Đang xác thực với Google…</p>}
        {error && <p role="alert" className="alert-inline">{error}</p>}
        {cfg && !cfg.google && cfg.devLogin && (
          <p className="signin-fineprint">Chế độ phát triển: chưa cấu hình Google OAuth (GOOGLE_CLIENT_ID), hộp chọn tài khoản đang được mô phỏng. Máy chủ vẫn chỉ cấp phiên cho email chủ shop.</p>
        )}
      </div>
    </main>
  );
}
