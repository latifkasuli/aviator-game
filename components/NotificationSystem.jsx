import React, { useState, useEffect } from 'react';

const NotificationSystem = ({ notifications, onDismiss }) => {
  return (
    <div className="fixed top-20 right-4 z-50 space-y-2">
      {notifications.map((notification) => (
        <Notification
          key={notification.id}
          notification={notification}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
};

const Notification = ({ notification, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100);
    
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onDismiss(notification.id), 300);
    }, notification.duration || 5000);

    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  const getIcon = () => {
    switch (notification.type) {
      case 'error': return '[!]';
      case 'warning': return '[!]';
      case 'success': return '[OK]';
      case 'info': return '[i]';
      default: return '';
    }
  };

  const getColors = () => {
    switch (notification.type) {
      case 'error': return 'bg-red-600 border-red-500';
      case 'warning': return 'bg-yellow-600 border-yellow-500';
      case 'success': return 'bg-green-600 border-green-500';
      case 'info': return 'bg-blue-600 border-blue-500';
      default: return 'bg-gray-600 border-gray-500';
    }
  };

  return (
    <div
      className={`
        transform transition-all duration-300 ease-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${getColors()}
        border-l-4 rounded-lg shadow-lg p-4 max-w-sm
        text-white
      `}
    >
      <div className="flex items-start space-x-3">
        <span className="text-lg flex-shrink-0">{getIcon()}</span>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm">{notification.title}</h4>
          <p className="text-sm opacity-90 mt-1">{notification.message}</p>
          {notification.details && (
            <ul className="text-xs opacity-75 mt-2 space-y-1">
              {notification.details.map((detail, index) => (
                <li key={index}>• {detail}</li>
              ))}
            </ul>
          )}
        </div>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(() => onDismiss(notification.id), 300);
          }}
          className="flex-shrink-0 text-white hover:text-gray-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default NotificationSystem;
