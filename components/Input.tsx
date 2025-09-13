import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  rightAddon?: React.ReactNode;
}

const Input: React.FC<InputProps> = ({ label, id, rightAddon, ...props }) => {
  const hasAddon = !!rightAddon;

  const combinedClassName = `block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-sm disabled:bg-gray-200 dark:disabled:bg-gray-700 ${hasAddon ? 'pr-10' : ''} ${props.className || ''}`;

  const inputElement = (
      <input
        id={id}
        {...props}
        className={combinedClassName}
      />
  );
  
  return (
    <div>
      {label && <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
      {hasAddon ? (
        <div className="relative">
          {inputElement}
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-gray-500 dark:text-gray-400 sm:text-sm">
              {rightAddon}
            </span>
          </div>
        </div>
      ) : (
        inputElement
      )}
    </div>
  );
};

export default Input;