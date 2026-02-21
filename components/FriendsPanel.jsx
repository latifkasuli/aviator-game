import React, { useState, useEffect } from 'react';
import authService from './services/authService.js';

const FriendsPanel = ({ isOpen, onClose }) => {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  
  const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'aviador_game_test_bot';
  const SHORT_NAME = import.meta.env.VITE_TELEGRAM_SHORT_NAME || 'aviador_game_test_bot';

  const loadReferralStats = async () => {
    if (!authService.isAuthenticated()) {
      setError('Please log in to see your referral stats');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const result = await authService.getReferralStats();
      
      if (result.success && result.stats) {
        setStats(result.stats);
        setError('');
      } else {
        setError(result.error || 'Failed to load referral stats');
        console.error('Referral stats error:', result.error);
      }
    } catch (error) {
      setError('Failed to load referral stats');
      console.error('Error loading referral stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadReferralStats();
    }
  }, [isOpen]);

  const getReferralLink = () => {
    if (!stats?.referralCode) {
      return '';
    }
    const link = `https://t.me/${BOT_USERNAME}/${SHORT_NAME}?startapp=ref_${stats.referralCode}`;
    return link;
  };

  const copyReferralLink = async () => {
    const link = getReferralLink();
    if (!link) {
      alert('No referral link available');
      return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);

        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = link;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          document.execCommand('copy');
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          
          if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
          }
        } catch (err) {
          console.error('Fallback copy failed:', err);
          prompt('Copy this referral link:', link);
        } finally {
          document.body.removeChild(textArea);
        }
      }
    } catch (err) {
      console.error('Copy failed:', err);
      prompt('Copy this referral link:', link);
    }
  };

  const shareInTelegram = () => {
    const referralCode = stats?.referralCode;
    if (!referralCode) {
      alert('No referral code available');
      return;
    }

    const shareReferral = (tg, referralCode, botUsername, shortName) => {
      const deepLink = `https://t.me/${botUsername}/${shortName}?startapp=ref_${referralCode}`;
      const text = `Join me in Aviator! Claim your bonus with my link:`;

      if (tg && tg.openTelegramLink) {
        tg.openTelegramLink(
          `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(text)}`
        );
        return true;
      }
      return false;
    };

    try {
      if (window.Telegram && window.Telegram.WebApp) {
        const success = shareReferral(window.Telegram.WebApp, referralCode, BOT_USERNAME, SHORT_NAME);
        if (success) {
          if (window.Telegram.WebApp.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
          }
          return;
        }
      }

      const deepLink = `https://t.me/${BOT_USERNAME}/${SHORT_NAME}?startapp=ref_${referralCode}`;
      const text = `Join me in Aviator! Claim your bonus with my link:`;
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(text)}`;

      if (navigator.share) {
        navigator.share({ title: 'Aviator', text, url: deepLink }).catch(err => {
          console.error('Native share failed:', err);
          window.location.href = shareUrl;
        });
      } else {
        window.location.href = shareUrl;
      }
    } catch (error) {
      console.error('Share error:', error);
      alert('Share feature not available. The referral link has been copied to your clipboard!');
      copyReferralLink();
    }
  };

  const formatCompact = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return num.toString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-md max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Friends</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-400">{error}</p>
              {!authService.isAuthenticated() && (
                <button 
                  onClick={() => window.location.reload()}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Log In
                </button>
              )}
            </div>
          ) : stats ? (
            <div className="space-y-6">
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">Share Your Referral Link</h3>
                <div className="space-y-3">
                  <div className="bg-gray-700 rounded p-3 text-sm break-all">
                    {getReferralLink()}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={copyReferralLink}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded font-medium transition-colors"
                    >
                      {copied ? 'Copied!' : 'Copy Link'}
                    </button>
                    <button
                      onClick={shareInTelegram}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded font-medium transition-colors"
                    >
                      Share
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">How It Works</h3>
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="flex items-start">
                    <span className="text-green-400 mr-2">*</span>
                    <span>Your friend gets <strong className="text-yellow-400">+1,000 pts</strong> when they join via your link</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-green-400 mr-2">*</span>
                    <span>You get <strong className="text-yellow-400">+1,000 pts</strong> when they play their first game</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-blue-400 mr-2">i</span>
                    <span>Maximum 10 paid referrals per day (10,000 pts daily limit)</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-400">{stats.totalReferrals}</div>
                  <div className="text-sm text-gray-400">Total Friends</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">{formatCompact(stats.totalEarned)}</div>
                  <div className="text-sm text-gray-400">Points Earned</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-400">{stats.pendingReferrals}</div>
                  <div className="text-sm text-gray-400">Pending</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">{stats.paidReferrals}</div>
                  <div className="text-sm text-gray-400">Activated</div>
                </div>
              </div>

              {stats.referredBy && (
                <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-3 text-sm">
                  <span className="text-blue-400">i</span> You were referred by <strong>@{stats.referredBy}</strong>
                </div>
              )}

              {stats.recentReferrals && stats.recentReferrals.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3">Recent Friends</h3>
                  <div className="space-y-2">
                    {stats.recentReferrals.map((ref, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-700 rounded">
                        <div>
                          <div className="font-medium">@{ref.username}</div>
                          <div className="text-xs text-gray-400">
                            {new Date(ref.joinedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className={`text-sm font-medium ${
                          ref.status === 'PAID' ? 'text-green-400' : 
                          ref.status === 'PENDING' ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {ref.status === 'PAID' ? '+1,000' : 
                           ref.status === 'PENDING' ? 'Pending' : 'Rejected'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default FriendsPanel;
