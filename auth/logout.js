import { supabase } from '../lib/supabase.js'

export async function logout() {
  await supabase.auth.signOut()
}
