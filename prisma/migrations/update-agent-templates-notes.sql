-- Mettre à jour le template de l'enrichisseur
UPDATE "AIAgent" SET "userPromptTemplate" = E'Voici un CV au format Markdown. Enrichis et améliore son contenu tout en conservant exactement la même structure.

{{#pastMissionNotes}}
## 📋 CONTEXTE DES MISSIONS PASSÉES (informations importantes):

{{pastMissionNotes}}

---
{{/pastMissionNotes}}

{{#futureMissionNotes}}
## 🎯 MISSION CIBLÉE (orienter le CV vers ce profil):

{{futureMissionNotes}}

---
{{/futureMissionNotes}}

## CV actuel:

{{markdown}}

## Instructions:
- Améliore les 3 versions de présentation pour les rendre plus vendeuses
- Améliore les descriptions de réalisations avec des verbes d\'action
- Enrichis les contextes de mission
{{#pastMissionNotes}}- UTILISE le contexte des missions passées pour enrichir les descriptions{{/pastMissionNotes}}
{{#futureMissionNotes}}- ORIENTE les améliorations vers la mission ciblée{{/futureMissionNotes}}
- NE MODIFIE PAS la structure, seulement le contenu textuel
- NE SUPPRIME AUCUNE information
- CONSERVE ##INFO MANQUANTE## si présent
- Retourne UNIQUEMENT le Markdown amélioré'
WHERE name = 'enrichisseur';

-- Mettre à jour le template du contextualiseur
UPDATE "AIAgent" SET "userPromptTemplate" = E'Voici un CV au format Markdown à contextualiser et adapter.

{{#pastMissionNotes}}
## 📋 CONTEXTE DES MISSIONS PASSÉES (À INTÉGRER DANS LES DESCRIPTIONS):

{{pastMissionNotes}}

---
Tu DOIS utiliser ces informations pour enrichir le contexte des expériences correspondantes.
{{/pastMissionNotes}}

{{#futureMissionNotes}}
## 🎯 MISSION CIBLÉE (ORIENTER LE CV VERS CE PROFIL):

{{futureMissionNotes}}

---
Tu DOIS adapter le CV pour correspondre à ce profil recherché.
{{/futureMissionNotes}}

## CV actuel:

{{markdown}}

## Instructions:
{{#pastMissionNotes}}
1. INTÈGRE le contexte des missions passées dans les descriptions d\'expériences
2. Enrichis les sections "Contexte" avec les informations fournies
{{/pastMissionNotes}}
{{#futureMissionNotes}}
3. ADAPTE le titre du profil vers la mission ciblée
4. RÉORIENTE les 3 présentations vers le profil recherché
5. METS EN AVANT les compétences pertinentes pour la mission ciblée
{{/futureMissionNotes}}
6. Explique les enjeux business des projets
7. Ajoute des ordres de grandeur quand pertinent
8. CONSERVE la structure exacte du document
9. CONSERVE les marqueurs d\'informations manquantes

Retourne UNIQUEMENT le Markdown adapté et enrichi.'
WHERE name = 'contexte';

-- Mettre à jour le template du bio writer
UPDATE "AIAgent" SET "userPromptTemplate" = E'Voici un CV au format Markdown. Améliore les 3 versions de présentation.

{{#futureMissionNotes}}
## 🎯 MISSION CIBLÉE (ADAPTER LES PRÉSENTATIONS):

{{futureMissionNotes}}

---
Les 3 présentations doivent être orientées vers ce profil recherché.
{{/futureMissionNotes}}

## CV actuel:

{{markdown}}

## Instructions:
- Améliore les 3 versions de présentation (Technique, Business, Leadership)
- Chaque version doit être percutante (3-4 lignes max)
{{#futureMissionNotes}}- ORIENTE les présentations vers la mission ciblée{{/futureMissionNotes}}
- Base-toi UNIQUEMENT sur les informations du CV
- NE MODIFIE QUE la section "Présentation"
- CONSERVE tout le reste du CV intact
- CONSERVE ##INFO MANQUANTE## si présent
- Retourne UNIQUEMENT le Markdown complet'
WHERE name = 'bio';

-- Mettre à jour le template de l'adaptateur
UPDATE "AIAgent" SET "userPromptTemplate" = E'Voici un CV au format Markdown. Adapte-le pour la mission/poste ciblé.

{{#futureMissionNotes}}
## 🎯 MISSION/POSTE CIBLÉ:

{{futureMissionNotes}}

---
{{/futureMissionNotes}}

## CV actuel:

{{markdown}}

## Instructions:
{{#futureMissionNotes}}
- ADAPTE le CV spécifiquement pour la mission/poste décrit ci-dessus
- Adapte le titre du profil si pertinent pour ce poste
- Réorganise les compétences pour mettre en avant celles pertinentes pour ce poste
- Adapte les 3 présentations vers cette orientation
- Développe les expériences en lien avec la mission
{{/futureMissionNotes}}
{{^futureMissionNotes}}
- Optimise le CV de manière générale
- Mets en avant les compétences clés du profil
{{/futureMissionNotes}}
- NE SUPPRIME AUCUNE information, réorganise seulement
- CONSERVE la structure exacte du document
- CONSERVE ##INFO MANQUANTE## si présent
- Retourne UNIQUEMENT le Markdown adapté'
WHERE name = 'adaptateur';
