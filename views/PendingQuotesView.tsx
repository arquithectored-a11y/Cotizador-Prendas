import React, { useState, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { Quotation, CatalogItem } from '../types';
import Spinner from '../components/Spinner';
import Alert from '../components/Alert';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Input from '../components/Input';
import { useApiService } from '../hooks/useApiService';
import { formatCurrency } from '../utils/formatting';
import { DocumentCheckIcon } from '../components/Icons';

const isPriceExpired = (item: CatalogItem): boolean => {
    if (!item.updatedAt || !item.priceValidityDays) return true;
    const updatedAt = new Date(item.updatedAt);
    const expiryDate = new Date(updatedAt.setDate(updatedAt.getDate() + item.priceValidityDays));
    return new Date() > expiryDate;
};

type ExpiredItemInfo = {
    itemId: string;
    itemSnapshot: CatalogItem;
};

const PendingQuotesView: React.FC = () => {
    const { data: quotes, loading, error, refetch } = useApi<Quotation>('quotations');
    const { saveItem } = useApiService();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedQuote, setSelectedQuote] = useState<Quotation | null>(null);
    const [priceUpdates, setPriceUpdates] = useState<Record<string, number>>({});

    const draftQuotes = useMemo(() => {
        return quotes?.filter(q => q.status === 'draft') || [];
    }, [quotes]);
    
    const expiredItemsByQuote = useMemo(() => {
        const map = new Map<string, ExpiredItemInfo[]>();
        draftQuotes.forEach(q => {
            const expired = q.items.filter(item => isPriceExpired(item.itemSnapshot));
            if (expired.length > 0) {
                map.set(q.id, expired as ExpiredItemInfo[]);
            }
        });
        return map;
    }, [draftQuotes]);
    
    const handleOpenUpdateModal = (quote: Quotation) => {
        setSelectedQuote(quote);
        const initialPrices: Record<string, number> = {};
        expiredItemsByQuote.get(quote.id)?.forEach(item => {
            initialPrices[item.itemId] = item.itemSnapshot.unitCost;
        });
        setPriceUpdates(initialPrices);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedQuote(null);
        setPriceUpdates({});
    };

    const handlePriceChange = (itemId: string, newCost: number) => {
        setPriceUpdates(prev => ({ ...prev, [itemId]: newCost }));
    };

    const handleSaveChanges = async () => {
        if (!selectedQuote) return;

        const updates = expiredItemsByQuote.get(selectedQuote.id)?.map(expiredItem => {
            const updatedItem: CatalogItem = {
                ...expiredItem.itemSnapshot,
                unitCost: priceUpdates[expiredItem.itemId],
                updatedAt: new Date().toISOString()
            };
            return saveItem('catalogItems', updatedItem);
        });

        if (updates) {
            await Promise.all(updates);
            // After updating items, we need to check if the quote can be activated
            const quoteItems = selectedQuote.items.map(item => {
                const updatedCost = priceUpdates[item.itemId];
                if(updatedCost !== undefined) {
                    // Update the snapshot within the quote to reflect the new price instantly
                    return {
                        ...item,
                        itemSnapshot: {
                            ...item.itemSnapshot,
                            unitCost: updatedCost,
                            updatedAt: new Date().toISOString()
                        }
                    };
                }
                return item;
            });
            
            // Check if ANY items are still expired after update
            const stillHasExpired = quoteItems.some(item => isPriceExpired(item.itemSnapshot));

            if (!stillHasExpired) {
                 // Clone and update the quote status
                 const activatedQuote: Quotation = { ...selectedQuote, status: 'active' };
                 await saveItem('quotations', activatedQuote);
            }
        }
        refetch();
        handleCloseModal();
    };


    if (loading) return <div className="flex justify-center p-8"><Spinner /></div>;
    if (error) return <Alert type="error" message={`Error al cargar datos: ${error.message}`} />;

    return (
        <div className="bg-white dark:bg-slate-800 shadow-md rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Cotizaciones Pendientes de Activación</h2>
            {draftQuotes.length > 0 ? (
                <div className="space-y-4">
                    {draftQuotes.map(quote => {
                        const expiredItems = expiredItemsByQuote.get(quote.id);
                        if (!expiredItems || expiredItems.length === 0) return null;

                        return (
                            <div key={quote.id} className="p-4 border dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="font-bold">{quote.code} - {quote.garmentName}</h3>
                                        <p className="text-sm text-slate-500">{quote.client.name} - {new Date(quote.createdAt).toLocaleDateString()}</p>
                                    </div>
                                    <Button onClick={() => handleOpenUpdateModal(quote)}>
                                        <DocumentCheckIcon /> <span className="ml-2">Actualizar Precios</span>
                                    </Button>
                                </div>
                                <div className="mt-4">
                                    <p className="text-sm font-semibold mb-2">Items con precios expirados:</p>
                                    <ul className="list-disc list-inside text-sm space-y-1">
                                        {expiredItems.map(item => (
                                            <li key={item.itemId} className="text-yellow-700 dark:text-yellow-400">
                                                {item.itemSnapshot.name} (Costo anterior: {formatCurrency(item.itemSnapshot.unitCost)})
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <Alert type="success" message="¡Todo en orden! No hay cotizaciones pendientes por precios expirados." />
            )}

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={`Actualizar Precios para ${selectedQuote?.code}`}>
                <div className="space-y-4">
                    <p>Ingrese los nuevos costos para los siguientes items. Al guardar, los precios se actualizarán en el catálogo y la cotización se activará si todos los items están al día.</p>
                    {expiredItemsByQuote.get(selectedQuote?.id || '')?.map(item => (
                        <div key={item.itemId} className="grid grid-cols-2 items-center gap-4 p-2 bg-slate-100 dark:bg-slate-700 rounded-md">
                           <div>
                             <p className="font-semibold">{item.itemSnapshot.name}</p>
                             <p className="text-xs text-slate-500">Costo anterior: {formatCurrency(item.itemSnapshot.unitCost)}</p>
                           </div>
                           <Input
                             type="number"
                             label="Nuevo Costo Unitario"
                             value={priceUpdates[item.itemId] || ''}
                             onChange={(e) => handlePriceChange(item.itemId, parseFloat(e.target.value) || 0)}
                           />
                        </div>
                    ))}
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="secondary" onClick={handleCloseModal}>Cancelar</Button>
                        <Button onClick={handleSaveChanges}>Guardar Cambios y Activar</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PendingQuotesView;