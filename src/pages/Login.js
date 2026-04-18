import React, { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      if (data.user) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          email,
          full_name: fullName,
          role: 'teacher'
        })
        setSuccess('Account created! You can now sign in.')
        setIsSignUp(false)
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f5f5f0',
      padding: 20
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, background: '#0F6E56',
            borderRadius: 14, margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>IP</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a1a' }}>IPManager</h1>
          <p style={{ color: '#888', fontSize: 14, marginTop: 6 }}>
            Individual Plan management for educators
          </p>
        </div>

        <div className="card">
          <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 20 }}>
            {isSignUp ? 'Create your account' : 'Sign in'}
          </h2>

          {error && <div className="error-msg">{error}</div>}
          {success && <div className="success-msg">{success}</div>}

          <form onSubmit={handleSubmit}>
            {isSignUp && (
              <div className="field">
                <label className="label">Full name <span className="req">*</span></label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Your full name"
                  required
                />
              </div>
            )}
            <div className="field">
              <label className="label">Email <span className="req">*</span></label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@school.edu.au"
                required
              />
            </div>
            <div className="field">
              <label className="label">Password <span className="req">*</span></label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                required
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', padding: '11px', fontSize: 15, marginTop: 6 }}
              disabled={loading}
            >
              {loading
                ? 'Please wait...'
                : isSignUp ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <hr className="divider" />

          <p style={{ textAlign: 'center', fontSize: 13, color: '#888' }}>
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess('') }}
              style={{
                background: 'none', border: 'none', color: '#0F6E56',
                fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: 13
              }}
            >
              {isSignUp ? 'Sign in' : 'Create account'}
            </button>
          </p>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#aaa', marginTop: 24 }}>
          Indie School · Individual Plan System · 2026
        </p>
      </div>
    </div>
  )
}
