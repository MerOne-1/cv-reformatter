-- Migration: Ajouter la table AgentExecutionLog pour les logs détaillés des agents
-- Description: Permet de suivre tous les inputs/outputs des agents pour améliorer les prompts

-- Créer la table AgentExecutionLog
CREATE TABLE "AgentExecutionLog" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "cvId" TEXT NOT NULL,
    "executionId" TEXT,
    "stepId" TEXT,
    "systemPrompt" TEXT NOT NULL,
    "userPrompt" TEXT NOT NULL,
    "inputMarkdown" TEXT NOT NULL,
    "pastMissionNotes" TEXT,
    "futureMissionNotes" TEXT,
    "outputMarkdown" TEXT,
    "durationMs" INTEGER,
    "tokensInput" INTEGER,
    "tokensOutput" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentExecutionLog_pkey" PRIMARY KEY ("id")
);

-- Créer les index pour les requêtes fréquentes
CREATE INDEX "AgentExecutionLog_agentId_idx" ON "AgentExecutionLog"("agentId");
CREATE INDEX "AgentExecutionLog_cvId_idx" ON "AgentExecutionLog"("cvId");
CREATE INDEX "AgentExecutionLog_executionId_idx" ON "AgentExecutionLog"("executionId");
CREATE INDEX "AgentExecutionLog_createdAt_idx" ON "AgentExecutionLog"("createdAt");

-- Ajouter les foreign keys
ALTER TABLE "AgentExecutionLog" ADD CONSTRAINT "AgentExecutionLog_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "AIAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentExecutionLog" ADD CONSTRAINT "AgentExecutionLog_cvId_fkey"
    FOREIGN KEY ("cvId") REFERENCES "CV"("id") ON DELETE CASCADE ON UPDATE CASCADE;
