import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import Modal from './Modal';
import Input from './Input';
import Button from './Button';
import Alert from './Alert';

interface HeaderProps {
  title: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
  const { userRole, setUserRole, switchToProtectedRole, settings, activeCompany, setActiveCompany } = useAppContext();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [targetRole, setTargetRole] = useState<string | null>(null);

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRoleName = e.target.value;
    if (settings?.passwords[newRoleName]) {
        setTargetRole(newRoleName);
        setIsPasswordModalOpen(true);
    } else {
        setUserRole(newRoleName);
    }
  };
  
  const handlePasswordSubmit = async () => {
    if (!targetRole) return;
    setError('');
    const success = await switchToProtectedRole(targetRole, password);
    if (success) {
        setIsPasswordModalOpen(false);
        setPassword('');
        setTargetRole(null);
    } else {
        setError('Contraseña incorrecta.');
    }
  }
  
  const handleCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setActiveCompany(e.target.value);
  }

  const handleCloseModal = () => {
    setIsPasswordModalOpen(false);
    setError('');
    setPassword('');
    setTargetRole(null);
  }

  const modalTitle = `Acceso de ${targetRole}`;

  return (
    <header className="flex items-center justify-between h-16 px-6 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-4">
        {activeCompany?.companyLogo && (
            <img src={activeCompany.companyLogo} alt="Logo" className="h-10 w-auto" />
        )}
        <h2 className="text-2xl font-semibold text-slate-800 dark:text-white">{title}</h2>
      </div>
      <div className="flex items-center space-x-4">
        {settings && settings.companies.length > 1 && (
             <div className="flex items-center space-x-2">
                 <span className="text-sm text-slate-500 dark:text-slate-400">Empresa:</span>
                 <select
                    value={activeCompany?.id || ''}
                    onChange={handleCompanyChange}
                    className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] block w-full p-1.5 dark:bg-slate-700 dark:border-slate-600 dark:placeholder-slate-400 dark:text-white"
                 >
                     {settings.companies.map(company => (
                         <option key={company.id} value={company.id}>{company.name}</option>
                     ))}
                 </select>
             </div>
        )}
        <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">Rol:</span>
            <select
              value={userRole}
              onChange={handleRoleChange}
              className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] block w-full p-1.5 dark:bg-slate-700 dark:border-slate-600 dark:placeholder-slate-400 dark:text-white"
            >
              {settings?.roles.map(role => (
                <option key={role.id} value={role.name}>{role.name}</option>
              ))}
            </select>
        </div>
      </div>
      <Modal isOpen={isPasswordModalOpen} onClose={handleCloseModal} title={modalTitle}>
        <div className="space-y-4">
            <p>Por favor, ingrese la contraseña para continuar.</p>
            {error && <Alert type="error" message={error}/>}
            <Input 
                type="password"
                label="Contraseña"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
            />
            <div className="flex justify-end">
                <Button onClick={handlePasswordSubmit}>Ingresar</Button>
            </div>
        </div>
      </Modal>
    </header>
  );
};

export default Header;