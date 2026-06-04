import { supabase } from '../lib/supabase.js'

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    return { success: false, error }
  }

  return { success: true, session: data.session }
}
