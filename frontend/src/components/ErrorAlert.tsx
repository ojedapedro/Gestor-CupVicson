import { AlertTriangle, X, WifiOff } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  title?: string;
  onClose?: () => void;
  variant?: 'error' | 'warning';
}

/**
 * Componente reutilizable para mostrar errores de carga o red.
 * Reemplaza el antipatrón de solo loguear en console.error sin feedback al usuario.
 */
export function ErrorAlert({ message, title, onClose, variant = 'error' }: ErrorAlertProps) {
  const styles = {
    error: {
      container: 'bg-red-50 border-red-200 text-red-800',
      icon: 'text-red-500',
      closeBtn: 'text-red-400 hover:text-red-600 hover:bg-red-100',
    },
    warning: {
      container: 'bg-amber-50 border-amber-200 text-amber-800',
      icon: 'text-amber-500',
      closeBtn: 'text-amber-400 hover:text-amber-600 hover:bg-amber-100',
    },
  }[variant];

  const Icon = variant === 'error' ? WifiOff : AlertTriangle;
  const defaultTitle = variant === 'error' ? 'Error al cargar datos' : 'Advertencia';

  return (
    <div
      className={`flex items-start gap-3 border rounded-lg px-4 py-3 ${styles.container}`}
      role="alert"
    >
      <Icon size={18} className={`mt-0.5 shrink-0 ${styles.icon}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{title ?? defaultTitle}</p>
        <p className="text-sm mt-0.5 opacity-90">{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className={`p-1 rounded transition-colors shrink-0 ${styles.closeBtn}`}
          aria-label="Cerrar alerta"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
