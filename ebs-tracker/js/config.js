// ============================================================
// WorkTracker — Configuration
// ⚠️  Replace the values below with YOUR Supabase credentials
// ============================================================

const SUPABASE_URL      = 'https://hddfkkojfvmjuxsyhcgh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkZGZra29qZnZtanV4c3loY2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDI1MjksImV4cCI6MjA5MjI3ODUyOX0.2EYGf2PPBDpkkY1d2Rp87GY5so05ehx6a0sYfCXHe1Q';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// Tracker Period & Working Hours
// ============================================================
const TRACKER_START_DATE   = '2026-03-03';   // When tracking began
const RAMADAN_2026_START   = '2026-02-18';   // Ramadan starts
const RAMADAN_2026_END     = '2026-03-20';   // Ramadan ends (inclusive)
const RAMADAN_DAILY_HOURS  = 6;              // Working hours during Ramadan
const NORMAL_DAILY_HOURS   = 8;             // Normal working hours

// ============================================================
// Kuwait Public Holidays 2026
// Only weekdays that fall within the tracker window (March 3+)
// Fridays & Saturdays are already excluded as weekends.
// ⚠️  Islamic holiday dates are approximate (based on astronomical
//     calculation). Verify with official Kuwait announcements.
// ============================================================
const KUWAIT_HOLIDAYS_2026 = [
  // ── Eid Al Fitr (end of Ramadan ~Mar 20) ──────────────────
  // Mar 20 = Fri (weekend anyway), Mar 21 = Sat (weekend)
  '2026-03-22', // Eid Al Fitr – Day 1 (Sunday)
  '2026-03-23', // Eid Al Fitr – Day 2 (Monday)

  // ── Eid Al Adha (~June 6–8) ───────────────────────────────
  // Jun 6 = Sat (weekend), Jun 7 = Sun
  '2026-06-07', // Eid Al Adha – Day 1 (Sunday)
  '2026-06-08', // Eid Al Adha – Day 2 (Monday)
  '2026-06-09', // Eid Al Adha – Day 3 (Tuesday)

  // ── Islamic New Year (1 Muharram 1448H ~Jun 28) ───────────
  '2026-06-28', // Islamic New Year (Sunday)

  // ── Prophet's Birthday (12 Rabi' Al Awwal 1448H ~Sep 6) ──
  '2026-09-06', // Prophet's Birthday (Sunday)
];

// Human-readable holiday labels (for info display)
const KUWAIT_HOLIDAY_LABELS = {
  '2026-03-22': 'Eid Al Fitr (Day 1)',
  '2026-03-23': 'Eid Al Fitr (Day 2)',
  '2026-06-07': 'Eid Al Adha (Day 1)',
  '2026-06-08': 'Eid Al Adha (Day 2)',
  '2026-06-09': 'Eid Al Adha (Day 3)',
  '2026-06-28': 'Islamic New Year',
  '2026-09-06': "Prophet's Birthday",
};

// ============================================================
// RPG Level System
// ============================================================
const LEVELS = [
  { level: 1, name: 'Novice',      minHours: 0,   maxHours: 25,       color: '#94a3b8', icon: '⚔️',  class: 'lvl-1' },
  { level: 2, name: 'Apprentice',  minHours: 26,  maxHours: 75,       color: '#22c55e', icon: '🛡️',  class: 'lvl-2' },
  { level: 3, name: 'Journeyman',  minHours: 76,  maxHours: 150,      color: '#3b82f6', icon: '⚡',   class: 'lvl-3' },
  { level: 4, name: 'Expert',      minHours: 151, maxHours: 300,      color: '#8b5cf6', icon: '🔮',  class: 'lvl-4' },
  { level: 5, name: 'Master',      minHours: 301, maxHours: 500,      color: '#f59e0b', icon: '🌟',  class: 'lvl-5' },
  { level: 6, name: 'Legend',      minHours: 501, maxHours: Infinity, color: '#ef4444', icon: '👑',  class: 'lvl-6' },
];

// ============================================================
// Badge Definitions
// ============================================================
const BADGES = [
  { id: 'century_knight',   name: 'Century Knight',   desc: 'Log 100+ total hours',                 icon: '💯', check: (s) => s.totalHours >= 100 },
  { id: 'streak_warrior',   name: 'Streak Warrior',   desc: 'Log tasks 7 consecutive days',         icon: '🔥', check: (s) => s.maxStreak >= 7 },
  { id: 'support_guardian', name: 'Support Guardian', desc: 'Complete 20+ Support tasks',           icon: '🛡️', check: (s) => s.supportCount >= 20 },
  { id: 'test_mage',        name: 'Test Mage',        desc: 'Complete 20+ Testing tasks',           icon: '🧪', check: (s) => s.testingCount >= 20 },
  { id: 'project_champion', name: 'Project Champion', desc: 'Complete 20+ Project tasks',           icon: '🚀', check: (s) => s.projectCount >= 20 },
  { id: 'powerhouse',       name: 'Powerhouse',       desc: 'Log 8+ hours in a single day',        icon: '⚡', check: (s) => s.maxDayHours >= 8 },
  { id: 'all_rounder',      name: 'All-Rounder',      desc: 'Use all 3 categories in one week',    icon: '🌟', check: (s) => s.hasAllRounder },
  { id: 'veteran',          name: 'Veteran',          desc: 'Log tasks on 30+ unique days',        icon: '📅', check: (s) => s.uniqueDays >= 30 },
  { id: 'prolific',         name: 'Prolific',         desc: 'Complete 50+ tasks total',            icon: '🐦', check: (s) => s.totalTasks >= 50 },
  { id: 'workhorse',        name: 'Workhorse',        desc: 'Log 250+ total hours',                icon: '🏇', check: (s) => s.totalHours >= 250 },
];

// Category colors — dark mode
const CAT_COLORS_DARK = {
  'Support': { bg: '#1d3a6b', border: '#3b82f6', text: '#93c5fd' },
  'Testing': { bg: '#2d1b69', border: '#8b5cf6', text: '#c4b5fd' },
  'Project': { bg: '#064e3b', border: '#10b981', text: '#6ee7b7' },
};
// Category colors — light mode (warm ivory theme)
const CAT_COLORS_LIGHT = {
  'Support': { bg: '#dbeafe', border: '#2563eb', text: '#1d4ed8' },
  'Testing': { bg: '#ede9fe', border: '#7c3aed', text: '#5b21b6' },
  'Project': { bg: '#d1fae5', border: '#059669', text: '#065f46' },
};
function getCatColors() {
  return document.body.classList.contains('light-mode') ? CAT_COLORS_LIGHT : CAT_COLORS_DARK;
}
// Keep CAT_COLORS as a getter-like alias for backward compatibility
const CAT_COLORS = new Proxy({}, {
  get(_, cat) { return getCatColors()[cat]; }
});

// ============================================================
// Sub-Category Definitions
// ============================================================

// Fixed sub-categories for Testing and Support
const FIXED_SUBCATEGORIES = {
  Support: [
    { name: 'User Support',      icon: '👤' },
    { name: 'D365 User Support', icon: '💼' },
    { name: 'Report Support',    icon: '📊' },
  ],
  Testing: [
    { name: 'Hardware Testing',  icon: '🔧' },
    { name: 'Software Testing',  icon: '💻' },
  ],
};

// Map subcategory name → parent category (for fixed ones)
const SUBCAT_TO_CATEGORY = {
  'User Support':      'Support',
  'D365 User Support': 'Support',
  'Report Support':    'Support',
  'Hardware Testing':  'Testing',
  'Software Testing':  'Testing',
  // Project subcategories are dynamic — resolved at runtime
};

// Category icons
const CAT_ICONS = { Support: '🛡️', Testing: '🧪', Project: '🚀' };
