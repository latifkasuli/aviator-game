import React, { useState, useEffect } from 'react';
import crypto from 'crypto-js';

const FairnessPage = ({ isOpen, onClose }) => {
  const [recentRounds, setRecentRounds] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationResults, setVerificationResults] = useState({});
  const [expandedRound, setExpandedRound] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    if (isOpen) {
      loadRecentRounds();
      const interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const loadRecentRounds = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || 'https://aviator-game-production.up.railway.app/api'}/fairness/recent-rounds`
      );
      const data = await response.json();
      if (data.success) {
        setRecentRounds(data.rounds);
      }
    } catch (error) {
      console.error('Failed to load recent rounds:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateCrashPoint = (serverSeed, clientSeed = '', nonce = 0) => {
    try {
      const message = `${clientSeed}:${nonce}`;
      const hash = crypto.HmacSHA256(message, serverSeed).toString();
      
      const hex = hash.substring(0, 8);
      const intValue = parseInt(hex, 16);
      
      const maxValue = 0xFFFFFFFF;
      
      const probability = intValue / maxValue;
      
      const houseEdge = 0.01;
      const adjustedProbability = probability * (1 - houseEdge);
      
      if (adjustedProbability === 0) {
        return 1.00;
      }
      
      const crashPoint = 1 / adjustedProbability;
      
      return Math.max(1.00, Math.min(crashPoint, 1000));
    } catch (error) {
      console.error('Error calculating crash point:', error);
      return null;
    }
  };

  const verifyRound = (round) => {
    if (!round.serverSeed) {
      setVerificationResults({
        ...verificationResults,
        [round.id]: { 
          success: false, 
          message: 'Server seed not yet revealed' 
        }
      });
      return;
    }

    const seedHash = crypto.SHA256(round.serverSeed).toString();
    if (seedHash !== round.serverSeedHash) {
      setVerificationResults({
        ...verificationResults,
        [round.id]: { 
          success: false, 
          message: 'Server seed hash mismatch!' 
        }
      });
      return;
    }

    const calculatedCrash = calculateCrashPoint(
      round.serverSeed, 
      round.clientSeed || '', 
      round.nonce
    );

    const roundCrash = parseFloat(round.crashPoint);
    const isValid = Math.abs(calculatedCrash - roundCrash) < 0.01;

    setVerificationResults({
      ...verificationResults,
      [round.id]: {
        success: isValid,
        calculatedCrash,
        actualCrash: roundCrash,
        message: isValid 
          ? `Verified! Calculated: ${calculatedCrash.toFixed(2)}x` 
          : `Mismatch! Expected: ${roundCrash.toFixed(2)}x, Got: ${calculatedCrash.toFixed(2)}x`
      }
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getTimeUntilReveal = (endTime) => {
    if (!endTime) return null;
    const endTimeMs = new Date(endTime).getTime();
    const fiveMinutesMs = 5 * 60 * 1000;
    const revealTime = endTimeMs + fiveMinutesMs;
    const timeLeft = revealTime - currentTime;
    
    if (timeLeft <= 0) return null;
    
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {
}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-white">Provably Fair - Game Verification</h2>
            <p className="text-sm text-gray-400 mt-1">
              Verify that game outcomes are truly random and not manipulated
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>

        {
}
        <div className="p-4 bg-gray-800 border-b border-gray-700">
          <details className="md:open" open>
            <summary className="cursor-pointer md:cursor-default list-none">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">How Provably Fair Works</h3>
                <svg className="w-5 h-5 text-gray-400 transition-transform md:hidden [details[open]>&]:rotate-180" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                </svg>
              </div>
            </summary>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mt-4">
              <div className="bg-gray-900 p-3 rounded">
                <div className="font-semibold text-blue-400 mb-1">1. Before the round</div>
                <p className="text-gray-300">
                  We generate a server seed and show you its hash. The hash proves we can't change the seed later.
                </p>
              </div>
              <div className="bg-gray-900 p-3 rounded">
                <div className="font-semibold text-blue-400 mb-1">2. During the round</div>
                <p className="text-gray-300">
                  The crash point is predetermined by combining server seed, client seed, and nonce.
                </p>
              </div>
              <div className="bg-gray-900 p-3 rounded">
                <div className="font-semibold text-blue-400 mb-1">3. After the round</div>
                <p className="text-gray-300">
                  We reveal the server seed. You can verify the hash and recalculate the crash point.
                </p>
              </div>
            </div>
          </details>
        </div>

        {
}
        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 280px)' }}>
          <h3 className="text-lg font-semibold mb-4">Recent Game Rounds</h3>
          
          {isLoading ? (
            <div className="text-center py-8 text-gray-400">Loading recent rounds...</div>
          ) : recentRounds.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No rounds available</div>
          ) : (
            <div className="space-y-2">
              {recentRounds.map((round) => {
                const verification = verificationResults[round.id];
                const isExpanded = expandedRound === round.id;
                
                return (
                  <div key={round.id} className="bg-gray-800 rounded-lg overflow-hidden">
                    <div 
                      className="p-4 cursor-pointer hover:bg-gray-750 transition-colors"
                      onClick={() => setExpandedRound(isExpanded ? null : round.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div>
                            <div className="font-semibold text-white">
                              Round #{round.roundNumber}
                            </div>
                            <div className="text-sm text-gray-400">
                              {formatDate(round.endTime || round.createdAt)}
                            </div>
                          </div>
                          <div className={`text-2xl font-bold ${
                            round.crashPoint >= 2 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {parseFloat(round.crashPoint).toFixed(2)}x
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {verification && (
                            <div className={`text-sm px-2 md:px-3 py-1 rounded ${
                              verification.success 
                                ? 'bg-green-600 text-white' 
                                : 'bg-red-600 text-white'
                            }`}>
                              {verification.success ? 'Pass' : 'Fail'}
                              <span className="hidden sm:inline ml-1">
                                {verification.success ? 'Verified' : 'Failed'}
                              </span>
                            </div>
                          )}
                          {(() => {
                            const timeLeft = getTimeUntilReveal(round.endTime);
                            const isDisabled = !round.serverSeed && timeLeft;
                            return (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isDisabled) {
                                    verifyRound(round);
                                  }
                                }}
                                disabled={isDisabled}
                                className={`px-2 md:px-3 py-1 rounded text-sm transition-colors ${
                                  isDisabled
                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                                title={isDisabled ? `Server seed reveals in ${timeLeft}` : 'Verify round'}
                              >
                                {isDisabled ? timeLeft : 'Verify'}
                              </button>
                            );
                          })()}
                          <svg 
                            className={`w-5 h-5 text-gray-400 transition-transform ${
                              isExpanded ? 'rotate-180' : ''
                            }`} 
                            fill="currentColor" 
                            viewBox="0 0 20 20"
                          >
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="border-t border-gray-700 p-4 bg-gray-850">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="font-semibold text-gray-400 mb-2">Server Seed Hash</div>
                            <div className="font-mono text-xs text-gray-300 break-all bg-gray-900 p-2 rounded">
                              {round.serverSeedHash}
                            </div>
                          </div>
                          
                          <div>
                            <div className="font-semibold text-gray-400 mb-2">Server Seed</div>
                            <div className="font-mono text-xs text-gray-300 break-all bg-gray-900 p-2 rounded">
                              {round.serverSeed || 'Not yet revealed'}
                            </div>
                          </div>
                          
                          <div>
                            <div className="font-semibold text-gray-400 mb-2">Client Seed</div>
                            <div className="font-mono text-xs text-gray-300 break-all bg-gray-900 p-2 rounded">
                              {round.clientSeed || 'Not provided'}
                            </div>
                          </div>
                          
                          <div>
                            <div className="font-semibold text-gray-400 mb-2">Nonce</div>
                            <div className="font-mono text-xs text-gray-300 bg-gray-900 p-2 rounded">
                              {round.nonce}
                            </div>
                          </div>
                        </div>
                        
                        {verification && (
                          <div className={`mt-4 p-3 rounded ${
                            verification.success 
                              ? 'bg-green-900 bg-opacity-30 border border-green-600' 
                              : 'bg-red-900 bg-opacity-30 border border-red-600'
                          }`}>
                            <div className="font-semibold mb-1">
                              {verification.success ? 'Verification Passed' : 'Verification Failed'}
                            </div>
                            <div className="text-sm text-gray-300">
                              {verification.message}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {
}
        <div className="p-4 border-t border-gray-700 bg-gray-800">
          <div className="text-sm text-gray-400 text-center">
            <p>All game outcomes are predetermined and can be independently verified using the provided seeds.</p>
            <p className="mt-2 text-xs">
              Algorithm: HMAC-SHA256(clientSeed:nonce, serverSeed) → Take first 8 hex chars → Calculate crash point
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FairnessPage;
