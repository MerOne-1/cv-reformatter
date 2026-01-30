# Guide du Système de Workflow Multi-Agents

## Vue d'ensemble

Le système permet d'orchestrer plusieurs agents IA qui transforment et améliorent les CV de manière séquentielle ou parallèle.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FLUX D'EXÉCUTION                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   CV Brut (PDF/DOCX)                                                │
│        │                                                             │
│        ▼                                                             │
│   ┌─────────────┐                                                   │
│   │ EXTRACTEUR  │  Transforme le CV brut en Markdown structuré      │
│   │   (Racine)  │  Format DreamIT avec sections standardisées       │
│   └──────┬──────┘                                                   │
│          │                                                           │
│          ▼                                                           │
│   ┌─────────────┐                                                   │
│   │ENRICHISSEUR │  Améliore les descriptions existantes             │
│   │             │  Ajoute des verbes d'action, quantifie            │
│   └──────┬──────┘                                                   │
│          │                                                           │
│          ▼                                                           │
│   ┌─────────────┐                                                   │
│   │CONTEXTUALIS.│  Ajoute le contexte métier/business               │
│   │             │  Enrichit avec des enjeux projet                  │
│   └──────┬──────┘                                                   │
│          │                                                           │
│          ▼                                                           │
│   ┌─────────────┐                                                   │
│   │ BIO WRITER  │  Crée/améliore le résumé professionnel           │
│   │             │  Accroche percutante en 3-5 lignes               │
│   └──────┬──────┘                                                   │
│          │                                                           │
│          ▼                                                           │
│   ┌─────────────┐                                                   │
│   │ ADAPTATEUR  │  Réorganise pour une mission spécifique          │
│   │  (Feuille)  │  Met en avant les compétences pertinentes        │
│   └─────────────┘                                                   │
│          │                                                           │
│          ▼                                                           │
│   CV Amélioré (Markdown)                                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Concepts clés

### 1. Agent
Un agent est une unité de traitement IA qui :
- Reçoit un CV en Markdown
- Applique une transformation spécifique (via un prompt LLM)
- Retourne le CV amélioré

### 2. Connexion
Une connexion `A → B` signifie :
- L'agent B **attend** que l'agent A termine
- L'agent B reçoit le **résultat** de l'agent A comme entrée

### 3. Propriétés

| Propriété | Signification |
|-----------|---------------|
| **Racine** | Agent sans entrées (premier à s'exécuter) |
| **Feuille** | Agent sans sorties (dernier à s'exécuter) |
| **Level** | Position dans le graphe (calculé automatiquement) |
| **Order** | Ordre d'affichage dans l'UI (pas d'impact sur l'exécution) |

---

## Interface Workflow (React Flow)

### Créer une connexion

1. **Survolez** un agent
2. **Cliquez-glissez** depuis le bord droit (sortie)
3. **Relâchez** sur un autre agent

```
  [Agent A] ●────────────────→ [Agent B]
            sortie              entrée
```

### Supprimer une connexion

1. **Cliquez** sur la ligne de connexion
2. **Confirmez** la suppression

### Navigation

- **Zoom** : Molette de la souris
- **Pan** : Cliquez-glissez sur le fond
- **Minimap** : Vue d'ensemble en bas à droite
- **Contrôles** : Zoom +/- et recentrer en bas à gauche

---

## Architectures possibles

### Linéaire (actuelle)
Chaque agent traite le résultat du précédent.

```
A → B → C → D → E
```

**Avantages** : Simple, prévisible
**Inconvénients** : Pas de parallélisme

### Parallèle (fan-out)
Un agent envoie son résultat à plusieurs agents en parallèle.

```
        ┌→ B
    A ──┼→ C
        └→ D
```

**Note** : Nécessite un agent collecteur si on veut fusionner les résultats.

### Convergent (fan-in)
Plusieurs agents envoient leur résultat à un seul agent.

```
    B ──┐
    C ──┼→ E
    D ──┘
```

**Limitation actuelle** : Le worker ne prend que le dernier résultat. Pour fusionner plusieurs entrées, il faudrait modifier le code du worker.

### Diamant
Combinaison de fan-out et fan-in.

```
        ┌→ B ─┐
    A ──┤     ├→ D
        └→ C ─┘
```

---

## BullMQ et l'exécution

Le système utilise **BullMQ** avec **Redis** pour gérer l'exécution :

1. **FlowProducer** crée un arbre de jobs basé sur les connexions
2. Les jobs "children" (dépendances) s'exécutent en premier
3. Un job "parent" attend que tous ses children terminent
4. Les résultats sont passés via `getChildrenValues()`

### Exemple de flow BullMQ

Pour le workflow `A → B → C` :

```javascript
{
  name: 'agent-C',
  children: [{
    name: 'agent-B',
    children: [{
      name: 'agent-A'
    }]
  }]
}
```

L'exécution sera : `A` → `B` → `C`

---

## Fichiers importants

| Fichier | Rôle |
|---------|------|
| `lib/queue/flow-producer.ts` | Crée l'arbre de jobs BullMQ |
| `lib/queue/workers/agent-worker.ts` | Traite les jobs (appelle le LLM) |
| `components/features/agents/workflow-editor.tsx` | UI React Flow |
| `app/api/agents/connections/route.ts` | API CRUD connexions |
| `app/api/agents/graph/route.ts` | API graphe complet |

---

## FAQ

### Pourquoi mes agents s'exécutent dans le désordre ?
Les agents s'exécutent selon les **connexions**, pas l'ordre d'affichage. Vérifiez le graphe dans Settings → Workflow.

### Comment exécuter des agents en parallèle ?
Créez plusieurs connexions depuis un même agent source vers plusieurs cibles. Ils s'exécuteront en parallèle.

### Que se passe-t-il si un agent échoue ?
Avec `failParentOnFailure: true`, l'erreur se propage et arrête le workflow. Les agents suivants ne s'exécutent pas.

### Comment tester le workflow ?
1. Uploadez un CV dans l'interface principale
2. Lancez l'amélioration
3. Suivez l'exécution dans Settings → Workflow ou via l'API `/api/workflow/{id}`

---

## Évolutions futures

- [ ] Fusion intelligente des résultats (fan-in)
- [ ] Timeout configurable par agent
- [ ] Retry avec backoff configurable
- [ ] Métriques et monitoring
- [ ] Export/Import de configuration
