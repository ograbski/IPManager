import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'
import { format, differenceInDays, parseISO } from 'date-fns'

export default function Dashboard({ profile }) {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (profile) fetchStudents()
  }, [profile])

  async function fetchStudents() {
    const { data: studentsData } = await supabase
      .from('students')
      .select(`
        *,
        individual_plans (
          id, date_of_plan, updated_at,
          reviews (review_type, scheduled_date, status),
          monitoring_checkins (checkin_date)
        )
      `)
      .eq('teacher_id', profile.id)
      .order('last_name', { ascending: true })

    setStudents(studentsData || [])
    setLoading(false)

    if (studentsData?.length === 0) navigate('/setup')
  }

  function getStudentStatus(student) {
    const plan = student.individual_plans?.[0]
    if (!plan) return { label: 'No IP yet', color: 'gray', nextAction: 'Create individual plan' }

    const reviews = plan.reviews || []
    const overdue = reviews.find(r => r.status === 'overdue')
    const due = reviews.find(r => r.status === 'due')
    const upcoming = reviews.find(r => r.status === 'upcoming' && r.scheduled_date)

    if (overdue) {
      const days = differenceInDays(new Date(), parseISO(overdue.scheduled_date))
      return {
        label: 'Overdue',
        color: 'red',
        nextAction: `${formatReviewType(overdue.review_type)} overdue by ${days} days`
      }
    }
    if (due) {
      return {
        label: 'Due now',
        color: 'amber',
        nextAction: `${formatReviewType(due.review_type)} due`
      }
    }
    if (upcoming) {
      const days = differenceInDays(parseISO(upcoming.scheduled_date), new Date())
      return {
        label: 'On track',
        color: 'green',
        nextAction: `${formatReviewType(upcoming.review_type)} in ${days} days (${format(parseISO(upcoming.scheduled_date), 'd MMM')})`
      }
    }
    return { label: 'On track', color: 'green', nextAction: 'All reviews up to date' }
  }

  function formatReviewType(type) {
    const map = {
      implementation: 'Implementation review',
      term1: 'Term 1 review',
      term2: 'Term 2 review',
      term3: 'Term 3 review',
      term4: 'Term 4 review'
    }
    return map[type] || type
  }

  function getInitials(first, last) {
    return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase()
  }

  const filtered = students.filter(s =>
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <div className="spinner"></div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">My class</div>
          <p style={{ color: '#888', fontSize: 14, marginTop: 4 }}>
            {students.length} student{students.length !== 1 ? 's' : ''} · {profile?.full_name}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn-secondary"
            onClick={() => navigate('/setup')}
          >
            + Add students
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search students..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
        />
      </div>

      {filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: '#888', fontSize: 15 }}>
            {search ? 'No students match your search.' : 'No students yet.'}
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {filtered.map(student => {
          const status = getStudentStatus(student)
          const plan = student.individual_plans?.[0]
          return (
            <div
              key={student.id}
              className="card"
              onClick={() => navigate(`/student/${student.id}`)}
              style={{ cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#0F6E56'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e8e8e4'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: '#E1F5EE', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 14, color: '#085041',
                  flexShrink: 0
                }}>
                  {getInitials(student.first_name, student.last_name)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>
                      {student.first_name} {student.last_name}
                    </span>
                    <span className={`badge badge-${status.color}`}>{status.label}</span>
                    {!plan && (
                      <span className="badge badge-gray">No IP</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: '#888' }}>
                    {status.nextAction}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {plan && (
                    <div style={{ fontSize: 12, color: '#aaa' }}>
                      Last updated<br />
                      {format(parseISO(plan.updated_at), 'd MMM yyyy')}
                    </div>
                  )}
                  <div style={{
                    marginTop: 6, color: '#0F6E56',
                    fontSize: 13, fontWeight: 500
                  }}>
                    {plan ? 'View IP →' : 'Create IP →'}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
