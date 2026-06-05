// lib/supabase.js

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  'https://qshqulmdhuwtcedrdrxq.supabase.co';

const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzaHF1bG1kaHV3dGNlZHJkcnhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyODEwMTMsImV4cCI6MjA4OTg1NzAxM30.UY7zcNwa1xmAhiQk2i8kFAPVyq7lG2B4TzM41eCG8s0';

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
