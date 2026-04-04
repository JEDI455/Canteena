import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Admin() {
  const [profiles, setProfiles] = useState([]);
  const [matches, setMatches] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // New Match Form State
  const [newMatch, setNewMatch] = useState({
    title: '',
    teamA: '',
    teamB: '',
    teamAOdds: 50,
    teamBOdds: 50,
    category: 'other',
    endDate: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // Fetch Profiles
      const { data: profs, error: profsError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (profsError) throw profsError;
      setProfiles(profs || []);

      // Fetch Matches
      const { data: mats, error: matsError } = await supabase
        .from('matches')
        .select('*')
        .order('created_at', { ascending: false });

      if (matsError) throw matsError;
      setMatches(mats || []);

      // Fetch Predictions
      const { data: preds, error: predsError } = await supabase
        .from('predictions')
        .select('*, profiles(email), matches(title)')
        .order('created_at', { ascending: false });
        
      if (predsError) console.error(predsError);
      setPredictions(preds || []);

    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load data. Make sure the database tables are created. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMatch = async (e) => {
    e.preventDefault();
    if (newMatch.teamAOdds + newMatch.teamBOdds !== 100) {
      alert('Odds must sum to 100%');
      return;
    }
    
    if (!newMatch.endDate) {
      alert('Please select an end date.');
      return;
    }

    try {
      const { error } = await supabase.from('matches').insert([
        {
          title: newMatch.title,
          team_a: newMatch.teamA,
          team_b: newMatch.teamB,
          team_a_odds_percent: newMatch.teamAOdds,
          team_b_odds_percent: newMatch.teamBOdds,
          status: 'open',
          category: newMatch.category,
          end_date: new Date(newMatch.endDate).toISOString()
        }
      ]);

      if (error) throw error;
      setNewMatch({ title: '', teamA: '', teamB: '', teamAOdds: 50, teamBOdds: 50, category: 'other', endDate: '' });
      fetchData(); // Refresh list
    } catch (err) {
      alert('Error creating match: ' + err.message);
    }
  };

  const handleAddFunds = async (profileId, currentBalance) => {
    const amountStr = prompt('Enter amount to add:');
    if (!amountStr) return;
    
    const amount = Number(amountStr);
    if (isNaN(amount) || amount <= 0) return alert('Invalid amount');

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ balance: Number(currentBalance) + amount })
        .eq('id', profileId);
        
      if (error) throw error;

      // Log transaction
      await supabase.from('transactions').insert([{
        user_id: profileId,
        amount: amount,
        type: 'admin_adjustment',
        description: 'Admin added funds manually'
      }]);

      fetchData();
    } catch (err) {
      alert('Error adding funds: ' + err.message);
    }
  };

  const handleResolveMatch = async (matchId, winner) => {
    if (!confirm(`Are you sure you want to resolve this match with ${winner} as winner?`)) return;

    try {
      // 1. Update match status
      const { error: matchError } = await supabase
        .from('matches')
        .update({ status: 'resolved', winner })
        .eq('id', matchId);
      if (matchError) throw matchError;

      // 2. Fetch predictions
      const { data: predictions, error: predsError } = await supabase
        .from('predictions')
        .select('*')
        .eq('match_id', matchId)
        .eq('status', 'pending');
      if (predsError) throw predsError;

      // 3. Process each prediction
      if (predictions && predictions.length > 0) {
        for (const p of predictions) {
          const isWinner = p.predicted_team === winner;
          
          await supabase.from('predictions').update({
            status: isWinner ? 'won' : 'lost'
          }).eq('id', p.id);

          if (isWinner) {
            const { data: userProfile } = await supabase.from('profiles').select('balance').eq('id', p.user_id).single();
            if (userProfile) {
              await supabase.from('profiles').update({
                balance: Number(userProfile.balance) + Number(p.expected_payout)
              }).eq('id', p.user_id);
              
              // Log payout transaction
              await supabase.from('transactions').insert([{
                user_id: p.user_id,
                amount: Number(p.expected_payout),
                type: 'payout',
                description: `Payout for winning bet`
              }]);
            }
          }
        }
      }

      fetchData();
    } catch (err) {
      alert('Error resolving match: ' + err.message);
    }
  };

  if (loading) return <div className="container" style={{ paddingTop: '2rem' }}>Loading Admin Panel...</div>;

  return (
    <div className="container" style={{ paddingBottom: '4rem' }}>
      <h1 style={{ marginTop: '2rem' }}>Admin Dashboard</h1>
      {errorMsg && (
        <div style={{ backgroundColor: 'var(--accent-no-bg)', color: 'var(--accent-no)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '2rem' }}>
          {errorMsg}
        </div>
      )}

      {/* MATCHES SECTION */}
      <h2 style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', marginTop: '2rem' }}>Manage Matches</h2>
      
      <div className="market-card" style={{ marginBottom: '2rem' }}>
        <h3 className="font-semibold" style={{ marginBottom: '1rem' }}>Create New Match</h3>
        <form onSubmit={handleCreateMatch} className="flex flex-col gap-4">
          <div className="form-group">
            <label className="form-label">Match Title (e.g. IEM Katowice Final)</label>
            <input type="text" className="form-input" required value={newMatch.title} onChange={e => setNewMatch({...newMatch, title: e.target.value})} />
          </div>
          
          <div className="flex gap-4" style={{ alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Team A Name</label>
              <input type="text" className="form-input" required value={newMatch.teamA} onChange={e => setNewMatch({...newMatch, teamA: e.target.value})} />
            </div>
            <div className="form-group" style={{ width: '100px', marginBottom: 0 }}>
              <label className="form-label">Odds (%)</label>
              <input type="number" min="1" max="99" className="form-input" required value={newMatch.teamAOdds} onChange={e => setNewMatch({...newMatch, teamAOdds: Number(e.target.value)})} />
            </div>
          </div>

          <div className="flex gap-4" style={{ alignItems: 'flex-end', marginTop: '0.5rem' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Team B Name</label>
              <input type="text" className="form-input" required value={newMatch.teamB} onChange={e => setNewMatch({...newMatch, teamB: e.target.value})} />
            </div>
            <div className="form-group" style={{ width: '100px', marginBottom: 0 }}>
              <label className="form-label">Odds (%)</label>
              <input type="number" min="1" max="99" className="form-input" required value={newMatch.teamBOdds} onChange={e => setNewMatch({...newMatch, teamBOdds: Number(e.target.value)})} />
            </div>
          </div>

          <div className="flex gap-4" style={{ alignItems: 'flex-end', marginTop: '0.5rem' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Category</label>
              <select className="form-input" value={newMatch.category} onChange={e => setNewMatch({...newMatch, category: e.target.value})}>
                <option value="politics">Politics</option>
                <option value="economics">Economics</option>
                <option value="sport">Sport</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">End Date & Time</label>
              <input type="datetime-local" className="form-input" required value={newMatch.endDate} onChange={e => setNewMatch({...newMatch, endDate: e.target.value})} />
            </div>
          </div>
          
          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }}>Create Match</button>
        </form>
      </div>

      <div style={{ overflowX: 'auto', marginBottom: '3rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Title & Category</th>
              <th>Teams & Odds</th>
              <th>Status & Ends</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {matches.map(m => {
              const isExpired = m.status === 'open' && new Date(m.end_date) < new Date();
              return (
              <tr key={m.id} style={{ backgroundColor: isExpired ? 'rgba(239, 68, 68, 0.1)' : 'transparent' }}>
                <td>
                  <div className="font-semibold">{m.title}</div>
                  <div className="text-muted text-xs" style={{ textTransform: 'capitalize' }}>{m.category}</div>
                </td>
                <td>
                  <span className="text-muted">{m.team_a}</span> <span className="text-accent">{m.team_a_odds_percent}%</span> <br/>
                  <span className="text-muted">{m.team_b}</span> <span className="text-accent">{m.team_b_odds_percent}%</span>
                </td>
                <td>
                  <div style={{ marginBottom: '0.25rem' }}>
                    <span className={`badge ${m.status === 'open' ? 'badge-open' : 'badge-resolved'}`}>{m.status}</span>
                  </div>
                  {m.end_date && (
                    <div className={isExpired ? 'text-no text-xs font-bold' : 'text-muted text-xs'}>
                      {isExpired ? 'Expired: Needs Resolution' : `Ends: ${new Date(m.end_date).toLocaleDateString()}`}
                    </div>
                  )}
                </td>
                <td>
                  {m.status === 'open' && (
                    <div className="flex gap-2">
                      <button className="btn btn-outline text-xs" onClick={() => handleResolveMatch(m.id, 'team_a')}>{m.team_a} Won</button>
                      <button className="btn btn-outline text-xs" onClick={() => handleResolveMatch(m.id, 'team_b')}>{m.team_b} Won</button>
                    </div>
                  )}
                  {m.status === 'resolved' && (
                    <span className="text-muted">Winner: {m.winner === 'team_a' ? m.team_a : m.team_b}</span>
                  )}
                </td>
              </tr>
              );
            })}
            {matches.length === 0 && (
              <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No matches available</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PREDICTIONS SECTION */}
      <h2 style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', marginTop: '2rem' }}>All User Predictions</h2>
      <div style={{ overflowX: 'auto', marginBottom: '3rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Match</th>
              <th>Prediction</th>
              <th>Wager / Payout</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {predictions.map(p => (
              <tr key={p.id}>
                <td>{p.profiles?.email || 'Unknown User'}</td>
                <td className="font-semibold">{p.matches?.title || 'Unknown Match'}</td>
                <td>{p.predicted_team}</td>
                <td>
                  <span className="text-muted">${Number(p.wager_amount).toFixed(2)}</span> / <span className="text-accent">${Number(p.expected_payout).toFixed(2)}</span>
                </td>
                <td>
                  <span 
                    className="badge" 
                    style={{
                      backgroundColor: p.status === 'pending' ? 'rgba(100, 116, 139, 0.2)' : p.status === 'won' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: p.status === 'pending' ? '#94a3b8' : p.status === 'won' ? 'var(--accent-yes)' : 'var(--accent-no)',
                      border: `1px solid ${p.status === 'pending' ? '#475569' : p.status === 'won' ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`,
                      textTransform: 'capitalize'
                    }}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="text-muted text-xs">{new Date(p.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {predictions.length === 0 && (
              <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No predictions available</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* USERS SECTION */}
      <h2 style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>Manage Users</h2>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Balance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map(p => (
              <tr key={p.id}>
                <td>{p.email}</td>
                <td>{p.role}</td>
                <td className="font-semibold text-accent">${Number(p.balance).toFixed(2)}</td>
                <td>
                  <button className="btn btn-outline text-xs" onClick={() => handleAddFunds(p.id, p.balance)}>+ Add Funds</button>
                </td>
              </tr>
            ))}
            {profiles.length === 0 && (
              <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No profiles available</td></tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
