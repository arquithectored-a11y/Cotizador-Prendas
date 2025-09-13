import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useApi } from '../hooks/useApi';
import {
  Quotation, Client, CatalogItem, Labor, QuotationItem, BaseItem, Settings, Tax, Company
} from '../types';
import Spinner from '../components/Spinner';
import Alert from '../components/Alert';
import Button from '../components/Button';
import Input from '../components/Input';
import { useApiService } from '../hooks/useApiService';
import { useAppContext } from '../context/AppContext';
import { PlusCircleIcon, TrashIcon, DocumentDuplicateIcon, PrinterIcon, PencilIcon, FunnelIcon } from '../components/Icons';
import Modal from '../components/Modal';
import { formatCurrency } from '../utils/formatting';
import Tooltip from '../components/Tooltip';

declare const jspdf: any;
declare const html2canvas: any;

let pdfCounter = 0;

const isPriceExpired = (item: CatalogItem): boolean => {
  const updatedAt = new Date(item.updatedAt);
  const expiryDate = new Date(new Date(updatedAt).setDate(updatedAt.getDate() + item.priceValidityDays));
  return new Date() > expiryDate;
};

const QuotesView: React.FC = () => {
  type QuoteScreen = 'list' | 'form';
  const [screen, setScreen] = useState<QuoteScreen>('list');
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<Set<string>>(new Set());
  
  const { data: quotes, loading, error, refetch } = useApi<Quotation>('quotations');
  const { settings, hasPermission } = useAppContext();
  const { deleteItem } = useApiService();

  const [currentQuote, setCurrentQuote] = useState<Partial<Quotation>>({});
  
  const [pdfIsGenerating, setPdfIsGenerating] = useState(false);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [isCompanySelectModalOpen, setIsCompanySelectModalOpen] = useState(false);
  const [pdfClientOverride, setPdfClientOverride] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: clients } = useApi<Client>('clients');
  
  const activeQuotes = useMemo(() => {
    return quotes?.filter(q => q.status === 'active') || [];
  }, [quotes]);
  
  const filteredQuotes = useMemo(() => {
    if (!activeQuotes) return [];
    return activeQuotes.filter(q =>
        q.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.garmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.client.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [activeQuotes, searchTerm]);


  const startNewQuote = (quoteToCopy?: Quotation) => {
    setCurrentQuote({
      garmentName: quoteToCopy?.garmentName || '',
      garmentQuantity: quoteToCopy?.garmentQuantity || 1,
      client: quoteToCopy?.client,
      items: quoteToCopy ? JSON.parse(JSON.stringify(quoteToCopy.items)) : [],
      labors: quoteToCopy ? JSON.parse(JSON.stringify(quoteToCopy.labors)) : [],
      referenceImages: quoteToCopy?.referenceImages || [],
      selectedTaxIds: [], // Start with no taxes for new quotes/recotizations
      presentationText: quoteToCopy?.presentationText || settings?.companies[0]?.defaultPresentationText || 'A continuación, presentamos nuestra propuesta comercial.',
    });
    setScreen('form');
  };

  const handleEditQuote = (quote: Quotation) => {
    setCurrentQuote(JSON.parse(JSON.stringify(quote)));
    setScreen('form');
  };

  const handleDeleteQuote = async (id: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar esta cotización?')) {
        await deleteItem('quotations', id);
        refetch();
    }
  };
  
  const selectedQuotes = useMemo(() => {
    return quotes?.filter(q => selectedQuoteIds.has(q.id)) || [];
  }, [quotes, selectedQuoteIds]);

  const canExport = useMemo(() => {
      if (selectedQuoteIds.size === 0) return false;
      return selectedQuotes.every(q => q.status !== 'draft');
  }, [selectedQuoteIds, selectedQuotes]);
  
  const handleGeneratePdf = async (
    type: 'customer' | 'production',
    options?: { company?: Company; clientOverride?: Client }
  ) => {
    if (selectedQuoteIds.size === 0) return;

    if (type === 'customer') {
        if (!options?.company) {
            alert("Se requiere una empresa para generar el PDF de cliente.");
            return;
        }
        if (selectedQuoteIds.size > 1 && !options.clientOverride) {
            setClientModalOpen(true); // Should not happen if flow is correct, but as a safeguard.
            return;
        }
    }

    setClientModalOpen(false);
    setIsCompanySelectModalOpen(false);
    setPdfIsGenerating(true);

    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.width = '210mm'; // A4 width
    document.body.appendChild(tempContainer);

    const ComponentToRender = type === 'customer' 
        ? <CustomerQuotePDF quotes={selectedQuotes} company={options!.company!} clientOverride={options?.clientOverride} />
        : <ProductionOrderPDF quotes={selectedQuotes} appLogo={settings?.appLogo} />;

    const root = createRoot(tempContainer);
    root.render(ComponentToRender);

    try {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for render
        const content = tempContainer.querySelector('.pdf-content') as HTMLElement;
        if (!content) throw new Error("PDF content not found");

        const canvas = await html2canvas(content, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 295; // A4 height in mm
        const imgHeight = canvas.height * imgWidth / canvas.width;
        let heightLeft = imgHeight;
        
        const pdf = new jspdf.jsPDF('p', 'mm');
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }
        
        if (type === 'customer') {
            const clientForName = options?.clientOverride || (selectedQuotes.length === 1 ? selectedQuotes[0].client : null);
            const clientName = clientForName?.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'cotizacion';
            const dateStr = new Date().toISOString().split('T')[0];
            pdfCounter++;
            const consecutive = String(pdfCounter).padStart(3, '0');
            const fileName = `${clientName}_${dateStr}_${consecutive}.pdf`;
            pdf.save(fileName);
        } else {
            pdf.save(`${type}_${new Date().toISOString().split('T')[0]}.pdf`);
        }
    } catch (e) {
        console.error("Failed to generate PDF", e);
        alert("Hubo un error al generar el PDF.");
    } finally {
        root.unmount();
        document.body.removeChild(tempContainer);
        setPdfIsGenerating(false);
        setPdfClientOverride(null);
    }
  };

  const handleCustomerPdfRequest = () => {
    if (selectedQuoteIds.size > 1) {
      setClientModalOpen(true); // First ask for client if multiple quotes
    } else {
      setIsCompanySelectModalOpen(true); // Ask for company directly
    }
  };

  const onCompanySelectedForPdf = (company: Company, clientOverride?: Client) => {
    handleGeneratePdf('customer', { company, clientOverride });
  };
  
  const renderList = () => (
    <div className="bg-white dark:bg-slate-800 shadow-md rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
            <div className="flex-1">
                <Input 
                    placeholder="Filtrar por código, prenda o cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                />
            </div>
            <div className="flex items-center gap-2">
                 <Button onClick={handleCustomerPdfRequest} disabled={!canExport || pdfIsGenerating}>
                    <PrinterIcon/> <span className="ml-2">{pdfIsGenerating ? 'Generando...' : 'PDF Cliente'}</span>
                 </Button>
                 {hasPermission('catalog', 'read') && (
                    <Button onClick={() => handleGeneratePdf('production')} disabled={selectedQuoteIds.size === 0 || pdfIsGenerating}>
                        <PrinterIcon/> <span className="ml-2">{pdfIsGenerating ? 'Generando...' : 'PDF Materiales'}</span>
                    </Button>
                 )}
                {hasPermission('quotes', 'write') && (
                    <Button onClick={() => startNewQuote()}><PlusCircleIcon/> <span className="ml-2">Nueva Cotización</span></Button>
                )}
            </div>
        </div>
        {!canExport && selectedQuoteIds.size > 0 && <Alert type="warning" message="No se puede exportar. Una o más cotizaciones seleccionadas son borradores."/>}
         <div className="overflow-x-auto">
             <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400">
                    <tr>
                        <th className="p-4"><input type="checkbox" onChange={e => {
                            const newSet = new Set<string>();
                            if (e.target.checked) { filteredQuotes.forEach(q => newSet.add(q.id)); }
                            setSelectedQuoteIds(newSet);
                        }}/></th>
                        <th className="px-6 py-3">Código</th>
                        <th className="px-6 py-3">Imagen</th>
                        <th className="px-6 py-3">Prenda</th><th className="px-6 py-3">Cliente</th><th className="px-6 py-3">Fecha</th><th className="px-6 py-3">Total</th><th className="px-6 py-3">Estado</th><th className="px-6 py-3 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredQuotes.map(q => (
                        <tr key={q.id} className="bg-white border-b dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                            <td className="p-4"><input type="checkbox" checked={selectedQuoteIds.has(q.id)} onChange={() => {
                                const newSet = new Set(selectedQuoteIds);
                                if (newSet.has(q.id)) newSet.delete(q.id); else newSet.add(q.id);
                                setSelectedQuoteIds(newSet);
                            }}/></td>
                            <td className="px-6 py-4 font-medium">{q.code}</td>
                            <td className="px-6 py-4">
                                {q.referenceImages && q.referenceImages.length > 0 ? (
                                    <img src={q.referenceImages[0]} alt={q.garmentName} className="h-12 w-12 object-cover rounded-md" />
                                ) : (
                                    <div className="h-12 w-12 bg-slate-200 dark:bg-slate-700 rounded-md flex items-center justify-center text-xs text-slate-500">Sin img.</div>
                                )}
                            </td>
                            <td className="px-6 py-4">{q.garmentName}</td><td className="px-6 py-4">{q.client?.name || 'N/A'}</td><td className="px-6 py-4">{new Date(q.createdAt).toLocaleDateString()}</td><td className="px-6 py-4">{formatCurrency(q.total)}</td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${q.status === 'draft' ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' : 'bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-300'}`}>
                                    {q.status === 'draft' ? 'Borrador' : 'Activa'}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right flex justify-end gap-1">
                                {hasPermission('quotes', 'write') && <>
                                    <Tooltip title="Crear una nueva cotización basada en esta."><Button variant="ghost" size="sm" onClick={() => startNewQuote(q)}><DocumentDuplicateIcon/></Button></Tooltip>
                                    <Tooltip title="Editar esta cotización."><Button variant="ghost" size="sm" onClick={() => handleEditQuote(q)}><PencilIcon/></Button></Tooltip>
                                    <Tooltip title="Eliminar esta cotización."><Button variant="ghost" size="sm" onClick={() => handleDeleteQuote(q.id)}><TrashIcon/></Button></Tooltip>
                                </>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
         </div>
         <ClientSelectionModal isOpen={clientModalOpen} onClose={() => setClientModalOpen(false)} clients={clients || []} onConfirm={(client) => { setPdfClientOverride(client); setClientModalOpen(false); setIsCompanySelectModalOpen(true); }} />
         <CompanySelectionModal
            isOpen={isCompanySelectModalOpen}
            onClose={() => setIsCompanySelectModalOpen(false)}
            companies={settings?.companies || []}
            onConfirm={(selectedCompany) => {
                const clientOverride = selectedQuoteIds.size > 1 ? pdfClientOverride : undefined;
                onCompanySelectedForPdf(selectedCompany, clientOverride);
            }}
         />
    </div>
  );
  
  if (loading) return <div className="flex justify-center p-8"><Spinner /></div>;
  if (error) return <Alert type="error" message={`Error al cargar cotizaciones: ${error.message}`} />;

  return screen === 'list' 
    ? renderList() 
    : <QuoteForm initialQuote={currentQuote} onSaveSuccess={() => { refetch(); setScreen('list'); }} onCancel={() => setScreen('list')} />;
};

const QuoteForm: React.FC<{ initialQuote: Partial<Quotation>, onSaveSuccess: () => void, onCancel: () => void }> = ({ initialQuote, onSaveSuccess, onCancel }) => {
    const [quote, setQuote] = useState<Partial<Quotation>>(initialQuote);
    const { settings } = useAppContext();
    const { saveItem } = useApiService();
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isDraftConfirmModalOpen, setIsDraftConfirmModalOpen] = useState(false);
    const [expiredItemsForModal, setExpiredItemsForModal] = useState<CatalogItem[]>([]);
    
    const { data: clients } = useApi<Client>('clients');
    const { data: catalogItems } = useApi<CatalogItem>('catalogItems');
    const { data: labors } = useApi<Labor>('labor');

    const calculateTotals = useCallback(() => {
        if (!settings || !quote.items || !quote.labors || !quote.garmentQuantity) return;
        const { garmentQuantity, items, labors, selectedTaxIds } = quote;
        const itemsCost = items.reduce((acc, item) => acc + item.totalCost, 0);
        const laborsCost = labors.reduce((acc, item) => acc + item.totalCost, 0);
        const subtotal = (itemsCost + laborsCost) * garmentQuantity;
        const tier = [...settings.profitMarginTiers].sort((a,b) => b.minQty - a.minQty).find(t => garmentQuantity >= t.minQty) || { margin: 0 };
        const profitAmount = subtotal * tier.margin;
        const profitMarginApplied = { margin: tier.margin, amount: profitAmount };
        const baseForTax = subtotal + profitAmount;
        const taxesApplied = settings.taxes.filter(t => selectedTaxIds?.includes(t.id)).map(t => ({ name: t.name, rate: t.rate, amount: baseForTax * t.rate }));
        const totalTaxAmount = taxesApplied.reduce((sum, tax) => sum + tax.amount, 0);
        const total = baseForTax + totalTaxAmount;
        setQuote(prev => ({ ...prev, subtotal, profitMarginApplied, taxesApplied, total }));
    }, [quote.items, quote.labors, quote.garmentQuantity, settings, quote.selectedTaxIds]);

    useEffect(() => { calculateTotals(); }, [calculateTotals]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'client') {
            setQuote(prev => ({...prev, client: clients?.find(c => c.id === value)}));
        } else if (name === 'garmentQuantity') {
            setQuote(prev => ({...prev, garmentQuantity: parseInt(value, 10) || 1}));
        } else {
            setQuote(prev => ({ ...prev, [name]: value }));
        }
    };
    
    const performSave = async (status: 'active' | 'draft') => {
        const quoteToSave: Quotation = {
            id: quote.id || '',
            code: quote.code || '',
            name: quote.garmentName || 'Sin Nombre',
            garmentName: quote.garmentName || '',
            garmentQuantity: quote.garmentQuantity || 1,
            client: quote.client!,
            createdAt: quote.createdAt || new Date().toISOString(),
            referenceImages: quote.referenceImages || [],
            items: quote.items || [],
            labors: quote.labors || [],
            presentationText: quote.presentationText || '',
            subtotal: quote.subtotal || 0,
            profitMarginApplied: quote.profitMarginApplied || { margin: 0, amount: 0 },
            selectedTaxIds: quote.selectedTaxIds || [],
            taxesApplied: quote.taxesApplied || [],
            total: quote.total || 0,
            status: status,
        };
        
        await saveItem('quotations', quoteToSave);
        onSaveSuccess();
    };

    const handleSave = async () => {
        const validationErrors: string[] = [];
        if (!quote.garmentName?.trim()) validationErrors.push('Nombre de la Prenda');
        if (!quote.garmentQuantity || quote.garmentQuantity <= 0) validationErrors.push('Cantidad (debe ser mayor a 0)');
        if (!quote.client) validationErrors.push('Cliente');
        if (!quote.items || quote.items.length === 0) validationErrors.push('al menos un Material/Insumo');
        if (!quote.labors || quote.labors.length === 0) validationErrors.push('al menos un tipo de Mano de Obra');
        if (!quote.referenceImages || quote.referenceImages.length === 0) validationErrors.push('al menos una Imagen de Referencia');
        if (!quote.selectedTaxIds || quote.selectedTaxIds.length === 0) validationErrors.push('al menos un Impuesto');


        if (validationErrors.length > 0) {
            alert(`Por favor, complete los siguientes campos obligatorios:\n\n- ${validationErrors.join('\n- ')}`);
            return;
        }

        const expiredItems = (quote.items || []).filter(i => isPriceExpired(i.itemSnapshot as CatalogItem)).map(i => i.itemSnapshot as CatalogItem);
        const isDraft = expiredItems.length > 0;
        
        if (isDraft) {
            setExpiredItemsForModal(expiredItems);
            setIsDraftConfirmModalOpen(true);
            return;
        }
        
        await performSave('active');
    };
    
    const handleConfirmDraftSave = async () => {
        setIsDraftConfirmModalOpen(false);
        await performSave('draft');
    };

    const handleAddItem = (type: 'items'|'labors', itemId: string) => {
        if (!itemId) return;
        const list = (type === 'items' ? catalogItems : labors) || [];
        const itemToAdd = list.find(i => i.id === itemId);
        const currentItems = quote[type] || [];
        if (itemToAdd && !currentItems.some(i => i.itemId === itemId)) {
            const newItem = {
                itemId: itemToAdd.id, itemSnapshot: itemToAdd, quantity: 1,
                totalCost: 'unitCost' in itemToAdd ? itemToAdd.unitCost : (itemToAdd as Labor).hourlyRate
            };
            setQuote(prev => ({...prev, [type]: [...currentItems, newItem] as any}));
        }
    };

    const handleItemQuantityChange = (type: 'items'|'labors', itemId: string, quantity: number) => {
        const currentItems = quote[type] || [];
        const updatedItems = currentItems.map(item => {
            if (item.itemId === itemId) {
                const cost = 'unitCost' in item.itemSnapshot ? (item.itemSnapshot as CatalogItem).unitCost : (item.itemSnapshot as Labor).hourlyRate;
                return {...item, quantity, totalCost: cost * quantity };
            }
            return item;
        });
        setQuote(prev => ({...prev, [type]: updatedItems as any}));
    };

    const handleRemoveItem = (type: 'items'|'labors', itemId: string) => {
        setQuote(prev => ({...prev, [type]: (prev[type] || []).filter(i => i.itemId !== itemId) as any}));
    };

    const handleTaxSelectionChange = (taxId: string) => {
        setQuote(prev => {
            const selected = prev.selectedTaxIds || [];
            const newSelected = selected.includes(taxId) ? selected.filter(id => id !== taxId) : [...selected, taxId];
            return { ...prev, selectedTaxIds: newSelected };
        });
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            Array.from(e.target.files).forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setQuote(prev => ({ ...prev, referenceImages: [...(prev.referenceImages || []), reader.result as string] }));
                };
                reader.readAsDataURL(file);
            });
        }
    };
    const handleImageCapture = (imageDataUrl: string) => {
        setQuote(prev => ({ ...prev, referenceImages: [...(prev.referenceImages || []), imageDataUrl] }));
        setIsCameraOpen(false);
    };
    const handleRemoveImage = (index: number) => {
        setQuote(prev => ({ ...prev, referenceImages: (prev.referenceImages || []).filter((_, i) => i !== index) }));
    };
    
    return (
        <div className="bg-white dark:bg-slate-800 shadow-md rounded-lg p-6 max-w-6xl mx-auto">
            <h2 className="text-xl font-bold mb-4">{quote.id ? `Editar Cotización ${quote.code}` : 'Crear Nueva Cotización'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input name="garmentName" label="Nombre de la Prenda" value={quote.garmentName || ''} onChange={handleChange} required/>
                <Input name="garmentQuantity" type="number" label="Cantidad" value={quote.garmentQuantity || 1} onChange={handleChange} required/>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cliente</label>
                    <select name="client" value={quote.client?.id || ''} onChange={handleChange} required className="block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md">
                        <option value="">Seleccione un cliente</option>
                        {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="mt-8 space-y-6">
                <ItemsManager title="Materiales e Insumos" items={quote.items || []} catalog={catalogItems || []} onAdd={(id) => handleAddItem('items', id)} onQtyChange={(id, qty) => handleItemQuantityChange('items', id, qty)} onRemove={(id) => handleRemoveItem('items', id)} />
                <ItemsManager title="Mano de Obra" items={quote.labors || []} catalog={labors || []} onAdd={(id) => handleAddItem('labors', id)} onQtyChange={(id, qty) => handleItemQuantityChange('labors', id, qty)} onRemove={(id) => handleRemoveItem('labors', id)} />
            </div>

            <div className="mt-8">
                <h3 className="font-semibold mb-2">Imágenes de Referencia</h3>
                <div className="flex items-center gap-4">
                    <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                    <Button type="button" onClick={() => setIsCameraOpen(true)}>Tomar Foto</Button>
                </div>
                <div className="mt-4 flex flex-wrap gap-4">
                    {quote.referenceImages?.map((imgSrc, index) => (
                        <div key={index} className="relative group">
                            <img src={imgSrc} className="h-24 w-24 object-cover rounded-md" />
                            <button onClick={() => handleRemoveImage(index)} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 leading-none text-xs opacity-0 group-hover:opacity-100 transition-opacity">✖</button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="font-semibold mb-2">Impuestos Aplicables</h3>
                    <div className="flex flex-col gap-2">
                        {settings?.taxes.length === 0 && <p className="text-sm text-slate-500">No hay impuestos configurados.</p>}
                        {settings?.taxes.map(tax => (
                            <div key={tax.id} className="flex items-center">
                                <input type="checkbox" id={`tax-${tax.id}`} checked={quote.selectedTaxIds?.includes(tax.id)} onChange={() => handleTaxSelectionChange(tax.id)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
                                <label htmlFor={`tax-${tax.id}`} className="ml-2 block text-sm text-gray-900 dark:text-gray-300">{tax.name} ({(tax.rate * 100).toFixed(2)}%)</label>
                            </div>
                        ))}
                    </div>
                </div>
                <div 
                    className="p-4 rounded-lg"
                    style={{ 
                        backgroundColor: 'var(--color-summary-bg)',
                        color: 'var(--color-summary-text)'
                    }}
                >
                    <h3 className="font-bold text-lg mb-2">Resumen de Costos</h3>
                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(quote.subtotal || 0)}</span></div>
                        <div className="flex justify-between"><span>Ganancia ({((quote.profitMarginApplied?.margin || 0) * 100).toFixed(0)}%):</span><span>{formatCurrency(quote.profitMarginApplied?.amount || 0)}</span></div>
                        {quote.taxesApplied?.map(tax => <div key={tax.name} className="flex justify-between"><span>{tax.name} ({(tax.rate * 100).toFixed(2)}%):</span><span>{formatCurrency(tax.amount)}</span></div>)}
                        <div className="flex justify-between font-bold text-base pt-2 border-t mt-2 dark:border-slate-700"><span>TOTAL:</span><span>{formatCurrency(quote.total || 0)}</span></div>
                    </div>
                </div>
            </div>

            <div className="mt-8 flex justify-end gap-4">
                <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
                <Button onClick={handleSave}>Guardar Cotización</Button>
            </div>
            
            <Modal isOpen={isDraftConfirmModalOpen} onClose={() => setIsDraftConfirmModalOpen(false)} title="Precios Expirados Detectados" footer={
                <>
                    <Button variant="secondary" onClick={() => setIsDraftConfirmModalOpen(false)}>Cancelar</Button>
                    <Button onClick={handleConfirmDraftSave}>Guardar Borrador</Button>
                </>
            }>
                <div className="space-y-3">
                    <p>Los siguientes materiales tienen precios desactualizados:</p>
                    <ul className="list-disc list-inside text-sm font-semibold text-yellow-700 dark:text-yellow-400 max-h-32 overflow-y-auto">
                        {expiredItemsForModal.map(item => <li key={item.id}>{item.name}</li>)}
                    </ul>
                    <p>¿Desea guardar esta cotización como un borrador en "Cotizaciones Pendientes" para actualizarlos más tarde?</p>
                </div>
            </Modal>
            
            <CameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleImageCapture} />
        </div>
    );
};

const ItemsManager: React.FC<{title: string, items: QuotationItem<any>[], catalog: BaseItem[], onAdd: (id: string) => void, onQtyChange: (id:string, qty: number) => void, onRemove: (id:string) => void}> = ({title, items, catalog, onAdd, onQtyChange, onRemove}) => {
    const { settings } = useAppContext();
    const [filters, setFilters] = useState({ name: '', category: '', color: '', unit: '' });
    const [showFilters, setShowFilters] = useState(false);
    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const filteredCatalog = useMemo(() => {
        return (catalog as (CatalogItem | Labor)[]).filter(item => {
            const isCatalogItem = 'category' in item;
            return item.name.toLowerCase().includes(filters.name.toLowerCase()) &&
                (!isCatalogItem || filters.category === '' || item.category === filters.category) &&
                (!isCatalogItem || filters.color === '' || item.color.toLowerCase().includes(filters.color.toLowerCase())) &&
                (!isCatalogItem || filters.unit === '' || item.unit === filters.unit);
        });
    }, [catalog, filters]);

    return (
        <div className="border rounded-lg dark:border-slate-700 overflow-hidden">
             <h3 
                className="font-semibold p-3"
                style={{
                    backgroundColor: 'var(--color-card-header-bg, #e2e8f0)',
                    color: 'var(--color-card-header-text, #334155)'
                }}
            >{title}</h3>
            <div className="p-4">
                <div className="flex gap-2 my-2 items-center">
                    <select onChange={(e) => { onAdd(e.target.value); e.target.value = ''; }} className="flex-grow block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md">
                        <option value="">Añadir {title.toLowerCase().slice(0, -1)}...</option>
                        {filteredCatalog.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                    </select>
                    {title.includes("Materiales") && <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}><FunnelIcon/></Button>}
                </div>
                 {showFilters && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-md mb-2">
                        <Input name="name" placeholder="Filtrar por nombre..." value={filters.name} onChange={handleFilterChange} />
                        <select name="category" value={filters.category} onChange={handleFilterChange} className="block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md"><option value="">Categorías</option>{settings?.itemCategories.map(c => <option key={c} value={c}>{c}</option>)}</select>
                        <Input name="color" placeholder="Filtrar por color..." value={filters.color} onChange={handleFilterChange} />
                        <select name="unit" value={filters.unit} onChange={handleFilterChange} className="block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md"><option value="">Unidades</option>{settings?.units.map(u => <option key={u} value={u}>{u}</option>)}</select>
                    </div>
                )}
                {items.map((item, index) => {
                    const isCatalog = 'unitCost' in item.itemSnapshot;
                    const lowStock = isCatalog && (item.itemSnapshot as CatalogItem).stockQuantity <= (item.itemSnapshot as CatalogItem).lowStockThreshold;
                    return(
                    <div key={item.itemId} className="grid grid-cols-[auto_1fr_100px_80px_80px_auto] gap-x-4 gap-y-1 items-center text-sm mb-1">
                        <span className="font-medium">{index + 1}.</span>
                        <span className="">{item.itemSnapshot.name} 
                            {isCatalog && isPriceExpired(item.itemSnapshot) && <span className="text-yellow-500 ml-1 text-xs">(exp)</span>}
                            {lowStock && <span className="text-red-500 ml-1 text-xs">(stock bajo)</span>}
                        </span>
                        <span className="">{formatCurrency(isCatalog ? (item.itemSnapshot as CatalogItem).unitCost : (item.itemSnapshot as Labor).hourlyRate)} / {isCatalog ? (item.itemSnapshot as CatalogItem).unit : 'hora'}</span>
                        <Input type="number" value={item.quantity} onChange={e => onQtyChange(item.itemId, parseFloat(e.target.value) || 0)} />
                        <span className="text-right">{formatCurrency(item.totalCost)}</span>
                        <Button variant="ghost" size="sm" onClick={() => onRemove(item.itemId)}><TrashIcon/></Button>
                    </div>
                )})}
            </div>
        </div>
    );
}

const ClientSelectionModal: React.FC<{isOpen: boolean, onClose: () => void, clients: Client[], onConfirm: (client: Client) => void}> = ({isOpen, onClose, clients, onConfirm}) => {
    const [selectedClientId, setSelectedClientId] = useState('');
    const handleConfirm = () => { const client = clients.find(c => c.id === selectedClientId); if(client) onConfirm(client); }
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Seleccionar Cliente para PDF">
            <div className="space-y-4">
                <p>Ha seleccionado varias cotizaciones. Por favor, elija un cliente para este PDF consolidado.</p>
                <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} className="block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md">
                    <option value="">Seleccione un cliente</option> {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="flex justify-end"> <Button onClick={handleConfirm} disabled={!selectedClientId}>Continuar</Button> </div>
            </div>
        </Modal>
    );
};

const CameraModal: React.FC<{ isOpen: boolean, onClose: () => void, onCapture: (dataUrl: string) => void }> = ({ isOpen, onClose, onCapture }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);

    useEffect(() => {
        if (isOpen) {
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(stream => {
                    setStream(stream);
                    if (videoRef.current) { videoRef.current.srcObject = stream; }
                })
                .catch(err => console.error("Error accessing camera:", err));
        } else if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        return () => { stream?.getTracks().forEach(track => track.stop()); };
    }, [isOpen]);

    const handleCapture = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            onCapture(canvas.toDataURL('image/png'));
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Tomar Foto">
            <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: '8px' }}></video>
            <div className="flex justify-center mt-4"><Button onClick={handleCapture}>Capturar</Button></div>
        </Modal>
    );
};


const CustomerQuotePDF: React.FC<{ quotes: Quotation[], company: Company, clientOverride?: Client }> = ({ quotes, company, clientOverride }) => {
    const client = clientOverride || (quotes.length === 1 ? quotes[0].client : null);
    const singleQuote = quotes.length === 1 ? quotes[0] : null;

    return (
        <div className="pdf-content" style={{ fontFamily: 'sans-serif', color: 'black', backgroundColor: 'white', padding: '20mm', boxSizing: 'border-box', position: 'relative', width: '210mm' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #333', paddingBottom: '10px' }}>
                {company.companyLogo && <img src={company.companyLogo} alt="logo" style={{ maxHeight: '80px', maxWidth: '200px' }} />}
                <div>
                    <h1 style={{ margin: 0, fontSize: '24px', textAlign: 'right', color: 'black' }}>COTIZACIÓN</h1>
                    <p style={{ margin: 0, textAlign: 'right', color: 'black' }}>{company.name}</p>
                    <p style={{ margin: 0, textAlign: 'right', color: 'black' }}>NIT: {company.nit}</p>
                    <p style={{ margin: 0, textAlign: 'right', color: 'black' }}>{quotes.length > 1 ? 'Múltiples' : quotes[0]?.code}</p>
                    <p style={{ margin: 0, textAlign: 'right', color: 'black' }}>Fecha: {new Date().toLocaleDateString()}</p>
                </div>
            </header>
            <main style={{ marginTop: '15mm' }}>
                 {client && <div>
                    <h2 style={{fontSize: '14px', marginBottom: '5px', color: 'black', fontWeight: 'bold'}}>Cliente:</h2>
                    <p style={{ margin: 0, color: 'black' }}>{client.name}</p>
                    <p style={{ margin: 0, color: 'black' }}>{client.contactPerson}</p>
                 </div>}
                 <p style={{marginTop: '10mm', color: 'black', fontSize: '12px'}}>{singleQuote?.presentationText || company.defaultPresentationText}</p>
                
                 <table style={{ width: '100%', marginTop: '10mm', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead style={{ backgroundColor: '#f2f2f2' }}>
                        <tr>
                            <th style={{padding: '8px', border: '1px solid #ddd', textAlign: 'left', color: 'black'}}>Prenda</th>
                            <th style={{padding: '8px', border: '1px solid #ddd', textAlign: 'right', color: 'black'}}>Cantidad</th>
                            <th style={{padding: '8px', border: '1px solid #ddd', textAlign: 'right', color: 'black'}}>Valor Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {quotes.map(q => (
                            <tr key={q.id}>
                                <td style={{padding: '8px', border: '1px solid #ddd', color: 'black'}}>{q.garmentName}</td>
                                <td style={{padding: '8px', border: '1px solid #ddd', textAlign: 'right', color: 'black'}}>{q.garmentQuantity}</td>
                                <td style={{padding: '8px', border: '1px solid #ddd', textAlign: 'right', color: 'black'}}>{formatCurrency(q.total)}</td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
                 
                 {singleQuote && (
                    <div style={{width: '40%', marginLeft: '60%', marginTop: '10mm', fontSize: '12px'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between'}}><span style={{color: 'black'}}>Base:</span> <span style={{color: 'black'}}>{formatCurrency(singleQuote.subtotal + singleQuote.profitMarginApplied.amount)}</span></div>
                        {singleQuote.taxesApplied.map(tax => (
                            <div key={tax.name} style={{display: 'flex', justifyContent: 'space-between'}}><span style={{color: 'black'}}>{tax.name} ({ (tax.rate * 100).toFixed(2) }%):</span> <span style={{color: 'black'}}>{formatCurrency(tax.amount)}</span></div>
                        ))}
                        <div style={{display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid #333', marginTop: '5px', paddingTop: '5px'}}><span style={{color: 'black'}}>TOTAL:</span> <span style={{color: 'black'}}>{formatCurrency(singleQuote.total)}</span></div>
                    </div>
                 )}

                {singleQuote?.referenceImages && singleQuote.referenceImages.length > 0 && (
                    <div style={{marginTop: '15mm'}}>
                        <h3 style={{fontSize: '14px', color: 'black', borderBottom: '1px solid #ccc', paddingBottom: '5px', marginBottom: '10px'}}>Imágenes de Referencia</h3>
                        <div style={{display: 'flex', flexWrap: 'wrap', gap: '10px'}}>
                            {singleQuote.referenceImages.map((src, i) => <img key={i} src={src} style={{width: '100px', height: '100px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #ddd'}} />)}
                        </div>
                    </div>
                )}
                 
                 {company.watermarkImage && <img src={company.watermarkImage} alt="watermark" style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.08, zIndex: 1, maxHeight: '50vh', pointerEvents: 'none'}} />}
                 {company.quoteSealImage && <img src={company.quoteSealImage} alt="seal" style={{position: 'absolute', bottom: '100px', right: '20mm', maxHeight: '100px', opacity: 0.8, zIndex: 2}}/>}
            </main>
            <footer style={{ position: 'absolute', bottom: '20mm', left: '20mm', right: '20mm', textAlign: 'center', fontSize: '12px', borderTop: '1px solid #ccc', paddingTop: '10px', color: 'black' }}>
                {company.quoteFooterText}
            </footer>
        </div>
    );
};
const ProductionOrderPDF: React.FC<{ quotes: Quotation[], appLogo?: string }> = ({ quotes, appLogo }) => {
    const aggregatedItems = useMemo(() => {
        const map = new Map<string, { item: CatalogItem, quantity: number }>();
        quotes.forEach(q => {
            q.items.forEach(qi => {
                const existing = map.get(qi.itemId);
                const totalQuantity = qi.quantity * q.garmentQuantity;
                if(existing) {
                    existing.quantity += totalQuantity;
                } else {
                    map.set(qi.itemId, { item: qi.itemSnapshot, quantity: totalQuantity });
                }
            });
        });
        return Array.from(map.values());
    }, [quotes]);

    return (
        <div className="pdf-content" style={{ width: '210mm', fontFamily: 'sans-serif', color: 'black', backgroundColor: 'white', padding: '20mm', boxSizing: 'border-box', position: 'relative' }}>
             <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #333', paddingBottom: '10px' }}>
                {appLogo && <img src={appLogo} alt="logo" style={{ maxHeight: '80px', maxWidth: '200px' }} />}
                <div>
                    <h1 style={{ margin: 0, fontSize: '24px', textAlign: 'right', color: 'black' }}>ORDEN DE MATERIALES</h1>
                    <p style={{ margin: 0, textAlign: 'right', color: 'black' }}>Fecha: {new Date().toLocaleDateString()}</p>
                </div>
            </header>
            <main>
                <p style={{marginTop: '20px', color: 'black'}}>Consolidado de materiales e insumos para cotizaciones: {quotes.map(q => q.code).join(', ')}</p>
                <table style={{ width: '100%', marginTop: '20px', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#f2f2f2' }}>
                        <tr>
                            <th style={{padding: '8px', border: '1px solid #ddd', textAlign: 'left', color: 'black'}}>Código</th>
                            <th style={{padding: '8px', border: '1px solid #ddd', textAlign: 'left', color: 'black'}}>Item</th>
                            <th style={{padding: '8px', border: '1px solid #ddd', textAlign: 'left', color: 'black'}}>Tipo</th>
                            <th style={{padding: '8px', border: '1px solid #ddd', textAlign: 'right', color: 'black'}}>Cantidad Total</th>
                             <th style={{padding: '8px', border: '1px solid #ddd', textAlign: 'left', color: 'black'}}>Unidad</th>
                        </tr>
                    </thead>
                    <tbody>
                        {aggregatedItems.map(({item, quantity}) => (
                            <tr key={item.id}>
                                <td style={{padding: '8px', border: '1px solid #ddd', color: 'black'}}>{item.code}</td>
                                <td style={{padding: '8px', border: '1px solid #ddd', color: 'black'}}>{item.name}</td>
                                <td style={{padding: '8px', border: '1px solid #ddd', color: 'black'}}>{item.type}</td>
                                <td style={{padding: '8px', border: '1px solid #ddd', textAlign: 'right', color: 'black'}}>{quantity}</td>
                                <td style={{padding: '8px', border: '1px solid #ddd', color: 'black'}}>{item.unit}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </main>
        </div>
    );
};

const CompanySelectionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    companies: Company[];
    onConfirm: (company: Company) => void;
}> = ({ isOpen, onClose, companies, onConfirm }) => {
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

    useEffect(() => {
        if (isOpen && companies.length > 0) {
            if (!companies.find(c => c.id === selectedCompanyId)) {
                setSelectedCompanyId(companies[0].id);
            }
        }
    }, [isOpen, companies, selectedCompanyId]);

    const handleConfirm = () => {
        const company = companies.find(c => c.id === selectedCompanyId);
        if (company) {
            onConfirm(company);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Seleccionar Empresa">
            <div className="space-y-4">
                <p>Seleccione la empresa que emitirá este documento.</p>
                <select value={selectedCompanyId} onChange={e => setSelectedCompanyId(e.target.value)} className="block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md">
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="flex justify-end">
                    <Button onClick={handleConfirm} disabled={!selectedCompanyId}>Continuar</Button>
                </div>
            </div>
        </Modal>
    );
};


export default QuotesView;