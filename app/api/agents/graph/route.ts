import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import type { AgentGraph, AgentGraphNode } from '@/lib/types';

export async function GET() {
  try {
    const [agents, connections] = await Promise.all([
      prisma.aIAgent.findMany({
        orderBy: { order: 'asc' },
        select: {
          id: true,
          name: true,
          displayName: true,
          isActive: true,
          order: true,
        },
      }),
      prisma.agentConnection.findMany({
        where: { isActive: true },
        select: {
          id: true,
          sourceAgentId: true,
          targetAgentId: true,
          isActive: true,
        },
      }),
    ]);

    const incomingEdges = new Map<string, string[]>();
    const outgoingEdges = new Map<string, string[]>();

    for (const agent of agents) {
      incomingEdges.set(agent.id, []);
      outgoingEdges.set(agent.id, []);
    }

    for (const conn of connections) {
      const incoming = incomingEdges.get(conn.targetAgentId) || [];
      incoming.push(conn.sourceAgentId);
      incomingEdges.set(conn.targetAgentId, incoming);

      const outgoing = outgoingEdges.get(conn.sourceAgentId) || [];
      outgoing.push(conn.targetAgentId);
      outgoingEdges.set(conn.sourceAgentId, outgoing);
    }

    const levels = computeLevels(agents.map(a => a.id), incomingEdges);
    const validationErrors = validateGraph(agents.map(a => a.id), incomingEdges, outgoingEdges);

    const nodes: AgentGraphNode[] = agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      displayName: agent.displayName,
      isActive: agent.isActive,
      order: agent.order,
      level: levels.get(agent.id) || 0,
      inputs: incomingEdges.get(agent.id) || [],
      outputs: outgoingEdges.get(agent.id) || [],
    }));

    const edges = connections.map(conn => ({
      id: conn.id,
      source: conn.sourceAgentId,
      target: conn.targetAgentId,
      isActive: conn.isActive,
    }));

    const graph: AgentGraph = {
      nodes,
      edges,
      isValid: validationErrors.length === 0,
      validationErrors,
    };

    return NextResponse.json({
      success: true,
      data: graph,
    });
  } catch (error) {
    console.error('Error fetching agent graph:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch agent graph' },
      { status: 500 }
    );
  }
}

function computeLevels(
  agentIds: string[],
  incomingEdges: Map<string, string[]>
): Map<string, number> {
  const levels = new Map<string, number>();
  const visited = new Set<string>();

  function computeLevel(agentId: string): number {
    if (levels.has(agentId)) {
      return levels.get(agentId)!;
    }

    if (visited.has(agentId)) {
      return 0;
    }
    visited.add(agentId);

    const incoming = incomingEdges.get(agentId) || [];
    if (incoming.length === 0) {
      levels.set(agentId, 0);
      return 0;
    }

    const maxParentLevel = Math.max(...incoming.map(computeLevel));
    const level = maxParentLevel + 1;
    levels.set(agentId, level);
    return level;
  }

  for (const agentId of agentIds) {
    computeLevel(agentId);
  }

  return levels;
}

function validateGraph(
  agentIds: string[],
  incomingEdges: Map<string, string[]>,
  outgoingEdges: Map<string, string[]>
): string[] {
  const errors: string[] = [];

  const hasCycle = detectCycleInGraph(agentIds, outgoingEdges);
  if (hasCycle) {
    errors.push('Le graphe contient un cycle');
  }

  const rootNodes = agentIds.filter(id => (incomingEdges.get(id) || []).length === 0);
  if (rootNodes.length === 0 && agentIds.length > 0 && !hasCycle) {
    errors.push('Aucun agent racine trouvé (tous les agents ont des entrées)');
  }

  const leafNodes = agentIds.filter(id => (outgoingEdges.get(id) || []).length === 0);
  if (leafNodes.length === 0 && agentIds.length > 0 && !hasCycle) {
    errors.push('Aucun agent terminal trouvé (tous les agents ont des sorties)');
  }

  return errors;
}

function detectCycleInGraph(
  agentIds: string[],
  outgoingEdges: Map<string, string[]>
): boolean {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;

  const colors = new Map<string, number>();
  for (const id of agentIds) {
    colors.set(id, WHITE);
  }

  function dfs(node: string): boolean {
    colors.set(node, GRAY);

    const neighbors = outgoingEdges.get(node) || [];
    for (const neighbor of neighbors) {
      const color = colors.get(neighbor);
      if (color === GRAY) {
        return true;
      }
      if (color === WHITE && dfs(neighbor)) {
        return true;
      }
    }

    colors.set(node, BLACK);
    return false;
  }

  for (const id of agentIds) {
    if (colors.get(id) === WHITE) {
      if (dfs(id)) {
        return true;
      }
    }
  }

  return false;
}
