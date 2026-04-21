// ============================================================
// EBS Tracker — Utility Functions (v2)
// ============================================================

/* ── Date helpers ─────────────────────────────────────────── */
function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const w1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
}

function getMonthName(date) {
  return new Date(date).toLocaleString('default', { month: 'long' });
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function getTodayInfo() {
  const t = new Date();
  const pad = n => String(n).padStart(2, '0');
  return {
    date: `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`,
    month: getMonthName(t),
    week: getWeekNumber(t),
    year: t.getFullYear()
  };
}

function toDateStr(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* ── Kuwait Working Time Helpers ──────────────────────────── */

/** True if date falls within Ramadan 2026 window */
function isRamadanDay(date) {
  const d = toDateStr(date);
  return d >= RAMADAN_2026_START && d <= RAMADAN_2026_END;
}

/** True if date is an official Kuwait public holiday (working day) */
function isKuwaitHoliday(date) {
  return KUWAIT_HOLIDAYS_2026.includes(toDateStr(date));
}

/** True if Friday or Saturday */
function isWeekendDay(date) {
  const dow = new Date(date).getDay();
  return dow === 5 || dow === 6;
}

/** Daily working hours for a given date (6 Ramadan, 8 otherwise) */
function getDailyHours(date) {
  return isRamadanDay(date) ? RAMADAN_DAILY_HOURS : NORMAL_DAILY_HOURS;
}

/**
 * Calculate working days and expected hours from TRACKER_START_DATE to today.
 * Excludes: Fri/Sat weekends, Kuwait public holidays, war days (global),
 * and per-user approved leave date ranges.
 *
 * @param {number} warDaysOff   - Global war days deduction
 * @param {Array}  userLeaves   - Array of {start_date, end_date} for this user
 * @returns {object}
 */
function getWorkingDaysInfo(warDaysOff = 0, userLeaves = [], warDayRanges = [], startDateOverride = null) {
  const startDateStr = startDateOverride || TRACKER_START_DATE;
  const start = new Date(startDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build a set of leave dates for fast lookup
  const leaveDateSet = new Set();
  (userLeaves || []).forEach(lv => {
    const s = new Date(lv.start_date); s.setHours(0,0,0,0);
    const e = new Date(lv.end_date);   e.setHours(0,0,0,0);
    const c = new Date(s);
    while (c <= e) {
      leaveDateSet.add(toDateStr(c));
      c.setDate(c.getDate() + 1);
    }
  });

  let rawWorkingDays     = 0;
  let rawExpectedHours   = 0;
  let ramadanWorkingDays = 0;
  let normalWorkingDays  = 0;
  let holidayCount       = 0;
  let leaveDays          = 0;
  let leaveHours         = 0;

  const cur = new Date(start);
  while (cur <= today) {
    const ds = toDateStr(cur);
    if (!isWeekendDay(cur)) {
      if (isKuwaitHoliday(cur)) {
        holidayCount++;
      } else if (leaveDateSet.has(ds)) {
        leaveDays++;
        leaveHours += getDailyHours(cur);
      } else {
        rawWorkingDays++;
        rawExpectedHours += getDailyHours(cur);
        if (isRamadanDay(cur)) ramadanWorkingDays++;
        else normalWorkingDays++;
      }
    }
    cur.setDate(cur.getDate() + 1);
  }

  // Build war day set from ranges
  const warDateSet = new Set();
  (warDayRanges || []).forEach(wr => {
    const s = new Date(wr.start_date); s.setHours(0,0,0,0);
    const e = new Date(wr.end_date);   e.setHours(0,0,0,0);
    const cc = new Date(s);
    while (cc <= e) {
      // Only count as war day if it would have been a working day
      if (!isWeekendDay(cc) && !isKuwaitHoliday(cc) && !leaveDateSet.has(toDateStr(cc))) {
        warDateSet.add(toDateStr(cc));
      }
      cc.setDate(cc.getDate() + 1);
    }
  });

  // Also support legacy warDaysOff number if no ranges provided
  const effectiveWarDays = warDayRanges.length > 0 ? warDateSet.size
    : Math.min(Math.max(0, parseInt(warDaysOff) || 0), rawWorkingDays);

  let warHours = 0;
  if (warDayRanges.length > 0) {
    // Calculate actual hours lost (Ramadan vs normal)
    warDateSet.forEach(ds => { warHours += getDailyHours(ds); });
  } else {
    warHours = effectiveWarDays * NORMAL_DAILY_HOURS;
  }

  const workingDays   = rawWorkingDays - effectiveWarDays;
  const expectedHours = Math.max(0, rawExpectedHours - warHours);

  return {
    workingDays,
    rawWorkingDays,
    expectedHours:    Math.round(expectedHours * 10) / 10,
    rawExpectedHours: Math.round(rawExpectedHours * 10) / 10,
    warDaysOff:       effectiveWarDays,
    warHours:         Math.round(warHours * 10) / 10,
    leaveDays,
    leaveHours:       Math.round(leaveHours * 10) / 10,
    ramadanWorkingDays,
    normalWorkingDays,
    holidayCount,
    periodLabel: `${formatDate(startDateStr)} → ${formatDate(toDateStr(today))}`,
  };
}

/**
 * Convert logged hours to day-equivalent with per-log precision.
 * Ramadan logs divide by 6, normal logs divide by 8.
 * @param {Array} logs
 * @returns {number}
 */
function convertHoursToDays(logs) {
  if (!logs || !logs.length) return 0;
  let days = 0;
  logs.forEach(l => {
    const dailyHrs = isRamadanDay(l.log_date) ? RAMADAN_DAILY_HOURS : NORMAL_DAILY_HOURS;
    days += parseFloat(l.hours_spent || 0) / dailyHrs;
  });
  return Math.round(days * 100) / 100;
}

/* ── Level helpers ────────────────────────────────────────── */
function getUserLevel(totalHours) {
  let cur = LEVELS[0];
  for (const lvl of LEVELS) { if (totalHours >= lvl.minHours) cur = lvl; }
  return cur;
}

function getXPProgress(totalHours) {
  const cur  = getUserLevel(totalHours);
  const next = LEVELS.find(l => l.level === cur.level + 1);
  if (!next) return 100;
  return Math.min(Math.round(((totalHours - cur.minHours) / (next.minHours - cur.minHours)) * 100), 100);
}

/* ── Stats calculation ────────────────────────────────────── */
function calculateStats(logs) {
  if (!logs || logs.length === 0) return {
    totalHours: 0, totalTasks: 0, supportCount: 0, testingCount: 0,
    projectCount: 0, maxStreak: 0, currentStreak: 0, maxDayHours: 0,
    uniqueDays: 0, hasAllRounder: false, accomplishmentRate: 0, accomplishmentCount: 0,
    supportHours: 0, testingHours: 0, projectHours: 0
  };

  const totalHours   = logs.reduce((s, l) => s + parseFloat(l.hours_spent || 0), 0);
  const totalTasks   = logs.length;
  const supportLogs  = logs.filter(l => l.category === 'Support');
  const testingLogs  = logs.filter(l => l.category === 'Testing');
  const projectLogs  = logs.filter(l => l.category === 'Project');
  const supportHours = supportLogs.reduce((s, l) => s + parseFloat(l.hours_spent || 0), 0);
  const testingHours = testingLogs.reduce((s, l) => s + parseFloat(l.hours_spent || 0), 0);
  const projectHours = projectLogs.reduce((s, l) => s + parseFloat(l.hours_spent || 0), 0);

  const byDate = {};
  logs.forEach(l => {
    if (!byDate[l.log_date]) byDate[l.log_date] = { hours: 0, cats: new Set() };
    byDate[l.log_date].hours += parseFloat(l.hours_spent || 0);
    byDate[l.log_date].cats.add(l.category);
  });

  const uniqueDays  = Object.keys(byDate).length;
  const maxDayHours = Math.max(...Object.values(byDate).map(d => d.hours), 0);

  const sorted = Object.keys(byDate).sort();
  let maxStreak = sorted.length > 0 ? 1 : 0, curStreak = sorted.length > 0 ? 1 : 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    // Count working days between prev and curr (skip Fri/Sat weekends)
    let workingDaysDiff = 0;
    const scan = new Date(prev); scan.setDate(scan.getDate() + 1);
    while (scan <= curr) {
      const dow = scan.getDay();
      if (dow !== 5 && dow !== 6) workingDaysDiff++;
      scan.setDate(scan.getDate() + 1);
    }
    if (workingDaysDiff === 1) { curStreak++; maxStreak = Math.max(maxStreak, curStreak); }
    else curStreak = 1;
  }
  if (sorted.length > 0) {
    const today = new Date(); today.setHours(0,0,0,0);
    const lastLog = new Date(sorted[sorted.length - 1]);
    // Count working days since last log
    let daysSince = 0;
    const scan = new Date(lastLog); scan.setDate(scan.getDate() + 1);
    while (scan <= today) {
      const dow = scan.getDay();
      if (dow !== 5 && dow !== 6) daysSince++;
      scan.setDate(scan.getDate() + 1);
    }
    if (daysSince > 1) curStreak = 0;
  }

  const byWeek = {};
  logs.forEach(l => {
    const wk = `${new Date(l.log_date).getFullYear()}-W${getWeekNumber(l.log_date)}`;
    if (!byWeek[wk]) byWeek[wk] = new Set();
    byWeek[wk].add(l.category);
  });
  const hasAllRounder = Object.values(byWeek).some(s => s.size === 3);

  // Count of entries where accomplishment was filled (not a rate — one task may be logged multiple times/day)
  const accomplishmentCount = logs.filter(l => l.accomplishment && l.accomplishment.trim()).length;
  const accomplishmentRate = totalTasks > 0 ? Math.round((accomplishmentCount / totalTasks) * 100) : 0;

  return {
    totalHours: Math.round(totalHours * 10) / 10, totalTasks,
    supportCount: supportLogs.length, testingCount: testingLogs.length, projectCount: projectLogs.length,
    maxStreak, currentStreak: curStreak, maxDayHours, uniqueDays, hasAllRounder, accomplishmentRate, accomplishmentCount,
    supportHours: Math.round(supportHours * 10) / 10,
    testingHours: Math.round(testingHours * 10) / 10,
    projectHours: Math.round(projectHours * 10) / 10,
  };
}

function getEarnedBadges(stats) {
  return BADGES.map(b => ({ ...b, earned: b.check(stats) }));
}

/* ── Weekly aggregation ───────────────────────────────────── */
function aggregateByWeek(logs, nWeeks = 8) {
  const weeks = {};
  for (let i = nWeeks - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i * 7);
    const wk = `W${getWeekNumber(d)}`;
    weeks[wk] = { label: wk, hours: 0, tasks: 0 };
  }
  logs.forEach(l => {
    const wk = `W${getWeekNumber(l.log_date)}`;
    if (weeks[wk]) { weeks[wk].hours += parseFloat(l.hours_spent || 0); weeks[wk].tasks++; }
  });
  return Object.values(weeks);
}

/* ── CSV Export ───────────────────────────────────────────── */
function exportToCSV(data, filename = 'export.csv') {
  if (!data || !data.length) { showToast('No data to export', 'info'); return; }
  const headers = Object.keys(data[0]);
  const rows = data.map(r =>
    headers.map(h => {
      const v = String(r[h] ?? '').replace(/"/g, '""');
      return (v.includes(',') || v.includes('"') || v.includes('\n')) ? `"${v}"` : v;
    }).join(',')
  );
  const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

/* ── Toast ─────────────────────────────────────────────────── */
function showToast(message, type = 'info') {
  document.querySelectorAll('.wt-toast').forEach(t => t.remove());
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const t = document.createElement('div');
  t.className = `wt-toast wt-toast-${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, 3200);
}

/* ── Sidebar ─────────────────────────────────────────────────*/
function renderSidebar(activePage) {
  const session = getSession();
  if (!session) return;
  const initials = session.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const adminLink = session.role === 'admin'
    ? `<a href="admin.html" class="nav-link ${activePage === 'admin' ? 'active' : ''}"><span class="nav-icon">👑</span><span>Admin Panel</span></a>` : '';

  document.getElementById('app-sidebar').innerHTML = `
    <div class="sidebar-header"><div class="app-logo"><img src="logo.png" alt="EBS" class="logo-dark" style="height:28px;mix-blend-mode:screen;flex-shrink:0;" /><img src="logo-light.png" alt="EBS" class="logo-light" style="height:28px;flex-shrink:0;" /><span class="logo-text">EBS Tracker</span></div></div>
    <div class="sidebar-user">
      <div class="user-avatar lvl-1" id="sb-avatar">${initials}</div>
      <div class="user-info"><div class="user-name">${session.fullName}</div><div class="user-level-tag" id="sb-level">Loading...</div></div>
    </div>
    <div class="sidebar-xp">
      <div class="xp-row"><span>XP</span><span id="sb-xp-label">0%</span></div>
      <div class="xp-track"><div class="xp-fill lvl-fill-1" id="sb-xp-fill" style="width:0%"></div></div>
    </div>
    <nav class="sidebar-nav">
      <a href="dashboard.html" class="nav-link ${activePage === 'dashboard' ? 'active' : ''}"><span class="nav-icon">📊</span><span>Dashboard</span></a>
      <a href="log.html" class="nav-link ${activePage === 'log' ? 'active' : ''}"><span class="nav-icon">➕</span><span>Log Task</span></a>
      <a href="performance.html" class="nav-link ${activePage === 'performance' ? 'active' : ''}"><span class="nav-icon">⚡</span><span>My Performance</span></a>
      <a href="tasks.html" class="nav-link ${activePage === 'tasks' ? 'active' : ''}"><span class="nav-icon">📌</span><span>My Tasks</span></a>
      ${adminLink}
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
        <a href="../index.html" class="nav-link" style="opacity:0.7;"><span class="nav-icon">🏠</span><span>Project Website</span></a>
      </div>
    </nav>
    <div class="sidebar-footer"><button class="logout-btn" onclick="logout()"><span>🚪</span> Logout</button></div>
  `;
}

async function loadSidebarStats(userId) {
  try {
    const { data } = await db.from('task_logs').select('hours_spent').eq('user_id', userId);
    const total = (data || []).reduce((s, l) => s + parseFloat(l.hours_spent || 0), 0);
    const lvl = getUserLevel(total), xp = getXPProgress(total);
    const avEl = document.getElementById('sb-avatar');
    const lvEl = document.getElementById('sb-level');
    const fpEl = document.getElementById('sb-xp-fill');
    const lpEl = document.getElementById('sb-xp-label');
    if (avEl) avEl.className = `user-avatar ${lvl.class}`;
    if (lvEl) { lvEl.textContent = `${lvl.icon} ${lvl.name} · Lv.${lvl.level}`; lvEl.style.color = lvl.color; }
    if (fpEl) { fpEl.style.width = `${xp}%`; fpEl.className = `xp-fill lvl-fill-${lvl.level}`; }
    if (lpEl) lpEl.textContent = `${xp}%`;
  } catch(e) { console.warn('Sidebar stats error', e); }
}

/* ── Misc ─────────────────────────────────────────────────── */
function categoryBadge(cat) {
  const c = CAT_COLORS[cat] || { border: '#64748b', text: '#94a3b8', bg: '#1e293b' };
  return `<span class="cat-badge" style="border-color:${c.border};color:${c.text};background:${c.bg}">${cat}</span>`;
}

function truncate(str, n = 50) {
  return str && str.length > n ? str.slice(0, n) + '…' : (str || '—');
}

// ── Mobile sidebar close ───────────────────────────────────
function closeSidebar() {
  document.getElementById('app-sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('open');
}

// ── Theme Management ───────────────────────────────────────
const THEME_KEY = 'ebs_theme';

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(saved);
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.body.classList.add('light-mode');
  } else {
    document.body.classList.remove('light-mode');
  }
  localStorage.setItem(THEME_KEY, theme);
  // Update toggle icon
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = theme === 'light' ? '🌙' : '☀️';
}

function toggleTheme() {
  const current = localStorage.getItem(THEME_KEY) || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

function injectThemeToggle() {
  if (document.getElementById('themeToggle')) return;
  const btn = document.createElement('button');
  btn.id        = 'themeToggle';
  btn.className = 'theme-toggle';
  btn.title     = 'Toggle light/dark mode';
  btn.textContent = (localStorage.getItem(THEME_KEY) || 'light') === 'light' ? '🌙' : '☀️';
  btn.onclick   = toggleTheme;
  document.body.appendChild(btn);
}

// ── Stats with completed tasks ─────────────────────────────
function getCompletedCount(logs) {
  // Handles true, 1, or truthy — DB may return bool or null
  return (logs || []).filter(l => !!l.is_completed).length;
}
