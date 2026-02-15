import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { TimeFormat, TimelineMode } from '../types';

interface SettingsState {
  timeFormat: TimeFormat;
  setTimeFormat: (format: TimeFormat) => void;
  darkMode: boolean;
  setDarkMode: (enabled: boolean) => void;
  timelineMode: TimelineMode;
  setTimelineMode: (mode: TimelineMode) => void;
}

const SettingsContext = createContext<SettingsState | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [timeFormat, setTimeFormatState] = useState<TimeFormat>(
    () => (localStorage.getItem('timeFormat') as TimeFormat) || '24h'
  );

  const [darkMode, setDarkModeState] = useState<boolean>(
    () => localStorage.getItem('darkMode') === 'true'
  );

  const [timelineMode, setTimelineModeState] = useState<TimelineMode>(
    () => (localStorage.getItem('timelineMode') as TimelineMode) || 'multi'
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const setTimeFormat = (format: TimeFormat): void => {
    setTimeFormatState(format);
    localStorage.setItem('timeFormat', format);
  };

  const setDarkMode = (enabled: boolean): void => {
    setDarkModeState(enabled);
    localStorage.setItem('darkMode', String(enabled));
  };

  const setTimelineMode = (mode: TimelineMode): void => {
    setTimelineModeState(mode);
    localStorage.setItem('timelineMode', mode);
  };

  return (
    <SettingsContext.Provider value={{ timeFormat, setTimeFormat, darkMode, setDarkMode, timelineMode, setTimelineMode }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsState {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
}
