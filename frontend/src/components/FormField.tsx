import { FormEvent } from 'react';

interface FormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'number' | 'date' | 'email' | 'password';
  value: string | number | null;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  min?: number;
  step?: number;
  className?: string;
}

export function FormField({
  label, name, type = 'text', value, onChange, placeholder, required, disabled, min, step, className
}: FormFieldProps) {
  const handleChange = (e: FormEvent<HTMLInputElement>) => {
    const val = e.currentTarget.value;
    if (type === 'number') {
      onChange(val === '' ? '' : val);
    } else {
      onChange(val);
    }
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <label htmlFor={name} className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value ?? ''}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        min={min}
        step={step}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm
                   bg-white text-slate-800 placeholder-slate-400
                   focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-shadow"
      />
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export function SelectField({ label, name, options, value, onChange, placeholder, required, disabled }: SelectFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select
        id={name}
        name={name}
        value={value ?? ''}
        onChange={e => onChange(e.currentTarget.value)}
        required={required}
        disabled={disabled}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm
                   bg-white text-slate-800
                   focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-shadow"
      >
        {placeholder && (
          <option value="" disabled>{placeholder}</option>
        )}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export function Button({
  children, onClick, type = 'button', variant = 'primary', disabled, loading, className, size = 'md'
}: ButtonProps) {
  const base = 'rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2';
  const sizes = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-4 py-2',
  }[size];

  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 active:bg-slate-100',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
    ghost: 'text-slate-600 hover:bg-slate-100 active:bg-slate-200',
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${sizes} ${variants} ${className ?? ''}`}
    >
      {loading && <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />}
      {children}
    </button>
  );
}
