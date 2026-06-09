// js/auth.js

const SUPABASE_URL = 'https://qshqulmdhuwtcedrdrxq.supabase.co';

const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzaHF1bG1kaHV3dGNlZHJkcnhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyODEwMTMsImV4cCI6MjA4OTg1NzAxM30.UY7zcNwa1xmAhiQk2i8kFAPVyq7lG2B4TzM41eCG8s0';

let supabase = null;

// ---------------------------------------------------------------------------
// initSupabase
// Returns the single shared Supabase client, creating it once.
// Exposed globally so every page (history.html, dashboard.html, etc.) reuses
// the SAME instance — which guarantees getSession() always sees the live
// session that was hydrated when the page loaded.
// ---------------------------------------------------------------------------
async function initSupabase() {
  if (supabase) return supabase;

  try {
    const { createClient } = await import(
      'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
    );

    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession:    true,
        autoRefreshToken:  true,
        detectSessionInUrl: true
      }
    });

    return supabase;
  } catch (err) {
    console.error('Failed to initialise Supabase:', err);
    alert('Authentication failed to load. Please refresh the page.');
    throw err;
  }
}

// ---------------------------------------------------------------------------
// getAuthHeader
// Builds the Authorization header using the current session token.
// Returns {} (no header) if no session exists — callers should guard for this.
// ---------------------------------------------------------------------------
async function getAuthHeader() {
  const sb = await initSupabase();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

// ---------------------------------------------------------------------------
// getCurrentUser
// ---------------------------------------------------------------------------
async function getCurrentUser() {
  try {
    const sb = await initSupabase();
    const { data: { user } } = await sb.auth.getUser();
    return user || null;
  } catch (err) {
    console.error('Get user error:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// redirectIfLoggedIn  –  use on login/signup pages
// ---------------------------------------------------------------------------
async function redirectIfLoggedIn() {
  const user = await getCurrentUser();
  if (user) window.location.href = 'dashboard.html';
}

// ---------------------------------------------------------------------------
// requireAuth  –  use on protected pages
// Redirects to login if there is no active session.
// ---------------------------------------------------------------------------
async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------
async function logout() {
  try {
    const sb = await initSupabase();
    await sb.auth.signOut();
  } catch (err) {
    console.error('Logout failed:', err);
  }
  window.location.href = 'index.html';
}

// ---------------------------------------------------------------------------
// Form handlers (login + signup)
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {

  // ── Login ──────────────────────────────────────────────────────────────────
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email    = document.getElementById('email')?.value?.trim();
      const password = document.getElementById('password')?.value;
      const errorEl  = document.getElementById('authError');
      if (errorEl) errorEl.textContent = '';

      try {
        const sb = await initSupabase();
        const { error } = await sb.auth.signInWithPassword({ email, password });

        if (error) {
          console.error(error);
          if (errorEl) errorEl.textContent = error.message;
          else alert(error.message);
          return;
        }

        window.location.href = 'dashboard.html';
      } catch (err) {
        console.error(err);
        if (errorEl) errorEl.textContent = 'Login failed. Please try again.';
        else alert('Login failed.');
      }
    });
  }

  // ── Signup ─────────────────────────────────────────────────────────────────
  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name            = document.getElementById('name')?.value?.trim();
      const email           = document.getElementById('email')?.value?.trim();
      const password        = document.getElementById('password')?.value;
      const confirmPassword = document.getElementById('confirmPassword')?.value;
      const errorEl         = document.getElementById('authError');
      if (errorEl) errorEl.textContent = '';

      if (password !== confirmPassword) {
        if (errorEl) errorEl.textContent = 'Passwords do not match';
        return;
      }
      if (password.length < 6) {
        if (errorEl) errorEl.textContent = 'Password must be at least 6 characters';
        return;
      }

      try {
        const sb = await initSupabase();
        const { error } = await sb.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } }
        });

        if (error) {
          console.error(error);
          if (errorEl) errorEl.textContent = error.message;
          else alert(error.message);
          return;
        }

        window.location.href = 'dashboard.html';
      } catch (err) {
        console.error(err);
        if (errorEl) errorEl.textContent = 'Sign up failed. Please try again.';
        else alert('Sign up failed.');
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Global exports
// initSupabase is exported here so pages like history.html can call
// `const sb = await initSupabase()` and reuse the same client without
// creating a second instance (which would race on session hydration).
// ---------------------------------------------------------------------------
window.initSupabase       = initSupabase;
window.getAuthHeader      = getAuthHeader;
window.getCurrentUser     = getCurrentUser;
window.requireAuth        = requireAuth;
window.redirectIfLoggedIn = redirectIfLoggedIn;
window.logout             = logout;
