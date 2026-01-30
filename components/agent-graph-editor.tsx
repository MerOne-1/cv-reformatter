'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, AlertCircle, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AgentNode } from './agent-node';
import { AgentConnectionLine } from './agent-connection-line';
import type { AgentGraph, AgentGraphNode } from '@/lib/types';

interface AgentGraphEditorProps {
  onSave?: () => void;
}

export function AgentGraphEditor({ onSave }: AgentGraphEditorProps) {
  const [graph, setGraph] = useState<AgentGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<{
    agentId: string;
    type: 'source' | 'target';
  } | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number }>>(
    new Map()
  );

  const fetchGraph = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/agents/graph');
      const data = await response.json();
      if (data.success) {
        setGraph(data.data);
        calculateNodePositions(data.data);
      } else {
        setError(data.error || 'Erreur lors du chargement');
      }
    } catch {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  const calculateNodePositions = (graphData: AgentGraph) => {
    const positions = new Map<string, { x: number; y: number }>();
    const levels = new Map<number, AgentGraphNode[]>();

    for (const node of graphData.nodes) {
      const level = node.level;
      if (!levels.has(level)) {
        levels.set(level, []);
      }
      levels.get(level)!.push(node);
    }

    const levelArray = Array.from(levels.entries()).sort((a, b) => a[0] - b[0]);
    const nodeWidth = 200;
    const nodeHeight = 120;
    const horizontalGap = 80;
    const verticalGap = 60;

    for (let i = 0; i < levelArray.length; i++) {
      const [, nodes] = levelArray[i];
      const x = i * (nodeWidth + horizontalGap) + 50;

      for (let j = 0; j < nodes.length; j++) {
        const y = j * (nodeHeight + verticalGap) + 50;
        positions.set(nodes[j].id, { x, y });
      }
    }

    setNodePositions(positions);
  };

  const handleNodeClick = (nodeId: string) => {
    if (connectingFrom) {
      if (connectingFrom.agentId !== nodeId) {
        createConnection(connectingFrom, nodeId);
      }
      setConnectingFrom(null);
    } else {
      setSelectedNode(nodeId === selectedNode ? null : nodeId);
      setSelectedEdge(null);
    }
  };

  const handleStartConnection = (agentId: string, type: 'source' | 'target') => {
    setConnectingFrom({ agentId, type });
    setSelectedNode(null);
    setSelectedEdge(null);
  };

  const createConnection = async (
    from: { agentId: string; type: 'source' | 'target' },
    targetId: string
  ) => {
    try {
      const sourceAgentId = from.type === 'source' ? from.agentId : targetId;
      const targetAgentId = from.type === 'source' ? targetId : from.agentId;

      const response = await fetch('/api/agents/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceAgentId, targetAgentId }),
      });

      const data = await response.json();
      if (!data.success) {
        setError(data.error || 'Erreur lors de la création de la connexion');
        return;
      }

      await fetchGraph();
      onSave?.();
    } catch {
      setError('Erreur lors de la création de la connexion');
    }
  };

  const deleteConnection = async () => {
    if (!selectedEdge) return;

    try {
      const response = await fetch(`/api/agents/connections/${selectedEdge}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!data.success) {
        setError(data.error || 'Erreur lors de la suppression');
        return;
      }

      setSelectedEdge(null);
      await fetchGraph();
      onSave?.();
    } catch {
      setError('Erreur lors de la suppression');
    }
  };

  const getNodeCenter = (nodeId: string): { x: number; y: number } => {
    const pos = nodePositions.get(nodeId);
    if (!pos) return { x: 0, y: 0 };
    return {
      x: pos.x + 90,
      y: pos.y + 60,
    };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Éditeur de Workflow</CardTitle>
        <div className="flex items-center gap-2">
          {selectedEdge && (
            <Button variant="destructive" size="sm" onClick={deleteConnection}>
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer connexion
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={fetchGraph}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {graph && !graph.isValid && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {graph.validationErrors.join(', ')}
            </AlertDescription>
          </Alert>
        )}

        {connectingFrom && (
          <Alert className="mb-4">
            <Plus className="h-4 w-4" />
            <AlertDescription>
              Cliquez sur un agent pour créer une connexion.{' '}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConnectingFrom(null)}
              >
                Annuler
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div
          ref={containerRef}
          className="relative border rounded-lg bg-muted/20 overflow-auto"
          style={{ height: '500px', minWidth: '100%' }}
        >
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ minWidth: '800px', minHeight: '500px' }}
          >
            {graph?.edges.map((edge) => {
              const sourcePos = getNodeCenter(edge.source);
              const targetPos = getNodeCenter(edge.target);

              return (
                <AgentConnectionLine
                  key={edge.id}
                  sourcePosition={{
                    x: sourcePos.x + 90,
                    y: sourcePos.y,
                  }}
                  targetPosition={{
                    x: targetPos.x - 90,
                    y: targetPos.y,
                  }}
                  isActive={edge.isActive}
                  isHighlighted={selectedEdge === edge.id}
                  onClick={() => {
                    setSelectedEdge(edge.id === selectedEdge ? null : edge.id);
                    setSelectedNode(null);
                  }}
                />
              );
            })}
          </svg>

          <div className="relative" style={{ minWidth: '800px', minHeight: '500px' }}>
            {graph?.nodes.map((node) => {
              const pos = nodePositions.get(node.id);
              if (!pos) return null;

              return (
                <div
                  key={node.id}
                  className="absolute"
                  style={{ left: pos.x, top: pos.y }}
                >
                  <AgentNode
                    id={node.id}
                    name={node.name}
                    displayName={node.displayName}
                    isActive={node.isActive}
                    level={node.level}
                    inputCount={node.inputs.length}
                    outputCount={node.outputs.length}
                    isSelected={selectedNode === node.id}
                    isConnecting={!!connectingFrom}
                    connectionMode={
                      connectingFrom?.agentId === node.id
                        ? connectingFrom.type
                        : connectingFrom
                        ? connectingFrom.type === 'source'
                          ? 'target'
                          : 'source'
                        : null
                    }
                    onClick={() => handleNodeClick(node.id)}
                    onStartConnection={(type) => handleStartConnection(node.id, type)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-muted-foreground/50" />
            <span>Connexion active</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-muted-foreground/30 border-dashed border-t-2" />
            <span>Connexion inactive</span>
          </div>
          <div className="flex-1" />
          <span>
            {graph?.nodes.length || 0} agents · {graph?.edges.length || 0} connexions
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
