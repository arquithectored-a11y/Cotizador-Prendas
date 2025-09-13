import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { View } from '../types';
import { ChevronLeftIcon, ChevronRightIcon } from './Icons';

interface SidebarProps {
  activeView: View;
  setActiveView: (view: View) => void;
  navigationItems: { name: string; view: View; icon: React.ReactNode }[];
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, navigationItems }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { settings, hasPermission } = useAppContext();

  const filteredNavItems = navigationItems.filter(item => 
    hasPermission(item.view, 'read')
  );
  
  const primaryColor = settings?.themeColors.primary || '#4f46e5';

  return (
    <div
      className={`relative flex flex-col bg-white dark:bg-slate-800 shadow-lg transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex items-center justify-between h-16 border-b border-slate-200 dark:border-slate-700 px-4">
        {!isCollapsed && (
            settings?.appLogo ? 
            <img src={settings.appLogo} alt="App Logo" className="h-10 w-auto" /> :
            <h1 className="text-xl font-bold text-[var(--color-primary)]">Costeo</h1>
        )}
        <button onClick={() => setIsCollapsed(!isCollapsed)} className={`p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 ${isCollapsed ? 'w-full' : ''}`}>
          {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </button>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-2">
        {filteredNavItems.map((item) => (
          <a
            key={item.name}
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setActiveView(item.view);
            }}
            className={`flex items-center p-2 text-sm font-medium rounded-md transition-colors ${
              activeView === item.view
                ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] dark:bg-[var(--color-primary)]/20 dark:text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white'
            } ${isCollapsed ? 'justify-center' : ''}`}
          >
            <span className="w-6 h-6">{item.icon}</span>
            <span className={`ml-3 ${isCollapsed ? 'hidden' : 'block'}`}>{item.name}</span>
          </a>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;