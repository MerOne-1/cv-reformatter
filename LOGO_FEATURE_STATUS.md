# Fonctionnalité Logo - État d'avancement

## Ce qui a été codé

### 1. Upload de logo dans les paramètres
- **Fichiers modifiés** :
  - `app/settings/page.tsx` - Interface d'upload/suppression de logo
  - `app/api/templates/[id]/logo/route.ts` - API POST/DELETE pour les logos
  - `lib/templates/template-utils.ts` - Fonction `uploadTemplateLogo` avec support type `main`

- **Fonctionnalités** :
  - Bouton "Ajouter un logo" fonctionnel dans les paramètres templates
  - Upload d'images (PNG, JPG, GIF) vers Backblaze B2
  - Suppression de logo existant
  - Validation du type de fichier et des magic bytes
  - Utilisation du champ `logoUrl` (un seul logo par template)

### 2. Génération DOCX avec logo
- **Fichiers modifiés** :
  - `lib/docx/generator.ts` - Utilisation de `logoUrl` au lieu de `logoHeaderUrl`/`logoFooterUrl`
  - `lib/docx/builder.ts` - Header avec logo + initiales, Footer avec marque/pagination/website

- **Fonctionnalités** :
  - Header : Logo à gauche, initiales du consultant à droite
  - Footer : Nom de marque à gauche, pagination (1/3, 2/3...) au centre, site web à droite
  - Utilisation d'une table pour l'alignement correct dans le footer

### 3. Preview PDF (partiellement implémenté)
- **Fichiers créés** :
  - `components/features/cv/cv-pdf-document.tsx` - Document PDF avec @react-pdf/renderer
  - `components/features/cv/cv-preview-modal.tsx` - Modal avec PDFViewer

- **Fichiers modifiés** :
  - `app/page.tsx` - Récupération des templates, passage de `logoUrl`, `website`, `consultantName`
  - `next.config.js` - Ajout de `transpilePackages: ['@react-pdf/renderer']`

- **Dépendances ajoutées** :
  - `@react-pdf/renderer` v4.3.2

## Ce qui était prévu

1. **Preview paginée fidèle au DOCX** : Afficher un aperçu PDF avec des pages A4 distinctes, header/footer répétés sur chaque page (comme le template PDF de référence)

2. **Header conforme au template** : Logo en haut à gauche + initiales en haut à droite sur chaque page

3. **Footer conforme au template** : "DreamIT" à gauche, "1/3" au centre, "www.dreamit-astek.fr" à droite

## Ce qui ne fonctionne pas

### Erreur actuelle dans la preview PDF
- **Type** : `RangeError: Out of bounds access` avec `setUint16`
- **Cause probable** : Enregistrement des polices Google Fonts (Inter) dans `@react-pdf/renderer`
- **Impact** : La preview PDF ne s'affiche pas, erreur JavaScript dans la console

### Problèmes identifiés
1. Les polices custom (Inter via Google Fonts) causent une erreur de buffer
2. Le logo externe (URL Backblaze) pourrait aussi poser un problème CORS

## Ce qui reste à faire

### Corrections urgentes
1. Supprimer ou corriger l'enregistrement des polices dans `cv-pdf-document.tsx`
2. Tester le chargement du logo depuis Backblaze B2 (possible problème CORS)
3. Valider que la preview PDF s'affiche correctement

### Améliorations à prévoir
1. Ajouter un champ "Site web" éditable dans la page des paramètres templates
2. Vérifier que l'export DOCX inclut bien le logo sur chaque page
3. Ajuster la taille du logo (configurable via `config.logos.header`)
4. Tester avec différents templates (DREAMIT, RUPTURAE)

### Tests à effectuer
1. Upload d'un logo PNG/JPG dans les paramètres
2. Preview PDF avec le logo affiché
3. Export DOCX avec logo en header et footer correct
4. Vérification de la pagination sur documents multi-pages
