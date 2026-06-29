import { useState, useEffect, useRef, useCallback } from 'react'
import TabFactoryParts from './TabFactoryParts'
import { getConfig, bulkSetUpgradesDone, verifyUpgradeSync } from '../utils/GitHubSync'

const PHOTO_KEY = 'gwp_upgrade_photos'
const DONE_KEY = 'gwp_upgrades'
const REMINDER_MINS = 15

function loadPhotos() {
  try { return JSON.parse(localStorage.getItem(PHOTO_KEY) || '{}') } catch { return {} }
}
function savePhotos(photos) {
  try { localStorage.setItem(PHOTO_KEY, JSON.stringify(photos)) } catch {}
}
function loadCustomUpgrades() {
  try { return JSON.parse(localStorage.getItem('gwp_custom_upgrades') || '[]') } catch { return [] }
}
function saveCustomUpgrades(items) {
  try { localStorage.setItem('gwp_custom_upgrades', JSON.stringify(items)) } catch {}
}

// Local done cache — keyed by upgrade id, value is true/false
function loadDoneCache() {
  try { return JSON.parse(localStorage.getItem(DONE_KEY) || '{}') } catch { return {} }
}
function saveDoneCache(cache) {
  try { localStorage.setItem(DONE_KEY, JSON.stringify(cache)) } catch {}
}

const SOURCE_COLORS = { Self: '#0066b1', Shop: '#cc1e1e' }
const SOURCE_BG = { Self: '#0d1a2e', Shop: '#1a0000' }
const SOURCE_BD = { Self: '#0d2040', Shop: '#2a0000' }

export default function TabUpgrades({ data }) {
  const [section, setSection] = useState(() => localStorage.getItem('gwp_upgrades_section') || 'mods')
  // Local done overrides — instantly written to localStorage on every tap
  const [doneCache, setDoneCache] = useState(loadDoneCache)
  // Local edits cache: { id: { item, phase, source, notes } }
  const [editCache, setEditCache] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gwp_upgrade_edits') || '{}') } catch { return {} }
  })
  const saveEditCache = (cache) => {
    try { localStorage.setItem('gwp_upgrade_edits', JSON.stringify(cache)) } catch {}
  }
  const [unsaved, setUnsaved] = useState({})
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [saveResult, setSaveResult] = useState(null)
  const [photos, setPhotos] = useState(loadPhotos)
  const [lightbox, setLightbox] = useState(null)
  const [custom, setCustom] = useState(loadCustomUpgrades)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null) // id of item being edited
  const [form, setForm] = useState({ phase: '', customPhase: '', item: '', source: 'Self', notes: '' })
  const reminderRef = useRef(null)

  // Effective item: local edit cache wins over JSON
  const getEffectiveItem = useCallback((item) => {
    if (item.id in editCache) return { ...item, ...editCache[item.id] }
    return item
  }, [editCache])

  // Compute effective done state: local cache wins over JSON
  const isItemDone = useCallback((item) => {
    if (item.id in doneCache) return !!doneCache[item.id]
    return !!item.done
  }, [doneCache])

  // Detect unsaved changes vs the JSON on mount and when data/editCache changes
  useEffect(() => {
    if (!data?.upgrades?.items) return
    const cache = loadDoneCache()
    const diff = {}
    for (const item of data.upgrades.items) {
      if (item.id in cache && !!cache[item.id] !== !!item.done) diff[item.id] = true
      if (item.id in editCache) diff[item.id] = true
    }
    setUnsaved(diff)
  }, [data, editCache])

  // 15-minute reminder timer — starts when first unsaved change appears
  useEffect(() => {
    const hasUnsaved = Object.keys(unsaved).length > 0
    if (hasUnsaved && !reminderRef.current) {
      reminderRef.current = setTimeout(() => {
        setSaveResult({ ok: null, message: `You have unsaved upgrade changes. Save now to sync across devices.` })
        reminderRef.current = null
      }, REMINDER_MINS * 60 * 1000)
    }
    if (!hasUnsaved) {
      if (reminderRef.current) { clearTimeout(reminderRef.current); reminderRef.current = null }
      setSaveResult(null)
    }
    return () => {}
  }, [unsaved])

  // Toggle: instant local write only
  const toggle = (id) => {
    const item = [...(data.upgrades?.items || []), ...custom].find(i => i.id === id)
    if (!item) return
    if (item.custom) {
      const next = custom.map(c => c.id === id ? { ...c, done: !c.done } : c)
      setCustom(next); saveCustomUpgrades(next)
      try { navigator.vibrate && navigator.vibrate(20) } catch (e) {}
      return
    }
    const currentDone = isItemDone(item)
    const newDone = !currentDone
    const nextCache = { ...doneCache, [id]: newDone }
    setDoneCache(nextCache)
    saveDoneCache(nextCache)
    try { navigator.vibrate && navigator.vibrate(20) } catch (e) {}

    // Mark as unsaved if different from JSON, clear if matches JSON
    setUnsaved(prev => {
      const next = { ...prev }
      if (newDone !== !!item.done) next[id] = true
      else delete next[id]
      return next
    })
  }

  // Save: push all local changes to GitHub in one commit, then verify
  const saveToGitHub = async () => {
    const config = getConfig()
    if (!config.pat) {
      setSaveResult({ ok: false, message: 'No GitHub token — check Settings.' })
      return
    }
    if (Object.keys(unsaved).length === 0) {
      setSaveResult({ ok: true, verified: true, message: 'Nothing to save — already up to date.' })
      return
    }
    setSaving(true)
    setSaveResult(null)

    // Snapshot what we're about to push (needed for verification)
    const cache = loadDoneCache()
    const doneDiff = {}
    for (const item of (data.upgrades?.items || [])) {
      if (item.id in cache && !!cache[item.id] !== !!item.done) doneDiff[item.id] = !!cache[item.id]
    }
    const editSnapshot = { ...editCache }

    try {
      await bulkSetUpgradesDone(config, doneDiff, editSnapshot)

      // Clear local caches now that commit succeeded
      const fresh = loadDoneCache()
      Object.keys(doneDiff).forEach(id => delete fresh[id])
      saveDoneCache(fresh)
      setDoneCache(fresh)
      saveEditCache({})
      setEditCache({})
      setUnsaved({})

      const changeCount = Object.keys(doneDiff).length + Object.keys(editSnapshot).length
      setSaving(false)

      // Verify phase — poll GitHub API until changes appear in the JSON
      setVerifying(true)
      setSaveResult({ ok: true, verified: false, message: `${changeCount} change${changeCount !== 1 ? 's' : ''} committed — checking GitHub…` })

      const verified = await verifyUpgradeSync(config, doneDiff, editSnapshot, 12, (attempt, total) => {
        setSaveResult({ ok: true, verified: false, message: `Checking GitHub… (${attempt}/${total})` })
      })
      setVerifying(false)
      setSaveResult({
        ok: true,
        verified,
        message: verified
          ? 'Changes synchronized ✓'
          : `Committed but couldn't verify in time — changes will appear after next reload.`
      })
      try { navigator.vibrate && navigator.vibrate([30, 50, 30]) } catch (e) {}
    } catch (e) {
      setSaving(false)
      setVerifying(false)
      setSaveResult({ ok: false, verified: false, message: `Save failed: ${e.message}` })
    }
  }

  // Edit an item locally — queued until Save
  const editItem = (id, fields) => {
    const isCustom = custom.some(c => c.id === id)
    if (isCustom) {
      const next = custom.map(c => c.id === id ? { ...c, ...fields } : c)
      setCustom(next); saveCustomUpgrades(next)
      return
    }
    const next = { ...editCache, [id]: { ...(editCache[id] || {}), ...fields } }
    setEditCache(next); saveEditCache(next)
    setUnsaved(prev => ({ ...prev, [id]: true }))
  }

  // Delete an item
  const deleteItem = (id) => {
    const isCustom = custom.some(c => c.id === id)
    if (isCustom) {
      const next = custom.filter(c => c.id !== id)
      setCustom(next); saveCustomUpgrades(next)
      return
    }
    // For JSON items, queue a deletion flag
    const next = { ...editCache, [id]: { ...(editCache[id] || {}), _deleted: true } }
    setEditCache(next); saveEditCache(next)
    setUnsaved(prev => ({ ...prev, [id]: true }))
  }

  const openEdit = (item) => {
    const eff = getEffectiveItem(item)
    setForm({ phase: eff.phase, customPhase: '', item: eff.item, source: eff.source || 'Self', notes: eff.notes || '' })
    setEditingId(item.id)
    setShowForm(false)
  }

  const saveEdit = () => {
    if (!form.item.trim()) return
    const phase = form.phase === '__custom__' ? form.customPhase.trim() : form.phase
    editItem(editingId, { item: form.item.trim(), phase, source: form.source, notes: form.notes.trim() })
    setEditingId(null)
    setForm({ phase: '', customPhase: '', item: '', source: 'Self', notes: '' })
  }

  const unsavedCount = Object.keys(unsaved).length

  if (!data.upgrades) return (
    <div className="panel">
      <div className="notice info">
        <i className="ti ti-info-circle" aria-hidden="true" />
        <span>Upgrades data not found in wash-plan.json.</span>
      </div>
    </div>
  )

  const baseItems = data.upgrades.items || []
  const allItems = [...baseItems, ...custom]

  const addItem = () => {
    const phase = form.phase === '__custom__' ? form.customPhase.trim() : form.phase
    if (!form.item.trim() || !phase) return
    const newItem = {
      id: 'custom-' + Date.now(),
      phase,
      item: form.item.trim(),
      source: form.source,
      notes: form.notes.trim(),
      custom: true
    }
    const next = [...custom, newItem]
    setCustom(next)
    saveCustomUpgrades(next)
    setForm({ phase: '', customPhase: '', item: '', source: 'Self', notes: '' })
    setShowForm(false)
  }

  const removeCustom = (id) => {
    const next = custom.filter(c => c.id !== id)
    setCustom(next)
    saveCustomUpgrades(next)
  }

  const addPhoto = (id, label) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment' // prefer rear camera on mobile
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (!file) return
      // Resize + compress to keep localStorage usage reasonable (~150KB per photo)
      const reader = new FileReader()
      reader.onload = (ev) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const MAX = 800
          const ratio = Math.min(MAX / img.width, MAX / img.height, 1)
          canvas.width = Math.round(img.width * ratio)
          canvas.height = Math.round(img.height * ratio)
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.75)
          const next = { ...photos, [id]: [...(photos[id] || []), { src: dataUrl, label, date: new Date().toISOString() }] }
          setPhotos(next)
          savePhotos(next)
        }
        img.src = ev.target.result
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  const removePhoto = (id, idx) => {
    const next = { ...photos, [id]: photos[id].filter((_, i) => i !== idx) }
    if (next[id].length === 0) delete next[id]
    setPhotos(next)
    savePhotos(next)
  }

  // Group by phase preserving order
  const phaseOrder = []
  const phases = {}
  allItems.forEach(item => {
    if (!phases[item.phase]) { phases[item.phase] = []; phaseOrder.push(item.phase) }
    phases[item.phase].push(item)
  })

  const totalDone = allItems.filter(i => isItemDone(i)).length
  const total = allItems.length
  const pct = total > 0 ? Math.round((totalDone / total) * 100) : 0
  const existingPhases = [...new Set(baseItems.map(i => i.phase))]
  const canSubmit = form.item.trim() && (form.phase !== '' && form.phase !== '__custom__' || form.customPhase.trim())

  return (
    <div className="panel">
      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <img src={lightbox.src} alt={lightbox.label} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', border: '1px solid var(--bd2)' }} />
          <div style={{ marginTop: 12, fontSize: 11, color: '#aaa', fontWeight: 300 }}>{lightbox.label} &nbsp;·&nbsp; Tap to close</div>
        </div>
      )}
      {/* Section toggle: Modifications vs OEM+ factory parts */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--card)', border: '1px solid var(--bd)', padding: 3, marginBottom: 14 }}>
        {[
          { id: 'mods', label: 'Modifications', icon: 'ti-tools' },
          { id: 'oem', label: 'OEM+ Parts', icon: 'ti-archive' },
        ].map(s => {
          const active = section === s.id
          return (
            <button
              key={s.id}
              onClick={() => {
                try { navigator.vibrate && navigator.vibrate(8) } catch (e) {}
                setSection(s.id)
                localStorage.setItem('gwp_upgrades_section', s.id)
              }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '8px 10px', border: 'none', cursor: 'pointer',
                background: active ? '#0066b1' : 'transparent',
                color: active ? '#fff' : 'var(--t3)',
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
              }}
            >
              <i className={`ti ${s.icon}`} style={{ fontSize: 12 }} aria-hidden="true" />
              {s.label}
            </button>
          )
        })}
      </div>

      {section === 'oem' ? (
        <TabFactoryParts data={data} />
      ) : (
      <>
      <div className="notice info" style={{ borderLeftColor: '#0066b1' }}>
        <i className="ti ti-car" aria-hidden="true" />
        <span>{data.upgrades.note}</span>
      </div>

      <div className="prog-wrap">
        <div className="prog-meta">
          <span className="prog-lbl">Progress</span>
          <span className="prog-ct">{totalDone} / {total}</span>
        </div>
        <div className="prog-track">
          <div className="prog-bar" style={{ width: `${pct}%`, background: '#0066b1' }} />
        </div>
      </div>

      {/* Save bar — shows when there are unsaved local changes */}
      {(unsavedCount > 0 || saveResult || verifying) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: saveResult?.ok === false ? '#1a0000' : saveResult?.verified ? '#0a1f12' : '#0d1a2e', border: `1px solid ${saveResult?.ok === false ? '#5a1a1a' : saveResult?.verified ? 'var(--iom-bd)' : '#0d2040'}`, marginBottom: 14 }}>
          <div style={{ flex: 1, fontSize: 11, color: saveResult?.ok === false ? '#cc1e1e' : saveResult?.verified ? 'var(--iom)' : '#4d8fce', lineHeight: 1.4, display: 'flex', alignItems: 'center', gap: 6 }}>
            {verifying && <i className="ti ti-loader-2" style={{ fontSize: 12, animation: 'spin 0.8s linear infinite', flexShrink: 0 }} aria-hidden="true" />}
            {saveResult?.verified && <i className="ti ti-circle-check" style={{ fontSize: 13, flexShrink: 0 }} aria-hidden="true" />}
            {saveResult?.message || `${unsavedCount} unsaved change${unsavedCount !== 1 ? 's' : ''} — local only until saved`}
          </div>
          {unsavedCount > 0 && !verifying && (
            <button
              onClick={saveToGitHub}
              disabled={saving}
              style={{ padding: '6px 14px', background: '#0066b1', border: 'none', color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', opacity: saving ? 0.6 : 1, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}
            >
              {saving
                ? <><i className="ti ti-loader-2" style={{ fontSize: 11, animation: 'spin 0.8s linear infinite' }} aria-hidden="true" /> Saving…</>
                : <><i className="ti ti-cloud-upload" style={{ fontSize: 11 }} aria-hidden="true" /> Save</>}
            </button>
          )}
        </div>
      )}

      <button className="rbtn" onClick={() => setShowForm(s => !s)} style={{ marginBottom: 16 }}>
        <i className="ti ti-plus" aria-hidden="true" /> {showForm ? 'Cancel' : 'Add upgrade'}
      </button>

      {showForm && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--bd2)', padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t3)', marginBottom: 12 }}>New Upgrade</div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Phase</label>
            <select
              value={form.phase}
              onChange={e => setForm(f => ({ ...f, phase: e.target.value }))}
              style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif' }}
            >
              <option value="">— Select phase —</option>
              {existingPhases.map(p => <option key={p} value={p}>{p}</option>)}
              <option value="__custom__">New phase...</option>
            </select>
            {form.phase === '__custom__' && (
              <input
                value={form.customPhase}
                onChange={e => setForm(f => ({ ...f, customPhase: e.target.value }))}
                placeholder="New phase name"
                style={{ width: '100%', marginTop: 6, background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif' }}
              />
            )}
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Item *</label>
            <input
              value={form.item}
              onChange={e => setForm(f => ({ ...f, item: e.target.value }))}
              placeholder="Upgrade item name"
              style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif' }}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Source</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Self', 'Shop'].map(s => (
                <button key={s} onClick={() => setForm(f => ({ ...f, source: s }))}
                  style={{ padding: '5px 14px', border: '1px solid', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', cursor: 'pointer', background: form.source === s ? SOURCE_COLORS[s] : 'transparent', color: form.source === s ? '#fff' : 'var(--t3)', borderColor: form.source === s ? SOURCE_COLORS[s] : 'var(--bd2)' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optional notes"
              rows={2}
              style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', resize: 'vertical' }}
            />
          </div>

          <button onClick={addItem} disabled={!canSubmit}
            style={{ background: '#0066b1', color: '#fff', border: 'none', padding: '8px 18px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: canSubmit ? 'pointer' : 'not-allowed', fontFamily: 'Inter, sans-serif', opacity: canSubmit ? 1 : 0.4 }}>
            Add Item
          </button>
        </div>
      )}

      {phaseOrder.map(phase => {
        const items = phases[phase].filter(i => !editCache[i.id]?._deleted)
        if (items.length === 0) return null
        const phaseDone = items.filter(i => isItemDone(i)).length
        return (
          <div key={phase} style={{ marginBottom: 20 }}>
            <div className="phase-hdr" style={{ borderLeftColor: '#0066b1', color: '#ffffff', fontSize: 13 }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#ffffff', flexShrink: 0 }} />
              {phase}
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', marginLeft: 4 }}>({phaseDone}/{items.length})</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {items.map(item => {
                const eff = getEffectiveItem(item)
                const isDone = isItemDone(item)
                const hasUnsavedChange = !!unsaved[item.id]
                return (
                  <div key={item.id}
                    style={{ background: 'var(--card)', border: `1px solid var(--bd)`, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 1, background: '#0066b1' }} />
                    {/* Checkbox — toggle done */}
                    <div onClick={() => toggle(item.id)}
                      style={{ width: 20, height: 20, border: `1px solid ${isDone ? '#0066b1' : 'var(--bd2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: isDone ? '#0066b1' : 'transparent', marginTop: 1, cursor: 'pointer' }}>
                      {isDone && <i className="ti ti-check" style={{ fontSize: 11, color: '#fff' }} aria-hidden="true" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, opacity: isDone ? 0.4 : 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t1)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {eff.item}
                        <span style={{ fontSize: 9, padding: '2px 7px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: SOURCE_BG[eff.source] || 'var(--card2)', color: SOURCE_COLORS[eff.source] || 'var(--t3)', border: `1px solid ${SOURCE_BD[eff.source] || 'var(--bd2)'}` }}>
                          {eff.source}
                        </span>
                        {item.custom && (
                          <span style={{ fontSize: 9, padding: '2px 7px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'var(--card2)', color: 'var(--t3)', border: '1px solid var(--bd2)' }}>Custom</span>
                        )}
                        {hasUnsavedChange && (
                          <span style={{ fontSize: 9, padding: '2px 7px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#0d1a2e', color: '#4d8fce', border: '1px solid #0d2040' }}>Unsaved</span>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); openEdit(item) }}
                          style={{ marginLeft: 'auto', fontSize: 9, padding: '2px 8px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'transparent', border: '1px solid var(--bd2)', color: 'var(--t3)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', flexShrink: 0 }}
                        >Edit</button>
                      </div>
                      {eff.notes && <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6, fontWeight: 300 }}>{eff.notes}</div>}
                      {/* Photo thumbnails */}
                      {photos[item.id] && photos[item.id].length > 0 && (
                        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                          {photos[item.id].map((p, idx) => (
                            <div key={idx} style={{ position: 'relative' }}>
                              <img src={p.src} alt={p.label} onClick={() => setLightbox(p)}
                                style={{ width: 56, height: 56, objectFit: 'cover', cursor: 'pointer', border: '1px solid var(--bd2)' }} />
                              <button onClick={e => { e.stopPropagation(); removePhoto(item.id, idx) }}
                                style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%', background: '#cc1e1e', border: 'none', color: '#fff', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                            </div>
                          ))}
                          <button onClick={e => { e.stopPropagation(); addPhoto(item.id, eff.item) }}
                            style={{ width: 56, height: 56, border: '1px dashed var(--bd2)', background: 'transparent', color: 'var(--t3)', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Add photo">+</button>
                        </div>
                      )}
                      {(!photos[item.id] || photos[item.id].length === 0) && (
                        <div onClick={e => e.stopPropagation()} style={{ marginTop: 6 }}>
                          <button onClick={() => addPhoto(item.id, eff.item)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', background: 'transparent', border: '1px solid var(--bd2)', padding: '3px 8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                            <i className="ti ti-camera" style={{ fontSize: 11 }} aria-hidden="true" /> Add photo
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      </>
      )}

      {/* Edit item modal */}
      {editingId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0 }}
          onClick={() => setEditingId(null)}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--bd2)', borderRadius: '12px 12px 0 0', padding: 20, width: '100%', maxWidth: 600, maxHeight: '85vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t1)' }}>Edit Upgrade</div>
              <button onClick={() => setEditingId(null)} style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>

            {[['Phase', 'phase'], ['Item *', 'item']].map(([label, key]) => (
              key === 'phase' ? (
                <div key={key} style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>{label}</label>
                  <select value={form.phase} onChange={e => setForm(f => ({ ...f, phase: e.target.value }))}
                    style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
                    {existingPhases.map(p => <option key={p} value={p}>{p}</option>)}
                    <option value="__custom__">New phase...</option>
                  </select>
                  {form.phase === '__custom__' && (
                    <input value={form.customPhase} onChange={e => setForm(f => ({ ...f, customPhase: e.target.value }))}
                      placeholder="New phase name"
                      style={{ width: '100%', marginTop: 6, background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif' }} />
                  )}
                </div>
              ) : (
                <div key={key} style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>{label}</label>
                  <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif' }} />
                </div>
              )
            ))}

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Source</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['Self', 'Shop'].map(s => (
                  <button key={s} onClick={() => setForm(f => ({ ...f, source: s }))}
                    style={{ padding: '5px 14px', border: '1px solid', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', cursor: 'pointer', background: form.source === s ? SOURCE_COLORS[s] : 'transparent', color: form.source === s ? '#fff' : 'var(--t3)', borderColor: form.source === s ? SOURCE_COLORS[s] : 'var(--bd2)' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveEdit} disabled={!form.item.trim()}
                style={{ flex: 1, background: '#0066b1', color: '#fff', border: 'none', padding: '9px 14px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: form.item.trim() ? 'pointer' : 'not-allowed', fontFamily: 'Inter, sans-serif', opacity: form.item.trim() ? 1 : 0.4 }}>
                Save edit
              </button>
              <button onClick={() => setEditingId(null)}
                style={{ padding: '9px 14px', background: 'transparent', border: '1px solid var(--bd2)', color: 'var(--t3)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                Cancel
              </button>
            </div>

            {/* Delete — only show after interaction */}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--bd)' }}>
              <button
                onClick={() => { deleteItem(editingId); setEditingId(null) }}
                style={{ fontSize: 10, color: '#cc1e1e', background: 'transparent', border: '1px solid #2a0000', padding: '6px 14px', cursor: 'pointer', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
                <i className="ti ti-trash" style={{ fontSize: 11, marginRight: 4 }} aria-hidden="true" />
                Delete upgrade
              </button>
              <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 6, fontWeight: 300 }}>
                {allItems.find(i => i.id === editingId)?.custom
                  ? 'Removed immediately (custom item).'
                  : 'Marked for deletion — applies on next Save.'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
