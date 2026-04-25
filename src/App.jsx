import { Routes, Route, Link, useNavigate, Outlet, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Admin from './pages/Admin';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import HouseStats from './pages/HouseStats';

// Layout wrapper to inject the nav bar and pass session down
function Layout({ session, profile, handleLogout }) {
  return (
    <div className="app-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav className="navbar">
        <div className="container nav-content flex items-center justify-between">
          <Link to="/" className="nav-logo flex items-center gap-2">
            <span style={{ color: 'var(--text-main)', fontSize: '1.25rem', fontWeight: 800 }}>Canteena</span>
          </Link>
          
          <div className="nav-links flex items-center gap-4">
            <Link to="/" className="nav-link">Markets</Link>
            <Link to="/leaderboard" className="nav-link">Leaderboard</Link>
            
            {session ? (
              <>
                {profile?.role === 'admin' && (
                  <>
                    <Link to="/admin" className="nav-link" style={{ color: 'var(--accent-yes)' }}>Admin Panel</Link>
                    <Link to="/admin/stats" className="nav-link" style={{ color: 'var(--accent-yes)' }}>House Stats</Link>
                  </>
                )}
                
                <div className="flex items-center gap-4 border-l pl-4" style={{ borderLeft: '1px solid var(--border-light)', paddingLeft: '1.5rem', marginLeft: '0.5rem' }}>
                  <Link to="/profile" className="flex items-center gap-3 text-sm" style={{ textDecoration: 'none', transition: 'opacity 0.2s ease', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'} onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>
                    <span className="text-muted">{session.user.email}</span>
                    <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>
                      <span className="font-bold text-accent">${profile?.balance || '0'}</span>
                    </div>
                  </Link>
                  <button onClick={handleLogout} className="btn btn-outline text-xs" style={{ padding: '0.4rem 0.75rem' }}>Log Out</button>
                </div>
              </>
            ) : (
              <div style={{ paddingLeft: '1.5rem', marginLeft: '0.5rem' }}>
                <Link to="/login" className="btn btn-primary text-sm">Log In</Link>
              </div>
            )}
          </div>
        </div>
      </nav>
      
      <main style={{ flexGrow: 1 }}>
        <Outlet context={{ session, profile }} />
      </main>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
         console.error('Error fetching profile:', error);
      }
      setProfile(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading App...</div>;

  return (
    <Routes>
      <Route element={<Layout session={session} profile={profile} handleLogout={handleLogout} />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/login" element={session ? <Navigate to="/" /> : <Login />} />
        <Route path="/admin" element={
          session && profile?.role === 'admin' ? <Admin /> : <Navigate to="/" />
        } />
        <Route path="/admin/stats" element={
          session && profile?.role === 'admin' ? <HouseStats /> : <Navigate to="/" />
        } />
      </Route>
    </Routes>
  );
}

export default App;
