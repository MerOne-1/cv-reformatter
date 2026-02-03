# Implémentation: Injection des Notes + Logs des Agents

## Résumé des modifications effectuées

### 1. Injection automatique des notes dans les agents

**Objectif:** Les notes du CV (`notes` = missions passées, `futureMissionNotes` = mission cible) sont maintenant automatiquement injectées dans les prompts des agents.

**Fichiers modifiés:**

| Fichier | Modification |
|---------|--------------|
| `lib/agents.ts` | Nouveaux placeholders `{{pastMissionNotes}}`, `{{futureMissionNotes}}` et blocs conditionnels `{{#pastMissionNotes}}...{{/pastMissionNotes}}` |
| `lib/types.ts` | Types `AgentJobData` et `WorkflowConfig` mis à jour |
| `lib/queue/workers/agent-worker.ts` | Passe les notes aux prompts |
| `lib/queue/workers/orchestrator-worker.ts` | Récupère les notes du CV |
| `lib/queue/flow-producer.ts` | Propage les notes dans les jobs |
| `app/api/cv/improve/route.ts` | Injection automatique des notes |
| `app/api/workflow/execute/route.ts` | Supprimé `additionalContext` |
| `components/features/agents/agent-buttons.tsx` | Supprimé le dialogue de contexte manuel |

**Statut:** ✅ Code implémenté

---

### 2. Logs détaillés des exécutions d'agents

**Objectif:** Enregistrer tous les inputs/outputs des agents pour analyser et améliorer les prompts.

**Nouvelle table `AgentExecutionLog`:**

```sql
CREATE TABLE "AgentExecutionLog" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,           -- Référence à l'agent
    "cvId" TEXT NOT NULL,              -- Référence au CV
    "executionId" TEXT,                -- ID workflow (si via workflow)
    "stepId" TEXT,                     -- ID step (si via workflow)
    "systemPrompt" TEXT NOT NULL,      -- Prompt système complet
    "userPrompt" TEXT NOT NULL,        -- Prompt utilisateur complet
    "inputMarkdown" TEXT NOT NULL,     -- Markdown en entrée
    "pastMissionNotes" TEXT,           -- Notes missions passées
    "futureMissionNotes" TEXT,         -- Notes mission future
    "outputMarkdown" TEXT,             -- Réponse du LLM
    "durationMs" INTEGER,              -- Durée appel LLM (ms)
    "tokensInput" INTEGER,             -- Tokens en entrée
    "tokensOutput" INTEGER,            -- Tokens en sortie
    "success" BOOLEAN DEFAULT true,    -- Succès/échec
    "error" TEXT,                      -- Message d'erreur
    "createdAt" TIMESTAMP DEFAULT NOW()
);
```

**Fichiers modifiés:**

| Fichier | Modification |
|---------|--------------|
| `prisma/schema.prisma` | Nouveau modèle `AgentExecutionLog` |
| `lib/types.ts` | Export du type `AgentExecutionLog` |
| `lib/queue/workers/agent-worker.ts` | Création du log après exécution |
| `app/api/cv/improve/route.ts` | Création du log après exécution |
| `app/api/agents/[id]/logs/route.ts` | **NOUVEAU** - API pour consulter les logs d'un agent |
| `app/api/agents/logs/route.ts` | **NOUVEAU** - API pour consulter tous les logs |

**Statut:** ✅ Code implémenté, ⚠️ Migration à appliquer en production

---

## Actions requises

### En local (développement)

La migration a été appliquée automatiquement avec `prisma db push`.

**Pour vérifier:**
```bash
# Ouvrir Prisma Studio
pnpm prisma studio
# → Vérifier que la table AgentExecutionLog existe
```

**Pour tester:**
1. Ouvrir http://localhost:3000
2. Sélectionner un CV avec du contenu extrait
3. Cliquer sur un des boutons agents (Enrichisseur, Adaptateur, etc.)
4. Vérifier dans Prisma Studio (http://localhost:5558) que un enregistrement a été créé dans `AgentExecutionLog`

---

### En production (serveur)

**Étape 1: Appliquer la migration**

```bash
# Option A: Via Prisma (recommandé)
pnpm prisma db push

# Option B: Via SQL direct
psql $DATABASE_URL -f prisma/migrations/add_agent_execution_log.sql
```

**Étape 2: Mettre à jour les prompts des agents**

```bash
# Exécuter le script SQL pour mettre à jour les templates avec les nouveaux placeholders
psql $DATABASE_URL -f prisma/migrations/update-agent-prompts-notes.sql
```

**Étape 3: Redéployer l'application**

```bash
# Sur Coolify/Docker
# Rebuild et redéployer les containers app et worker
```

---

## APIs disponibles

### GET /api/agents/[id]/logs

Récupère les logs d'un agent spécifique.

**Query params:**
- `limit` (default: 20, max: 100)
- `offset` (default: 0)
- `cvId` (optionnel) - Filtrer par CV
- `success` (optionnel) - `true` ou `false`

**Réponse:**
```json
{
  "success": true,
  "data": {
    "agent": { "id": "...", "name": "enrichisseur", "displayName": "Enrichisseur" },
    "logs": [...],
    "pagination": { "total": 42, "limit": 20, "offset": 0, "hasMore": true },
    "stats": {
      "totalExecutions": 42,
      "successRate": 95.2,
      "avgDurationMs": 3500,
      "minDurationMs": 1200,
      "maxDurationMs": 8900
    }
  }
}
```

### GET /api/agents/logs

Récupère tous les logs (tous agents confondus).

**Query params:**
- `limit`, `offset`, `cvId`, `success` (comme ci-dessus)
- `agentId` (optionnel) - Filtrer par agent

---

## Structure des logs

Chaque log contient:

| Champ | Description | Utilité |
|-------|-------------|---------|
| `systemPrompt` | Prompt système complet | Voir les instructions données à l'IA |
| `userPrompt` | Prompt utilisateur complet | Voir le template avec les données injectées |
| `inputMarkdown` | CV en entrée | Comparer avant/après |
| `pastMissionNotes` | Notes missions passées | Vérifier l'injection |
| `futureMissionNotes` | Notes mission future | Vérifier l'injection |
| `outputMarkdown` | Réponse du LLM | Analyser la qualité |
| `durationMs` | Temps de réponse | Monitorer les performances |

---

## Troubleshooting

### Les logs ne s'enregistrent pas

1. **Vérifier que la table existe:**
   ```bash
   docker exec cv-reformatter-db psql -U postgres -d cv_reformatter -c "SELECT COUNT(*) FROM \"AgentExecutionLog\""
   ```

2. **Redémarrer le serveur Next.js:**
   ```bash
   # Tuer le processus sur le port 3000
   kill $(lsof -t -i :3000)
   # Relancer
   pnpm dev
   ```

3. **Vérifier les logs serveur pour des erreurs:**
   ```bash
   # Les erreurs Prisma s'affichent dans la console du serveur
   ```

### Les notes ne sont pas injectées

1. **Vérifier que les prompts sont mis à jour en base:**
   ```sql
   SELECT name, "userPromptTemplate" FROM "AIAgent" WHERE name = 'enrichisseur';
   -- Doit contenir {{pastMissionNotes}} ou {{futureMissionNotes}}
   ```

2. **Mettre à jour les prompts:**
   ```bash
   psql $DATABASE_URL -f prisma/migrations/update-agent-prompts-notes.sql
   ```

---

## Fichiers de migration

| Fichier | Description |
|---------|-------------|
| `prisma/migrations/add_agent_execution_log.sql` | Crée la table AgentExecutionLog |
| `prisma/migrations/update-agent-prompts-notes.sql` | Met à jour les templates des agents |

---

## Prochaines étapes suggérées

1. **Interface de visualisation des logs** - Créer une page dans l'admin pour consulter les logs
2. **Export des logs** - Permettre l'export CSV/JSON pour analyse externe
3. **Métriques de tokens** - Récupérer le nombre de tokens depuis l'API LLM
4. **Agent Nettoyeur** - Créer un agent qui nettoie les transcriptions audio (Phase 3 du plan)
