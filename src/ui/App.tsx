import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Navigate, NavLink, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import { Activity, AlertTriangle, ArrowDownRight, ArrowRight, Bell, Boxes, Check, ChevronDown, ChevronRight, CircleHelp, Clock3, Download, FileBarChart2, LayoutDashboard, LogOut, Menu, PackageCheck, Plus, Search, Settings2, Shield, ShoppingCart, Sparkles, Stethoscope, X, Pill, ChevronLeft } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from "recharts";
import { ALERT_STREAM_URL, api, downloadExport, type Alert, type AuthUser, type CatalogMedicine, type CategorySummary, type ManagedUser, type Medicine, type RestockRequest, type Stats, type Trends } from "./api";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/inventory", label: "Inventory & Dispensing", icon: Boxes },
  { to: "/catalog", label: "Medicine Catalogue", icon: Pill },
  { to: "/restock", label: "Restock Dispatcher", icon: ShoppingCart },
  { to: "/reports", label: "Analytics & Reports", icon: FileBarChart2 },
  { to: "/admin", label: "Admin Management", icon: Settings2 },
];
const titleFor: Record<string, string> = { "/dashboard": "Dashboard", "/inventory": "Inventory & Dispensing", "/catalog": "Medicine Catalogue", "/restock": "Restock Dispatcher", "/reports": "Analytics & Reports", "/admin": "Admin Management" };
const money = (n: number) => new Intl.NumberFormat("en-US").format(n);
const shortDate = (date: string) => new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  useEffect(() => {
    api.me().then((response) => setUser(response.data.user)).catch(() => setUser(null)).finally(() => setCheckingSession(false));
  }, []);
  if (checkingSession) return <div className="auth-loading"><span className="spinner" /> Checking your sessionâ€¦</div>;
  if (!user) return <LoginPage onAuthenticated={setUser} />;
  return <DashboardApp user={user} onLogout={async () => { await api.logout().catch(() => undefined); setUser(null); }} />;
}

function DashboardApp({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const initialRole = ({ MANAGER: "Manager", PROCUREMENT: "Procurement", ADMIN: "Admin" } as Record<string, string>)[user.role] ?? "Pharmacy Staff";
  const [role, setRole] = useState(initialRole);
  const canSwitchPersona = user.role === "ADMIN";
  const chooseRole = (nextRole: string) => { if (canSwitchPersona) setRole(nextRole); };
  const [roleOpen, setRoleOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadAlertCount, setUnreadAlertCount] = useState(0);
  const [toastAlert, setToastAlert] = useState<Alert | null>(null);
  const alertsInitialized = useRef(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const location = useLocation();
  useEffect(() => {
    Promise.all([api.stats(), api.alerts()]).then(([s, a]) => {
      setStats(s.data);
      setAlerts((current) => [...current.filter((item) => item.id.startsWith("ALT-LIVE-")), ...a.data]);
      if (!alertsInitialized.current) {
        setUnreadAlertCount(a.data.length);
        alertsInitialized.current = true;
      }
    }).catch((e) => setError(e.message));
  }, [location.pathname]);
  useEffect(() => {
    const stream = new EventSource(ALERT_STREAM_URL);
    const handleAlert = (event: Event) => {
      try {
        const alert = JSON.parse((event as MessageEvent<string>).data) as Alert;
        setAlerts((current) => [alert, ...current.filter((item) => item.id !== alert.id)]);
        setUnreadAlertCount((count) => count + 1);
        setToastAlert(alert);
      } catch (eventError) {
        console.error("Could not read live alert event", eventError);
      }
    };
    stream.addEventListener("alert", handleAlert);
    return () => {
      stream.removeEventListener("alert", handleAlert);
      stream.close();
    };
  }, []);
  const refresh = async () => { try { const [s, a] = await Promise.all([api.stats(), api.alerts()]); setStats(s.data); setAlerts((current) => [...current.filter((item) => item.id.startsWith("ALT-LIVE-")), ...a.data]); setError(""); } catch (e) { setError((e as Error).message); } };
  const acknowledgeToast = () => { setToastAlert(null); setUnreadAlertCount((count) => Math.max(0, count - 1)); };
  const title = titleFor[location.pathname] ?? "Admin Management";
  return <div className="app-shell">
    {toastAlert && <div className="toast-stack"><section className="live-toast" role="status" aria-live="polite"><span className="toast-icon"><AlertTriangle size={18} /></span><div className="toast-copy"><div className="toast-title"><b>Critical stock alert</b><span>JUST NOW</span></div><strong>{toastAlert.medicine_name}</strong><p>{toastAlert.message}</p></div><button className="toast-close" aria-label="Dismiss alert" onClick={acknowledgeToast}><X size={16} /></button><button className="toast-ack" onClick={acknowledgeToast}><Check size={14} /> Acknowledge</button></section></div>}
    {mobileOpen && <button className="mobile-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark"><Stethoscope size={20} strokeWidth={2.4} /></div><span>smart<span className="brand-med">med</span><i>âœ³</i></span></div>
      <div className="workspace-label">WORKSPACE</div>
      <div className="workspace"><div className="hospital-icon"><Shield size={17} /></div><div><b>Riverside General</b><small>Central Pharmacy</small></div><ChevronDown size={15} /></div>
      <div className="nav-caption">MENU</div>
      <nav>{navItems.filter(({ to }) => to !== "/admin" || user.role === "ADMIN").map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`} onClick={() => setMobileOpen(false)}><Icon size={18} /><span>{label}</span>{label === "Restock Dispatcher" && <span className="nav-count">{stats?.pending_restock_count ?? "â€”"}</span>}</NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={18} /></div><b>Need a hand?</b><p>Visit the help center for tips and guides.</p><button>Open help center <ArrowRight size={14} /></button></div><button className="profile" onClick={onLogout} title="Sign out"><div className="avatar">{user.display_name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div><div><b>{user.display_name}</b><small>{role}</small></div><LogOut size={15} /></button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="top-left"><button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><div className="crumb">Workspace <ChevronRight size={14} /> <strong>{title}</strong></div></div><div className="top-actions"><span className="live-indicator"><i /> System live</span><div className="popover-wrap"><button className="icon-button bell-button" onClick={() => { setAlertsOpen(!alertsOpen); setRoleOpen(false); }} aria-label="Notifications"><Bell size={18} />{unreadAlertCount > 0 && <span className="notification-dot">{unreadAlertCount}</span>}</button>{alertsOpen && <div className="popover notification-pop"><div className="popover-head"><b>Notifications</b><span>{alerts.length} active</span></div>{alerts.length ? alerts.slice(0, 4).map((a) => <div className="notice-item" key={a.id}><span className={`notice-dot ${a.urgency_level.toLowerCase()}`} /><div><b>{a.medicine_name}</b><p>{a.message}</p></div></div>) : <div className="empty-small">Youâ€™re all caught up.</div>}<NavLink to="/dashboard" className="popover-link" onClick={() => setAlertsOpen(false)}>View all alerts <ArrowRight size={14} /></NavLink></div>}</div>{canSwitchPersona ? <div className="role-wrap"><button className="role-switch" onClick={() => { setRoleOpen(!roleOpen); setAlertsOpen(false); }}><span className="role-avatar"><Shield size={14} /></span><span className="role-text"><small>Admin preview</small><b>{role}</b></span><ChevronDown size={15} /></button>{roleOpen && <div className="popover role-pop"><small>DEMO PERSPECTIVE</small>{["Pharmacy Staff", "Manager", "Procurement", "Admin"].map((item) => <button key={item} className={item === role ? "selected" : ""} onClick={() => { chooseRole(item); setRoleOpen(false); }}>{item}{item === role && <Check size={15} />}</button>)}</div>}</div> : <div className="role-lock"><span className="role-avatar"><Shield size={14} /></span><span className="role-text"><small>Signed in as</small><b>{role}</b></span></div>}</div></header>
      <div className="page-content">{error && <div className="error-banner"><AlertTriangle size={16} /><div><b>Couldnâ€™t reach the SmartMed API.</b> Make sure the backend is running on port 3001. <span>{error}</span></div><button onClick={refresh}>Retry</button></div>}
        <Routes><Route path="/" element={<Dashboard stats={stats} alerts={alerts} onRefresh={refresh} name={user.display_name} />} /><Route path="/dashboard" element={<Dashboard stats={stats} alerts={alerts} onRefresh={refresh} name={user.display_name} />} /><Route path="/inventory" element={<Inventory onRefresh={refresh} />} /><Route path="/catalog" element={<Catalog />} /><Route path="/restock" element={<Restock />} /><Route path="/reports" element={<Reports />} />{user.role === "ADMIN" ? <Route path="/admin" element={<Admin />} /> : <Route path="/admin" element={<Navigate to="/dashboard" replace />} />}</Routes>
        <footer className="footer"><span>Â© 2025 SmartMed Systems</span><span>Last synced just now <i className="sync-dot" /></span></footer>
      </div>
    </main>
  </div>;
}

function LoginPage({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [persona, setPersona] = useState("Pharmacy Staff");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [searchParams] = useSearchParams();
  useEffect(() => {
    api.authProviders().then((result) => setGoogleEnabled(result.data.google_enabled)).catch(() => setGoogleEnabled(false));
    const oauthError = searchParams.get("oauth_error");
    if (oauthError) setError(oauthError);
  }, [searchParams]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try { const result = await api.login({ email, password, persona }); onAuthenticated(result.data.user); }
    catch (requestError) { setError((requestError as Error).message); }
    finally { setBusy(false); }
  };
  const googleUrl = `${import.meta.env.VITE_API_URL ?? "http://localhost:3001/api"}/auth/google`;
  return <main className="auth-shell"><div className="auth-card"><div className="auth-brand"><span className="brand-mark"><Stethoscope size={20} /></span><span>smart<span className="brand-med">med</span><i>✳</i></span></div><div className="auth-eyebrow">RIVERSIDE GENERAL · CENTRAL PHARMACY</div><h1>Welcome back</h1><p className="auth-subtitle">Sign in to continue to your pharmacy workspace.</p>
    <form className="auth-form" onSubmit={submit}><label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@hospital.org" required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /></label><label>Login persona<select value={persona} onChange={(event) => setPersona(event.target.value)}><option>Pharmacy Staff</option><option>Manager</option><option>Procurement</option><option>Admin</option></select><small className="persona-help">Choose the role assigned to your account. Your credentials and persona must match.</small></label>{error && <div className="auth-error"><AlertTriangle size={15} />{error}</div>}<button className="button button-primary auth-submit" disabled={busy}>{busy ? <><span className="spinner light" /> Please wait…</> : "Sign in"}</button></form>
    <div className="auth-divider"><span>or continue with</span></div><a className={`button button-google ${googleEnabled ? "" : "google-disabled"}`} href={googleEnabled ? googleUrl : undefined} onClick={(event) => { if (!googleEnabled) { event.preventDefault(); setError("Google sign-in is not configured yet. Ask your administrator to set the Google OAuth credentials."); } }}><GoogleMark /> Continue with Google</a><div className="auth-switch">Need access? Ask an administrator to create your account.</div><div className="auth-security"><Shield size={14} /> Secure sign-in with an 8-hour session.</div></div><div className="auth-foot">SMARTMED PHARMACY OPERATIONS <span>·</span> SECURE STAFF ACCESS</div></main>;
}
function PageHeading({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{actions && <div className="heading-actions">{actions}</div>}</div>;
}

function StatCard({ title, value, note, icon: Icon, tone, badge }: { title: string; value: string | number; note: string; icon: typeof Activity; tone: string; badge?: ReactNode }) {
  return <div className="stat-card"><div className="stat-top"><span>{title}</span><span className={`stat-icon ${tone}`}><Icon size={18} /></span></div><div className="stat-value">{value}</div><div className="stat-note">{badge && <span className={`stat-badge ${tone}`}>{badge}</span>}<span>{note}</span></div></div>;
}

function StatusBadge({ status }: { status: string }) {
  const text = status.toLowerCase(); return <span className={`badge badge-${text}`}><i />{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}

function Dashboard({ stats, alerts, onRefresh, name }: { stats: Stats | null; alerts: Alert[]; onRefresh: () => void; name: string }) {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.inventory("status=LOW").then((r) => setMedicines(r.data)).catch(() => {}).finally(() => setLoading(false)); }, []);
  return <>
    <PageHeading eyebrow="TUESDAY, OCTOBER 20, 2026" title={`Good morning, ${name.split(/\s+/)[0]}`} description="Hereâ€™s whatâ€™s happening across your pharmacy today." actions={<><button className="button button-quiet" onClick={onRefresh}><Activity size={16} /> Refresh data</button><NavLink to="/inventory" className="button button-primary"><Plus size={16} /> Record dispense</NavLink></>} />
    <section className="stat-grid"><StatCard title="Total medicines" value={stats?.total_medicines ?? "â€”"} note={`${stats?.stocked_medicine_count ?? 0} with demo stock Â· ${money(stats?.total_units_in_stock ?? 0)} units on hand`} icon={Boxes} tone="green" badge="Catalogue" /><StatCard title="Critical stock breaches" value={stats?.critical_stock_count ?? "â€”"} note="Requires immediate attention" icon={AlertTriangle} tone="rose" badge="Critical" /><StatCard title="Pending restocks" value={stats?.pending_restock_count ?? "â€”"} note="Awaiting your approval" icon={PackageCheck} tone="amber" badge="In queue" /><StatCard title="Today's dispenses" value={stats?.today_dispenses ?? "â€”"} note="Across all departments today" icon={Activity} tone="blue" badge={<ArrowDownRight size={13} />} /></section>
    <div className="dash-grid"><section className="panel alerts-panel"><div className="panel-head"><div><h2>Live critical alerts</h2><p>Stock levels that need your attention</p></div><span className="count-pill">{alerts.length} active</span></div>{alerts.length === 0 ? <EmptyState title="All clear" text="No stock alerts at the moment." icon={Check} /> : <div className="alert-list">{alerts.slice(0, 5).map((a) => <div className="alert-row" key={a.id}><div className={`alert-symbol ${a.urgency_level.toLowerCase()}`}><AlertTriangle size={17} /></div><div className="alert-copy"><div><b>{a.medicine_name}</b><StatusBadge status={a.urgency_level} /></div><p>{a.message}</p></div><span className="alert-time">Now</span></div>)}</div>}<NavLink to="/inventory" className="panel-footer-link">View inventory <ArrowRight size={15} /></NavLink></section>
      <section className="panel attention-panel"><div className="panel-head"><div><h2>Needs attention</h2><p>Medicines below their minimum threshold</p></div><NavLink to="/inventory" className="text-link">View all <ArrowRight size={14} /></NavLink></div>{loading ? <div className="skeleton-stack"><i /><i /><i /></div> : medicines.length === 0 ? <EmptyState title="Stock looks healthy" text="Nothing is below the minimum level." icon={Check} /> : <div className="attention-list">{medicines.slice(0, 4).map((m) => <div className="attention-row" key={m.id}><div className="med-avatar">{m.name.slice(0, 1)}</div><div className="attention-name"><b>{m.name}</b><small>{m.category}</small></div><div className="stock-meter"><b className={m.status === "CRITICAL" ? "text-rose" : "text-amber"}>{m.current_stock} <small>{m.unit}</small></b><div><span style={{ width: `${Math.min(100, m.current_stock / m.min_threshold * 100)}%` }} className={m.status === "CRITICAL" ? "meter-rose" : "meter-amber"} /></div><small>Min. {m.min_threshold}</small></div></div>)}</div>}<NavLink to="/restock" className="panel-footer-link">Go to restock dispatcher <ArrowRight size={15} /></NavLink></section></div>
    <CatalogOverview />
    <section className="bottom-banner"><div className="banner-icon"><Sparkles size={19} /></div><div><b>Pharmacy operations are running smoothly</b><p>Inventory is monitored in real time. Youâ€™ll be notified when action is needed.</p></div><span className="banner-live"><i /> Live monitoring active</span></section>
  </>;
}

function CatalogOverview() {
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [total, setTotal] = useState(0);
  useEffect(() => { api.categories().then((response) => { setCategories(response.data); setTotal(response.meta.total_medicines); }).catch(() => undefined); }, []);
  return <section className="panel catalog-overview"><div className="panel-head"><div><h2>Complete medicine catalogue</h2><p>{total ? `${total.toLocaleString("en-IN")} medicines stored in MongoDB, organized into ${categories.length} categories` : "Loading the full medicine datasetâ€¦"}</p></div><NavLink to="/catalog" className="text-link">View all medicines <ArrowRight size={14} /></NavLink></div><div className="dashboard-category-grid">{categories.map((entry, index) => <NavLink to={`/catalog?category=${encodeURIComponent(entry.category)}`} key={entry.category} className="dashboard-category"><span className={`category-icon cat-tone-${index % 5}`}><Pill size={14} /></span><span><b>{entry.category}</b><small>{entry.count} medicines</small></span><ChevronRight size={14} /></NavLink>)}</div></section>;
}

function Catalog() {
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [items, setItems] = useState<CatalogMedicine[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedCategory = searchParams.get("category") ?? "";
  const [category, setCategory] = useState(requestedCategory);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [catalogSize, setCatalogSize] = useState(0);
  const [categoryCount, setCategoryCount] = useState(0);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingItems, setLoadingItems] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { setCategory(requestedCategory); setPage(1); }, [requestedCategory]);
  useEffect(() => {
    api.categories().then((response) => { setCategories(response.data); setCatalogSize(response.meta.total_medicines); setCategoryCount(response.meta.total_categories); }).catch((requestError) => setError((requestError as Error).message)).finally(() => setLoadingCategories(false));
  }, []);
  useEffect(() => {
    setLoadingItems(true);
    api.catalog({ category, search, page, limit: 25 }).then((response) => {
      setItems(response.data); setTotal(response.meta.total); setTotalPages(Math.max(1, response.meta.total_pages)); setError("");
    }).catch((requestError) => setError((requestError as Error).message)).finally(() => setLoadingItems(false));
  }, [category, search, page]);
  const chooseCategory = (value: string) => { setCategory(value); setPage(1); setSearchParams(value ? { category: value } : {}); };
  return <><PageHeading eyebrow="MEDICINE REFERENCE CATALOGUE" title="Medicine catalogue" description="Explore the supplied dataset, grouped by therapeutic category." actions={<span className="catalog-total"><Pill size={15} /> {catalogSize.toLocaleString("en-IN")} records Â· {categoryCount} categories</span>} />
    <div className="catalog-category-grid">{loadingCategories ? Array.from({ length: 5 }, (_, index) => <div className="category-skeleton" key={index} />) : <><button className={`category-card category-all ${!category ? "chosen" : ""}`} onClick={() => chooseCategory("")}><span className="category-icon"><Boxes size={16} /></span><span><b>All medicines</b><small>Complete dataset</small></span><strong>{categories.reduce((count, entry) => count + entry.count, 0)}</strong></button>{categories.map((entry, index) => <button className={`category-card ${category === entry.category ? "chosen" : ""}`} key={entry.category} onClick={() => chooseCategory(category === entry.category ? "" : entry.category)}><span className={`category-icon cat-tone-${index % 5}`}><Pill size={16} /></span><span><b>{entry.category}</b><small>Avg. â‚¹{money(entry.average_price_inr)}</small></span><strong>{entry.count}</strong></button>)}</>}</div>
    <section className="panel catalog-panel"><div className="catalog-toolbar"><div><h2>{category || "All medicines"}</h2><p>{total.toLocaleString("en-IN")} dataset entries{category ? ` in ${category}` : " across all categories"}</p></div><div className="search-field catalog-search"><Search size={17} /><input placeholder="Search name, category, or compositionâ€¦" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /><button className="catalog-clear" aria-label="Clear search" onClick={() => setSearch("")}><X size={14} /></button></div></div>
      <div className="table-wrap"><table className="catalog-table"><thead><tr><th>MEDICINE</th><th>CATEGORY</th><th>COMPOSITION</th><th>LIST PRICE</th><th>RATE</th><th>DATA SOURCE</th></tr></thead><tbody>{loadingItems ? <tr><td colSpan={6}><div className="table-loading"><span className="spinner" /> Loading catalogueâ€¦</div></td></tr> : items.length === 0 ? <tr><td colSpan={6}><EmptyState title="No matching medicines" text="Try another name, composition, or category." icon={Search} /></td></tr> : items.map((item) => <tr key={item.id}><td><div className="catalog-name"><span className="med-avatar"><Pill size={14} /></span><span><b>{item.medicine_name}</b><small>{item.id}</small></span></div></td><td><span className="category-tag">{item.category}</span></td><td className="composition-cell">{item.composition}</td><td className="price-cell">â‚¹{item.price_inr.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td className="price-cell">â‚¹{item.rate_inr.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td className="source-cell" title={item.source}>{item.source}</td></tr>)}</tbody></table></div>
      <div className="catalog-pagination"><span>Showing <b>{total === 0 ? 0 : (page - 1) * 25 + 1}â€“{Math.min(page * 25, total)}</b> of <b>{total.toLocaleString("en-IN")}</b></span><div><button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={15} /></button><span>Page <b>{page}</b> of {totalPages}</span><button aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight size={15} /></button></div></div>
    </section><p className="catalog-disclaimer"><CircleHelp size={14} /> Composition and source text are shown as supplied in the dataset. Verify product details against the medicine pack and source documentation.</p>
  </>;
}

function Inventory({ onRefresh }: { onRefresh: () => void }) {
  const [items, setItems] = useState<Medicine[]>([]); const [loading, setLoading] = useState(true); const [query, setQuery] = useState(""); const [category, setCategory] = useState(""); const [status, setStatus] = useState(""); const [modal, setModal] = useState(false); const [notice, setNotice] = useState("");
  const load = async () => { setLoading(true); const q = new URLSearchParams(); if (query) q.set("search", query); if (category) q.set("category", category); if (status) q.set("status", status); try { setItems((await api.inventory(q.toString())).data); } catch (e) { setNotice((e as Error).message); } finally { setLoading(false); } };
  useEffect(() => { const t = setTimeout(() => void load(), 180); return () => clearTimeout(t); }, [query, category, status]);
  return <><PageHeading eyebrow="PHARMACY OPERATIONS" title="Inventory & dispensing" description="Track stock levels, batches and expiry dates across your pharmacy." actions={<button className="button button-primary" onClick={() => setModal(true)}><Plus size={16} /> Record dispensing</button>} />
    <div className="inventory-dataset-callout"><Pill size={16} /><span><b>The full 1,000-item catalogue is available in SmartMed.</b> This stock view shows the 7 demo medicines that have inventory and batch data.</span><NavLink to="/catalog">Browse all medicines <ArrowRight size={14} /></NavLink></div>
    <div className="inventory-summary"><div><span className="summary-icon green"><Boxes size={17} /></span><div><b>{items.length} medicines</b><small>Matching current filters</small></div></div><div><span className="summary-icon amber"><AlertTriangle size={17} /></span><div><b>{items.filter((m) => m.status !== "HEALTHY").length} need attention</b><small>Low or critical stock</small></div></div><div><span className="summary-icon blue"><Clock3 size={17} /></span><div><b>FEFO enabled</b><small>Earliest expiry dispensed first</small></div></div></div>
    <section className="panel inventory-panel"><div className="inventory-toolbar"><div className="search-field"><Search size={17} /><input placeholder="Search medicine or ID..." value={query} onChange={(e) => setQuery(e.target.value)} /><kbd>âŒ˜ K</kbd></div><select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{["Antibiotic", "Analgesic", "Endocrine", "Cardiovascular", "Respiratory", "Anticoagulant"].map((c) => <option key={c}>{c}</option>)}</select><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All stock states</option><option value="CRITICAL">Critical</option><option value="LOW">Low stock</option><option value="HEALTHY">Healthy</option></select><button className="button button-quiet filter-button"><Settings2 size={16} /> Filters</button></div>{notice && <div className="inline-notice">{notice}<button onClick={() => setNotice("")}><X size={14} /></button></div>}
      <div className="table-wrap"><table><thead><tr><th>MEDICINE</th><th>CATEGORY</th><th>STOCK LEVEL</th><th>THRESHOLDS</th><th>BATCH / EXPIRY</th><th>STATUS</th><th></th></tr></thead><tbody>{loading ? <tr><td colSpan={7}><div className="table-loading"><span className="spinner" /> Loading inventoryâ€¦</div></td></tr> : items.length === 0 ? <tr><td colSpan={7}><EmptyState title="No medicines found" text="Try changing your search or filters." icon={Search} /></td></tr> : items.map((m) => <tr key={m.id}><td><div className="table-med"><span className="med-avatar">{m.name.slice(0, 1)}</span><span><b>{m.name}</b><small>{m.id} Â· {m.unit}</small></span></div></td><td>{m.category}</td><td><div className="stock-cell"><b className={m.status === "CRITICAL" ? "text-rose" : m.status === "LOW" ? "text-amber" : ""}>{m.current_stock}</b><div className="table-meter"><span className={m.status === "CRITICAL" ? "meter-rose" : m.status === "LOW" ? "meter-amber" : "meter-green"} style={{ width: `${Math.min(100, m.current_stock / Math.max(m.min_threshold * 2, 1) * 100)}%` }} /></div></div></td><td><span className="threshold">Min. {m.min_threshold}</span><small className="threshold-sub">Critical {m.critical_threshold}</small></td><td>{m.batches?.map((b) => <div className="batch-info" key={b.id}><b>{b.batch_number}</b><small>Exp. {shortDate(b.expiry_date)}</small></div>)}</td><td><StatusBadge status={m.status ?? "HEALTHY"} /></td><td><button className="row-action" title="Record dispense" onClick={() => setModal(true)}><ChevronRight size={17} /></button></td></tr>)}</tbody></table></div><div className="table-foot"><span>Showing <b>{items.length}</b> medicines</span><span>Stock updates in real time <i className="sync-dot" /></span></div></section>
    {modal && <DispenseModal medicines={items} onClose={() => setModal(false)} onSuccess={async (msg) => { setModal(false); setNotice(msg); await load(); onRefresh(); }} />}
  </>;
}

function DispenseModal({ medicines, onClose, onSuccess }: { medicines: Medicine[]; onClose: () => void; onSuccess: (msg: string) => void }) {
  const [id, setId] = useState(medicines[0]?.id ?? ""); const [batchId, setBatchId] = useState(""); const [department, setDepartment] = useState("Emergency"); const [quantity, setQuantity] = useState("1"); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const medicine = medicines.find((m) => m.id === id); const batches = medicine?.batches ?? []; const batch = batches.find((b) => b.id === batchId) ?? batches[0];
  useEffect(() => { setBatchId(batches[0]?.id ?? ""); }, [id]);
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setError(""); try { await api.dispense({ medicine_id: id, batch_id: batchId, quantity: Number(quantity), department }); onSuccess(`${quantity} ${medicine?.unit} of ${medicine?.name} dispensed to ${department}.`); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className="modal"><div className="modal-header"><div><span className="modal-icon"><PackageCheck size={20} /></span><div><h2>Record dispensing</h2><p>Log medicine issued to a department</p></div></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div><form onSubmit={submit}><label>Medicine<select required value={id} onChange={(e) => setId(e.target.value)}>{medicines.map((m) => <option key={m.id} value={m.id}>{m.name} Â· {m.current_stock} {m.unit}</option>)}</select></label><div className="form-row"><label>Batch<select value={batchId} onChange={(e) => setBatchId(e.target.value)}>{batches.map((b) => <option key={b.id} value={b.id}>{b.batch_number} Â· {b.quantity} units Â· Exp. {shortDate(b.expiry_date)}</option>)}</select></label><label>Quantity<input type="number" min="1" max={batch?.quantity ?? medicine?.current_stock ?? 1} value={quantity} onChange={(e) => setQuantity(e.target.value)} required /></label></div><label>Department<select value={department} onChange={(e) => setDepartment(e.target.value)}><option>ICU</option><option>Emergency</option><option>Ward A</option></select></label>{medicine && <div className="stock-available"><span>Available in batch</span><b>{batch?.quantity ?? medicine.current_stock} {medicine.unit}</b></div>}{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? <><span className="spinner light" /> Recordingâ€¦</> : <><Check size={16} /> Confirm dispense</>}</button></div></form></div></div>;
}

function Restock() {
  const [items, setItems] = useState<RestockRequest[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = () => api.restocks().then((r) => setItems(r.data)).catch((e) => setError(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  const update = async (item: RestockRequest, action: "approve" | "order") => { try { const result = action === "approve" ? await api.approve(item.id) : await api.placeOrder(item.id); setItems((old) => old.map((r) => r.id === item.id ? { ...r, ...result.data } : r)); setError(""); } catch (e) { setError((e as Error).message); } };
  const pending = items.filter((i) => i.status === "PENDING").length;
  return <><PageHeading eyebrow="SUPPLY CHAIN" title="Restock dispatcher" description="Review prioritized replenishment requests and keep essential medicines available." actions={<button className="button button-quiet" onClick={load}><Activity size={16} /> Refresh queue</button>} />
    <div className="restock-hero"><div className="restock-hero-icon"><ShoppingCart size={21} /></div><div><b>{pending} requests need approval</b><p>Requests are ranked by stock urgency and clinical priority.</p></div><span className="hero-tag"><Sparkles size={14} /> Priority engine active</span></div>
    {error && <div className="inline-notice error-text">{error}</div>}
    <div className="restock-layout"><div className="restock-main"><div className="section-head"><div><h2>Priority queue</h2><p>Highest urgency score first</p></div><span className="count-pill">{items.length} requests</span></div>{loading ? <div className="panel table-loading"><span className="spinner" /> Loading requestsâ€¦</div> : items.length === 0 ? <div className="panel"><EmptyState title="Queue is clear" text="No replenishment requests are waiting." icon={Check} /></div> : items.map((item, index) => <div className="restock-card" key={item.id}><div className="rank">{String(index + 1).padStart(2, "0")}</div><div className={`urgency-score ${item.urgency_score >= 90 ? "score-critical" : item.urgency_score >= 60 ? "score-high" : "score-normal"}`}><span>{item.urgency_score}</span><small>urgency</small></div><div className="restock-detail"><div className="restock-title"><b>{item.medicine?.name ?? item.medicine_id}</b><StatusBadge status={item.status} /></div><p>{item.medicine?.category ?? "Medicine"} <span>Â·</span> Current stock <b>{item.medicine?.current_stock ?? "â€”"} {item.medicine?.unit ?? ""}</b></p><div className="restock-meta"><span><PackageCheck size={14} /> Suggested <b>{item.suggested_qty} {item.medicine?.unit ?? "units"}</b></span><span><Boxes size={14} /> {item.supplier_name}</span></div></div><div className="restock-actions">{item.status === "PENDING" ? <button className="button button-primary button-small" onClick={() => update(item, "approve")}><Check size={14} /> Approve request</button> : item.status === "APPROVED" ? <button className="button button-dark button-small" onClick={() => update(item, "order")}><ShoppingCart size={14} /> Place order</button> : <span className="completed-label"><Check size={15} /> Order placed</span>}<small>Request {item.id}</small></div></div>)}</div>
      <aside className="restock-aside"><div className="panel"><div className="panel-head"><div><h2>Queue summary</h2><p>Current replenishment status</p></div></div><div className="queue-stat"><span className="queue-circle amber-circle"><Clock3 size={17} /></span><div><b>{pending}</b><small>Awaiting approval</small></div></div><div className="queue-stat"><span className="queue-circle green-circle"><Check size={17} /></span><div><b>{items.filter((i) => i.status === "APPROVED").length}</b><small>Approved requests</small></div></div><div className="queue-stat"><span className="queue-circle blue-circle"><ShoppingCart size={17} /></span><div><b>{items.filter((i) => i.status === "ORDERED").length}</b><small>Orders placed</small></div></div><div className="aside-tip"><Sparkles size={16} /><p><b>Smart prioritization</b><br />Scores combine stock levels, demand patterns and clinical criticality.</p></div></div></aside></div>
  </>;
}

function Reports() {
  const [trends, setTrends] = useState<Trends | null>(null); const [loading, setLoading] = useState(true); const [exportMsg, setExportMsg] = useState(""); const [exporting, setExporting] = useState("");
  useEffect(() => { api.trends().then((r) => setTrends(r.data)).catch(() => {}).finally(() => setLoading(false)); }, []);
  const exportData = async (format: "csv" | "pdf") => { setExporting(format); setExportMsg(""); try { setExportMsg(await downloadExport(format)); } catch (e) { setExportMsg((e as Error).message); } finally { setExporting(""); } };
  const chartUsage = useMemo(() => trends?.department_usage ?? [], [trends]); const chartStock = useMemo(() => (trends?.historical_stock ?? []).map((p) => ({ ...p, date: shortDate(p.date) })), [trends]);
  return <><PageHeading eyebrow="INSIGHTS & REPORTING" title="Analytics & reports" description="Understand consumption patterns and make confident replenishment decisions." actions={<div className="export-actions"><button className="button button-quiet" disabled={!!exporting} onClick={() => exportData("pdf")}><Download size={16} /> {exporting === "pdf" ? "Preparingâ€¦" : "Export PDF"}</button><button className="button button-primary" disabled={!!exporting} onClick={() => exportData("csv")}><Download size={16} /> {exporting === "csv" ? "Preparingâ€¦" : "Export CSV"}</button></div>} />
    {exportMsg && <div className="export-message"><Check size={16} />{exportMsg}<button onClick={() => setExportMsg("")}><X size={14} /></button></div>}
    <section className="report-summary"><div><span className="summary-icon blue"><Activity size={17} /></span><div><small>REPORTING PERIOD</small><b>Last 7 days</b></div></div><div><span className="summary-icon green"><Boxes size={17} /></span><div><small>DEPARTMENTS TRACKED</small><b>{chartUsage.length || "â€”"} departments</b></div></div><div><span className="summary-icon amber"><Clock3 size={17} /></span><div><small>LAST UPDATED</small><b>Just now</b></div></div></section>
    <div className="charts-grid"><section className="panel chart-panel"><div className="panel-head"><div><h2>Consumption by department</h2><p>Units dispensed Â· Last 7 days</p></div><span className="chart-legend"><i className="legend-green" /> Units dispensed</span></div>{loading ? <div className="chart-loading"><span className="spinner" /> Loading chartâ€¦</div> : <ResponsiveContainer width="100%" height={280}><BarChart data={chartUsage} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}><CartesianGrid stroke="#edf1ef" vertical={false} /><XAxis dataKey="department" tickLine={false} axisLine={false} tick={{ fill: "#7d8a84", fontSize: 11 }} dy={10} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "#7d8a84", fontSize: 11 }} /><Tooltip cursor={{ fill: "#eff7f3" }} contentStyle={{ border: "1px solid #e6ece9", borderRadius: 12, boxShadow: "0 8px 24px #10261b14" }} /><Bar dataKey="quantity" name="Units dispensed" fill="#248563" radius={[6, 6, 0, 0]} maxBarSize={46} /></BarChart></ResponsiveContainer>}</section>
      <section className="panel chart-panel"><div className="panel-head"><div><h2>Historical stock level</h2><p>Total units on hand Â· Last 7 days</p></div><span className="chart-legend"><i className="legend-blue" /> Stock units</span></div>{loading ? <div className="chart-loading"><span className="spinner" /> Loading chartâ€¦</div> : <ResponsiveContainer width="100%" height={280}><AreaChart data={chartStock} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}><defs><linearGradient id="stockGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#76b7dd" stopOpacity={0.3} /><stop offset="95%" stopColor="#76b7dd" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid stroke="#edf1ef" vertical={false} /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#7d8a84", fontSize: 11 }} dy={10} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "#7d8a84", fontSize: 11 }} /><Tooltip contentStyle={{ border: "1px solid #e6ece9", borderRadius: 12 }} /><Area type="monotone" dataKey="stock_units" name="Stock units" stroke="#5198be" strokeWidth={2.5} fill="url(#stockGradient)" activeDot={{ r: 5 }} /></AreaChart></ResponsiveContainer>}</section></div>
    <div className="report-note"><div className="note-icon"><Sparkles size={17} /></div><div><b>Make your data work for you</b><p>Use department trends to spot unusual demand early and keep the right stock on hand.</p></div><button className="text-link">Learn more <ArrowRight size={14} /></button></div>
  </>;
}

function Admin() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("STAFF");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const loadUsers = () => api.users().then((response) => setUsers(response.data)).catch((e) => setError(e.message));
  useEffect(() => { void loadUsers(); }, []);
  const createAccount = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const result = await api.createUser({ display_name: name, email, role, ...(password ? { password } : {}) });
      setUsers((current) => [result.data.user, ...current]); setName(""); setEmail(""); setPassword("");
      setNotice(`${result.data.user.display_name} added as ${result.data.user.role}.`);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return <><PageHeading eyebrow="SYSTEM SETTINGS" title="Admin management" description="Create and manage pharmacy staff, manager, and procurement accounts." /><section className="panel admin-panel account-create-panel"><div className="panel-head"><div><h2>Create an account</h2><p>Only an administrator can add users. There can be only one admin account.</p></div><span className="summary-icon green"><Shield size={17} /></span></div><form className="admin-create-form" onSubmit={createAccount}><label>Full name<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" minLength={2} required placeholder="e.g. Jordan Davis" /></label><label>Email address<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required placeholder="name@hospital.org" /></label><label>Role<select value={role} onChange={(e) => setRole(e.target.value)}><option value="STAFF">Pharmacy Staff</option><option value="MANAGER">Manager</option><option value="PROCUREMENT">Procurement</option></select></label><label>Temporary password <small>(optional for Google-only access)</small><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={password ? 8 : undefined} autoComplete="new-password" placeholder="At least 8 characters" /></label>{error && <div className="auth-error admin-form-message"><AlertTriangle size={15} />{error}</div>}{notice && <div className="admin-success"><Check size={15} />{notice}</div>}<button className="button button-primary" disabled={busy}><Plus size={15} />{busy ? "Creating…" : "Create account"}</button></form></section><section className="panel users-panel"><div className="panel-head"><div><h2>Workspace accounts</h2><p>{users.length} account{users.length === 1 ? "" : "s"} · Google sign-in links on first login</p></div><button className="button button-quiet" onClick={() => void loadUsers()}><Activity size={15} /> Refresh</button></div>{users.length === 0 ? <EmptyState title="No accounts loaded" text="Check the API connection and try again." icon={CircleHelp} /> : <div className="table-wrap"><table><thead><tr><th>NAME</th><th>EMAIL</th><th>ROLE</th><th>SIGN-IN</th><th>CREATED</th></tr></thead><tbody>{users.map((account) => <tr key={account.id}><td><div className="table-med"><div className="med-avatar">{account.display_name.slice(0, 1)}</div><b>{account.display_name}</b></div></td><td>{account.email}</td><td><StatusBadge status={account.role} /></td><td>{account.google_linked ? "Google linked" : "Password / Google"}</td><td>{new Date(account.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>}</section></>;
}

function GoogleMark() { return <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.9 6.1-15Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.7a12 12 0 0 1 0-7.4V15H5.8a20 20 0 0 0 0 18Z"/><path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.9-5.9C34.1 6 29.5 4 24 4A20 20 0 0 0 5.8 15l6.8 5.3c1.6-4.8 6.1-8.2 11.4-8.2Z"/></svg>;
}
function EmptyState({ title, text, icon: Icon }: { title: string; text: string; icon: typeof Check }) { return <div className="empty-state"><span><Icon size={20} /></span><b>{title}</b><p>{text}</p></div>; }

export default App;
