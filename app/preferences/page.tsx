'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ColorPicker } from '@/components/ui/color-picker';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import {
  ArrowLeft,
  Loader2,
  Save,
  User,
  Palette,
  Check,
} from 'lucide-react';

export default function PreferencesPage() {
  const { data: session, isPending: sessionLoading } = useSession();
  const [highlightColor, setHighlightColor] = useState('#3B82F6');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      fetchPreferences();
    }
  }, [session?.user?.id]);

  const fetchPreferences = async () => {
    if (!session?.user?.id) return;

    try {
      const response = await fetch(`/api/users/${session.user.id}/preferences`);
      const data = await response.json();
      if (data.success && data.data.highlightColor) {
        setHighlightColor(data.data.highlightColor);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!session?.user?.id) return;

    setSaving(true);
    setSaved(false);

    try {
      const response = await fetch(`/api/users/${session.user.id}/preferences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ highlightColor }),
      });

      const data = await response.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        alert('Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (sessionLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">
              Vous devez être connecté pour accéder à cette page.
            </p>
            <div className="mt-4 flex justify-center">
              <Link href="/login">
                <Button>Se connecter</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="icon" className="rounded-xl">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-dreamit to-rupturae flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-lg font-display font-medium">Préférences</h1>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Informations du compte
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Nom
                </label>
                <p className="text-foreground mt-1">{session.user.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Email
                </label>
                <p className="text-foreground mt-1">{session.user.email}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-primary" />
                Couleur de surlignage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Cette couleur sera utilisée pour identifier vos modifications dans
                l&apos;éditeur collaboratif. Les autres utilisateurs verront vos
                changements surlignés avec cette couleur.
              </p>

              <ColorPicker
                value={highlightColor}
                onChange={setHighlightColor}
              />

              <div className="flex items-center gap-3 pt-4 border-t border-border">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : saved ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saving ? 'Enregistrement...' : saved ? 'Enregistré' : 'Enregistrer'}
                </Button>

                {saved && (
                  <span className="text-sm text-success">
                    Préférences sauvegardées avec succès
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full" style={{ backgroundColor: highlightColor }} />
                Aperçu collaboratif
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-secondary/30 rounded-lg p-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Voici comment vos modifications apparaîtront pour les autres
                  utilisateurs :
                </p>
                <div className="bg-card rounded-lg p-4 border border-border">
                  <p className="text-foreground leading-relaxed">
                    Le consultant possède une{' '}
                    <span
                      className="px-1 rounded"
                      style={{ backgroundColor: `${highlightColor}40` }}
                    >
                      solide expérience en développement web
                    </span>{' '}
                    et maîtrise les technologies modernes comme React et Node.js.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: highlightColor }}
                  />
                  <span>Modifié par {session.user.name}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
