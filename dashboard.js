const { useState, useEffect, useRef } = React;

const supabaseUrl = 'https://fzkqspzrcheajchczeoa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6a3FzcHpyY2hlYWpjaGN6ZW9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODk4NzEsImV4cCI6MjA5MjI2NTg3MX0.SI-9E-ZNRpi3BmIcAdGpuq3iW-MunBwC92gpA9bmwH8';
const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

function getFileType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (ext === 'json') return 'json';
  if (ext === 'yml' || ext === 'yaml') return 'yaml';
  if (ext === 'po') return 'po';
  return 'unknown';
}

function parsePo(poContent) {
  const translations = {};
  const entries = poContent.split(/(?:\r?\n){2,}/);
  const msgidRegex = /msgid\s+((?:"(?:[^"\\]|\\.)*"\s*)+)/;
  const msgstrRegex = /msgstr\s+((?:"(?:[^"\\]|\\.)*"\s*)+)/;
  function unescapeAndJoin(str) {
    if (!str) return "";
    const parts = str.match(/"(?:[^"\\]|\\.)*"/g) || [];
    return parts.map(p => p.slice(1, -1)).join('').replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
  }
  for (const entry of entries) {
    if (!entry.trim()) continue;
    const msgidMatch = entry.match(msgidRegex);
    const msgstrMatch = entry.match(msgstrRegex);
    if (msgidMatch) {
      const key = unescapeAndJoin(msgidMatch[1]);
      if (key) translations[key] = msgstrMatch ? unescapeAndJoin(msgstrMatch[1]) : "";
    }
  }
  return translations;
}


function applyFixToContent(content, fileType, key, fixValue) {
  if (fileType === 'json') {
    try {
      const parsed = JSON.parse(content);
      parsed[key] = fixValue;
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedFix = fixValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const regex = new RegExp(`("${escapedKey}"\\s*:\\s*)([^,\\n}]+)`);
      if (!regex.test(content)) throw new Error(`Key "${key}" not found`);
      return content.replace(regex, `$1"${escapedFix}"`);
    }
  }
  if (fileType === 'yaml') {
    const parsed = jsyaml.load(content);
    const parts = key.split('.');
    let obj = parsed;
    for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
    obj[parts[parts.length - 1]] = fixValue;
    return jsyaml.dump(parsed, { lineWidth: -1 });
  }
  if (fileType === 'po') {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedFix = fixValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    const entryRegex = new RegExp(`(msgid\\s+"${escapedKey}"[\\s\\S]*?\\nmsgstr\\s+)"[^"]*"`, 'g');
    return content.replace(entryRegex, `$1"${escapedFix}"`);
  }
  throw new Error('Unsupported file type');
}

async function loadHistory(userId) {
  const { data, error } = await supabase.from('scan_history').select('*').order('updated_at', { ascending: false }).limit(50);
  if (error) return [];
  const lsKey = `lk_history_${userId}`;
  let cache = [];
  try { cache = JSON.parse(localStorage.getItem(lsKey) || '[]'); } catch {}
  return data.map(row => ({ ...row, canReopen: cache.some(l => l.filename === row.filename && l.content) }));
}

async function upsertHistory(userId, filename, fileType, issueCount, scanType) {
  try {
    const { data: existing } = await supabase.from('scan_history').select('id, events').eq('user_id', userId).eq('filename', filename).single();
    const newEvent = { type: scanType, issue_count: issueCount, at: new Date().toISOString() };
    if (existing) {
      await supabase.from('scan_history').update({ file_type: fileType, issue_count: issueCount, scan_type: scanType, updated_at: new Date().toISOString(), events: [...(existing.events || []), newEvent] }).eq('id', existing.id);
    } else {
      await supabase.from('scan_history').insert({ user_id: userId, filename, file_type: fileType, issue_count: issueCount, scan_type: scanType, events: [newEvent] });
    }
  } catch (e) { console.error('upsertHistory failed:', e.message); }
}

function timeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Dashboard() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [bugs, setBugs] = useState([]);
  const [aiBugs, setAiBugs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanDone, setScanDone] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [tabs, setTabs] = useState([{ id: "main", label: "untitled", content: "", fileType: "json" }]);
  const [activeTab, setActiveTab] = useState("main");
  const [aiScansUsed, setAiScansUsed] = useState(0);
  const [aiScansLimit, setAiScansLimit] = useState(5);
  const [aiScansLoading, setAiScansLoading] = useState(true); 

  const [showMfaModal, setShowMfaModal] = useState(false);
  const [mfaStep, setMfaStep] = useState('setup');
  const [mfaQrCode, setMfaQrCode] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);

  const [syntaxWarningDismissed, setSyntaxWarningDismissed] = useState(false);

  const textareaRef = useRef(null);
  const gutterRef = useRef(null);
  const fileInputRef = useRef(null);

  const activeContent = tabs.find(t => t.id === activeTab)?.content ?? "";
  const activeFileType = tabs.find(t => t.id === activeTab)?.fileType ?? "json";
  const activeFilename = tabs.find(t => t.id === activeTab)?.label ?? "untitled";

  function setActiveContent(val) {
    setTabs(prev => prev.map(t => t.id === activeTab ? { ...t, content: val } : t));
  }

  function saveLocalContent(filename, content, userId) {
    const lsKey = `lk_history_${userId}`;
    let cache = [];
    try { cache = JSON.parse(localStorage.getItem(lsKey) || '[]'); } catch {}
    const filtered = cache.filter(l => l.filename !== filename);
    try { localStorage.setItem(lsKey, JSON.stringify([{ filename, content, savedAt: Date.now() }, ...filtered].slice(0, 50))); } catch {}
  }

  async function refreshHistory(userId) {
    const h = await loadHistory(userId);
    setHistory(h);
  }

  async function cancelMFAEnrollment() {
    if (mfaFactorId && (mfaStep === 'setup' || mfaStep === 'verify')) await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
    setShowMfaModal(false); setMfaStep('setup'); setMfaQrCode(''); setMfaSecret(''); setMfaFactorId(''); setMfaCode(''); setMfaError(''); setMfaLoading(false);
  }

  async function enrollMFA() {
    setMfaLoading(true); setMfaError('');
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    setMfaLoading(false);
    if (error) { setMfaError(error.message); setMfaStep('error'); setShowMfaModal(true); return; }
    if (data) { setMfaFactorId(data.id); setMfaQrCode(data.totp.qr_code); setMfaSecret(data.totp.secret); setMfaStep('setup'); setShowMfaModal(true); }
  }

  async function handleVerifyMFA(e) {
    e.preventDefault(); setMfaLoading(true); setMfaError('');
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: mfaFactorId, code: mfaCode });
    setMfaLoading(false);
    if (error) { setMfaError(error.message.includes('Invalid') ? 'Invalid code. Please try again.' : error.message); return; }
    setShowMfaModal(false);
    const { data: { user: freshUser } } = await supabase.auth.getUser();
    setUser(freshUser);
    setMfaStep('setup'); setMfaQrCode(''); setMfaSecret(''); setMfaFactorId(''); setMfaCode(''); setMfaError('');
  }

  useEffect(() => {
    const checkUser = async () => {
      setAuthLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        await refreshHistory(session.user.id);
        
        
        try {
          const { data: usageRow, error } = await supabase
            .from('usage')
            .select('ai_scan_count, reset_date')
            .eq('user_id', session.user.id)
            .single();

          if (error) {
            if (error.code === 'PGRST116') {
              setAiScansUsed(0);
            }
          } else if (usageRow) {
            const today = new Date().toISOString().slice(0, 10);
            if (usageRow.reset_date && usageRow.reset_date.slice(0, 7) !== today.slice(0, 7)) {
              setAiScansUsed(0);
            } else {
              setAiScansUsed(usageRow.ai_scan_count || 0);
            }
          }
        } catch (e) {
          console.error('Failed to fetch usage:', e);
          setAiScansUsed(0);
        } finally {
          setAiScansLoading(false);
          setAuthLoading(false);
        }
      } else {
        window.location.replace('login.html');
      }
    };
    checkUser();
    const handlePageShow = (e) => { if (e.persisted) checkUser(); };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target.result;
      const fileType = getFileType(file.name);
      setTabs(prev => prev.map(t => t.id === activeTab ? { ...t, content, label: file.name, fileType } : t));
      saveLocalContent(file.name, content, user.id);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function analyze() {
    let issues = [];
    setBugs([]); setAiBugs([]); setScanDone(false); setSyntaxWarningDismissed(false);
    if (!activeContent.trim()) { setScanDone(true); return; }

    try {
      let data;
      
      if (activeFileType === 'json') {
        try {
          data = JSON.parse(activeContent);
        } catch (parseErr) {
          const match = parseErr.message.match(/line (\d+) column (\d+)|position (\d+)/i);
          if (match) {
            const line = match[1] || '?';
            issues.push({ key: `Line ${line}`, detail: `JSON syntax error: ${parseErr.message.split(' in JSON')[0]}` });
          } else {
            issues.push({ key: "Syntax", detail: `JSON parse error: ${parseErr.message}` });
          }
        }

        const lines = activeContent.split('\n');
        const seenKeys = new Set();
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          const lineNum = i + 1;
          
          if (i < lines.length - 1 && /["}\]]$/.test(line) && !line.endsWith(',') && !line.endsWith('{') && !line.endsWith('[')) {
            const nextLine = lines[i + 1].trim();
            if (nextLine.startsWith('"') && !nextLine.startsWith('"}')) {
              issues.push({ key: `Line ${lineNum}`, detail: "Missing comma after value" });
            }
          }

          const unescapedQuotes = (line.match(/(?<!\\)"/g) || []).length;
          if (unescapedQuotes % 2 !== 0 && line.includes(':')) {
            issues.push({ key: `Line ${lineNum}`, detail: "Unterminated string (missing closing quote)" });
          }

          const keyMatch = line.match(/"([^"]+)"\s*:/);
          if (keyMatch) {
            const key = keyMatch[1];
            if (seenKeys.has(key)) issues.push({ key, detail: `Duplicate key (first seen earlier, redefined on line ${lineNum})` });
            seenKeys.add(key);
          }
        }
      } else if (activeFileType === 'yaml') {
        data = jsyaml.load(activeContent);
      } else if (activeFileType === 'po') {
        data = parsePo(activeContent);
      } else {
        issues.push({ key: "-", detail: "Unsupported file type for rule-based scan." });
        setBugs(issues); setScanDone(true);
        return;
      }

      if (data) {
        for (let key in data) {
          const val = data[key];
          if (typeof val === 'string' && val.trim() === "") issues.push({ key, detail: "Empty translation value" });
          if (typeof val === 'string' && val.includes("{") && !val.includes("}")) issues.push({ key, detail: "Broken placeholder (opening { without closing })" });
          if (typeof val === 'number') issues.push({ key, detail: `Value is a number (${val}), expected string` });
        }
      }
    } catch (err) {
      if (activeFileType !== 'json') issues.push({ key: "-", detail: `Invalid ${activeFileType.toUpperCase()} format: ${err.message}` });
    }

    setBugs(issues); setScanDone(true);

    if (user && activeFilename !== 'untitled') {
      await upsertHistory(user.id, activeFilename, activeFileType, issues.length, 'rule');
      await refreshHistory(user.id);
    }
  }

  async function runAI() {
  setLoading(true); setAiBugs([]); setScanDone(false);
  try {
    let { data: { session } } = await supabase.auth.getSession();
    if (session && session.expires_at * 1000 < Date.now() + 60000) {
      const r = await supabase.auth.refreshSession();
      session = r.data.session;
    }
    if (!session) throw new Error("Session expired. Please sign in again.");

    const res = await fetch("/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ text: activeContent, fileType: activeFileType, filename: activeFilename })
    });
    const data = await res.json();

    if (data.scansUsed !== undefined) setAiScansUsed(data.scansUsed);
    if (data.scansLimit !== undefined) setAiScansLimit(data.scansLimit);

    if (data.limitReached) {
      setAiBugs([{ key: "limit", detail: "Monthly free tier limit reached. Upgrade to Pro for unlimited scans." }]);
    } else if (data.error) {
      throw new Error(data.error);
    } else {
      setAiBugs(data.issues || []);
      await refreshHistory(user.id);
    }
  } catch (err) {
    console.error('AI scan failed:', err);
    setAiBugs([{ key: "status", detail: err.message || "AI request failed." }]);
  }
  setLoading(false); setScanDone(true);
}

  function download() {
    const blob = new Blob([activeContent], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = activeFilename !== 'untitled' ? activeFilename : 'fixed.json';
    a.click();
  }

  function applyFix(key, fixValue) {
    try {
      
      const currentContent = tabs.find(t => t.id === activeTab)?.content || "";
      const currentFileType = tabs.find(t => t.id === activeTab)?.fileType || "json";
      
      const fixed = applyFixToContent(currentContent, currentFileType, key, fixValue);
      setActiveContent(fixed);
      setAiBugs(prev => prev.filter(b => b.key !== key));
      if (user && activeFilename !== 'untitled') saveLocalContent(activeFilename, fixed, user.id);
    } catch (err) {
      alert(`Cannot apply fix: ${err.message}`);
    }
  }

  function openHistoryEntry(entry) {
    const lsKey = `lk_history_${user.id}`;
    let cache = [];
    try { cache = JSON.parse(localStorage.getItem(lsKey) || '[]'); } catch {}
    const localMatch = cache.find(l => l.filename === entry.filename);
    if (!localMatch) { alert(`"${entry.filename}" is not in local cache. Re-upload to view.`); return; }
    const fileType = getFileType(entry.filename);
    const tabId = `hist_${entry.id}`;
    setTabs(prev => { if (prev.find(t => t.id === tabId)) return prev; return [...prev, { id: tabId, label: entry.filename, content: localMatch.content, fileType }]; });
    setActiveTab(tabId);
  }

  function closeTab(id, e) {
    e.stopPropagation();
    if (id === "main") return;
    setTabs(prev => prev.filter(t => t.id !== id));
    if (activeTab === id) setActiveTab("main");
  }

  const lineCount = activeContent.split('\n').length;
  const handleScroll = (e) => { if (gutterRef.current) gutterRef.current.scrollTop = e.target.scrollTop; };

  if (authLoading) return (
    <div className="splash">
      <div className="splash-logo">L!</div>
      <div className="splash-text">Initializing workspace<span className="dots"><span>.</span><span>.</span><span>.</span></span></div>
    </div>
  );

  const isMfaEnabled = user?.factors?.some(f => f.factor_type === 'totp' && f.status === 'verified');
  const totalIssues = bugs.length + aiBugs.length;
  const hasSyntaxErrors = bugs.some(b => b.detail.includes('syntax error') || b.detail.includes('Missing comma') || b.detail.includes('Unterminated string'));

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="logo-mark">L!</div>
          <div className="logo-text">
            <span className="logo-main">Localit</span>
            <span className="logo-sub">Translation Bug Detector</span>
          </div>
        </div>
        <div className="header-center">
          {scanDone && (
            <div className={`status-pill ${totalIssues === 0 ? 'status-clean' : 'status-issues'}`}>
              {totalIssues === 0 ? '✓ Clean' : `⚠ ${totalIssues} issue${totalIssues > 1 ? 's' : ''} found`}
            </div>
          )}
        </div>
        <div className="header-right">
          <span className="user-email">{user?.email}</span>
          <div className="header-actions">
            <button className="btn-ghost btn-icon" title={historyOpen ? "Close history" : "Open history"} onClick={() => setHistoryOpen(o => !o)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </button>
            {isMfaEnabled ? <button className="btn-ghost" disabled>MFA Enabled</button> : <button className="btn-ghost" onClick={enrollMFA} disabled={mfaLoading}>{mfaLoading ? 'Loading...' : 'Enable MFA'}</button>}
            <div className="header-divider"></div>
            <input ref={fileInputRef} type="file" accept=".json,.yml,.yaml,.po" style={{ display: 'none' }} onChange={handleUpload} />
            <button className="btn-ghost" onClick={() => fileInputRef.current.click()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Upload
            </button>
            <button className="btn-ghost" onClick={analyze}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Scan
            </button>
            <button key={`ai-scan-button-${aiScansUsed}-${aiScansLimit}-${aiScansLoading}`} className="btn-ai" onClick={runAI} disabled={loading || aiScansLoading} title={aiScansLoading ? 'Loading AI scan usage...' : `${aiScansUsed}/${aiScansLimit} AI scans used this month`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/><circle cx="19" cy="5" r="3"/></svg>
              {loading ? 'Analyzing...' : aiScansLoading ? 'AI Scan (loading...)' : `AI Scan (${aiScansUsed}/${aiScansLimit})`}
            </button>
            <button className="btn-ghost" onClick={download}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export
            </button>
            <button className="btn-logout" onClick={async () => { await supabase.auth.signOut(); window.location.href = 'index.html'; }}>Sign out</button>
          </div>
        </div>
      </header>

      <main className="main">
        <aside className={`history-panel ${historyOpen ? 'history-open' : ''}`}>
          <div className="history-header">
            <span className="history-title">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              History
            </span>
            <span className="history-count">{history.length}</span>
          </div>
          <div className="history-list">
            {history.length === 0 && <div className="history-empty">No scans yet.</div>}
            {history.map(entry => (
              <div key={entry.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div className="history-item" style={{ opacity: entry.canReopen ? 1 : 0.55 }} onClick={() => { if (expandedHistory === entry.id) { setExpandedHistory(null); return; } setExpandedHistory(entry.id); if (entry.canReopen) openHistoryEntry(entry); }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="history-item-label">{entry.filename}</div>
                    <span style={{ fontSize: '9px', color: 'var(--text-3)', flexShrink: 0, marginLeft: '6px' }}>{entry.issue_count} iss</span>
                  </div>
                  <div className="history-item-time">
                    {entry.file_type?.toUpperCase()} · {timeAgo(entry.updated_at || entry.created_at)}
                    {!entry.canReopen && <span style={{ display: 'block', fontSize: '9px', color: 'var(--text-3)' }}>re-upload to view</span>}
                  </div>
                </div>
                {expandedHistory === entry.id && entry.events && entry.events.length > 0 && (
                  <div style={{ marginLeft: '8px', borderLeft: '1px solid var(--border)', paddingLeft: '8px', display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '4px' }}>
                    {entry.events.map((ev, i) => (
                      <div key={i} style={{ fontSize: '10px', color: 'var(--text-3)', lineHeight: '1.4' }}>
                        <span style={{ color: ev.type === 'ai' ? 'var(--accent)' : 'var(--orange)', fontFamily: 'var(--font-mono)' }}>{ev.type === 'ai' ? '🤖' : '🔍'} {ev.type}</span>
                        {' · '}{ev.issue_count} issues · {timeAgo(ev.at)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>

        <section className="pane pane-editor">
          <div className="tab-bar">
            {tabs.map(tab => (
              <div key={tab.id} className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                <span className="tab-label">{tab.label}</span>
                {tab.id !== "main" && <span className="tab-close" onClick={(e) => closeTab(tab.id, e)}>×</span>}
              </div>
            ))}
          </div>
          <div className="editor-body">
            <div className="gutter" ref={gutterRef}>
              {Array.from({ length: lineCount }, (_, i) => <div key={i} className="gutter-line">{i + 1}</div>)}
            </div>
            <textarea ref={textareaRef} className="editor-textarea" value={activeContent} onChange={e => setActiveContent(e.target.value)} onScroll={handleScroll} placeholder={'Paste or upload a .json / .yaml / .po file to begin...'} spellCheck="false" />
          </div>
        </section>

        <section className="pane pane-results">
          <div className="pane-titlebar">
            <span className="pane-filename">diagnostics</span>
            <span className="pane-badge">{totalIssues > 0 ? totalIssues : ''}</span>
          </div>
          <div className="results-body">
            {hasSyntaxErrors && !syntaxWarningDismissed && (
              <div style={{ padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid rgba(249,115,22,0.35)', background: 'rgba(249,115,22,0.08)', display: 'flex', alignItems: 'flex-start', gap: '8px', animation: 'slideIn 0.2s ease' }}>
                <svg style={{ flexShrink: 0, marginTop: '1px' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--orange)', marginBottom: '3px' }}>Fix syntax errors before AI scan</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-2)', lineHeight: '1.5' }}>This file has missing commas or unterminated strings. AI scan may miss issues or produce inaccurate results on malformed files. Fix the rule-based issues first, then re-run AI scan.</div>
                </div>
                <button onClick={() => setSyntaxWarningDismissed(true)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
              </div>
            )}
            {bugs.length > 0 && (
              <div className="result-group">
                <div className="result-group-label">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  Rule-based scan
                </div>
                {bugs.map((b, i) => (
                  <div className="issue-card issue-rule" key={i}>
                    <div className="issue-key">{b.key}</div>
                    <div className="issue-detail">{b.detail}</div>
                  </div>
                ))}
              </div>
            )}
            {aiBugs.length > 0 && (
              <div className="result-group">
                <div className="result-group-label">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h1v6H9zm5 0h1v6h-1zM9 12h6"/></svg>
                  AI scan
                </div>
                {aiBugs.map((b, i) => (
                  <div className="issue-card issue-ai" key={"ai" + i}>
                    <div className="issue-key">{b.key}</div>
                    <div className="issue-detail">{b.detail}</div>
                    {b.suggested_fix && b.key !== 'limit' && b.key !== 'status' && (
                      <div className="issue-fix">
                        <span className="fix-label">Suggested fix</span>
                        <code className="fix-value">{b.suggested_fix}</code>
                        <button className="btn-apply" onClick={() => applyFix(b.key, b.suggested_fix)}>Apply</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {loading && (
              <div className="result-group">
                <div className="result-group-label" style={{ color: '#818cf8' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2.5" className="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  Running AI analysis...
                </div>
                {[1,2,3].map(i => <div key={i} className="skeleton"></div>)}
              </div>
            )}
            {!bugs.length && !aiBugs.length && !loading && (
              <div className="empty-state">
                <div className="empty-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div>
                <p className="empty-title">No diagnostics yet</p>
                <p className="empty-sub">Upload or paste a JSON, YAML, or PO file and run Scan or AI Scan.</p>
              </div>
            )}
          </div>
        </section>
      </main>

      {showMfaModal && (
        <div className="modal-overlay">
          <div className="modal-panel">
            <button className="modal-close" onClick={cancelMFAEnrollment}>&times;</button>
            {mfaStep === 'error' ? (
              <div><h2>Error Enabling MFA</h2><p style={{color: 'var(--red)', marginTop: '16px'}}>{mfaError}</p></div>
            ) : mfaStep === 'setup' ? (
              <div>
                <h2>Enable Two-Factor Authentication</h2>
                <p className="muted-copy" style={{marginTop: '8px', marginBottom: '16px'}}>Scan the QR code with your authenticator app.</p>
                <img src={mfaQrCode} alt="MFA QR Code" className="mfa-qr-code" />
                <p className="muted-copy">Or enter this secret manually:</p>
                <div className="mfa-secret">{mfaSecret}</div>
                <button className="btn-primary" style={{width: '100%', marginTop: '16px'}} onClick={() => { setMfaStep('verify'); setMfaError(''); }}>Next</button>
              </div>
            ) : (
              <div>
                <h2>Verify Code</h2>
                <p className="muted-copy" style={{marginTop: '8px', marginBottom: '16px'}}>Enter the 6-digit code from your authenticator app.</p>
                <form onSubmit={handleVerifyMFA}>
                  <div className="field-group" style={{margin: '20px 0'}}>
                    <label className="field-label">Verification Code</label>
                    <input className={`form-input ${mfaError ? 'input-error' : ''}`} type="text" value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))} maxLength={6} placeholder="123456" autoComplete="one-time-code" required />
                    {mfaError && <span className="field-error">{mfaError}</span>}
                  </div>
                  <button className="btn-primary" type="submit" disabled={mfaLoading || mfaCode.length !== 6} style={{width: '100%'}}>
                    {mfaLoading ? <span className="btn-loading"><span></span><span></span><span></span></span> : 'Verify and Enable'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Dashboard />);