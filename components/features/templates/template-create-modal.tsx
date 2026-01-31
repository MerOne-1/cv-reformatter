'use client';

import { useState, useEffect } from 'react';
import { X, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TemplateCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface FormData {
  name: string;
  displayName: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  mutedColor: string;
  website: string;
}

const defaultFormData: FormData = {
  name: '',
  displayName: '',
  primaryColor: '#1E3A8A',
  secondaryColor: '#3B82F6',
  textColor: '#1F2937',
  mutedColor: '#6B7280',
  website: '',
};

export function TemplateCreateModal({ isOpen, onClose, onCreated }: TemplateCreateModalProps) {
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erreur lors de la création');
      }

      setFormData(defaultFormData);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Reset form state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setFormData(defaultFormData);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Nouveau Template</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Identifiant (sans espaces)</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value.toUpperCase().replace(/\s/g, '_'))}
              placeholder="NOM_TEMPLATE"
              className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Nom d'affichage</label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => handleChange('displayName', e.target.value)}
              placeholder="Nom du Template"
              className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Couleur primaire</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={formData.primaryColor}
                  onChange={(e) => handleChange('primaryColor', e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border border-border"
                />
                <input
                  type="text"
                  value={formData.primaryColor}
                  onChange={(e) => handleChange('primaryColor', e.target.value)}
                  className="flex-1 px-3 py-2 bg-secondary/50 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Couleur secondaire</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={formData.secondaryColor}
                  onChange={(e) => handleChange('secondaryColor', e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border border-border"
                />
                <input
                  type="text"
                  value={formData.secondaryColor}
                  onChange={(e) => handleChange('secondaryColor', e.target.value)}
                  className="flex-1 px-3 py-2 bg-secondary/50 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Couleur texte</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={formData.textColor}
                  onChange={(e) => handleChange('textColor', e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border border-border"
                />
                <input
                  type="text"
                  value={formData.textColor}
                  onChange={(e) => handleChange('textColor', e.target.value)}
                  className="flex-1 px-3 py-2 bg-secondary/50 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Couleur atténuée</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={formData.mutedColor}
                  onChange={(e) => handleChange('mutedColor', e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border border-border"
                />
                <input
                  type="text"
                  value={formData.mutedColor}
                  onChange={(e) => handleChange('mutedColor', e.target.value)}
                  className="flex-1 px-3 py-2 bg-secondary/50 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Site web (optionnel)</label>
            <input
              type="text"
              value={formData.website}
              onChange={(e) => handleChange('website', e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="p-3 bg-secondary/30 rounded-lg">
            <label className="text-sm font-medium mb-2 block">Aperçu</label>
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full"
                style={{
                  background: `linear-gradient(135deg, ${formData.primaryColor}, ${formData.secondaryColor})`,
                }}
              />
              <div>
                <div className="font-medium" style={{ color: formData.textColor }}>
                  {formData.displayName || 'Nom du Template'}
                </div>
                <div className="text-xs" style={{ color: formData.mutedColor }}>
                  {formData.name || 'IDENTIFIANT'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-sm font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name || !formData.displayName}
              className={cn(
                'flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors',
                loading || !formData.name || !formData.displayName
                  ? 'bg-primary/50 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary/90'
              )}
            >
              {loading ? 'Création...' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
