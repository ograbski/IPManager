import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import StudentIP from './pages/StudentIP'
import AdminDashboard from './pages/AdminDashboard'
import SetupClass from './pages/SetupClass'
import Navbar from './components/Navbar'

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    setLoading(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner"></div>
    </div>
  )

  if (!session) return <Login />

  return (
    <BrowserRouter>
      <Navbar profile={profile} />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
        <Routes>
          <Route path="/" element={
            profile?.role === 'admin'
              ? <AdminDashboard profile={profile} />
              : <Dashboard profile={profile} />
          } />
          <Route path="/setup" element={<SetupClass profile={profile} />} />
          <Route path="/student/:studentId" element={<StudentIP profile={profile} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
