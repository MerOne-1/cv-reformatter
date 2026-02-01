'use client';

import { useCallback } from 'react';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}

const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#06B6D4', // Cyan
  '#6366F1', // Indigo
  '#84CC16', // Lime
];

export function ColorPicker({
  value,
  onChange,
  label,
  className,
  disabled = false,
}: ColorPickerProps) {
  const handleColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const handleHexChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const hex = e.target.value;
      if (/^#[0-9A-Fa-f]{0,6}$/.test(hex)) {
        onChange(hex);
      }
    },
    [onChange]
  );

  const handlePresetClick = useCallback(
    (color: string) => {
      if (!disabled) {
        onChange(color);
      }
    },
    [onChange, disabled]
  );

  return (
    <div className={cn('space-y-3', className)}>
      {label && (
        <label className="text-sm font-medium text-muted-foreground">
          {label}
        </label>
      )}

      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={handleColorChange}
          disabled={disabled}
          className={cn(
            'w-12 h-12 rounded-xl cursor-pointer border-2 border-border',
            'hover:border-primary/50 transition-colors',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        />
        <input
          type="text"
          value={value}
          onChange={handleHexChange}
          disabled={disabled}
          placeholder="#000000"
          className={cn(
            'flex-1 px-3 py-2 bg-secondary/50 border border-border rounded-lg',
            'text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        />
      </div>

      <div className="space-y-2">
        <span className="text-xs text-muted-foreground">Couleurs prédéfinies</span>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => handlePresetClick(color)}
              disabled={disabled}
              className={cn(
                'w-8 h-8 rounded-lg border-2 transition-all',
                value === color
                  ? 'border-foreground scale-110'
                  : 'border-transparent hover:border-border hover:scale-105',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </div>

      <div
        className="h-12 rounded-lg flex items-center justify-center text-sm font-medium"
        style={{
          backgroundColor: value,
          color: getContrastColor(value),
        }}
      >
        Aperçu du surlignage
      </div>
    </div>
  );
}

function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}
