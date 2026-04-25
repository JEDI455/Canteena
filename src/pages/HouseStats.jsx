import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function HouseStats() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [stats, setStats] = useState({
    totalPayouts: 0,
    houseProfit: 0,
    activeVolume: 0,
    maxLiability: 0,
    totalWagersCount: 0,
    resolvedMatchesCount: 0,
    openMatchesCount: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // Fetch all predictions joined with match data
      const { data: predictions, error: predsError } = await supabase
        .from('predictions')
        .select('*, matches(*)');

      if (predsError) throw predsError;

      // Variables for calculation
      let totalPayouts = 0;
      let profit = 0;
      let activeVolume = 0;
      
      const openMatchesMap = {}; // match_id -> { team_a_liability: 0, team_b_liability: 0 }
      let resolvedCount = new Set();
      let openCount = new Set();
      let totalWagersCount = 0;

      predictions.forEach(p => {
        const match = p.matches;
        if (!match) return; // safeguard

        if (p.status !== 'refunded') {
          totalWagersCount++;
        }

        // Payouts given (only for WON bets)
        if (p.status === 'won') {
          totalPayouts += Number(p.expected_payout);
        }

        // House Earnings (Resolved Matches only)
        if (match.status === 'resolved') {
          resolvedCount.add(match.id);
          // Only count non-refunded bets towards profit
          if (p.status === 'won' || p.status === 'lost') {
            profit += Number(p.wager_amount); // House keeps the wager
            if (p.status === 'won') {
              profit -= Number(p.expected_payout); // House pays the winner
            }
          }
        }

        // Risk & Active Volume (Open Matches)
        if (match.status === 'open' && p.status === 'pending') {
          openCount.add(match.id);
          activeVolume += Number(p.wager_amount);

          if (!openMatchesMap[match.id]) {
            openMatchesMap[match.id] = { team_a: 0, team_b: 0, match_title: match.title, team_a_name: match.team_a, team_b_name: match.team_b };
          }

          if (p.predicted_team === match.team_a) {
            openMatchesMap[match.id].team_a += Number(p.expected_payout);
          } else if (p.predicted_team === match.team_b) {
            openMatchesMap[match.id].team_b += Number(p.expected_payout);
          }
        }
      });

      // Calculate Maximum Liability
      let maxLiability = 0;
      Object.values(openMatchesMap).forEach(matchLiability => {
        // For each match, the house's liability is the maximum payout between the two teams
        const worstCaseScenario = Math.max(matchLiability.team_a, matchLiability.team_b);
        maxLiability += worstCaseScenario;
      });

      setStats({
        totalPayouts,
        houseProfit: profit,
        activeVolume,
        maxLiability,
        totalWagersCount,
        resolvedMatchesCount: resolvedCount.size,
        openMatchesCount: openCount.size,
        openMatchesMap
      });

    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load stats. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="container" style={{ paddingTop: '2rem' }}>Loading House Stats...</div>;

  return (
    <div className="container" style={{ paddingBottom: '4rem' }}>
      <h1 style={{ marginTop: '2rem' }}>House Financial Stats</h1>
      {errorMsg && (
        <div style={{ backgroundColor: 'var(--accent-no-bg)', color: 'var(--accent-no)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '2rem' }}>
          {errorMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        
        {/* House Profit Card */}
        <div className="market-card" style={{ borderTop: `4px solid ${stats.houseProfit >= 0 ? 'var(--accent-yes)' : 'var(--accent-no)'}` }}>
          <div className="text-muted text-sm font-semibold mb-1" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net House Profit</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: stats.houseProfit >= 0 ? 'var(--text-main)' : 'var(--accent-no)' }}>
            ${stats.houseProfit.toFixed(2)}
          </div>
          <div className="text-muted text-xs mt-2">
            Earnings from {stats.resolvedMatchesCount} resolved matches
          </div>
        </div>

        {/* Total Payouts Card */}
        <div className="market-card" style={{ borderTop: '4px solid var(--accent-main)' }}>
          <div className="text-muted text-sm font-semibold mb-1" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Payouts Given</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
            ${stats.totalPayouts.toFixed(2)}
          </div>
          <div className="text-muted text-xs mt-2">
            Money sent to winning users
          </div>
        </div>

        {/* Total Active Volume */}
        <div className="market-card" style={{ borderTop: '4px solid #f59e0b' }}>
          <div className="text-muted text-sm font-semibold mb-1" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Betting Volume</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
            ${stats.activeVolume.toFixed(2)}
          </div>
          <div className="text-muted text-xs mt-2">
            Total wagers on {stats.openMatchesCount} pending matches
          </div>
        </div>

        {/* Maximum Liability */}
        <div className="market-card" style={{ borderTop: '4px solid var(--accent-no)' }}>
          <div className="text-muted text-sm font-semibold mb-1" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Maximum Liability</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--accent-no)' }}>
            ${stats.maxLiability.toFixed(2)}
          </div>
          <div className="text-muted text-xs mt-2">
            Worst-case scenario payout for open matches
          </div>
        </div>

      </div>

      <h2 style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>Active Risk Exposure (By Match)</h2>
      
      {stats.openMatchesCount === 0 ? (
        <div className="text-muted">No active matches to show risk exposure.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {Object.entries(stats.openMatchesMap).map(([matchId, match]) => {
            const totalLiability = match.team_a + match.team_b;
            const worstCase = Math.max(match.team_a, match.team_b);
            
            // Calculate percentages for the exposure bar
            let aPercent = 50;
            let bPercent = 50;
            if (totalLiability > 0) {
              aPercent = (match.team_a / totalLiability) * 100;
              bPercent = (match.team_b / totalLiability) * 100;
            }

            return (
              <div key={matchId} className="market-card" style={{ padding: '1.25rem' }}>
                <h3 className="font-semibold" style={{ fontSize: '1.1rem', marginBottom: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {match.match_title}
                </h3>
                
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold">{match.team_a_name} Liability</span>
                  <span className="text-accent">${match.team_a.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm mb-3">
                  <span className="font-semibold">{match.team_b_name} Liability</span>
                  <span className="text-accent">${match.team_b.toFixed(2)}</span>
                </div>

                {/* Exposure Bar */}
                <div style={{ height: '8px', background: 'var(--border-light)', borderRadius: '4px', overflow: 'hidden', display: 'flex', marginBottom: '1rem' }}>
                  <div style={{ width: `${aPercent}%`, background: 'var(--accent-main)', transition: 'width 0.3s ease' }}></div>
                  <div style={{ width: `${bPercent}%`, background: 'var(--accent-yes)', transition: 'width 0.3s ease' }}></div>
                </div>

                <div className="flex justify-between items-center border-t pt-3" style={{ borderColor: 'var(--border-light)' }}>
                  <span className="text-sm text-muted">Worst Case Payout:</span>
                  <span className="font-bold text-no">${worstCase.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="market-card" style={{ marginTop: '3rem', background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
        <h3 className="font-semibold flex items-center gap-2 mb-3">
          💡 Manager Insights
        </h3>
        <ul className="text-sm text-muted" style={{ paddingLeft: '1.5rem', listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <li><strong>House Profit</strong> shows your net real earnings. It subtracts payouts sent to winners from the wagers collected on resolved matches.</li>
          <li><strong>Active Risk Exposure</strong> shows which team you are hoping will LOSE. If the liability is very lopsided, you have high exposure to that specific team.</li>
          <li><strong>Note on Margins:</strong> Currently, your platform odds sum to exactly 100% (e.g. 50/50). This means the platform has a mathematical edge of <strong>0%</strong>. To guarantee long-term profit regardless of match outcomes, consider adding "Vigorish" (e.g. adjusting odds to 52%/52% so they sum &gt;100%).</li>
        </ul>
      </div>

    </div>
  );
}
