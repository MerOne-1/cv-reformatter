'use client';

import { useState, useEffect } from 'react';
import { X, Palette, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Template {
  id: string;
  name: string;
  displayName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  logoHeaderUrl: string | null;
  logoFooterUrl: string | null;
  website: string | null;
  config: string;
  isActive: boolean;
}

interface TemplateEditModalProps {
  template: Template | null;
  onClose: () => void;
  onSave: (templateId: string, updates: Partial<Template>) => Promise<void>;
  saving: boolean;
}

interface FormData {
  displayName: string;
  primaryColor: string;
  secondaryColor: string;
  website: string;
}

export function TemplateEditModal({ template, onClose, onSave, saving }: TemplateEditModalProps) {
  const [formData, setFormData] = useState<FormData>({
    displayName: '',
    primaryColor: '#1E3A8A',
    secondaryColor: '#3B82F6',
    website: '',
  });

  useEffect(() => {
    if (template) {
      setFormData({
        displayName: template.displayName,
        primaryColor: template.primaryColor,
        secondaryColor: template.secondaryColor,
        website: template.website || '',
      });
    }
  }, [template]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template) return;
    await onSave(template.id, formData);
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!template) return null;

  const isDreamit = template.name.toLowerCase().includes('dreamit');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-scale-in">
        {/* Accent top bar */}
        <div
          className={cn(
            'h-1 w-full',
            isDreamit
              ? 'bg-gradient-to-r from-dreamit via-dreamit-glow to-dreamit'
              : 'bg-gradient-to-r from-rupturae via-rupturae-glow to-rupturae'
          )}
        />

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
              style={{
                background: `linear-gradient(135deg, ${formData.primaryColor}, ${formData.secondaryColor})`,
              }}
            >
              {formData.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="font-display text-lg font-medium">Modifier le template</h2>
              <p className="text-xs text-muted-foreground font-mono">{template.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Display Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Nom d'affichage</label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => handleChange('displayName', e.target.value)}
              className="w-full px-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 transition-all"
              required
            />
          </div>

          {/* Colors */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Couleurs de marque</label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground/70">Primaire</span>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={formData.primaryColor}
                    onChange={(e) => handleChange('primaryColor', e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer border-2 border-border bg-transparent"
                  />
                  <input
                    type="text"
                    value={formData.primaryColor}
                    onChange={(e) => handleChange('primaryColor', e.target.value)}
                    className="flex-1 px-3 py-2 bg-secondary/50 border border-border rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground/70">Secondaire</span>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={formData.secondaryColor}
                    onChange={(e) => handleChange('secondaryColor', e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer border-2 border-border bg-transparent"
                  />
                  <input
                    type="text"
                    value={formData.secondaryColor}
                    onChange={(e) => handleChange('secondaryColor', e.target.value)}
                    className="flex-1 px-3 py-2 bg-secondary/50 border border-border rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Website */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Site web</label>
            <input
              type="text"
              value={formData.website}
              onChange={(e) => handleChange('website', e.target.value)}
              placeholder="www.example.com"
              className="w-full px-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 transition-all"
            />
          </div>

          {/* Preview */}
          <div className="p-4 bg-secondary/30 rounded-xl border border-border">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3 block">Apercu</span>
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${formData.primaryColor}, ${formData.secondaryColor})`,
                  boxShadow: `0 4px 12px -4px ${formData.primaryColor}50`,
                }}
              >
                {formData.displayName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-display font-medium">{formData.displayName}</div>
                <div className="text-xs text-muted-foreground font-mono">{template.name}</div>
                {formData.website && (
                  <div className="text-xs text-muted-foreground/70 mt-0.5">{formData.website}</div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-xl text-sm font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || !formData.displayName}
              className={cn(
                'flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all flex items-center justify-center gap-2',
                saving || !formData.displayName
                  ? 'bg-primary/50 cursor-not-allowed'
                  : isDreamit
                    ? 'bg-dreamit hover:bg-dreamit/90 shadow-lg shadow-dreamit/20'
                    : 'bg-rupturae hover:bg-rupturae/90 shadow-lg shadow-rupturae/20'
              )}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Sauvegarder
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
