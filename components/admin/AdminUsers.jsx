import React, { useState, useEffect } from 'react';
import authService from '../services/authService.js';
import AdminUserDetail from './AdminUserDetail.jsx';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const response = await authService.apiRequest(`/admin/users?page=${page}&limit=20&search=${search}`);
      
      console.log('Admin users API response:', response);
      
      if (response.success) {
        let usersData, totalPagesData;
        
        if (Array.isArray(response.users)) {
          usersData = response.users;
          totalPagesData = response.totalPages || 1;
        } else if (response.users?.users && Array.isArray(response.users.users)) {
          usersData = response.users.users;
          totalPagesData = response.users.totalPages || 1;
        } else {
          console.error('Unexpected API response structure:', response);
          usersData = [];
          totalPagesData = 1;
        }
        
        setUsers(usersData);
        setTotalPages(totalPagesData);
        setError('');
      } else {
        setError('Failed to load users');
        setUsers([]);
      }
    } catch (err) {
      console.error('Admin users error:', err);
      setError(err.message || 'Failed to load users');
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [page, search]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleBanUser = async (userId, ban = true) => {
    try {
      const endpoint = ban ? `/admin/users/${userId}/ban` : `/admin/users/${userId}/unban`;
      const response = await authService.apiRequest(endpoint, { method: 'POST' });
      
      if (response.success) {
        loadUsers();
        if (selectedUser?.id === userId) {
          setSelectedUser(response.user);
        }
        
        alert(`User ${ban ? 'banned' : 'unbanned'} successfully`);
      }
    } catch (err) {
      console.error('Ban/unban error:', err);
      alert(`Failed to ${ban ? 'ban' : 'unban'} user: ${err.message}`);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatBalance = (balance) => {
    const num = parseFloat(balance);
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toLocaleString();
  };

  if (selectedUser) {
    return (
      <AdminUserDetail
        userId={selectedUser.id}
        onClose={() => setSelectedUser(null)}
        onUserUpdate={(updatedUser) => {
          setSelectedUser(updatedUser);
          loadUsers();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">User Management</h2>
        
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by username, email, or ID..."
            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSearchInput('');
                setPage(1);
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      )}

      {error && (
        <div className="bg-red-900 bg-opacity-50 border border-red-600 rounded-lg p-4">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {!isLoading && !error && (
        <>
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">User</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Balance</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Role</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Joined</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Last Login</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {Array.isArray(users) && users.length > 0 ? users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-700 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-white">{user.username}</p>
                        <p className="text-sm text-gray-400">{user.email || 'Telegram User'}</p>
                        <p className="text-xs text-gray-500 font-mono">{user.id}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-green-400">
                        {formatBalance(user.balance)} pts
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded ${
                        user.role === 'ADMIN' 
                          ? 'bg-red-900 text-red-300' 
                          : 'bg-blue-900 text-blue-300'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded ${
                        user.isActive 
                          ? 'bg-green-900 text-green-300' 
                          : 'bg-red-900 text-red-300'
                      }`}>
                        {user.isActive ? 'Active' : 'Banned'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                        >
                          View
                        </button>
                        {user.role !== 'ADMIN' && (
                          <button
                            onClick={() => handleBanUser(user.id, user.isActive)}
                            className={`px-3 py-1 text-white text-sm rounded ${
                              user.isActive
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'bg-green-600 hover:bg-green-700'
                            }`}
                          >
                            {user.isActive ? 'Ban' : 'Unban'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      {isLoading ? 'Loading users...' : error || 'No users found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {
}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className={`px-4 py-2 rounded ${
                  page === 1
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                Previous
              </button>
              <span className="px-4 py-2 text-white">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className={`px-4 py-2 rounded ${
                  page === totalPages
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminUsers;
