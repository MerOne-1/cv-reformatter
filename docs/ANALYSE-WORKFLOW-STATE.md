# Analyse : État du Workflow et Persistance du Spinner

## Problème Constaté

### Symptômes
1. **Spinner global** : Quand on clique sur "Régénérer", le spinner apparaît sur TOUS les CVs, pas uniquement sur le CV concerné
2. **Perte d'état lors de la navigation** : Si on va sur "Paramètres" et qu'on revient, le spinner s'arrête même si le workflow est toujours en cours
3. **Perte d'état au refresh** : Si on ferme/rouvre la webapp, on ne sait pas qu'un workflow est en cours pour un CV

---

## Architecture Actuelle (Analyse du Code)

### 1. Gestion de l'état dans `app/page.tsx`

```typescript
// Ligne 33 - État GLOBAL, non lié au CV
const [runningWorkflow, setRunningWorkflow] = useState(false);

// Ligne 138-196 - Fonction handleRunWorkflow
const handleRunWorkflow = async () => {
  setRunningWorkflow(true);  // ← Active le spinner GLOBALEMENT

  const response = await fetch('/api/workflow/execute', { ... });
  const executionId = data.data.executionId;  // ← Variable LOCALE, perdue si on navigue

  // Polling récursif
  const pollStatus = async () => {
    // ...
    await new Promise(resolve => setTimeout(resolve, 2000));
    return pollStatus();  // ← Récursion interrompue si composant démonté
  };

  await pollStatus();
  setRunningWorkflow(false);
};
```

**Problèmes identifiés :**
- `runningWorkflow` est un `boolean` global, pas lié au `selectedCV.id`
- `executionId` est une variable locale dans la closure, perdue lors de navigation
- Le polling récursif est interrompu quand le composant est démonté (changement de page)

### 2. Passage de l'état au `CVToolbar.tsx`

```typescript
// Ligne 335-340 de page.tsx
<CVToolbar
  onRunWorkflow={handleRunWorkflow}
  runningWorkflow={runningWorkflow}  // ← Boolean global passé en prop
/>

// CVToolbar.tsx ligne 114-127
<Button
  disabled={runningWorkflow}  // ← Désactive TOUS les boutons si true
>
  {runningWorkflow ? <Loader2 animate-spin /> : <RefreshCw />}
</Button>
```

### 3. API actuelle - Ce qui est retourné

#### `/api/cv/list` (pour la sidebar)
```typescript
// Retourne CVListItem[] - PAS d'info sur les workflows
{
  id, originalName, consultantName, title, status,
  templateName, createdAt, updatedAt, hasMissingFields
}
// ❌ Manque: hasActiveWorkflow
```

#### `/api/cv/[id]` (pour le CV sélectionné)
```typescript
// Inclut improvements et audioNotes, mais PAS workflowExecutions
include: {
  improvements: { orderBy: { appliedAt: 'desc' } },
  audioNotes: { orderBy: { createdAt: 'desc' } },
  // ❌ Manque: workflowExecutions avec status RUNNING/PENDING
}
```

### 4. Ce qui existe en base de données

```sql
-- Table WorkflowExecution (contient l'info nécessaire)
SELECT id, "cvId", status, "startedAt"
FROM "WorkflowExecution"
WHERE status IN ('PENDING', 'RUNNING');

-- Exemple de données
id                         | cvId                      | status
---------------------------+---------------------------+---------
cml6exf7m000bzzebeqmphbc9  | cml5vutas0000zz610fexhkne | RUNNING  ← Info existe !
```

**L'information existe en DB mais n'est pas exploitée côté frontend.**

---

## Schéma du Flux Actuel (Problématique)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FLUX ACTUEL                                   │
└─────────────────────────────────────────────────────────────────────────┘

ÉTAPE 1: Clic sur "Régénérer" pour CV-A
═══════════════════════════════════════
     page.tsx
     ┌──────────────────────┐
     │ runningWorkflow=true │───► Spinner sur TOUS les CVs
     │ (boolean global)     │
     └──────────────────────┘
              │
              ▼
     ┌──────────────────────┐    ┌─────────────────┐
     │ POST /workflow/exec  │───►│ DB: Workflow    │
     │ executionId stocké   │    │ status=RUNNING  │
     │ dans variable locale │    │ cvId=CV-A       │
     └──────────────────────┘    └─────────────────┘
              │
              ▼
     ┌──────────────────────┐
     │ Polling récursif     │
     │ (dans la closure)    │
     └──────────────────────┘

ÉTAPE 2: Navigation vers "Paramètres"
═════════════════════════════════════
     page.tsx DÉMONTÉ
     ┌──────────────────────┐
     │ runningWorkflow=false│    Le composant est détruit
     │ executionId=PERDU    │    La récursion s'arrête
     │ Polling=INTERROMPU   │
     └──────────────────────┘

     MAIS EN DB:
     ┌─────────────────────┐
     │ Workflow toujours   │     Le worker BullMQ continue !
     │ status=RUNNING      │
     └─────────────────────┘

ÉTAPE 3: Retour sur la page principale
══════════════════════════════════════
     page.tsx RE-MONTÉ
     ┌──────────────────────┐
     │ runningWorkflow=false│    État réinitialisé à false
     │ (useState default)   │
     └──────────────────────┘
              │
              ▼
     ┌──────────────────────┐
     │ Pas de spinner       │    L'utilisateur ne sait pas
     │ Pas de polling       │    que le workflow tourne encore
     └──────────────────────┘

     PENDANT CE TEMPS EN DB:
     ┌─────────────────────┐
     │ Workflow se termine │
     │ status=COMPLETED    │     Mais le frontend ne le sait pas
     │ CV mis à jour       │     L'utilisateur voit l'ancien markdown
     └─────────────────────┘
```

---

## Solution Proposée (Validée)

### Principe : Source de vérité = Base de données

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FLUX CIBLE                                      │
└─────────────────────────────────────────────────────────────────────────┘

1. Chargement de la page / Sélection d'un CV
════════════════════════════════════════════

     GET /api/cv/{id}
     ┌────────────────────────────────────────┐
     │ Réponse enrichie avec activeWorkflow:  │
     │ {                                      │
     │   id, markdownContent, ...,            │
     │   activeWorkflow: {         ◄── NOUVEAU│
     │     id: "exec-123",                    │
     │     status: "RUNNING",                 │
     │     progress: {completed: 2, total: 4} │
     │   } | null                             │
     │ }                                      │
     └────────────────────────────────────────┘
              │
              ▼
     ┌────────────────────────────────────────┐
     │ Si activeWorkflow !== null:            │
     │   → Afficher spinner                   │
     │   → Démarrer polling automatiquement   │
     └────────────────────────────────────────┘

2. Navigation ailleurs puis retour
══════════════════════════════════

     Re-fetch GET /api/cv/{id}
     ┌────────────────────────────────────────┐
     │ activeWorkflow toujours présent si     │
     │ le workflow n'est pas terminé          │
     └────────────────────────────────────────┘
              │
              ▼
     ┌────────────────────────────────────────┐
     │ Spinner reprend automatiquement        │
     │ Polling reprend automatiquement        │
     └────────────────────────────────────────┘

3. Workflow terminé pendant l'absence
═════════════════════════════════════

     Re-fetch GET /api/cv/{id}
     ┌────────────────────────────────────────┐
     │ activeWorkflow: null                   │
     │ markdownContent: "nouveau contenu"     │
     └────────────────────────────────────────┘
              │
              ▼
     ┌────────────────────────────────────────┐
     │ Pas de spinner (workflow terminé)      │
     │ Contenu mis à jour affiché             │
     └────────────────────────────────────────┘
```

---

## Modifications Requises

### Backend

#### 1. Modifier `/api/cv/[id]/route.ts`

```typescript
// AVANT
const cv = await prisma.cV.findUnique({
  where: { id: params.id },
  include: {
    improvements: { orderBy: { appliedAt: 'desc' } },
    audioNotes: { orderBy: { createdAt: 'desc' } },
  },
});

// APRÈS
const cv = await prisma.cV.findUnique({
  where: { id: params.id },
  include: {
    improvements: { orderBy: { appliedAt: 'desc' } },
    audioNotes: { orderBy: { createdAt: 'desc' } },
    workflowExecutions: {                           // ◄── AJOUT
      where: { status: { in: ['PENDING', 'RUNNING'] } },
      orderBy: { startedAt: 'desc' },
      take: 1,
      include: {
        steps: {
          include: { agent: { select: { name: true, displayName: true } } }
        }
      }
    },
  },
});

// Transformer pour le frontend
const activeWorkflow = cv.workflowExecutions[0]
  ? {
      id: cv.workflowExecutions[0].id,
      status: cv.workflowExecutions[0].status,
      startedAt: cv.workflowExecutions[0].startedAt,
      progress: {
        completed: cv.workflowExecutions[0].steps.filter(s => s.status === 'COMPLETED').length,
        total: cv.workflowExecutions[0].steps.length,
      }
    }
  : null;

return success({ ...cv, activeWorkflow });
```

#### 2. Modifier `/api/cv/list/route.ts` (optionnel, pour indicateur sidebar)

```typescript
// Ajouter une sous-requête pour détecter les workflows actifs
const cvsWithWorkflowStatus = await Promise.all(
  cvList.map(async (cv) => {
    const activeWorkflow = await prisma.workflowExecution.findFirst({
      where: { cvId: cv.id, status: { in: ['PENDING', 'RUNNING'] } },
      select: { id: true }
    });
    return { ...cv, hasActiveWorkflow: !!activeWorkflow };
  })
);
```

### Frontend

#### 1. Modifier `lib/types.ts`

```typescript
// Ajouter le type ActiveWorkflow
export interface ActiveWorkflow {
  id: string;
  status: 'PENDING' | 'RUNNING';
  startedAt: Date;
  progress: {
    completed: number;
    total: number;
  };
}

// Modifier CVWithImprovementsAndAudio
export interface CVWithImprovementsAndAudio extends CVWithImprovements {
  audioNotes: AudioNote[];
  activeWorkflow: ActiveWorkflow | null;  // ◄── AJOUT
}

// Modifier CVListItem (optionnel, pour sidebar)
export interface CVListItem {
  // ... existant
  hasActiveWorkflow?: boolean;  // ◄── AJOUT
}
```

#### 2. Créer un hook `hooks/useWorkflowPolling.ts`

```typescript
export function useWorkflowPolling(
  cvId: string,
  initialWorkflow: ActiveWorkflow | null,
  onComplete: (updatedCV: CVWithImprovementsAndAudio) => void
) {
  const [isRunning, setIsRunning] = useState(!!initialWorkflow);
  const [progress, setProgress] = useState(initialWorkflow?.progress);
  const [executionId, setExecutionId] = useState(initialWorkflow?.id);

  // Reprendre le polling si workflow actif au montage
  useEffect(() => {
    if (!executionId || !isRunning) return;

    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;

      const res = await fetch(`/api/workflow/status/${executionId}`);
      const data = await res.json();

      if (data.data.status === 'COMPLETED') {
        setIsRunning(false);
        // Recharger le CV
        const cvRes = await fetch(`/api/cv/${cvId}`);
        const cvData = await cvRes.json();
        onComplete(cvData.data);
        return;
      }

      if (data.data.status === 'FAILED') {
        setIsRunning(false);
        return;
      }

      setProgress(data.data.progress);
      setTimeout(poll, 2000);
    };

    poll();

    return () => { cancelled = true; };
  }, [executionId, isRunning, cvId, onComplete]);

  const startWorkflow = async () => {
    setIsRunning(true);
    const res = await fetch('/api/workflow/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cvId }),
    });
    const data = await res.json();
    setExecutionId(data.data.executionId);
  };

  return { isRunning, progress, startWorkflow };
}
```

#### 3. Modifier `app/page.tsx`

```typescript
// AVANT
const [runningWorkflow, setRunningWorkflow] = useState(false);

// APRÈS - Utiliser le hook
const { isRunning, progress, startWorkflow } = useWorkflowPolling(
  selectedCV?.id,
  selectedCV?.activeWorkflow,
  (updatedCV) => {
    setSelectedCV(updatedCV);
    setMarkdown(updatedCV.markdownContent);
    handleRefresh();
  }
);

// Dans le JSX
<CVToolbar
  runningWorkflow={isRunning}           // ◄── Lié au CV sélectionné
  workflowProgress={progress}           // ◄── Optionnel: afficher 2/4
  onRunWorkflow={startWorkflow}
/>
```

#### 4. Modifier `CVSidebar` / `CVList` (optionnel)

```typescript
// Afficher un indicateur de workflow en cours dans la liste
{cv.hasActiveWorkflow && (
  <Loader2 className="w-3 h-3 animate-spin text-primary" />
)}
```

---

## Cas d'Usage Couverts

| Scénario | Comportement Actuel | Comportement Cible |
|----------|---------------------|-------------------|
| Clic "Régénérer" sur CV-A | Spinner global | Spinner sur CV-A uniquement |
| Navigation vers Paramètres | Spinner disparaît | Spinner persiste (info en DB) |
| Retour sur CV-A | Pas de spinner | Spinner reprend automatiquement |
| Refresh navigateur | Pas de spinner | Spinner si workflow actif |
| Ouvrir dans nouvel onglet | Pas de spinner | Spinner si workflow actif |
| Sélectionner CV-B pendant workflow CV-A | Spinner reste | Pas de spinner sur CV-B |
| Revenir sur CV-A | Pas de spinner | Spinner reprend |
| Multi-utilisateurs | N/A | Chaque utilisateur voit l'état réel |

---

## Points de Vigilance

### 1. Race Condition
Si l'utilisateur clique "Régénérer" deux fois rapidement, il faut empêcher la création de deux workflows.
→ Solution : Désactiver le bouton dès le clic ET vérifier côté API qu'il n'y a pas déjà un workflow PENDING/RUNNING.

### 2. Cleanup des Workflows Orphelins
Si le worker BullMQ crash, des workflows peuvent rester en status RUNNING indéfiniment.
→ Solution : Job de nettoyage périodique qui passe à FAILED les workflows RUNNING depuis > 10 minutes.

### 3. Performance de `/api/cv/list`
Ajouter une requête par CV pour vérifier les workflows actifs peut être coûteux.
→ Solution : Faire une seule requête avec `GROUP BY cvId` ou utiliser un cache Redis.

---

## Estimation

| Tâche | Fichiers | Complexité |
|-------|----------|------------|
| Modifier GET `/api/cv/[id]` | 1 | Faible |
| Créer type `ActiveWorkflow` | 1 | Faible |
| Créer hook `useWorkflowPolling` | 1 | Moyenne |
| Modifier `page.tsx` | 1 | Moyenne |
| Modifier `CVToolbar` (props) | 1 | Faible |
| Modifier `/api/cv/list` + sidebar | 2 | Faible |
| Tests | - | Moyenne |

**Total : ~3-4h de développement**
