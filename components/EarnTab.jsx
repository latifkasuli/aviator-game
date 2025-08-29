import React, { useEffect, useState, useCallback } from 'react';
import authService from './services/authService.js';
import { useTelegramWebApp } from './TelegramWebApp';

const EarnTab = ({ isOpen, onClose }) => {
  const { tg, hapticFeedback } = useTelegramWebApp();
  const [farming, setFarming] = useState(null);
  const [refStats, setRefStats] = useState(null);
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const promises = [
        authService.apiRequest('/farming/status').catch(() => ({ success: false })),
        authService.apiRequest('/referrals/stats').catch(() => ({ success: false })),
        authService.apiRequest('/quests').catch(() => ({ success: false, quests: [] }))
      ];
      
      const [farmRes, refRes, questRes] = await Promise.all(promises);
      
      if (farmRes.success) setFarming(farmRes);
      if (refRes.success) setRefStats(refRes.stats);
      if (questRes.success) setQuests(questRes.quests || []);
      
    } catch (error) {
      console.error('Error loading earn data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    loadData(); 
  }, [loadData]);

  const claimFarm = async () => {
    if (!farming?.success || !farming.canClaim) return;
    setClaiming(true);
    try {
      const res = await authService.apiRequest('/farming/claim', { method: 'POST' });
      if (res.success && res.rewardPoints) {
        hapticFeedback('notification', 'success');
        // Refresh farming status
        loadData();
        // Show success message - use both methods for compatibility
        const message = `+${res.rewardPoints} pts claimed ✅`;
        if (tg?.showAlert) {
          tg.showAlert(message);
        } else {
          alert(message);
        }
      } else {
        const errorMsg = res.error || res.message || 'Farming endpoint not implemented yet';
        if (tg?.showAlert) {
          tg.showAlert(errorMsg);
        } else {
          alert(errorMsg);
        }
      }
    } catch (error) {
      console.error('Claim error:', error);
      const errorMsg = 'Farming endpoints not implemented yet';
      if (tg?.showAlert) {
        tg.showAlert(errorMsg);
      } else {
        alert(errorMsg);
      }
    } finally {
      setClaiming(false);
    }
  };

  const shareReferral = () => {
    if (!refStats?.referralCode) return;
    
    // Use existing bot configuration
    const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'aviador_game_test_bot';
    const shortName = import.meta.env.VITE_TELEGRAM_SHORT_NAME || 'aviador_game_test_bot';
    
    // Use Mini App format (same as copy button)
    const deepLink = `https://t.me/${botUsername}/${shortName}?startapp=ref_${refStats.referralCode}`;
    const text = `🚀 Join me in Aviator! Claim your bonus with my link:`;
    
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(text)}`
      );
      hapticFeedback('notification', 'success');
    } else if (navigator.share) {
      navigator.share({ title: 'Aviator', text, url: deepLink }).catch(() => {
        // Fallback to direct share URL
        window.location.href = `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(text)}`;
      });
    } else {
      window.location.href = `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(text)}`;
    }
  };

  const claimQuest = async (questId) => {
    const q = quests.find(q => q.id === questId);
    if (!q || q.status !== 'COMPLETED') return;
    
    // Optimistic update
    setQuests(prev => prev.map(x => x.id === questId ? { ...x, status: 'CLAIMING' } : x));
    
    try {
      // Find the quest to get its type
      const quest = quests.find(q => q.id === questId);
      if (!quest) {
        throw new Error('Quest not found');
      }
      
      const res = await authService.apiRequest('/quests/claim', { 
        method: 'POST', 
        body: JSON.stringify({ questType: quest.type }) 
      });
      
      if (res.success && res.rewardPoints) {
        hapticFeedback('notification', 'success');
        setQuests(prev => prev.map(x => x.id === questId ? { ...x, status: 'CLAIMED' } : x));
        
        const message = `+${res.rewardPoints} pts for "${quest.name}" ✅`;
        if (tg?.showAlert) {
          tg.showAlert(message);
        } else {
          alert(message);
        }
        
        // Refresh data to get updated balances
        loadData();
      } else {
        // Revert optimistic update
        setQuests(prev => prev.map(x => x.id === questId ? { ...x, status: 'COMPLETED' } : x));
        const errorMsg = res.error || 'Failed to claim quest reward';
        if (tg?.showAlert) {
          tg.showAlert(errorMsg);
        } else {
          alert(errorMsg);
        }
      }
    } catch (error) {
      console.error('Quest claim error:', error);
      // Revert optimistic update
      setQuests(prev => prev.map(x => x.id === questId ? { ...x, status: 'COMPLETED' } : x));
      const errorMsg = 'Quest endpoints not implemented yet';
      if (tg?.showAlert) {
        tg.showAlert(errorMsg);
      } else {
        alert(errorMsg);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-md max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">💰 Earn Points</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[calc(90vh-80px)] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>

      {/* Daily Farming Card */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="text-lg font-semibold text-white mb-1">🌱 Daily Farming</div>
            <div className="text-sm text-gray-400">
              {farming?.canClaim 
                ? `Ready to claim: +${farming.rewardPoints} pts`
                : farming?.cycleHours && farming?.hoursElapsed !== undefined
                  ? `Next claim in ${Math.max(0, Math.ceil((farming.cycleHours - farming.hoursElapsed) * 60))} min`
                  : 'Loading farming status...'}
            </div>
          </div>
          <button
            onClick={claimFarm}
            disabled={!farming?.canClaim || claiming}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              farming?.canClaim 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            {claiming ? 'Claiming…' : (farming?.canClaim ? 'Claim' : 'Locked')}
          </button>
        </div>
        {farming?.streak && (
          <div className="mt-2 text-xs text-orange-400">
            🔥 {farming.streak} day streak • {farming.multiplier || 1}x multiplier
          </div>
        )}
      </div>

      {/* Referral Card */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="text-lg font-semibold text-white mb-1">👥 Invite & Earn</div>
            <div className="text-sm text-gray-400">
              {refStats 
                ? `${refStats.totalReferrals || 0} friends joined • ${refStats.totalEarned || 0} pts earned`
                : 'Invite friends and both get bonus points!'}
            </div>
          </div>
          <button 
            onClick={shareReferral} 
            disabled={!refStats?.referralCode}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-400 text-white rounded-lg font-medium transition-colors"
          >
            Share on Telegram
          </button>
        </div>
        {refStats?.referralCode && (
          <div className="text-xs text-gray-400 mt-2">
            Your code: <span className="text-gray-200 font-mono">{refStats.referralCode}</span>
          </div>
        )}
      </div>

      {/* Quests Card */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="text-lg font-semibold text-white mb-3">🎯 Daily Quests</div>
        <div className="space-y-3">
          {quests.length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-4">
              No quests available right now. Check back soon! 🔄
            </div>
          ) : (
            quests.map(q => (
              <div key={q.id} className="flex items-center justify-between bg-gray-900 p-3 rounded-lg border border-gray-700">
                <div className="flex-1">
                  <div className="font-medium text-white flex items-center gap-2">
                    <span>{q.icon}</span>
                    <span>{q.name}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {q.description}
                  </div>
                  <div className="text-xs text-gray-300 mt-1">
                    Progress: {q.currentValue}/{q.targetValue} • Reward: {q.rewardPoints} pts
                  </div>
                  {q.currentValue < q.targetValue && (
                    <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min((q.currentValue / q.targetValue) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="ml-3">
                  {q.status === 'CLAIMED' ? (
                    <span className="text-green-400 text-sm font-medium">Claimed ✓</span>
                  ) : q.status === 'COMPLETED' ? (
                    <button 
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
                      onClick={() => claimQuest(q.id)}
                      disabled={q.status === 'CLAIMING'}
                    >
                      {q.status === 'CLAIMING' ? 'Claiming...' : 'Claim'}
                    </button>
                  ) : (
                    <span className="text-gray-400 text-sm">
                      {Math.floor((q.currentValue / q.targetValue) * 100)}%
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

              {/* Coming Soon Card */}
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 opacity-60">
                <div className="text-lg font-semibold text-white mb-2">🚀 Coming Soon</div>
                <div className="text-sm text-gray-400 space-y-1">
                  <div>• Promo codes for special events</div>
                  <div>• Weekly challenges with bigger rewards</div>
                  <div>• Streak multipliers for daily claims</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EarnTab;
