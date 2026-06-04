import { supabase } from '../lib/supabase.js'

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  })

  if (error) {
    console.error(error.message)
    return { success: false, error }
  }

  return { success: true, user: data.user }
}
