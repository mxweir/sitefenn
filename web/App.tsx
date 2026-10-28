import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Activity, ArrowDownRight, ArrowRight, Check, CheckCircle2, ChevronRight, Circle, CircleAlert, Clock3, ExternalLink, FlaskConical, FolderOpen, Globe2, Layers3, LayoutDashboard, LoaderCircle, Monitor, Plus, ScanLine, ShieldCheck, Sparkles, TerminalSquare, X } from 'lucide-react';
import type { Project, Scan, Dependency } from '../shared/types.js';

type Bootstrap = { projects: Project[]; scans: Scan[]; dependencies: Dependency[]; version: string };
const empty: Bootstrap = { projects: [], scans: [], dependencies: [], version: '0.1.0' };
const active = (scan: Scan) => scan.status === 'queued' || scan.status === 'running';
const stamp = (value: string) => new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const scanLabel = (scan: Scan) => scan.status === 'queued' ? 'In Warteschlange' : scan.status === 'running' ? 'Prüfung läuft' : scan.status === 'interrupted' ? 'Unterbrochen' : scan.status === 'failed' || scan.error ? 'Fehlgeschlagen' : scan.result ? 'Abgeschlossen' : scan.status;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init, headers: { ...(init?.method ? { 'X-Hub-Request': '1' } : {}), ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } });
  const payload = await response.json().catch(() => ({ error: `Serverantwort nicht lesbar (${response.status}).` }));
  if (!response.ok) throw new Error(payload.error || `Anfrage fehlgeschlagen (${response.status}).`);
  return payload as T;
}

export default function App() {
  const [data, setData] = useState<Bootstrap>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState('');
  const [screen, setScreen] = useState<'projects' | 'system'>('projects');
  const [imageError, setImageError] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const refresh = useCallback(async () => {
    try { const next = await request<Bootstrap>('/api/bootstrap'); setData(next); setError(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Der Hub ist nicht erreichbar.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const running = data.scans.some(active);
  useEffect(() => { if (!running) return; const interval = window.setInterval(() => void refresh(), 2000); return () => window.clearInterval(interval); }, [running, refresh]);
  const project = data.projects.find(p => p.id === projectId) ?? data.projects[0];
  const scans = project ? data.scans.filter(s => s.projectId === project.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
  const selectedScan = scans.find(s => s.id === scanId) ?? scans[0];
  useEffect(() => { setImageError(false); }, [selectedScan?.id]);
  const missing = data.dependencies.filter(d => d.status === 'missing');
  async function mutation(key: string, operation: () => Promise<unknown>) {
    setBusy(key); setError('');
    try { await operation(); await refresh(); } catch (err) { setError(err instanceof Error ? err.message : 'Aktion fehlgeschlagen.'); } finally { setBusy(''); }
  }
  const chooseProject = (id: string) => { setProjectId(id); setScanId(null); setScreen('projects'); };
  const createDemo = () => mutation('demo', async () => {
    const result = await request<Project | { project: Project }>('/api/demo', { method: 'POST' });
    const p = 'project' in result ? result.project : result;
    if (p?.id) chooseProject(p.id);
  });

  return <div className="app-shell">
    <a className="skip-link" href="#main">Zum Inhalt springen</a>
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setScreen('projects'); }} aria-label="Website Audit Hub Startseite"><span className="brand-mark"><ScanLine size={23}/></span><span className="brand-name">Website<small>AUDIT HUB · LOCAL FIRST</small></span></a>
      <div className="workspace"><span className="workspace-avatar">M</span><div>Mein Workspace<small>Lokal auf diesem Gerät</small></div><ShieldCheck size={16}/></div>
      <span className="nav-label">WORKSPACE</span>
      <nav aria-label="Hauptnavigation"><button className={screen === 'projects' ? 'nav-item selected' : 'nav-item'} onClick={() => setScreen('projects')}><LayoutDashboard size={18}/>Websites<span className="nav-count">{data.projects.length}</span></button><button className={screen === 'system' ? 'nav-item selected' : 'nav-item'} onClick={() => setScreen('system')}><TerminalSquare size={18}/>System & Setup{missing.length > 0 && <span className="warning-dot"/>}</button></nav>
      <div className="sidebar-projects"><span className="nav-label">DEINE PROJEKTE</span>{data.projects.slice(0, 7).map(p => <button key={p.id} className={`project-nav ${screen === 'projects' && project?.id === p.id ? 'current' : ''}`} onClick={() => chooseProject(p.id)}><span className="project-dot"/>{p.name}</button>)}{data.projects.length === 0 && <p className="sidebar-empty">Dein erster Scan beginnt<br/>mit einer Website.</p>}</div>
      <div className="sidebar-bottom"><div className="local-note"><span className="online-dot"/><span>Deine Daten bleiben lokal<small>Keine Cloud-KI erforderlich</small></span></div><div className="version">FOUNDATION RELEASE <span>v{data.version}</span></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div><span className="breadcrumb">Workspace</span><ChevronRight size={13}/><span>{screen === 'system' ? 'System & Setup' : 'Websites'}</span></div><span className="local-badge"><span className="online-dot"/>LOCAL-FIRST <span className="beta-tag">0.1</span></span></header>
      <main id="main" tabIndex={-1}>
        {error && <div className="error-banner" role="alert"><CircleAlert size={19}/><span>{error}</span><button onClick={() => void refresh()}>Erneut versuchen</button></div>}
        {screen === 'projects' ? <>
          <section className="page-heading"><div><p className="eyebrow">DEINE WEBSITES. KLAR IM BLICK.</p><h1>Gute Websites beginnen<br className="desktop-break"/> mit einem genauen Blick<span className="accent">.</span></h1><p className="subtitle">Prüfe deine Seiten. Sieh die Belege. Mach den nächsten Schritt.</p></div><button ref={addButton} className="button primary" onClick={() => setModal(true)}><Plus size={18}/>Website hinzufügen</button></section>
          <div className="foundation-note"><span className="note-icon"><Layers3 size={18}/></span><div><strong>Ein ehrlicher Anfang.</strong> Version 0.1 prüft eine Seite in einer Desktop-Ansicht und speichert den Screenshot mit messbaren Basisbefunden. Responsive-Scans, lokale KI und Scores folgen später.</div><span className="foundation-chip">FOUNDATION</span></div>
          <section className="stats-grid" aria-label="Workspace Übersicht"><Stat icon={<Globe2 size={19}/>} label="Verwaltete Websites" value={data.projects.length} detail="Deine Projekte an einem Ort"/><Stat icon={<ScanLine size={19}/>} label="Prüfungen insgesamt" value={data.scans.length} detail="Mit nachvollziehbaren Ergebnissen"/><Stat icon={<Activity size={19}/>} label="Aktive Prüfungen" value={data.scans.filter(active).length} detail={running ? 'Ergebnisse werden aktualisiert' : 'Bereit für den nächsten Blick'}/></section>
          {loading ? <div className="loading-state" role="status"><LoaderCircle className="spin"/>Workspace wird geladen …</div> : data.projects.length === 0 ? <section className="empty-card"><div className="empty-art"><Monitor size={50}/><span className="art-badge"><ScanLine size={24}/></span></div><p className="eyebrow">DEIN ERSTER KLARER BLICK</p><h2>Welche Website nehmen wir uns vor?</h2><p>Füge eine Website hinzu, die du verwaltest, oder probiere<br className="desktop-break"/> den Scanner sicher mit unserer lokalen Demo aus.</p><div className="button-row"><button className="button primary" onClick={() => setModal(true)}><Plus size={17}/>Website hinzufügen</button><button className="button secondary" disabled={!!busy} onClick={() => void createDemo()}>{busy === 'demo' ? <LoaderCircle size={17} className="spin"/> : <FlaskConical size={17}/>}Demo ausprobieren</button></div><small>Die Demo enthält absichtlich eingebaute Fehler. Kein externes Ziel nötig.</small></section> : <>
            <section className="section-heading"><div><h2>Deine Websites <span className="number-pill">{data.projects.length}</span></h2><p>Wähle ein Projekt, um Prüfungen und Belege anzusehen.</p></div><button className="text-button" disabled={!!busy} onClick={() => void createDemo()}><FlaskConical size={15}/>{busy === 'demo' ? 'Demo wird angelegt …' : 'Demo laden'}</button></section>
            <div className="project-grid">{data.projects.map(p => { const projectScans = data.scans.filter(s => s.projectId === p.id); const latest = [...projectScans].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]; return <button key={p.id} className={`project-card ${project?.id === p.id ? 'active-project' : ''}`} onClick={() => chooseProject(p.id)}><div className="project-card-top"><span className="website-icon"><Globe2 size={22}/></span><span className={`environment ${p.environment}`}>{environmentLabel(p.environment)}</span></div><h3>{p.name}</h3><span className="project-url">{p.url}</span><div className="project-card-footer"><span>{latest ? scanLabel(latest) : 'Noch keine Prüfung'}</span><ArrowDownRight size={17}/></div></button>; })}</div>
            {project && <section className="project-workspace" aria-labelledby="project-title"><div className="section-heading"><div><p className="eyebrow">PROJEKTDETAILS</p><h2 id="project-title">{project.name}</h2><a href={project.url} target="_blank" rel="noreferrer" className="external-url">{project.url}<ExternalLink size={13}/></a></div><button className="button primary" disabled={!!busy || scans.some(active) || missing.length > 0} onClick={() => void mutation('scan', async () => { await request(`/api/projects/${encodeURIComponent(project.id)}/scans`, { method: 'POST' }); setScanId(null); })}>{busy === 'scan' || scans.some(active) ? <LoaderCircle size={17} className="spin"/> : <ScanLine size={17}/>} {scans.some(active) ? 'Prüfung läuft' : 'Desktop-Check starten'}</button></div>
              {missing.length > 0 && <div className="inline-warning"><CircleAlert size={17}/><span>Zum Prüfen fehlen Systemvoraussetzungen.</span><button onClick={() => setScreen('system')}>Setup öffnen<ArrowRight size={14}/></button></div>}
              <div className="scan-layout"><div className="scan-history"><div className="panel-title"><Clock3 size={16}/>Prüfungen<span>{scans.length}</span></div>{scans.length ? <div className="scan-list">{scans.map(scan => <button key={scan.id} className={selectedScan?.id === scan.id ? 'scan-item chosen' : 'scan-item'} onClick={() => setScanId(scan.id)}><span className={`scan-status ${active(scan) ? 'pending' : scan.error || scan.status === 'failed' ? 'failed' : 'done'}`}>{active(scan) ? <LoaderCircle size={16} className="spin"/> : scan.error || scan.status === 'failed' ? <CircleAlert size={16}/> : <CheckCircle2 size={16}/>}</span><span><strong>{scanLabel(scan)}</strong><small>{stamp(scan.createdAt)}</small></span><ChevronRight size={14}/></button>)}</div> : <div className="small-empty"><FolderOpen size={26}/><p>Noch kein Scan.</p><span>Starte deinen ersten Desktop-Check.</span></div>}</div><div className="scan-detail">{selectedScan ? <ScanDetail scan={selectedScan} imageError={imageError} onImageError={() => setImageError(true)}/> : <div className="detail-placeholder"><ScanLine size={34}/><h3>Hier werden Vermutungen zu Belegen.</h3><p>Ein Scan zeigt dir den tatsächlichen Seitenzustand<br/> und die Ergebnisse der Basisprüfungen.</p><span>DESKTOP · EINE SEITE · KEINE KI-BEWERTUNG</span></div>}</div></div>
            </section>}
          </>}
        </> : <><section className="page-heading"><div><p className="eyebrow">BEREIT FÜR DEN ERSTEN SCAN</p><h1>Ein gesundes Setup<span className="accent">.</span></h1><p className="subtitle">Die Voraussetzungen für verlässliche lokale Prüfungen.</p></div><button className="button secondary" onClick={() => void refresh()}><Activity size={17}/>Status aktualisieren</button></section><section className="dependency-list">{data.dependencies.map(dep => <article className="dependency-card" key={dep.id}><span className={`dependency-icon ${dep.status}`}>{dep.status === 'ready' ? <CheckCircle2/> : dep.status === 'missing' ? <CircleAlert/> : <Sparkles/>}</span><div><div className="dependency-heading"><h2>{dep.label}</h2><span className={`dependency-state ${dep.status}`}>{dep.status === 'ready' ? 'Bereit' : dep.status === 'missing' ? 'Fehlt' : 'Optional'}</span></div><p>{dep.detail}</p>{dep.instruction && <pre><code>{dep.instruction}</code></pre>}</div></article>)}{loading && <p role="status">Voraussetzungen werden geprüft …</p>}{!loading && data.dependencies.length === 0 && <p className="muted">Keine Systeminformationen verfügbar. Prüfe die Verbindung zum lokalen Server.</p>}</section><div className="privacy-card"><ShieldCheck size={23}/><div><h3>Lokal bedeutet: Du behältst die Kontrolle.</h3><p>Prüfberichte bleiben in deinem lokalen Hub. Der Browser ruft die geprüfte Website und ihre eingebundenen Dienste auf. In Version 0.1 wird kein LLM verwendet.</p></div></div></>}
        <footer className="main-footer"><span><ShieldCheck size={13}/>Belege statt Bauchgefühl.</span><span>Website Audit Hub · Foundation v{data.version}</span></footer>
      </main>
    </div>
    {modal && <ProjectModal onClose={() => { setModal(false); window.setTimeout(() => addButton.current?.focus(), 0); }} onCreate={async (values) => { const p = await request<Project | { project: Project }>('/api/projects', { method: 'POST', body: JSON.stringify({ ...values, acknowledged: true }) }); const created = 'project' in p ? p.project : p; await refresh(); if (created?.id) chooseProject(created.id); setModal(false); window.setTimeout(() => addButton.current?.focus(), 0); }}/>} 
  </div>;
}

function environmentLabel(value: string) { return value === 'production' ? 'Produktion' : value === 'staging' ? 'Staging' : 'Lokal'; }
function Stat({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: number; detail: string }) { return <article className="stat-card"><div className="stat-top"><span>{label}</span>{icon}</div><strong>{value.toString().padStart(2, '0')}</strong><p>{detail}</p></article>; }

function ScanDetail({ scan, imageError, onImageError }: { scan: Scan; imageError: boolean; onImageError: () => void }) {
  const result = scan.result;
  if (active(scan)) return <div className="detail-placeholder" role="status"><div className="scan-orbit"><ScanLine size={33}/></div><h3>{scan.status === 'queued' ? 'Deine Prüfung ist eingeplant.' : 'Wir schauen genau hin.'}</h3><p>Die Seite wird geöffnet und der sichtbare Zustand geprüft.<br/>Die Ergebnisse erscheinen hier automatisch.</p><span>KEIN LIVE-STREAM IN VERSION 0.1</span></div>;
  if (scan.error || scan.status === 'failed') return <div className="detail-placeholder failure"><CircleAlert size={32}/><h3>Diese Prüfung konnte nicht abgeschlossen werden.</h3><p>{scan.error || 'Der Browser hat kein auswertbares Ergebnis geliefert.'}</p><span>Kein Ergebnis wird als bestanden gewertet.</span></div>;
  if (!result) return <div className="detail-placeholder"><Clock3 size={30}/><h3>Noch kein Ergebnis verfügbar.</h3><p>Status: {scan.status}</p></div>;
  return <><div className="result-heading"><div><span className="eyebrow">DESKTOP-AUFNAHME</span><h3>{result.title || 'Seitenprüfung'}</h3></div><span className="result-meta"><Monitor size={14}/>{result.viewport.width} × {result.viewport.height}</span></div><div className="browser-preview"><div className="browser-chrome"><div className="browser-dots"><i/><i/><i/></div><span>{result.url}</span><ShieldCheck size={12}/></div>{imageError ? <div className="image-error"><CircleAlert size={23}/><p>Screenshot konnte nicht geladen werden.</p></div> : <a className="screenshot-link" href={`/api/scans/${encodeURIComponent(scan.id)}/screenshot`} target="_blank" rel="noreferrer" aria-label="Screenshot in voller Größe öffnen"><img onError={onImageError} src={`/api/scans/${encodeURIComponent(scan.id)}/screenshot`} alt={`Gespeicherter Desktop-Screenshot: ${result.title || result.url}`}/><span>Aufnahme öffnen<ExternalLink size={13}/></span></a>}</div><div className="capture-caption"><span><Clock3 size={13}/>{stamp(scan.createdAt)}</span><span>HTTP {result.statusCode} · {(result.durationMs / 1000).toFixed(1)} s</span></div><div className="checks-heading"><h3>Basisbefunde</h3><span>{result.checks.length} Einträge · kein Gesamtscore</span></div><div className="finding-list">{result.checks.map(check => <article key={check.id} className={`finding ${check.status}`}><span className="finding-icon">{check.status === 'pass' ? <Check size={17}/> : check.status === 'fail' ? <CircleAlert size={17}/> : <Circle size={15}/>}</span><div><h4>{check.label}</h4><p>{check.detail}</p></div><span className="finding-label">{check.status === 'pass' ? 'Bestanden' : check.status === 'fail' ? 'Befund' : 'Hinweis'}</span></article>)}</div></>;
}

function ProjectModal({ onClose, onCreate }: { onClose: () => void; onCreate: (values: { name: string; url: string; environment: string }) => Promise<void> }) {
  const [name, setName] = useState(''); const [url, setUrl] = useState(''); const [environment, setEnvironment] = useState('production'); const [consent, setConsent] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const dialog = useRef<HTMLDivElement>(null); const nameRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => { const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; nameRef.current?.focus(); return () => { document.body.style.overflow = previous; }; }, []);
  useLayoutEffect(() => { if (error && !saving) nameRef.current?.focus(); }, [error, saving]);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !savingRef.current) { event.preventDefault(); closeRef.current(); return; }
      if (event.key !== 'Tab') return;
      const elements = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]');
      if (!elements?.length) { event.preventDefault(); return; }
      const first = elements[0], last = elements[elements.length - 1];
      if (!dialog.current?.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !saving) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-description" ref={dialog}>
    <button className="modal-close" onClick={onClose} disabled={saving} aria-label="Dialog schließen"><X size={20}/></button><span className="modal-icon"><Globe2 size={25}/></span><p className="eyebrow">NEUES PROJEKT</p><h2 id="modal-title">Deine Website hinzufügen.</h2><p id="modal-description">Ein fester Platz für deine Prüfungen und Ergebnisse.</p>
    <form onSubmit={async e => { e.preventDefault(); if (!consent || savingRef.current) return; savingRef.current = true; setSaving(true); setError(''); try { await onCreate({ name: name.trim(), url: url.trim(), environment }); } catch (err) { savingRef.current = false; setSaving(false); setError(err instanceof Error ? err.message : 'Projekt konnte nicht erstellt werden.'); } }}>
      <label htmlFor="project-name">Projektname</label><input id="project-name" ref={nameRef} value={name} onChange={e => setName(e.target.value)} required maxLength={80} placeholder="z. B. Mein Portfolio" autoComplete="off" disabled={saving}/>
      <label htmlFor="project-url">Website-URL</label><input id="project-url" type="url" value={url} onChange={e => setUrl(e.target.value)} required placeholder="https://meine-website.de" disabled={saving} aria-describedby="url-hint"/>
      <p id="url-hint" className="field-hint">Nur eigene oder ausdrücklich freigegebene, vertrauenswürdige öffentliche Websites über HTTP/HTTPS (Port 80/443). Private und lokale Ziele sind in Version 0.1 gesperrt; ausgenommen ist die integrierte Demo.</p>
      <label htmlFor="environment">Umgebung</label><select id="environment" value={environment} onChange={e => setEnvironment(e.target.value)} disabled={saving}><option value="production">Produktion</option><option value="staging">Staging</option></select>
      <label className="consent-row"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} required disabled={saving}/><span>Ich verwalte diese vertrauenswürdige Website oder bin ausdrücklich berechtigt, sie automatisiert zu prüfen.</span></label>
      {error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button secondary" onClick={onClose} disabled={saving}>Abbrechen</button><button className="button primary" type="submit" disabled={!consent || saving}>{saving ? <LoaderCircle size={16} className="spin"/> : <Plus size={16}/>}Projekt erstellen</button></div>
    </form>
  </div></div>;
}
