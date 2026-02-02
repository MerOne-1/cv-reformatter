# Tests E2E - CV Reformatter

Ce dossier contient les tests end-to-end (E2E) utilisant Playwright.

## Structure

```
e2e/
├── auth.setup.ts              # Setup d'authentification (exécuté une fois)
├── fixtures/
│   └── auth.fixture.ts        # Fixtures personnalisés pour les tests auth
├── helpers/
│   └── auth.helpers.ts        # Fonctions utilitaires
├── auth/
│   ├── login.spec.ts          # Tests de connexion
│   ├── logout.spec.ts         # Tests de déconnexion
│   ├── session.spec.ts        # Tests de gestion de session
│   ├── protected-routes.spec.ts # Tests de protection des routes
│   ├── api-protection.spec.ts # Tests de protection des API
│   ├── multi-tab.spec.ts      # Tests multi-onglets
│   └── reconnection.spec.ts   # Tests de reconnexion
├── workflow.spec.ts           # Tests du workflow CV
└── README.md                  # Ce fichier
```

## Prérequis

1. **Base de données avec utilisateur de test:**
   ```bash
   pnpm db:seed
   ```

2. **Variables d'environnement configurées** (`.env`)

3. **Serveur de développement disponible** (le test le démarre automatiquement)

## Exécution des Tests

### Tous les tests

```bash
pnpm test:e2e
```

### Tests spécifiques

```bash
# Tests d'authentification uniquement
pnpm exec playwright test auth/

# Tests de login
pnpm exec playwright test auth/login.spec.ts

# Tests avec UI
pnpm exec playwright test --ui

# Tests en mode headed (navigateur visible)
pnpm exec playwright test --headed
```

### Debug

```bash
# Mode debug avec Playwright Inspector
pnpm exec playwright test --debug

# Générer un rapport HTML
pnpm exec playwright show-report
```

## Architecture des Tests

### Projects Playwright

La configuration définit plusieurs "projects" pour gérer l'authentification:

| Project | Description | Auth State |
|---------|-------------|------------|
| `setup` | Authentification initiale | Génère `user.json` |
| `authenticated` | Tests nécessitant une session | Utilise `user.json` |
| `unauthenticated` | Tests sans session | Contexte vierge |
| `multi-tab` | Tests multi-onglets | Gestion spéciale |
| `workflow` | Tests du workflow CV | Utilise `user.json` |

### Fixtures Personnalisés

```typescript
import { test, expect } from '../fixtures/auth.fixture';

test('mon test', async ({ authenticatedPage, testUser }) => {
  // authenticatedPage = page avec session active
  // testUser = { email, password, name }
});
```

### Helpers Disponibles

```typescript
import {
  TEST_USER,           // Credentials de test
  loginViaUI,          // Login via formulaire
  logout,              // Déconnexion
  hasSessionCookie,    // Vérifier session
  getSessionCookie,    // Récupérer token
  clearAuthState,      // Nettoyer session
} from '../helpers/auth.helpers';
```

## Bonnes Pratiques

### 1. Isolation des Tests

Chaque test doit être indépendant. Utiliser les fixtures pour l'état initial:

```typescript
// Bon
test('should do something', async ({ authenticatedPage }) => {
  // Page déjà authentifiée
});

// Éviter
test('should do something', async ({ page }) => {
  await loginViaUI(page); // Login dans chaque test = lent
});
```

### 2. Attentes Explicites

Toujours attendre les éléments avant d'interagir:

```typescript
// Bon
await expect(page.getByRole('button')).toBeVisible();
await page.getByRole('button').click();

// Éviter
await page.getByRole('button').click(); // Peut échouer si pas encore visible
```

### 3. Sélecteurs Robustes

Préférer les sélecteurs accessibles:

```typescript
// Bon
page.getByRole('button', { name: /connexion/i });
page.getByLabel(/email/i);

// Éviter
page.locator('.btn-primary');
page.locator('#login-email');
```

### 4. Gestion des Timeouts

Pour les opérations lentes, utiliser des timeouts explicites:

```typescript
await page.waitForURL(/\/home/, { timeout: 15000 });
```

## Credentials de Test

Les credentials sont définis dans `helpers/auth.helpers.ts`:

```typescript
export const TEST_USER = {
  email: 'merwan.mezrag@rupturae.com',
  password: 'Merwan',
  name: 'Merwan',
};
```

**Note:** Ces credentials doivent correspondre à un utilisateur existant en base de données.

## Storage State

L'état de session est sauvegardé dans `playwright/.auth/user.json` (gitignored).

Ce fichier est généré par `auth.setup.ts` et réutilisé par les tests authentifiés.

Pour régénérer:

```bash
rm -rf playwright/.auth
pnpm test:e2e
```

## Troubleshooting

### Test échoue avec "Session not found"

1. Vérifier que l'utilisateur de test existe: `pnpm db:seed`
2. Supprimer le cache: `rm -rf playwright/.auth`
3. Relancer les tests

### Timeout sur login

1. Vérifier que le serveur est accessible: `curl http://localhost:3000/api/health`
2. Augmenter le timeout dans la config si nécessaire

### Tests flaky

1. Ajouter des `waitForLoadState('networkidle')`
2. Utiliser `expect().toBeVisible()` avant les clics
3. Éviter les `waitForTimeout()` fixes
