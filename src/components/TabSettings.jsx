import { useState } from 'react'
import { getConfig, saveConfig, testConnection } from '../utils/PlanStore'

export default function TabSettings() {
  const [config, setConfig] = useState(getConfig)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null) // { ok, message }
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    saveConfig(config)
    setSaved(true)
    setTestResult(null)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTest = async () => {
    if (!config.token) return
    setTesting(true)
    setTestResult(null)
    try {
      await testConnection(config.token)
      setTestResult({ ok: true, message: 'Connected — plan loaded from the Worker' })
    } catch (e) {
      setTestResult({ ok: false, message: e.message })
    } finally {
      setTesting(false)
    }
  }

  const field = (label, key, opts = {}) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t3)', display: 'block', marginBottom: 5 }}>{label}</label>
      <input
        type={opts.type || 'text'}
        value={config[key] || ''}
        onChange={e => setConfig(c => ({ ...c, [key]: e.target.value }))}
        placeholder={opts.placeholder}
        style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '8px 10px', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none' }}
      />
      {opts.hint && <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4, fontWeight: 300 }}>{opts.hint}</div>}
    </div>
  )

  return (
    <div className="panel">
      <div className="notice info" style={{ marginBottom: 20 }}>
        <i className="ti ti-info-circle" aria-hidden="true" />
        <span>Enter your plan API token to enable adding and editing chemicals, tools, and upgrades from the app. Saves write straight to the database and apply instantly — no commit, no deploy.</span>
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--bd2)', padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t1)', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--bd)' }}>
          Plan API
        </div>

        {field('Plan API token', 'token', {
          type: 'password',
          placeholder: '••••••••',
          hint: 'Required for saving. Reading the plan works without it. Set on the Worker with: wrangler secret put PLAN_TOKEN',
        })}

        <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          <button
            onClick={handleSave}
            style={{ padding: '8px 20px', background: saved ? '#1a9e62' : '#0066b1', color: '#fff', border: 'none', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'background 0.2s' }}
          >
            {saved ? '✓ Saved' : 'Save settings'}
          </button>
          <button
            onClick={handleTest}
            disabled={!config.token || testing}
            style={{ padding: '8px 20px', background: 'transparent', color: !config.token ? 'var(--t3)' : 'var(--t1)', border: '1px solid var(--bd2)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: config.token ? 'pointer' : 'default', fontFamily: 'Inter, sans-serif', opacity: !config.token ? 0.5 : 1 }}
          >
            {testing ? 'Testing…' : 'Test connection'}
          </button>
        </div>

        {testResult && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: testResult.ok ? 'var(--green-bg)' : 'var(--red-bg)', border: `1px solid ${testResult.ok ? 'var(--iom-bd)' : 'var(--red-bd)'}`, fontSize: 12, color: testResult.ok ? 'var(--iom)' : '#cc1e1e', fontWeight: 300 }}>
            {testResult.ok ? '✓ ' : '✗ '}{testResult.message}
          </div>
        )}
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--bd2)', padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t1)', marginBottom: 12 }}>Where the data lives</div>
        {[
          'The plan is stored in Cloudflare D1 and served by the m3care Worker.',
          'Reads are open. Writes require the token above, checked by the Worker.',
          'To set or rotate it: wrangler secret put PLAN_TOKEN, then re-enter it here.',
          'Saves apply immediately \u2014 no GitHub commit and no Pages deploy.',
        ].map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 20, height: 20, background: '#0066b1', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
            <div style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 300, lineHeight: 1.6, paddingTop: 2 }}>{step}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
