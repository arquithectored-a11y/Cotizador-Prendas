
import React, { useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { LogEntry, ItemKey } from '../types';
import Spinner from '../components/Spinner';
import Alert from '../components/Alert';

const ActivityLogView: React.FC = () => {
  const { data: logs, loading, error } = useApi<LogEntry>('logs');

  const sortedLogs = useMemo(() => {
    return logs ? [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) : [];
  }, [logs]);

  const actionColors: Record<LogEntry['action'], string> = {
    create: 'text-green-500',
    update: 'text-blue-500',
    delete: 'text-red-500',
    stock_add: 'text-purple-500',
  };

  const actionTranslations: Record<LogEntry['action'], string> = {
    create: 'Creación',
    update: 'Actualización',
    delete: 'Eliminación',
    stock_add: 'Añadir Stock',
  };

  const itemTypeTranslations: Record<ItemKey, string> = {
    catalogItems: 'Catálogo',
    labor: 'Mano de Obra',
    clients: 'Clientes',
    settings: 'Configuración',
    quotations: 'Cotización',
    logs: 'Registro',
  };

  if (loading) return <div className="flex justify-center p-8"><Spinner /></div>;
  if (error) return <Alert type="error" message={`Error al cargar el registro de actividad: ${error.message}`} />;

  return (
    <div className="bg-white dark:bg-slate-800 shadow-md rounded-lg p-6">
      <h2 className="text-xl font-bold mb-4">Registro de Actividad del Sistema</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
          <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400">
            <tr>
              <th scope="col" className="px-6 py-3">Fecha y Hora</th>
              <th scope="col" className="px-6 py-3">Usuario (Rol)</th>
              <th scope="col" className="px-6 py-3">Acción</th>
              <th scope="col" className="px-6 py-3">Tipo de Elemento</th>
              <th scope="col" className="px-6 py-3">Nombre del Elemento</th>
            </tr>
          </thead>
          <tbody>
            {sortedLogs.map(log => (
              <tr key={log.id} className="bg-white border-b dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                <td className="px-6 py-4 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                <td className="px-6 py-4">{log.userRole}</td>
                <td className={`px-6 py-4 font-semibold ${actionColors[log.action]}`}>{actionTranslations[log.action]}</td>
                <td className="px-6 py-4">{itemTypeTranslations[log.itemType]}</td>
                <td className="px-6 py-4">{log.itemName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ActivityLogView;
