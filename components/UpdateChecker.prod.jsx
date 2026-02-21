import React, { useState } from 'react';

const UpdateChecker = () => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [checking, setChecking] = useState(false);
  
  const isEnabled = process.env.REACT_APP_ENABLE_UPDATE_CHECK === 'true';
  
  const checkForUpdates = async () => {
    try {
      setChecking(true);
      const response = await fetch(`/version.json?t=${Date.now()}`);
      const serverVersion = await response.json();
      const storedVersion = localStorage.getItem('app-version');
      
      if (storedVersion && storedVersion !== serverVersion.buildTime) {
        setHasUpdate(true);
        
        if (window.gtag) {
          window.gtag('event', 'update_available', {
            old_version: storedVersion,
            new_version: serverVersion.buildTime
          });
        }
      }
    } catch (error) {
      console.error('Update check failed:', error);
    } finally {
      setChecking(false);
    }
  };

  window.checkForAppUpdate = checkForUpdates;

  if (!isEnabled || !hasUpdate) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg max-w-sm">
      <h3 className="font-bold mb-2">Update Available</h3>
      <p className="text-sm mb-3">A new version of the app is available.</p>
      <div className="flex gap-2">
        <button
          onClick={() => window.location.reload(true)}
          className="px-4 py-2 bg-white text-blue-600 rounded font-medium"
        >
          Refresh Now
        </button>
        <button
          onClick={() => setHasUpdate(false)}
          className="px-4 py-2 bg-blue-700 rounded"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default UpdateChecker;
