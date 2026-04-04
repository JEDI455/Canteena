import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Trophy, TrendingUp, DollarSign, Target, ArrowUp, ArrowDown } from 'lucide-react';

export default function Leaderboard() {
  const [rawProfiles, setRawProfiles] = useState([]);
  const [rawPredictions, setRawPredictions] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'profit', direction: 'desc' });

  useEffect(() => {
    fetchLeaderboardData();
  }, []);

  const fetchLeaderboardData = async () => {
    setLoading(true);
    try {
      const { data: profiles, error: profErr } = await supabase.from('profiles').select('id, email, balance');
      if (profErr) throw profErr;

      const { data: predictions, error: predErr } = await supabase
        .from('predictions')
        .select('*')
        .order('created_at', { ascending: true });
      if (predErr && predErr.code !== '42P01') throw predErr; 

      const { data: matches, error: matchErr } = await supabase
        .from('matches')
        .select('id, category');
      if (matchErr && matchErr.code !== '42P01') throw matchErr;

      const safePredictions = predictions || [];
      const safeMatches = matches || [];

      const predictionsWithCategory = safePredictions.map(p => {
        const match = safeMatches.find(m => m.id === p.match_id);
        return { ...p, category: match ? match.category : 'other' };
      });

      setRawProfiles(profiles || []);
      setRawPredictions(predictionsWithCategory);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    return rawProfiles.map(profile => {
      let wins = 0; let losses = 0; let totalWagered = 0; let profit = 0;
      let currentStreak = 0; let longestStreak = 0;

      let userPreds = rawPredictions.filter(p => p.user_id === profile.id);
      if (activeCategory !== 'all') {
        userPreds = userPreds.filter(p => p.category === activeCategory);
      }

      userPreds.forEach(p => {
        if (p.status !== 'pending') {
          totalWagered += Number(p.wager_amount);
        }
        
        if (p.status === 'won') {
          wins++;
          profit += (Number(p.expected_payout) - Number(p.wager_amount));
          currentStreak++;
          longestStreak = Math.max(longestStreak, currentStreak);
        } else if (p.status === 'lost') {
          losses++;
          profit -= Number(p.wager_amount);
          currentStreak = 0;
        }
      });

      const totalResolved = wins + losses;
      const winRate = totalResolved > 0 ? (wins / totalResolved) * 100 : 0;

      return {
        id: profile.id,
        email: profile.email.split('@')[0],
        wins, losses, totalResolved, winRate, totalWagered, profit, longestStreak
      };
    });
  }, [rawProfiles, rawPredictions, activeCategory]);

  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const sortedStats = useMemo(() => {
    let sortableItems = [...stats];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [stats, sortConfig]);

  if (loading) {
    return <div className="container" style={{ paddingTop: '4rem', textAlign: 'center' }}>Loading Leaderboard...</div>;
  }

  // --- Calculations for Highlight Boxes and Charts ---
  
  // Highligts
  const highestProfitUser = [...stats].sort((a,b) => b.profit - a.profit)[0];
  const mostWageredUser = [...stats].sort((a,b) => b.totalWagered - a.totalWagered)[0];
  const bestWinRateUser = [...stats].filter(s => s.totalResolved > 2).sort((a,b) => b.winRate - a.winRate)[0]; // minimum 3 bets to qualify
  const longestStreakUser = [...stats].sort((a,b) => b.longestStreak - a.longestStreak)[0];

  // Bar Chart (Top 5 by Profit)
  const chartData = [...stats].sort((a,b) => b.profit - a.profit).slice(0, 5).map(s => ({
    name: s.email,
    Profit: s.profit > 0 ? s.profit : 0
  }));

  // Pie Chart (Global Win/Loss)
  const globalWins = stats.reduce((acc, curr) => acc + curr.wins, 0);
  const globalLosses = stats.reduce((acc, curr) => acc + curr.losses, 0);
  const pieData = [
    { name: 'Wins', value: globalWins },
    { name: 'Losses', value: globalLosses }
  ];
  const COLORS = ['#22c55e', '#ef4444']; // green, red

  return (
    <div className="container" style={{ paddingBottom: '4rem' }}>
      <div style={{ padding: '3rem 0', display: 'flex', flexDirection: 'column', gap: '1rem', borderBottom: '1px solid var(--border-light)' }}>
        <h1 style={{ fontSize: '3rem', letterSpacing: '-1px', margin: 0 }}>Leaderboard</h1>
        <p className="text-muted" style={{ fontSize: '1.2rem', maxWidth: '600px' }}>
          See who is dominating the predictions market. Tracking global performance, profits, and streaks.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          {['all', 'politics', 'economics', 'sport', 'other'].map(cat => (
            <button 
              key={cat} 
              className={`btn ${activeCategory === cat ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveCategory(cat)}
              style={{ textTransform: 'capitalize', padding: '0.5rem 1rem', borderRadius: '50px' }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Highlights Grid */}
      <div style={{ 
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1.5rem', marginTop: '2rem', marginBottom: '3rem' 
      }}>
        <div className="market-card">
          <div className="flex items-center gap-2 text-muted" style={{ marginBottom: '0.5rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <Trophy size={16} className="text-accent" /> Top Earner
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {highestProfitUser?.profit > 0 ? highestProfitUser?.email : 'No one yet'}
          </div>
          <div className="text-yes" style={{ fontWeight: 600 }}>
            {highestProfitUser?.profit > 0 ? `+$${highestProfitUser?.profit.toFixed(2)}` : '-'}
          </div>
        </div>

        <div className="market-card">
          <div className="flex items-center gap-2 text-muted" style={{ marginBottom: '0.5rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <DollarSign size={16} className="text-accent" /> Most Wagered
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {mostWageredUser?.totalWagered > 0 ? mostWageredUser?.email : 'No bets yet'}
          </div>
          <div className="font-bold">
            ${mostWageredUser?.totalWagered.toFixed(2) || '0.00'} Total
          </div>
        </div>

        <div className="market-card">
          <div className="flex items-center gap-2 text-muted" style={{ marginBottom: '0.5rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <Target size={16} className="text-accent" /> Best Accuracy
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {bestWinRateUser ? bestWinRateUser.email : 'N/A (Min 3 bets)'}
          </div>
          <div className="font-bold">
            {bestWinRateUser ? `${bestWinRateUser.winRate.toFixed(1)}%` : '-'}
          </div>
        </div>

        <div className="market-card">
          <div className="flex items-center gap-2 text-muted" style={{ marginBottom: '0.5rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <TrendingUp size={16} className="text-accent" /> Longest Streak
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {longestStreakUser?.longestStreak > 0 ? longestStreakUser?.email : 'No streak'}
          </div>
          <div className="text-yes font-bold">
            {longestStreakUser?.longestStreak || 0} Wins Row
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '1.5rem', marginBottom: '3rem' }}>
        {/* Bar Chart */}
        <div className="market-card" style={{ padding: '2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '2rem' }}>Top 5 Profits</h3>
          <div style={{ height: 300, width: '100%' }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                <RechartsTooltip 
                  cursor={{fill: 'var(--bg-main)'}}
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-light)', borderRadius: 'var(--radius-sm)' }}
                  itemStyle={{ color: 'var(--accent-yes)' }}
                />
                <Bar dataKey="Profit" fill="var(--accent-yes)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="market-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Global Win Rate</h3>
          {globalWins === 0 && globalLosses === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No predictions resolved yet</div>
          ) : (
            <div style={{ flex: 1, minHeight: 250, width: '100%' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-light)', borderRadius: 'var(--radius-sm)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Main Table */}
      <h2 style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>Full Rankings</h2>
      <div style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-light)' }}>
              <th onClick={() => handleSort('email')} style={{ cursor: 'pointer', padding: '1rem', textAlign: 'left', fontWeight: '600' }}>
                User {sortConfig.key === 'email' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="inline"/> : <ArrowDown size={14} className="inline"/>)}
              </th>
              <th onClick={() => handleSort('profit')} style={{ cursor: 'pointer', padding: '1rem', textAlign: 'right', fontWeight: '600' }}>
                Net Profit {sortConfig.key === 'profit' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="inline"/> : <ArrowDown size={14} className="inline"/>)}
              </th>
              <th onClick={() => handleSort('winRate')} style={{ cursor: 'pointer', padding: '1rem', textAlign: 'right', fontWeight: '600' }}>
                Win Rate {sortConfig.key === 'winRate' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="inline"/> : <ArrowDown size={14} className="inline"/>)}
              </th>
              <th onClick={() => handleSort('wins')} style={{ cursor: 'pointer', padding: '1rem', textAlign: 'right', fontWeight: '600' }}>
                W / L {sortConfig.key === 'wins' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="inline"/> : <ArrowDown size={14} className="inline"/>)}
              </th>
              <th onClick={() => handleSort('totalWagered')} style={{ cursor: 'pointer', padding: '1rem', textAlign: 'right', fontWeight: '600' }}>
                Total Wagered {sortConfig.key === 'totalWagered' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="inline"/> : <ArrowDown size={14} className="inline"/>)}
              </th>
              <th onClick={() => handleSort('longestStreak')} style={{ cursor: 'pointer', padding: '1rem', textAlign: 'right', fontWeight: '600' }}>
                Longest Streak {sortConfig.key === 'longestStreak' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="inline"/> : <ArrowDown size={14} className="inline"/>)}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedStats.map((s, idx) => (
              <tr key={s.id} style={{ borderBottom: '1px solid var(--border-light)', transition: 'background 0.2s', ':hover': { background: 'var(--bg-main)' } }}>
                <td style={{ padding: '1rem' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-muted" style={{ fontSize: '0.8rem', width: '20px' }}>#{idx + 1}</span>
                    <span className="font-semibold">{s.email}</span>
                  </div>
                </td>
                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold' }} className={s.profit > 0 ? 'text-yes' : s.profit < 0 ? 'text-no' : ''}>
                  {s.profit > 0 ? '+' : ''}{s.profit === 0 ? '$0.00' : `$${s.profit.toFixed(2)}`}
                </td>
                <td style={{ padding: '1rem', textAlign: 'right' }}>
                  {s.winRate.toFixed(1)}%
                </td>
                <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-muted)' }}>
                  <span className="text-yes">{s.wins}</span> - <span className="text-no">{s.losses}</span>
                </td>
                <td style={{ padding: '1rem', textAlign: 'right' }}>
                  ${s.totalWagered.toFixed(2)}
                </td>
                <td style={{ padding: '1rem', textAlign: 'right' }}>
                  {s.longestStreak} 🔥
                </td>
              </tr>
            ))}
            {sortedStats.length === 0 && (
               <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No statistics available yet.</td></tr>
            )}
           </tbody>
        </table>
      </div>

    </div>
  );
}
