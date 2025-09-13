import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Settings, Tax, ProfitTier, Company, Role, View, AccessLevel, Permission } from '../types';
import Input from '../components/Input';
import Button from '../components/Button';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import { PlusCircleIcon, TrashIcon, PencilIcon } from '../components/Icons';

const generateId = () => `id_${new Date().getTime()}_${Math.random().toString(36).substr(2, 9)}`;

const ALL_VIEWS: { name: string; id: View }[] = [
    { name: 'Cotizaciones', id: 'quotes' },
    { name: 'Cotizaciones Pendientes', id: 'pendingQuotes' },
    { name: 'Clientes', id: 'clients' },
    { name: 'Catálogo', id: 'catalog' },
    { name: 'Mano de Obra', id: 'labor' },
    { name: 'Items Pendientes', id: 'pendingItems' },
    { name: 'Registro de Actividad', id: 'logs' },
    { name: 'Configuración', id: 'settings' },
];

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="p-4 border rounded-lg dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
    <h3 className="text-lg font-medium mb-4 text-[var(--color-primary)]">{title}</h3>
    <div className="space-y-4">{children}</div>
  </div>
);

const EditableList: React.FC<{
  title: string;
  items: string[];
  setItems: (newItems: string[]) => void;
}> = ({ title, items, setItems }) => {
  const [newItem, setNewItem] = useState('');

  const handleAddItem = () => {
    if (newItem && !items.includes(newItem)) {
      setItems([...items, newItem]);
      setNewItem('');
    }
  };
  
  const handleRemoveItem = (itemToRemove: string) => {
    setItems(items.filter(item => item !== itemToRemove));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{title}</label>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item} className="flex items-center justify-between p-2 rounded bg-slate-200 dark:bg-slate-700">
            <span>{item}</span>
            <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(item)}><TrashIcon /></Button>
          </div>
        ))}
      </div>
      <div className="flex items-center mt-2 gap-2">
        <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder={`Nueva ${title.toLowerCase().slice(0, -1)}`} />
        <Button type="button" onClick={handleAddItem}><PlusCircleIcon/></Button>
      </div>
    </div>
  );
};

const SettingsView: React.FC = () => {
  const { settings, updateSettings, isLoading, hasPermission } = useAppContext();
  const [formState, setFormState] = useState<Omit<Settings, 'id'> | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [currentCompany, setCurrentCompany] = useState<Partial<Company> | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState<Partial<Role> | null>(null);

  useEffect(() => {
    if (settings) {
      setFormState(JSON.parse(JSON.stringify(settings)));
    }
  }, [settings]);

  const handleOpenCompanyModal = (company: Partial<Company> | null) => {
    setCurrentCompany(company || { name: '', nit: '' });
    setIsCompanyModalOpen(true);
  }

  const handleCloseCompanyModal = () => {
    setIsCompanyModalOpen(false);
    setCurrentCompany(null);
  }

  const handleSaveCompany = (companyToSave: Company) => {
      if (!formState) return;
      const companies = [...formState.companies];
      const existingIndex = companies.findIndex(c => c.id === companyToSave.id);
      if (existingIndex > -1) {
          companies[existingIndex] = companyToSave;
      } else {
          companies.push({ ...companyToSave, id: generateId() });
      }
      setFormState({...formState, companies});
      handleCloseCompanyModal();
  }
  
  const handleRemoveCompany = (companyId: string) => {
    if (!formState || formState.companies.length <= 1) {
        alert("No se puede eliminar la última empresa.");
        return;
    }
    if (window.confirm('¿Está seguro de que desea eliminar esta empresa?')) {
        const newCompanies = formState.companies.filter(c => c.id !== companyId);
        const newActiveCompanyId = companyId === formState.activeCompanyId ? newCompanies[0].id : formState.activeCompanyId;
        setFormState({...formState, companies: newCompanies, activeCompanyId: newActiveCompanyId });
    }
  }

  const handleOpenRoleModal = (role: Partial<Role> | null) => {
    if (role) {
        setCurrentRole(JSON.parse(JSON.stringify(role)));
    } else {
        setCurrentRole({
            name: '',
            isDeletable: true,
            defaultView: 'quotes',
            permissions: ALL_VIEWS.map(v => ({ view: v.id, access: 'none' }))
        });
    }
    setIsRoleModalOpen(true);
  };
  
  const handleSaveRole = (roleToSave: Role) => {
    if (!formState) return;
    const roles = [...formState.roles];
    if (roleToSave.id) {
        const index = roles.findIndex(r => r.id === roleToSave.id);
        if (index > -1) roles[index] = roleToSave;
    } else {
        roles.push({ ...roleToSave, id: generateId() });
    }
    setFormState({ ...formState, roles });
    setIsRoleModalOpen(false);
  };
  
  const handleRemoveRole = (roleId: string) => {
      if (!formState) return;
      if (window.confirm('¿Está seguro? Se eliminará el rol y su contraseña.')) {
          const roleToDelete = formState.roles.find(r => r.id === roleId);
          if (!roleToDelete) return;

          const newRoles = formState.roles.filter(r => r.id !== roleId);
          const newPasswords = { ...formState.passwords };
          delete newPasswords[roleToDelete.name];
          
          setFormState({ ...formState, roles: newRoles, passwords: newPasswords });
      }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormState(prev => prev ? { ...prev, [name]: type === 'number' ? parseFloat(value) : value } as Omit<Settings, 'id'> : null);
  };
  
  const handlePasswordChange = (roleName: string, value: string) => {
    setFormState(prev => {
        if (!prev) return null;
        const newPasswords = { ...prev.passwords, [roleName]: value };
        return { ...prev, passwords: newPasswords };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const { name } = e.target;
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormState(prev => prev ? { ...prev, [name]: reader.result as string } : null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleThemeColorChange = (
    mode: 'light' | 'dark',
    property: keyof Settings['themeColors']['light'],
    value: string
  ) => {
      setFormState(prev => {
          if (!prev) return null;
          const newThemeColors = JSON.parse(JSON.stringify(prev.themeColors));
          if (!newThemeColors[mode]) {
            newThemeColors[mode] = { background: '', text: '', cardHeaderBackground: '', cardHeaderText: '', summaryBackground: '', summaryText: '' };
          }
          newThemeColors[mode][property] = value;
          return { ...prev, themeColors: newThemeColors };
      });
  };

  const handleColorChange = (name: 'primary' | 'secondary', value: string) => {
    setFormState(prev => {
        if (!prev) return null;
        const newThemeColors = { ...prev.themeColors, [name]: value };
        return { ...prev, themeColors: newThemeColors };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formState) {
        await updateSettings(formState);
        setSuccessMessage('Configuración guardada exitosamente.');
        setTimeout(() => setSuccessMessage(null), 3000);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        e.preventDefault();
    }
  };

  const handleTaxChange = (index: number, field: keyof Tax, value: string) => {
    if (!formState) return;
    const newTaxes = [...formState.taxes];
    const target = newTaxes[index] as any;
    if (field === 'rate') {
      const processedValue = parseFloat(String(value).replace(',', '.')) / 100;
      target[field] = isNaN(processedValue) ? 0 : processedValue;
    } else {
      target[field] = value;
    }
    setFormState({ ...formState, taxes: newTaxes });
  };
  const handleAddTax = () => {
    if (!formState) return;
    setFormState({ ...formState, taxes: [...formState.taxes, { id: generateId(), name: '', rate: 0 }] });
  };
  const handleRemoveTax = (index: number) => {
    if (!formState) return;
    const newTaxes = formState.taxes.filter((_, i) => i !== index);
    setFormState({ ...formState, taxes: newTaxes });
  };

  const handleProfitTierChange = (id: string, field: keyof Omit<ProfitTier, 'id'>, value: string) => {
    if (!formState) return;
    const newTiers = formState.profitMarginTiers.map(tier => {
        if (tier.id === id) {
            const processedValue = parseFloat(value.replace(',', '.'));
            let finalValue = isNaN(processedValue) ? 0 : processedValue;
            if (field === 'margin') {
                finalValue /= 100;
            }
            return { ...tier, [field]: finalValue };
        }
        return tier;
    });
    setFormState({ ...formState, profitMarginTiers: newTiers });
  };
  const handleAddProfitTier = () => {
    if (!formState) return;
    const lastQty = formState.profitMarginTiers.reduce((max, t) => Math.max(max, t.minQty), 0);
    setFormState({ ...formState, profitMarginTiers: [...formState.profitMarginTiers, { id: generateId(), minQty: lastQty + 1, margin: 0 }] });
  };
  const handleRemoveProfitTier = (id: string) => {
    if (!formState) return;
    const newTiers = formState.profitMarginTiers.filter((tier) => tier.id !== id);
    setFormState({ ...formState, profitMarginTiers: newTiers });
  };
  
  if (!hasPermission('settings', 'write')) {
    return <Alert type="error" message="Acceso denegado. Esta área es solo para administradores." />;
  }
  
  if (isLoading || !formState) {
    return <div className="flex justify-center p-8"><Spinner /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Configuración del Sistema</h2>
      {successMessage && <Alert type="success" message={successMessage} />}
      <form onSubmit={handleSubmit} className="space-y-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-8">
                 <Section title="Empresas">
                    <div className="space-y-2">
                        {formState.companies.map(company => (
                            <div key={company.id} className="flex items-center justify-between p-2 rounded bg-slate-200 dark:bg-slate-700">
                                <span>{company.name} ({company.nit})</span>
                                <div>
                                    <Button variant="ghost" size="sm" onClick={() => handleOpenCompanyModal(company)}><PencilIcon /></Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleRemoveCompany(company.id)}><TrashIcon /></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Button type="button" size="sm" variant="secondary" onClick={() => handleOpenCompanyModal(null)}><PlusCircleIcon/> <span className="ml-2">Añadir Empresa</span></Button>
                </Section>
                 <Section title="Gestión de Roles">
                    <div className="space-y-2">
                        {formState.roles.map(role => (
                            <div key={role.id} className="flex items-center justify-between p-2 rounded bg-slate-200 dark:bg-slate-700">
                                <span>{role.name}</span>
                                <div>
                                    <Button variant="ghost" size="sm" onClick={() => handleOpenRoleModal(role)}><PencilIcon /></Button>
                                    {role.isDeletable && <Button variant="ghost" size="sm" onClick={() => handleRemoveRole(role.id)}><TrashIcon /></Button>}
                                </div>
                            </div>
                        ))}
                    </div>
                    <Button type="button" size="sm" variant="secondary" onClick={() => handleOpenRoleModal(null)}><PlusCircleIcon/> <span className="ml-2">Añadir Rol</span></Button>
                </Section>
                <Section title="Seguridad y Roles">
                    {formState.roles.map(role => (
                        <Input key={role.id} label={`Contraseña para ${role.name}`} type="password" value={formState.passwords?.[role.name] || ''} onChange={(e) => handlePasswordChange(role.name, e.target.value)} />
                    ))}
                </Section>
                <Section title="Marca de la Aplicación">
                    <ImageUpload name="appLogo" label="Logo de la Aplicación" value={formState.appLogo || ''} onChange={handleFileChange} />
                </Section>
                 <Section title="Personalización">
                    <ColorPicker label="Color Primario" value={formState.themeColors?.primary || '#000000'} onChange={(e) => handleColorChange('primary', e.target.value)} />
                    <ColorPicker label="Color Secundario" value={formState.themeColors?.secondary || '#000000'} onChange={(e) => handleColorChange('secondary', e.target.value)} />
                    <h4 className="font-medium mt-4 pt-4 border-t dark:border-slate-600">Modo Claro</h4>
                    <ColorPicker label="Color de Fondo" value={formState.themeColors?.light?.background || '#ffffff'} onChange={(e) => handleThemeColorChange('light', 'background', e.target.value)} />
                    <ColorPicker label="Color de Texto" value={formState.themeColors?.light?.text || '#000000'} onChange={(e) => handleThemeColorChange('light', 'text', e.target.value)} />
                    <ColorPicker label="Fondo Títulos Sección" value={formState.themeColors?.light?.cardHeaderBackground || '#ffffff'} onChange={(e) => handleThemeColorChange('light', 'cardHeaderBackground', e.target.value)} />
                    <ColorPicker label="Texto Títulos Sección" value={formState.themeColors?.light?.cardHeaderText || '#000000'} onChange={(e) => handleThemeColorChange('light', 'cardHeaderText', e.target.value)} />
                    <ColorPicker label="Fondo Resumen" value={formState.themeColors?.light?.summaryBackground || '#ffffff'} onChange={(e) => handleThemeColorChange('light', 'summaryBackground', e.target.value)} />
                    <ColorPicker label="Texto Resumen" value={formState.themeColors?.light?.summaryText || '#000000'} onChange={(e) => handleThemeColorChange('light', 'summaryText', e.target.value)} />

                    <h4 className="font-medium mt-4 pt-4 border-t dark:border-slate-600">Modo Oscuro</h4>
                    <ColorPicker label="Color de Fondo" value={formState.themeColors?.dark?.background || '#000000'} onChange={(e) => handleThemeColorChange('dark', 'background', e.target.value)} />
                    <ColorPicker label="Color de Texto" value={formState.themeColors?.dark?.text || '#ffffff'} onChange={(e) => handleThemeColorChange('dark', 'text', e.target.value)} />
                    <ColorPicker label="Fondo Títulos Sección" value={formState.themeColors?.dark?.cardHeaderBackground || '#000000'} onChange={(e) => handleThemeColorChange('dark', 'cardHeaderBackground', e.target.value)} />
                    <ColorPicker label="Texto Títulos Sección" value={formState.themeColors?.dark?.cardHeaderText || '#ffffff'} onChange={(e) => handleThemeColorChange('dark', 'cardHeaderText', e.target.value)} />
                    <ColorPicker label="Fondo Resumen" value={formState.themeColors?.dark?.summaryBackground || '#000000'} onChange={(e) => handleThemeColorChange('dark', 'summaryBackground', e.target.value)} />
                    <ColorPicker label="Texto Resumen" value={formState.themeColors?.dark?.summaryText || '#ffffff'} onChange={(e) => handleThemeColorChange('dark', 'summaryText', e.target.value)} />
                 </Section>
            </div>

            <div className="space-y-8">
                <Section title="Finanzas">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Impuestos</label>
                        {formState.taxes.map((tax, index) => (
                          <div key={tax.id} className="flex items-center gap-2 mb-2 p-2 bg-slate-100 dark:bg-slate-900/50 rounded">
                            <Input placeholder="Nombre (ej. IVA)" value={tax.name} onChange={(e) => handleTaxChange(index, 'name', e.target.value)} onKeyDown={handleKeyDown} className="flex-grow"/>
                            <Input type="number" step="0.01" placeholder="Tasa" value={tax.rate ? parseFloat((tax.rate * 100).toPrecision(10)) : 0} onChange={(e) => handleTaxChange(index, 'rate', e.target.value)} onKeyDown={handleKeyDown} className="w-24" rightAddon="%" />
                            <Button variant="ghost" size="sm" onClick={() => handleRemoveTax(index)}><TrashIcon/></Button>
                          </div>
                        ))}
                        <Button type="button" size="sm" variant="secondary" onClick={handleAddTax}><PlusCircleIcon/> <span className="ml-2">Añadir Impuesto</span></Button>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Márgenes de Ganancia por Cantidad</label>
                        {formState.profitMarginTiers.sort((a,b) => a.minQty - b.minQty).map((tier) => (
                          <div key={tier.id} className="flex items-center gap-2 mb-2 p-2 bg-slate-100 dark:bg-slate-900/50 rounded">
                            <Input type="number" placeholder="Cant. Mínima" value={tier.minQty} onChange={(e) => handleProfitTierChange(tier.id, 'minQty', e.target.value)} onKeyDown={handleKeyDown} className="flex-grow"/>
                            <Input type="number" step="0.01" placeholder="Margen" value={tier.margin ? parseFloat((tier.margin * 100).toPrecision(10)) : 0} onChange={(e) => handleProfitTierChange(tier.id, 'margin', e.target.value)} onKeyDown={handleKeyDown} className="w-24" rightAddon="%" />
                            <Button variant="ghost" size="sm" onClick={() => handleRemoveProfitTier(tier.id)}><TrashIcon/></Button>
                          </div>
                        ))}
                        <Button type="button" size="sm" variant="secondary" onClick={handleAddProfitTier}><PlusCircleIcon/> <span className="ml-2">Añadir Rango</span></Button>
                    </div>
                </Section>
                <Section title="Catálogos y Unidades">
                    <EditableList title="Categorías de Items" items={formState.itemCategories} setItems={(items) => setFormState(prev => prev ? {...prev, itemCategories: items} : null)} />
                    <EditableList title="Unidades de Medida" items={formState.units} setItems={(items) => setFormState(prev => prev ? {...prev, units: items} : null)} />
                </Section>
                 <Section title="General">
                    <Input label="Validez de Precio Predeterminada (días)" name="defaultPriceValidityDays" type="number" value={formState.defaultPriceValidityDays} onChange={handleChange} />
                </Section>
            </div>
        </div>

        <div className="flex justify-end pt-6 border-t dark:border-slate-700">
          <Button type="submit">Guardar Cambios</Button>
        </div>
      </form>

      {currentCompany && (
        <CompanyModal
            isOpen={isCompanyModalOpen}
            onClose={handleCloseCompanyModal}
            company={currentCompany}
            onSave={handleSaveCompany}
        />
      )}
      {currentRole && (
        <RoleManagementModal
            isOpen={isRoleModalOpen}
            onClose={() => setIsRoleModalOpen(false)}
            role={currentRole}
            onSave={handleSaveRole}
        />
      )}
    </div>
  );
};

const RoleManagementModal: React.FC<{ isOpen: boolean; onClose: () => void; role: Partial<Role>; onSave: (role: Role) => void; }> = ({ isOpen, onClose, role, onSave }) => {
    const [formState, setFormState] = useState<Partial<Role>>(role);
    useEffect(() => { setFormState(role); }, [role]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormState(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handlePermissionChange = (view: View, access: AccessLevel) => {
        setFormState(prev => {
            if (!prev?.permissions) return prev;
            const newPermissions = prev.permissions.map(p => p.view === view ? { ...p, access } : p);
            return { ...prev, permissions: newPermissions };
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formState as Role);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={role.id ? "Editar Rol" : "Añadir Rol"}>
            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
                <Input label="Nombre del Rol" name="name" value={formState?.name || ''} onChange={handleChange} required />
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vista por Defecto</label>
                    <select name="defaultView" value={formState?.defaultView || 'quotes'} onChange={handleChange} className="block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md">
                        {ALL_VIEWS.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                </div>
                <div>
                    <h4 className="text-md font-medium mb-2">Permisos</h4>
                    <div className="space-y-2">
                        {formState?.permissions?.map(permission => {
                            const viewInfo = ALL_VIEWS.find(v => v.id === permission.view);
                            if (!viewInfo) return null;
                            return (
                                <div key={permission.view} className="grid grid-cols-2 items-center">
                                    <span className="font-medium text-sm">{viewInfo.name}</span>
                                    <select 
                                        value={permission.access} 
                                        onChange={(e) => handlePermissionChange(permission.view, e.target.value as AccessLevel)}
                                        className="block w-full px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md"
                                    >
                                        <option value="none">Ninguno</option>
                                        <option value="read">Solo Lectura</option>
                                        {permission.view !== 'logs' && <option value="write">Lectura y Escritura</option>}
                                    </select>
                                </div>
                            )
                        })}
                    </div>
                </div>
                 <div className="flex justify-end pt-4">
                    <Button type="submit">Guardar Rol</Button>
                </div>
            </form>
        </Modal>
    )
}

const CompanyModal: React.FC<{isOpen: boolean, onClose: () => void, company: Partial<Company>, onSave: (company: Company) => void}> = ({ isOpen, onClose, company, onSave }) => {
    const [formState, setFormState] = useState(company);
    useEffect(() => { setFormState(company); }, [company]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormState(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormState(prev => ({ ...prev, [e.target.name]: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formState as Company);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={company.id ? "Editar Empresa" : "Añadir Empresa"}>
            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
                <Input label="Nombre de la Empresa" name="name" value={formState.name || ''} onChange={handleChange} required />
                <Input label="NIT" name="nit" value={formState.nit || ''} onChange={handleChange} required />
                <ImageUpload name="companyLogo" label="Logo de la Empresa" value={formState.companyLogo || ''} onChange={handleFileChange} />
                <ImageUpload name="watermarkImage" label="Marca de Agua (PDF)" value={formState.watermarkImage || ''} onChange={handleFileChange} />
                <ImageUpload name="quoteSealImage" label="Sello de Validez (PDF)" value={formState.quoteSealImage || ''} onChange={handleFileChange} />
                <Textarea name="defaultPresentationText" label="Texto de Presentación Predeterminado" value={formState.defaultPresentationText || ''} onChange={handleChange} />
                <Textarea name="quoteFooterText" label="Texto de Pie de Página (PDF)" value={formState.quoteFooterText || ''} onChange={handleChange} />
                 <div className="flex justify-end pt-4">
                    <Button type="submit">Guardar</Button>
                </div>
            </form>
        </Modal>
    );
}

const ImageUpload: React.FC<{ name: string, label: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void}> = ({name, label, value, onChange}) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
        <div className="mt-1 flex items-center">
            {value && <img src={value} alt={label} className="h-16 w-16 object-contain rounded-md bg-slate-200 dark:bg-slate-700 p-1 mr-4" />}
            <Input id={name} name={name} type="file" accept="image/*" onChange={onChange} />
        </div>
    </div>
);

const Textarea: React.FC<{name?: string, label: string, value: string, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void}> = ({name, label, value, onChange}) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
        <textarea
            id={name}
            name={name}
            rows={3}
            value={value}
            onChange={onChange}
            className="block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
    </div>
);

const ColorPicker: React.FC<{label: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void}> = ({label, value, onChange}) => (
    <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
        <div className="flex items-center gap-2 border dark:border-slate-600 rounded-md p-1">
             <input type="color" value={value} onChange={onChange} className="w-8 h-8 p-0 border-none rounded-md cursor-pointer"/>
             <span className="font-mono text-sm">{value}</span>
        </div>
    </div>
);


export default SettingsView;