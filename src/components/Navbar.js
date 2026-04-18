import React from 'react'
import { supabase } from '../supabaseClient'

export default function Navbar({ profile }) {
  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <nav style={{
      background: '#0F6E56',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 56
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 17, letterSpacing: '-0.3px' }}>
          IPManager
        </span>
        {profile?.role === 'admin' && (
          <span style={{
            background: '#085041', color: '#9FE1CB',
            fontSize: 11, fontWeight: 600, padding: '2px 8px',
            borderRadius: 10
          }}>Admin</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ color: '#9FE1CB', fontSize: 13 }}>
          {profile?.full_name || profile?.email}
        </span>
        <button onClick={handleSignOut} style={{
          background: 'rgba(255,255,255,0.15)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '6px 14px',
          fontSize: 13,
          cursor: 'pointer'
        }}>Sign out</button>
      </div>
    </nav>
  )
}
