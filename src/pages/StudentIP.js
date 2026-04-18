import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { format, addDays, parseISO } from 'date-fns'
import { generateWordDoc } from '../utils/generateDoc'

const INTENSITY = ['One on one support','Individualised support','Small group support','Highly structured','Intensive intervention support','Targeted support','Other (specify)']
const FREQUENCY = ['All the time','Every lesson','Most lessons','Literacy based lessons','Numeracy based lessons','Physical/practical activities','Written activities','Offsite activities','Summative tasks','Break times','Daily','Twice daily','Weekly','Twice weekly','Fortnightly','Other (specify)']
const MON_METHOD = ['Student feedback on effectiveness of adjustment','Teacher/coach feedback on effectiveness of adjustment','Parent feedback on effectiveness of adjustment','Communication from welfare officer to parents','Data relating to accessing support plan','Review of safety plan and risk management plan','Attendance data from central','Anecdotal information in central','Records of assessment','Teacher and student to review regulation support plan','Other (specify)']
const MON_FREQ = ['Daily','Weekly','Monthly','Other (specify)']
const TEACHER_RATING = ['Working well','Working towards','Needs review']
const STUDENT_RATING = ['Working well','Working towards','Needs review']

function SmartSelect({ options, value, onChange, placeholder }) {
  const isOther = value && !options.slice(0, -1).includes(value)
  const [custom, setCustom] = useState(isOther ? value : '')
  const selectVal = isOther ? 'Other (specify)' : value

  function handleSelect(e) {
    const v = e.target.value
    if (v === 'Other (specify)') {
      onChange('Other (specify)')
    } else {
      setCustom('')
      onChange(v)
    }
  }

  function handleCustom(e) {
    setCustom(e.target.value)
    onChange(e.target.value)
  }

  return (
    <div>
      <select value={selectVal} onChange={handleSelect}>
        <option value="">{placeholder || 'Select...'}</option>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
      {(selectVal === 'Other (specify)') && (
        <input
          type="text"
          value={custom}
          onChange={handleCustom}
          placeholder="Please specify..."
          style={{ marginTop: 6 }}
        />
      )}
    </div>
  )
}

function AISuggestedSelect({ options, value, onChange, placeholder, suggestion }) {
  const displayValue = value || suggestion || ''
  return (
    <div>
      <SmartSelect
        options={options}
        value={displayValue}
        onChange={onChange}
        placeholder={placeholder}
      />
      {suggestion && !value && (
        <div style={{
          fontSize: 11, color: '#0F6E56', marginTop: 4,
          display: 'flex', alignItems: 'center', gap: 4
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#0F6E56', display: 'inline-block'
          }}></span>
          AI suggested
        </div>
      )}
    </div>
  )
}

export default function StudentIP({ profile }) {
  const { studentId } = useParams()
  const navigate = useNavigate()
  const [student, setStudent] = useState(null)
  const [plan, setPlan] = useState(null)
  const [barriers, setBarriers] = useState([])
  const [reviews, setReviews] = useState([])
  const [signatures, setSignatures] = useState([])
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [aiNotes, setAiNotes] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState({})
  const [importLoading, setImportLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { fetchAll() }, [studentId])

  async function fetchAll() {
    const { data: studentData } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .single()
    setStudent(studentData)

    const { data: plans } = await supabase
      .from('individual_plans')
      .select('*')
      .eq('student_id', studentId)
      .order('version', { ascending: false })

    if (plans?.length > 0) {
      const current = plans.find(p => p.is_current) || plans[0]
      setPlan(current)
      setVersions(plans)
      await fetchBarriers(current.id)
      await fetchReviews(current.id)
      await fetchSignatures(current.id)
    }
    setLoading(false)
  }

  async function fetchBarriers(planId) {
    const { data } = await supabase
      .from('barriers')
      .select(`*, adjustments(*)`)
      .eq('plan_id', planId)
      .order('barrier_num')
    setBarriers(data || [])
  }

  async function fetchReviews(planId) {
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('plan_id', planId)
      .order('scheduled_date')
    setReviews(data || [])
  }

  async function fetchSignatures(planId) {
    const { data } = await supabase
      .from('signatures')
      .select('*')
      .eq('plan_id', planId)
      .order('signed_at', { ascending: false })
    setSignatures(data || [])
  }

  async function savePlan() {
    setSaving(true)
    setError('')
    try {
      if (plan?.id) {
        await supabase.from('individual_plans').update({
          ...plan, updated_at: new Date().toISOString()
        }).eq('id', plan.id)

        for (const barrier of barriers) {
          if (barrier.id && !barrier.isNew) {
            await supabase.from('barriers').update({
              description: barrier.description,
              barrier_num: barrier.barrier_num
            }).eq('id', barrier.id)
          } else if (barrier.isNew) {
            const { data: newBarrier } = await supabase
              .from('barriers')
              .insert({ plan_id: plan.id, description: barrier.description, barrier_num: barrier.barrier_num })
              .select().single()
            barrier.id = newBarrier.id
            barrier.isNew = false
          }
          for (const adj of (barrier.adjustments || [])) {
            if (adj.id && !adj.isNew) {
              await supabase.from('adjustments').update(adj).eq('id', adj.id)
            } else if (adj.isNew) {
              await supabase.from('adjustments').insert({ ...adj, barrier_id: barrier.id })
            }
          }
        }
        setSuccess('Plan saved successfully.')
      } else {
        await createNewPlan()
      }
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
    setTimeout(() => setSuccess(''), 3000)
  }

  async function createNewPlan() {
    const { data: newPlan } = await supabase
      .from('individual_plans')
      .insert({ ...plan, student_id: studentId, version: 1, is_current: true })
      .select().single()
    setPlan(newPlan)

    const startDate = newPlan.date_of_plan ? parseISO(newPlan.date_of_plan) : new Date()
    await supabase.from('reviews').insert([
      { plan_id: newPlan.id, review_type: 'implementation',
        scheduled_date: format(addDays(startDate, 21), 'yyyy-MM-dd'), status: 'upcoming' },
      { plan_id: newPlan.id, review_type: 'term1', status: 'upcoming' },
      { plan_id: newPlan.id, review_type: 'term2', status: 'upcoming' },
      { plan_id: newPlan.id, review_type: 'term3', status: 'upcoming' },
      { plan_id: newPlan.id, review_type: 'term4', status: 'upcoming' }
    ])
    await fetchReviews(newPlan.id)
    setSuccess('Plan created successfully.')
  }

  async function saveAsNewVersion() {
    setSaving(true)
    await supabase.from('individual_plans')
      .update({ is_current: false })
      .eq('student_id', studentId)

    const { data: newPlan } = await supabase
      .from('individual_plans')
      .insert({
        ...plan, id: undefined,
        version: (versions.length + 1),
        is_current: true,
        updated_at: new Date().toISOString()
      })
      .select().single()

    for (const barrier of barriers) {
      const { data: newBarrier } = await supabase
        .from('barriers')
        .insert({ plan_id: newPlan.id, description: barrier.description, barrier_num: barrier.barrier_num })
        .select().single()
      for (const adj of (barrier.adjustments || [])) {
        await supabase.from('adjustments').insert({ ...adj, id: undefined, barrier_id: newBarrier.id })
      }
    }
    setPlan(newPlan)
    setSuccess('New version saved.')
    setSaving(false)
    await fetchAll()
  }

  async function generateProfile() {
    if (!aiNotes.trim()) return
    setAiLoading(true)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content:
            `You are helping a teacher write an Individual Plan for a student with additional learning needs.
Based on these teacher notes, write three sections:
1. Personal strengths and interests (2-3 sentences, positive, student-centred)
2. Functional presentation (2-3 sentences describing observable classroom behaviours and access barriers - do NOT mention diagnosis)
3. Academic interests (1-2 sentences)
Teacher notes: ${aiNotes}
Respond ONLY with JSON, no markdown: {"strengths":"...","functional":"...","academic":"..."}`
          }]
        })
      })
      const data = await res.json()
      const text = data.content.map(i => i.text || '').join('')
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      setPlan(prev => ({ ...prev, strengths: parsed.strengths, functional_presentation: parsed.functional, academic_interests: parsed.academic }))
    } catch (e) { setError('AI generation failed. Please try again.') }
    setAiLoading(false)
  }

  async function suggestDropdowns(barrierIdx, adjIdx) {
    const barrier = barriers[barrierIdx]
    const adj = barrier?.adjustments?.[adjIdx]
    if (!barrier?.description || !adj?.description) return
    const key = `${barrierIdx}-${adjIdx}`
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 400,
          messages: [{ role: 'user', content:
            `A teacher is creating an Individual Plan adjustment. Based on the barrier and adjustment below, suggest the most appropriate option for each dropdown.

Barrier: ${barrier.description}
Adjustment: ${adj.description}

Intensity options: ${INTENSITY.slice(0,-1).join(', ')}
Frequency options: ${FREQUENCY.slice(0,-1).join(', ')}
Monitoring method options: ${MON_METHOD.slice(0,-1).join(', ')}
Monitoring frequency options: ${MON_FREQ.slice(0,-1).join(', ')}

Respond ONLY with JSON: {"intensity":"...","frequency":"...","monitoring_method":"...","monitoring_frequency":"..."}`
          }]
        })
      })
      const data = await res.json()
      const text = data.content.map(i => i.text || '').join('')
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      setAiSuggestions(prev => ({ ...prev, [key]: parsed }))
      setBarriers(prev => prev.map((b, bi) => bi !== barrierIdx ? b : {
        ...b, adjustments: b.adjustments.map((a, ai) => ai !== adjIdx ? a : {
          ...a,
          intensity: a.intensity || parsed.intensity,
          frequency: a.frequency || parsed.frequency,
          monitoring_method: a.monitoring_method || parsed.monitoring_method,
          monitoring_frequency: a.monitoring_frequency || parsed.monitoring_frequency
        })
      }))
    } catch (e) { console.error('AI suggestion failed', e) }
  }

  async function handleImportDoc(e) {
    const file = e.target.files[0]
    if (!file) return
    setImportLoading(true)
    setError('')
    try {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const base64 = ev.target.result.split(',')[1]
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json',
            'x-api-key': process.env.REACT_APP_ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            messages: [{ role: 'user', content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
              { type: 'text', text: `Extract all data from this Individual Plan document and return ONLY JSON with this structure:
{"date_of_plan":"YYYY-MM-DD","strengths":"...","functional_presentation":"...","academic_interests":"...","long_term_goal":"...","planning_team":"...","external_agencies":false,"external_agencies_details":"...","barriers":[{"description":"...","adjustments":[{"description":"...","intensity":"...","frequency":"...","monitoring_method":"...","monitoring_frequency":"...","person_responsible":"..."}]}]}` }
            ]}]
          })
        })
        const data = await res.json()
        const text = data.content.map(i => i.text || '').join('')
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
        setPlan(prev => ({ ...prev, ...parsed, barriers: undefined }))
        if (parsed.barriers) {
          setBarriers(parsed.barriers.map((b, bi) => ({
            ...b, barrier_num: bi + 1, isNew: true,
            adjustments: (b.adjustments || []).map((a, ai) => ({
              ...a, adjustment_num: ai + 1, isNew: true
            }))
          })))
        }
        setSuccess('Document imported successfully. Review the data below and save.')
        setImportLoading(false)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      setError('Import failed: ' + err.message)
      setImportLoading(false)
    }
  }

  async function sign(reviewId, role) {
    const name = prompt(`Type your full name to sign as ${role}:`)
    if (!name) return
    await supabase.from('signatures').insert({
      plan_id: plan.id,
      review_id: reviewId,
      signed_by: role,
      signer_name: name,
      sections_reviewed: ['Student Profile', 'Functional Presentation', 'Long Term Goal', 'Adjustments']
    })
    await fetchSignatures(plan.id)
  }

  function updateBarrier(idx, field, value) {
    setBarriers(prev => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b))
  }

  function updateAdj(bi, ai, field, value) {
    setBarriers(prev => prev.map((b, i) => i !== bi ? b : {
      ...b, adjustments: b.adjustments.map((a, j) => j !== ai ? a : { ...a, [field]: value })
    }))
  }

  function addBarrier() {
    if (barriers.length >= 3) return
    setBarriers(prev => [...prev, {
      barrier_num: prev.length + 1, description: '', isNew: true,
      adjustments: [{ adjustment_num: 1, description: '', isNew: true }]
    }])
  }

  function removeBarrier(idx) {
    setBarriers(prev => prev.filter((_, i) => i !== idx).map((b, i) => ({ ...b, barrier_num: i + 1 })))
  }

  function addAdj(bi) {
    setBarriers(prev => prev.map((b, i) => i !== bi ? b : {
      ...b, adjustments: [...(b.adjustments || []),
        { adjustment_num: (b.adjustments?.length || 0) + 1, description: '', isNew: true }]
    }))
  }

  function removeAdj(bi, ai) {
    setBarriers(prev => prev.map((b, i) => i !== bi ? b : {
      ...b, adjustments: b.adjustments.filter((_, j) => j !== ai).map((a, j) => ({ ...a, adjustment_num: j + 1 }))
    }))
  }

  function updateReview(idx, field, value) {
    setReviews(prev => prev.map((r, i) => i !== idx ? r : { ...r, [field]: value }))
  }

  async function saveReview(review) {
    await supabase.from('reviews').update(review).eq('id', review.id)
    setSuccess('Review saved.')
    setTimeout(() => setSuccess(''), 3000)
  }

  function getReviewLabel(type) {
    return { implementation: 'Implementation review', term1: 'Term 1 review', term2: 'Term 2 review', term3: 'Term 3 review', term4: 'Term 4 review' }[type] || type
  }

  function getNextActions() {
    const actions = []
    if (!plan) { actions.push({ label: 'Create individual plan', urgent: true }); return actions }
    reviews.forEach(r => {
      if (r.status === 'overdue') actions.push({ label: `${getReviewLabel(r.review_type)} is overdue`, urgent: true })
      else if (r.status === 'due') actions.push({ label: `${getReviewLabel(r.review_type)} is due`, urgent: false })
    })
    const unsigned = reviews.find(r => r.status !== 'completed' &&
      !signatures.find(s => s.review_id === r.id && s.signed_by === 'teacher'))
    if (unsigned) actions.push({ label: 'Signatures needed for ' + getReviewLabel(unsigned.review_type), urgent: false })
    return actions
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner"></div></div>
  if (!student) return <div className="card">Student not found.</div>

  const tabs = ['overview', 'student profile', 'barriers & adjustments', 'reviews', 'signatures', 'export']
  const nextActions = getNextActions()

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn-secondary" onClick={() => navigate('/')} style={{ padding: '7px 14px' }}>
          ← Back
        </button>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            {student.first_name} {student.last_name}
          </div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
            {plan ? `Version ${plan.version} · Last updated ${format(parseISO(plan.updated_at), 'd MMM yyyy')}` : 'No IP yet'}
          </div>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {success && <div className="success-msg">{success}</div>}

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', border: 'none',
            background: activeTab === tab ? '#0F6E56' : '#fff',
            color: activeTab === tab ? '#fff' : '#444',
            boxShadow: activeTab === tab ? 'none' : '0 0 0 1px #e8e8e4',
            textTransform: 'capitalize'
          }}>{tab}</button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 12 }}>Next actions</div>
              {nextActions.length === 0
                ? <p style={{ color: '#888', fontSize: 14 }}>All up to date.</p>
                : nextActions.map((a, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 0', borderBottom: i < nextActions.length - 1 ? '1px solid #f0f0ec' : 'none'
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: a.urgent ? '#E24B4A' : '#EF9F27'
                    }}></div>
                    <span style={{ fontSize: 14 }}>{a.label}</span>
                  </div>
                ))}
            </div>
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 12 }}>Review timeline</div>
              {reviews.map((r, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '7px 0', borderBottom: i < reviews.length - 1 ? '1px solid #f0f0ec' : 'none'
                }}>
                  <span style={{ fontSize: 13 }}>{getReviewLabel(r.review_type)}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {r.scheduled_date && (
                      <span style={{ fontSize: 12, color: '#888' }}>
                        {format(parseISO(r.scheduled_date), 'd MMM')}
                      </span>
                    )}
                    <span className={`badge badge-${r.status === 'completed' ? 'green' : r.status === 'overdue' ? 'red' : r.status === 'due' ? 'amber' : 'gray'}`}>
                      {r.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {!plan && (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ color: '#888', marginBottom: 16 }}>No Individual Plan exists yet for this student.</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn-primary" onClick={() => { setPlan({}); setActiveTab('student profile') }}>
                  Create new IP
                </button>
                <label style={{
                  padding: '9px 18px', background: '#fff', border: '1px solid #ddd',
                  borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500
                }}>
                  {importLoading ? 'Importing...' : 'Import existing Word doc'}
                  <input type="file" accept=".docx,.pdf" onChange={handleImportDoc} style={{ display: 'none' }} />
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'student profile' && (
        <div className="card">
          <div style={{ background: '#E1F5EE', border: '1px solid #9FE1CB', borderRadius: 8, padding: 14, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#085041', marginBottom: 8 }}>
              AI writing assistant
            </div>
            <textarea
              value={aiNotes}
              onChange={e => setAiNotes(e.target.value)}
              placeholder="Paste rough notes or a student summary — AI will draft the profile sections below..."
              rows={4}
              style={{ marginBottom: 8, borderColor: '#9FE1CB' }}
            />
            <button className="btn-primary" onClick={generateProfile} disabled={aiLoading}
              style={{ background: '#0F6E56' }}>
              {aiLoading ? 'Generating...' : 'Draft profile sections'}
            </button>
          </div>

          <div className="row2" style={{ marginBottom: 14 }}>
            <div className="field">
              <label className="label">Date of plan</label>
              <input type="date" value={plan?.date_of_plan || ''}
                onChange={e => setPlan(p => ({ ...p, date_of_plan: e.target.value }))} />
            </div>
            <div className="field">
              <label className="label">Teacher email (for reminders)</label>
              <input type="email" value={plan?.teacher_email || ''}
                onChange={e => setPlan(p => ({ ...p, teacher_email: e.target.value }))}
                placeholder="teacher@school.edu.au" />
            </div>
          </div>

          <div className="field">
            <label className="label">Personal strengths and interests <span className="req">*</span></label>
            <textarea rows={3} value={plan?.strengths || ''}
              onChange={e => setPlan(p => ({ ...p, strengths: e.target.value }))}
              placeholder="What does this student do well? What motivates them?" />
          </div>
          <div className="field">
            <label className="label">Functional presentation (observations) <span className="req">*</span></label>
            <p className="hint" style={{ marginBottom: 6 }}>What does it look like when this student encounters barriers? Do not include diagnosis.</p>
            <textarea rows={3} value={plan?.functional_presentation || ''}
              onChange={e => setPlan(p => ({ ...p, functional_presentation: e.target.value }))}
              placeholder="Describe observable behaviours and access barriers..." />
          </div>
          <div className="field">
            <label className="label">Academic interests</label>
            <textarea rows={2} value={plan?.academic_interests || ''}
              onChange={e => setPlan(p => ({ ...p, academic_interests: e.target.value }))}
              placeholder="Subject areas, topics, learning preferences..." />
          </div>
          <div className="field">
            <label className="label">Long-term goal (next 12 months) <span className="req">*</span></label>
            <textarea rows={2} value={plan?.long_term_goal || ''}
              onChange={e => setPlan(p => ({ ...p, long_term_goal: e.target.value }))}
              placeholder="What are we working towards over the next 12 months?" />
          </div>
          <div className="field">
            <label className="label">Collaborative planning team</label>
            <textarea rows={2} value={plan?.planning_team || ''}
              onChange={e => setPlan(p => ({ ...p, planning_team: e.target.value }))}
              placeholder="List team members involved..." />
          </div>
          <div className="field">
            <label className="label">External agencies involved?</label>
            <select value={plan?.external_agencies ? 'yes' : 'no'}
              onChange={e => setPlan(p => ({ ...p, external_agencies: e.target.value === 'yes' }))}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          {plan?.external_agencies && (
            <div className="field">
              <label className="label">External agency details</label>
              <textarea rows={2} value={plan?.external_agencies_details || ''}
                onChange={e => setPlan(p => ({ ...p, external_agencies_details: e.target.value }))}
                placeholder="Name, role, involvement..." />
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="btn-primary" onClick={savePlan} disabled={saving}>
              {saving ? 'Saving...' : plan?.id ? 'Save changes' : 'Create plan'}
            </button>
            {plan?.id && (
              <label style={{ padding: '9px 18px', background: '#fff', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
                {importLoading ? 'Importing...' : 'Import from Word doc'}
                <input type="file" accept=".docx,.pdf" onChange={handleImportDoc} style={{ display: 'none' }} />
              </label>
            )}
          </div>
        </div>
      )}

      {activeTab === 'barriers & adjustments' && (
        <div>
          {barriers.map((barrier, bi) => (
            <div key={bi} className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontWeight: 600 }}>Barrier {bi + 1}</span>
                {barriers.length > 1 && (
                  <button className="btn-danger" onClick={() => removeBarrier(bi)} style={{ padding: '5px 12px', fontSize: 12 }}>
                    Remove barrier
                  </button>
                )}
              </div>
              <div className="field">
                <label className="label">Describe the barrier <span className="req">*</span></label>
                <p className="hint" style={{ marginBottom: 6 }}>What access issue has a day-to-day impact? Do not include diagnosis.</p>
                <textarea rows={2} value={barrier.description || ''}
                  onChange={e => updateBarrier(bi, 'description', e.target.value)}
                  placeholder="e.g. The classroom environment is too loud and overstimulating..." />
              </div>

              {(barrier.adjustments || []).map((adj, ai) => (
                <div key={ai} style={{
                  border: '1px solid #e8e8e4', borderRadius: 10,
                  padding: 16, marginBottom: 12, background: '#fafaf8'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>
                      Adjustment {ai + 1}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {adj.description && barrier.description && (
                        <button
                          onClick={() => suggestDropdowns(bi, ai)}
                          style={{
                            padding: '4px 10px', fontSize: 11, borderRadius: 6,
                            background: '#E1F5EE', color: '#085041',
                            border: '1px solid #9FE1CB', cursor: 'pointer', fontWeight: 500
                          }}>
                          AI suggest dropdowns
                        </button>
                      )}
                      {(barrier.adjustments?.length || 0) > 1 && (
                        <button className="btn-danger" onClick={() => removeAdj(bi, ai)}
                          style={{ padding: '4px 10px', fontSize: 11 }}>
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="field">
                    <label className="label">Adjustment description <span className="req">*</span></label>
                    <textarea rows={2} value={adj.description || ''}
                      onChange={e => updateAdj(bi, ai, 'description', e.target.value)}
                      placeholder="Describe the adjustment linked to this barrier..." />
                  </div>
                  <div className="row2">
                    <div className="field">
                      <label className="label">Start date</label>
                      <input type="date" value={adj.start_date || ''}
                        onChange={e => updateAdj(bi, ai, 'start_date', e.target.value)} />
                    </div>
                    <div className="field">
                      <label className="label">Person/s responsible</label>
                      <input type="text" value={adj.person_responsible || ''}
                        onChange={e => updateAdj(bi, ai, 'person_responsible', e.target.value)}
                        placeholder="e.g. Class teacher" />
                    </div>
                  </div>
                  <div className="row2">
                    <div className="field">
                      <label className="label">Adjustment intensity</label>
                      <AISuggestedSelect options={INTENSITY} value={adj.intensity || ''}
                        onChange={v => updateAdj(bi, ai, 'intensity', v)}
                        suggestion={aiSuggestions[`${bi}-${ai}`]?.intensity} />
                    </div>
                    <div className="field">
                      <label className="label">Adjustment frequency</label>
                      <AISuggestedSelect options={FREQUENCY} value={adj.frequency || ''}
                        onChange={v => updateAdj(bi, ai, 'frequency', v)}
                        suggestion={aiSuggestions[`${bi}-${ai}`]?.frequency} />
                    </div>
                  </div>
                  <div className="row2">
                    <div className="field">
                      <label className="label">Monitoring method</label>
                      <AISuggestedSelect options={MON_METHOD} value={adj.monitoring_method || ''}
                        onChange={v => updateAdj(bi, ai, 'monitoring_method', v)}
                        suggestion={aiSuggestions[`${bi}-${ai}`]?.monitoring_method} />
                    </div>
                    <div className="field">
                      <label className="label">Monitoring frequency</label>
                      <AISuggestedSelect options={MON_FREQ} value={adj.monitoring_frequency || ''}
                        onChange={v => updateAdj(bi, ai, 'monitoring_frequency', v)}
                        suggestion={aiSuggestions[`${bi}-${ai}`]?.monitoring_frequency} />
                    </div>
                  </div>
                </div>
              ))}

              {(barrier.adjustments?.length || 0) < 4 && (
                <button onClick={() => addAdj(bi)} style={{
                  width: '100%', padding: 9, fontSize: 13, color: '#0F6E56',
                  border: '1px dashed #9FE1CB', borderRadius: 8,
                  background: 'transparent', cursor: 'pointer', marginBottom: 4
                }}>
                  + Add adjustment
                </button>
              )}
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10 }}>
            {barriers.length < 3 && (
              <button onClick={addBarrier} style={{
                padding: '9px 18px', fontSize: 13, color: '#0F6E56',
                border: '1px dashed #9FE1CB', borderRadius: 8,
                background: 'transparent', cursor: 'pointer'
              }}>
                + Add barrier
              </button>
            )}
            <button className="btn-primary" onClick={savePlan} disabled={saving}>
              {saving ? 'Saving...' : 'Save barriers & adjustments'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'reviews' && (
        <div>
          {reviews.map((review, ri) => {
            const reviewSigs = signatures.filter(s => s.review_id === review.id)
            const isLocked = ri > 0 && reviews[ri - 1].status !== 'completed'
            return (
              <div key={ri} className="card" style={{
                marginBottom: 16,
                opacity: isLocked ? 0.5 : 1
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{getReviewLabel(review.review_type)}</span>
                    {review.scheduled_date && (
                      <span style={{ fontSize: 13, color: '#888', marginLeft: 10 }}>
                        Scheduled: {format(parseISO(review.scheduled_date), 'd MMM yyyy')}
                      </span>
                    )}
                  </div>
                  <span className={`badge badge-${review.status === 'completed' ? 'green' : review.status === 'overdue' ? 'red' : review.status === 'due' ? 'amber' : 'gray'}`}>
                    {review.status}
                  </span>
                </div>

                {isLocked
                  ? <p style={{ color: '#888', fontSize: 13 }}>Complete the previous review first to unlock this one.</p>
                  : <>
                    {review.review_type === 'implementation' && (
                      <div style={{ background: '#f5f5f0', borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 12, color: '#666' }}>
                        <strong>Discussion prompts:</strong> Engagement observations (first 3-5 weeks) · Attendance · Class tasks · Social engagement · Communication preferences · Delivery preferences · Environment preferences · Sensory preferences · Short-term goals
                      </div>
                    )}
                    {review.review_type !== 'implementation' && (
                      <div style={{ background: '#f5f5f0', borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 12, color: '#666' }}>
                        <strong>Discussion prompts:</strong> Adjustment effectiveness data · Monitoring ratings · Attendance data · Assessment data · Support plan access data
                      </div>
                    )}
                    <div className="row2">
                      <div className="field">
                        <label className="label">Review date</label>
                        <input type="date" value={review.completed_date || ''}
                          onChange={e => updateReview(ri, 'completed_date', e.target.value)} />
                      </div>
                      <div className="field">
                        <label className="label">Next review date</label>
                        <input type="date" value={review.next_review_date || ''}
                          onChange={e => updateReview(ri, 'next_review_date', e.target.value)} />
                      </div>
                    </div>
                    <div className="row3">
                      <div className="field">
                        <label className="label">Teacher/coach</label>
                        <input type="text" value={review.attendee_teacher || ''}
                          onChange={e => updateReview(ri, 'attendee_teacher', e.target.value)} placeholder="Name" />
                      </div>
                      <div className="field">
                        <label className="label">Parent/guardian</label>
                        <input type="text" value={review.attendee_parent || ''}
                          onChange={e => updateReview(ri, 'attendee_parent', e.target.value)} placeholder="Name" />
                      </div>
                      <div className="field">
                        <label className="label">Student</label>
                        <input type="text" value={review.attendee_student || ''}
                          onChange={e => updateReview(ri, 'attendee_student', e.target.value)} placeholder="Name" />
                      </div>
                    </div>
                    <div className="field">
                      <label className="label">Notes from discussion</label>
                      <textarea rows={3} value={review.notes || ''}
                        onChange={e => updateReview(ri, 'notes', e.target.value)}
                        placeholder="Key points from the review meeting..." />
                    </div>
                    <div className="field">
                      <label className="label">Follow-up actions</label>
                      <textarea rows={2} value={review.follow_up_actions || ''}
                        onChange={e => updateReview(ri, 'follow_up_actions', e.target.value)}
                        placeholder="Actions to complete before next review..." />
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                      <button className="btn-primary" onClick={() => saveReview({ ...review, status: 'completed' })}>
                        Mark as completed
                      </button>
                      <button className="btn-secondary" onClick={() => saveReview(review)}>
                        Save notes
                      </button>
                    </div>

                    <hr className="divider" />
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Signatures</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {['teacher', 'parent', 'student'].map(role => {
                        const sig = reviewSigs.find(s => s.signed_by === role)
                        return (
                          <div key={role} onClick={() => !sig && sign(review.id, role)} style={{
                            flex: 1, minWidth: 140, border: `1px solid ${sig ? '#9FE1CB' : '#ddd'}`,
                            borderRadius: 8, padding: '10px 14px', cursor: sig ? 'default' : 'pointer',
                            background: sig ? '#E1F5EE' : '#fff', textAlign: 'center'
                          }}>
                            <div style={{ fontSize: 11, color: '#888', marginBottom: 6, textTransform: 'capitalize' }}>{role}</div>
                            <div style={{ fontSize: 14, fontStyle: 'italic', color: sig ? '#085041' : '#ccc', minHeight: 24 }}>
                              {sig ? sig.signer_name : 'Click to sign'}
                            </div>
                            {sig && <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>
                              {format(parseISO(sig.signed_at), 'd MMM yyyy HH:mm')}
                            </div>}
                          </div>
                        )
                      })}
                    </div>
                  </>
                }
              </div>
            )
          })}
        </div>
      )}

      {activeTab === 'signatures' && (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Full signature log</div>
          {signatures.length === 0
            ? <p style={{ color: '#888', fontSize: 14 }}>No signatures recorded yet.</p>
            : signatures.map((sig, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0', borderBottom: i < signatures.length - 1 ? '1px solid #f0f0ec' : 'none'
              }}>
                <div>
                  <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{sig.signed_by}</span>
                  <span style={{ color: '#888', fontSize: 13, marginLeft: 10 }}>{sig.signer_name}</span>
                </div>
                <span style={{ fontSize: 12, color: '#aaa' }}>
                  {format(parseISO(sig.signed_at), 'd MMM yyyy HH:mm')}
                </span>
              </div>
            ))
          }
        </div>
      )}

      {activeTab === 'export' && (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Export Individual Plan</div>
          <p style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>
            Download a formatted Word document of this IP. Previous versions are also available.
          </p>
          {versions.map((v, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 0', borderBottom: i < versions.length - 1 ? '1px solid #f0f0ec' : 'none'
            }}>
              <div>
                <span style={{ fontWeight: 500 }}>Version {v.version}</span>
                {v.is_current && <span className="badge badge-green" style={{ marginLeft: 8 }}>Current</span>}
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                  {format(parseISO(v.updated_at), 'd MMM yyyy HH:mm')}
                </div>
              </div>
              <button
                className="btn-secondary"
                onClick={() => generateWordDoc(v, student, barriers, reviews, signatures)}
              >
                Download .docx
              </button>
            </div>
          ))}
          <hr className="divider" />
          <button className="btn-primary" onClick={saveAsNewVersion} disabled={saving}>
            {saving ? 'Saving...' : 'Save as new version'}
          </button>
          <p className="hint" style={{ marginTop: 8 }}>
            Creates a snapshot of the current plan. Up to the last 2 previous versions are stored.
          </p>
        </div>
      )}
    </div>
  )
}
