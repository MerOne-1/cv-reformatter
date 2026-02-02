# Plan de Migration vers next-zod-route

## Vue d'ensemble

**22 fichiers route.ts** à migrer vers `next-zod-route` pour une validation Zod déclarative et un typage automatique.

---

## Phase 1: Setup (15 min)

### 1.1 Installation

```bash
pnpm add next-zod-route
```

### 1.2 Créer le helper partagé

Créer `lib/api-route.ts` :

```typescript
import { createRoute } from 'next-zod-route';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

// Route builder avec gestion d'erreurs standardisée
export const apiRoute = createRoute({
  handleServerError: (error) => {
    console.error('API Error:', error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  },
});

// Helper pour réponses standardisées
export function success<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function error(message: string, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status });
}
```

---

## Phase 2: Migration par priorité

### Priorité 1 - Routes CV (Core Business)

| Fichier | Méthodes | Validation actuelle | Complexité |
|---------|----------|---------------------|------------|
| `api/cv/[id]/route.ts` | GET, PATCH, DELETE | Zod (body) | Moyenne |
| `api/cv/upload/route.ts` | POST | FormData manuel | Haute |
| `api/cv/extract/route.ts` | POST | Zod (body) | Moyenne |
| `api/cv/improve/route.ts` | POST | Zod (body) | Moyenne |
| `api/cv/generate-docx/route.ts` | POST | Zod (body) | Moyenne |
| `api/cv/upload-final/route.ts` | POST | Zod (body) | Moyenne |
| `api/cv/list/route.ts` | GET | Aucune | Faible |
| `api/cv/preview/[id]/route.ts` | GET | Aucune | Faible |

### Priorité 2 - Routes Agents

| Fichier | Méthodes | Validation actuelle | Complexité |
|---------|----------|---------------------|------------|
| `api/agents/route.ts` | GET, POST | Zod (body) | Moyenne |
| `api/agents/[id]/route.ts` | GET, PATCH, DELETE | Zod (body) | Moyenne |
| `api/agents/connections/route.ts` | GET, POST | Zod (body) | Moyenne |
| `api/agents/connections/[id]/route.ts` | GET, PATCH, DELETE | Zod (body) | Moyenne |
| `api/agents/graph/route.ts` | GET | Aucune | Faible |
| `api/agents/positions/route.ts` | PATCH | Zod (body) | Faible |

### Priorité 3 - Routes Templates

| Fichier | Méthodes | Validation actuelle | Complexité |
|---------|----------|---------------------|------------|
| `api/templates/route.ts` | GET, POST | Zod (body) | Moyenne |
| `api/templates/[id]/route.ts` | GET, PATCH, DELETE | Zod (body) | Moyenne |
| `api/templates/[id]/logo/route.ts` | POST, DELETE | FormData | Haute |

### Priorité 4 - Routes Workflow

| Fichier | Méthodes | Validation actuelle | Complexité |
|---------|----------|---------------------|------------|
| `api/workflow/execute/route.ts` | POST | Zod (body) | Moyenne |
| `api/workflow/[executionId]/route.ts` | GET | Aucune | Faible |
| `api/workflow/list/route.ts` | GET | Query params | Faible |

### Priorité 5 - Routes Utilitaires (optionnel)

| Fichier | Méthodes | Notes |
|---------|----------|-------|
| `api/health/route.ts` | GET | Simple, pas de validation |
| `api/proxy-image/route.ts` | GET | Query param simple |

---

## Phase 3: Patterns de migration

### Pattern A: Route simple GET (sans params)

**Avant:**
```typescript
// api/cv/list/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const cvs = await prisma.cV.findMany();
    return NextResponse.json({ success: true, data: cvs });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}
```

**Après:**
```typescript
import { apiRoute, success } from '@/lib/api-route';

export const GET = apiRoute()
  .handler(async () => {
    const cvs = await prisma.cV.findMany();
    return success(cvs);
  });
```

### Pattern B: Route GET avec params dynamiques

**Avant:**
```typescript
// api/cv/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cv = await prisma.cV.findUnique({ where: { id } });
  if (!cv) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: cv });
}
```

**Après:**
```typescript
import { apiRoute, success, error } from '@/lib/api-route';
import { z } from 'zod';

export const GET = apiRoute()
  .params(z.object({ id: z.string().cuid() }))
  .handler(async ({ params }) => {
    const cv = await prisma.cV.findUnique({ where: { id: params.id } });
    if (!cv) return error('Not found', 404);
    return success(cv);
  });
```

### Pattern C: Route POST/PATCH avec body

**Avant:**
```typescript
// api/cv/[id]/route.ts
const updateSchema = z.object({
  markdownContent: z.string().optional(),
  notes: z.string().max(10000).nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = updateSchema.parse(body);

    const cv = await prisma.cV.update({
      where: { id },
      data: validatedData,
    });

    return NextResponse.json({ success: true, data: cv });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid data' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}
```

**Après:**
```typescript
import { apiRoute, success } from '@/lib/api-route';
import { z } from 'zod';

const updateSchema = z.object({
  markdownContent: z.string().optional(),
  notes: z.string().max(10000).nullable().optional(),
});

export const PATCH = apiRoute()
  .params(z.object({ id: z.string().cuid() }))
  .body(updateSchema)
  .handler(async ({ params, body }) => {
    const cv = await prisma.cV.update({
      where: { id: params.id },
      data: body,
    });
    return success(cv);
  });
```

### Pattern D: Route avec query params

**Avant:**
```typescript
// api/workflow/list/route.ts
export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get('status');
  const cvId = request.nextUrl.searchParams.get('cvId');

  const executions = await prisma.workflowExecution.findMany({
    where: {
      ...(status && { status: status as ExecutionStatus }),
      ...(cvId && { cvId }),
    },
  });

  return NextResponse.json({ success: true, data: executions });
}
```

**Après:**
```typescript
import { apiRoute, success } from '@/lib/api-route';
import { z } from 'zod';

const querySchema = z.object({
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED']).optional(),
  cvId: z.string().cuid().optional(),
});

export const GET = apiRoute()
  .query(querySchema)
  .handler(async ({ query }) => {
    const executions = await prisma.workflowExecution.findMany({
      where: {
        ...(query.status && { status: query.status }),
        ...(query.cvId && { cvId: query.cvId }),
      },
    });
    return success(executions);
  });
```

### Pattern E: Route FormData (upload)

**Note:** `next-zod-route` gère le body JSON par défaut. Pour FormData, garder le pattern actuel ou utiliser un middleware custom.

**Option 1 - Garder manuel:**
```typescript
// api/cv/upload/route.ts - Garder le code actuel pour FormData
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  // ... logique existante
}
```

**Option 2 - Wrapper custom:**
```typescript
// lib/api-route.ts - Ajouter helper FormData
export const formDataRoute = createRoute({
  // config pour FormData
});
```

---

## Phase 4: Checklist de migration par fichier

### api/cv/[id]/route.ts
- [ ] Import `apiRoute, success, error` depuis `@/lib/api-route`
- [ ] Migrer GET avec `.params()`
- [ ] Migrer PATCH avec `.params()` et `.body()`
- [ ] Migrer DELETE avec `.params()`
- [ ] Supprimer try/catch (géré par apiRoute)
- [ ] Supprimer imports `NextRequest, NextResponse`
- [ ] Tester GET, PATCH, DELETE

### api/cv/list/route.ts
- [ ] Migrer GET simple
- [ ] Tester

### api/cv/extract/route.ts
- [ ] Migrer POST avec `.body()`
- [ ] Tester

### api/cv/improve/route.ts
- [ ] Migrer POST avec `.body()`
- [ ] Tester

### api/cv/generate-docx/route.ts
- [ ] Migrer POST avec `.body()`
- [ ] Note: Retourne un blob, pas JSON
- [ ] Tester téléchargement DOCX

### api/cv/upload-final/route.ts
- [ ] Migrer POST avec `.body()`
- [ ] Tester

### api/cv/upload/route.ts
- [ ] **Décision:** Garder FormData manuel ou créer wrapper
- [ ] Tester upload fichier

### api/cv/preview/[id]/route.ts
- [ ] Migrer GET avec `.params()`
- [ ] Note: Retourne fichier, pas JSON
- [ ] Tester preview

### api/agents/route.ts
- [ ] Migrer GET simple
- [ ] Migrer POST avec `.body()`
- [ ] Tester

### api/agents/[id]/route.ts
- [ ] Migrer GET, PATCH, DELETE
- [ ] Tester

### api/agents/connections/route.ts
- [ ] Migrer GET, POST
- [ ] Tester

### api/agents/connections/[id]/route.ts
- [ ] Migrer GET, PATCH, DELETE
- [ ] Tester

### api/agents/graph/route.ts
- [ ] Migrer GET simple
- [ ] Tester

### api/agents/positions/route.ts
- [ ] Migrer PATCH avec `.body()`
- [ ] Tester

### api/templates/route.ts
- [ ] Migrer GET, POST
- [ ] Tester

### api/templates/[id]/route.ts
- [ ] Migrer GET, PATCH, DELETE
- [ ] Tester

### api/templates/[id]/logo/route.ts
- [ ] **Décision:** Garder FormData manuel
- [ ] Tester upload logo

### api/workflow/execute/route.ts
- [ ] Migrer POST avec `.body()`
- [ ] Tester

### api/workflow/[executionId]/route.ts
- [ ] Migrer GET avec `.params()`
- [ ] Tester

### api/workflow/list/route.ts
- [ ] Migrer GET avec `.query()`
- [ ] Tester

### api/health/route.ts
- [ ] Optionnel - Simple, peut rester tel quel
- [ ] Tester

### api/proxy-image/route.ts
- [ ] Migrer GET avec `.query()`
- [ ] Tester

---

## Phase 5: Tests de non-régression

```bash
# 1. Lancer l'app
pnpm dev

# 2. Tester chaque endpoint manuellement ou via curl/Postman

# 3. Vérifier les cas d'erreur:
# - Body invalide → 400 avec détails Zod
# - Params invalides → 400
# - Ressource non trouvée → 404
# - Erreur serveur → 500
```

---

## Estimation de temps

| Phase | Durée estimée |
|-------|---------------|
| Phase 1: Setup | 15 min |
| Phase 2: Routes CV (8 fichiers) | 2h |
| Phase 2: Routes Agents (6 fichiers) | 1h30 |
| Phase 2: Routes Templates (3 fichiers) | 45 min |
| Phase 2: Routes Workflow (3 fichiers) | 30 min |
| Phase 2: Routes Utilitaires (2 fichiers) | 15 min |
| Phase 5: Tests | 1h |
| **Total** | **~6h** |

---

## Notes importantes

1. **Routes avec réponses non-JSON** (preview, generate-docx): Vérifier que `next-zod-route` supporte le retour de `Response` ou `NextResponse` avec blob/stream.

2. **Routes FormData** (upload, logo): Garder le pattern manuel ou créer un helper dédié.

3. **Migration incrémentale**: Migrer une route à la fois, tester, puis continuer. Ne pas tout migrer d'un coup.

4. **Rollback facile**: Garder les anciens fichiers commentés ou dans une branche séparée jusqu'à validation complète.
