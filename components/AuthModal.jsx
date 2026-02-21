import React, { useState } from 'react';
import authService from './services/authService.js';

const AuthModal = ({ isOpen, onClose, onSuccess }) => {
  const [mode, setMode] = useState('login');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (mode === 'register') {
      if (!formData.username || formData.username.length < 3) {
        newErrors.username = 'Username must be at least 3 characters';
      }
      if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
        newErrors.email = 'Please enter a valid email address';
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    } else {
      if (!formData.username && !formData.email) {
        newErrors.username = 'Please enter username or email';
      }
    }

    if (!formData.password || formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      let result;
      
      if (mode === 'register') {
        result = await authService.register(
          formData.username,
          formData.email,
          formData.password
        );
      } else {
        result = await authService.login(
          formData.username || formData.email,
          formData.password
        );
      }

      if (result.success) {
        onSuccess(result.user);
        onClose();
        setFormData({
          username: '',
          email: '',
          password: '',
          confirmPassword: ''
        });
      } else {
        setErrors({ general: result.error });
      }
    } catch (error) {
      setErrors({ general: 'An unexpected error occurred' });
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setErrors({});
    setFormData({
      username: '',
      email: '',
      password: '',
      confirmPassword: ''
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-md">
        {
}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">
            {mode === 'login' ? 'Login' : 'Create Account'}
          </h2>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {
}
          {errors.general && (
            <div className="bg-red-600 text-white p-3 rounded-lg text-sm">
              {errors.general}
            </div>
          )}

          {
}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              {mode === 'register' ? 'Username' : 'Username or Email'}
            </label>
            <input
              type="text"
              name={mode === 'register' ? 'username' : 'username'}
              value={mode === 'register' ? formData.username : (formData.username || formData.email)}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              placeholder={mode === 'register' ? 'Enter username' : 'Enter username or email'}
              disabled={isLoading}
            />
            {errors.username && (
              <p className="text-red-400 text-xs mt-1">{errors.username}</p>
            )}
          </div>

          {
}
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                placeholder="Enter email address"
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">{errors.email}</p>
              )}
            </div>
          )}

          {
}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              placeholder="Enter password"
              disabled={isLoading}
            />
            {errors.password && (
              <p className="text-red-400 text-xs mt-1">{errors.password}</p>
            )}
          </div>

          {
}
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                placeholder="Confirm password"
                disabled={isLoading}
              />
              {errors.confirmPassword && (
                <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>
              )}
            </div>
          )}

          {
}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                {mode === 'login' ? 'Logging in...' : 'Creating account...'}
              </div>
            ) : (
              mode === 'login' ? 'Login' : 'Create Account'
            )}
          </button>

          {
}
          <div className="text-center pt-4 border-t border-gray-700">
            <p className="text-gray-400 text-sm">
              {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
              <button
                type="button"
                onClick={switchMode}
                className="text-blue-400 hover:text-blue-300 ml-1 font-medium"
                disabled={isLoading}
              >
                {mode === 'login' ? 'Sign up' : 'Login'}
              </button>
            </p>
          </div>

          {
}
          <div className="bg-gray-800 rounded-lg p-3 mt-4">
            <p className="text-gray-400 text-xs">
              <strong>Playing as guest?</strong> Your progress won't be saved. 
              Create an account to keep your stats and balance!
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthModal;
