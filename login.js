const { useState, useEffect } = React;

const supabaseUrl = 'https://fzkqspzrcheajchczeoa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6a3FzcHpyY2hlYWpjaGN6ZW9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODk4NzEsImV4cCI6MjA5MjI2NTg3MX0.SI-9E-ZNRpi3BmIcAdGpuq3iW-MunBwC92gpA9bmwH8';
const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

function validateEmail(email) {
  
  const re = /^[a-zA-Z0-9]([a-zA-Z0-9._%+\-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  if (!re.test(email)) return "Enter a valid email address (e.g. name@example.com).";
  if (/\.\./.test(email)) return "Email cannot contain consecutive dots.";
  const [local, domain] = email.split('@');
  if (local.length > 64) return "Email username is too long.";
  if (domain.length > 255) return "Email domain is too long.";
  
  const tld = domain.split('.').pop();
  if (tld.length < 2) return "Enter a valid email with a proper domain (e.g. .com, .org).";
  return null;
}

function validatePassword(password) {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number.";
  return null;
}

function AuthPage() {
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [factorId, setFactorId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); 
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [intent, setIntent] = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotEmailError, setForgotEmailError] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [newConfirm, setNewConfirm] = useState('');
  const [newConfirmError, setNewConfirmError] = useState('');

  function setMsg(text, type) { setMessage(text); setMessageType(type); }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const intentParam = params.get('intent');
    const emailParam = params.get('email');

    if (intentParam) setIntent(intentParam);

    if (emailParam) {
      setEmail(decodeURIComponent(emailParam));
      setIsLogin(false); 
    }
  }, []);

  function handleEmailBlur() {
    setEmailError(validateEmail(email) || '');
  }

  function handlePasswordBlur() {
    if (!isLogin) setPasswordError(validatePassword(password) || '');
  }

  function handleConfirmBlur() {
    if (!isLogin && password !== confirmPassword) setConfirmError("Passwords do not match.");
    else setConfirmError('');
  }

  const handleMFA = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg('', ''); 
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: mfaCode,
    });
    setLoading(false);
    if (error) {
      setMsg('Invalid code. Please try again.', 'error');
    } else {
      setMsg('Verified! Redirecting...', 'success');
      setTimeout(() => window.location.href = 'dashboard.html', 800);
    }
  };

  function clearErrors() {
    setEmailError(''); setPasswordError(''); setConfirmError(''); setMessage(''); setMessageType('');
  }

  const handleAuth = async (e) => {
    e.preventDefault();
    clearErrors();

    
    const emailErr = validateEmail(email);
    if (emailErr) { setEmailError(emailErr); return; }

    if (!isLogin) {
      const passErr = validatePassword(password);
      if (passErr) { setPasswordError(passErr); return; }
      if (password !== confirmPassword) { setConfirmError("Passwords do not match."); return; }
    }

    setLoading(true);

    if (isLogin) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        
        if (error.message.toLowerCase().includes('invalid login') || error.message.toLowerCase().includes('invalid credentials')) {
          setMsg("No account found with these credentials. Check your email and password.", 'error');
        } else if (error.message.toLowerCase().includes('email not confirmed')) {
          setMsg("Please confirm your email before logging in. Check your inbox.", 'error');
        } else {
          setMsg(error.message, 'error');
        }
      } else if (data.session) {
        setMsg('Logged in! Redirecting...', 'success');
        setTimeout(() => window.location.href = 'dashboard.html', 800);
      } else if (data.user) {
        
        const totpFactor = data.user.factors?.find(f => f.factor_type === 'totp' && f.status === 'verified');
        if (totpFactor) {
          setFactorId(totpFactor.id);
          setMfaRequired(true);
        } else {
          setMsg('MFA is required but no authenticator app is configured.', 'error');
        }
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: intent === 'waitlist_pro' ? { waitlisted_plan: 'pro' } : undefined
        }
      });
      if (error) {
        setMsg(error.message, 'error');
      } else if (data.user && data.user.identities && data.user.identities.length === 0) {
        setMsg("An account with this email already exists. Try logging in instead.", 'error');
        } else {
    setMsg('Account created! Check your email to confirm your account.', 'success');
  }
}

    setLoading(false);
  };

  function switchMode() {
    setIsLogin(!isLogin);
    clearErrors();
    setPassword('');
    setConfirmPassword('');
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    const err = validateEmail(forgotEmail);
    if (err) { setForgotEmailError(err); return; }
    setForgotEmailError('');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: window.location.origin + '/login.html?reset=1',
    });
    setLoading(false);
    if (error) {
      setMsg(error.message, 'error');
    } else {
      setMsg('Check your email for a password reset link.', 'success');
    }
  };


  const handleResetPassword = async (e) => {
    e.preventDefault();
    const err = validatePassword(newPassword);
    if (err) { setNewPasswordError(err); return; }
    if (newPassword !== newConfirm) { setNewConfirmError('Passwords do not match.'); return; }
    setNewPasswordError(''); setNewConfirmError('');
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      setMsg(error.message, 'error');
    } else {
      setMsg('Password updated! Redirecting...', 'success');
      setTimeout(() => window.location.href = 'dashboard.html', 1200);
    }
  };

  return (
    <div className="app-shell">
      <nav className="top-nav">
        <div className="top-nav-inner">
          <div className="brand" onClick={() => window.location.href = 'index.html'} style={{ cursor: 'pointer' }}>
            <div className="brand-mark">L!</div>
            Localit
          </div>
        </div>
      </nav>

      <div className="auth-grid">
        {resetMode ? (
          <div className="auth-panel">
            <h2>Set new password</h2>
            <p className="muted-copy" style={{ marginBottom: '28px', marginTop: '8px' }}>
              Choose a strong password for your account.
            </p>
            <form className="auth-form" onSubmit={handleResetPassword} noValidate>
              <div className="field-group">
                <label className="field-label">New password</label>
                <input
                  className={`form-input ${newPasswordError ? 'input-error' : ''}`}
                  type="password"
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); if (newPasswordError) setNewPasswordError(''); }}
                  autoComplete="new-password"
                />
                {newPasswordError && <span className="field-error">{newPasswordError}</span>}
              </div>
              <div className="field-group">
                <label className="field-label">Confirm new password</label>
                <input
                  className={`form-input ${newConfirmError ? 'input-error' : ''}`}
                  type="password"
                  placeholder="Re-enter your new password"
                  value={newConfirm}
                  onChange={e => { setNewConfirm(e.target.value); if (newConfirmError) setNewConfirmError(''); }}
                  autoComplete="new-password"
                />
                {newConfirmError && <span className="field-error">{newConfirmError}</span>}
              </div>
              <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
                {loading ? <span className="btn-loading"><span></span><span></span><span></span></span> : 'Update password'}
              </button>
            </form>
            {message && (
              <div className={`auth-message auth-message-${messageType}`}>
                {messageType === 'error' && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
                {messageType === 'success' && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                {message}
              </div>
            )}
          </div>
        ) : forgotMode ? (
          <div className="auth-panel">
            <h2>Reset password</h2>
            <p className="muted-copy" style={{ marginBottom: '28px', marginTop: '8px' }}>
              Enter your email and we'll send a reset link.
            </p>
            <form className="auth-form" onSubmit={handleForgotPassword} noValidate>
              <div className="field-group">
                <label className="field-label">Email address</label>
                <input
                  className={`form-input ${forgotEmailError ? 'input-error' : ''}`}
                  type="email"
                  placeholder="name@example.com"
                  value={forgotEmail}
                  onChange={e => { setForgotEmail(e.target.value); if (forgotEmailError) setForgotEmailError(''); }}
                  autoComplete="email"
                />
                {forgotEmailError && <span className="field-error">{forgotEmailError}</span>}
              </div>
              <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
                {loading ? <span className="btn-loading"><span></span><span></span><span></span></span> : 'Send reset link'}
              </button>
            </form>
            {message && (
              <div className={`auth-message auth-message-${messageType}`}>
                {messageType === 'error' && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
                {messageType === 'success' && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                {message}
              </div>
            )}
            <div className="auth-switch">
              <button className="switch-link" onClick={() => { setForgotMode(false); setMessage(''); setMessageType(''); }}>
                ← Back to log in
              </button>
            </div>
          </div>
        ) : mfaRequired ? (
          <div className="auth-panel">
            <h2>Two-Factor Auth</h2>
            <p className="muted-copy" style={{ marginBottom: '28px', marginTop: '8px' }}>
              Enter the 6-digit code from your authenticator app.
            </p>
            <form className="auth-form" onSubmit={handleMFA} noValidate>
              <div className="field-group">
                <label className="field-label">Authentication code</label>
                <input
                  className="form-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  autoComplete="one-time-code"
                />
              </div>
              <button className="btn btn-primary auth-submit" type="submit" disabled={loading || mfaCode.length !== 6}>
                {loading ? <span className="btn-loading"><span></span><span></span><span></span></span> : 'Verify'}
              </button>
            </form>
            {message && (
              <div className={`auth-message auth-message-${messageType}`}>{message}</div>
            )}
          </div>
        ) : (
          <div className="auth-panel">
            <h2>{isLogin ? 'Welcome back' : 'Create an account'}</h2>
            <p className="muted-copy" style={{ marginBottom: '28px', marginTop: '8px' }}>
              {isLogin ? 'Log in to your Localit workspace.' : 'Start detecting translation bugs today.'}
            </p>

            <form className="auth-form" onSubmit={handleAuth} noValidate>

              
              <div className="field-group">
                <label className="field-label">Email address</label>
                <input
                  className={`form-input ${emailError ? 'input-error' : ''}`}
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
                  onBlur={handleEmailBlur}
                  required
                  autoComplete="email"
                />
                {emailError && <span className="field-error">{emailError}</span>}
              </div>

              
              <div className="field-group">
                <label className="field-label">Password</label>
                <div className="input-wrap">
                  <input
                    className={`form-input ${passwordError ? 'input-error' : ''}`}
                    type={showPassword ? 'text' : 'password'}
                    placeholder={isLogin ? 'Your password' : 'Min 8 chars, 1 uppercase, 1 number'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); if (passwordError) setPasswordError(''); }}
                    onBlur={handlePasswordBlur}
                    required
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                  />
                  <button type="button" className="show-toggle" onClick={() => setShowPassword(s => !s)}>
                    {showPassword
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
                {passwordError && <span className="field-error">{passwordError}</span>}
                {!isLogin && !passwordError && (
                  <span className="field-hint">Min 8 characters · 1 uppercase · 1 number</span>
                )}
                {isLogin && (
                  <button type="button" className="switch-link" style={{ alignSelf: 'flex-end', fontSize: '11px', marginTop: '2px' }}
                    onClick={() => { setForgotMode(true); setForgotEmail(email); clearErrors(); setMessage(''); setMessageType(''); }}>
                    Forgot password?
                  </button>
                )}
              </div>

              
              {!isLogin && (
                <div className="field-group">
                  <label className="field-label">Confirm password</label>
                  <input
                    className={`form-input ${confirmError ? 'input-error' : ''}`}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); if (confirmError) setConfirmError(''); }}
                    onBlur={handleConfirmBlur}
                    required
                    autoComplete="new-password"
                  />
                  {confirmError && <span className="field-error">{confirmError}</span>}
                </div>
              )}

              <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
                {loading
                  ? <span className="btn-loading"><span></span><span></span><span></span></span>
                  : isLogin ? 'Log in' : 'Create account'
                }
              </button>
            </form>

            <div className="auth-divider"><span>or</span></div>

            <button className="btn-google" onClick={async () => {
              const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin + '/dashboard.html' }
              });
              if (error) setMsg(error.message, 'error');
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>

            {message && (
              <div className={`auth-message auth-message-${messageType}`}>
                {messageType === 'error' && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
                {messageType === 'success' && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                {message}
              </div>
            )}

            <div className="auth-switch">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button className="switch-link" onClick={switchMode}>
                {isLogin ? 'Sign up' : 'Log in'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<AuthPage />);