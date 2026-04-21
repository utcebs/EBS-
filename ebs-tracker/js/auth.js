// ============================================================
// WorkTracker — Authentication Module (Supabase Auth)
// Uses Supabase email/password auth. Profiles stored in the
// 'profiles' table (linked to Supabase Auth UUID).
// ============================================================

const SESSION_KEY = 'wt_session';

// ── Login with email + password ───────────────────────────────
async function login(email, password) {
  try {
    const { data, error } = await db.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) return { success: false, error: error.message };

    const { data: profile } = await db
      .from('profiles')
      .select('full_name, role, username')
      .eq('id', data.user.id)
      .maybeSingle();

    const session = {
      id:        data.user.id,
      email:     data.user.email,
      username:  profile?.username || data.user.email.split('@')[0],
      fullName:  profile?.full_name || data.user.email.split('@')[0],
      role:      profile?.role || 'user',
      loginTime: new Date().toISOString(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { success: true, user: session };
  } catch (err) {
    console.error('Login error:', err);
    return { success: false, error: 'Connection error. Check your Supabase config.' };
  }
}

// ── Logout ────────────────────────────────────────────────────
async function logout() {
  await db.auth.signOut();
  localStorage.removeItem(SESSION_KEY);
  window.location.href = 'index.html';
}

// ── Get current session (sync, from localStorage cache) ───────
function getSession() {
  try {
    const s = localStorage.getItem(SESSION_KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

// ── Require auth — redirect to login if no session ────────────
function requireAuth() {
  const session = getSession();
  if (!session) { window.location.href = 'index.html'; return null; }
  return session;
}

// ── Require admin — redirect to dashboard if not admin ────────
function requireAdmin() {
  const session = requireAuth();
  if (session && session.role !== 'admin') {
    window.location.href = 'dashboard.html';
    return null;
  }
  return session;
}

// ── Check if current user is admin ────────────────────────────
function isAdmin() {
  const s = getSession();
  return s && s.role === 'admin';
}

// ── Sync session from Supabase ────────────────────────────────
// Called on every page load (index.html) to detect an existing
// Supabase session (e.g. admin already logged in via the project
// website). If found, auto-populates the local wt_session so the
// user skips the login screen.
//
// Returns: the session object if synced, null otherwise.
async function syncSessionFromSupabase() {
  try {
    const { data: { session: supaSession } } = await db.auth.getSession();

    if (!supaSession) {
      // No Supabase session — clear stale local cache if any
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    const local = getSession();
    if (local && local.id === supaSession.user.id) {
      // Already in sync
      return local;
    }

    // Supabase session exists but no local wt_session
    // (admin navigated here from project website)
    const { data: profile } = await db
      .from('profiles')
      .select('full_name, role, username')
      .eq('id', supaSession.user.id)
      .maybeSingle();

    if (!profile) {
      // Auth user exists but no profile in EBS tracker context.
      // Clear only the LOCAL tracker session — DO NOT sign out of Supabase,
      // that would log the user out of the project website too.
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    const session = {
      id:        supaSession.user.id,
      email:     supaSession.user.email,
      username:  profile.username || supaSession.user.email.split('@')[0],
      fullName:  profile.full_name || supaSession.user.email.split('@')[0],
      role:      profile.role || 'user',
      loginTime: new Date().toISOString(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  } catch (err) {
    console.error('syncSessionFromSupabase error:', err);
    return null;
  }
}
