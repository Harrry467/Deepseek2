// utils/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY environment variables');
}

// Server-side client using secret key — never expose this to the browser
export const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false }
});
