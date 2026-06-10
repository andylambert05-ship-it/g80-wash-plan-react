import { useState, useEffect, useCallback, Component } from 'react'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('Tab error:', error, info) }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 20, color: '#cc1e1e', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
        <div style={{ fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Error loading tab</div>
        <div style={{ color: '#888', fontWeight: 300 }}>{this.state.error.message}</div>
      </div>
    )
    return this.props.children
  }
}
import './index.css'
import { useTimer } from './hooks/useTimer'
import { usePullToRefresh } from './hooks/usePullToRefresh'
import { getVisibleSteps } from './constants'
import { useWashState } from './hooks/useWashState'
import FloatingTimer from './components/FloatingTimer'
import TabSteps from './components/TabSteps'
import TabChemicals from './components/TabChemicals'
import {
  TabShortList, TabTools, TabInterior, TabEngine, TabBetweenWash, TabSeasonal
} from './components/Tabs'
import TabUpgrades from './components/TabUpgrades'
import TabHistory from './components/TabHistory'
import TabReminders from './components/TabReminders'
import TabSettings from './components/TabSettings'
import { AddChemicalForm, AddToolForm, AddUpgradeForm } from './components/SyncForm'

const TABS = [
  { id: 'steps', label: 'Steps' },
  { id: 'chems', label: 'Chemicals' },
  { id: 'shortlist', label: 'ShortList' },
  { id: 'tools', label: 'Tools' },
  { id: 'interior', label: 'Interior' },
  { id: 'engine', label: 'Engine Bay' },
  { id: 'between', label: 'Between Washes' },
  { id: 'seasonal', label: 'Seasonal' },
  { id: 'upgrades', label: 'Upgrades' },
  { id: 'history', label: 'History' },
  { id: 'reminders', label: 'Reminders' },
  { id: 'settings', label: 'Settings' },
]

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('steps')
  const { mode, setMode, done, toggleStep, resetSteps, engDone, toggleEng, resetEng, intDone, toggleInt, resetInt } = useWashState()
  const [theme, setTheme] = useState(() => localStorage.getItem('gwp_theme') || 'dark')
  const [historyKey, setHistoryKey] = useState(0)
  const [addForm, setAddForm] = useState(null) // 'chemical' | 'tool' | 'upgrade' // increment to force TabHistory refresh

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('gwp_theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')
  const { timer, start: startTimer, stop: stopTimer } = useTimer()

  // Pull-to-refresh — re-fetches wash-plan.json
  const refreshData = useCallback(() => {
    return fetch('wash-plan.json?' + Date.now())
      .then(r => r.json())
      .then(d => { setData(d); setError(null) })
      .catch(() => {})
  }, [])
  const pullState = usePullToRefresh(refreshData)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [activeTab])

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

  // Sticky mini-progress — only meaningful on the Steps tab
  const visibleSteps = getVisibleSteps(data, mode)
  const stepsDone = visibleSteps.filter(s => done.has(s.id)).length
  const stepsPct = visibleSteps.length > 0 ? Math.round((stepsDone / visibleSteps.length) * 100) : 0
  const showMiniProgress = activeTab === 'steps' && stepsDone > 0

  return (
    <div className="app">
      {/* Pull-to-refresh indicator */}
      {(pullState.pulling || pullState.refreshing) && (
        <div className="ptr-indicator" style={{ height: `calc(${pullState.pullDistance}px + env(safe-area-inset-top, 0px))` }}>
          <div className={`ptr-spinner${pullState.refreshing ? ' spinning' : ''}`}>
            {pullState.refreshing ? (
              <i className="ti ti-loader-2" aria-hidden="true" />
            ) : pullState.pullDistance >= 80 ? (
              <i className="ti ti-arrow-down" aria-hidden="true" />
            ) : (
              <i className="ti ti-arrow-down" style={{ opacity: pullState.pullDistance / 80 }} aria-hidden="true" />
            )}
          </div>
          <div className="ptr-text">
            {pullState.refreshing ? 'Updating…' : pullState.pullDistance >= 80 ? 'Release to refresh' : 'Pull to refresh'}
          </div>
        </div>
      )}
      {/* Sticky mini progress — top of viewport on Steps tab */}
      {showMiniProgress && (
        <div className="mini-progress">
          <div className="mini-progress-bar" style={{ width: `${stepsPct}%` }} />
        </div>
      )}
      {/* Header */}
      <div className="hdr" style={{ position: 'relative' }}>
        <div className="hdr-top">
          <div className="hdr-left">
            <div className="m-stripe">
              <div className="ms ms1" />
              <div className="ms ms2" />
              <div className="ms ms3" />
            </div>
            <div>
              <div className="hdr-title">{meta.title}</div>
              <div className="hdr-sub">{meta.car} &middot; Updated {meta.lastUpdated}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} aria-label="Toggle theme">
              <i className={`ti ${theme === 'dark' ? 'ti-sun' : 'ti-moon'}`} aria-hidden="true" />
            </button>
            {activeTab === 'chems' && (
              <button className="theme-toggle" onClick={() => setAddForm('chemical')} title="Add chemical" aria-label="Add chemical">
                <i className="ti ti-plus" aria-hidden="true" />
              </button>
            )}
            {activeTab === 'tools' && (
              <button className="theme-toggle" onClick={() => setAddForm('tool')} title="Add tool" aria-label="Add tool">
                <i className="ti ti-plus" aria-hidden="true" />
              </button>
            )}
            {activeTab === 'upgrades' && (
              <button className="theme-toggle" onClick={() => setAddForm('upgrade')} title="Add upgrade" aria-label="Add upgrade">
                <i className="ti ti-plus" aria-hidden="true" />
              </button>
            )}
            <div className="ver">v{meta.version}</div>
          </div>
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
            <i className="ti ti-shield-check" aria-hidden="true" /> Deep Clean
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

      {/* Panels — keyed div re-triggers fade on every tab change */}
      <div key={activeTab} className="tab-panel">
        {activeTab === 'steps' && (
          <TabSteps
            data={data} mode={mode} done={done} activeId={timer?.activeId}
            onToggle={toggleStep} onReset={resetSteps} onStartTimer={startTimer}
          />
        )}
        {activeTab === 'chems' && (
        <div className="panel-full">
          <TabChemicals data={data} mode={mode} />
        </div>
      )}
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
        {activeTab === 'upgrades' && <ErrorBoundary><TabUpgrades data={data} /></ErrorBoundary>}
      {activeTab === 'history' && <ErrorBoundary><TabHistory data={data} mode={mode} done={done} /></ErrorBoundary>}
      {activeTab === 'reminders' && <ErrorBoundary><TabReminders /></ErrorBoundary>}
      {activeTab === 'settings' && <ErrorBoundary><TabSettings /></ErrorBoundary>}
      {/* Floating add forms */}
      {addForm === 'chemical' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, overflowY: 'auto', padding: 16 }}>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <AddChemicalForm data={data} onClose={() => setAddForm(null)} />
          </div>
        </div>
      )}
      {addForm === 'tool' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, overflowY: 'auto', padding: 16 }}>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <AddToolForm data={data} onClose={() => setAddForm(null)} />
          </div>
        </div>
      )}
      {addForm === 'upgrade' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, overflowY: 'auto', padding: 16 }}>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <AddUpgradeForm data={data} onClose={() => setAddForm(null)} />
          </div>
        </div>
      )}
      </div>

      {/* Floating timer */}
      {timer && <FloatingTimer timer={timer} onStop={stopTimer} />}
    </div>
  )
}
