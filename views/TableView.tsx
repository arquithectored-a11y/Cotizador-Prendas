import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { BaseItem, ItemKey, View } from '../types';
import Spinner from '../components/Spinner';
import Alert from '../components/Alert';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Input from '../components/Input';
import { useAppContext } from '../context/AppContext';
import { useApiService } from '../hooks/useApiService';
import { PlusCircleIcon, TrashIcon } from '../components/Icons';
import { formatCurrency } from '../utils/formatting';

interface Column<T> {
  key: keyof T;
  label: string;
}

interface TableViewProps<T extends BaseItem> {
  itemType: ItemKey;
  title: string;
  columns: Column<T>[];
}

const TableView = <T extends BaseItem,>({ itemType, title, columns }: TableViewProps<T>): React.ReactElement => {
  const { data, loading, error, refetch } = useApi<T>(itemType);
  const { hasPermission } = useAppContext();
  const { saveItem, deleteItem } = useApiService();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<Partial<T> | null>(null);

  const itemTypeToViewMap: Record<string, View> = {
    labor: 'labor',
    clients: 'clients',
  };
  const viewForPermission = itemTypeToViewMap[itemType];
  const canEdit = viewForPermission ? hasPermission(viewForPermission, 'write') : false;

  const handleOpenModal = (item: Partial<T> | null) => {
    setCurrentItem(item || {});
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentItem(null);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentItem) return;
    await saveItem(itemType, currentItem as T);
    refetch();
    handleCloseModal();
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent row click event
    if (window.confirm('¿Está seguro de que desea eliminar este registro?')) {
      await deleteItem(itemType, id);
      refetch();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setCurrentItem(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value } as Partial<T>));
  };

  const formatCell = (item: T, col: Column<T>): string => {
    const key = String(col.key).toLowerCase();
    const value = item[col.key] as any;
    
    if (key === 'hourlyrate') {
        return formatCurrency(value);
    }
    if (key.includes('margin')) {
        return `${value * 100}%`;
    }
    if (key.includes('cost')) {
        return formatCurrency(value);
    }
    return String(value);
  }

  if (loading) return <div className="flex justify-center p-8"><Spinner /></div>;
  if (error) return <Alert type="error" message={`Error al cargar datos: ${error.message}`} />;

  return (
    <div className="bg-white dark:bg-slate-800 shadow-md rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">{title}</h2>
        {canEdit && (
          <Button onClick={() => handleOpenModal(null)}>
            <PlusCircleIcon /> <span className="ml-2">Añadir Nuevo</span>
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
          <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400">
            <tr>
              {columns.map(col => <th key={String(col.key)} scope="col" className="px-6 py-3">{col.label}</th>)}
              {canEdit && <th scope="col" className="px-6 py-3 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {data?.map(item => (
              <tr 
                key={item.id} 
                className="bg-white border-b dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600"
                onClick={canEdit ? () => handleOpenModal(item) : undefined}
                style={{ cursor: canEdit ? 'pointer' : 'default' }}
              >
                {columns.map(col => (
                  <td key={`${item.id}-${String(col.key)}`} className="px-6 py-4">
                    {formatCell(item, col)}
                  </td>
                ))}
                {canEdit && (
                  <td className="px-6 py-4 text-right">
                     <Button variant="ghost" size="sm" onClick={(e) => handleDelete(e, item.id)}><TrashIcon/></Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

       <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={currentItem?.id ? `Editar ${title.slice(0,-1)}` : `Añadir ${title.slice(0,-1)}`}>
         <form onSubmit={handleSave} className="space-y-4">
          {columns.map(col => {
            const initialValue = currentItem?.[col.key];
            const isCodeField = String(col.key) === 'code';
            const isNumberField = typeof initialValue === 'number' || String(col.key).toLowerCase().includes('rate') || String(col.key).toLowerCase().includes('cost') || String(col.key).toLowerCase().includes('qty');
            const fieldType = isNumberField ? 'number' : 'text';

            if (isCodeField) {
                return <Input key="code" label="Código" name="code" value={currentItem?.code || 'Automático'} disabled />
            }

            return (
              <Input
                key={String(col.key)}
                label={col.label}
                name={String(col.key)}
                type={fieldType}
                step={fieldType === 'number' ? 'any' : undefined}
                value={(initialValue as any) || ''}
                onChange={handleChange}
                required
              />
            );
          })}
          <div className="flex justify-end pt-4">
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TableView;