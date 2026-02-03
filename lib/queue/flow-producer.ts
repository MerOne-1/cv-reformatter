import { FlowProducer, FlowChildJob, FlowJob } from 'bullmq';
import { getRedisConnection } from './connection';
import { QUEUE_NAMES } from './queues';
import prisma from '@/lib/db';
import type { AgentJobData } from '@/lib/types';

let flowProducer: FlowProducer | null = null;

export function getFlowProducer(): FlowProducer {
  if (!flowProducer) {
    flowProducer = new FlowProducer({
      connection: getRedisConnection(),
    });
  }
  return flowProducer;
}

export async function closeFlowProducer(): Promise<void> {
  if (flowProducer) {
    await flowProducer.close();
    flowProducer = null;
  }
}

interface AgentNode {
  id: string;
  name: string;
  inputs: string[];
  outputs: string[];
}

export async function createAgentWorkflow(
  executionId: string,
  cvId: string,
  markdownContent: string,
  pastMissionNotes?: string,
  futureMissionNotes?: string
): Promise<void> {
  const [allAgents, allConnections] = await Promise.all([
    prisma.aIAgent.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    }),
    prisma.agentConnection.findMany({
      where: { isActive: true },
      select: { sourceAgentId: true, targetAgentId: true },
    }),
  ]);

  // Exclure l'agent "extraction" du workflow d'amélioration
  // L'extraction est une opération séparée (fichier → markdown)
  const extractionAgent = allAgents.find(a => a.name === 'extraction');
  const agents = allAgents.filter(a => a.name !== 'extraction');

  // Filtrer les connexions pour exclure celles impliquant l'extraction
  const connections = allConnections.filter(c =>
    c.sourceAgentId !== extractionAgent?.id &&
    c.targetAgentId !== extractionAgent?.id
  );

  if (agents.length === 0) {
    throw new Error('Aucun agent actif trouvé');
  }

  const incomingEdges = new Map<string, string[]>();
  const outgoingEdges = new Map<string, string[]>();

  for (const agent of agents) {
    incomingEdges.set(agent.id, []);
    outgoingEdges.set(agent.id, []);
  }

  for (const conn of connections) {
    const incoming = incomingEdges.get(conn.targetAgentId);
    if (incoming) {
      incoming.push(conn.sourceAgentId);
    }

    const outgoing = outgoingEdges.get(conn.sourceAgentId);
    if (outgoing) {
      outgoing.push(conn.targetAgentId);
    }
  }

  const agentNodes: AgentNode[] = agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    inputs: incomingEdges.get(agent.id) || [],
    outputs: outgoingEdges.get(agent.id) || [],
  }));

  const rootAgents = agentNodes.filter((a) => a.inputs.length === 0);
  const leafAgents = agentNodes.filter((a) => a.outputs.length === 0);

  if (rootAgents.length === 0) {
    throw new Error('Aucun agent racine trouvé (tous les agents ont des entrées)');
  }

  const steps = await prisma.workflowStep.createMany({
    data: agents.map((agent) => ({
      executionId,
      agentId: agent.id,
      status: 'PENDING',
    })),
  });

  const stepMap = new Map<string, string>();
  const createdSteps = await prisma.workflowStep.findMany({
    where: { executionId },
    select: { id: true, agentId: true },
  });
  for (const step of createdSteps) {
    stepMap.set(step.agentId, step.id);
  }

  const flow = getFlowProducer();

  if (connections.length === 0) {
    for (const agent of rootAgents) {
      const stepId = stepMap.get(agent.id)!;
      const jobData: AgentJobData = {
        executionId,
        stepId,
        agentId: agent.id,
        cvId,
        inputData: {},
        markdownContent,
        pastMissionNotes,
        futureMissionNotes,
      };

      await flow.add({
        name: `agent-${agent.name}`,
        queueName: QUEUE_NAMES.AGENT_EXECUTION,
        data: jobData,
        opts: {
          jobId: `exec-${executionId}-agent-${agent.id}`,
          failParentOnFailure: true,
        },
      });
    }
    return;
  }

  const flowJobs = buildFlowTree(
    agentNodes,
    leafAgents,
    executionId,
    cvId,
    markdownContent,
    stepMap,
    pastMissionNotes,
    futureMissionNotes
  );

  for (const job of flowJobs) {
    await flow.add(job);
  }
}

function buildFlowTree(
  agents: AgentNode[],
  leafAgents: AgentNode[],
  executionId: string,
  cvId: string,
  markdownContent: string,
  stepMap: Map<string, string>,
  pastMissionNotes?: string,
  futureMissionNotes?: string
): FlowJob[] {
  const agentMap = new Map<string, AgentNode>();
  for (const agent of agents) {
    agentMap.set(agent.id, agent);
  }

  const visited = new Set<string>();

  function buildJobTree(agent: AgentNode): FlowJob {
    visited.add(agent.id);

    const stepId = stepMap.get(agent.id)!;
    const jobData: AgentJobData = {
      executionId,
      stepId,
      agentId: agent.id,
      cvId,
      inputData: {},
      markdownContent,
      pastMissionNotes,
      futureMissionNotes,
    };

    const children: FlowChildJob[] = [];

    for (const inputId of agent.inputs) {
      if (!visited.has(inputId)) {
        const inputAgent = agentMap.get(inputId);
        if (inputAgent) {
          children.push(buildJobTree(inputAgent) as FlowChildJob);
        }
      }
    }

    const job: FlowJob = {
      name: `agent-${agent.name}`,
      queueName: QUEUE_NAMES.AGENT_EXECUTION,
      data: jobData,
      opts: {
        jobId: `exec-${executionId}-agent-${agent.id}`,
        failParentOnFailure: true,
      },
    };

    if (children.length > 0) {
      job.children = children;
    }

    return job;
  }

  const flowJobs: FlowJob[] = [];
  for (const leaf of leafAgents) {
    if (!visited.has(leaf.id)) {
      flowJobs.push(buildJobTree(leaf));
    }
  }

  const unvisitedRoots = agents.filter(
    (a) => a.inputs.length === 0 && !visited.has(a.id)
  );
  for (const root of unvisitedRoots) {
    const stepId = stepMap.get(root.id)!;
    const jobData: AgentJobData = {
      executionId,
      stepId,
      agentId: root.id,
      cvId,
      inputData: {},
      markdownContent,
      pastMissionNotes,
      futureMissionNotes,
    };

    flowJobs.push({
      name: `agent-${root.name}`,
      queueName: QUEUE_NAMES.AGENT_EXECUTION,
      data: jobData,
      opts: {
        jobId: `exec-${executionId}-agent-${root.id}`,
        failParentOnFailure: true,
      },
    });
  }

  return flowJobs;
}
