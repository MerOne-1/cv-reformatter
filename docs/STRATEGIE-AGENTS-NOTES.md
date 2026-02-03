# Strategie d'integration des notes dans les agents IA

## Objectif

Creer un systeme agentique intelligent qui produit un CV parfait en exploitant :
- Les **notes sur les missions passees** : contexte reel des experiences du candidat
- Les **notes sur la mission future** : poste/mission cible pour adapter le CV

---

## Etat actuel

### Placeholders existants
```
{{markdown}}  - Contenu du CV
{{context}}   - Contexte manuel (OBSOLETE)
```

### Problemes identifies

1. **Saisie manuelle obsolete** : Le `{{context}}` necessite une saisie dans un dialogue a chaque execution
2. **Notes non exploitees** : Les champs `notes` et `futureMissionNotes` du CV ne sont jamais injectes dans les agents
3. **Perte d'information** : Les transcriptions audio et notes contextuelles ne servent a rien actuellement

---

## Nouveau systeme propose

### 1. Nouveaux placeholders

```
{{pastMissionNotes}}       - Notes sur les missions passees (transcriptions, contexte)
{{futureMissionNotes}}     - Notes sur la mission/poste cible

{{#pastMissionNotes}}...{{/pastMissionNotes}}       - Bloc conditionnel (affiche si non vide)
{{#futureMissionNotes}}...{{/futureMissionNotes}}   - Bloc conditionnel (affiche si non vide)
```

### 2. Suppression du systeme obsolete

- Supprimer le parametre `additionalContext` des APIs
- Supprimer le dialogue de saisie manuelle dans le front
- Remplacer `{{context}}` par les nouveaux placeholders dans tous les prompts

---

## Architecture agentique

### Pipeline de generation du CV parfait

```
                                    +------------------+
                                    |   Notes brutes   |
                                    | (transcriptions) |
                                    +--------+---------+
                                             |
                                             v
                                    +------------------+
                                    |    Nettoyeur     |  <-- Optionnel
                                    | (reformate les   |
                                    |  transcriptions) |
                                    +--------+---------+
                                             |
                         +-------------------+-------------------+
                         |                                       |
                         v                                       v
              +----------+----------+                 +----------+----------+
              | pastMissionNotes    |                 | futureMissionNotes  |
              | (notes nettoyees)   |                 | (poste cible)       |
              +----------+----------+                 +----------+----------+
                         |                                       |
                         +-------------------+-------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------+
|                              WORKFLOW DES AGENTS                                  |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|   +-------------+      +---------------+      +------------+      +------------+  |
|   | Extraction  | ---> | Enrichisseur  | ---> |  Contexte  | ---> |    Bio     |  |
|   +-------------+      +---------------+      +------------+      +------------+  |
|         |                     |                     |                   |         |
|   pastMissionNotes      pastMissionNotes      Les deux notes      Les deux notes  |
|                                                                                   |
|                                                     +------------+                |
|                                                     | Adaptateur | <-- futureMissionNotes
|                                                     +------------+                |
|                                                                                   |
+-----------------------------------------------------------------------------------+
                                             |
                                             v
                                    +------------------+
                                    |   CV PARFAIT     |
                                    | - Contextualise  |
                                    | - Adapte au poste|
                                    | - Valorise       |
                                    +------------------+
```

### 3. Role de chaque agent avec les notes

| Agent | pastMissionNotes | futureMissionNotes | Objectif |
|-------|------------------|-------------------|----------|
| **Extraction** | ✅ | ❌ | Comprendre le vrai contexte pour mieux extraire et structurer |
| **Enrichisseur** | ✅ | ❌ | Valoriser les experiences avec le contexte reel (equipe, enjeux, resultats) |
| **Contexte** | ✅ | ✅ | Enrichir le CV avec le contexte metier ET l'orienter vers le poste cible |
| **Bio** | ✅ | ✅ | Creer des presentations percutantes adaptees au poste vise |
| **Adaptateur** | ❌ | ✅ | Reorganiser et adapter le CV specifiquement pour la mission cible |

### 4. Agent Nettoyeur de transcription (optionnel)

Un agent qui s'execute AVANT le workflow principal pour :

**Entree** : Transcription brute audio
```
"Euh donc chez Disney euh j'etais tech lead euh on etait 3 developpeurs
euh je m'occupais de la partie profil euh avec les tickets et tout..."
```

**Sortie** : Notes structurees
```
## Disney - Tech Lead
- Equipe de 3 developpeurs
- Responsable de la partie Profil
- Gestion des tickets et authentification
- Stack: React Native
```

**Avantages** :
- Notes plus exploitables par les autres agents
- Meilleure qualite de CV final
- Peut etre execute automatiquement apres chaque transcription audio

---

## Modifications techniques

### 1. lib/agents.ts - Nouveaux placeholders

Modifier `processTemplate()` pour supporter :
- `{{pastMissionNotes}}` et `{{futureMissionNotes}}`
- Blocs conditionnels `{{#pastMissionNotes}}...{{/pastMissionNotes}}`

### 2. lib/queue/workers/agent-worker.ts - Injection automatique

Avant d'appeler un agent :
1. Recuperer le CV avec ses notes (`notes`, `futureMissionNotes`)
2. Passer ces notes a `getAgentPrompts()`
3. Les injecter automatiquement dans le template

### 3. Base de donnees - Mise a jour des prompts

Modifier les `userPromptTemplate` de chaque agent pour utiliser les nouveaux placeholders.

**Exemple pour l'agent Adaptateur :**

```markdown
Voici un CV au format Markdown. Adapte-le pour maximiser les chances du candidat.

## CV actuel:
{{markdown}}

{{#futureMissionNotes}}
## MISSION/POSTE CIBLE:
{{futureMissionNotes}}

IMPORTANT: Adapte le CV pour ce poste specifique. Mets en avant les competences
et experiences pertinentes. Reorganise si necessaire.
{{/futureMissionNotes}}

## Instructions:
- Adapte le titre du profil au poste cible
- Reorganise les competences (pertinentes en premier)
- Adapte les 3 presentations vers cette orientation
- Developpe les experiences en lien avec la mission
- NE SUPPRIME AUCUNE information
- Retourne UNIQUEMENT le Markdown adapte
```

**Exemple pour l'agent Enrichisseur :**

```markdown
Voici un CV au format Markdown. Enrichis et ameliore son contenu.

## CV actuel:
{{markdown}}

{{#pastMissionNotes}}
## CONTEXTE REEL DES MISSIONS (notes du recruteur):
{{pastMissionNotes}}

Utilise ces informations pour enrichir les descriptions d'experience avec
le vrai contexte: taille d'equipe, enjeux business, responsabilites reelles.
{{/pastMissionNotes}}

## Instructions:
- Ameliore les descriptions avec le contexte fourni
- Ajoute des verbes d'action forts
- Valorise les realisations
- NE SUPPRIME AUCUNE information
- Retourne UNIQUEMENT le Markdown ameliore
```

### 4. Frontend - Suppression du dialogue manuel

- Supprimer le dialogue de saisie de contexte pour l'agent Adaptateur
- Les notes sont deja saisies dans le popup Notes du CV
- L'execution des agents utilise automatiquement ces notes

### 5. API - Simplification

- Retirer le parametre `additionalContext` de `/api/cv/improve`
- Retirer le parametre `additionalContext` de `/api/workflow/execute`
- Les workers recuperent les notes directement depuis le CV

---

## Workflow utilisateur final

```
1. Upload CV
      |
      v
2. Extraction automatique (CV structure en Markdown)
      |
      v
3. Ajout de notes (popup Notes)
   - Onglet "Missions passees" : contexte reel des experiences
   - Onglet "Mission a venir" : description du poste cible
   - Upload audio -> transcription -> copier dans notes
      |
      v
4. Lancement du workflow d'amelioration
   - Les notes sont automatiquement injectees
   - Chaque agent utilise les notes pertinentes
      |
      v
5. CV parfait genere
   - Contextualise avec les vraies responsabilites
   - Adapte au poste cible
   - Presentations percutantes et orientees
```

---

## Priorite d'implementation

### Phase 1 - Core
1. Modifier `processTemplate()` pour les nouveaux placeholders
2. Modifier `agent-worker.ts` pour recuperer et injecter les notes
3. Mettre a jour les prompts des 5 agents en base

### Phase 2 - Cleanup
4. Supprimer `additionalContext` des APIs
5. Supprimer le dialogue manuel du frontend
6. Nettoyer le code obsolete

### Phase 3 - Optionnel
7. Creer l'agent "Nettoyeur de transcription"
8. Executer automatiquement apres chaque transcription audio

---

## Resultat attendu

Un CV genere qui :
- **Reflette la realite** : enrichi avec le vrai contexte des missions (taille equipe, enjeux, stack)
- **Cible le poste** : adapte et reorganise pour la mission visee
- **Valorise le candidat** : presentations percutantes orientees vers l'objectif
- **Sans effort manuel** : les notes une fois saisies sont exploitees automatiquement
