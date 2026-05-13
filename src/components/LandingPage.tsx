"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import "./landing-page.css";

const DOWNLOAD_URL = "https://github.com/geraldbngmedia-lgtm/Taplo-desktop/releases/latest/download/Taplo.Setup.0.1.0.exe";

const faqs = [
  { q: "Does Taplo join my calls as a bot?", a: "No. Taplo captures system audio on your machine, the same way a screen recorder does. Your candidate never sees a bot in the participant list, and there's no third party in the meeting." },
  { q: "What about consent?", a: "You're responsible for getting recording consent from candidates, the same as you would with any other tool. Taplo includes a one-line consent script you can paste into your scheduler, and the recording UI is visible on your screen for the whole call." },
  { q: "What does the AI actually do?", a: "It transcribes the call and drafts structured observations against the rubric you defined for the role, each one linked back to a specific transcript moment. It does not score candidates, rank them, infer personality, or recommend hiring decisions. Those calls stay with you." },
  { q: "Which platforms work?", a: "Anything that plays audio through your computer: Zoom, Google Meet, Teams, Around, in-person on a laptop mic, phone screens via QuickTime, and so on. Taplo doesn't care about the conferencing tool. It captures what you hear." },
  { q: "How does pricing work?", a: "Per-seat, billed monthly or annually. Solo plan is free for up to 5 interviews a month. Team plans start at $24/seat/mo and include shared workspaces, SSO, and ATS export. Full pricing on the pricing page." },
  { q: "Can I self-host?", a: "Yes. Enterprise plans support self-hosted transcription and analysis, with your own model endpoints. Talk to us for a deployment plan." },
];

export function LandingPage({ onGetStarted }: { onGetStarted: () => void }) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => { entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("lp-in"); io.unobserve(e.target); } }); },
      { threshold: 0.08 },
    );
    document.querySelectorAll(".lp-reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="lp-root">
      {/* NAV */}
      <nav className="lp-nav">
        <div className="lp-container">
          <div className="lp-nav-inner">
            <a className="lp-brand" href="#" aria-label="Taplo">
              <Image className="lp-brand-logo" src="/brand/taplo-logo-full-color.png" alt="Taplo" width={112} height={28} />
            </a>
            <div className="lp-nav-links">
              <a href="#features">Features</a>
              <a href="#how">How it works</a>
              <a href="#privacy">Security</a>
              <a href="#faq">FAQ</a>
            </div>
            <div className="lp-nav-cta">
              <a className="lp-btn-pill lp-light" href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="lp-hero">
        <div className="lp-hero-inner lp-container">
          <h1 className="lp-h1">
            Interview notes that{" "}
            <span className="lp-mark">
              write themselves.
              <svg className="lp-wash" viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden="true">
                <path d="M2,9 C30,5 60,11 100,8 C140,5 170,10 198,7 L198,11 C170,14 140,9 100,12 C60,15 30,9 2,13 Z" />
              </svg>
            </span>
          </h1>
          <p className="lp-hero-sub">
            Taplo captures and transcribes every interview locally, then drafts structured, evidence-linked notes for hiring teams. Always private and secure.
          </p>
          <div className="lp-hero-ctas">
            <a className="lp-btn-pill lp-light" href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download Taplo, it&apos;s free
            </a>
            <a className="lp-btn-pill lp-ghost" href="#how">
              <span className="lp-play"><svg viewBox="0 0 8 10" fill="currentColor"><polygon points="0,0 8,5 0,10" /></svg></span>
              Watch how it works
            </a>
          </div>
          <div className="lp-download-meta">
            <span>No credit card</span>
            <span className="lp-dot" />
            <span>Windows · macOS coming soon</span>
          </div>
        </div>

        {/* Hero product mock */}
        <div className="lp-mock-wrap">
          <div className="lp-mock">
            <div className="lp-live-chip">
              <span className="lp-pulse-dot" />
              Recording · 24:17
            </div>
            <div className="lp-mock-bar">
              <div className="lp-mock-dots"><span /><span /><span /></div>
              <span className="lp-mock-title">Taplo · Senior PM · Lina Okafor</span>
            </div>
            <div className="lp-mock-body">
              <div className="lp-mock-side-col">
                <h5>Roles</h5>
                <ul>
                  <li className="lp-active"><span className="lp-ico" />Senior PM</li>
                  <li><span className="lp-ico" />Staff Engineer</li>
                  <li><span className="lp-ico" />Design Lead</li>
                </ul>
                <h5>Candidates</h5>
                <ul>
                  <li className="lp-active">Lina Okafor</li>
                  <li>Marcus Patel</li>
                  <li>Jules Reyes</li>
                </ul>
              </div>
              <div className="lp-mock-main">
                <div className="lp-mock-h">
                  <strong>Lina Okafor · Round 2</strong>
                  <span className="lp-meta">04 May · 52 min</span>
                </div>
                <div className="lp-seg"><span className="lp-ts">08:14</span><div><div className="lp-who">Recruiter</div><p>Can you walk me through a time you had to re-scope a project mid-flight?</p></div></div>
                <div className="lp-seg lp-hl"><span className="lp-ts">08:41</span><div><div className="lp-who">Lina</div><p>We were three weeks into the build when the data team flagged the pipeline wasn&apos;t ready. Instead of slipping the date I rewrote the brief around a phased beta.</p></div></div>
                <div className="lp-seg"><span className="lp-ts">21:18</span><div><div className="lp-who">Lina</div><p>Reframes behind-plan as a scope question, not just a date question.</p></div></div>
              </div>
              <div className="lp-mock-aside-col">
                <h5>Live insights</h5>
                <div className="lp-insight"><div className="lp-tag">Signal</div><p>Strong scoping instinct, reframes timeline pressure as a scope problem.</p><div className="lp-ev">08:41</div></div>
                <div className="lp-insight"><div className="lp-tag">Probe</div><p>Ask: how does she handle partner-team disagreement after the reframe?</p><div className="lp-ev">follow-up</div></div>
                <div className="lp-insight"><div className="lp-tag">Signal</div><p>Single memo, three audience framings, facts held constant.</p><div className="lp-ev">22:11</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="lp-s" id="features">
        <div className="lp-container">
          <div className="lp-s-head lp-reveal">
            <span className="lp-eyebrow">Features</span>
            <h2 className="lp-s-title">Everything a hiring team needs. Nothing it doesn&apos;t.</h2>
            <p className="lp-s-sub">Built for recruiters who care about the quality of their notes, not just their throughput.</p>
          </div>
          <div className="lp-features lp-reveal">
            <div className="lp-feature">
              <div className="lp-feature-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg></div>
              <h3>System-audio capture</h3>
              <p>Records both sides of any Zoom, Meet, or Teams call without joining as a bot. Works on Wi-Fi, on a plane, with one app open or twelve.</p>
            </div>
            <div className="lp-feature">
              <div className="lp-feature-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg></div>
              <h3>Speaker-aware transcripts</h3>
              <p>Diarized, timestamped, searchable. Every line is anchored to the second it happened, so insights link straight back to evidence.</p>
            </div>
            <div className="lp-feature">
              <div className="lp-feature-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9"/></svg></div>
              <h3>Role-aware drafts</h3>
              <p>Notes structured around the rubric you defined for the role, not a generic summary. Insights are observations, never scores.</p>
            </div>
            <div className="lp-feature">
              <div className="lp-feature-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
              <h3>On-device by default</h3>
              <p>Recording, transcription, and storage live on your machine. Send anything to the cloud only when you explicitly choose to.</p>
            </div>
            <div className="lp-feature">
              <div className="lp-feature-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/></svg></div>
              <h3>Panel-ready exports</h3>
              <p>One click sends a clean debrief to Greenhouse, Lever, Ashby, Notion, or PDF, with citations preserved.</p>
            </div>
            <div className="lp-feature">
              <div className="lp-feature-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
              <h3>Always on standby</h3>
              <p>Lives in your menu bar. Hit the shortcut the moment a call starts. Taplo wakes, captures, and gets out of the way.</p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="lp-s" id="how" style={{ paddingTop: 0 }}>
        <div className="lp-container">
          <div className="lp-s-head lp-reveal">
            <span className="lp-eyebrow">How it works</span>
            <h2 className="lp-s-title">Three taps, from raw call to ready debrief.</h2>
          </div>
          <div className="lp-steps">
            {/* Step 1 */}
            <div className="lp-step lp-reveal">
              <div className="lp-step-no">Step 01</div>
              <h3>Connect your calendar.</h3>
              <p>Sync Google or Outlook and Taplo pulls in your upcoming interviews. Candidate, role, and round, ready to record the moment the call starts.</p>
              <div className="lp-step-img">
                <div className="lp-sm-cal">
                  <div className="lp-sm-cal-top">
                    <b>Upcoming</b>
                    <div className="lp-sm-conn">
                      <span className="lp-sm-conn-chip"><span className="lp-g" />Google</span>
                      <span className="lp-sm-conn-chip"><span className="lp-g" />Outlook</span>
                    </div>
                  </div>
                  <div className="lp-sm-cal-body">
                    <div className="lp-sm-cal-day">Today · Tue 12 May</div>
                    <div className="lp-sm-cal-item lp-now">
                      <div className="lp-t">10:00</div>
                      <div className="lp-w">Lina Okafor<small>Senior PM · Round 2</small></div>
                      <div className="lp-st lp-ready">live</div>
                    </div>
                    <div className="lp-sm-cal-item">
                      <div className="lp-t">14:30</div>
                      <div className="lp-w">Marcus Patel<small>Staff Engineer · Round 1</small></div>
                      <div className="lp-st">queued</div>
                    </div>
                    <div className="lp-sm-cal-day">Tomorrow</div>
                    <div className="lp-sm-cal-item">
                      <div className="lp-t">09:30</div>
                      <div className="lp-w">Jules Reyes<small>Design Lead · Round 3</small></div>
                      <div className="lp-st">queued</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="lp-step lp-reveal">
              <div className="lp-step-no">Step 02</div>
              <h3>Press record. See live insights as you talk.</h3>
              <p>Taplo sits in your menu bar, captures the call locally, and surfaces suggested follow-ups, signal hits, and open probes in real time so you can steer the conversation while it happens.</p>
              <div className="lp-step-img">
                <div className="lp-sm-mb">
                  <div className="lp-sm-mb-bar">
                    <span className="lp-sm-apple" />
                    <span className="lp-sm-menu"><span>Zoom</span><span>Meeting</span><span>View</span></span>
                    <span className="lp-sm-bar-right">
                      <span className="lp-sm-tap-ico"><span className="lp-sm-blink" />REC 24:17</span>
                      <span>100%</span><span>10:24</span>
                    </span>
                  </div>
                  <div className="lp-sm-mb-window">
                    <div className="lp-sm-win-dots"><span /><span /><span /></div>
                    <div className="lp-sm-win-line lp-m" /><div className="lp-sm-win-line lp-s" />
                    <div className="lp-sm-win-line lp-m" /><div className="lp-sm-win-line lp-s" />
                    <div className="lp-sm-win-line lp-m" />
                  </div>
                  <div className="lp-sm-mb-pop">
                    <div className="lp-sm-pop-row"><b>Recording</b><span className="lp-sm-timer">24:17</span></div>
                    <div className="lp-sm-pop-meta">Senior PM · L. Okafor</div>
                    <div className="lp-sm-mb-wave">
                      {Array.from({ length: 12 }).map((_, i) => <span key={i} />)}
                    </div>
                    <div className="lp-sm-live-h">Live insights</div>
                    <div className="lp-sm-live">
                      <div className="lp-sm-live-i"><span className="lp-tg">signal</span><span>Scoping vs. date framing</span></div>
                      <div className="lp-sm-live-i"><span className="lp-tg lp-blue">probe</span><span>Ask about partner-team pushback</span></div>
                    </div>
                    <div className="lp-sm-ctrls">
                      <div className="lp-sm-ctrl">Pause</div>
                      <div className="lp-sm-ctrl lp-pri">Stop</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="lp-step lp-reveal">
              <div className="lp-step-no">Step 03</div>
              <h3>Get the analysis and a ready-to-send dossier.</h3>
              <p>Taplo matches every observation back to the JD, then drafts a candidate presentation your panel can read in two minutes and forward in one click.</p>
              <div className="lp-step-img">
                <div className="lp-sm-exp">
                  <div className="lp-sm-exp-top">
                    <b>Candidate dossier</b>
                    <span className="lp-sm-crumb">L. Okafor · Senior PM</span>
                  </div>
                  <div className="lp-sm-exp-body">
                    <div className="lp-sm-jd-row">
                      <div className="lp-sm-jd">
                        <div className="lp-sm-jd-h">JD signal</div>
                        <div className="lp-sm-jd-bars">
                          <div className="lp-sm-bar"><span className="lp-lbl">Scoping</span><span className="lp-track"><span className="lp-fill" style={{ width: "88%" }} /></span><span className="lp-ev-s">3 obs</span></div>
                          <div className="lp-sm-bar"><span className="lp-lbl">Stakeholder comms</span><span className="lp-track"><span className="lp-fill" style={{ width: "74%" }} /></span><span className="lp-ev-s">2 obs</span></div>
                          <div className="lp-sm-bar"><span className="lp-lbl">Tech tradeoffs</span><span className="lp-track"><span className="lp-fill lp-blue" style={{ width: "52%" }} /></span><span className="lp-ev-s">1 obs</span></div>
                          <div className="lp-sm-bar"><span className="lp-lbl">Org design</span><span className="lp-track"><span className="lp-fill lp-blue" style={{ width: "28%" }} /></span><span className="lp-ev-s">probe</span></div>
                        </div>
                      </div>
                      <div className="lp-sm-pres">
                        <div className="lp-sm-pres-h">
                          <span className="lp-sm-ai"><svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" /></svg>AI draft</span>
                          <span>Panel-ready</span>
                        </div>
                        <div className="lp-sm-pres-body">
                          <div className="lp-sm-pres-title">Lina Okafor</div>
                          <div className="lp-sm-pres-sub">Strong scoping, clear comms. Probe org design in R3.</div>
                          <div className="lp-sm-pres-tags"><span>scoping</span><span>comms</span><span>+ probe</span></div>
                        </div>
                        <div className="lp-sm-pres-foot">
                          <span className="lp-sm-pres-btn">Edit</span>
                          <span className="lp-sm-pres-btn lp-pri">Send to panel</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DEEP BLOCKS */}
      <div className="lp-container">
        <div className="lp-block lp-reveal">
          <div className="lp-block-text">
            <span className="lp-eyebrow">Structured drafts</span>
            <h3>Notes shaped by the role, not the model&apos;s mood.</h3>
            <p>Taplo drafts against the rubric you defined. Every signal in the same slot, every time. Easier to compare candidates. Easier to defend the decision later.</p>
            <ul>
              <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Every observation cites the exact transcript second.</li>
              <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>No hire/no-hire scores, no personality reads, no inferred traits.</li>
              <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Open questions surfaced for follow-up panels.</li>
            </ul>
            <a className="lp-btn lp-btn-outline" href="#">Read the methodology <svg className="lp-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg></a>
          </div>
          <div className="lp-block-visual">
            <div className="lp-doc">
              <div className="lp-doc-tabs">
                <div className="lp-doc-tab">Transcript</div>
                <div className="lp-doc-tab lp-active">Debrief draft</div>
                <div className="lp-doc-tab">Export</div>
              </div>
              <div className="lp-crumb">Senior PM · Round 2 · Lina Okafor · 04 May</div>
              <h4>Interview debrief</h4>
              <div className="lp-hr" />
              <h5>Scoping &amp; tradeoffs</h5>
              <div className="lp-li"><b>obs</b><span>Reframes &ldquo;behind plan&rdquo; as a scope question, not just a date question.</span><span className="lp-stamp">21:18</span></div>
              <div className="lp-li"><b>obs</b><span>Used phased beta to unblock a downstream team while continuing scope work.</span><span className="lp-stamp">21:34</span></div>
              <h5>Stakeholder communication</h5>
              <div className="lp-li"><b>obs</b><span>Single memo, three audience framings, facts held constant.</span><span className="lp-stamp">22:11</span></div>
              <div className="lp-li"><b className="lp-ask">ask</b><span>How does she handle disagreement from the partner team after the reframe?</span><span className="lp-stamp">...</span></div>
              <h5>Open questions for next round</h5>
              <div className="lp-li"><b className="lp-ask">ask</b><span>Examples of when phased delivery was the wrong call.</span><span className="lp-stamp">...</span></div>
            </div>
          </div>
        </div>

        <div className="lp-block lp-reverse lp-reveal">
          <div className="lp-block-text">
            <span className="lp-eyebrow">Workspaces</span>
            <h3>One library, every candidate, every round.</h3>
            <p>Roles, candidates, sessions, and rubrics live together in a local workspace. Search across rounds, compare candidates side-by-side, share a single panel link without losing context.</p>
            <ul>
              <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Roles, candidates, sessions, transcripts. One searchable graph.</li>
              <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Side-by-side compare across rounds and candidates.</li>
              <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Optional team sync. Encrypted, role-scoped.</li>
            </ul>
          </div>
          <div className="lp-block-visual">
            <div className="lp-roles">
              {[
                { title: "Senior Product Manager", meta: "8 candidates · 14 sessions · open", pill: "live", pillMoss: true, av: ["LO","MP","JR","+5"] },
                { title: "Staff Engineer, Platform", meta: "12 candidates · 31 sessions · open", pill: "round 3", pillMoss: false, av: ["KH","RA","SN","+9"] },
                { title: "Design Lead, Workspaces", meta: "5 candidates · 9 sessions · open", pill: "debrief", pillMoss: true, av: ["BV","TM","+3"] },
                { title: "Senior Recruiter, Eng", meta: "closed · archived 12 Apr", pill: "closed", pillMoss: false, av: ["DK"] },
              ].map((r) => (
                <div key={r.title} className="lp-role-card">
                  <div className="lp-rl"><b>{r.title}</b><span className="lp-meta">{r.meta}</span></div>
                  <div className="lp-rr">
                    <span className={`lp-pill${r.pillMoss ? " lp-moss" : ""}`}>{r.pill}</span>
                    <div className="lp-avatars">{r.av.map((a) => <div key={a}>{a}</div>)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* PRIVACY */}
      <section className="lp-s" id="privacy" style={{ paddingTop: 24 }}>
        <div className="lp-container">
          <div className="lp-privacy lp-reveal">
            <div className="lp-privacy-grid">
              <div>
                <span className="lp-eyebrow" style={{ color: "rgba(246,243,236,0.5)" }}>Privacy by default</span>
                <h3>Interviews are sensitive. We treat them like it.</h3>
                <p>Taplo was designed around one principle: the people in the room own the recording. Everything else follows from that.</p>
              </div>
              <div className="lp-privacy-cards">
                {[
                  { icon: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>, title: "Local-first", body: "Audio and transcripts stay on the machine that recorded them, unless you choose to sync." },
                  { icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>, title: "No training on you", body: "Your recordings, transcripts, and notes are never used to train models. Ours or anyone else's." },
                  { icon: <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>, title: "EU-region option", body: "Sync to EU-hosted infrastructure or your own S3 bucket. GDPR and SOC 2 ready." },
                  { icon: <><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>, title: "Observations only", body: "No automated scoring, ranking, or hire/no-hire recommendations. Decisions stay with humans." },
                ].map((c) => (
                  <div key={c.title} className="lp-privacy-card">
                    <svg className="lp-pico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{c.icon}</svg>
                    <h4>{c.title}</h4>
                    <p>{c.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-s" id="faq" style={{ paddingTop: 24 }}>
        <div className="lp-container" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 80 }}>
          <div className="lp-reveal">
            <span className="lp-eyebrow">FAQ</span>
            <h2 className="lp-s-title" style={{ marginBottom: 14 }}>Questions, briefly.</h2>
            <p className="lp-s-sub" style={{ fontSize: 16 }}>Can&apos;t find what you&apos;re after? <a href="#" style={{ textDecoration: "underline", textDecorationColor: "var(--lp-moss)", textUnderlineOffset: 4 }}>Email us</a>. A human replies within a day.</p>
          </div>
          <div className="lp-faq-list lp-reveal">
            {faqs.map((item, i) => (
              <div key={i} className={`lp-faq-item${openFaq === i ? " lp-open" : ""}`}>
                <button className="lp-faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)} type="button">
                  {item.q}
                  <span className="lp-icn"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span>
                </button>
                <div className="lp-faq-a"><div className="lp-faq-a-inner">{item.a}</div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="lp-s" style={{ paddingTop: 24 }}>
        <div className="lp-container">
          <div className="lp-cta lp-reveal">
            <span className="lp-eyebrow" style={{ position: "relative" }}>Get started</span>
            <h3>Run a better interview tomorrow.</h3>
            <p>Download Taplo, point it at your next call, and ship the cleanest debrief your hiring panel has seen.</p>
            <div className="lp-cta-ctas">
              <button className="lp-btn lp-btn-primary lp-btn-lg" onClick={onGetStarted} type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Create workspace
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-foot-grid">
            <div>
              <a className="lp-brand" href="#" aria-label="Taplo">
                <Image className="lp-brand-logo-foot" src="/brand/taplo-logo-full-color.png" alt="Taplo" width={120} height={30} />
              </a>
              <p className="lp-foot-tag">A quiet desktop companion for hiring teams that take interviews seriously.</p>
            </div>
            <div>
              <h5>Product</h5>
              <ul>
                <li><a href="#features">Features</a></li>
                <li><a href="#how">How it works</a></li>
                <li><a href="#">Pricing</a></li>
                <li><a href="#">Changelog</a></li>
              </ul>
            </div>
            <div>
              <h5>Company</h5>
              <ul>
                <li><a href="#">Methodology</a></li>
                <li><a href="#">Customers</a></li>
                <li><a href="#">Careers</a></li>
                <li><a href="#">Contact</a></li>
              </ul>
            </div>
            <div>
              <h5>Trust</h5>
              <ul>
                <li><a href="#privacy">Privacy</a></li>
                <li><a href="#">Security</a></li>
                <li><a href="#">Responsible AI</a></li>
                <li><a href="#">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="lp-foot-bottom">
            <span>© 2026 TAPLO LABS · MADE QUIETLY</span>
            <span>STATUS · ALL SYSTEMS NORMAL</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
