import React, { useMemo, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Quotation, PricedItem, CatalogItem } from '../types';
import Spinner from '../components/Spinner';
import Alert from '../components/Alert';
import { formatCurrency } from '../utils/formatting';
import Tooltip from '../components/Tooltip';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Input from '../components/Input';
import { useApiService } from '../hooks/useApiService';

const isPriceExpired = (item: PricedItem): boolean => {
  const updatedAt = new Date(item.updatedAt);
  const expiryDate = new Date(new Date(updatedAt).setDate(updatedAt.getDate() + item.priceValidityDays));
  return new Date() > expiryDate;
};

const PendingItemsView: React.FC = () => {
  const { data: quotes, loading: quotesLoading, error: quotesError } = useApi<Quotation>('quotations');
  const { data: catalogItems, loading: catalogLoading, error: catalogError, refetch: refetchCatalog } = useApi<CatalogItem>('catalogItems');
  const [showOnlyPriority, setShowOnlyPriority] = useState(false);

  const { saveItem } = useApiService();
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [itemToUpdate, setItemToUpdate] = useState<CatalogItem | null>(null);
  const [newPrice, setNewPrice] = useState(0);

  const draftQuotes = useMemo(() => {
    return quotes?.filter(q => q.status === 'draft') || [];
  }, [quotes]);

  const priorityItemIds = useMemo(() => {
    const ids = new Set<string>();
    draftQuotes.forEach(quote => {
        quote.items.forEach(item => {
            if (isPriceExpired(item.itemSnapshot as CatalogItem)) {
                ids.add(item.itemId);
            }
        });
    });
    return ids;
  }, [draftQuotes]);

  const expiredItems = useMemo(() => {
    const allItems = catalogItems || [];
    const filtered = allItems.filter(isPriceExpired);
    if (showOnlyPriority) {
        return filtered.filter(item => priorityItemIds.has(item.id));
    }
    return filtered;
  }, [catalogItems, showOnlyPriority, priorityItemIds]);

  const loading = quotesLoading || catalogLoading;
  const error = quotesError || catalogError;
  
  const handleOpenUpdateModal = (item: CatalogItem) => {
    setItemToUpdate(item);
    setNewPrice(item.unitCost);
    setIsUpdateModalOpen(true);
  };

  const handleUpdatePrice = async () => {
    if (!itemToUpdate || newPrice < 0) return;
    const updatedItem: CatalogItem = {
      ...itemToUpdate,
      unitCost: newPrice,
      updatedAt: new Date().toISOString()
    };
    await saveItem('catalogItems', updatedItem);
    refetchCatalog();
    setIsUpdateModalOpen(false);
    setItemToUpdate(null);
  };

  if (loading) return <div className="flex justify-center p-8"><Spinner /></div>;
  if (error) return <Alert type="error" message={`Error al cargar datos pendientes: ${error.message}`} />;

  return (
    <div className="space-y-8">
      {/* Expired Prices Section */}
      <div className="bg-white dark:bg-slate-800 shadow-md rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-yellow-600 dark:text-yellow-400">Precios Expirados por Actualizar</h2>
          <Tooltip title="Filtra la lista para ver solo los items que están bloqueando una cotización en borrador.">
            <label htmlFor="priority-toggle" className="flex items-center cursor-pointer">
                <span className="mr-3 text-sm font-medium text-slate-700 dark:text-slate-300">Mostrar solo prioritarios</span>
                <div className="relative">
                    <input 
                        type="checkbox" 
                        id="priority-toggle" 
                        className="sr-only" 
                        checked={showOnlyPriority} 
                        onChange={() => setShowOnlyPriority(!showOnlyPriority)} 
                    />
                    <div className={`block w-14 h-8 rounded-full transition-colors ${showOnlyPriority ? 'bg-[var(--color-primary)]' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${showOnlyPriority ? 'translate-x-6' : 'translate-x-0'}`}></div>
                </div>
            </label>
          </Tooltip>
        </div>
        {expiredItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
              <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3">Prioridad</th>
                  <th className="px-6 py-3">Nombre del Item</th>
                  <th className="px-6 py-3">Categoría</th>
                  <th className="px-6 py-3">Última Actualización</th>
                  <th className="px-6 py-3">Costo Anterior</th>
                  <th className="px-6 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {expiredItems.map(item => (
                  <tr key={item.id} className={`border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 ${priorityItemIds.has(item.id) ? "bg-yellow-50 dark:bg-yellow-900/20" : "bg-white dark:bg-slate-800"}`}>
                    <td className="px-6 py-4">
                        {priorityItemIds.has(item.id) && (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-300">
                                ¡Urgente!
                            </span>
                        )}
                    </td>
                    <td className="px-6 py-4 font-medium">{item.name}</td>
                    <td className="px-6 py-4">{item.category}</td>
                    <td className="px-6 py-4">{new Date(item.updatedAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4">{formatCurrency(item.unitCost)} / {item.unit}</td>
                    <td className="px-6 py-4 text-right">
                      <Button size="sm" onClick={() => handleOpenUpdateModal(item)}>Actualizar Precio</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Alert type="success" message="¡Excelente! Todos los precios de materiales e insumos están actualizados." />
        )}
      </div>

      {/* Draft Quotes Section */}
      <div className="bg-white dark:bg-slate-800 shadow-md rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Cotizaciones en Borrador</h2>
        {draftQuotes.length > 0 ? (
          <div className="overflow-x-auto">
             <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
              <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3">Número</th>
                  <th className="px-6 py-3">Prenda</th>
                  <th className="px-6 py-3">Cliente</th>
                  <th className="px-6 py-3">Fecha de Creación</th>
                </tr>
              </thead>
              <tbody>
                 {draftQuotes.map(q => (
                  <tr key={q.id} className="bg-white border-b dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                    <td className="px-6 py-4 font-medium">{q.code}</td>
                    <td className="px-6 py-4">{q.garmentName}</td>
                    <td className="px-6 py-4">{q.client.name}</td>
                    <td className="px-6 py-4">{new Date(q.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Alert type="info" message="No hay cotizaciones guardadas como borrador." />
        )}
      </div>

      <Modal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        title={`Actualizar precio para ${itemToUpdate?.name}`}
      >
        <div className="space-y-4">
            <p>Costo anterior: <strong>{formatCurrency(itemToUpdate?.unitCost || 0)}</strong></p>
            <Input
                label="Nuevo Costo Unitario"
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(parseFloat(e.target.value) || 0)}
                step="any"
            />
            <div className="flex justify-end">
                <Button onClick={handleUpdatePrice}>Guardar Nuevo Precio</Button>
            </div>
        </div>
      </Modal>

    </div>
  );
};

export default PendingItemsView;
