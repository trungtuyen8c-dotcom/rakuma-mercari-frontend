import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../store/app-store';

// Accounts offered by the dev-login chooser (development only, when no password has been set).
const DEV_ACCOUNTS = [
  { name: 'Chủ shop', email: 'chushop.rakuma@gmail.com' },
  { name: 'Người phụ nhập đơn', email: 'phuban.rakuma@gmail.com' },
];

const readAuthError = () => new URLSearchParams(location.search).get('auth_error') || '';

// Owner-only sign-in: email + password (server checks bcrypt hash, locks out after repeated failures),
// plus Google OAuth when the server has it configured (GD-01, E1).
export default function SignIn() {
  const { api } = useApp();
  const [cfg, setCfg] = useState(null);
  const [step, setStep] = useState('idle');
  const [error, setError] = useState(readAuthError);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const emailRef = useRef(null);
  const firstAcc = useRef(null);

  useEffect(() => {
    api.authConfig().then(r => setCfg(r.ok ? r.data : { google: false, password: true, devLogin: false }));
    if (readAuthError()) history.replaceState(null, '', location.pathname + location.hash);
  }, [api]);

  const showPassword = cfg && (cfg.password || !cfg.devLogin);
  const showDevChooser = cfg && cfg.devLogin && !cfg.password;

  useEffect(() => {
    if (showPassword) requestAnimationFrame(() => emailRef.current && emailRef.current.focus());
  }, [showPassword]);

  useEffect(() => {
    if (step !== 'choose') return;
    requestAnimationFrame(() => firstAcc.current && firstAcc.current.focus());
    const onKey = e => { if (e.key === 'Escape') setStep('idle'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  const submit = async e => {
    e.preventDefault();
    setError('');
    setStep('loading');
    const res = await api.passwordLogin(email, password);
    if (!res.ok) {
      setStep('idle');
      setError(res.error);
      setPassword('');
    }
  };
  const google = () => { setStep('loading'); location.href = api.googleLoginUrl; };
  const pick = async acc => {
    setStep('loading');
    const res = await api.devLogin(acc);
    if (!res.ok) { setStep('idle'); setError(res.error); }
  };
  const busy = step === 'loading';

  return (
    <main id="main" tabIndex={-1} className="signin-page">
      <div className="signin-card">
        <div className="stack-xxs" style={{ gap: 'var(--s-xs)' }}>
          <p className="signin-eyebrow">Rakuma · Sổ kho</p>
          <h1 className="h-display">Đăng nhập</h1>
          <p className="signin-lead">Quản lý nhập, bán, tồn kho và lãi lỗ hàng Rakuma/Mercari. Chỉ tài khoản của chủ shop được vào hệ thống.</p>
        </div>

        {showPassword && (
          <form onSubmit={submit} noValidate aria-label="Đăng nhập bằng email và mật khẩu" className="stack-md">
            <div className="field">
              <label htmlFor="login-email" className="label">Email</label>
              <input
                id="login-email" ref={emailRef} type="email" autoComplete="username" inputMode="email" className="input"
                value={email} onChange={e => setEmail(e.target.value)} aria-invalid={error ? 'true' : 'false'} aria-describedby="login-err"
              />
            </div>
            <div className="field">
              <label htmlFor="login-password" className="label">Mật khẩu</label>
              <input
                id="login-password" type="password" autoComplete="current-password" className="input"
                value={password} onChange={e => setPassword(e.target.value)} aria-invalid={error ? 'true' : 'false'} aria-describedby="login-err"
              />
            </div>
            <button type="submit" className="btn-primary signin-google" disabled={busy || !email.trim() || !password}>
              {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </button>
          </form>
        )}

        {cfg?.google && (
          <button type="button" className="btn-secondary" style={{ width: '100%', minHeight: 48 }} onClick={google} disabled={busy}>Tiếp tục với Google</button>
        )}

        {showDevChooser && step !== 'choose' && (
          <button type="button" className="btn-primary signin-google" onClick={() => { setError(''); setStep('choose'); }} disabled={busy}>Tiếp tục với Google</button>
        )}
        {showDevChooser && step === 'choose' && (
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

        {error && <p id="login-err" role="alert" className="alert-inline">{error}</p>}
        {showDevChooser && (
          <p className="signin-fineprint">Chế độ phát triển: chưa đặt mật khẩu cho chủ shop, hộp chọn tài khoản đang được mô phỏng.</p>
        )}
      </div>
    </main>
  );
}
