/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { 
  BarChart3, LayoutDashboard, FileText, LogOut, 
  ClipboardCheck, AlertCircle, CheckCircle2, Building2, 
  Calendar, Send, Users, UserPlus, Settings, PieChart,
  Lock, Eye, EyeOff
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, AreaChart, Area } from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const API = {
  async request(endpoint: string, options: RequestInit = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    const response = await fetch(endpoint, { ...options, headers, credentials: 'same-origin' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Serverfehler');
    return data;
  }
};


function NavItem({ to, icon: Icon, label }: { to: string, icon: any, label: string }) {
  const location = useLocation();
  const isActive = location.pathname.startsWith(to);
  
  return (
    <Link 
      to={to} 
      className={cn(
        "flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 font-medium",
        isActive 
          ? "bg-[#C8B568] text-white shadow-lg shadow-[#C8B568]/30" 
          : "text-slate-400 hover:bg-slate-800/80 hover:text-white"
      )}
    >
      <Icon size={20} className={isActive ? "text-white" : "text-slate-400"} />
      <span>{label}</span>
      {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />}
    </Link>
  );
}

function Layout({ user, onLogout, children }: { user: any, onLogout: () => void, children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      <div className="w-72 bg-[#0f172a] text-white flex flex-col fixed h-full shadow-2xl z-20 border-r border-slate-800">
        <div className="p-10 flex items-center justify-start border-b border-slate-800/30">
          <div className="flex flex-col select-none">
            <div className="text-white text-5xl font-black italic tracking-tighter leading-none bg-clip-text text-transparent bg-gradient-to-br from-[#f3d38c] via-[#C8B568] to-[#947e3a]" 
                 style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
              ARE
            </div>
            <div className="text-white/90 text-[10px] tracking-[0.4em] font-bold mt-1.5 uppercase">Beteiligungen</div>
          </div>
        </div>
        
        <nav className="flex-1 px-5 py-6 space-y-2.5 overflow-y-auto">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 pl-4 pt-2">Menu</div>
          
          {user.role === 'admin' ? (
            <>
              <NavItem to="/admin" icon={LayoutDashboard} label="Dashboard" />
              <NavItem to="/analytics" icon={PieChart} label="Datenabfrage" />
              <NavItem to="/users" icon={Users} label="Nutzerverwaltung" />
              <NavItem to="/companies" icon={Building2} label="Gesellschaftenverwaltung" />
            </>
          ) : (
            <>
              <NavItem to="/backlog" icon={ClipboardCheck} label="Auftragsbestand" />
              <NavItem to="/reporting" icon={FileText} label="Monatsmeldung" />
              <NavItem to="/analytics" icon={PieChart} label="Analytics" />
            </>
          )}
        </nav>

        <div className="p-6 border-t border-slate-800/50 bg-slate-900/50 backdrop-blur-md">
          <div className="flex items-center gap-4 mb-6 px-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C8B568] to-[#b9a557] flex items-center justify-center text-white font-bold text-lg shadow-inner">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate text-white">{user.username}</div>
              <div className="text-xs font-medium text-slate-400 truncate">
                {user.role === 'admin' ? 'System Admin' : user.companies ? user.companies.map((c:any) => c.name).join(', ') : user.company_name || 'System Admin'}
              </div>
            </div>
          </div>
          
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 text-slate-300 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 border border-transparent transition-all font-medium"
          >
            <LogOut size={18} />
            <span>Sitzung beenden</span>
          </button>
        </div>
      </div>

      <div className="flex-1 ml-72">
        <div className="p-10 max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </div>
    </div>
  );
}

// --- Admin Subviews ---

function AdminOverview() {
  const [data, setData] = useState<{ companies: any[], reports: any[], initials: any[] }>({ companies: [], reports: [], initials: [] });
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    API.request('/api/admin/overview')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

  const currentMonth = new Date().getMonth() + 1;
  const filteredReports = data.reports.filter(r => r.year === selectedYear);

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Status Dashboard</h1>
          <p className="mt-2 text-slate-500 font-medium">Behalten Sie den Überblick über die Meldequote aller Gesellschaften.</p>
        </div>
        <select 
          className="bg-white border-none shadow-sm rounded-xl py-3 px-6 text-sm font-bold text-[#C8B568] ring-1 ring-slate-200 focus:ring-2 focus:ring-[#C8B568] outline-none hover:shadow-md transition-shadow cursor-pointer"
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
        >
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>Geschäftsjahr {y}</option>)}
        </select>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 bg-[#fdfaf2]  w-32 h-32 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700 ease-out z-0"></div>
          <div className="z-10 text-slate-500 text-sm font-semibold uppercase tracking-wider mb-2">Gesellschaften im System</div>
          <div className="z-10 text-5xl font-black text-slate-900">{data.companies.length}</div>
        </div>
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 bg-[#fdfaf2] w-32 h-32 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700 ease-out z-0"></div>
          <div className="z-10 text-slate-500 text-sm font-semibold uppercase tracking-wider mb-2">Erfasste Monatsberichte</div>
          <div className="z-10 text-5xl font-black text-slate-900">{filteredReports.length}</div>
        </div>
        <div className="bg-gradient-to-br from-[#C8B568] to-[#b9a557] p-8 rounded-[2rem] shadow-lg shadow-[#C8B568]/20 flex flex-col justify-between text-white relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 bg-white/10 w-32 h-32 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700 ease-out z-0"></div>
          <div className="z-10 text-indigo-100 text-sm font-semibold uppercase tracking-wider mb-2">Abgabe ({currentMonth}/{selectedYear})</div>
          <div className="z-10 flex items-baseline gap-2">
            <span className="text-5xl font-black">{filteredReports.filter(r => r.month === currentMonth).length}</span>
            <span className="text-xl font-medium text-[#ebdca8]">/ {data.companies.length}</span>
          </div>
        </div>
      </div>

      {/* Basic matrix view cut short for brevity, focusing on the new management components visually */}
      <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-sm border border-slate-100 p-8">
         <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-6">Meldestatus Matrix {selectedYear}</h2>
         <div className="overflow-x-auto pb-4">
          <table className="w-full text-left">
            <thead className="text-xs text-slate-400 uppercase tracking-widest font-bold">
              <tr>
                <th className="py-4 px-2 w-64">Gesellschaft</th>
                {['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'].map(m => <th key={m} className="px-2 py-4 text-center">{m}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {data.companies.map(company => (
                <tr key={company.id} className="group">
                  <td className="py-4 px-2 font-semibold text-slate-700">{company.name}</td>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(monthId => {
                    const r = filteredReports.find(x => x.company_id === company.id && x.month === monthId);
                    return (
                      <td key={monthId} className="px-2 py-4 text-center">
                        {r ? <div className="w-3 h-3 rounded-full bg-green-500 mx-auto shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div> : <div className="w-2 h-2 rounded-full bg-slate-200 mx-auto"></div>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
         </div>
      </div>
    </div>
  );
}

function AdminUserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [newUser, setNewUser] = useState({ 
    username: '', password: '', role: 'user', 
    security_question: '', security_answer: '',
    company_ids: [] as string[] 
  });
  
  // Edit State
  const [editingUser, setEditingUser] = useState<any>(null);

  const fetchData = async () => {
    try {
      const [uRes, cRes] = await Promise.all([
        API.request('/api/admin/users'),
        API.request('/api/admin/companies')
      ]);
      setUsers(uRes.users);
      setCompanies(cRes.companies);
    } catch (err) {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await API.request('/api/admin/users', { 
        method: 'POST', 
        body: JSON.stringify(newUser) 
      });
      setNewUser({ 
        username: '', password: '', role: 'user', 
        security_question: '', security_answer: '',
        company_ids: [] 
      });
      fetchData();
    } catch(err: any) { alert(err.message); }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await API.request(`/api/admin/users/${editingUser.id}`, { 
        method: 'PUT', 
        body: JSON.stringify(editingUser) 
      });
      setEditingUser(null);
      fetchData();
    } catch(err: any) { alert(err.message); }
  };

  const handleDeleteUser = async (id: number) => {
    if(!window.confirm('Nutzer unwiderruflich löschen?')) return;
    try {
      await API.request(`/api/admin/users/${id}`, { method: 'DELETE' });
      fetchData();
    } catch(err: any) { alert(err.message); }
  };

  if (loading) return null;

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Nutzerverwaltung</h1>
        <p className="mt-2 text-slate-500 font-medium">Verwalten Sie Zugangsberechtigungen und Zuweisungen im System.</p>
      </header>

      <div className="max-w-4xl">
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-6 flex items-center gap-2">
            <Users className="text-[#C8B568]" /> Accounts
          </h2>
          
          {editingUser ? (
            <form onSubmit={handleUpdateUser} className="bg-[#fdfaf2]  p-6 rounded-2xl mb-6 border border-[#ebdca8]">
               <h3 className="font-bold text-[#5a502f] mb-4 flex items-center justify-between">
                 <span>Nutzer bearbeiten ({editingUser.username})</span>
                 <button type="button" onClick={() => setEditingUser(null)} className="text-xs text-[#C8B568] hover:text-[#7a6d40]">Abbrechen</button>
               </h3>
               <div className="grid grid-cols-2 gap-4">
                  <input type="text" required placeholder="Username" className="col-span-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#C8B568] text-sm font-medium" 
                    value={editingUser.username} onChange={e => setEditingUser({...editingUser, username: e.target.value})}/>
                  
                  <select className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#C8B568] text-sm font-medium"
                    value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value})}>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                  <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 opacity-90 text-sm overflow-y-auto max-h-32">
                    <div className="font-semibold text-slate-700 mb-2">Gesellschaften ({companies.length})</div>
                    {companies.map(c => (
                      <label key={c.id} className="flex gap-2 items-center mb-1 cursor-pointer">
                        <input type="checkbox" className="accent-[#C8B568]" 
                          disabled={editingUser.role === 'admin'}
                          checked={editingUser.company_ids?.includes(c.id.toString())}
                          onChange={(e) => {
                            const ids = e.target.checked 
                              ? [...(editingUser.company_ids||[]), c.id.toString()]
                              : (editingUser.company_ids||[]).filter((x:any) => x !== c.id.toString());
                            setEditingUser({...editingUser, company_ids: ids});
                          }}
                        />
                        <span className="truncate">{c.name}</span>
                      </label>
                    ))}
                  </div>
                  <button type="submit" className="col-span-2 bg-[#C8B568] text-white px-5 py-3 rounded-xl font-bold hover:bg-[#b9a557] transition-colors text-sm">
                    Speichern
                  </button>
               </div>
            </form>
          ) : (
              <form onSubmit={handleCreateUser} className="grid grid-cols-2 gap-4 mb-6">
                <input type="text" required placeholder="Username" className="col-span-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#C8B568] text-sm font-medium" 
                  value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})}/>
                
                <select className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#C8B568] text-sm font-medium"
                value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 opacity-90 text-sm overflow-y-auto max-h-32">
                <div className="font-semibold text-slate-700 mb-2">Zuweisung</div>
                {companies.map(c => (
                  <label key={c.id} className="flex gap-2 items-center mb-1 cursor-pointer">
                    <input type="checkbox" className="accent-[#C8B568]" 
                      disabled={newUser.role === 'admin'}
                      checked={newUser.company_ids?.includes(c.id.toString())}
                      onChange={(e) => {
                        const ids = e.target.checked 
                          ? [...(newUser.company_ids||[]), c.id.toString()]
                          : (newUser.company_ids||[]).filter((x:any) => x !== c.id.toString());
                        setNewUser({...newUser, company_ids: ids});
                      }}
                    />
                    <span className="truncate">{c.name}</span>
                  </label>
                ))}
              </div>
              <button type="submit" className="col-span-2 bg-slate-900 text-white px-5 py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors text-sm flex items-center justify-center gap-2">
                 <UserPlus size={18} /> Nutzer anlegen
              </button>
            </form>
          )}


          <div className="flex-1 overflow-y-auto min-h-[16rem] max-h-[400px] border border-slate-100 rounded-xl bg-slate-50/50">
            <ul className="divide-y divide-slate-100">
              {users.map(u => (
                <li key={u.id} className="px-5 py-3.5 flex justify-between group">
                  <div className="flex flex-col gap-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{u.username}</span>
                      {u.role === 'admin' ? 
                        <span className="px-2.5 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-bold tracking-widest uppercase">Admin</span> :
                        <span className="px-2.5 py-0.5 bg-slate-200 text-slate-600 rounded-full text-[10px] font-bold tracking-widest uppercase">User</span>
                      }
                    </div>
                    {u.companies && u.companies.length > 0 && <div className="text-xs font-medium text-slate-400 flex items-start gap-1 mt-1"><Building2 size={12} className="shrink-0 mt-0.5"/> <div>{u.companies.map((c:any) => c.name).join(', ')}</div></div>}
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => setEditingUser({...u, company_ids: u.companies ? u.companies.map((c:any) => c.id.toString()) : []})} className="text-xs font-semibold text-[#C8B568] bg-[#fdfaf2]  px-3 py-1.5 rounded-lg hover:bg-[#f8eed1]">Bearbeiten</button>
                     <button onClick={() => handleDeleteUser(u.id)} className="text-xs font-semibold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100">Löschen</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminCompanyManagement() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [editingCompany, setEditingCompany] = useState<any>(null);

  const fetchData = async () => {
    try {
      const cRes = await API.request('/api/admin/companies');
      setCompanies(cRes.companies);
    } catch (err) {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await API.request('/api/admin/companies', { method: 'POST', body: JSON.stringify({ name: newCompanyName }) });
      setNewCompanyName('');
      fetchData();
    } catch(err) { alert(err); }
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await API.request(`/api/admin/companies/${editingCompany.id}`, { method: 'PUT', body: JSON.stringify({ name: editingCompany.name }) });
      setEditingCompany(null);
      fetchData();
    } catch(err) { alert(err); }
  };

  const handleDeleteCompany = async (id: number) => {
    if(!window.confirm('Gesellschaft unwiderruflich löschen?')) return;
    try {
      await API.request(`/api/admin/companies/${id}`, { method: 'DELETE' });
      fetchData();
    } catch(err) { alert(err); }
  };

  if (loading) return null;

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Gesellschaftenverwaltung</h1>
        <p className="mt-2 text-slate-500 font-medium">Verwalten Sie die Struktur der Gesellschaften im System.</p>
      </header>

      <div className="max-w-4xl">
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-6 flex items-center gap-2">
            <Building2 className="text-[#C8B568]" /> Gesellschaften
          </h2>
          {editingCompany ? (
            <form onSubmit={handleUpdateCompany} className="flex gap-3 mb-6">
              <input 
                type="text" required placeholder="Gesellschaft bearbeiten" 
                className="flex-1 bg-slate-50 border border-[#ebdca8] rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#C8B568] focus:bg-white transition-all text-sm font-medium"
                value={editingCompany.name} onChange={e => setEditingCompany({...editingCompany, name: e.target.value})}
              />
              <button type="submit" className="bg-[#C8B568] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#b9a557] transition-colors text-sm shadow-sm">
                Speichern
              </button>
              <button type="button" onClick={() => setEditingCompany(null)} className="text-xs text-[#C8B568] hover:text-[#7a6d40] px-2">Abbrechen</button>
            </form>
          ) : (
            <form onSubmit={handleCreateCompany} className="flex gap-3 mb-6">
              <input 
                type="text" required placeholder="Neue Gesellschaft" 
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#C8B568] focus:bg-white transition-all text-sm font-medium"
                value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)}
              />
              <button type="submit" className="bg-[#C8B568] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#b9a557] transition-colors text-sm shadow-sm">
                Hinzufügen
              </button>
            </form>
          )}
          <div className="flex-1 overflow-y-auto min-h-[16rem] max-h-[500px] border border-slate-100 rounded-xl bg-slate-50/50">
            <ul className="divide-y divide-slate-100">
              {companies.map(c => (
                <li key={c.id} className="px-5 py-3.5 flex justify-between items-center group">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">{c.name}</span>
                    <span className="px-2 py-0.5 bg-[#fdfaf2] text-[#C8B568] rounded text-xs">ID: {c.id}</span>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => setEditingCompany(c)} className="text-xs font-semibold text-[#C8B568] bg-[#fdfaf2] px-3 py-1.5 rounded-lg hover:bg-[#f8eed1]">Bearbeiten</button>
                     <button onClick={() => handleDeleteCompany(c.id)} className="text-xs font-semibold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100">Löschen</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsDashboard({ user }: { user: any }) {
  const [data, setData] = useState<{ monthly: any[], initial: any[] }>({ monthly: [], initial: [] });
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [companyId, setCompanyId] = useState('all');
  const [companies, setCompanies] = useState<any[]>([]);

  useEffect(() => {
    if (user.role === 'admin') {
      API.request('/api/admin/companies').then(res => setCompanies(res.companies));
    }
  }, [user.role]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ year: year.toString() });
    if (user.role === 'admin' && companyId !== 'all') params.append('company_id', companyId);
    
    API.request(`/api/query?${params.toString()}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [year, companyId, user.role]);

  const totalInitial = data.initial.reduce((sum, i) => sum + i.amount, 0);
  const totalMonthly = data.monthly.reduce((sum, m) => sum + m.amount, 0);

  // Transform data for chart: sum by month and calculate cumulative
  let runningTotal = totalInitial;
  const chartData = [1,2,3,4,5,6,7,8,9,10,11,12].map(month => {
    const monthlyTotal = data.monthly.filter(m => m.month === month).reduce((sum, m) => sum + m.amount, 0);
    const initialPart = month === 1 ? totalInitial : 0;
    
    runningTotal += monthlyTotal;
    
    return { 
      name: ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'][month-1], 
      monthly: monthlyTotal,
      initial: initialPart,
      cumulative: runningTotal
    };
  });

  // Add Endbestand at the far right as a single block
  chartData.push({
    name: 'Endbestand',
    initial: 0,
    monthly: 0,
    endbestand: runningTotal,
    cumulative: runningTotal
  });

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Data Analytics</h1>
          <p className="mt-2 text-slate-500 font-medium">Wertentwicklungen und Auftragsvolumina im Detail.</p>
        </div>
        <div className="flex items-center gap-3">
          {user.role === 'admin' ? (
             <select 
              className="bg-white border-none shadow-sm rounded-xl py-3 px-5 text-sm font-bold text-slate-700 ring-1 ring-slate-200 focus:ring-2 focus:ring-[#C8B568] outline-none"
              value={companyId} onChange={e => setCompanyId(e.target.value)}
             >
               <option value="all">Alle Gesellschaften</option>
               {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
             </select>
          ) : user.companies && user.companies.length > 1 ? (
             <select 
              className="bg-white border-none shadow-sm rounded-xl py-3 px-5 text-sm font-bold text-slate-700 ring-1 ring-slate-200 focus:ring-2 focus:ring-[#C8B568] outline-none"
              value={companyId} onChange={e => setCompanyId(e.target.value)}
             >
               <option value="all">Alle (Kombiniert)</option>
               {user.companies.map((c:any) => <option key={c.id} value={c.id}>{c.name}</option>)}
             </select>
          ) : null}
          <select 
            className="bg-[#C8B568] border-none shadow-sm shadow-[#C8B568]/30 rounded-xl py-3 px-5 text-sm font-bold text-white outline-none cursor-pointer hover:bg-[#b9a557] transition-colors"
            value={year} onChange={e => setYear(parseInt(e.target.value))}
          >
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col group">
          <div className="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-3">Gesamt Jahr {year}</div>
          <div className="text-4xl font-black text-slate-900 break-words group-hover:scale-105 transform origin-left transition-transform duration-300">
            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(totalMonthly + totalInitial)}
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col">
          <div className="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-3">Aus Monatsmeldungen</div>
          <div className="text-3xl font-black text-[#C8B568] tracking-tight">
            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(totalMonthly)}
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col">
          <div className="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-3">Aus Auftragsbestand</div>
          <div className="text-3xl font-black text-[#b9a557] tracking-tight">
            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(totalInitial)}
          </div>
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur-xl p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative">
        <h3 className="text-xl font-bold tracking-tight text-slate-900 mb-8">Volumenverlauf (Monatsmeldungen)</h3>
        {loading ? (
          <div className="h-80 flex items-center justify-center">Lade Diagramm...</div>
        ) : (
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13, fontWeight: 600}} dy={15}/>
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13}} dx={-10} 
                  tickFormatter={(val) => new Intl.NumberFormat('de-DE', { notation: "compact", compactDisplay: "short" }).format(val)} />
                <Tooltip 
                  cursor={{fill: '#f1f5f9'}} 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                  formatter={(value: number, name: string) => {
                    if (value === 0) return [null, null];
                    return [new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value), name];
                  }}
                />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />
                <Bar name="Auftragsbestand" dataKey="initial" stackId="a" fill="#1e293b" radius={[0, 0, 0, 0]} maxBarSize={60} />
                <Bar name="Monatswert" dataKey="monthly" stackId="a" fill="url(#colorIndigo)" radius={[6, 6, 0, 0]} maxBarSize={60} />
                <Bar name="Endbestand" dataKey="endbestand" stackId="a" fill="#1d4ed8" radius={[6, 6, 0, 0]} maxBarSize={60} />
                <defs>
                  <linearGradient id="colorIndigo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C8B568" stopOpacity={0.9}/>
                    <stop offset="100%" stopColor="#b9a557" stopOpacity={0.7}/>
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white/90 backdrop-blur-xl p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative">
        <h3 className="text-xl font-bold tracking-tight text-slate-900 mb-8">Kumulierter Volumenverlauf (inkl. Auftragsbestand)</h3>
        {loading ? (
          <div className="h-80 flex items-center justify-center">Lade Diagramm...</div>
        ) : (
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13, fontWeight: 600}} dy={15}/>
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13}} dx={-10} 
                  tickFormatter={(val) => new Intl.NumberFormat('de-DE', { notation: "compact", compactDisplay: "short" }).format(val)} />
                <Tooltip 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                  formatter={(value: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)}
                />
                <Area type="monotone" dataKey="cumulative" name="Kumulierter Wert" stroke="#C8B568" strokeWidth={3} fill="url(#colorCumulative)" />
                <defs>
                  <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C8B568" stopOpacity={0.4}/>
                    <stop offset="100%" stopColor="#C8B568" stopOpacity={0}/>
                  </linearGradient>
                </defs>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// User Views (Reporting & Backlog updated with Premium Design)
function UserReporting({ user }: { user: any }) {
  const [amount, setAmount] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [companyId, setCompanyId] = useState(user.companies?.[0]?.id || user.company_id || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return alert("Bitte wähle zuerst eine Gesellschaft aus.");
    setLoading(true);
    try {
      await API.request('/api/orders/monthly', { method: 'POST', body: JSON.stringify({ amount: parseFloat(amount), month, year, company_id: parseInt(companyId) }) });
      alert('Erfolgreich gespeichert!');
      setAmount('');
    } catch(err: any) { alert(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-10 max-w-4xl mx-auto">
      <header className="text-center md:text-left">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Monatlicher Auftragszugang</h1>
        <p className="mt-3 text-slate-500 font-medium text-lg">Erfassen Sie die neu eingegangenen Aufträge.</p>
      </header>

      <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-10 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#C8B568] to-[#b9a557]"></div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="block text-sm font-bold text-slate-700 uppercase tracking-widest pl-1">Monat & Jahr</label>
              <div className="flex gap-3">
                <select className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl py-4 px-4 focus:ring-2 focus:ring-[#C8B568] outline-none font-bold text-slate-700 text-lg shadow-inner"
                  value={month} onChange={(e) => setMonth(parseInt(e.target.value))}>
                  {['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'].map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <select className="w-32 bg-slate-50 border border-slate-200 rounded-2xl py-4 px-4 focus:ring-2 focus:ring-[#C8B568] outline-none font-bold text-slate-700 text-lg shadow-inner"
                  value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
                  {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {user.companies && user.companies.length > 1 && (
            <div className="space-y-3 col-span-1 md:col-span-2">
              <label className="block text-sm font-bold text-slate-700 uppercase tracking-widest pl-1">Gesellschaft</label>
              <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-4 focus:ring-2 focus:ring-[#C8B568] outline-none font-bold text-slate-700 text-lg shadow-inner"
                value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                {user.companies.map((c:any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            )}

            <div className="space-y-3 col-span-1 md:col-span-2">
              <label className="block text-sm font-bold text-slate-700 uppercase tracking-widest pl-1">Wert (Netto EUR)</label>
              <div className="relative">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-lg">€</span>
                <input type="number" step="0.01" required placeholder="0,00"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-6 focus:ring-2 focus:ring-[#C8B568] outline-none font-black text-slate-900 text-xl shadow-inner transition-shadow placeholder:font-normal"
                  value={amount} onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-[#C8B568] to-[#b9a557] text-white font-extrabold py-5 px-8 rounded-2xl hover:from-[#b9a557] hover:to-[#9e8b45] transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0 text-lg flex items-center justify-center gap-3">
            <Send size={24} /> Datensatz verbindlich melden
          </button>
        </form>
      </div>
    </div>
  );
}

function UserBacklog({ user }: { user: any }) {
  const [amount, setAmount] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [companyId, setCompanyId] = useState(user.companies?.[0]?.id || user.company_id || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return alert("Bitte wähle zuerst eine Gesellschaft aus.");
    setLoading(true);
    try {
      await API.request('/api/orders/initial', { method: 'POST', body: JSON.stringify({ amount: parseFloat(amount), year, company_id: parseInt(companyId) }) });
      alert('Auftragsbestand erfolgreich gespeichert!');
      setAmount('');
    } catch(err: any) { alert(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-10 max-w-4xl mx-auto">
      <header className="text-center md:text-left">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Auftragsbestand</h1>
        <p className="mt-3 text-slate-500 font-medium text-lg">Einmalige Erfassung zum Jahresstart.</p>
      </header>

      <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-10">
        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-8">
            <div className="space-y-3">
              <label className="block text-sm font-bold text-slate-700 uppercase tracking-widest pl-1">Jahresauswahl</label>
              <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-4 focus:ring-2 focus:ring-[#C8B568] outline-none font-bold text-slate-700 text-lg shadow-inner"
                value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            
            {user.companies && user.companies.length > 1 && (
            <div className="space-y-3">
              <label className="block text-sm font-bold text-slate-700 uppercase tracking-widest pl-1">Gesellschaft</label>
              <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-4 focus:ring-2 focus:ring-[#C8B568] outline-none font-bold text-slate-700 text-lg shadow-inner"
                value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                {user.companies.map((c:any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            )}
            
            <div className="space-y-3 md:col-span-2">
              <label className="block text-sm font-bold text-slate-700 uppercase tracking-widest pl-1">Bestandssumme</label>
              <div className="relative">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-lg">€</span>
                <input type="number" step="0.01" required placeholder="0,00"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-6 focus:ring-2 focus:ring-[#C8B568] outline-none font-black text-slate-900 text-xl shadow-inner transition-shadow placeholder:font-normal"
                  value={amount} onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-slate-900 text-white font-extrabold py-5 px-8 rounded-2xl hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0 text-lg">
            Sichern und Bestätigen
          </button>
        </form>
      </div>
    </div>
  );
}

// --- Admin Login Page ---

function AdminLoginPage({ onLogin }: { onLogin: (user: any) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await API.request('/api/admin-login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      onLogin(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4" style={{ background: 'radial-gradient(ellipse at 60% 20%, #1e293b 0%, #0f172a 70%)' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="text-white text-6xl font-black italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-[#f3d38c] via-[#C8B568] to-[#947e3a]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            ARE
          </div>
          <div className="text-white/50 text-xs tracking-[0.4em] font-bold mt-1 uppercase">Beteiligungen · Admin</div>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#C8B568]/20 flex items-center justify-center">
              <Lock size={20} className="text-[#C8B568]" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">Admin-Anmeldung</h1>
              <p className="text-slate-400 text-sm">Zugang nur für Administratoren</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Benutzername</label>
              <input
                id="admin-username"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-[#C8B568]/60 focus:bg-white/8 transition-all"
                placeholder="admin"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Passwort</label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 pr-12 text-white placeholder:text-slate-600 focus:outline-none focus:border-[#C8B568]/60 focus:bg-white/8 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <AlertCircle size={16} className="text-red-400 shrink-0" />
                <span className="text-red-300 text-sm font-medium">{error}</span>
              </div>
            )}

            <button
              id="admin-login-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#C8B568] to-[#b9a557] text-white font-bold py-3.5 rounded-xl hover:from-[#d4c07a] hover:to-[#C8B568] transition-all shadow-lg shadow-[#C8B568]/20 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Anmelden...' : 'Anmelden'}
            </button>
          </form>

          <p className="text-center text-slate-600 text-xs mt-6">
            Mitarbeiter melden sich automatisch über Windows-Authentifizierung an.
          </p>
        </div>
      </div>
    </div>
  );
}

// --- Root App ---

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [ssoFailed, setSsoFailed] = useState(false);

  useEffect(() => {
    API.request('/api/me')
      .then(data => setUser(data.user))
      .catch(err => {
        // If SSO header is missing, show admin login page instead of generic error
        if (err.message && err.message.toLowerCase().includes('sso header missing')) {
          setSsoFailed(true);
        } else {
          setSsoFailed(true); // Show login page for any auth failure
        }
      })
      .finally(() => setReady(true));
  }, []);

  const handleAdminLogin = (loggedInUser: any) => {
    setUser(loggedInUser);
    setSsoFailed(false);
  };

  const handleLogout = async () => {
    if (user?.role === 'admin') {
      // Admin: clear the JWT cookie
      try { await API.request('/api/admin-logout', { method: 'POST' }); } catch(e) {}
    }
    setUser(null);
    setSsoFailed(false);
    // Re-check SSO
    API.request('/api/me')
      .then(data => setUser(data.user))
      .catch(() => setSsoFailed(true))
      .finally(() => setReady(true));
  };

  if (!ready) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-pulse flex gap-2"><div className="w-4 h-4 bg-[#C8B568] rounded-full"></div><div className="w-4 h-4 bg-blue-500 rounded-full"></div></div></div>;

  // Show admin login when SSO is not available
  if (ssoFailed && !user) return <AdminLoginPage onLogin={handleAdminLogin} />;

  if (!user) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-red-100">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Zugriff verweigert</h1>
        <p className="text-slate-600 font-medium">Ihr Account ist nicht berechtigt.</p>
        <p className="text-sm text-slate-400 mt-6">Bitte wenden Sie sich an die IT, falls dies ein Fehler ist.</p>
      </div>
    </div>
  );

  return (
    <Router>
      <Layout user={user} onLogout={handleLogout}>
        <Routes>
          {user.role === 'admin' ? (
            <>
              <Route path="/admin" element={<AdminOverview />} />
              <Route path="/analytics" element={<AnalyticsDashboard user={user} />} />
              <Route path="/users" element={<AdminUserManagement />} />
              <Route path="/companies" element={<AdminCompanyManagement />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </>
          ) : (
            <>
              <Route path="/reporting" element={<UserReporting user={user} />} />
              <Route path="/backlog" element={<UserBacklog user={user} />} />
              <Route path="/analytics" element={<AnalyticsDashboard user={user} />} />
              <Route path="*" element={<Navigate to="/reporting" replace />} />
            </>
          )}
        </Routes>
      </Layout>
    </Router>
  );
}
