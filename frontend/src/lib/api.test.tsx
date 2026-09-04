// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, formatDateTime, estadoBadge } from './api';
import React from 'react';
import { render } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

describe('API Helpers', () => {
  describe('formatCurrency', () => {
    it('debería formatear correctamente un número a moneda (VES)', () => {
      // Notas: En Node/Vitest, el formato exacto puede variar ligeramente dependiendo del locale ('es-VE').
      // Usaremos un string dinámico o comprobaremos partes del string.
      const formatted = formatCurrency(1250.5);
      expect(formatted).toMatch(/1\.250,50|1250,50|1,250.50/);
      expect(formatted).toContain('Bs.');
    });

    it('debería devolver "-" para valores nulos o inválidos', () => {
      expect(formatCurrency(null)).toBe('-');
      expect(formatCurrency(undefined)).toBe('-');
      expect(formatCurrency(NaN)).toBe('-');
    });
  });

  describe('formatDate', () => {
    it('debería formatear fechas ISO correctamente', () => {
      const formatted = formatDate('2024-05-15T00:00:00Z');
      expect(formatted).toMatch(/15\/0?5\/2024|14\/0?5\/2024/); // Dependiendo del timezone local
    });

    it('debería devolver "-" si no hay fecha', () => {
      expect(formatDate(null)).toBe('-');
      expect(formatDate('')).toBe('-');
    });
  });

  describe('formatDateTime', () => {
    it('debería devolver "-" si no hay fecha', () => {
      expect(formatDateTime(null)).toBe('-');
    });
  });

  describe('estadoBadge', () => {
    it('debería devolver un span con el texto del estado', () => {
      const { container } = render(<div>{estadoBadge('activo')}</div>);
      const span = container.querySelector('span');
      expect(span).not.toBeNull();
      expect(span?.textContent).toBe('activo');
      expect(span?.className).toContain('bg-emerald-100');
    });

    it('debería manejar estados nulos o desconocidos', () => {
      const { container: containerNull } = render(<div>{estadoBadge(null)}</div>);
      expect(containerNull.textContent).toBe('-');

      const { container: containerDesc } = render(<div>{estadoBadge('desconocido')}</div>);
      expect(containerDesc.textContent).toBe('desconocido');
      expect(containerDesc.querySelector('span')?.className).toContain('bg-slate-100');
    });
  });
});
