const { useState, useEffect } = React;

const supabaseUrl = 'https://fzkqspzrcheajchczeoa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6a3FzcHpyY2hlYWpjaGN6ZW9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODk4NzEsImV4cCI6MjA5MjI2NTg3MX0.SI-9E-ZNRpi3BmIcAdGpuq3iW-MunBwC92gpA9bmwH8';
const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

function validateEmail(email) {
  const re = /^[a-zA-Z0-9]([a-zA-Z0-9._%+\-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  if (!email) return "Email address is required.";
  if (!re.test(email)) return "Please enter a valid email address.";
  if (/\.\./.test(email)) return "Email cannot contain consecutive dots.";
  return null;
}

function LandingPage() {
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistError, setWaitlistError] = useState('');
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);

  const goToLogin = () => {
    window.location.href = 'dashboard.html'; 
  };

  const handleJoinWaitlist = async () => {
    const error = validateEmail(waitlistEmail);
    if (error) {
      setWaitlistError(error);
      return;
    }
    setWaitlistError('');
    setWaitlistLoading(true);
    setWaitlistSuccess(false);

    try {
      const res = await fetch("/api/join-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: waitlistEmail })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Something went wrong');

      setWaitlistSuccess(true);
      setWaitlistEmail(''); 
    } catch (err) {
      setWaitlistError(err.message);
    } finally {
      setWaitlistLoading(false);
    }
  };

  return (
    <div>
      <style>{`
        ::-webkit-scrollbar { display: none; }
        html, body { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes scan-animation {
          from { top: 0; opacity: 0.7; }
          to { top: 100%; opacity: 0; }
        }
        .scan-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: #a78bfa;
          box-shadow: 0 0 10px #a78bfa;
          animation: scan-animation 3s ease-out infinite;
          animation-delay: 1s;
          z-index: 10;
        }
      `}</style>

      
      <nav className="fixed top-0 w-full z-50 bg-[#0f0f1a]/80 backdrop-blur-md border-b border-[#2a2a3d] flex justify-between items-center h-16 px-8 font-['Space_Grotesk'] text-sm tracking-wide">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[#818cf8] rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(79,70,229,0.3)]">
            <span className="text-white font-black text-xl">L!</span>
          </div>
          <span className="text-2xl font-black text-[#a78bfa]">Localit</span>
        </div>
        <div className="hidden md:flex gap-8">
          <a className="text-[#a78bfa] font-bold border-b-2 border-[#a78bfa] pb-1 hover:text-[#818cf8] transition" href="#features">Features</a>
          <a className="text-[#888] font-medium hover:text-[#a78bfa] transition" href="#how-it-works">How it Works</a>
          <a className="text-[#888] font-medium hover:text-[#a78bfa] transition" href="#pricing">Pricing</a>
        </div>
        <div className="flex items-center gap-4">
          <button className="px-5 py-2 text-[#a78bfa] font-medium hover:text-[#818cf8] transition" onClick={goToLogin}>Login</button>
          <button className="px-6 py-2 bg-[#818cf8] text-white font-bold rounded-lg hover:bg-[#4338ca] shadow-[0_0_10px_rgba(79,70,229,0.4)] transition active:scale-95" onClick={goToLogin}>Start Free</button>
        </div>
      </nav>

      
      <main className="relative pt-32 px-8 overflow-hidden min-h-screen pb-4">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-[#4f46e5]/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 -right-20 w-[500px] h-[500px] bg-[#a78bfa]/5 rounded-full blur-[120px] pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <div className="flex flex-col items-start gap-8 z-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#4f46e5]/10 border border-[#4f46e5]/20 text-[#a78bfa] font-medium text-xs uppercase tracking-widest">
              <span>✦</span> AI-Powered Translation QA
            </div>
            <h1 className="text-5xl lg:text-7xl font-black text-white leading-tight">
              Find bugs in your <span className="text-[#a78bfa]">translation files</span> instantly
            </h1>
            <p className="text-lg text-[#888] max-w-lg leading-relaxed">
              Upload your JSON, YAML, or PO files and get AI-powered analysis in seconds. Catch missing translations, broken placeholders, and inconsistent terminology before they reach production.
            </p>
            <div className="flex flex-wrap pt-4 gap-4">
              <button className="flex items-center gap-3 px-8 py-4 bg-[#818cf8] text-white font-bold rounded-xl hover:bg-[#4338ca] shadow-[0_0_15px_rgba(79,70,229,0.4)] transition active:scale-95" onClick={goToLogin}>
                Get started free
              </button>
              <button className="flex items-center gap-3 px-8 py-4 bg-transparent text-[#a78bfa] border border-[#a78bfa]/50 font-bold rounded-xl hover:bg-[#4f46e5]/10 transition active:scale-95" onClick={goToLogin}>
                Try demo file
              </button>
            </div>
            <div className="flex items-center gap-8 pt-8 text-[#666] text-xs">
              <div className="flex items-center gap-2">
                <span>✓</span>
                <span className="font-medium">5 free scans/month</span>
              </div>
              <div className="flex items-center gap-2">
                <span>✓</span>
                <span className="font-medium">No credit card required</span>
              </div>
            </div>
          </div>

          
          <div className="relative z-10 lg:pl-12">
            <div className="bg-[#1a1a2e] rounded-2xl overflow-hidden shadow-2xl border border-[#2a2a3d] transform rotate-2 hover:rotate-0 transition-transform duration-700">
              
              <div className="flex items-center gap-2 px-4 py-3 bg-[#2a2a3d] border-b border-[#2a2a3d]">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
                <div className="ml-4 text-xs text-[#666] font-mono">translations_en.json</div>
              </div>
              
              <div className="p-6 font-mono text-sm leading-relaxed overflow-hidden relative">
                <div className="scan-line"></div>
                <div className="flex gap-4">
                  <div className="text-[#3a3a5c] text-right select-none w-8">
                    1<br/>2<br/>3<br/>4<br/>5<br/>6<br/>7<br/>8
                  </div>
                  <div className="text-[#ccc]">
                    {"{"}<br/>
                    &nbsp;&nbsp;<span className="text-[#a78bfa]">"login_button"</span>: <span className="text-[#98c379]">"Log In"</span>,<br/>
                    &nbsp;&nbsp;<span className="text-[#a78bfa]">"logout_button"</span>: <span className="text-[#f97316]">""</span>,<br/>
                    &nbsp;&nbsp;<span className="text-[#a78bfa]">"greeting"</span>: <span className="text-[#98c379]">"Hello, {"{"} username"</span>,<br/>
                    &nbsp;&nbsp;<span className="text-[#a78bfa]">"error_msg"</span>: <span className="text-[#98c379]">"Something went wrong"</span><br/>
                    {"}"}
                  </div>
                </div>
                
                <div className="absolute top-1/2 left-1/3 bg-[#1e1e2e] p-4 rounded-xl border-2 border-[#f97316] shadow-[0_0_30px_rgba(249,115,22,0.2)] backdrop-blur-md z-20">
                  <div className="flex items-center gap-2 text-[#fb923c] text-xs font-bold uppercase mb-2">
                    <span>⚠</span> Missing Translation
                  </div>
                  <div className="text-xs text-[#666]">
                    Key: <span className="text-[#f97316]">"logout_button"</span> has no value
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      
      <section id="features" className="max-w-7xl mx-auto px-8 pb-24 pt-12">
        <div className="text-center mb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#a78bfa] mb-4">Features</h2>
          <p className="text-4xl font-bold text-white">Everything you need for translation QA</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="md:col-span-2 bg-[#1a1a2e] p-10 rounded-3xl border border-[#2a2a3d] hover:border-[#4f46e5]/50 transition">
            <div className="flex flex-col gap-6">
              <div>
                <span className="text-[#a78bfa] text-sm font-bold uppercase tracking-widest">AI-Powered Analysis</span>
                <h3 className="text-3xl font-bold text-white mt-2">Beyond rule-based checks</h3>
                <p className="text-[#888] mt-4 max-w-md">AI reads your translations and catches unnatural phrasing, inconsistent terminology, and cultural issues that regex can't find.</p>
              </div>
              <div className="flex gap-4 mt-4">
                <div className="flex-1 bg-[#0f0f1a] rounded-xl border border-[#2a2a3d] p-4">
                  <div className="text-[#a78bfa] text-xs font-bold mb-2">Rule-Based</div>
                  <div className="text-2xl font-bold text-white">4 issues</div>
                  <div className="text-xs text-[#666] mt-1">Empty values, broken syntax</div>
                </div>
                <div className="flex-1 bg-[#0f0f1a] rounded-xl border border-[#4f46e5]/50 p-4 shadow-[0_0_15px_rgba(79,70,229,0.2)]">
                  <div className="text-[#a78bfa] text-xs font-bold mb-2">AI Analysis</div>
                  <div className="text-2xl font-bold text-white">12 issues</div>
                  <div className="text-xs text-[#666] mt-1">+ unnatural phrasing, tone</div>
                </div>
              </div>
            </div>
          </div>

          
          <div className="bg-[#1a1a2e] p-10 rounded-3xl border border-[#2a2a3d] flex flex-col justify-between hover:border-[#4f46e5]/50 transition">
            <div>
              <span className="text-[#a78bfa] text-sm font-bold uppercase tracking-widest">Multi-Format</span>
              <h3 className="text-2xl font-bold text-white mt-2">Works with your stack</h3>
            </div>
            <div className="mt-8 space-y-3">
              <div className="bg-[#0f0f1a] rounded-lg p-3 border border-[#2a2a3d] text-sm text-[#ccc] font-mono">.json</div>
              <div className="bg-[#0f0f1a] rounded-lg p-3 border border-[#2a2a3d] text-sm text-[#ccc] font-mono">.yaml / .yml</div>
              <div className="bg-[#0f0f1a] rounded-lg p-3 border border-[#2a2a3d] text-sm text-[#ccc] font-mono">.po (gettext)</div>
            </div>
          </div>

          
          <div className="bg-[#1a1a2e] p-8 rounded-3xl border border-[#2a2a3d] hover:border-[#4f46e5]/50 transition">
            <div className="w-12 h-12 bg-[#4f46e5]/20 rounded-xl flex items-center justify-center text-2xl mb-4">✨</div>
            <h4 className="font-bold text-white text-lg">One-Click Fixes</h4>
            <p className="text-sm text-[#888] mt-2">AI suggests corrections for every bug. Apply them with one click or download the fixed file.</p>
          </div>

          <div className="bg-[#1a1a2e] p-8 rounded-3xl border border-[#2a2a3d] hover:border-[#4f46e5]/50 transition">
            <div className="w-12 h-12 bg-[#22c55e]/20 rounded-xl flex items-center justify-center text-2xl mb-4">📁</div>
            <h4 className="font-bold text-white text-lg">Scan History</h4>
            <p className="text-sm text-[#888] mt-2">Every scan is saved. Come back anytime to see past results or re-run analysis on updated files.</p>
          </div>

          <div className="bg-[#1a1a2e] p-8 rounded-3xl border border-[#2a2a3d] hover:border-[#4f46e5]/50 transition">
            <div className="w-12 h-12 bg-[#a78bfa]/20 rounded-xl flex items-center justify-center text-2xl mb-4">⚡</div>
            <h4 className="font-bold text-white text-lg">Lightning Fast</h4>
            <p className="text-sm text-[#888] mt-2">Rule-based checks run instantly. AI analysis completes in under 3 seconds for most files.</p>
          </div>
        </div>
      </section>

      
      <section id="pricing" className="max-w-5xl mx-auto px-8 pb-24">
        <div className="text-center mb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#a78bfa] mb-4">Pricing</h2>
          <p className="text-4xl font-bold text-white">Simple, transparent pricing</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <div className="bg-[#1a1a2e] rounded-2xl p-8 border border-[#2a2a3d] flex flex-col">
            <div className="flex-grow">
              <div className="text-[#a78bfa] font-bold text-sm uppercase tracking-wider mb-2">Free</div>
              <div className="text-4xl font-black text-white mb-1">$0<span className="text-lg text-[#666]">/month</span></div>
              <p className="text-[#888] text-sm mb-6">Perfect for trying it out</p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-3 text-sm text-[#ccc]">
                  <span className="text-[#22c55e]">✓</span>
                  <span>5 scans per month</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-[#ccc]">
                  <span className="text-[#22c55e]">✓</span>
                  <span>JSON files only</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-[#ccc]">
                  <span className="text-[#22c55e]">✓</span>
                  <span>7-day scan history</span>
                </li>
              </ul>
            </div>
            <button className="w-full py-3 bg-[#2a2a3d] text-white font-bold rounded-lg hover:bg-[#3a3a4d] transition" onClick={goToLogin}>Start Free</button>
          </div>

          
          <div className="bg-[#1a1a2e] rounded-2xl p-8 border-2 border-[#4f46e5] relative overflow-hidden flex flex-col">
            <div className="flex-grow">
              <div className="absolute top-4 right-4 bg-[#4f46e5] text-white text-xs font-bold px-3 py-1 rounded-full">Popular</div>
              <div className="text-[#a78bfa] font-bold text-sm uppercase tracking-wider mb-2">Pro (wait-list)</div>
              <div className="text-4xl font-black text-white mb-1">$19<span className="text-lg text-[#666]">/month</span></div>
              <p className="text-[#888] text-sm mb-6">For professional teams</p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-3 text-sm text-[#ccc]">
                  <span className="text-[#22c55e]">✓</span>
                  <span><strong>Unlimited scans</strong></span>
                </li>
                <li className="flex items-start gap-3 text-sm text-[#ccc]">
                  <span className="text-[#22c55e]">✓</span>
                  <span>All formats (JSON, YAML, PO)</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-[#ccc]">
                  <span className="text-[#22c55e]">✓</span>
                  <span>Unlimited scan history</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-[#ccc]">
                  <span className="text-[#22c55e]">✓</span>
                  <span>Priority support</span>
                </li>
              </ul>
            </div>
            <div>
              {waitlistSuccess ? (
                <div className="text-center p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-300 font-medium">
                  🎉 You're on the list! We'll be in touch.
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={waitlistEmail}
                      onChange={(e) => { setWaitlistEmail(e.target.value); if (waitlistError) setWaitlistError(''); }}
                      placeholder="you@company.com"
                      className={`flex-grow w-full px-4 py-3 bg-[#0f0f1a] border ${waitlistError ? 'border-red-500' : 'border-[#2a2a3d]'} rounded-lg text-sm text-white placeholder:text-[#666] focus:ring-2 focus:ring-[#4f46e5] focus:border-[#4f46e5] outline-none transition`}
                      disabled={waitlistLoading}
                    />
                    <button
                      className="px-6 py-3 bg-[#818cf8] text-white font-bold rounded-lg hover:bg-[#4338ca] shadow-[0_0_15px_rgba(79,70,229,0.4)] transition active:scale-95 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleJoinWaitlist}
                      disabled={waitlistLoading}
                    >
                      {waitlistLoading ? 'Joining...' : 'Join'}
                    </button>
                  </div>
                  {waitlistError && <p className="text-xs text-red-400 mt-2 pl-1">{waitlistError}</p>}
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      
      <footer className="border-t border-[#2a2a3d] px-8 py-12 bg-[#0f0f1a]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-[#818cf8] rounded flex items-center justify-center">
                <span className="text-white font-black text-xs">L!</span>
              </div>
              <span className="text-lg font-black text-white">Localit</span>
            </div>
            <p className="text-xs text-[#666]">© 2024 Localit. All rights reserved.</p>
          </div>
          <div className="flex gap-8 text-sm font-medium text-[#888]">
            <a className="hover:text-[#a78bfa] transition" href="#">Privacy</a>
            <a className="hover:text-[#a78bfa] transition" href="#">Terms</a>
            <a className="hover:text-[#a78bfa] transition" href="#">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<LandingPage />);