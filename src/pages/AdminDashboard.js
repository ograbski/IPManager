import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'

export default function AdminDashboard({ profile }) {
  const [teachers, setTeachers] = useState([])
  const [students, setStudents] = useState([])
  const [termDates, setTermDates] = useState({})
  const [school, setSchool] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingTerms, setSavingTerms] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const navigate = useNavigate()

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    const { data: schoolData } = await supabase
      .from('schools')
      .select('*')
      .eq('id', profile.school_id)
      .single()
    setSchool(schoolData)
    if (schoolData) {
      setTermDates({
        term1_end: schoolData.term1_end || '',
        term2_end: schoolData.term2_end || '',
        term3_end: schoolData.term3_end || '',
        term4_end: schoolData.term4_end || ''
      })
    }

    const { data: teachersData } = await supabase
      .from('profiles')
      .select('*')
      .eq('school_id', profile.school_id)
      .eq('role', 'teacher')

    const { data: studentsData } = await supabase
      .from('students')
      .select(`
        *,
        individual_plans (id, updated_at,
          reviews (review_type, status, scheduled_date)
        )
      `)
      .eq('school_id', profile.school_id)
      .order('last_name')

    setTeachers(teachersData || [])
    setStudents(studentsData || [])
    setLoading(false)
  }

  async function saveTermDates() {
    setSavingTerms(true)
    await supabase
      .from('schools')
      .update(termDates)
      .eq('id', school.id)
    setSavingTerms(false)
    alert('Term dates saved.')
  }

  const overdueCount = students.filter(s =>
    s.individual_plans?.[0]?.reviews?.some(r => r.status === 'overdue')
  ).length

  const noIPCount = students.filter(s => !s.individual_plans?.length).length

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <div className="spinner"></div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Admin dashboard</div>
          <p style={{ color: '#888', fontSize: 14, marginTop: 4 }}>
            {school?.name} · All students
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total students', value: students.length },
          { label: 'Teachers', value: teachers.length },
          { label: 'No IP yet', value: noIPCount },
          { label: 'Overdue reviews', value: overdueCount }
        ].map(stat => (
          <div key={stat.label} style={{
            background: '#fff', border: '1px solid #e8e8e4',
            borderRadius: 10, padding: '16px 20px'
          }}>
            <div style={{ fontSize: 12, color: '#888', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a' }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['overview', 'term dates'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 13,
              fontWeight: 500, cursor: 'pointer', border: 'none',
              background: activeTab === tab ? '#0F6E56' : '#fff',
              color: activeTab === tab ? '#fff' : '#444',
              boxShadow: activeTab === tab ? 'none' : '0 0 0 1px #e8e8e4'
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gap: 10 }}>
          {students.map(student => {
            const plan = student.individual_plans?.[0]
            const overdue = plan?.reviews?.find(r => r.status === 'overdue')
            const due = plan?.reviews?.find(r => r.status === 'due')
            const statusColor = overdue ? 'red' : due ? 'amber' : plan ? 'green' : 'gray'
            const statusLabel = overdue ? 'Overdue' : due ? 'Due now' : plan ? 'On track' : 'No IP'
            const teacher = teachers.find(t => t.id === student.teacher_id)
            return (
              <div
                key={student.id}
                className="card"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/student/${student.id}`)}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#0F6E56'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#e8e8e4'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>
                        {student.first_name} {student.last_name}
                      </span>
                      <span className={`badge badge-${statusColor}`}>{statusLabel}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                      Teacher: {teacher?.full_name || teacher?.email || 'Unassigned'}
                    </div>
                  </div>
                  {plan && (
                    <div style={{ fontSize: 12, color: '#aaa' }}>
                      Updated {format(parseISO(plan.updated_at), 'd MMM yyyy')}
                    </div>
                  )}
                  <span style={{ color: '#0F6E56', fontSize: 13, fontWeight: 500 }}>
                    View →
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {activeTab === 'term dates' && (
        <div className="card" style={{ maxWidth: 500 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
            School term end dates
          </h3>
          <p className="hint" style={{ marginBottom: 16 }}>
            These dates are used to automatically schedule end-of-term reviews
            for all students across the school.
          </p>
          {['term1', 'term2', 'term3', 'term4'].map(term => (
            <div className="field" key={term}>
              <label className="label">
                Term {term.replace('term', '')} end date
              </label>
              <input
                type="date"
                value={termDates[`${term}_end`] || ''}
                onChange={e => setTermDates(prev => ({
                  ...prev, [`${term}_end`]: e.target.value
                }))}
              />
            </div>
          ))}
          <button
            className="btn-primary"
            onClick={saveTermDates}
            disabled={savingTerms}
            style={{ marginTop: 8 }}
          >
            {savingTerms ? 'Saving...' : 'Save term dates'}
          </button>
        </div>
      )}
    </div>
  )
}
