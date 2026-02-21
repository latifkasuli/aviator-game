import React, { useState, useEffect } from 'react';
import authService from '../services/authService.js';
import AdminStats from './AdminStats.jsx';
import AdminUsers from './AdminUsers.jsx';
import AdminRounds from './AdminRounds.jsx';
import AdminReferrals from './AdminReferrals.jsx';
import AdminAuditLog from './AdminAuditLog.jsx';

const AdminDashboard = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const user = authService.getUser();
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (isOpen && !isAdmin) {
      setError('Admin access required');
    }
  }, [isOpen, isAdmin]);

  if (!isOpen) return null;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: null },
    { id: 'users', label: 'Users', icon: null },
    { id: 'rounds', label: 'Game Rounds', icon: null },
    { id: 'referrals', label: 'Referrals', icon: null },
    { id: 'audit', label: 'Audit Log', icon: null },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-900 w-full h-full max-w-7xl max-h-[90vh] rounded-lg overflow-hidden flex flex-col">
        {
}
        <div className="bg-gray-800 px-6 py-4 flex items-center justify-between border-b border-gray-700">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
            <span className="px-2 py-1 bg-red-600 text-white text-xs rounded">ADMIN</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {
}
        <div className="bg-gray-800 px-6 py-2 border-b border-gray-700">
          <nav className="flex space-x-6">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`py-2 px-4 rounded-t-lg transition-colors ${
                  activeTab === item.id
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {item.icon && <span className="mr-2">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {
}
        <div className="flex-1 overflow-y-auto p-6">
          {error && !isAdmin ? (
            <div className="bg-red-900 bg-opacity-50 border border-red-600 rounded-lg p-4">
              <p className="text-red-300">{error}</p>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && <AdminStats />}
              {activeTab === 'users' && <AdminUsers />}
              {activeTab === 'rounds' && <AdminRounds />}
              {activeTab === 'referrals' && <AdminReferrals />}
              {activeTab === 'audit' && <AdminAuditLog />}
            </>
          )}
        </div>

        {
}
        <div className="bg-gray-800 px-6 py-3 border-t border-gray-700 text-sm text-gray-400">
          <div className="flex justify-between items-center">
            <span>Logged in as: {user?.username} ({user?.email})</span>
            <span>Environment: {import.meta.env.MODE}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
