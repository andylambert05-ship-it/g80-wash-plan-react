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
import { useWakeLock } from './hooks/useWakeLock'
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
import WeatherBanner from './components/WeatherBanner'
import WashDayPicker from './components/WashDayPicker'
import Modal from './components/Modal'
import { fetchFile, flushPending, getPendingOps } from './utils/PlanStore'

// ── 5 top-level tabs with sub-navigation ────────────────────────────────────
const TABS = [
  { id: 'wash', label: 'Wash', icon: 'ti-droplet' },
  { id: 'inventory', label: 'Inventory', icon: 'ti-flask' },
  { id: 'care', label: 'Care', icon: 'ti-calendar-event' },
  { id: 'upgrades', label: 'Upgrades', icon: 'ti-tools' },
  { id: 'more', label: 'More', icon: 'ti-dots' },
]

const SUBTABS = {
  wash: [
    { id: 'steps', label: 'Steps' },
    { id: 'shortlist', label: 'ShortList' },
    { id: 'interior', label: 'Interior' },
    { id: 'engine', label: 'Engine Bay' },
  ],
  inventory: [
    { id: 'chems', label: 'Chemicals' },
    { id: 'tools', label: 'Tools' },
  ],
  care: [
    { id: 'reminders', label: 'Reminders' },
    { id: 'between', label: 'Between Washes' },
    { id: 'seasonal', label: 'Seasonal' },
  ],
  more: [
    { id: 'history', label: 'History' },
    { id: 'settings', label: 'Settings' },
  ],
}

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  // Tab position is persisted so a reload - including the automatic one after a
  // deploy - puts you back where you were instead of on the landing tab.
  const DEFAULT_SUB = { wash: 'steps', inventory: 'chems', care: 'reminders', more: 'history' }
  const [activeTab, setActiveTab] = useState(() => {
    try { return localStorage.getItem('gwp_tab') || 'wash' } catch { return 'wash' }
  })
  const [sub, setSub] = useState(() => {
    try { return { ...DEFAULT_SUB, ...JSON.parse(localStorage.getItem('gwp_sub') || '{}') } }
    catch { return DEFAULT_SUB }
  })
  const { mode, setMode, done, toggleStep, resetSteps, engDone, toggleEng, resetEng, intDone, toggleInt, resetInt } = useWashState()
  const [theme, setTheme] = useState(() => localStorage.getItem('gwp_theme') || 'dark')
  const [addForm, setAddForm] = useState(null) // 'chemical' | 'tool' | 'upgrade'
  const [pendingOps, setPendingOps] = useState(getPendingOps)

  const activeSub = sub[activeTab] || null
  const setActiveSub = (id) => setSub(s => ({ ...s, [activeTab]: id }))
  const panelKey = `${activeTab}-${activeSub || ''}`

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('gwp_theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')
  const { timer, start: startTimer, stop: stopTimer, extend: extendTimer } = useTimer()

  // Screen Wake Lock — keep phone screen alive while a timer is running
  useWakeLock(!!timer)

  // Pull-to-refresh — re-reads the plan from the Worker
  const refreshData = useCallback(() => {
    return fetchFile()
      .then(({ content }) => { setData(content); setError(null) })
      .catch(() => {})
  }, [])
  const pullState = usePullToRefresh(refreshData)

  useEffect(() => {
    try {
      localStorage.setItem('gwp_tab', activeTab)
      localStorage.setItem('gwp_sub', JSON.stringify(sub))
    } catch {}
  }, [activeTab, sub])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [panelKey])

  // Re-read the plan whenever the app regains focus, so an edit made on another
  // device shows up without a pull-to-refresh. Only touches `data` - unsaved
  // local edits live in their own localStorage cache and are unaffected.
  // Any successful write anywhere in the app updates the view immediately.
  // PlanStore hands us the document it just wrote, so there is nothing to fetch.
  useEffect(() => {
    const onSaved = (e) => { if (e.detail) { setData(e.detail); setError(null) } }
    window.addEventListener('plan-saved', onSaved)
    return () => window.removeEventListener('plan-saved', onSaved)
  }, [])

  useEffect(() => {
    const onVisible = () => { if (!document.hidden) refreshData() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [refreshData])

  useEffect(() => {
    fetchFile()
      .then(({ content }) => setData(content))
      .catch(err => setError(err.message))
    // Retry any writes queued while offline
    flushPending()
  }, [])

  // Offline write queue indicator
  useEffect(() => {
    const onPending = (e) => setPendingOps(e.detail?.ops ?? getPendingOps())
    window.addEventListener('plan-pending', onPending)
    return () => window.removeEventListener('plan-pending', onPending)
  }, [])

  if (error) return (
    <div className="app">
      <div className="panel" style={{ textAlign: 'center', paddingTop: 48 }}>
        <i className="ti ti-alert-triangle" style={{ fontSize: 32, color: 'var(--red)', marginBottom: 12, display: 'block' }} aria-hidden="true" />
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--t1)', marginBottom: 8 }}>Could not load plan</div>
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

  // Sticky mini-progress — only meaningful on Wash > Steps
  const visibleSteps = getVisibleSteps(data, mode)
  const stepsDone = visibleSteps.filter(s => done.has(s.id)).length
  const stepsPct = visibleSteps.length > 0 ? Math.round((stepsDone / visibleSteps.length) * 100) : 0
  const showMiniProgress = activeTab === 'wash' && activeSub === 'steps' && stepsDone > 0

  // Mode toggle only matters on Wash + Inventory
  const showModeRow = activeTab === 'wash' || activeTab === 'inventory'

  // Contextual + button
  const addAction =
    activeTab === 'inventory' && activeSub === 'chems' ? 'chemical' :
    activeTab === 'inventory' && activeSub === 'tools' ? 'tool' :
    activeTab === 'upgrades' ? 'upgrade' : null

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
      {/* Sticky mini progress — top of viewport on Wash > Steps */}
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
            {addAction && (
              <button className="theme-toggle" onClick={() => setAddForm(addAction)} title={`Add ${addAction}`} aria-label={`Add ${addAction}`}>
                <i className="ti ti-plus" aria-hidden="true" />
              </button>
            )}
            <div className="ver">v{meta.version}</div>
          </div>
        </div>

        {showModeRow && (
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
        )}
      </div>

      {/* Top-level tabs moved to bottom (see .bottom-nav below) */}

      {/* Offline write queue pill */}
      {pendingOps > 0 && (
        <div style={{ padding: '10px 20px 0' }}>
          <button className="pending-pill" onClick={() => flushPending()} title="Tap to retry sync">
            <i className="ti ti-cloud-off" aria-hidden="true" />
            {pendingOps} change{pendingOps !== 1 ? 's' : ''} pending sync — tap to retry
          </button>
        </div>
      )}

      {/* Sub-navigation */}
      {SUBTABS[activeTab] && (
        <div className="subnav">
          {SUBTABS[activeTab].map(st => (
            <button
              key={st.id}
              className={`subnav-btn ${activeSub === st.id ? 'active' : ''}`}
              onClick={() => {
                try { navigator.vibrate && navigator.vibrate(8) } catch (e) {}
                setActiveSub(st.id)
              }}
            >
              {st.label}
            </button>
          ))}
        </div>
      )}

      {/* Panels — keyed div re-triggers fade on every tab/sub change */}
      <div key={panelKey} className="tab-panel">
        {activeTab === 'wash' && <WeatherBanner />}
        {activeTab === 'wash' && activeSub === 'steps' && <WashDayPicker />}
        {activeTab === 'wash' && activeSub === 'steps' && (
          <TabSteps
            data={data} mode={mode} done={done} activeId={timer?.activeId}
            onToggle={toggleStep} onReset={resetSteps} onStartTimer={startTimer}
          />
        )}
        {activeTab === 'wash' && activeSub === 'shortlist' && <TabShortList mode={mode} />}
        {activeTab === 'wash' && activeSub === 'interior' && (
          <TabInterior
            data={data} intDone={intDone}
            onToggle={toggleInt} onReset={resetInt} onStartTimer={startTimer}
            chemicals={data.chemicals}
          />
        )}
        {activeTab === 'wash' && activeSub === 'engine' && (
          <TabEngine
            data={data} engDone={engDone}
            onToggle={toggleEng} onReset={resetEng}
            chemicals={data.chemicals}
          />
        )}

        {activeTab === 'inventory' && activeSub === 'chems' && (
          <div className="panel-full">
            <TabChemicals data={data} mode={mode} />
          </div>
        )}
        {activeTab === 'inventory' && activeSub === 'tools' && <TabTools data={data} />}

        {activeTab === 'care' && activeSub === 'reminders' && <ErrorBoundary><TabReminders data={data} /></ErrorBoundary>}
        {activeTab === 'care' && activeSub === 'between' && <TabBetweenWash data={data} />}
        {activeTab === 'care' && activeSub === 'seasonal' && <TabSeasonal data={data} />}

        {activeTab === 'upgrades' && <ErrorBoundary><TabUpgrades data={data} /></ErrorBoundary>}

        {activeTab === 'more' && activeSub === 'history' && <ErrorBoundary><TabHistory data={data} mode={mode} done={done} /></ErrorBoundary>}
        {activeTab === 'more' && activeSub === 'settings' && <ErrorBoundary><TabSettings /></ErrorBoundary>}

        {/* Floating add forms */}
        {addForm === 'chemical' && (
          <Modal onClose={() => setAddForm(null)} label="Add chemical">
            <AddChemicalForm data={data} onClose={() => setAddForm(null)} />
          </Modal>
        )}
        {addForm === 'tool' && (
          <Modal onClose={() => setAddForm(null)} label="Add tool">
            <AddToolForm data={data} onClose={() => setAddForm(null)} />
          </Modal>
        )}
        {addForm === 'upgrade' && (
          <Modal onClose={() => setAddForm(null)} label="Add upgrade">
            <AddUpgradeForm data={data} onClose={() => setAddForm(null)} />
          </Modal>
        )}
      </div>

      {/* Floating timer */}
      {timer && <FloatingTimer timer={timer} onStop={stopTimer} onExtend={extendTimer} />}

      {/* Bottom navigation — fixed, thumb-reach friendly */}
      <nav className="bottom-nav" role="tablist" aria-label="Primary">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              className={`bnav-btn ${isActive ? 'active' : ''}`}
              onClick={() => {
                try { navigator.vibrate && navigator.vibrate(8) } catch (e) {}
                setActiveTab(tab.id)
              }}
            >
              <i className={`ti ${tab.icon}`} aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
