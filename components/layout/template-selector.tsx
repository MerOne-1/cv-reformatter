'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TemplateSelectItem } from '@/lib/types';
import { Loader2 } from 'lucide-react';

interface TemplateSelectorProps {
  value: string;
  onChange: (templateName: string) => void;
  disabled?: boolean;
}

export function TemplateSelector({ value, onChange, disabled }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<TemplateSelectItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/templates')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTemplates(data.data.filter((t: TemplateSelectItem) => t.isActive));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="inline-flex p-1 bg-secondary/50 rounded-lg border border-border text-xs">
        <div className="px-3 py-1.5 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Chargement...</span>
        </div>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="inline-flex p-1 bg-secondary/50 rounded-lg border border-border text-xs">
        <div className="px-3 py-1.5 text-muted-foreground">
          Aucun template disponible
        </div>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-wrap gap-1 p-1 bg-secondary/50 rounded-lg border border-border text-xs">
      {templates.map((template) => {
        const isSelected = value === template.name;
        return (
          <button
            key={template.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(template.name)}
            className={cn(
              'relative px-3 py-1.5 rounded-md font-medium transition-all duration-200 ease-out-expo',
              isSelected
                ? 'bg-card shadow-sm border'
                : 'text-muted-foreground hover:text-foreground'
            )}
            style={isSelected ? {
              color: template.primaryColor,
              borderColor: `${template.primaryColor}20`,
            } : undefined}
          >
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  'w-2 h-2 rounded-full transition-all duration-200',
                  isSelected ? 'shadow-sm' : 'opacity-50'
                )}
                style={{
                  background: isSelected
                    ? `linear-gradient(135deg, ${template.primaryColor}, ${template.secondaryColor})`
                    : template.primaryColor,
                  boxShadow: isSelected ? `0 2px 4px ${template.primaryColor}50` : undefined,
                }}
              />
              <span>{template.displayName}</span>
            </span>
            {isSelected && (
              <span
                className="absolute inset-x-0 -bottom-px h-px"
                style={{
                  background: `linear-gradient(to right, transparent, ${template.primaryColor}, transparent)`,
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function useTemplates() {
  const [templates, setTemplates] = useState<TemplateSelectItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = () => {
    setLoading(true);
    fetch('/api/templates')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTemplates(data.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refetch();
  }, []);

  return { templates, loading, refetch };
}
