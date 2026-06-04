import { supabase } from './supabase'

export function setupAuthListener() {
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth event:', event)
    console.log('Session:', session)

    // optional: store user in state, redirect, etc
  })
}
