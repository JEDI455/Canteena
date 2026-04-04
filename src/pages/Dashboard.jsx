import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useOutletContext } from 'react-router-dom';

export default function Dashboard() {
  const { session, profile } = useOutletContext();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Betting modal state
  const [betState, setBetState] = useState(null);
  const [wagerAmount, setWagerAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (error && error.code !== '42P01') { 
        console.error(error);
      }
      setMatches(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openBetModal = (matchId, teamKey, teamName, odds) => {
    if (!session) {
      alert("Please log in to make a prediction.");
      return;
    }
    setBetState({ matchId, teamKey, teamName, odds });
    setWagerAmount('');
  };

  const handleBetSubmit = async (e) => {
    e.preventDefault();
    if (!betState || isSubmitting) return;

    const amount = Number(wagerAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid wager amount.");
      return;
    }
    if (profile.balance < amount) {
      alert("Insufficient balance.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payout = amount / (betState.odds / 100);
      
      const { error: predError } = await supabase.from('predictions').insert({
        user_id: session.user.id,
        match_id: betState.matchId,
        predicted_team: betState.teamKey,
        wager_amount: amount,
        expected_payout: payout
      });
      if (predError) throw predError;

      alert("Prediction placed!");
      window.location.reload(); 
    } catch (err) {
      console.error(err);
      alert('Error placing prediction: ' + err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ paddingBottom: '4rem', position: 'relative' }}>
      
      <div style={{ padding: '3rem 0', display: 'flex', flexDirection: 'column', gap: '1rem', borderBottom: '1px solid var(--border-light)' }}>
        <h1 style={{ fontSize: '3rem', letterSpacing: '-1px', margin: 0 }}>Markets</h1>
        <p className="text-muted" style={{ fontSize: '1.2rem', maxWidth: '600px' }}>
          Trade on the outcome of global events, matches, and markets. Predict winners and compete on the global leaderboard.
        </p>
      </div>

      {loading ? (
        <div style={{ marginTop: '2rem' }}>Loading markets...</div>
      ) : (
        <div className="market-grid">
          {matches.map(m => {
            const isExpired = m.status === 'open' && new Date(m.end_date) < new Date();
            let icon = '🎲';
            if (m.category === 'politics') icon = '🏛️';
            if (m.category === 'economics') icon = '📈';
            if (m.category === 'sport') icon = '⚽';

            return (
            <div className="market-card" key={m.id} style={{ opacity: isExpired ? 0.7 : 1 }}>
              <div className="market-header" style={{ justifyContent: 'space-between' }}>
                <div className="market-icon">{icon}</div>
                {m.end_date && (
                  <div style={{ fontSize: '0.75rem', color: isExpired ? 'var(--accent-no)' : 'var(--text-muted)' }}>
                     {isExpired ? 'Market Closed' : `Ends: ${new Date(m.end_date).toLocaleDateString()}`}
                  </div>
                )}
              </div>

              <div className="market-title">
                <div style={{ fontSize: '1.15rem', color: 'var(--text-main)', marginBottom: '0.4rem' }}>{m.title}</div>
                <div className="text-muted" style={{ fontWeight: 400, fontSize: '0.9rem' }}>{m.team_a} vs {m.team_b}</div>
              </div>

              <div className="flex gap-2" style={{ marginTop: 'auto' }}>
                <button 
                  className="btn btn-yes flex-col" 
                  style={{ gap: '0.25rem', paddingTop: '0.75rem', paddingBottom: '0.75rem' }}
                  onClick={() => openBetModal(m.id, 'team_a', m.team_a, m.team_a_odds_percent)}
                  disabled={isExpired}
                >
                  <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>{m.team_a}</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{m.team_a_odds_percent}%</span>
                </button>
                <button 
                  className="btn btn-no flex-col" 
                  style={{ gap: '0.25rem', paddingTop: '0.75rem', paddingBottom: '0.75rem' }}
                  onClick={() => openBetModal(m.id, 'team_b', m.team_b, m.team_b_odds_percent)}
                  disabled={isExpired}
                >
                  <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>{m.team_b}</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{m.team_b_odds_percent}%</span>
                </button>
              </div>
            </div>
          )})}
          
          {matches.length === 0 && !loading && (
            <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', border: '1px dashed var(--border-light)', borderRadius: 'var(--radius-md)' }}>
              <h3>No active markets</h3>
              <p className="text-muted">Wait for an admin to create new matches.</p>
            </div>
          )}
        </div>
      )}

      {/* Betting Modal Overlays */}
      {betState && (
        <div style={{ 
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 
        }}>
          <div style={{ 
            background: 'var(--bg-card)', padding: '2rem', borderRadius: 'var(--radius-md)', 
            width: '90%', maxWidth: '400px', border: '1px solid var(--border-light)' 
          }}>
            <h3 style={{ marginTop: 0 }}>Predict: {betState.teamName}</h3>
            <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
              Current Odds: <span className="font-bold text-main">{betState.odds}%</span><br/>
              Your Balance: <span className="font-bold text-accent">${Number(profile?.balance || 0).toFixed(2)}</span>
            </p>
            
            <form onSubmit={handleBetSubmit} className="flex flex-col gap-4">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Wager Amount ($)</label>
                <input 
                  type="number" className="form-input" min="1" max={profile?.balance || 0} step="0.01" required
                  value={wagerAmount} onChange={e => setWagerAmount(e.target.value)}
                  autoFocus
                />
              </div>
              
              <div style={{ padding: '1rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem' }}>
                <div className="flex justify-between" style={{ marginBottom: '0.5rem' }}>
                  <span className="text-muted">Potential Payout:</span>
                  <span className="font-bold text-accent">
                    ${wagerAmount ? (Number(wagerAmount) / (betState.odds / 100)).toFixed(2) : '0.00'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Profit:</span>
                  <span className="font-bold text-yes">
                    +${wagerAmount ? ((Number(wagerAmount) / (betState.odds / 100)) - Number(wagerAmount)).toFixed(2) : '0.00'}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button type="button" className="btn btn-outline flex-1" onClick={() => setBetState(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-1" disabled={isSubmitting}>
                  {isSubmitting ? 'Placing...' : 'Submit Prediction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
