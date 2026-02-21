import React from 'react';
import { useGameBackend } from './hooks/useGameBackend';
import ConnectionStatus from './ConnectionStatus';

const BackendTest = () => {
  const {
    gameState,
    multiplier,
    countdown,
    playersOnline,
    isConnected,
    playerBalance,
    hasActiveBet,
    activeBetAmount,
    cashedOut,
    cashedOutMultiplier,
    placeBet,
    cashOut,
    checkHealth
  } = useGameBackend();

  const handleTestBet = () => {
    placeBet(100);
  };

  const handleTestCashOut = () => {
    console.log('[BackendTest] Attempting cash out...');
    console.log('[BackendTest] Current state:', { gameState, hasActiveBet, activeBetAmount, cashedOut });
    cashOut();
  };

  const handleHealthCheck = async () => {
    const health = await checkHealth();
    console.log('Backend health:', health);
    alert(`Backend Status: ${health?.status || 'Error'}`);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-800 rounded-lg">
      <h2 className="text-2xl font-bold text-white mb-6">Backend Connection Test</h2>
      
      {
}
      <div className="mb-6 p-4 bg-gray-700 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-2">Connection Status</h3>
        <ConnectionStatus isConnected={isConnected} playersOnline={playersOnline} />
      </div>

      {
}
      <div className="mb-6 p-4 bg-gray-700 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-2">Game State</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">State:</span>
            <span className="text-white ml-2 font-mono">{gameState}</span>
          </div>
          <div>
            <span className="text-gray-400">Multiplier:</span>
            <span className="text-green-400 ml-2 font-mono">{multiplier.toFixed(2)}x</span>
          </div>
          <div>
            <span className="text-gray-400">Countdown:</span>
            <span className="text-blue-400 ml-2 font-mono">{countdown}s</span>
          </div>
          <div>
            <span className="text-gray-400">Players:</span>
            <span className="text-purple-400 ml-2 font-mono">{playersOnline}</span>
          </div>
        </div>
      </div>

      {
}
      <div className="mb-6 p-4 bg-gray-700 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-2">Player State</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Balance:</span>
            <span className="text-green-400 ml-2 font-mono">{playerBalance} pts</span>
          </div>
          <div>
            <span className="text-gray-400">Active Bet:</span>
            <span className="text-yellow-400 ml-2 font-mono">{activeBetAmount} pts</span>
          </div>
          <div>
            <span className="text-gray-400">Cashed Out:</span>
            <span className="text-blue-400 ml-2 font-mono">{cashedOut ? 'Yes' : 'No'}</span>
          </div>
          <div>
            <span className="text-gray-400">Cashed At:</span>
            <span className="text-green-400 ml-2 font-mono">{cashedOutMultiplier.toFixed(2)}x</span>
          </div>
        </div>
      </div>

      {
}
      <div className="mb-6 p-4 bg-gray-700 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-4">Test Actions</h3>
        <div className="flex space-x-4">
          <button
            onClick={handleTestBet}
            disabled={!isConnected || gameState !== 'betting' || hasActiveBet}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Test Bet (100 pts)
          </button>
          
          <button
            onClick={handleTestCashOut}
            disabled={!isConnected || gameState !== 'running' || !hasActiveBet || cashedOut}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Test Cash Out
          </button>
          
          <button
            onClick={handleHealthCheck}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Health Check
          </button>
        </div>
      </div>

      {
}
      <div className="p-4 bg-blue-900 bg-opacity-50 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-400 mb-2">Instructions</h3>
        <ul className="text-sm text-blue-200 space-y-1">
          <li>• Wait for "Connected" status</li>
          <li>• Watch the game state cycle: betting → running → crashed</li>
          <li>• Place a test bet during "betting" phase</li>
          <li>• Try to cash out during "running" phase</li>
          <li>• Check browser console for detailed logs</li>
        </ul>
      </div>
    </div>
  );
};

export default BackendTest;
