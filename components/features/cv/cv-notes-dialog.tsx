'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, StickyNote } from 'lucide-react';

interface CVNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: string | null;
  onSave: (notes: string) => Promise<void>;
}

export function CVNotesDialog({ open, onOpenChange, notes, onSave }: CVNotesDialogProps) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(notes || '');
    }
  }, [open, notes]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(value);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-amber-500" />
            Notes de contextualisation
          </DialogTitle>
          <DialogDescription>
            Ajoutez des notes pour orienter la contextualisation du CV. Ces informations seront
            utilisées par l&apos;agent IA pour adapter le contenu (ex: profil ingénieur, data scientist, etc.).
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={10}
            className="resize-none"
            placeholder="Exemples de notes :
- Le candidat vise des postes de Data Engineer
- Mettre en avant l'expérience cloud (AWS, GCP)
- Profil orienté architecture technique
- Insister sur le leadership et la gestion d'équipe
- Le poste cible est dans le secteur bancaire"
          />
          <p className="text-xs text-muted-foreground mt-2">
            {value.length} caractères
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving} variant="dreamit">
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sauvegarde...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Sauvegarder
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
