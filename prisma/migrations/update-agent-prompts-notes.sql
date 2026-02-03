-- Migration: Mise à jour des prompts des agents pour utiliser les nouveaux placeholders de notes
-- Date: 2024
-- Description: Remplace {{context}} par les nouveaux placeholders {{pastMissionNotes}} et {{futureMissionNotes}}

-- Agent ENRICHISSEUR: Utilise pastMissionNotes pour enrichir avec le contexte réel des missions
UPDATE "AIAgent"
SET "userPromptTemplate" = 'Voici un CV au format Markdown. Enrichis et améliore son contenu tout en conservant exactement la même structure.

## CV actuel:

{{markdown}}

{{#pastMissionNotes}}
## CONTEXTE RÉEL DES MISSIONS (notes du recruteur):
{{pastMissionNotes}}

Utilise ces informations pour enrichir les descriptions d''expérience avec le vrai contexte: taille d''équipe, enjeux business, responsabilités réelles.
{{/pastMissionNotes}}

## Instructions:
- Améliore les 3 versions de présentation pour les rendre plus vendeuses
- Améliore les descriptions de réalisations avec des verbes d''action
- Enrichis les contextes de mission avec les notes fournies si disponibles
- NE MODIFIE PAS la structure, seulement le contenu textuel
- NE SUPPRIME AUCUNE information
- CONSERVE ##INFO MANQUANTE## si présent
- Retourne UNIQUEMENT le Markdown amélioré'
WHERE "name" = 'enrichisseur';

-- Agent ADAPTATEUR: Utilise futureMissionNotes pour adapter au poste cible
UPDATE "AIAgent"
SET "userPromptTemplate" = 'Voici un CV au format Markdown. Adapte-le pour maximiser les chances du candidat.

## CV actuel:

{{markdown}}

{{#futureMissionNotes}}
## MISSION/POSTE CIBLE:
{{futureMissionNotes}}

IMPORTANT: Adapte le CV pour ce poste spécifique. Mets en avant les compétences et expériences pertinentes. Réorganise si nécessaire.
{{/futureMissionNotes}}

## Instructions:
- Adapte le titre du profil au poste cible si fourni
- Réorganise les compétences (pertinentes en premier)
- Adapte les 3 présentations vers cette orientation
- Développe les expériences en lien avec la mission
- NE SUPPRIME AUCUNE information, réorganise seulement
- CONSERVE la structure exacte du document
- CONSERVE ##INFO MANQUANTE## si présent
- Retourne UNIQUEMENT le Markdown adapté'
WHERE "name" = 'adaptateur';

-- Agent CONTEXTE: Utilise les deux types de notes
UPDATE "AIAgent"
SET "userPromptTemplate" = 'Voici un CV au format Markdown. Ajoute du contexte métier aux expériences tout en conservant la structure.

## CV actuel:

{{markdown}}

{{#pastMissionNotes}}
## CONTEXTE RÉEL DES MISSIONS (notes du recruteur):
{{pastMissionNotes}}

Utilise ces informations pour enrichir les contextes avec les vrais détails: taille équipe, enjeux, responsabilités.
{{/pastMissionNotes}}

{{#futureMissionNotes}}
## MISSION/POSTE CIBLE:
{{futureMissionNotes}}

Oriente le contexte vers ce type de mission/poste.
{{/futureMissionNotes}}

## Instructions:
- Enrichis chaque section "Contexte" des expériences avec du contexte métier
- Utilise les notes fournies pour ajouter des détails réels
- Explique les enjeux business des projets
- Ajoute des ordres de grandeur quand pertinent (sans inventer de chiffres précis)
- CONSERVE la structure exacte du document
- CONSERVE ##INFO MANQUANTE## si présent
- Retourne UNIQUEMENT le Markdown enrichi'
WHERE "name" = 'contexte';

-- Agent BIO: Utilise les deux types de notes pour créer des présentations percutantes
UPDATE "AIAgent"
SET "userPromptTemplate" = 'Voici un CV au format Markdown. Améliore les 3 versions de présentation.

## CV actuel:

{{markdown}}

{{#pastMissionNotes}}
## CONTEXTE RÉEL DU CANDIDAT (notes du recruteur):
{{pastMissionNotes}}

Utilise ces informations pour rendre les présentations plus authentiques et percutantes.
{{/pastMissionNotes}}

{{#futureMissionNotes}}
## ORIENTATION SOUHAITÉE (poste cible):
{{futureMissionNotes}}

Oriente les présentations vers ce type de mission/poste.
{{/futureMissionNotes}}

## Instructions:
- Améliore les 3 versions de présentation (Technique, Business, Leadership)
- Chaque version doit être percutante (3-4 lignes max)
- Base-toi sur les informations du CV et les notes fournies
- NE MODIFIE QUE la section "Présentation"
- CONSERVE tout le reste du CV intact
- CONSERVE ##INFO MANQUANTE## si présent
- Retourne UNIQUEMENT le Markdown complet'
WHERE "name" = 'bio';

-- Agent EXTRACTION: Utilise pastMissionNotes pour mieux comprendre le contexte lors de l'extraction
UPDATE "AIAgent"
SET "userPromptTemplate" = 'Voici le contenu brut extrait d''un CV de consultant IT.
Transforme-le en Markdown structuré selon le format demandé.

## Contenu brut du CV:

{{markdown}}

{{#pastMissionNotes}}
## CONTEXTE ADDITIONNEL (notes du recruteur):
{{pastMissionNotes}}

Utilise ces informations pour mieux comprendre et structurer les expériences.
{{/pastMissionNotes}}

## Instructions:
1. Extrais et structure TOUTES les informations présentes
2. Respecte EXACTEMENT la structure Markdown demandée
3. Génère les 3 versions de présentation (Technique, Business, Leadership)
4. Si des informations manquent, liste-les avec ##INFO MANQUANTE## en haut
5. Pour chaque expérience, inclus OBLIGATOIREMENT: Contexte, Réalisations, Stack technique
6. Génère UNIQUEMENT le Markdown, sans commentaires ni explications'
WHERE "name" = 'extraction';
