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
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLow
