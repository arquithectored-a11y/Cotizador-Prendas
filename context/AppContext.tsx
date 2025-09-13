import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { Settings, Company, Role, View } from '../types';
import { apiService } from '../services/apiService';

interface AppContextType {
  userRole: string;
  activeRole: Role | null;
  setUserRole: (role: string) => void;
  switchToProtectedRole: (role: string, password: string) => Promise<boolean>;
  hasPermission: (view: View, level: 'read' | 'write') => boolean;
  settings: Settings | null;
  activeCompany: Company | null;
  setActiveCompany: (companyId: string) => Promise<void>;
  updateSettings: (newSettings: Omit<Settings, 'id'>) => Promise<void>;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const hexToRgb = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}` : '0 0 0';
};


export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userRole, setUserRole] = useState<string>('Ventas');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const settingsData = await apiService.getItems<Settings>('settings');
      if (settingsData.length > 0) {
        setSettings(settingsData[0]);
      } else {
         // This should ideally not happen due to seeding
         console.error("No settings found in DB.");
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (settings?.themeColors) {
      const { primary, secondary, light, dark } = settings.themeColors;
      const primaryRgb = hexToRgb(primary);
      const secondaryRgb = hexToRgb(secondary);

      const themeStyle = `
        :root {
          --color-primary: ${primary};
          --color-primary-rgb: ${primaryRgb};
          --color-secondary: ${secondary};
          --color-secondary-rgb: ${secondaryRgb};
          --color-background: ${light.background};
          --color-text: ${light.text};
          --color-card-header-bg: ${light.cardHeaderBackground};
          --color-card-header-text: ${light.cardHeaderText};
          --color-summary-bg: ${light.summaryBackground};
          --color-summary-text: ${light.summaryText};
        }
        html.dark {
          --color-background: ${dark.background};
          --color-text: ${dark.text};
          --color-card-header-bg: ${dark.cardHeaderBackground};
          --color-card-header-text: ${dark.cardHeaderText};
          --color-summary-bg: ${dark.summaryBackground};
          --color-summary-text: ${dark.summaryText};
        }
        body {
          background-color: var(--color-background);
          color: var(--color-text);
          transition: background-color 0.3s ease, color 0.3s ease;
        }
      `;

      // For tailwind's dark mode to work with prefers-color-scheme
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      
      const styleElement = document.getElementById('app-theme');
      if (styleElement) {
        styleElement.innerHTML = themeStyle;
      }
    }
  }, [settings?.themeColors]);


  const updateSettings = async (newSettingsData: Omit<Settings, 'id'>) => {
    if (settings) {
      const updated = { ...settings, ...newSettingsData };
      await apiService.saveItem('settings', updated, userRole);
      setSettings(updated);
    }
  };
  
  const setActiveCompany = async (companyId: string) => {
    if (settings && settings.activeCompanyId !== companyId) {
        const newSettings = { ...settings, activeCompanyId: companyId };
        await apiService.saveItem('settings', newSettings, userRole);
        setSettings(newSettings);
    }
  };

  const activeRole = useMemo(() => {
    return settings?.roles.find(r => r.name === userRole) || null;
  }, [settings, userRole]);

  const hasPermission = useCallback((view: View, level: 'read' | 'write'): boolean => {
    if (!activeRole) return false;
    
    const permission = activeRole.permissions.find(p => p.view === view);
    if (!permission) return false;

    if (level === 'write') {
      return permission.access === 'write';
    }
    if (level === 'read') {
      return permission.access === 'read' || permission.access === 'write';
    }
    return false;
  }, [activeRole]);

  const switchToProtectedRole = async (roleName: string, password: string): Promise<boolean> => {
    if (!settings?.passwords) return false;
    
    if (!settings.passwords[roleName]) {
        setUserRole(roleName);
        return true;
    }
    
    if (password === settings.passwords[roleName]) {
        setUserRole(roleName);
        return true;
    }
    return false;
  };
  
  const activeCompany = settings?.companies.find(c => c.id === settings.activeCompanyId) || null;

  const value = {
    userRole,
    activeRole,
    setUserRole,
    switchToProtectedRole,
    hasPermission,
    settings,
    activeCompany,
    setActiveCompany,
    updateSettings,
    isLoading,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};