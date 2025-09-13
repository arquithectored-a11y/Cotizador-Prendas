
import React, { useState, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { CatalogItem, Quotation } from '../types';
import Spinner from '../components/Spinner';
import Alert from '../components/Alert';
import Button from '../components/Button';
import Input from '../components/Input';
import Modal from '../components/Modal';
import { useAppContext } from '../context/AppContext';
import { useApiService } from '../hooks/useApiService';
import { PlusCircleIcon, TrashIcon, ArchiveBoxArrowDownIcon, FunnelIcon, PencilIcon, ViewGridIcon, ViewListIcon } from '../components/Icons';
import { formatCurrency } from '../utils/formatting';
import Tooltip from '../components/Tooltip';

const isPriceExpired = (item: CatalogItem): boolean => {
  const updatedAt = new Date(item.updatedAt);
  const expiryDate = new Date(new Date(updatedAt).setDate(updatedAt.getDate() + item.priceValidityDays));
  return new Date() > expiryDate;
};

const CatalogView = (): React.ReactElement => {
  const { data, loading, error, refetch } = useApi<CatalogItem>('catalogItems');
  const { data: quotes } = useApi<Quotation>('quotations');
  const { settings, hasPermission } = useAppContext();
  const { saveItem, deleteItem, addStock } = useApiService();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({ category: '', color: '', unit: '', supplier: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [catalogLayout, setCatalogLayout] = useState<'grid' | 'list'>('list');
  const [specialFilter, setSpecialFilter] = useState<'all' | 'priority' | 'expired'>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<CatalogItem | null>(null);
  const [currentItem, setCurrentItem] = useState<Partial<CatalogItem> | null>(null);
  const [originalItem, setOriginalItem] = useState<Partial<CatalogItem> | null>(null);
  const [stockToAdd, setStockToAdd] = useState(0);

  const canEdit = useMemo(() => hasPermission('catalog', 'write'), [hasPermission]);

  const priorityItemIds = useMemo(() => {
    const draftQuotes = quotes?.filter(q => q.status === 'draft') || [];
    const ids = new Set<string>();
    draftQuotes.forEach(quote => {
        quote.items.forEach(item => {
            if (isPriceExpired(item.itemSnapshot as CatalogItem)) {
                ids.add(item.itemId);
            }
        });
    });
    return ids;
  }, [quotes]);
  
  const filteredData = useMemo(() => {
    if (!data) return [];
    
    let speciallyFilteredData = data;
    if (specialFilter === 'expired') {
        speciallyFilteredData = data.filter(isPriceExpired);
    } else if (specialFilter === 'priority') {
        speciallyFilteredData = data.filter(item => isPriceExpired(item) && priorityItemIds.has(item.id));
    }

    return speciallyFilteredData.filter(item =>
      (item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.code.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filters.category === '' || item.category === filters.category) &&
      (filters.color === '' || item.color.toLowerCase().includes(filters.color.toLowerCase())) &&
      (filters.unit === '' || item.unit === filters.unit) &&
      (filters.supplier === '' || item.supplier.toLowerCase().includes(filters.supplier.toLowerCase()))
    );
  }, [data, searchTerm, filters, specialFilter, priorityItemIds]);

  const handleOpenModal = (item: Partial<CatalogItem> | null) => {
    const itemData = item || { priceValidityDays: settings?.defaultPriceValidityDays || 30, unitCost: 0, color: '', stockQuantity: 0, lowStockThreshold: 5, type: 'Material' };
    setCurrentItem(JSON.parse(JSON.stringify(itemData)));
    setOriginalItem(item);
    setIsModalOpen(true);
  };
  
  const handleOpenStockModal = (e: React.MouseEvent, item: CatalogItem) => {
    e.stopPropagation();
    setCurrentItem(item);
    setStockToAdd(0);
    setIsStockModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsStockModalOpen(false);
    setCurrentItem(null);
    setOriginalItem(null);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentItem) return;

    let itemToSave: CatalogItem;
    const costChanged = originalItem ? originalItem.unitCost !== currentItem.unitCost : true;

    if (costChanged) {
        itemToSave = { ...currentItem, updatedAt: new Date().toISOString() } as CatalogItem;
    } else {
        itemToSave = { ...currentItem, updatedAt: originalItem?.updatedAt } as CatalogItem;
    }
    
    await saveItem('catalogItems', itemToSave);
    refetch();
    handleCloseModal();
  };
  
  const handleAddStock = async () => {
    if(!currentItem?.id || stockToAdd <= 0) return;
    await addStock(currentItem.id, stockToAdd);
    refetch();
    handleCloseModal();
  };
  
  const openDeleteConfirmation = (e: React.MouseEvent, item: CatalogItem) => {
    e.stopPropagation();
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      await deleteItem('catalogItems', itemToDelete.id);
      refetch();
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    }
  };


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isNumber = type === 'number';
    setCurrentItem(prev => ({ ...prev, [name]: isNumber ? parseFloat(value) || 0 : value } as Partial<CatalogItem>));
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCurrentItem(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Spinner /></div>;
  if (error) return <Alert type="error" message={`Error al cargar datos: ${error.message}`} />;

  const renderContent = () => {
    if (catalogLayout === 'list') {
      return (
        <div className="overflow-x-auto bg-white dark:bg-slate-800 shadow-md rounded-lg">
          <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Imagen</th>
                <th className="px-6 py-3">Código</th>
                <th className="px-6 py-3">Nombre</th>
                <th className="px-6 py-3">Categoría</th>
                <th className="px-6 py-3 text-right">Stock</th>
                <th className="px-6 py-3 text-right">Costo</th>
                <th className="px-6 py-3">Proveedor</th>
                <th className="px-6 py-3">Actualizado</th>
                {canEdit && <th className="px-6 py-3 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {filteredData.map(item => (
                <tr 
                  key={item.id} 
                  className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600"
                  style={{ cursor: canEdit ? 'pointer' : 'default' }}
                >
                  <td className="px-4 py-2" onClick={canEdit ? () => handleOpenModal(item) : undefined}>
                    {item.image ? <img src={item.image} alt={item.name} className="h-10 w-10 object-cover rounded"/> : <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded"/>}
                  </td>
                  <td className="px-6 py-4 font-medium" onClick={canEdit ? () => handleOpenModal(item) : undefined}>{item.code}</td>
                  <td className="px-6 py-4" onClick={canEdit ? () => handleOpenModal(item) : undefined}>
                    {item.name}
                    {isPriceExpired(item) && <span className="text-yellow-500 ml-1 text-xs">(exp)</span>}
                    {item.stockQuantity <= item.lowStockThreshold && <span className="text-red-500 ml-1 text-xs">(bajo)</span>}
                  </td>
                  <td className="px-6 py-4" onClick={canEdit ? () => handleOpenModal(item) : undefined}>{item.category}</td>
                  <td className="px-6 py-4 text-right" onClick={canEdit ? () => handleOpenModal(item) : undefined}>{item.stockQuantity}</td>
                  <td className="px-6 py-4 text-right" onClick={canEdit ? () => handleOpenModal(item) : undefined}>{formatCurrency(item.unitCost)}/{item.unit}</td>
                  <td className="px-6 py-4" onClick={canEdit ? () => handleOpenModal(item) : undefined}>{item.supplier}</td>
                  <td className="px-6 py-4" onClick={canEdit ? () => handleOpenModal(item) : undefined}>{new Date(item.updatedAt).toLocaleDateString()}</td>
                  {canEdit && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenModal(item)} title="Editar"><PencilIcon/></Button>
                        <Button variant="ghost" size="sm" onClick={(e) => handleOpenStockModal(e, item)} title="Añadir Stock"><ArchiveBoxArrowDownIcon/></Button>
                        <Button variant="ghost" size="sm" onClick={(e) => openDeleteConfirmation(e, item)} title="Eliminar"><TrashIcon/></Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredData.map(item => (
          <div 
            key={item.id} 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-md overflow-hidden transform hover:-translate-y-1 transition-transform duration-200 group flex flex-col"
            onClick={canEdit ? () => handleOpenModal(item) : undefined}
            style={{ cursor: canEdit ? 'pointer' : 'default' }}
          >
            {item.image ? (
                <img src={item.image} alt={item.name} className="h-40 w-full object-cover"/>
            ) : (
                <div className="h-40 w-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500">Sin imagen</div>
            )}
            <div className="p-4 relative flex-grow">
              <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-1 rounded-full">{item.type}</span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-2">{item.code} - {item.name}</h3>
                  </div>
                   {item.stockQuantity <= item.lowStockThreshold && 
                    <span className="text-xs font-bold text-red-800 bg-red-200 dark:text-red-200 dark:bg-red-900/80 px-2 py-1 rounded-full">Stock Bajo</span>
                   }
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{item.category} - {item.color}</p>
              <div className="mt-4 space-y-2 text-sm">
                <p><strong>Costo:</strong> {formatCurrency(item.unitCost)} / {item.unit}</p>
                <p><strong>Proveedor:</strong> {item.supplier}</p>
                <p><strong>Actualizado:</strong> {new Date(item.updatedAt).toLocaleDateString()}</p>
                 <p><strong>Stock:</strong> {item.stockQuantity} unidades</p>
              </div>
              {isPriceExpired(item) && <Alert type="warning" message="El precio ha expirado." />}
              {canEdit && (
                <div className="absolute top-2 right-2 flex opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" onClick={(e) => openDeleteConfirmation(e, item)}><TrashIcon/></Button>
                </div>
              )}
            </div>
             {canEdit && (
                <div className="bg-slate-50 dark:bg-slate-800/50 p-2 text-center">
                    <Button variant="secondary" size="sm" onClick={(e) => handleOpenStockModal(e, item)}>
                        <ArchiveBoxArrowDownIcon/>
                        <span className="ml-2">Añadir Stock</span>
                    </Button>
                </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
            <Input 
              type="text"
              placeholder="Buscar por código, nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-xs"
            />
            <Button variant="ghost" onClick={() => setShowFilters(!showFilters)}><FunnelIcon/></Button>

            <div className="flex items-center border rounded-md p-1 bg-slate-100 dark:bg-slate-700 ml-4">
              <Tooltip title="Todos los Items"><Button variant={specialFilter === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => setSpecialFilter('all')}>Todos</Button></Tooltip>
              <Tooltip title="Items con precio expirado que bloquean una cotización"><Button variant={specialFilter === 'priority' ? 'secondary' : 'ghost'} size="sm" onClick={() => setSpecialFilter('priority')}>Prioritarios</Button></Tooltip>
              <Tooltip title="Todos los items con precio expirado"><Button variant={specialFilter === 'expired' ? 'secondary' : 'ghost'} size="sm" onClick={() => setSpecialFilter('expired')}>Expirados</Button></Tooltip>
            </div>

            <div className="flex items-center border rounded-md p-1 bg-slate-100 dark:bg-slate-700 ml-2">
              <Tooltip title="Vista de Cuadrícula">
                <Button variant={catalogLayout === 'grid' ? 'secondary' : 'ghost'} size="sm" onClick={() => setCatalogLayout('grid')}><ViewGridIcon/></Button>
              </Tooltip>
              <Tooltip title="Vista de Lista">
                <Button variant={catalogLayout === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setCatalogLayout('list')}><ViewListIcon/></Button>
              </Tooltip>
            </div>
        </div>
        {canEdit && (
          <Button onClick={() => handleOpenModal(null)}>
            <PlusCircleIcon /> <span className="ml-2">Añadir Nuevo</span>
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg mb-4">
            <SelectFilter name="category" value={filters.category} onChange={setFilters} options={settings?.itemCategories || []} label="Categoría" />
            <Input placeholder="Color..." name="color" value={filters.color} onChange={(e) => setFilters(p => ({...p, color: e.target.value}))} />
            <SelectFilter name="unit" value={filters.unit} onChange={setFilters} options={settings?.units || []} label="Unidad" />
            <Input placeholder="Proveedor..." name="supplier" value={filters.supplier} onChange={(e) => setFilters(p => ({...p, supplier: e.target.value}))} />
        </div>
      )}

      {renderContent()}

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={currentItem?.id ? `Editar Item` : `Añadir Item`}>
         <form onSubmit={handleSave} className="space-y-4">
          <Input label="Código" name="code" value={currentItem?.code || 'Automático'} disabled />
          {currentItem?.image && <img src={currentItem.image} className="h-24 w-auto rounded-md mx-auto" />}
          <Input label="Imagen del Item" name="image" type="file" accept="image/*" onChange={handleFileChange} />
          <Input label="Nombre" name="name" value={currentItem?.name || ''} onChange={handleChange} required />
          <SelectInput label="Tipo" name="type" value={currentItem?.type || ''} onChange={handleChange} options={['Material', 'Insumo']} />
          <SelectInput label="Categoría" name="category" value={currentItem?.category || ''} onChange={handleChange} options={settings?.itemCategories || []} placeholder="Seleccione una categoría"/>
          <Input label="Color" name="color" value={currentItem?.color || ''} onChange={handleChange} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Costo Unitario" name="unitCost" type="number" step="1" value={currentItem?.unitCost || 0} onChange={handleChange} required />
            <SelectInput label="Unidad" name="unit" value={currentItem?.unit || ''} onChange={handleChange} options={settings?.units || []} placeholder="Seleccione una unidad" />
          </div>
          <Input label="Proveedor" name="supplier" value={currentItem?.supplier || ''} onChange={handleChange} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Stock Actual" name="stockQuantity" type="number" value={currentItem?.stockQuantity || 0} onChange={handleChange} required />
            {/* FIX: Removed duplicate name attribute */}
            <Input label="Umbral Stock Bajo" name="lowStockThreshold" type="number" value={currentItem?.lowStockThreshold || 0} onChange={handleChange} required />
          </div>
          <Input label="Validez del Precio (días)" name="priceValidityDays" type="number" value={currentItem?.priceValidityDays || 30} onChange={handleChange} required />
          <div className="flex justify-end pt-4">
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isStockModalOpen} onClose={handleCloseModal} title={`Añadir Stock a ${currentItem?.name}`}>
        <div className="space-y-4">
            <p>Stock Actual: <strong>{currentItem?.stockQuantity}</strong></p>
            <Input label="Cantidad a Añadir" type="number" value={stockToAdd} onChange={e => setStockToAdd(parseInt(e.target.value, 10))} />
            <div className="flex justify-end">
                <Button onClick={handleAddStock}>Añadir</Button>
            </div>
        </div>
      </Modal>
      
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirmar Eliminación" footer={
        <>
            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmDelete}>Eliminar</Button>
        </>
      }>
        <p>¿Está seguro de que desea eliminar el artículo <strong>{itemToDelete?.name}</strong>? Esta acción no se puede deshacer.</p>
      </Modal>
    </div>
  );
};

const SelectFilter: React.FC<{name: string, value: string, onChange: React.Dispatch<React.SetStateAction<any>>, options: string[], label: string}> = ({name, value, onChange, options, label}) => (
    <select name={name} value={value} onChange={(e) => onChange((p: any) => ({...p, [name]: e.target.value}))} className="block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
        <option value="">Todas las {label}s</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
);

const SelectInput: React.FC<{name: string, label: string, value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, options: string[], placeholder?: string}> = ({name, label, value, onChange, options, placeholder}) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
        <select name={name} value={value} onChange={onChange} required className="block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
            {placeholder && <option value="">{placeholder}</option>}
            {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
    </div>
);

export default CatalogView;
