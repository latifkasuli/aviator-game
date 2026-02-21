import { useEffect, useRef, useState, useCallback } from 'react';
import authService from '../../components/services/authService';

export function usePlayerSettings() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const pendingPatchRef = useRef({});
  const debounceTimerRef = useRef(null);
  const retryTimerRef = useRef(null);
  const backoffMsRef = useRef(2000);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  const fetchSettings = useCallback(async () => {
    const token = authService.getToken();
    if (!token || !mountedRef.current) return;
    
    setLoading(true);
    try {
      const baseURL = import.meta.env.VITE_API_BASE_URL || 'https://aviator-game-production.up.railway.app/api';
      const response = await fetch(`${baseURL}/player/settings`, {
        headers: { 
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const json = await response.json();
        if (json?.settings && mountedRef.current) {
          setSettings(json.settings);
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const flush = useCallback(async () => {
    const token = authService.getToken();
    if (!token || !mountedRef.current) return;
    
    const patch = pendingPatchRef.current;
    if (!patch || Object.keys(patch).length === 0) return;
    if (inFlightRef.current) return;
    
    console.log('Flushing settings to server:', patch);
    
    inFlightRef.current = true;
    setSaving(true);
    
    try {
      const baseURL = import.meta.env.VITE_API_BASE_URL || 'https://aviator-game-production.up.railway.app/api';
      const response = await fetch(`${baseURL}/player/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(patch)
      });
      
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('Retry-After')) || backoffMsRef.current / 1000;
        backoffMsRef.current = Math.min(backoffMsRef.current * 2, 60000);
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(flush, retryAfter * 1000);
        console.log(`Rate limited, retrying in ${retryAfter}s`);
        return;
      }
      
      backoffMsRef.current = 2000;
      
      if (!response.ok) {
        console.error('Failed to save settings:', response.status);
        return;
      }
      
      const json = await response.json();
      console.log('Server response:', json);
      if (json?.settings && mountedRef.current) {
        setSettings(prev => ({ ...prev, ...json.settings }));
        pendingPatchRef.current = {};
        console.log('Settings saved successfully');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setSaving(false);
      }
    }
  }, []);

  const scheduleSave = useCallback(() => {
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      flush();
    }, 2000);
  }, [flush]);

  const updateSetting = useCallback((key, value) => {
    console.log(`updateSetting called: ${key} = ${value}`);
    
    setSettings(prev => {
      if (!prev) return { [key]: value };
      return { ...prev, [key]: value };
    });
    
    pendingPatchRef.current = { ...pendingPatchRef.current, [key]: value };
    console.log('Pending changes:', pendingPatchRef.current);
    
    scheduleSave();
  }, [scheduleSave]);

  const flushNow = useCallback(() => {
    clearTimeout(debounceTimerRef.current);
    clearTimeout(retryTimerRef.current);
    return flush();
  }, [flush]);

  useEffect(() => {
    mountedRef.current = true;
    
    fetchSettings();
    
    const handleVisibilityChange = () => {
      if (!document.hidden && mountedRef.current) {
        fetchSettings();
      }
    };
    
    const handleAuthChange = (event) => {
      if (event.detail?.isAuthenticated && mountedRef.current) {
        fetchSettings();
      } else if (!event.detail?.isAuthenticated && mountedRef.current) {
        setSettings(null);
        pendingPatchRef.current = {};
      }
    };
    
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('authStateChanged', handleAuthChange);
    
    return () => {
      mountedRef.current = false;
      clearTimeout(debounceTimerRef.current);
      clearTimeout(retryTimerRef.current);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('authStateChanged', handleAuthChange);
    };
  }, [fetchSettings]);

  return { 
    settings, 
    saving,
    loading,
    fetchSettings,
    updateSetting,
    flushNow,
    autoCashoutEnabled: settings?.autoCashoutEnabled ?? false,
    autoCashoutMultiplier: settings?.autoCashoutMultiplier ?? 2.0,
    soundEnabled: settings?.soundEnabled ?? true,
    dailyLimitsEnabled: settings?.dailyLimitsEnabled ?? false,
    maxDailyWager: settings?.maxDailyWager ?? 10000,
    maxDailyLoss: settings?.maxDailyLoss ?? 5000,
    maxGamesPerDay: settings?.maxGamesPerDay ?? 100
  };
}
