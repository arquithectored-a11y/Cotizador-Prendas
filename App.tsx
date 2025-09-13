import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import QuotesView from './views/QuotesView';
import CatalogView from './views/CatalogView';
import TableView from './views/TableView';
import SettingsView from './views/SettingsView';
import PendingItemsView from './views/PendingView';
import PendingQuotesView from './views/PendingQuotesView';
import ActivityLogView from './views/ActivityLogView';
import { Client, Labor, View } from './types';
import {
  BriefcaseIcon,
  CogIcon,
  DocumentTextIcon,
  UserGroupIcon,
  CubeIcon,
  ClockIcon,
  ClipboardDocumentListIcon,
  ArchiveBoxArrowDownIcon
} from './components/Icons';
import { useAppContext } from './context/AppContext';

const App: React.FC = () => {
  const { userRole, hasPermission, activeRole } = useAppContext();

  const navigationItems: { name: string; view: View; icon: React.ReactNode }[] = [
    { name: 'Cotizaciones', view: 'quotes', icon: <DocumentTextIcon /> },
    { name: 'Cotizaciones Pendientes', view: 'pendingQuotes', icon: <ArchiveBoxArrowDownIcon />},
    { name: 'Clientes', view: 'clients', icon: <UserGroupIcon /> },
    { name: 'Catálogo', view: 'catalog', icon: <CubeIcon /> },
    { name: 'Mano de Obra', view: 'labor', icon: <BriefcaseIcon /> },
    { name: 'Items Pendientes', view: 'pendingItems', icon: <ClockIcon /> },
    { name: 'Registro de Actividad', view: 'logs', icon: <ClipboardDocumentListIcon /> },
    { name: 'Configuración', view: 'settings', icon: <CogIcon /> },
  ];

  const [activeView, setActiveView] = useState<View>(activeRole?.defaultView || 'quotes');

  useEffect(() => {
    if (activeRole) {
      // If current view is not allowed, switch to the role's default view
      if (!hasPermission(activeView, 'read')) {
        setActiveView(activeRole.defaultView);
      }
    }
  }, [userRole, activeRole, activeView, hasPermission]);


  const renderView = () => {
    // Ensure the current view is allowed before rendering
    if (!activeRole || !hasPermission(activeView, 'read')) {
        return <div className="p-6"><h1 className="text-xl">No tiene permiso para ver esta sección.</h1></div>;
    }

    switch (activeView) {
      case 'quotes':
        return <QuotesView />;
      case 'pendingQuotes':
        return <PendingQuotesView />;
      case 'catalog':
        return <CatalogView />;
      case 'labor':
        return (
          <TableView<Labor>
            itemType="labor"
            title="Mano de Obra"
            columns={[
              { key: 'code', label: 'Código' },
              { key: 'name', label: 'Nombre' },
              { key: 'role', label: 'Rol' },
              { key: 'hourlyRate', label: 'Tarifa/Hora' },
            ]}
          />
        );
      case 'clients':
        return (
          <TableView<Client>
            itemType="clients"
            title="Clientes"
            columns={[
              { key: 'code', label: 'Código' },
              { key: 'name', label: 'Nombre' },
              { key: 'contactPerson', label: 'Persona de Contacto' },
              { key: 'email', label: 'Email' },
              { key: 'phone', label: 'Teléfono' },
            ]}
          />
        );
      case 'settings':
        return <SettingsView />;
      case 'pendingItems':
        return <PendingItemsView />;
      case 'logs':
        return <ActivityLogView />;
      default:
        return <QuotesView />;
    }
  };

  const currentView = navigationItems.find(item => item.view === activeView);

  return (
    <div className="flex h-screen">
      <Sidebar activeView={activeView} setActiveView={setActiveView} navigationItems={navigationItems} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={currentView?.name || 'Dashboard'} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6">
          {renderView()}
        </main>
      </div>
    </div>
  );
};

export default App;