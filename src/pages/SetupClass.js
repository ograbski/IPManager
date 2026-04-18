import React, { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function SetupClass({ profile }) {
  const [nameList, setNameList] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleSetup(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Create school if needed
      let schoolId = profile?.school_id
      if (!schoolId) {
        const { data: school, error: schoolError } = await supabase
          .from('schools')
          .insert({ name: schoolName || 'My School' })
          .select()
          .single()
        if (schoolError) throw schoolError
        schoolId = school.id

        await supabase
          .from('profiles')
          .update({ school_id: schoolId })
          .eq('id', profile.id)
      }

      // Parse student names
      const lines = nameList
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)

      const students = lines.map(line => {
        const parts = line.split(/[\s,]+/)
        const first = parts[0] || ''
        const last = parts.slice(1).join(' ') || ''
        return {
          first_name: first,
          last_name: last,
          school_id: schoolId,
          teacher_id: profile.id
        }
      })

      if (students.length === 0) {
        setError('Please enter at least one student name.')
        setLoading(false)
        return
      }

      const { error: studentsError } = await supabase
        .from('students')
        .insert(students)

      if (studentsError) throw studentsError

      navigate('/')
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <div className="page-title">Set up your class</div>
          <p style={{ color: '#888', fontSize: 14, marginTop: 4 }}>
            Add your students to get started. You can add more later.
          </p>
        </div>
      </div>

      <div className="card">
        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSetup}>
          <div className="field">
            <label className="label">School name</label>
            <input
              type="text"
              value={schoolName}
              onChange={e => setSchoolName(e.target.value)}
              placeholder="e.g. Indie School"
            />
          </div>

          <hr className="divider" />

          <div className="field">
            <label className="label">
              Paste your student list <span className="req">*</span>
            </label>
            <p className="hint" style={{ marginBottom: 8 }}>
              One student per line. First name then last name.
              e.g.<br />
              Jordan Smith<br />
              Aisha Patel<br />
              Connor Williams
            </p>
            <textarea
              value={nameList}
              onChange={e => setNameList(e.target.value)}
              placeholder="Paste student names here, one per line..."
              rows={12}
              required
            />
          </div>

          <div style={{
            background: '#E1F5EE', border: '1px solid #9FE1CB',
            borderRadius: 8, padding: '10px 14px',
            fontSize: 13, color: '#085041', marginBottom: 16
          }}>
            Already have completed IPs? Once your class is set up you can
            upload existing Word docs from each student's profile and
            IPManager will digitise them automatically.
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', padding: 11, fontSize: 15 }}
            disabled={loading}
          >
            {loading ? 'Setting up your class...' : 'Set up class'}
          </button>
        </form>
      </div>
    </div>
  )
}
