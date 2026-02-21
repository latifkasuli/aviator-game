
import React from 'react';

const ConnectionStatus = ({ isConnected, playersOnline }) => {
  return (
    <div className="flex items-center space-x-4 text-sm">
      {
}
      <div className="flex items-center space-x-2">
        <div 
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      
      {
}
      {isConnected && (
        <div className="flex items-center space-x-2 text-gray-400">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
          </svg>
          <span>{playersOnline} online</span>
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;
