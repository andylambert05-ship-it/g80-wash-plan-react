import { useState, useEffect, useCallback } from 'react'

const DATA_URL = import.meta.env.BASE_URL + 'audio-build.json'
const CHECK_KEY = 'gwp_audio_check'

function loadChecks() {
  try { return new Set(JSON.parse(localStorage.getItem(CHECK_KEY) || '[]')) } catch { return new Set() }
}

// ── Signal chain schematic ───────────────────────────────────────────────────
// Vertical by design: this gets read on a phone in a garage, so the flow runs
// top-to-bottom and fits a 400px viewport without pinch-zooming.
function Schematic() {
  return (
    <svg
      className="au-svg"
      viewBox="0 0 400 590"
      role="img"
      aria-label="Signal flow: BMW ID8 head unit sends automotive Ethernet to the eWay optical box, which dead-ends the retained factory amplifier and sends TOSLINK optical S/PDIF to the MATCH UP 10DSP. Nine amplified channels feed the speakers, with the two-ohm under-seat woofers on channels I and J. An isolated pre-out feeds the MATCH UP 1FX driving the ResoNix GUS-12."
    >
      <defs>
        <marker id="au-a-eth" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="#9b4fd4" />
        </marker>
        <marker id="au-a-opt" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--red)" />
        </marker>
        <marker id="au-a-spk" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--blue)" />
        </marker>
        <marker id="au-a-line" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--t3)" />
        </marker>
      </defs>

      {/* head unit */}
      <rect className="au-box" x="8" y="10" width="268" height="52" />
      <text className="au-t"  x="20" y="32">BMW ID8 head unit</text>
      <text className="au-t2" x="20" y="49">Volume, EQ, chimes, PDC</text>

      <line className="au-w-eth" x1="80" y1="62" x2="80" y2="92" markerEnd="url(#au-a-eth)" />
      <text className="au-l-eth" x="90" y="82">ETHERNET</text>

      {/* eWay */}
      <rect className="au-box" x="8" y="96" width="268" height="62" />
      <text className="au-t"  x="20" y="118">eWay Optical / Coax Box</text>
      <text className="au-t2" x="20" y="134">Ethernet audio to digital out</text>
      <text className="au-m"  x="20" y="150">2x TOSLINK   2x COAX</text>

      {/* factory amp dead end */}
      <line className="au-w-eth" x1="276" y1="127" x2="292" y2="127" markerEnd="url(#au-a-eth)" />
      <rect className="au-ghost" x="296" y="103" width="96" height="48" />
      <text className="au-gh" x="306" y="122" fontWeight="700">Factory amp</text>
      <text className="au-gh" x="306" y="138">dead end</text>

      <line className="au-w-opt" x1="80" y1="158" x2="80" y2="192" markerEnd="url(#au-a-opt)" />
      <text className="au-l-opt" x="90" y="180">TOSLINK S/PDIF</text>

      {/* DSP */}
      <rect className="au-box" x="8" y="196" width="268" height="84" />
      <text className="au-t"  x="20" y="218">MATCH UP 10DSP</text>
      <text className="au-t2" x="20" y="234">11-ch DSP · 10-ch amplifier</text>
      <text className="au-m"  x="20" y="253">A-H  65W @ 4R  (3R MIN)</text>
      <text className="au-m"  x="20" y="269">I-J   90W @ 4R / 160W @ 2R</text>

      <line className="au-w-spk" x1="80" y1="280" x2="80" y2="314" markerEnd="url(#au-a-spk)" />
      <text className="au-l-spk" x="90" y="302">9 CHANNELS</text>

      {/* speakers */}
      <rect className="au-box" x="8" y="318" width="268" height="104" />
      <text className="au-m" x="20" y="338">A B    FRONT TWEETERS      4R</text>
      <text className="au-m" x="20" y="354">C D    FRONT MIDRANGES     4R</text>
      <text className="au-m" x="20" y="370">E      CENTER              4R</text>
      <text className="au-m" x="20" y="386">G H    REAR SHELF  -10dB   4R</text>
      <rect className="au-hotbox" x="14" y="394" width="256" height="20" />
      <text className="au-mh" x="20" y="408">I J    UNDER-SEAT 8in      2R</text>

      {/* pre-out to 1FX */}
      <polyline className="au-w-line" points="276,250 348,250 348,462 284,462" markerEnd="url(#au-a-line)" />
      <text className="au-l-line" x="344" y="302" textAnchor="end">RCA PRE-OUT + REM</text>

      {/* 1FX */}
      <rect className="au-box" x="8" y="436" width="268" height="52" />
      <text className="au-t"  x="20" y="458">MATCH UP 1FX</text>
      <text className="au-t2" x="20" y="475">Mono · DirectDSP · 600 W @ 2 ohm</text>

      <line className="au-w-spk" x1="80" y1="488" x2="80" y2="520" markerEnd="url(#au-a-spk)" />

      {/* sub */}
      <rect className="au-box" x="8" y="524" width="268" height="52" />
      <text className="au-t"  x="20" y="546">ResoNix GUS-12</text>
      <text className="au-t2" x="20" y="563">D4 coils parallel · 2 ohm · sealed</text>
    </svg>
  )
}

function Legend() {
  return (
    <div className="au-legend">
      <span><i style={{ background: '#9b4fd4' }} />Ethernet</span>
      <span><i style={{ background: 'var(--red)' }} />Optical</span>
      <span><i style={{ background: 'var(--t3)' }} />Line level</span>
      <span><i style={{ background: 'var(--blue)' }} />Speaker level</span>
      <span><i style={{ background: 'var(--amber)' }} />2 ohm branch</span>
    </div>
  )
}

function Note({ n }) {
  const cls = n.kind === 'warn' ? 'warn' : 'info'
  const icon = n.kind === 'warn' ? 'ti-alert-triangle' : 'ti-info-circle'
  return (
    <div className={`notice ${cls}`} style={{ flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        <i className={`ti ${icon}`} aria-hidden="true" />{n.title}
      </div>
      <div style={{ fontWeight: 300, color: 'var(--t2)' }}>{n.body}</div>
    </div>
  )
}

function Row({ k, name, sub, chips, tone }) {
  return (
    <div className={`au-row ${tone || ''}`}>
      <span className="au-key">{k}</span>
      <div className="au-body">
        <div className="au-nm">{name}</div>
        {sub && <div className="au-sub">{sub}</div>}
        {chips && chips.length > 0 && (
          <div className="au-chips">
            {chips.map((c, i) => (
              <span key={i} className={`au-chip ${c.tone || ''}`}>{c.t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── View: signal chain ───────────────────────────────────────────────────────
function SignalView({ d }) {
  return (
    <div className="panel">
      <div className="sl-header">
        <span className="sl-title">Signal Chain</span>
        <span className="sl-sub">{d.meta.vehicle} · Rev {d.meta.rev}</span>
      </div>

      <div className="au-facts">
        {d.meta.facts.map(f => (
          <div key={f.k} className="au-fact">
            <span className="au-fact-k">{f.k}</span>
            <span className="au-fact-v">{f.v}</span>
          </div>
        ))}
      </div>

      <div className="au-fig">
        <Schematic />
        <Legend />
      </div>
      <div className="au-figcap">{d.meta.summary}</div>

      <div className="slbl">Channel map</div>
      <div className="au-list">
        {d.channels.map(c => (
          <Row
            key={c.ch}
            k={c.ch}
            name={c.driver}
            sub={c.part}
            tone={c.hot ? 'hot' : c.spare ? 'spare' : ''}
            chips={[
              { t: c.load, tone: c.hot ? 'hot' : '' },
              { t: c.avail },
              { t: c.band },
              { t: c.level, tone: c.warn ? 'warn' : '' },
            ].filter(x => x.t && x.t !== '—')}
          />
        ))}
      </div>

      <div className="slbl">Three things that bite</div>
      {d.gotchas.map(n => <Note key={n.title} n={n} />)}
    </div>
  )
}

// ── View: install sheet ──────────────────────────────────────────────────────
function InstallView({ d }) {
  const [checks, setChecks] = useState(loadChecks)

  const toggle = useCallback((item) => {
    setChecks(prev => {
      const next = new Set(prev)
      if (next.has(item)) next.delete(item); else next.add(item)
      try { localStorage.setItem(CHECK_KEY, JSON.stringify([...next])) } catch {}
      return next
    })
  }, [])

  const doneCt = d.checklist.filter(c => checks.has(c)).length
  const pct = d.checklist.length ? Math.round((doneCt / d.checklist.length) * 100) : 0

  return (
    <div className="panel">
      <div className="sl-header">
        <span className="sl-title">Install Sheet</span>
        <span className="sl-sub">Power · wiring · gain · DSP · commissioning</span>
      </div>

      <div className="slbl">Power &amp; ground</div>
      <div className="notice info">
        <i className="ti ti-bolt" aria-hidden="true" />
        <span>{d.power.note}</span>
      </div>
      {d.power.warnings.map(n => <Note key={n.title} n={n} />)}

      <div className="slbl">Wire schedule</div>
      <div className="au-list">
        {d.wiring.map(w => (
          <Row
            key={w.run}
            k={w.run}
            name={w.path}
            sub={w.sub}
            chips={[{ t: w.gauge }, { t: w.prot }, { t: w.note }].filter(x => x.t && x.t !== '—')}
          />
        ))}
      </div>

      <div className="slbl">Gain structure</div>
      <div className="notice info">
        <i className="ti ti-wave-sine" aria-hidden="true" />
        <span>{d.gain.note}</span>
      </div>
      <div className="au-formula">{d.gain.formula}</div>
      <div className="au-list">
        {d.gain.rows.map(g => (
          <Row
            key={g.ch}
            k={g.ch}
            name={g.driver}
            sub={`Amp ${g.amp}  ·  driver ${g.rated}`}
            tone={g.hot ? 'hot' : ''}
            chips={[
              { t: `${g.target} Vpp`, tone: g.hot ? 'hot' : '' },
              { t: g.verdict, tone: g.hot ? 'warn' : '' },
            ]}
          />
        ))}
      </div>

      <div className="slbl">Procedure with the 2C53T</div>
      <div className="sl-list">
        {d.gain.steps.map((s, i) => (
          <div key={i} className="sl-item">
            <span className="sl-num">{i + 1}</span>
            <span className="sl-text">{s}</span>
          </div>
        ))}
      </div>

      <div className="slbl">DSP configuration</div>
      <div className="notice info">
        <i className="ti ti-adjustments" aria-hidden="true" />
        <span>{d.dsp.input}</span>
      </div>
      <div className="notice info">
        <i className="ti ti-box" aria-hidden="true" />
        <span><strong>Enclosure — GUS-12.</strong> {d.dsp.enclosure}</span>
      </div>

      <div className="slbl">Time alignment</div>
      <div className="au-formula">{d.dsp.alignFormula}</div>
      <div className="au-sub" style={{ margin: '8px 0 12px' }}>{d.dsp.alignNote}</div>
      <div className="au-list">
        {d.dsp.align.map(a => (
          <Row
            key={a.ch}
            k={a.ch}
            name={a.driver}
            tone={a.hot ? 'hot' : ''}
            chips={[{ t: a.d }, { t: a.delay, tone: a.hot ? 'hot' : '' }]}
          />
        ))}
      </div>

      <div className="slbl">Order of operations</div>
      <div className="sl-list">
        {d.dsp.order.map((s, i) => (
          <div key={i} className="sl-item">
            <span className="sl-num">{i + 1}</span>
            <span className="sl-text">{s}</span>
          </div>
        ))}
      </div>

      <div className="slbl">Commissioning</div>
      <div className="prog-wrap">
        <div className="prog-meta">
          <span className="prog-lbl">Checked</span>
          <span className="prog-ct">{doneCt} / {d.checklist.length}</span>
        </div>
        <div className="prog-track"><div className="prog-bar" style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="au-list">
        {d.checklist.map(item => {
          const on = checks.has(item)
          return (
            <button
              key={item}
              className={`au-check ${on ? 'on' : ''}`}
              onClick={() => {
                try { navigator.vibrate && navigator.vibrate(8) } catch (e) {}
                toggle(item)
              }}
            >
              <i className={`ti ${on ? 'ti-square-check' : 'ti-square'}`} aria-hidden="true" />
              <span>{item}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Tab shell ────────────────────────────────────────────────────────────────
export default function TabAudio({ view = 'signal' }) {
  const [d, setD] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let alive = true
    fetch(DATA_URL)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(j => { if (alive) setD(j) })
      .catch(e => { if (alive) setErr(e.message) })
    return () => { alive = false }
  }, [])

  if (err) return (
    <div className="panel">
      <div className="notice warn">
        <i className="ti ti-alert-triangle" aria-hidden="true" />
        <span>Could not load audio-build.json — {err}</span>
      </div>
    </div>
  )
  if (!d) return (
    <div className="panel">
      <div className="notice info">
        <i className="ti ti-loader" aria-hidden="true" />
        <span>Loading audio build…</span>
      </div>
    </div>
  )
  return view === 'install' ? <InstallView d={d} /> : <SignalView d={d} />
}
