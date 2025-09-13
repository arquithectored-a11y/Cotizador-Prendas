import { AnyItem, ItemKey, Settings, Role, LogEntry, Quotation, BaseItem, CatalogItem, Company, View } from '../types';

const DB_KEYS: Record<ItemKey, string> = {
  catalogItems: 'app_catalog_items',
  labor: 'app_labor',
  clients: 'app_clients',
  settings: 'app_settings',
  quotations: 'app_quotations',
  logs: 'app_logs',
};

const SIMULATED_LATENCY = 300; // ms

const generateId = () => `id_${new Date().getTime()}_${Math.random().toString(36).substr(2, 9)}`;

const CODE_PREFIXES: Record<Exclude<ItemKey, 'settings'|'logs'>, string> = {
    catalogItems: 'CAT',
    labor: 'LBR',
    clients: 'CLI',
    quotations: 'COT'
};

const generateCode = (key: ItemKey, items: BaseItem[]): string => {
    const prefix = CODE_PREFIXES[key as keyof typeof CODE_PREFIXES];
    if (!prefix) return 'N/A';

    const maxNumber = items.reduce((max, item) => {
        if(item.code && item.code.startsWith(prefix + '-')) {
            const num = parseInt(item.code.split('-')[1] || '0', 10);
            return num > max ? num : max;
        }
        return max;
    }, 0);
    return `${prefix}-${String(maxNumber + 1).padStart(4, '0')}`;
}

const seedData = () => {
  const now = new Date().toISOString();
  
  if (!localStorage.getItem(DB_KEYS.catalogItems)) {
    const items: CatalogItem[] = [
      { id: generateId(), code: 'CAT-0001', name: 'Tela de Algodón', type: 'Material', category: 'Tejidos', unit: 'metro', color: 'Blanco', unitCost: 12500, supplier: 'Textiles Inc.', updatedAt: now, priceValidityDays: 30, stockQuantity: 100, lowStockThreshold: 10, image: '' },
      { id: generateId(), code: 'CAT-0002', name: 'Denim 14oz', type: 'Material', category: 'Tejidos', unit: 'metro', color: 'Azul Índigo', unitCost: 18000, supplier: 'Jeans Co.', updatedAt: '2023-01-01T00:00:00.000Z', priceValidityDays: 60, stockQuantity: 50, lowStockThreshold: 5, image: '' },
      { id: generateId(), code: 'CAT-0003', name: 'Botón Metálico', type: 'Insumo', category: 'Botones', unit: 'unidad', color: 'Plata', unitCost: 250, supplier: 'Accesorios Globales', updatedAt: now, priceValidityDays: 45, stockQuantity: 500, lowStockThreshold: 50, image: '' },
      { id: generateId(), code: 'CAT-0004', name: 'Hilo de Poliéster', type: 'Insumo', category: 'Hilos', unit: 'cono', color: 'Negro', unitCost: 5000, supplier: 'Hilos del Sur', updatedAt: '2023-02-01T00:00:00.000Z', priceValidityDays: 120, stockQuantity: 20, lowStockThreshold: 5, image: '' },
    ];
    localStorage.setItem(DB_KEYS.catalogItems, JSON.stringify(items));
  }

  if (!localStorage.getItem(DB_KEYS.labor)) {
     const labor = [
        { id: generateId(), code: 'LBR-0001', name: 'Costurero', role: 'Operativo', hourlyRate: 8500 },
        { id: generateId(), code: 'LBR-0002', name: 'Cortador', role: 'Operativo', hourlyRate: 9000 },
        { id: generateId(), code: 'LBR-0003', name: 'Diseñador', role: 'Diseño', hourlyRate: 25000 },
     ];
     localStorage.setItem(DB_KEYS.labor, JSON.stringify(labor));
  }
  if (!localStorage.getItem(DB_KEYS.clients)) {
    const clients = [
        { id: generateId(), code: 'CLI-0001', name: 'Tienda Moda Rápida', contactPerson: 'Ana Smith', email: 'ana@fmfashion.com', phone: '555-1234' },
        { id: generateId(), code: 'CLI-0002', name: 'Boutique Exclusiva', contactPerson: 'Carlos Gomez', email: 'carlos@exclusivebtq.com', phone: '555-5678' },
    ];
    localStorage.setItem(DB_KEYS.clients, JSON.stringify(clients));
  }
  if (!localStorage.getItem(DB_KEYS.settings)) {
    const defaultCompanyId = generateId();
    const defaultCompany: Company = {
        id: defaultCompanyId,
        name: 'Mi Empresa Principal',
        nit: '123.456.789-0',
        companyLogo: '',
        watermarkImage: '',
        quoteSealImage: '',
        quoteFooterText: 'Precios sujetos a cambio. Válido por 15 días.',
        defaultPresentationText: 'A continuación, presentamos nuestra propuesta comercial para la confección de las prendas solicitadas.',
    };
    
    const allViews: View[] = ['quotes', 'catalog', 'labor', 'clients', 'settings', 'pendingItems', 'logs', 'pendingQuotes'];
    
    const defaultRoles: Role[] = [
        {
            id: generateId(),
            name: 'Admin',
            isDeletable: false,
            defaultView: 'quotes',
            permissions: allViews.map(view => ({ view, access: view === 'logs' ? 'read' : 'write' }))
        },
        {
            id: generateId(),
            name: 'Ventas',
            isDeletable: false,
            defaultView: 'quotes',
            permissions: allViews.map(view => {
                const writeViews: View[] = ['quotes', 'pendingQuotes', 'clients'];
                const readViews: View[] = ['catalog'];
                if (writeViews.includes(view)) return { view, access: 'write' };
                if (readViews.includes(view)) return { view, access: 'read' };
                return { view, access: 'none' };
            })
        },
        {
            id: generateId(),
            name: 'Almacen',
            isDeletable: false,
            defaultView: 'catalog',
            permissions: allViews.map(view => {
                const writeViews: View[] = ['catalog', 'pendingItems'];
                if (writeViews.includes(view)) return { view, access: 'write' };
                return { view, access: 'none' };
            })
        }
    ];

    const settings: Settings[] = [{ 
        id: 'default_settings', 
        appLogo: '',
        taxes: [{ id: generateId(), name: 'IVA', rate: 0.19 }],
        profitMarginTiers: [
          { id: generateId(), minQty: 1, margin: 0.30 },
          { id: generateId(), minQty: 50, margin: 0.25 },
          { id: generateId(), minQty: 100, margin: 0.20 },
        ],
        defaultPriceValidityDays: 30,
        itemCategories: ['Tejidos', 'Tejidos de Lujo', 'Botones', 'Hilos', 'Cierres'],
        units: ['metro', 'unidad', 'cono', 'docena'],
        roles: defaultRoles,
        passwords: {
            'Admin': 'admin',
            'Ventas': 'ventas',
            'Almacen': 'almacen'
        },
        themeColors: {
            primary: '#4f46e5', // indigo-600
            secondary: '#334155', // slate-700
            light: {
                background: '#f1f5f9', // slate-100
                text: '#1e293b', // slate-800
                cardHeaderBackground: '#e2e8f0', // slate-200
                cardHeaderText: '#334155', // slate-700
                summaryBackground: '#f8fafc', // slate-50
                summaryText: '#1e293b', // slate-800
            },
            dark: {
                background: '#0f172a', // slate-900
                text: '#e2e8f0', // slate-200
                cardHeaderBackground: '#1e293b', // slate-800
                cardHeaderText: '#cbd5e1', // slate-300
                summaryBackground: '#1e293b', // slate-800
                summaryText: '#e2e8f0', // slate-200
            }
        },
        companies: [defaultCompany],
        activeCompanyId: defaultCompanyId,
    }];
    localStorage.setItem(DB_KEYS.settings, JSON.stringify(settings));
  }
  if (!localStorage.getItem(DB_KEYS.quotations)) {
    localStorage.setItem(DB_KEYS.quotations, JSON.stringify([]));
  }
  if (!localStorage.getItem(DB_KEYS.logs)) {
    localStorage.setItem(DB_KEYS.logs, JSON.stringify([]));
  }
};

seedData();

const simulateDelay = <T,>(data: T): Promise<T> => {
  return new Promise(resolve => setTimeout(() => resolve(data), SIMULATED_LATENCY));
};

const getItemName = (itemType: ItemKey, item: AnyItem): string => {
    if ('code' in item && item.code && 'name' in item && item.name) {
        return `${item.code} (${item.name})`;
    }
    if ('name' in item && item.name) {
        return item.name;
    }
    return 'N/A';
}

const logChange = async (action: LogEntry['action'], itemType: ItemKey, itemData: AnyItem, userRole: string, details?: string) => {
    if (itemType === 'logs') return; 
    try {
        const logs = JSON.parse(localStorage.getItem(DB_KEYS.logs) || '[]') as LogEntry[];
        const baseName = getItemName(itemType, itemData);
        const newLog: LogEntry = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            userRole,
            action,
            itemType,
            itemId: itemData.id || 'N/A',
            itemName: details ? `${baseName} - ${details}` : baseName
        };
        logs.unshift(newLog); // Add to the beginning
        localStorage.setItem(DB_KEYS.logs, JSON.stringify(logs));
    } catch(e) {
        console.error("Failed to write to activity log", e);
    }
};

export const apiService = {
  getItems: async <T>(key: ItemKey): Promise<T[]> => {
    const data = JSON.parse(localStorage.getItem(DB_KEYS[key]) || '[]');
    return simulateDelay(data as T[]);
  },

  saveItem: async <T extends { id: string, code?: string }>(key: ItemKey, item: T, userRole: string): Promise<T> => {
    const items = await apiService.getItems<T>(key);
    const itemIndex = items.findIndex(i => i.id === item.id);
    let action: 'create' | 'update' = 'update';
    
    if (itemIndex > -1) {
      items[itemIndex] = item;
    } else {
      action = 'create';
      const newItem = { ...item, id: item.id || generateId() };
      // Generate code only on creation and if it's not settings/logs
      if (key !== 'settings' && key !== 'logs') {
          // FIX: The generic type T[] is not guaranteed to be compatible with BaseItem[]. Cast through 'unknown' to fix this.
          newItem.code = generateCode(key, items as unknown as BaseItem[]);
      }
      items.push(newItem);
      item.id = newItem.id; 
      item.code = newItem.code;
    }
    
    localStorage.setItem(DB_KEYS[key], JSON.stringify(items));
    await logChange(action, key, item as unknown as AnyItem, userRole);
    return simulateDelay(item);
  },

  deleteItem: async (key: ItemKey, id: string, userRole: string): Promise<void> => {
    let items = await apiService.getItems<AnyItem>(key);
    const itemToDelete = items.find(i => i.id === id);
    
    if (itemToDelete) {
        items = items.filter(i => i.id !== id);
        localStorage.setItem(DB_KEYS[key], JSON.stringify(items));
        await logChange('delete', key, itemToDelete, userRole);
    }
    return simulateDelay(undefined);
  },
  
  addStock: async (itemId: string, amountToAdd: number, userRole: string): Promise<CatalogItem> => {
    const items = await apiService.getItems<CatalogItem>('catalogItems');
    const itemIndex = items.findIndex(i => i.id === itemId);
    
    if (itemIndex === -1) {
        throw new Error("Item not found");
    }
    
    const item = items[itemIndex];
    item.stockQuantity += amountToAdd;
    
    localStorage.setItem(DB_KEYS.catalogItems, JSON.stringify(items));
    await logChange('stock_add', 'catalogItems', item, userRole, `+${amountToAdd} unidades`);
    
    return simulateDelay(item);
  }
};