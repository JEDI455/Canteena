import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useOutletContext, Navigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Profile() {
  const { session, profile } = useOutletContext();
  const [predictions, setPredictions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('bets'); // 'bets' or 'transactions'

  if (!session) {
    return <Navigate to="/login" />;
  }

  useEffect(() => {
    if (session?.user?.id) {
      fetchProfileData();
    }
  }, [session]);

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      // Fetch Predictions with Match data
      const { data: predsData, error: predsErr } = await supabase
        .from('predictions')
        .select('*, matches(*)')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (predsErr) console.error(predsErr);
      else setPredictions(predsData || []);

      // Fetch Transactions
      const { data: transData, error: transErr } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (transErr) console.error(transErr);
      else setTransactions(transData || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const totalBets = predictions.length;
  const wonBets = predictions.filter(p => p.status === 'won').length;
  const lostBets = predictions.filter(p => p.status === 'lost').length;
  const winRate = totalBets > 0 && (wonBets + lostBets) > 0 
    ? ((wonBets / (wonBets + lostBets)) * 100).toFixed(1) 
    : 0;

  const resolvedPredictions = predictions.filter(p => p.status !== 'pending');
  const totalWageredResolved = resolvedPredictions.reduce((sum, p) => sum + Number(p.wager_amount), 0);
  const totalWon = resolvedPredictions.filter(p => p.status === 'won').reduce((sum, p) => sum + Number(p.expected_payout), 0);
  const netProfit = totalWon - totalWageredResolved;
  
  // Total wagered including active could still be shown, but for profit we use resolved only.
  const totalWagered = predictions.reduce((sum, p) => sum + Number(p.wager_amount), 0);

  // Compute balance history data for chart
  // Start from initial +100 bonus, or replay transactions from oldest to newest
  let runningBalance = 0;
  const chartData = [...transactions].reverse().map(t => {
    runningBalance += Number(t.amount);
    return {
      date: new Date(t.created_at).toLocaleDateString(),
      balance: runningBalance,
      amount: Number(t.amount),
      type: t.type
    };
  });

  const handleClaimFunds = async () => {
    if (!profile) return;
    if (profile.balance > 0) {
      alert("You still have funds! Lose them first or bet them to get more free money.");
      return;
    }

    try {
      // Only allowed if balance is <= 0. Let's add 100
      const newBalance = Number(profile.balance) + 100;
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ balance: newBalance })
        .eq('id', profile.id);

      if (updateErr) throw updateErr;

      // Log transaction
      await supabase.from('transactions').insert([{
        user_id: profile.id,
        amount: 100,
        type: 'bonus',
        description: 'Claimed free refill funds'
      }]);

      alert("Successfully claimed $100!");
      fetchProfileData();
    } catch (err) {
      alert("Error claiming funds: " + err.message);
    }
  };

  if (loading) {
    return <div className="container" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Profile...</div>;
  }

  return (
    <div className="container" style={{ paddingBottom: '4rem' }}>
      
      {/* PROFILE HEADER CARD */}
      <div className="market-card" style={{ marginTop: '2rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.8))' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', marginBottom: '0.25rem' }}>Your Profile</h1>
          <p className="text-muted" style={{ margin: 0, fontSize: '1.1rem' }}>{session.user.email}</p>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
            <span className="badge badge-resolved">{profile?.role?.toUpperCase()}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p className="text-muted" style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.8rem' }}>Current Balance</p>
          <h2 className="text-accent" style={{ margin: 0, fontSize: '3rem', fontWeight: 800 }}>${Number(profile?.balance || 0).toFixed(2)}</h2>
          {profile?.balance <= 0 && (
            <button className="btn btn-primary" style={{ marginTop: '0.5rem' }} onClick={handleClaimFunds}>Claim Refill ($100)</button>
          )}
        </div>
      </div>

      {/* STATISTICS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="market-card" style={{ textAlign: 'center', padding: '1.5rem' }}>
          <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Total Bets</p>
          <h3 style={{ margin: 0, fontSize: '2rem' }}>{totalBets}</h3>
        </div>
        <div className="market-card" style={{ textAlign: 'center', padding: '1.5rem' }}>
          <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Win Rate</p>
          <h3 style={{ margin: 0, fontSize: '2rem', color: winRate >= 50 ? 'var(--accent-yes)' : 'inherit' }}>{winRate}%</h3>
        </div>
        <div className="market-card" style={{ textAlign: 'center', padding: '1.5rem' }}>
          <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Total Wagered</p>
          <h3 style={{ margin: 0, fontSize: '2rem' }}>${totalWagered.toFixed(2)}</h3>
        </div>
        <div className="market-card" style={{ textAlign: 'center', padding: '1.5rem' }}>
          <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Net Profit</p>
          <h3 style={{ margin: 0, fontSize: '2rem', color: netProfit >= 0 ? 'var(--accent-yes)' : 'var(--accent-no)' }}>
            {netProfit >= 0 ? '+' : ''}${netProfit.toFixed(2)}
          </h3>
        </div>
      </div>

      {/* CHART OVERVIEW */}
      {transactions.length > 0 && (
        <div className="market-card" style={{ marginBottom: '2rem', height: '300px' }}>
          <h3 style={{ marginBottom: '1rem' }}>Balance History</h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 12}} />
              <YAxis stroke="rgba(255,255,255,0.3)" tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 12}} width={40} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}
                itemStyle={{ color: 'var(--text-main)' }}
                formatter={(value) => [`$${value}`, 'Balance']}
              />
              <Line type="stepAfter" dataKey="balance" stroke="var(--accent-main)" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* TABS */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-light)', marginBottom: '1.5rem' }}>
        <button 
          className="text-muted font-bold"
          style={{ 
            padding: '0.5rem 1rem', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'bets' ? '2px solid var(--accent-main)' : '2px solid transparent',
            color: activeTab === 'bets' ? 'var(--text-main)' : 'var(--text-muted)',
            cursor: 'pointer'
          }}
          onClick={() => setActiveTab('bets')}
        >
          My Bets
        </button>
        <button 
          className="text-muted font-bold"
          style={{ 
            padding: '0.5rem 1rem', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'transactions' ? '2px solid var(--accent-main)' : '2px solid transparent',
            color: activeTab === 'transactions' ? 'var(--text-main)' : 'var(--text-muted)',
            cursor: 'pointer'
          }}
          onClick={() => setActiveTab('transactions')}
        >
          Transactions
        </button>
      </div>

      {/* CONTENT LISTS */}
      {activeTab === 'bets' && (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Market</th>
                <th>Prediction</th>
                <th>Wager</th>
                <th>Pot. Payout</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {predictions.map(p => (
                <tr key={p.id}>
                  <td className="font-semibold">{p.matches?.title || 'Unknown Match'}</td>
                  <td>{p.predicted_team}</td>
                  <td>${Number(p.wager_amount).toFixed(2)}</td>
                  <td className="text-accent">${Number(p.expected_payout).toFixed(2)}</td>
                  <td>
                    <span 
                      className="badge" 
                      style={{
                        backgroundColor: p.status === 'pending' ? 'rgba(100, 116, 139, 0.2)' : p.status === 'won' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: p.status === 'pending' ? '#94a3b8' : p.status === 'won' ? 'var(--accent-yes)' : 'var(--accent-no)',
                        border: `1px solid ${p.status === 'pending' ? '#475569' : p.status === 'won' ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`
                      }}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="text-muted text-sm">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {predictions.length === 0 && (
                <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No bets placed yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div style={{ overflowX: 'auto' }}>
          {transactions.length === 0 ? (
            <p className="text-muted text-center" style={{ padding: '2rem 0' }}>Your transaction history will appear once you run the updated schema script and make new wagers!</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Description</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id}>
                    <td>
                      <span style={{ textTransform: 'capitalize' }}>{t.type.replace('_', ' ')}</span>
                    </td>
                    <td className="font-bold" style={{ color: Number(t.amount) > 0 ? 'var(--accent-yes)' : 'var(--accent-no)' }}>
                      {Number(t.amount) > 0 ? '+' : ''}{Number(t.amount).toFixed(2)}
                    </td>
                    <td className="text-muted">{t.description || '-'}</td>
                    <td className="text-muted text-sm">{new Date(t.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

    </div>
  );
}
