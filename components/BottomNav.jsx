import React, { useState } from 'react';

const BottomNav = ({ activeTab = 'Play', onTabChange }) => {

  const navItems = [
    {
      name: 'Play',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/>
        </svg>
      )
    },
    {
      name: 'Ranks',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      )
    },
    {
      name: 'Earn',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
        </svg>
      )
    },
    {
      name: 'Wallet',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v8H4V6z" clipRule="evenodd"/>
          <path d="M14 9a1 1 0 100 2 1 1 0 000-2z"/>
        </svg>
      )
    },
    {
      name: 'Friends',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
          <path d="M6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
        </svg>
      )
    },
    {
      name: 'Work',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h2zm4-1a1 1 0 00-1 1v1h2V6a1 1 0 00-1-1z" clipRule="evenodd"/>
        </svg>
      )
    }
  ];

  return (
    <nav data-bottom-nav className="fixed bottom-0 left-0 right-0 z-30 pb-safe bg-gray-900/90 backdrop-blur border-t border-gray-800 px-2 py-1">
      <div className="flex justify-around items-center">
        {navItems.map((item) => (
          <button
            key={item.name}
            onClick={() => {
              if (onTabChange) {
                onTabChange(item.name);
              }
            }}
            className={`
              flex flex-col items-center justify-center py-2 px-3 rounded-lg
              transition-all duration-200 min-w-[60px]
              ${activeTab === item.name 
                ? 'text-red-400 bg-red-500/10 shadow-lg' 
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
              }
            `}
          >
            <div className={`
              transition-transform duration-200
              ${activeTab === item.name ? 'scale-110' : 'scale-100'}
            `}>
              {item.icon}
            </div>
            <span className={`
              text-xs font-medium mt-1 transition-all duration-200
              ${activeTab === item.name ? 'font-bold' : 'font-normal'}
            `}>
              {item.name}
            </span>
            
            {/* Active indicator */}
            {activeTab === item.name && (
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-red-400 rounded-full"></div>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
