export type View = 'quotes' | 'catalog' | 'labor' | 'clients' | 'settings' | 'pendingItems' | 'logs' | 'pendingQuotes';

export type AccessLevel = 'none' | 'read' | 'write';

export interface Permission {
  view: View;
  access: AccessLevel;
}

export interface Role {
  id: string;
  name: string;
  isDeletable: boolean;
  permissions: Permission[];
  defaultView: View;
}

export interface BaseItem {
  id: string;
  code: string;
  name: string;
}

export interface PricedItem extends BaseItem {
  category: string;
  unit: string;
  color: string;
  unitCost: number;
  supplier: string;
  updatedAt: string; // ISO string date
  priceValidityDays: number;
}

export interface CatalogItem extends PricedItem {
  type: 'Material' | 'Insumo';
  stockQuantity: number;
  lowStockThreshold: number;
  image?: string; // base64 string
}

export interface Labor extends BaseItem {
  role: string;
  hourlyRate: number;
}

export interface Client extends BaseItem {
  contactPerson: string;
  email: string;
  phone: string;
}

export interface Tax {
  id: string;
  name: string;
  rate: number; // e.g., 0.16 for 16%
}

export interface ProfitTier {
  id: string;
  minQty: number;
  margin: number; // e.g., 0.25 for 25%
}

export interface Company {
  id: string;
  name: string;
  nit: string;
  companyLogo: string; // base64 string
  watermarkImage: string; // base64 string for PDF watermark
  quoteSealImage: string; // base64 string for a validity seal
  quoteFooterText: string;
  defaultPresentationText: string;
}

export interface Settings {
  id: string;
  appLogo?: string;
  taxes: Tax[];
  profitMarginTiers: ProfitTier[];
  defaultPriceValidityDays: number;
  itemCategories: string[];
  units: string[];
  roles: Role[];
  passwords: Partial<Record<string, string>>;
  themeColors: {
    primary: string;
    secondary: string;
    light: {
        background: string;
        text: string;
        cardHeaderBackground: string;
        cardHeaderText: string;
        summaryBackground: string;
        summaryText: string;
    };
    dark: {
        background: string;
        text: string;
        cardHeaderBackground: string;
        cardHeaderText: string;
        summaryBackground: string;
        summaryText: string;
    };
  };
  companies: Company[];
  activeCompanyId: string | null;
}

export interface QuotationItem<T extends BaseItem> {
  itemId: string;
  itemSnapshot: T;
  quantity: number;
  totalCost: number;
}

export interface Quotation extends BaseItem {
  garmentName: string;
  garmentQuantity: number;
  client: Client;
  createdAt: string; // ISO string date
  referenceImages: string[]; // array of base64 strings
  items: QuotationItem<CatalogItem>[];
  labors: QuotationItem<Labor>[];
  presentationText: string;
  subtotal: number;
  profitMarginApplied: {
    margin: number;
    amount: number;
  };
  selectedTaxIds: string[];
  taxesApplied: {
    name: string;
    rate: number;
    amount: number;
  }[];
  total: number;
  status: 'active' | 'draft';
}

export interface LogEntry {
    id: string;
    timestamp: string; // ISO string date
    userRole: string;
    action: 'create' | 'update' | 'delete' | 'stock_add';
    itemType: ItemKey;
    itemId: string;
    itemName: string;
}

export type AnyItem = CatalogItem | Labor | Client | Settings | Quotation | LogEntry | Company;
export type ItemKey = 'catalogItems' | 'labor' | 'clients' | 'settings' | 'quotations' | 'logs';