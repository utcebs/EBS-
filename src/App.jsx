import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import {
  LayoutDashboard, FolderKanban, GanttChart as GanttIcon, LogIn, LogOut,
  Users, Plus, Pencil, Trash2, X, ChevronRight, AlertTriangle,
  CheckCircle2, Clock, Pause, Target, Shield, Eye, ArrowLeft, Save,
  RefreshCw, Search, Menu, AlertCircle, ExternalLink, BarChart3,
  ListChecks, FileWarning, Info, ChevronDown, ChevronUp,
  Upload, Download, FileSpreadsheet, Presentation
} from 'lucide-react'
import PptxGenJS from 'pptxgenjs'
import * as XLSX from 'xlsx'

// ─── Auth Context ───────────────────────────────────────────
const AuthCtx = createContext(null)
const useAuth = () => useContext(AuthCtx)

// ─── Projects Cache Context ──────────────────────────────────
// Fetches projects ONCE at app level so navigating between pages
// never triggers a redundant Supabase call.
const ProjectsCtx = createContext(null)
const useProjects = () => useContext(ProjectsCtx)

function ProjectsProvider({ children }) {
  const { loading: authLoading, user } = useAuth()
  const [projects, setProjects] = useState([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [projectsError, setProjectsError] = useState(null)

  const refreshProjects = useCallback(async () => {
    setProjectsError(null)
    try {
      const { data, error } = await supabase.from('projects').select('*').order('project_number')
      if (error) throw error
      setProjects(data || [])
    } catch (e) {
      console.error('Failed to load projects:', e)
      setProjectsError(e.message || 'Failed to load projects')
    } finally {
      setProjectsLoading(false)
    }
  }, [])

  // Fetch once auth settles. Never resets projectsLoading to true on refetch —
  // we already have old data to show, no need to flash a spinner.
  useEffect(() => {
    if (authLoading) return
    // Hard safety: loading state can never stay stuck past 6s
    const safety = setTimeout(() => setProjectsLoading(false), 6000)
    refreshProjects().finally(() => clearTimeout(safety))
    return () => clearTimeout(safety)
  }, [authLoading, user?.id, refreshProjects])

  return (
    <ProjectsCtx.Provider value={{ projects, projectsLoading, projectsError, refreshProjects }}>
      {children}
    </ProjectsCtx.Provider>
  )
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId) => {
    if (!userId) { setProfile(null); return null }
    const { data } = await supabase.from('profiles').select('role, full_name').eq('id', userId).maybeSingle()
    setProfile(data)
    return data
  }

  useEffect(() => {
    // Safety fallback — never stay stuck on loading screen
    const timeout = setTimeout(() => setLoading(false), 5000)

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      try {
        setUser(session?.user ?? null)
        await fetchProfile(session?.user?.id ?? null)
      } catch (e) {
        console.error('Auth init error:', e)
      } finally {
        clearTimeout(timeout)
        setLoading(false)
      }
    }).catch(() => {
      clearTimeout(timeout)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      try {
        setUser(session?.user ?? null)
        await fetchProfile(session?.user?.id ?? null)
      } catch (e) {
        console.error('Auth state change error:', e)
      }
    })
    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }
  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }
  return <AuthCtx.Provider value={{ user, loading, signIn, signOut, isAdmin: profile?.role === 'admin', profile }}>{children}</AuthCtx.Provider>
}

// ─── Constants ──────────────────────────────────────────────
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low']
const STATUSES = ['On Track', 'At Risk', 'Delayed', 'Completed', 'On Hold']
const PHASES = ['Initiation', 'Planning', 'Execution', 'UAT', 'Go-Live', 'Closed']
const IMPACTS = ['High', 'Medium', 'Low']
const DEV_STATUSES = ['Not Started', 'In Progress', 'Completed', 'Blocked']
const UAT_STATUSES = ['Not Started', 'Pending', 'In Progress', 'Passed', 'Failed']

const STATUS_COLORS = {
  'On Track': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', hex: '#10b981' },
  'At Risk': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500', hex: '#f59e0b' },
  'Delayed': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500', hex: '#ef4444' },
  'Completed': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500', hex: '#3b82f6' },
  'On Hold': { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400', hex: '#94a3b8' },
}
const PRIORITY_COLORS = {
  Critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  High: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  Medium: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  Low: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
}
const DEV_STATUS_COLORS = {
  'Not Started': { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200', hex: '#94a3b8' },
  'In Progress': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', hex: '#f59e0b' },
  'Completed': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', hex: '#10b981' },
  'Blocked': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', hex: '#ef4444' },
}
const UAT_STATUS_COLORS = {
  'Not Started': { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200', hex: '#94a3b8' },
  'Pending': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', hex: '#f59e0b' },
  'In Progress': { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', hex: '#38bdf8' },
  'Passed': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', hex: '#10b981' },
  'Failed': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', hex: '#ef4444' },
}
const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#94a3b8']
const PRI_PIE_COLORS = ['#ef4444', '#f97316', '#38bdf8', '#94a3b8']

// ─── Utility Components ─────────────────────────────────────
const inputCls = 'w-full px-3 py-2 rounded-lg border border-surface-200 bg-white text-sm text-surface-800 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-colors'
const selectCls = inputCls
const textareaCls = inputCls + ' resize-none'

function Badge({ children, colors }) {
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
    {colors.dot && <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />}{children}
  </span>
}
function StatusBadge({ status }) { return <Badge colors={STATUS_COLORS[status] || STATUS_COLORS['On Track']}>{status}</Badge> }
function PriorityBadge({ priority }) { return <Badge colors={PRIORITY_COLORS[priority] || PRIORITY_COLORS['Medium']}>{priority}</Badge> }
function DevStatusBadge({ status }) {
  if (!status) return <span className="text-xs text-surface-400">—</span>
  return <Badge colors={DEV_STATUS_COLORS[status] || DEV_STATUS_COLORS['Not Started']}>{status}</Badge>
}
function UatStatusBadge({ status }) {
  if (!status) return <span className="text-xs text-surface-400">—</span>
  return <Badge colors={UAT_STATUS_COLORS[status] || UAT_STATUS_COLORS['Not Started']}>{status}</Badge>
}

function ProgressBar({ value, className = '', height = 'h-2' }) {
  const num = value === 'Ongoing' ? 50 : parseInt(value) || 0
  const color = num >= 100 ? 'bg-blue-500' : num >= 75 ? 'bg-emerald-500' : num >= 40 ? 'bg-amber-500' : 'bg-brand-500'
  return <div className={`flex items-center gap-2 ${className}`}>
    <div className={`flex-1 ${height} bg-surface-200 rounded-full overflow-hidden`}>
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.min(num, 100)}%` }} />
    </div>
    <span className="text-xs font-medium text-surface-500 w-12 text-right">{value === 'Ongoing' ? 'Ongoing' : `${num}%`}</span>
  </div>
}

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null
  return <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] modal-backdrop" onClick={onClose}>
    <div className={`bg-white rounded-2xl shadow-2xl ${wide ? 'max-w-4xl' : 'max-w-2xl'} w-full mx-4 max-h-[85vh] flex flex-col animate-fade-in`} onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200">
        <h2 className="text-lg font-semibold font-display text-surface-800">{title}</h2>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-600 transition-colors"><X size={18} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
    </div>
  </div>
}

function ConfirmDialog({ open, onClose, onConfirm, title, message }) {
  if (!open) return null
  return <div className="fixed inset-0 z-[60] flex items-center justify-center modal-backdrop" onClick={onClose}>
    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 animate-fade-in" onClick={e => e.stopPropagation()}>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-red-50 rounded-xl"><AlertTriangle className="text-red-500" size={20} /></div>
        <h3 className="text-lg font-semibold text-surface-800">{title}</h3>
      </div>
      <p className="text-surface-600 mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-surface-200 text-surface-600 hover:bg-surface-50 font-medium text-sm">Cancel</button>
        <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 font-medium text-sm">Delete</button>
      </div>
    </div>
  </div>
}

function FormField({ label, children, className = '' }) {
  return <div className={className}><label className="block text-sm font-medium text-surface-600 mb-1.5">{label}</label>{children}</div>
}

function EmptyState({ icon: Icon, title, description, action }) {
  return <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="p-4 bg-surface-100 rounded-2xl mb-4"><Icon className="text-surface-400" size={32} /></div>
    <h3 className="text-lg font-semibold text-surface-700 mb-1">{title}</h3>
    <p className="text-sm text-surface-500 mb-4 max-w-sm">{description}</p>
    {action}
  </div>
}

function Spinner() { return <div className="flex items-center justify-center py-20"><RefreshCw className="animate-spin text-brand-500" size={28} /></div> }

// ─── Bulk Upload Template Download ──────────────────────────
function downloadTemplate() {
  const headers = ['Project Name','Objective/Goal','Dept / Module','Business Owner','Priority','Status','Phase','Est Start (YYYY-MM)','Start Date (YYYY-MM)','End Date (YYYY-MM)','% Complete','Total Cost (KWD)','Business Impact','Cost Remarks','Dependencies','Key Risks','Mitigation','Notes / Updates','Actions Needed']
  const sample = ['Sample Project','Objective here','EBS/IT','John Doe','High','On Track','Execution','2026-01','2026-01','2026-06','50','1000','High','Budget approved','None','Scope creep','Weekly reviews','On schedule','Complete phase 1']
  const ws = XLSX.utils.aoa_to_sheet([headers, sample])
  ws['!cols'] = headers.map(() => ({ wch: 22 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Projects')
  // Add dropdowns reference sheet
  const refData = [['Priority','Status','Phase','Business Impact'],['Critical','On Track','Initiation','High'],['High','At Risk','Planning','Medium'],['Medium','Delayed','Execution','Low'],['Low','Completed','UAT',''],['','On Hold','Go-Live',''],['','','Closed','']]
  const ws2 = XLSX.utils.aoa_to_sheet(refData)
  XLSX.utils.book_append_sheet(wb, ws2, 'Dropdowns Reference')
  XLSX.writeFile(wb, 'EBS_Project_Upload_Template.xlsx')
}

async function parseBulkUpload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
        const fieldMap = {
          'Project Name': 'project_name', 'Objective/Goal': 'objective', 'Dept / Module': 'dept_module',
          'Business Owner': 'business_owner', 'Priority': 'priority', 'Status': 'status', 'Phase': 'phase',
          'Est Start (YYYY-MM)': 'est_start', 'Start Date (YYYY-MM)': 'start_date', 'End Date (YYYY-MM)': 'end_date',
          '% Complete': 'percent_complete', 'Total Cost (KWD)': 'total_cost_kwd', 'Business Impact': 'business_impact',
          'Cost Remarks': 'cost_remarks', 'Dependencies': 'dependencies', 'Key Risks': 'key_risks',
          'Mitigation': 'mitigation', 'Notes / Updates': 'notes_updates', 'Actions Needed': 'actions_needed'
        }
        const projects = rows.map(row => {
          const p = {}
          Object.entries(fieldMap).forEach(([excel, db]) => {
            const val = row[excel]
            if (val !== undefined && val !== '') {
              p[db] = db === 'total_cost_kwd' ? parseFloat(val) || 0 : String(val)
            }
          })
          return p
        }).filter(p => p.project_name)
        resolve(projects)
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// ─── PPTX Report Generation ────────────────────────────────
async function generateReport(projects) {
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'CUSTOM', width: 13.33, height: 7.5 })
  pptx.layout = 'CUSTOM'

  const BG_DARK = '0F1320'
  const BG_LIGHT = 'F8F9FC'
  const BRAND = '4263EB'
  const WHITE = 'FFFFFF'
  const GRAY = '6B7A99'
  const GREEN = '10B981'
  const RED = 'EF4444'
  const AMBER = 'F59E0B'
  const BLUE = '3B82F6'
  const SLATE = '94A3B8'

  const now = new Date()
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const currentMonth = monthNames[now.getMonth()]
  const currentYear = now.getFullYear()
  const quarter = Math.ceil((now.getMonth() + 1) / 3)
  const fy = now.getMonth() >= 3 ? currentYear : currentYear - 1

  // ─── Slide 1: Title ───
  const s1 = pptx.addSlide()
  s1.background = { color: BG_DARK }
  s1.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 1.8, w: 6.5, h: 3.5, rectRadius: 0.3, fill: { color: '1A202C' } })
  s1.addText(`Q${quarter} FY${String(fy).slice(2)}`, { x: 1.0, y: 2.2, w: 5.5, h: 0.6, fontSize: 18, color: GRAY, fontFace: 'Calibri' })
  s1.addText('Monthly Business Performance Review', { x: 1.0, y: 2.8, w: 5.5, h: 1.0, fontSize: 28, color: WHITE, bold: true, fontFace: 'Calibri' })
  s1.addText(`${currentMonth} ${currentYear}`, { x: 1.0, y: 4.4, w: 5.5, h: 0.5, fontSize: 14, color: GRAY, fontFace: 'Calibri' })

  // ─── Slide 2: Section ───
  const s2 = pptx.addSlide()
  s2.background = { color: WHITE }
  s2.addText('EBS Updates', { x: 2, y: 2.8, w: 9, h: 1.2, fontSize: 40, bold: true, color: '1A202C', fontFace: 'Calibri', align: 'center' })
  s2.addText(String(projects.length), { x: 12.0, y: 6.5, w: 1, h: 0.6, fontSize: 14, color: GRAY, fontFace: 'Calibri', align: 'right' })

  // ─── Slide 3: Data Slide ───
  const s3 = pptx.addSlide()
  s3.background = { color: BG_LIGHT }

  // Header
  s3.addText('EBS Updates', { x: 0.4, y: 0.2, w: 4, h: 0.5, fontSize: 20, bold: true, color: '1A202C', fontFace: 'Calibri' })
  s3.addText(`EBS Project Portfolio  |  ${currentMonth} ${currentYear}  |  Monthly Business Review`, { x: 0.4, y: 0.65, w: 8, h: 0.35, fontSize: 9, color: GRAY, fontFace: 'Calibri' })

  // Stats
  const onTrack = projects.filter(p => p.status === 'On Track').length
  const delayed = projects.filter(p => p.status === 'Delayed').length
  const onHold = projects.filter(p => p.status === 'On Hold').length
  const completed = projects.filter(p => p.status === 'Completed').length
  const total = projects.length

  // Portfolio Status box
  s3.addText('Portfolio Status', { x: 0.4, y: 1.15, w: 2.8, h: 0.35, fontSize: 11, bold: true, color: '1A202C', fontFace: 'Calibri' })

  const statItems = [
    { label: 'On Track', value: onTrack, color: GREEN },
    { label: 'Delayed', value: delayed, color: RED },
    { label: 'On Hold', value: onHold, color: SLATE },
    { label: 'Completed', value: completed, color: BLUE },
  ]
  statItems.forEach((item, i) => {
    const y = 1.6 + i * 0.42
    s3.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: y, w: 0.2, h: 0.25, rectRadius: 0.04, fill: { color: item.color } })
    s3.addText(item.label, { x: 0.85, y: y, w: 1.5, h: 0.25, fontSize: 10, color: '1A202C', fontFace: 'Calibri' })
    s3.addText(String(item.value), { x: 2.5, y: y, w: 0.6, h: 0.25, fontSize: 12, bold: true, color: '1A202C', fontFace: 'Calibri', align: 'right' })
  })

  // Total circle
  s3.addShape(pptx.shapes.OVAL, { x: 0.7, y: 3.5, w: 1.8, h: 1.4, fill: { color: BRAND } })
  s3.addText(`${total} Projects`, { x: 0.7, y: 3.7, w: 1.8, h: 0.7, fontSize: 18, bold: true, color: WHITE, fontFace: 'Calibri', align: 'center' })
  s3.addText(`Total Active Portfolio  |  ${currentMonth.slice(0,3)} ${currentYear}`, { x: 0.3, y: 4.35, w: 2.6, h: 0.4, fontSize: 7, color: GRAY, fontFace: 'Calibri', align: 'center' })

  // ─── Content columns ───
  const colX = [0.4, 3.6, 6.8, 10.0]
  const colW = [3.0, 3.0, 3.0, 3.0]
  const secY = 5.2

  // New this month (projects started in current month)
  const newThisMonth = projects.filter(p => {
    if (!p.start_date) return false
    const sd = p.start_date
    const m = now.getMonth() + 1
    const y = now.getFullYear()
    return sd === `${y}-${String(m).padStart(2, '0')}`
  })
  s3.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: colX[0], y: secY, w: colW[0], h: 2.0, rectRadius: 0.15, fill: { color: WHITE }, shadow: { type: 'outer', blur: 4, opacity: 0.1, offset: 2 } })
  s3.addText('New This Month', { x: colX[0] + 0.15, y: secY + 0.1, w: colW[0] - 0.3, h: 0.35, fontSize: 10, bold: true, color: '1A202C', fontFace: 'Calibri' })
  const newText = newThisMonth.length > 0 ? newThisMonth.map(p => `• ${p.project_name}`).join('\n') : '• No new projects this month'
  s3.addText(newText, { x: colX[0] + 0.15, y: secY + 0.45, w: colW[0] - 0.3, h: 1.4, fontSize: 7.5, color: GRAY, fontFace: 'Calibri', valign: 'top', lineSpacingMultiple: 1.3 })

  // Highlights (completed + high progress)
  const highlights = projects.filter(p => p.status === 'Completed' || (parseInt(p.percent_complete) >= 80 && p.status !== 'On Hold'))
  s3.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: colX[1], y: 1.15, w: colW[1], h: 3.85, rectRadius: 0.15, fill: { color: WHITE }, shadow: { type: 'outer', blur: 4, opacity: 0.1, offset: 2 } })
  s3.addText(`${currentMonth} Highlights`, { x: colX[1] + 0.15, y: 1.25, w: colW[1] - 0.3, h: 0.35, fontSize: 10, bold: true, color: '1A202C', fontFace: 'Calibri' })
  const hlText = highlights.slice(0, 8).map(p => `• ${p.project_name} — ${p.percent_complete === '100' ? 'Completed' : p.percent_complete + '% complete'}`).join('\n')
  s3.addText(hlText || '• No highlights', { x: colX[1] + 0.15, y: 1.65, w: colW[1] - 0.3, h: 3.2, fontSize: 7.5, color: GRAY, fontFace: 'Calibri', valign: 'top', lineSpacingMultiple: 1.3 })

  // Risks & Issues
  const riskyProjects = projects.filter(p => p.status === 'Delayed' || p.status === 'At Risk' || p.status === 'On Hold')
  s3.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: colX[2], y: 1.15, w: colW[2], h: 3.85, rectRadius: 0.15, fill: { color: WHITE }, shadow: { type: 'outer', blur: 4, opacity: 0.1, offset: 2 } })
  s3.addText('Risks & Issues', { x: colX[2] + 0.15, y: 1.25, w: colW[2] - 0.3, h: 0.35, fontSize: 10, bold: true, color: '1A202C', fontFace: 'Calibri' })
  const riskText = riskyProjects.slice(0, 6).map(p => {
    const reason = p.key_risks ? ` — ${p.key_risks.substring(0, 80)}` : ''
    return `• ${p.project_name}${reason}`
  }).join('\n')
  s3.addText(riskText || '• No active risks', { x: colX[2] + 0.15, y: 1.65, w: colW[2] - 0.3, h: 3.2, fontSize: 7.5, color: GRAY, fontFace: 'Calibri', valign: 'top', lineSpacingMultiple: 1.3 })

  // Focus this month (active execution/UAT projects)
  const focusProjects = projects.filter(p => (p.phase === 'Execution' || p.phase === 'UAT') && p.status === 'On Track')
  s3.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: colX[1], y: secY, w: colW[1], h: 2.0, rectRadius: 0.15, fill: { color: WHITE }, shadow: { type: 'outer', blur: 4, opacity: 0.1, offset: 2 } })
  s3.addText(`${currentMonth} ${currentYear} Focus`, { x: colX[1] + 0.15, y: secY + 0.1, w: colW[1] - 0.3, h: 0.35, fontSize: 10, bold: true, color: '1A202C', fontFace: 'Calibri' })
  const focusText = focusProjects.slice(0, 6).map(p => `• ${p.project_name} — ${p.percent_complete || '0'}%`).join('\n')
  s3.addText(focusText || '• No items in focus', { x: colX[1] + 0.15, y: secY + 0.45, w: colW[1] - 0.3, h: 1.4, fontSize: 7.5, color: GRAY, fontFace: 'Calibri', valign: 'top', lineSpacingMultiple: 1.3 })

  // Decisions Required
  const decisionsNeeded = projects.filter(p => p.actions_needed && p.actions_needed.length > 10)
  s3.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: colX[2], y: secY, w: colW[2] + 0.3, h: 2.0, rectRadius: 0.15, fill: { color: WHITE }, shadow: { type: 'outer', blur: 4, opacity: 0.1, offset: 2 } })
  s3.addText('Decisions Required', { x: colX[2] + 0.15, y: secY + 0.1, w: colW[2], h: 0.35, fontSize: 10, bold: true, color: '1A202C', fontFace: 'Calibri' })
  const decText = decisionsNeeded.slice(0, 5).map(p => `• ${p.project_name} — ${p.actions_needed.substring(0, 80)}`).join('\n')
  s3.addText(decText || '• No pending decisions', { x: colX[2] + 0.15, y: secY + 0.45, w: colW[2], h: 1.4, fontSize: 7.5, color: GRAY, fontFace: 'Calibri', valign: 'top', lineSpacingMultiple: 1.3 })

  // Slide number
  s3.addText('3', { x: 12.5, y: 6.9, w: 0.5, h: 0.4, fontSize: 10, color: GRAY, fontFace: 'Calibri', align: 'right' })

  pptx.writeFile({ fileName: `EBS_MBR_${currentMonth}_${currentYear}.pptx` })
}

// ─── Drill-Down List Modal ──────────────────────────────────
function DrillDownModal({ open, onClose, title, projects, onProjectClick }) {
  if (!open) return null
  return <Modal open={open} onClose={onClose} title={title} wide>
    <div className="space-y-2">
      {projects.map(p => (
        <div key={p.id} onClick={() => { onClose(); onProjectClick(p.id) }}
          className="flex items-center justify-between p-4 rounded-xl border border-surface-100 hover:border-brand-200 hover:bg-brand-50/30 cursor-pointer transition-all group">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-surface-400">#{p.project_number}</span>
              <PriorityBadge priority={p.priority} />
              <StatusBadge status={p.status} />
            </div>
            <p className="text-sm font-semibold text-surface-800 truncate">{p.project_name}</p>
            <p className="text-xs text-surface-500 mt-0.5">{p.business_owner} · {p.dept_module}</p>
          </div>
          <div className="flex items-center gap-3 ml-4">
            <ProgressBar value={p.percent_complete || '0'} className="w-28" />
            <ChevronRight size={16} className="text-surface-300 group-hover:text-brand-500 transition-colors" />
          </div>
        </div>
      ))}
      {projects.length === 0 && <p className="text-sm text-surface-400 text-center py-8">No projects match this filter</p>}
    </div>
  </Modal>
}

// ─── Layout ─────────────────────────────────────────────────
function Layout() {
  const { user, signOut, isAdmin } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const nav = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/projects', label: 'Projects', icon: FolderKanban },
    { path: '/gantt', label: 'Gantt', icon: GanttIcon },
  ]
  const isActive = (path) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path))

  return <div className="flex h-screen overflow-hidden">
    {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

    {/* Desktop sidebar — hidden on mobile */}
    <aside className={`fixed lg:static z-40 h-full w-64 bg-surface-900 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
      <div className="px-5 py-5 border-b border-surface-700/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-white flex items-center justify-center"><img src="./ebs-logo.png" alt="EBS" className="w-full h-full object-contain" /></div>
          <div><h1 className="text-sm font-bold text-white font-display tracking-tight">EBS Projects</h1><p className="text-[11px] text-surface-400">Tracker & Roadmap</p></div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ path, label, icon: Icon }) => (
          <Link key={path} to={path} onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive(path) ? 'bg-brand-600/20 text-brand-300' : 'text-surface-400 hover:text-white hover:bg-surface-800'}`}>
            <Icon size={18} />{label}
          </Link>
        ))}
        {/* EBS Tracker separator + link */}
        <div className="pt-3 mt-1 border-t border-surface-700/50">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-surface-600">Tools</p>
          <a
            href="./ebs-tracker/index.html"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-surface-400 hover:text-white hover:bg-surface-800 transition-all"
            title={isAdmin ? 'Open EBS Tracker (you are already logged in)' : 'EBS Tracker — login required'}
          >
            <BarChart3 size={18} />
            <span>EBS Tracker</span>
            {isAdmin && <span className="ml-auto text-[9px] bg-emerald-700/40 text-emerald-400 px-1.5 py-0.5 rounded-full font-semibold">Admin</span>}
          </a>
        </div>
      </nav>
      <div className="px-3 py-4 border-t border-surface-700/50">
        {isAdmin ? (
          <div className="space-y-1">
            <Link to="/admin/users" onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive('/admin') ? 'bg-brand-600/20 text-brand-300' : 'text-surface-400 hover:text-white hover:bg-surface-800'}`}>
              <Users size={18} /> Manage Users
            </Link>
            <button onClick={signOut} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-surface-400 hover:text-white hover:bg-surface-800 w-full transition-all">
              <LogOut size={18} /> Sign Out
            </button>
            <div className="px-3 py-2 mt-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center"><Shield className="text-white" size={12} /></div>
                <span className="text-xs text-surface-400 truncate">{user.email}</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <Link to="/login" onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-surface-400 hover:text-white hover:bg-surface-800 transition-all">
              <LogIn size={18} /> Admin Login
            </Link>
            <div className="px-3 py-2 mt-2 flex items-center gap-2">
              <Eye size={14} className="text-surface-500" /><span className="text-xs text-surface-500">Viewing as Guest (Read-only)</span>
            </div>
          </>
        )}
      </div>
    </aside>

    {/* Main */}
    <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-20 bg-surface-900 px-4 py-3 flex items-center justify-between" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg overflow-hidden bg-white flex items-center justify-center"><img src="./ebs-logo.png" alt="EBS" className="w-full h-full object-contain" /></div>
          <h1 className="text-sm font-bold text-white font-display">EBS Projects</h1>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <>
              <Link to="/admin/users" className="p-2 text-surface-400"><Users size={18} /></Link>
              <button onClick={signOut} className="p-2 text-surface-400"><LogOut size={18} /></button>
            </>
          ) : (
            <Link to="/login" className="p-2 text-surface-400"><LogIn size={18} /></Link>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<ProjectTracker />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/gantt" element={<GanttChartPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
        </Routes>
      </div>
    </main>

    {/* Mobile bottom nav */}
    <div className="bottom-nav lg:hidden">
      {nav.map(({ path, label, icon: Icon }) => (
        <Link key={path} to={path} className={isActive(path) ? 'active' : ''}>
          <Icon size={20} /><span>{label}</span>
        </Link>
      ))}
      {isAdmin ? (
        <Link to="/admin/users" className={isActive('/admin') ? 'active' : ''}>
          <Shield size={20} /><span>Admin</span>
        </Link>
      ) : (
        <Link to="/login" className={isActive('/login') ? 'active' : ''}>
          <LogIn size={20} /><span>Login</span>
        </Link>
      )}
    </div>
  </div>
}

// ─── DASHBOARD (with drill-down) ────────────────────────────
function Dashboard() {
  const { projects, projectsLoading, projectsError, refreshProjects } = useProjects()
  const [drillDown, setDrillDown] = useState(null) // { title, projects }
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const navigate = useNavigate()

  if (projectsLoading) return <Spinner />
  if (projectsError) return <EmptyState icon={AlertCircle} title="Failed to load projects" description={projectsError} action={<button onClick={refreshProjects} className="text-brand-600 text-sm font-medium">Try again</button>} />

  const total = projects.length
  const byStatus = STATUSES.map(s => ({ name: s, value: projects.filter(p => p.status === s).length })).filter(d => d.value > 0)
  const byPriority = PRIORITIES.map(p => ({ name: p, value: projects.filter(pr => pr.priority === p).length })).filter(d => d.value > 0)
  const byPhase = PHASES.map(ph => ({ name: ph, value: projects.filter(p => p.phase === ph).length })).filter(d => d.value > 0)
  const onTrack = projects.filter(p => p.status === 'On Track').length
  const atRisk = projects.filter(p => p.status === 'At Risk' || p.status === 'Delayed').length
  const completed = projects.filter(p => p.status === 'Completed').length
  const onHold = projects.filter(p => p.status === 'On Hold').length
  const totalCost = projects.reduce((s, p) => s + (parseFloat(p.total_cost_kwd) || 0), 0)

  const byDept = {}
  projects.forEach(p => { const d = p.dept_module || 'Unassigned'; byDept[d] = (byDept[d] || 0) + 1 })
  const deptData = Object.entries(byDept).map(([name, value]) => ({ name: name.length > 25 ? name.substring(0, 25) + '…' : name, fullName: name, value })).sort((a, b) => b.value - a.value).slice(0, 10)

  // Drill-down handlers
  const drillStatus = (status) => {
    const filtered = projects.filter(p => p.status === status)
    setDrillDown({ title: `${status} Projects (${filtered.length})`, projects: filtered })
  }
  const drillPriority = (priority) => {
    const filtered = projects.filter(p => p.priority === priority)
    setDrillDown({ title: `${priority} Priority Projects (${filtered.length})`, projects: filtered })
  }
  const drillPhase = (phase) => {
    const filtered = projects.filter(p => p.phase === phase)
    setDrillDown({ title: `${phase} Phase Projects (${filtered.length})`, projects: filtered })
  }
  const drillDept = (dept) => {
    const filtered = projects.filter(p => (p.dept_module || 'Unassigned') === dept)
    setDrillDown({ title: `${dept} (${filtered.length})`, projects: filtered })
  }

  const summaryCards = [
    { label: 'Total Projects', value: total, icon: FolderKanban, color: 'bg-brand-600', onClick: () => setDrillDown({ title: `All Projects (${total})`, projects }) },
    { label: 'On Track', value: onTrack, icon: CheckCircle2, color: 'bg-emerald-500', onClick: () => drillStatus('On Track') },
    { label: 'At Risk / Delayed', value: atRisk, icon: AlertTriangle, color: 'bg-red-500', onClick: () => { const f = projects.filter(p => p.status === 'At Risk' || p.status === 'Delayed'); setDrillDown({ title: `At Risk & Delayed (${f.length})`, projects: f }) } },
    { label: 'Completed', value: completed, icon: Target, color: 'bg-blue-500', onClick: () => drillStatus('Completed') },
    { label: 'On Hold', value: onHold, icon: Pause, color: 'bg-slate-400', onClick: () => drillStatus('On Hold') },
    { label: 'Total Cost (KWD)', value: totalCost.toLocaleString(), icon: BarChart3, color: 'bg-violet-500', onClick: () => { const f = projects.filter(p => parseFloat(p.total_cost_kwd) > 0); setDrillDown({ title: `Projects with Budget (${f.length})`, projects: f }) } },
  ]

  // Clickable pie chart handler
  const onPieClick = (data, type) => {
    if (type === 'status') drillStatus(data.name)
    else if (type === 'priority') drillPriority(data.name)
  }

  return <div>
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-bold font-display text-surface-900">Portfolio Dashboard</h1>
        <p className="text-sm text-surface-500 mt-1">Click any card, chart segment, or bar to drill down into projects</p>
      </div>
      {/* Project-level dashboard selector */}
      <div className="flex items-center gap-2">
        <button onClick={() => generateReport(projects)}
          className="flex items-center gap-2 px-4 py-2 bg-surface-900 text-white rounded-xl text-sm font-medium hover:bg-surface-800 transition-colors shadow-sm whitespace-nowrap">
          <Presentation size={16} /> Generate MBR
        </button>
        <select value={selectedProjectId} onChange={e => { if (e.target.value) navigate(`/projects/${e.target.value}`) }}
          className={`${selectCls} w-auto min-w-[200px] sm:min-w-[240px] text-sm`}>
          <option value="">Jump to project...</option>
          {projects.map(p => <option key={p.id} value={p.id}>#{p.project_number} — {p.project_name}</option>)}
        </select>
      </div>
    </div>

    {/* Summary Cards — all clickable */}
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8 stagger">
      {summaryCards.map(({ label, value, icon: Icon, color, onClick }) => (
        <div key={label} onClick={onClick}
          className="bg-white rounded-2xl p-4 border border-surface-200 shadow-sm animate-fade-in hover:shadow-md hover:border-brand-200 transition-all cursor-pointer group">
          <div className="flex items-center gap-2 mb-3">
            <div className={`p-1.5 rounded-lg ${color} group-hover:scale-110 transition-transform`}><Icon size={14} className="text-white" /></div>
          </div>
          <p className="text-2xl font-bold font-display text-surface-900">{value}</p>
          <p className="text-xs text-surface-500 mt-0.5">{label}</p>
          <p className="text-[10px] text-brand-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click to view →</p>
        </div>
      ))}
    </div>

    {/* Charts — clickable segments */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div className="bg-white rounded-2xl p-6 border border-surface-200 shadow-sm">
        <h3 className="text-sm font-semibold text-surface-700 mb-1">Status Breakdown</h3>
        <p className="text-xs text-surface-400 mb-4">Click a segment to see projects</p>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={byStatus} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value"
              label={({ name, value }) => `${name} (${value})`} labelLine={false}
              onClick={(d) => onPieClick(d, 'status')} cursor="pointer">
              {byStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <RTooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-surface-200 shadow-sm">
        <h3 className="text-sm font-semibold text-surface-700 mb-1">Priority Breakdown</h3>
        <p className="text-xs text-surface-400 mb-4">Click a segment to see projects</p>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={byPriority} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value"
              label={({ name, value }) => `${name} (${value})`} labelLine={false}
              onClick={(d) => onPieClick(d, 'priority')} cursor="pointer">
              {byPriority.map((_, i) => <Cell key={i} fill={PRI_PIE_COLORS[i % PRI_PIE_COLORS.length]} />)}
            </Pie>
            <RTooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-surface-200 shadow-sm">
        <h3 className="text-sm font-semibold text-surface-700 mb-1">Projects by Department</h3>
        <p className="text-xs text-surface-400 mb-4">Click a bar to see projects</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={deptData} layout="vertical" margin={{ left: 10, right: 20 }}>
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 10 }} />
            <RTooltip />
            <Bar dataKey="value" fill="#4c6ef5" radius={[0, 6, 6, 0]} barSize={18}
              onClick={(d) => drillDept(d.fullName || d.name)} cursor="pointer" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-surface-200 shadow-sm">
        <h3 className="text-sm font-semibold text-surface-700 mb-1">Projects by Phase</h3>
        <p className="text-xs text-surface-400 mb-4">Click a bar to see projects</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={byPhase} margin={{ bottom: 20 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11, angle: -20, textAnchor: 'end' }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <RTooltip />
            <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} barSize={32}
              onClick={(d) => drillPhase(d.name)} cursor="pointer" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>

    {/* At Risk & Recently Updated */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-2xl p-6 border border-surface-200 shadow-sm">
        <h3 className="text-sm font-semibold text-surface-700 mb-4">At Risk & Delayed Projects</h3>
        {projects.filter(p => p.status === 'At Risk' || p.status === 'Delayed').length === 0 ? (
          <p className="text-sm text-surface-400 py-4">No at-risk or delayed projects</p>
        ) : (
          <div className="space-y-3">
            {projects.filter(p => p.status === 'At Risk' || p.status === 'Delayed').map(p => (
              <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
                className="flex items-center justify-between p-3 rounded-xl bg-surface-50 hover:bg-red-50/50 cursor-pointer transition-colors group">
                <div><p className="text-sm font-medium text-surface-800">{p.project_name}</p><p className="text-xs text-surface-500">{p.business_owner}</p></div>
                <div className="flex items-center gap-2"><StatusBadge status={p.status} /><ChevronRight size={14} className="text-surface-300 group-hover:text-red-400" /></div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="bg-white rounded-2xl p-6 border border-surface-200 shadow-sm">
        <h3 className="text-sm font-semibold text-surface-700 mb-4">Recently Updated</h3>
        <div className="space-y-3">
          {[...projects].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 5).map(p => (
            <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
              className="flex items-center justify-between p-3 rounded-xl bg-surface-50 hover:bg-brand-50/50 cursor-pointer transition-colors group">
              <div><p className="text-sm font-medium text-surface-800">{p.project_name}</p><p className="text-xs text-surface-500">{new Date(p.updated_at).toLocaleDateString()}</p></div>
              <div className="flex items-center gap-2"><ProgressBar value={p.percent_complete || '0'} className="w-28" /><ChevronRight size={14} className="text-surface-300 group-hover:text-brand-400" /></div>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Drill-down modal */}
    <DrillDownModal open={!!drillDown} onClose={() => setDrillDown(null)}
      title={drillDown?.title || ''} projects={drillDown?.projects || []}
      onProjectClick={(id) => navigate(`/projects/${id}`)} />
  </div>
}

// ─── PROJECT TRACKER ────────────────────────────────────────
function ProjectTracker() {
  const { isAdmin } = useAuth()
  const { projects, projectsLoading, projectsError, refreshProjects } = useProjects()
  const navigate = useNavigate()
  const [editProject, setEditProject] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const fileInputRef = useRef(null)

  const filtered = useMemo(() => projects.filter(p => {
    if (searchTerm && !p.project_name.toLowerCase().includes(searchTerm.toLowerCase()) && !(p.business_owner || '').toLowerCase().includes(searchTerm.toLowerCase())) return false
    if (filterStatus && p.status !== filterStatus) return false
    if (filterPriority && p.priority !== filterPriority) return false
    return true
  }), [projects, searchTerm, filterStatus, filterPriority])

  const handleSave = async (data) => {
    if (editProject) { await supabase.from('projects').update(data).eq('id', editProject.id) }
    else { const maxNum = projects.reduce((m, p) => Math.max(m, p.project_number || 0), 0); await supabase.from('projects').insert({ ...data, project_number: maxNum + 1 }) }
    setShowForm(false); setEditProject(null); refreshProjects()
  }
  const handleDelete = async () => {
    if (deleteTarget) { await supabase.from('projects').delete().eq('id', deleteTarget.id); setDeleteTarget(null); refreshProjects() }
  }
  const handleBulkUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setUploadMsg('')
    try {
      const parsed = await parseBulkUpload(file)
      if (parsed.length === 0) { setUploadMsg('No valid projects found in the file.'); setUploading(false); return }
      const maxNum = projects.reduce((m, p) => Math.max(m, p.project_number || 0), 0)
      const toInsert = parsed.map((p, i) => ({ ...p, project_number: maxNum + 1 + i }))
      const { error } = await supabase.from('projects').insert(toInsert)
      if (error) throw error
      setUploadMsg(`Successfully imported ${toInsert.length} projects!`)
      refreshProjects()
    } catch (err) {
      setUploadMsg(`Error: ${err.message}`)
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (projectsLoading) return <Spinner />
  if (projectsError) return <EmptyState icon={AlertCircle} title="Failed to load projects" description={projectsError} action={<button onClick={refreshProjects} className="text-brand-600 text-sm font-medium">Try again</button>} />

  return <div>
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-surface-900">Project Tracker</h1>
        <p className="text-sm text-surface-500 mt-1">{projects.length} projects · {filtered.length} shown · Click any row to view details</p>
      </div>
      {isAdmin && (
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={downloadTemplate}
            className="flex items-center gap-1.5 px-3 py-2 border border-surface-200 text-surface-600 rounded-xl text-xs font-medium hover:bg-surface-50 transition-colors">
            <Download size={14} /> Template
          </button>
          <input type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv" onChange={handleBulkUpload} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-2 border border-surface-200 text-surface-600 rounded-xl text-xs font-medium hover:bg-surface-50 transition-colors disabled:opacity-50">
            <Upload size={14} /> {uploading ? 'Importing...' : 'Bulk Upload'}
          </button>
          <button onClick={() => { setEditProject(null); setShowForm(true) }}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors shadow-sm">
            <Plus size={16} /> New Project
          </button>
        </div>
      )}
    </div>

    {uploadMsg && (
      <div className={`mb-4 px-4 py-3 rounded-xl text-sm ${uploadMsg.startsWith('Error') ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
        {uploadMsg}
        <button onClick={() => setUploadMsg('')} className="ml-2 font-medium underline">dismiss</button>
      </div>
    )}

    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
        <input type="text" placeholder="Search projects or owners..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`${inputCls} pl-9`} />
      </div>
      <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={`${selectCls} w-auto min-w-[140px]`}>
        <option value="">All Statuses</option>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className={`${selectCls} w-auto min-w-[140px]`}>
        <option value="">All Priorities</option>{PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
    </div>

    <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
      {/* Desktop table */}
      <div className="overflow-x-auto hidden md:block">
        <table className="w-full">
          <thead><tr className="bg-surface-50 border-b border-surface-200">
            {['#', 'Project Name', 'Dept / Module', 'Owner', 'Priority', 'Status', 'Phase', 'Progress', 'Impact', ''].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-surface-100">
            {filtered.map(p => (
              <tr key={p.id} className="project-row group" onClick={() => navigate(`/projects/${p.id}`)}>
                <td className="px-4 py-3 text-sm font-mono text-surface-400">{p.project_number}</td>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-surface-800 max-w-xs truncate group-hover:text-brand-600 transition-colors">{p.project_name}</p>
                </td>
                <td className="px-4 py-3 text-sm text-surface-600 max-w-[180px] truncate">{p.dept_module}</td>
                <td className="px-4 py-3 text-sm text-surface-600 whitespace-nowrap">{p.business_owner}</td>
                <td className="px-4 py-3"><PriorityBadge priority={p.priority} /></td>
                <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                <td className="px-4 py-3 text-sm text-surface-600">{p.phase}</td>
                <td className="px-4 py-3 w-36"><ProgressBar value={p.percent_complete || '0'} /></td>
                <td className="px-4 py-3 text-sm text-surface-600">{p.business_impact}</td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    {isAdmin && <>
                      <button onClick={() => { setEditProject(p); setShowForm(true) }} className="p-1.5 rounded-lg hover:bg-brand-50 text-surface-400 hover:text-brand-600 transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => setDeleteTarget(p)} className="p-1.5 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                    </>}
                    <ChevronRight size={14} className="text-surface-300 group-hover:text-brand-500 transition-colors ml-1" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card view */}
      <div className="md:hidden divide-y divide-surface-100">
        {filtered.map(p => (
          <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
            className="p-4 active:bg-surface-50 transition-colors cursor-pointer">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-[10px] font-mono text-surface-400">#{p.project_number}</span>
                  <PriorityBadge priority={p.priority} />
                  <StatusBadge status={p.status} />
                </div>
                <p className="text-sm font-semibold text-surface-800 mb-1 leading-tight">{p.project_name}</p>
                <p className="text-xs text-surface-500">{p.business_owner} · {p.phase}</p>
              </div>
              <div className="flex items-center gap-1 pt-1" onClick={e => e.stopPropagation()}>
                {isAdmin && <>
                  <button onClick={() => { setEditProject(p); setShowForm(true) }} className="p-2 rounded-lg hover:bg-brand-50 text-surface-400"><Pencil size={14} /></button>
                  <button onClick={() => setDeleteTarget(p)} className="p-2 rounded-lg hover:bg-red-50 text-surface-400"><Trash2 size={14} /></button>
                </>}
                <ChevronRight size={16} className="text-surface-300 ml-1" />
              </div>
            </div>
            <ProgressBar value={p.percent_complete || '0'} className="mt-2.5" />
          </div>
        ))}
      </div>
      {filtered.length === 0 && <EmptyState icon={FolderKanban} title="No projects found" description="Try adjusting your search or filter criteria." />}
    </div>

    <ProjectFormModal open={showForm} project={editProject} onClose={() => { setShowForm(false); setEditProject(null) }} onSave={handleSave} />
    <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
      title="Delete Project" message={`Are you sure you want to delete "${deleteTarget?.project_name}"? This will also delete all milestones and risks.`} />
  </div>
}

// ─── PROJECT FORM MODAL ─────────────────────────────────────
function ProjectFormModal({ open, project, onClose, onSave }) {
  const [form, setForm] = useState({})
  useEffect(() => {
    if (project) setForm({ ...project })
    else setForm({ priority: 'Medium', status: 'On Track', phase: 'Initiation', business_impact: 'Medium', percent_complete: '0' })
  }, [project, open])
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const handleSubmit = () => { const { id, created_at, updated_at, project_number, ...data } = form; onSave(data) }

  return <Modal open={open} onClose={onClose} title={project ? 'Edit Project' : 'New Project'} wide>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormField label="Project Name *" className="md:col-span-2"><input className={inputCls} value={form.project_name || ''} onChange={e => set('project_name', e.target.value)} /></FormField>
      <FormField label="Objective / Goal" className="md:col-span-2"><textarea className={textareaCls} rows={2} value={form.objective || ''} onChange={e => set('objective', e.target.value)} /></FormField>
      <FormField label="Dept / Module"><input className={inputCls} value={form.dept_module || ''} onChange={e => set('dept_module', e.target.value)} /></FormField>
      <FormField label="Business Owner"><input className={inputCls} value={form.business_owner || ''} onChange={e => set('business_owner', e.target.value)} /></FormField>
      <FormField label="Priority"><select className={selectCls} value={form.priority || ''} onChange={e => set('priority', e.target.value)}>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></FormField>
      <FormField label="Status"><select className={selectCls} value={form.status || ''} onChange={e => set('status', e.target.value)}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></FormField>
      <FormField label="Phase"><select className={selectCls} value={form.phase || ''} onChange={e => set('phase', e.target.value)}>{PHASES.map(p => <option key={p}>{p}</option>)}</select></FormField>
      <FormField label="% Complete"><input className={inputCls} value={form.percent_complete || ''} onChange={e => set('percent_complete', e.target.value)} placeholder="0-100 or Ongoing" /></FormField>
      <FormField label="Est. Start (YYYY-MM)"><input className={inputCls} value={form.est_start || ''} onChange={e => set('est_start', e.target.value)} placeholder="2026-01" /></FormField>
      <FormField label="Start Date (YYYY-MM)"><input className={inputCls} value={form.start_date || ''} onChange={e => set('start_date', e.target.value)} placeholder="2026-01" /></FormField>
      <FormField label="End Date (YYYY-MM)"><input className={inputCls} value={form.end_date || ''} onChange={e => set('end_date', e.target.value)} placeholder="2026-12" /></FormField>
      <FormField label="Total Cost (KWD)"><input className={inputCls} type="number" value={form.total_cost_kwd || ''} onChange={e => set('total_cost_kwd', e.target.value)} /></FormField>
      <FormField label="Business Impact"><select className={selectCls} value={form.business_impact || ''} onChange={e => set('business_impact', e.target.value)}><option value="">—</option>{IMPACTS.map(i => <option key={i}>{i}</option>)}</select></FormField>
      <FormField label="Cost Remarks"><input className={inputCls} value={form.cost_remarks || ''} onChange={e => set('cost_remarks', e.target.value)} /></FormField>
      <FormField label="Dependencies" className="md:col-span-2"><textarea className={textareaCls} rows={2} value={form.dependencies || ''} onChange={e => set('dependencies', e.target.value)} /></FormField>
      <FormField label="Key Risks" className="md:col-span-2"><textarea className={textareaCls} rows={2} value={form.key_risks || ''} onChange={e => set('key_risks', e.target.value)} /></FormField>
      <FormField label="Mitigation" className="md:col-span-2"><textarea className={textareaCls} rows={2} value={form.mitigation || ''} onChange={e => set('mitigation', e.target.value)} /></FormField>
      <FormField label="Notes / Updates" className="md:col-span-2"><textarea className={textareaCls} rows={2} value={form.notes_updates || ''} onChange={e => set('notes_updates', e.target.value)} /></FormField>
      <FormField label="Actions Needed / Next Steps" className="md:col-span-2"><textarea className={textareaCls} rows={2} value={form.actions_needed || ''} onChange={e => set('actions_needed', e.target.value)} /></FormField>
    </div>
    <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-surface-200">
      <button onClick={onClose} className="px-4 py-2 rounded-lg border border-surface-200 text-surface-600 hover:bg-surface-50 font-medium text-sm">Cancel</button>
      <button onClick={handleSubmit} disabled={!form.project_name}
        className="flex items-center gap-2 px-5 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 font-medium text-sm disabled:opacity-40 transition-colors">
        <Save size={14} /> {project ? 'Update' : 'Create'}
      </button>
    </div>
  </Modal>
}

// ─── PROJECT DETAIL (with project-level dashboard) ──────────
function ProjectDetail() {
  const { id } = useParams()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [milestones, setMilestones] = useState([])
  const [risks, setRisks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [editMilestone, setEditMilestone] = useState(null)
  const [showRiskForm, setShowRiskForm] = useState(false)
  const [editRisk, setEditRisk] = useState(null)
  const [deleteMilestone, setDeleteMilestone] = useState(null)
  const [deleteRisk, setDeleteRisk] = useState(null)
  const [tab, setTab] = useState('dashboard')
  const [showEditProject, setShowEditProject] = useState(false)
  const [dashDrill, setDashDrill] = useState(null) // { title, items, type:'milestones'|'risks' }
  const [fetchError, setFetchError] = useState(null)

  const fetchAll = useCallback(async () => {
    setFetchError(null)
    try {
      const [{ data: p, error: pe }, { data: m, error: me }, { data: r, error: re }] = await Promise.all([
        supabase.from('projects').select('*').eq('id', id).single(),
        supabase.from('milestones').select('*').eq('project_id', id).order('milestone_number'),
        supabase.from('risks').select('*').eq('project_id', id).order('risk_number'),
      ])
      if (pe) throw pe
      if (me) console.error('Milestones fetch error:', me)
      if (re) console.error('Risks fetch error:', re)
      setProject(p); setMilestones(m || []); setRisks(r || [])
    } catch (e) {
      console.error('ProjectDetail fetch error:', e)
      setFetchError(e.message || 'Failed to load project data')
    } finally {
      setLoading(false)
    }
  }, [id])
  useEffect(() => { fetchAll() }, [fetchAll])

  const saveMilestone = async (data) => {
    if (editMilestone) { await supabase.from('milestones').update(data).eq('id', editMilestone.id) }
    else { const maxNum = milestones.reduce((m, ms) => Math.max(m, ms.milestone_number || 0), 0); await supabase.from('milestones').insert({ ...data, project_id: parseInt(id), milestone_number: maxNum + 1 }) }
    setShowMilestoneForm(false); setEditMilestone(null); fetchAll()
  }
  const saveRisk = async (data) => {
    if (editRisk) { await supabase.from('risks').update(data).eq('id', editRisk.id) }
    else { const maxNum = risks.reduce((m, r) => Math.max(m, r.risk_number || 0), 0); await supabase.from('risks').insert({ ...data, project_id: parseInt(id), risk_number: maxNum + 1 }) }
    setShowRiskForm(false); setEditRisk(null); fetchAll()
  }
  const handleDeleteMilestone = async () => { if (deleteMilestone) { await supabase.from('milestones').delete().eq('id', deleteMilestone.id); setDeleteMilestone(null); fetchAll() } }
  const handleDeleteRisk = async () => { if (deleteRisk) { await supabase.from('risks').delete().eq('id', deleteRisk.id); setDeleteRisk(null); fetchAll() } }
  const saveProject = async (data) => {
    await supabase.from('projects').update(data).eq('id', project.id)
    setShowEditProject(false); fetchAll()
  }

  if (loading) return <Spinner />
  if (fetchError) return <EmptyState icon={AlertCircle} title="Failed to load project" description={fetchError} action={<button onClick={fetchAll} className="text-brand-600 text-sm font-medium">Try again</button>} />
  if (!project) return <EmptyState icon={FolderKanban} title="Project not found" description="This project may have been deleted." action={<Link to="/projects" className="text-brand-600 text-sm font-medium">← Back to tracker</Link>} />

  // Analytics
  const completedMs = milestones.filter(m => m.development_status === 'Completed').length
  const msProgress = milestones.length > 0 ? Math.round((completedMs / milestones.length) * 100) : 0
  const devStatusData = DEV_STATUSES.map(s => ({ name: s, value: milestones.filter(m => m.development_status === s).length })).filter(d => d.value > 0)
  const uatStatusData = UAT_STATUSES.map(s => ({ name: s, value: milestones.filter(m => m.uat_status === s).length })).filter(d => d.value > 0)
  const riskByImpact = IMPACTS.map(i => ({ name: i, value: risks.filter(r => r.impact === i).length })).filter(d => d.value > 0)
  const riskByLikelihood = IMPACTS.map(i => ({ name: i, value: risks.filter(r => r.likelihood === i).length })).filter(d => d.value > 0)
  const devColors = DEV_STATUSES.map(s => DEV_STATUS_COLORS[s]?.hex || '#94a3b8')
  const uatColors = UAT_STATUSES.map(s => UAT_STATUS_COLORS[s]?.hex || '#94a3b8')

  return <div>
    {/* Back navigation */}
    <button onClick={() => navigate('/projects')} className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-brand-600 mb-4 transition-colors">
      <ArrowLeft size={16} /> Back to Project Tracker
    </button>

    {/* Project Header Card — like the Ecom Integration sheet */}
    <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="text-xs font-mono text-surface-400 bg-surface-100 px-2 py-0.5 rounded">#{project.project_number}</span>
            <PriorityBadge priority={project.priority} />
            <StatusBadge status={project.status} />
            <span className="text-xs bg-surface-100 text-surface-600 px-2 py-0.5 rounded font-medium">{project.phase}</span>
          </div>
          <h1 className="text-xl font-bold font-display text-surface-900 mb-2">{project.project_name}</h1>
          {project.objective && <p className="text-sm text-surface-600 leading-relaxed max-w-3xl">{project.objective}</p>}
        </div>
        <div className="flex flex-col items-end gap-2 min-w-[220px]">
          <ProgressBar value={project.percent_complete || '0'} className="w-full" height="h-3" />
          {isAdmin && (
            <button onClick={() => setShowEditProject(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 transition-colors mt-1">
              <Pencil size={12} /> Edit All Details
            </button>
          )}
        </div>
      </div>

      {/* Meta grid — matching the Ecom Integration detail sheet layout */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-surface-100">
        {[
          { l: 'Department / Module', v: project.dept_module },
          { l: 'Business Owner', v: project.business_owner },
          { l: 'Start Date', v: project.start_date },
          { l: 'End Date', v: project.end_date },
          { l: 'Est. Start', v: project.est_start || '—' },
          { l: 'Business Impact', v: project.business_impact },
          { l: 'Total Cost (KWD)', v: project.total_cost_kwd ? parseFloat(project.total_cost_kwd).toLocaleString() : '—' },
          { l: 'Cost Remarks', v: project.cost_remarks || '—' },
        ].map(({ l, v }) => (
          <div key={l}><p className="text-xs text-surface-400 mb-0.5">{l}</p><p className="text-sm font-medium text-surface-700">{v || '—'}</p></div>
        ))}
      </div>

      {/* Expandable text sections */}
      {[
        { l: 'Dependencies', v: project.dependencies },
        { l: 'Key Risks', v: project.key_risks },
        { l: 'Mitigation', v: project.mitigation },
        { l: 'Notes / Updates', v: project.notes_updates },
        { l: 'Actions Needed / Next Steps', v: project.actions_needed },
      ].filter(s => s.v).map(({ l, v }) => (
        <div key={l} className="mt-4 pt-4 border-t border-surface-100">
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">{l}</p>
          <p className="text-sm text-surface-700 leading-relaxed whitespace-pre-line">{v}</p>
        </div>
      ))}
    </div>

    {/* Tabs — Dashboard / Milestones / Risks */}
    <div className="flex gap-1 mb-6 bg-surface-100 rounded-xl p-1 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:w-fit">
      {[
        { key: 'dashboard', label: 'Project Dashboard', icon: BarChart3 },
        { key: 'milestones', label: 'Key Milestones', icon: ListChecks, count: milestones.length },
        { key: 'risks', label: 'Risks & Issues', icon: FileWarning, count: risks.length },
      ].map(({ key, label, icon: Icon, count }) => (
        <button key={key} onClick={() => setTab(key)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab === key ? 'bg-white text-surface-800 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}>
          <Icon size={15} /> {label} {count !== undefined && <span className="text-xs bg-surface-200 px-1.5 py-0.5 rounded-full">{count}</span>}
        </button>
      ))}
    </div>

    {/* ─── Project Dashboard Tab ─── */}
    {tab === 'dashboard' && (
      <div>
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-surface-200">
            <p className="text-xs text-surface-400 mb-1">Total Milestones</p>
            <p className="text-2xl font-bold font-display text-surface-900">{milestones.length}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-surface-200">
            <p className="text-xs text-surface-400 mb-1">Dev Completed</p>
            <p className="text-2xl font-bold font-display text-emerald-600">{completedMs}</p>
            <ProgressBar value={String(msProgress)} className="mt-2" />
          </div>
          <div className="bg-white rounded-xl p-4 border border-surface-200">
            <p className="text-xs text-surface-400 mb-1">UAT Passed</p>
            <p className="text-2xl font-bold font-display text-blue-600">{milestones.filter(m => m.uat_status === 'Passed').length}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-surface-200">
            <p className="text-xs text-surface-400 mb-1">Open Risks</p>
            <p className="text-2xl font-bold font-display text-red-600">{risks.length}</p>
            {risks.filter(r => r.impact === 'High').length > 0 && <p className="text-xs text-red-500 mt-1">{risks.filter(r => r.impact === 'High').length} high impact</p>}
          </div>
        </div>

        {milestones.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Dev Status Pie */}
            <div className="bg-white rounded-2xl p-6 border border-surface-200">
              <h3 className="text-sm font-semibold text-surface-700 mb-1">Development Status</h3>
              <p className="text-xs text-surface-400 mb-3">Click a segment to see milestones</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={devStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value"
                    label={({ name, value }) => `${name} (${value})`} labelLine={false}
                    onClick={(d) => { const filtered = milestones.filter(m => m.development_status === d.name); setDashDrill({ title: `Dev: ${d.name} (${filtered.length})`, items: filtered, type: 'milestones' }) }}
                    cursor="pointer">
                    {devStatusData.map((d, i) => <Cell key={i} fill={DEV_STATUS_COLORS[d.name]?.hex || '#94a3b8'} />)}
                  </Pie>
                  <RTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* UAT Status Pie */}
            <div className="bg-white rounded-2xl p-6 border border-surface-200">
              <h3 className="text-sm font-semibold text-surface-700 mb-1">UAT Status</h3>
              <p className="text-xs text-surface-400 mb-3">Click a segment to see milestones</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={uatStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value"
                    label={({ name, value }) => `${name} (${value})`} labelLine={false}
                    onClick={(d) => { const filtered = milestones.filter(m => m.uat_status === d.name); setDashDrill({ title: `UAT: ${d.name} (${filtered.length})`, items: filtered, type: 'milestones' }) }}
                    cursor="pointer">
                    {uatStatusData.map((d, i) => <Cell key={i} fill={UAT_STATUS_COLORS[d.name]?.hex || '#94a3b8'} />)}
                  </Pie>
                  <RTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-surface-200 p-8 text-center mb-6">
            <Info className="text-surface-300 mx-auto mb-3" size={32} />
            <p className="text-sm text-surface-500">Add milestones to see project-level analytics here</p>
            {isAdmin && <button onClick={() => { setTab('milestones'); setTimeout(() => setShowMilestoneForm(true), 100) }}
              className="text-brand-600 text-sm font-medium mt-2 hover:underline">+ Add first milestone</button>}
          </div>
        )}

        {/* Risk summary */}
        {risks.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-surface-200">
              <h3 className="text-sm font-semibold text-surface-700 mb-1">Risks by Impact</h3>
              <p className="text-xs text-surface-400 mb-3">Click a bar to see risks</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={riskByImpact}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <RTooltip />
                  <Bar dataKey="value" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={32}
                    onClick={(d) => { const filtered = risks.filter(r => r.impact === d.name); setDashDrill({ title: `${d.name} Impact Risks (${filtered.length})`, items: filtered, type: 'risks' }) }}
                    cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-surface-200">
              <h3 className="text-sm font-semibold text-surface-700 mb-1">Risks by Likelihood</h3>
              <p className="text-xs text-surface-400 mb-3">Click a bar to see risks</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={riskByLikelihood}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <RTooltip />
                  <Bar dataKey="value" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={32}
                    onClick={(d) => { const filtered = risks.filter(r => r.likelihood === d.name); setDashDrill({ title: `${d.name} Likelihood Risks (${filtered.length})`, items: filtered, type: 'risks' }) }}
                    cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Milestone details list on dashboard */}
        {milestones.length > 0 && (
          <div className="bg-white rounded-2xl border border-surface-200 p-6 mt-6">
            <h3 className="text-sm font-semibold text-surface-700 mb-4">Milestone Progress Overview</h3>
            <div className="space-y-3">
              {milestones.map(m => (
                <div key={m.id} className="flex items-center gap-4 p-3 rounded-xl bg-surface-50">
                  <span className="text-xs font-mono text-surface-400 w-6">#{m.milestone_number}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-800 truncate">{m.deliverable}</p>
                    {m.owner && <p className="text-xs text-surface-400">Owner: {m.owner}</p>}
                  </div>
                  <DevStatusBadge status={m.development_status} />
                  <UatStatusBadge status={m.uat_status} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )}

    {/* ─── Milestones Tab ─── */}
    {tab === 'milestones' && (
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
        {isAdmin && (
          <div className="px-4 py-3 border-b border-surface-100 flex justify-end">
            <button onClick={() => { setEditMilestone(null); setShowMilestoneForm(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 transition-colors">
              <Plus size={13} /> Add Milestone
            </button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-surface-50 border-b border-surface-200">
              {['#', 'Key Deliverable', 'Target Date', 'Actual Date', 'Dev Status', 'UAT Status', 'Dependencies', 'Owner', 'Remarks', isAdmin && 'Actions'].filter(Boolean).map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-surface-100">
              {milestones.map(m => (
                <tr key={m.id} className="hover:bg-surface-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono text-surface-400">{m.milestone_number}</td>
                  <td className="px-4 py-3"><p className="text-sm font-medium text-surface-800">{m.deliverable}</p></td>
                  <td className="px-4 py-3 text-sm text-surface-600 whitespace-nowrap">{m.target_date || '—'}</td>
                  <td className="px-4 py-3 text-sm text-surface-600 whitespace-nowrap">{m.actual_date || '—'}</td>
                  <td className="px-4 py-3"><DevStatusBadge status={m.development_status} /></td>
                  <td className="px-4 py-3"><UatStatusBadge status={m.uat_status} /></td>
                  <td className="px-4 py-3 text-xs text-surface-500 max-w-[200px]"><p className="truncate">{m.dependencies || '—'}</p></td>
                  <td className="px-4 py-3 text-sm text-surface-600 whitespace-nowrap">{m.owner || '—'}</td>
                  <td className="px-4 py-3 text-xs text-surface-500 max-w-[200px]"><p className="truncate">{m.remarks || '—'}</p></td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditMilestone(m); setShowMilestoneForm(true) }} className="p-1.5 rounded-lg hover:bg-brand-50 text-surface-400 hover:text-brand-600 transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => setDeleteMilestone(m)} className="p-1.5 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {milestones.length === 0 && (
          <EmptyState icon={ListChecks} title="No milestones yet"
            description={isAdmin ? "Add milestones to track key deliverables for this project." : "No milestones have been added yet."}
            action={isAdmin && <button onClick={() => setShowMilestoneForm(true)} className="text-brand-600 text-sm font-medium">+ Add first milestone</button>} />
        )}
      </div>
    )}

    {/* ─── Risks Tab ─── */}
    {tab === 'risks' && (
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
        {isAdmin && (
          <div className="px-4 py-3 border-b border-surface-100 flex justify-end">
            <button onClick={() => { setEditRisk(null); setShowRiskForm(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 transition-colors">
              <Plus size={13} /> Add Risk
            </button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-surface-50 border-b border-surface-200">
              {['#', 'Risk / Issue Description', 'Impact', 'Likelihood', 'Mitigation Action', 'Owner', isAdmin && 'Actions'].filter(Boolean).map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-surface-100">
              {risks.map(r => (
                <tr key={r.id} className="hover:bg-surface-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono text-surface-400">{r.risk_number}</td>
                  <td className="px-4 py-3 text-sm text-surface-800 max-w-xs">{r.description}</td>
                  <td className="px-4 py-3">{r.impact && <Badge colors={PRIORITY_COLORS[r.impact] || PRIORITY_COLORS['Medium']}>{r.impact}</Badge>}</td>
                  <td className="px-4 py-3">{r.likelihood && <Badge colors={PRIORITY_COLORS[r.likelihood] || PRIORITY_COLORS['Medium']}>{r.likelihood}</Badge>}</td>
                  <td className="px-4 py-3 text-sm text-surface-600 max-w-xs">{r.mitigation_action || '—'}</td>
                  <td className="px-4 py-3 text-sm text-surface-600">{r.owner || '—'}</td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditRisk(r); setShowRiskForm(true) }} className="p-1.5 rounded-lg hover:bg-brand-50 text-surface-400 hover:text-brand-600 transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => setDeleteRisk(r)} className="p-1.5 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {risks.length === 0 && (
          <EmptyState icon={FileWarning} title="No risks logged"
            description={isAdmin ? "Log risks and issues for this project." : "No risks have been logged yet."}
            action={isAdmin && <button onClick={() => setShowRiskForm(true)} className="text-brand-600 text-sm font-medium">+ Add first risk</button>} />
        )}
      </div>
    )}

    {/* Modals */}
    <ProjectFormModal open={showEditProject} project={project} onClose={() => setShowEditProject(false)} onSave={saveProject} />
    <MilestoneFormModal open={showMilestoneForm} milestone={editMilestone} onClose={() => { setShowMilestoneForm(false); setEditMilestone(null) }} onSave={saveMilestone} />
    <RiskFormModal open={showRiskForm} risk={editRisk} onClose={() => { setShowRiskForm(false); setEditRisk(null) }} onSave={saveRisk} />
    <ConfirmDialog open={!!deleteMilestone} onClose={() => setDeleteMilestone(null)} onConfirm={handleDeleteMilestone} title="Delete Milestone" message={`Delete "${deleteMilestone?.deliverable}"?`} />
    <ConfirmDialog open={!!deleteRisk} onClose={() => setDeleteRisk(null)} onConfirm={handleDeleteRisk} title="Delete Risk" message="Delete this risk/issue entry?" />

    {/* Project Dashboard Drill-Down Modal */}
    <Modal open={!!dashDrill} onClose={() => setDashDrill(null)} title={dashDrill?.title || ''} wide>
      {dashDrill?.type === 'milestones' && (
        <div className="space-y-2">
          {(dashDrill?.items || []).map(m => (
            <div key={m.id} className="flex items-center justify-between p-4 rounded-xl border border-surface-100 bg-surface-50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-surface-400">#{m.milestone_number}</span>
                  <p className="text-sm font-semibold text-surface-800">{m.deliverable}</p>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  {m.owner && <span className="text-xs text-surface-500">Owner: {m.owner}</span>}
                  {m.target_date && <span className="text-xs text-surface-500">Target: {m.target_date}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <DevStatusBadge status={m.development_status} />
                <UatStatusBadge status={m.uat_status} />
              </div>
            </div>
          ))}
          {(dashDrill?.items || []).length === 0 && <p className="text-sm text-surface-400 text-center py-6">No milestones match this filter</p>}
        </div>
      )}
      {dashDrill?.type === 'risks' && (
        <div className="space-y-2">
          {(dashDrill?.items || []).map(r => (
            <div key={r.id} className="p-4 rounded-xl border border-surface-100 bg-surface-50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono text-surface-400">#{r.risk_number}</span>
                {r.impact && <Badge colors={PRIORITY_COLORS[r.impact] || PRIORITY_COLORS['Medium']}>Impact: {r.impact}</Badge>}
                {r.likelihood && <Badge colors={PRIORITY_COLORS[r.likelihood] || PRIORITY_COLORS['Medium']}>Likelihood: {r.likelihood}</Badge>}
              </div>
              <p className="text-sm text-surface-800 mb-1">{r.description}</p>
              {r.mitigation_action && <p className="text-xs text-surface-500">Mitigation: {r.mitigation_action}</p>}
              {r.owner && <p className="text-xs text-surface-400 mt-1">Owner: {r.owner}</p>}
            </div>
          ))}
          {(dashDrill?.items || []).length === 0 && <p className="text-sm text-surface-400 text-center py-6">No risks match this filter</p>}
        </div>
      )}
    </Modal>
  </div>
}

// ─── Milestone Form Modal ───────────────────────────────────
function MilestoneFormModal({ open, milestone, onClose, onSave }) {
  const [form, setForm] = useState({})
  useEffect(() => {
    if (milestone) setForm({ ...milestone })
    else setForm({ development_status: 'Not Started', uat_status: 'Not Started' })
  }, [milestone, open])
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const submit = () => { const { id, created_at, updated_at, project_id, milestone_number, ...data } = form; onSave(data) }

  return <Modal open={open} onClose={onClose} title={milestone ? 'Edit Milestone' : 'New Milestone'}>
    <div className="space-y-4">
      <FormField label="Key Deliverable *"><input className={inputCls} value={form.deliverable || ''} onChange={e => set('deliverable', e.target.value)} /></FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Target Date"><input className={inputCls} type="date" value={form.target_date || ''} onChange={e => set('target_date', e.target.value)} /></FormField>
        <FormField label="Actual Date"><input className={inputCls} type="date" value={form.actual_date || ''} onChange={e => set('actual_date', e.target.value)} /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Development Status"><select className={selectCls} value={form.development_status || ''} onChange={e => set('development_status', e.target.value)}>{DEV_STATUSES.map(s => <option key={s}>{s}</option>)}</select></FormField>
        <FormField label="UAT Status"><select className={selectCls} value={form.uat_status || ''} onChange={e => set('uat_status', e.target.value)}>{UAT_STATUSES.map(s => <option key={s}>{s}</option>)}</select></FormField>
      </div>
      <FormField label="Owner"><input className={inputCls} value={form.owner || ''} onChange={e => set('owner', e.target.value)} /></FormField>
      <FormField label="Dependencies"><textarea className={textareaCls} rows={2} value={form.dependencies || ''} onChange={e => set('dependencies', e.target.value)} /></FormField>
      <FormField label="Remarks"><textarea className={textareaCls} rows={2} value={form.remarks || ''} onChange={e => set('remarks', e.target.value)} /></FormField>
    </div>
    <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-surface-200">
      <button onClick={onClose} className="px-4 py-2 rounded-lg border border-surface-200 text-surface-600 hover:bg-surface-50 font-medium text-sm">Cancel</button>
      <button onClick={submit} disabled={!form.deliverable} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 font-medium text-sm disabled:opacity-40 transition-colors"><Save size={14} /> {milestone ? 'Update' : 'Create'}</button>
    </div>
  </Modal>
}

// ─── Risk Form Modal ────────────────────────────────────────
function RiskFormModal({ open, risk, onClose, onSave }) {
  const [form, setForm] = useState({})
  useEffect(() => {
    if (risk) setForm({ ...risk })
    else setForm({ impact: 'Medium', likelihood: 'Medium' })
  }, [risk, open])
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const submit = () => { const { id, created_at, updated_at, project_id, risk_number, ...data } = form; onSave(data) }

  return <Modal open={open} onClose={onClose} title={risk ? 'Edit Risk' : 'New Risk'}>
    <div className="space-y-4">
      <FormField label="Risk / Issue Description *"><textarea className={textareaCls} rows={3} value={form.description || ''} onChange={e => set('description', e.target.value)} /></FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Impact"><select className={selectCls} value={form.impact || ''} onChange={e => set('impact', e.target.value)}>{IMPACTS.map(i => <option key={i}>{i}</option>)}</select></FormField>
        <FormField label="Likelihood"><select className={selectCls} value={form.likelihood || ''} onChange={e => set('likelihood', e.target.value)}>{IMPACTS.map(i => <option key={i}>{i}</option>)}</select></FormField>
      </div>
      <FormField label="Mitigation Action"><textarea className={textareaCls} rows={2} value={form.mitigation_action || ''} onChange={e => set('mitigation_action', e.target.value)} /></FormField>
      <FormField label="Owner"><input className={inputCls} value={form.owner || ''} onChange={e => set('owner', e.target.value)} /></FormField>
    </div>
    <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-surface-200">
      <button onClick={onClose} className="px-4 py-2 rounded-lg border border-surface-200 text-surface-600 hover:bg-surface-50 font-medium text-sm">Cancel</button>
      <button onClick={submit} disabled={!form.description} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 font-medium text-sm disabled:opacity-40 transition-colors"><Save size={14} /> {risk ? 'Update' : 'Create'}</button>
    </div>
  </Modal>
}

// ─── GANTT CHART ────────────────────────────────────────────
function GanttChartPage() {
  const { projects, projectsLoading } = useProjects()
  const navigate = useNavigate()

  if (projectsLoading) return <Spinner />

  const parseDate = (d) => { if (!d) return null; if (d.length === 7) return new Date(d + '-01'); return new Date(d) }
  const allDates = projects.flatMap(p => [parseDate(p.start_date), parseDate(p.end_date)]).filter(Boolean)
  if (allDates.length === 0) return <EmptyState icon={GanttIcon} title="No date data" description="Projects need start/end dates for the Gantt chart." />

  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())))
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())))
  minDate.setDate(1); maxDate.setMonth(maxDate.getMonth() + 1, 0)

  const months = []
  const curr = new Date(minDate)
  while (curr <= maxDate) { months.push(new Date(curr)); curr.setMonth(curr.getMonth() + 1) }

  const totalMs = maxDate.getTime() - minDate.getTime()
  const getPos = (date) => ((date.getTime() - minDate.getTime()) / totalMs) * 100
  const now = new Date()
  const todayPos = now >= minDate && now <= maxDate ? getPos(now) : null
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const years = {}
  months.forEach(m => { const y = m.getFullYear(); if (!years[y]) years[y] = []; years[y].push(m) })

  return <div>
    <div className="mb-6">
      <h1 className="text-2xl font-bold font-display text-surface-900">Gantt Chart</h1>
      <p className="text-sm text-surface-500 mt-1">Project timeline — auto-updates from project data · Click any row to view details</p>
    </div>
    <div className="flex flex-wrap gap-4 mb-4">
      {Object.entries(STATUS_COLORS).map(([name, c]) => (
        <div key={name} className="flex items-center gap-1.5 text-xs text-surface-600"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: c.hex }} /> {name}</div>
      ))}
      {todayPos !== null && <div className="flex items-center gap-1.5 text-xs text-surface-600"><div className="w-3 h-0.5 bg-red-500" /> Today</div>}
    </div>
    <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto"><div className="min-w-[1100px]">
        <div className="flex border-b border-surface-200">
          <div className="w-[320px] min-w-[320px] bg-surface-50 border-r border-surface-200 flex">
            <div className="w-10 px-2 py-2 text-[10px] font-semibold text-surface-400 flex items-end">#</div>
            <div className="flex-1 px-3 py-2 text-[10px] font-semibold text-surface-400 uppercase flex items-end">Project</div>
            <div className="w-20 px-2 py-2 text-[10px] font-semibold text-surface-400 uppercase flex items-end">Status</div>
            <div className="w-12 px-2 py-2 text-[10px] font-semibold text-surface-400 uppercase flex items-end text-right">Done</div>
          </div>
          <div className="flex-1 relative">
            <div className="flex border-b border-surface-100">
              {Object.entries(years).map(([year, ms]) => (
                <div key={year} className="text-center text-[10px] font-bold text-surface-600 py-1 border-r border-surface-100 bg-surface-50" style={{ width: `${(ms.length / months.length) * 100}%` }}>{year}</div>
              ))}
            </div>
            <div className="flex">
              {months.map((m, i) => (<div key={i} className="text-center text-[9px] text-surface-400 py-1.5 border-r border-surface-100" style={{ width: `${100 / months.length}%` }}>{MONTH_NAMES[m.getMonth()]}</div>))}
            </div>
          </div>
        </div>
        {projects.map(p => {
          const start = parseDate(p.start_date); const end = parseDate(p.end_date)
          if (!start || !end) return null
          const left = getPos(start); const right = getPos(end); const width = Math.max(right - left, 1)
          const pct = p.percent_complete === 'Ongoing' ? 50 : parseInt(p.percent_complete) || 0
          const color = STATUS_COLORS[p.status]?.hex || '#94a3b8'
          return <div key={p.id} className="flex border-b border-surface-50 hover:bg-surface-50/50 cursor-pointer transition-colors group" style={{ height: 36 }} onClick={() => navigate(`/projects/${p.id}`)}>
            <div className="w-[320px] min-w-[320px] border-r border-surface-100 flex items-center">
              <div className="w-10 px-2 text-[10px] font-mono text-surface-400">{p.project_number}</div>
              <div className="flex-1 px-2 text-xs font-medium text-surface-700 truncate group-hover:text-brand-600 transition-colors">{p.project_name}</div>
              <div className="w-20 px-1 flex items-center justify-center"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} /></div>
              <div className="w-12 px-2 text-[10px] text-surface-500 text-right font-mono">{p.percent_complete === 'Ongoing' ? '∞' : `${pct}%`}</div>
            </div>
            <div className="flex-1 relative">
              {months.map((_, i) => (<div key={i} className="absolute top-0 bottom-0 border-r border-surface-50" style={{ left: `${(i / months.length) * 100}%` }} />))}
              {todayPos !== null && <div className="absolute top-0 bottom-0 w-px bg-red-400 z-10" style={{ left: `${todayPos}%` }} />}
              <div className="absolute top-1/2 -translate-y-1/2 gantt-bar rounded-md overflow-hidden" style={{ left: `${left}%`, width: `${width}%`, height: 20 }}>
                <div className="absolute inset-0 rounded-md opacity-25" style={{ backgroundColor: color }} />
                <div className="absolute inset-y-0 left-0 rounded-md opacity-80" style={{ backgroundColor: color, width: `${pct}%` }} />
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold z-10"
                  style={{ color: pct > 40 ? '#fff' : '#1a202c', textShadow: pct > 40 ? '0 0 3px rgba(0,0,0,0.4)' : 'none' }}>
                  {p.percent_complete === 'Ongoing' ? '∞' : `${pct}%`}
                </span>
              </div>
            </div>
          </div>
        })}
      </div></div>
    </div>
  </div>
}

// ─── LOGIN PAGE ─────────────────────────────────────────────
function LoginPage() {
  const { signIn, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false)

  useEffect(() => { if (isAdmin) navigate('/') }, [isAdmin, navigate])

  const handleLogin = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    try { await signIn(email, password); navigate('/') }
    catch (err) { setError(err.message || 'Invalid credentials') }
    setLoading(false)
  }

  return <div className="flex items-center justify-center min-h-[70vh]">
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center mx-auto mb-4"><Shield className="text-white" size={24} /></div>
        <h1 className="text-2xl font-bold font-display text-surface-900">Admin Login</h1>
        <p className="text-sm text-surface-500 mt-1">Sign in to manage projects</p>
      </div>
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6">
        <form onSubmit={handleLogin} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
          <FormField label="Email"><input className={inputCls} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@company.com" required /></FormField>
          <FormField label="Password"><input className={inputCls} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required /></FormField>
          <button type="submit" disabled={loading} className="w-full py-2.5 bg-brand-600 text-white rounded-xl font-medium text-sm hover:bg-brand-700 transition-colors disabled:opacity-50">{loading ? 'Signing in...' : 'Sign In'}</button>
        </form>
      </div>
    </div>
  </div>
}

// ─── ADMIN USERS PAGE ───────────────────────────────────────
function AdminUsersPage() {
  const { isAdmin, user } = useAuth()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newFullName, setNewFullName] = useState('')
  const [newRole, setNewRole] = useState('user')
  const [message, setMessage] = useState(''); const [error, setError] = useState('')
  const [resetTarget, setResetTarget] = useState('')

  useEffect(() => { if (!isAdmin) navigate('/login') }, [isAdmin, navigate])

  const handleCreateUser = async () => {
    setError(''); setMessage('')
    if (!newFullName.trim()) { setError('Full name is required'); return }
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
        options: { data: { full_name: newFullName, role: newRole } }
      })
      if (err) throw err
      // Upsert profile with role (trigger may have already created it)
      if (data?.user?.id) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: newFullName,
          email: newEmail,
          role: newRole,
          username: newEmail.split('@')[0]
        })
      }
      setMessage(`User ${newEmail} created as ${newRole}!`)
      setNewEmail(''); setNewPassword(''); setNewFullName(''); setNewRole('user')
      setShowCreate(false)
    } catch (err) { setError(err.message) }
  }

  const handleResetPassword = async () => {
    setError(''); setMessage('')
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(resetTarget)
      if (err) throw err
      setMessage(`Password reset email sent to ${resetTarget}`); setResetTarget('')
    } catch (err) { setError(err.message) }
  }

  if (!isAdmin) return null

  return <div className="max-w-2xl mx-auto">
    <div className="mb-8"><h1 className="text-2xl font-bold font-display text-surface-900">User Management</h1><p className="text-sm text-surface-500 mt-1">Create users for both the Project Website and EBS Tracker</p></div>
    {message && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-3 mb-4">{message}</div>}
    {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}

    <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 mb-6">
      <h3 className="text-sm font-semibold text-surface-700 mb-3">Current Session</h3>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center"><Shield className="text-brand-600" size={18} /></div>
        <div><p className="text-sm font-medium text-surface-800">{user?.email}</p><p className="text-xs text-surface-500">Logged in as admin</p></div>
      </div>
    </div>

    <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-surface-700">Create New User</h3>
          <p className="text-xs text-surface-500 mt-0.5">Admin users can edit projects and access EBS Tracker Admin Panel. Regular users can only view projects and log tasks in EBS Tracker.</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 transition-colors"><Plus size={13} /> New User</button>
      </div>
      {showCreate && (
        <div className="space-y-4 pt-4 border-t border-surface-100">
          <FormField label="Full Name *"><input className={inputCls} type="text" value={newFullName} onChange={e => setNewFullName(e.target.value)} placeholder="Jane Smith" /></FormField>
          <FormField label="Email"><input className={inputCls} type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@company.com" /></FormField>
          <FormField label="Password"><input className={inputCls} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 characters" /></FormField>
          <FormField label="Role">
            <select className={inputCls} value={newRole} onChange={e => setNewRole(e.target.value)}>
              <option value="user">User — view projects + log EBS tasks</option>
              <option value="admin">Admin — full access to everything</option>
            </select>
          </FormField>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg border border-surface-200 text-surface-600 hover:bg-surface-50 font-medium text-sm">Cancel</button>
            <button onClick={handleCreateUser} disabled={!newEmail || !newPassword || newPassword.length < 6 || !newFullName} className="px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 font-medium text-sm disabled:opacity-40 transition-colors">Create User</button>
          </div>
        </div>
      )}
    </div>

    <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 mb-6">
      <h3 className="text-sm font-semibold text-surface-700 mb-4">Reset User Password</h3>
      <p className="text-sm text-surface-500 mb-4">Enter the email address of the user. They will receive a reset link.</p>
      <div className="flex gap-3">
        <input className={`${inputCls} flex-1`} type="email" value={resetTarget} onChange={e => setResetTarget(e.target.value)} placeholder="user@company.com" />
        <button onClick={handleResetPassword} disabled={!resetTarget} className="px-4 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 font-medium text-sm disabled:opacity-40 transition-colors whitespace-nowrap">Send Reset Link</button>
      </div>
    </div>
  </div>
}

// ─── MAIN APP ───────────────────────────────────────────────
// ─── Auth gate — shows full-page spinner until session is known ──
export default function App() {
  // No more loading gate — render immediately. Login page handles unauthed users,
  // other pages handle their own loading states. No single point of failure.
  return (
    <AuthProvider>
      <ProjectsProvider>
        <Layout />
      </ProjectsProvider>
    </AuthProvider>
  )
}
