import { useState, useEffect } from 'react'
import './index.css'
import { useTimer } from './hooks/useTimer'
import { useWashState } from './hooks/useWashState'
import FloatingTimer from './components/FloatingTimer'
import TabSteps from './components/TabSteps'
import TabChemicals from './components/TabChemicals'
import {
  TabShortList, TabTools, TabInterior, TabEngine, TabBetweenWash, TabSeasonal
} from './components/Tabs'

const TABS = [
  { id: 'steps', label: 'Steps' },
  { id: 'chems', label: 'Chemicals' },
  { id: 'shortlist', label: 'ShortList' },
  { id: 'tools', label: 'Tools' },
  { id: 'interior', label: 'Interior' },
  { id: 'engine', label: 'Engine Bay' },
  { id: 'between', label: 'Between Washes' },
  { id: 'seasonal', label: 'Seasonal' },
]

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('steps')
  const { mode, setMode, done, toggleStep, resetSteps, engDone, toggleEng, resetEng, intDone, toggleInt, resetInt } = useWashState()
  const { timer, start: startTimer, stop: stopTimer } = useTimer()

  useEffect(() => {
    fetch('wash-plan.json')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(setData)
      .catch(err => setError(err.message))
  }, [])

  if (error) return (
    <div className="app">
      <div className="panel" style={{ textAlign: 'center', paddingTop: 48 }}>
        <i className="ti ti-alert-triangle" style={{ fontSize: 32, color: 'var(--red)', marginBottom: 12, display: 'block' }} aria-hidden="true" />
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--t1)', marginBottom: 8 }}>Could not load wash-plan.json</div>
        <div style={{ fontSize: 12, color: 'var(--t3)' }}>{error}</div>
      </div>
    </div>
  )

  if (!data) return (
    <div className="app">
      <div className="panel" style={{ textAlign: 'center', paddingTop: 48 }}>
        <div style={{ fontSize: 13, color: 'var(--t3)' }}>Loading wash plan…</div>
      </div>
    </div>
  )

  const { meta } = data

  return (
    <div className="app">
      {/* Header */}
      <div className="hdr" style={{ position: 'relative' }}>
        <div className="hdr-top">
          <div className="hdr-left">
            <div className="bmw-badge">
              <div className="bq bl" /><div className="bq wh" />
              <div className="bq wh" /><div className="bq bl" />
            </div>
            <div>
              <div className="hdr-title">{meta.title}</div>
              <div className="hdr-sub">{meta.car} &middot; Updated {meta.lastUpdated}</div>
            </div>
          </div>
          <div className="ver">v{meta.version}</div>
        </div>

        <div className="mode-row">
          <button
            className={`mbtn ${mode === 'normal' ? 'normal' : ''}`}
            onClick={() => setMode('normal')}
          >
            <i className="ti ti-droplet" aria-hidden="true" /> Bi-weekly wash
          </button>
          <button
            className={`mbtn ${mode === 'maint' ? 'maint' : ''}`}
            onClick={() => setMode('maint')}
          >
            <i className="ti ti-shield-check" aria-hidden="true" /> Ceramic maintenance
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panels */}
      {activeTab === 'steps' && (
        <TabSteps
          data={data} mode={mode} done={done}
          onToggle={toggleStep} onReset={resetSteps} onStartTimer={startTimer}
        />
      )}
      {activeTab === 'chems' && <TabChemicals data={data} mode={mode} />}
      {activeTab === 'shortlist' && <TabShortList mode={mode} />}
      {activeTab === 'tools' && <TabTools data={data} />}
      {activeTab === 'interior' && (
        <TabInterior
          data={data} intDone={intDone}
          onToggle={toggleInt} onReset={resetInt} onStartTimer={startTimer}
        />
      )}
      {activeTab === 'engine' && (
        <TabEngine
          data={data} engDone={engDone}
          onToggle={toggleEng} onReset={resetEng}
        />
      )}
      {activeTab === 'between' && <TabBetweenWash data={data} />}
      {activeTab === 'seasonal' && <TabSeasonal data={data} />}

      {/* Floating timer */}
      {timer && <FloatingTimer timer={timer} onStop={stopTimer} />}
    </div>
  )
}
