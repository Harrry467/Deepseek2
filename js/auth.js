// js/auth.js
// Supabase publishable key is safe to use in browser JS
const SUPABASE_URL = 'https://qshqulmdhuwtcedrdrxq.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = window.__ENV__?.SUPABASE_PUBLISHABLE_KEY || '';

// Load Supabase from CDN
async function getSupabase() {
  if (window._supabase) return window._supabase;
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  window._supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return window._supabase;
}

// Get current session token for API calls
async function getAuthHeader() {
  const sb = await getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return {};
  return { 'Authorization': `Bearer ${session.access_token}` };
}

// Get current user object
async function getCurrentUser() {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

// Logout
async function logout() {
  const sb = await getSupabase();
  await sb.auth.signOut();
  window.location.href = 'index.html';
}

// Redirect to dashboard if already logged in
async function redirectIfLoggedIn() {
  const user = await getCurrentUser();
  if (user) window.location.href = 'dashboard.html';
}

// Redirect to login if not logged in
async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) window.location.href = 'login.html';
  return user;
}

// Login form handler
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('authError');

  try {
    const sb = await getSupabase();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      if (errorEl) errorEl.textContent = error.message;
      else alert(error.message);
      return;
    }
    window.location.href = 'dashboard.html';
  } catch (err) {
    if (errorEl) errorEl.textContent = 'Login failed. Please try again.';
    else alert('Login failed. Please try again.');
  }
});

// Signup form handler
document.getElementById('signupForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const confirm = document.getElementById('confirmPassword').value;
  const errorEl = document.getElementById('authError');

  if (password !== confirm) {
    if (errorEl) errorEl.textContent = 'Passwords do not match';
    else alert('Passwords do not match');
    return;
  }
  if (password.length < 6) {
    if (errorEl) errorEl.textContent = 'Password must be at least 6 characters';
    else alert('Password must be at least 6 characters');
    return;
  }

  try {
    const sb = await getSupabase();
    const { error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });
    if (error) {
      if (errorEl) errorEl.textContent = error.message;
      else alert(error.message);
      return;
    }
    // Supabase sends a confirmation email by default
    // For instant access, you can disable email confirmation in Supabase Auth settings
    window.location.href = 'dashboard.html';
  } catch (err) {
    if (errorEl) errorEl.textContent = 'Sign up failed. Please try again.';
    else alert('Sign up failed. Please try again.');
  }
});

// Expose helpers globally for use in other scripts
window.getAuthHeader = getAuthHeader;
window.getCurrentUser = getCurrentUser;
window.logout = logout;
window.requireAuth = requireAuth;
window.redirectIfLoggedIn = redirectIfLoggedIn;
