import { useState } from 'react'
import { getConfig, saveConfig, testConnection } from '../utils/GitHubSync'

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
    if (!config.pat) return
    setTesting(true)
    setTestResult(null)
    try {
      const login = await testConnection(config.pat)
      setTestResult({ ok: true, message: `Connected as @${login}` })
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
        value={config[key]}
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
        <span>Configure your GitHub Personal Access Token to enable adding chemicals, tools, and upgrades directly from the app. Changes commit to your repo and deploy automatically via GitHub Actions (~60 sec).</span>
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--bd2)', padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t1)', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--bd)' }}>
          GitHub Configuration
        </div>

        {field('Personal Access Token', 'pat', {
          type: 'password',
          placeholder: 'ghp_...',
          hint: 'Scopes required: Contents (read + write) on this repo only. Settings → Developer settings → Personal access tokens → Fine-grained tokens.',
        })}
        {field('Repository Owner', 'owner', { placeholder: 'andylambert05-ship-it' })}
        {field('Repository Name', 'repo', { placeholder: 'g80-wash-plan-react' })}
        {field('Branch', 'branch', { placeholder: 'main' })}

        <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          <button
            onClick={handleSave}
            style={{ padding: '8px 20px', background: saved ? '#1a9e62' : '#0066b1', color: '#fff', border: 'none', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'background 0.2s' }}
          >
            {saved ? '✓ Saved' : 'Save settings'}
          </button>
          <button
            onClick={handleTest}
            disabled={!config.pat || testing}
            style={{ padding: '8px 20px', background: 'transparent', color: !config.pat ? 'var(--t3)' : 'var(--t1)', border: '1px solid var(--bd2)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: config.pat ? 'pointer' : 'default', fontFamily: 'Inter, sans-serif', opacity: !config.pat ? 0.5 : 1 }}
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
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t1)', marginBottom: 12 }}>How to create a PAT</div>
        {[
          'Go to GitHub.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens',
          'Click "Generate new token"',
          'Set Token name: "M3 Care Plan App"',
          'Set Expiration: No expiration (or 1 year)',
          'Under Repository access: select "Only select repositories" → g80-wash-plan-react',
          'Under Repository permissions → Contents: set to "Read and write"',
          'Click "Generate token" and paste it above',
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
