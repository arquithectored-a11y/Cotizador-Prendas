
import React from 'react';
import { ExclamationTriangleIcon } from './Icons';

interface AlertProps {
  type: 'warning' | 'info' | 'success' | 'error';
  message: string;
}

const Alert: React.FC<AlertProps> = ({ type, message }) => {
  const baseClasses = 'p-4 mb-4 text-sm rounded-lg';
  const typeClasses = {
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  };

  const Icon = type === 'warning' ? <ExclamationTriangleIcon /> : null; // Add other icons as needed

  return (
    <div className={`${baseClasses} ${typeClasses[type]} flex items-center`} role="alert">
      {Icon && <span className="mr-2">{Icon}</span>}
      <span className="font-medium">{message}</span>
    </div>
  );
};

export default Alert;
