'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
  BackgroundVariant,
  Panel,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw,
  Trash2,
  AlertCircle,
  Info,
  Bot,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import type { AgentGraph } from '@/lib/types';

interface WorkflowEditorProps {
  onSave?: () => void;
}

const nodeColors: Record<string, string> = {
  extraction: '#f59e0b',
  enrichisseur: '#3b82f6',
  contexte: '#8b5cf6',
  bio: '#ec4899',
  adaptateur: '#10b981',
};

function AgentNodeComponent({ data }: { data: any }) {
  const color = nodeColors[data.name] || '#6b7280';

  return (
    <div
      className={`relative px-4 py-3 rounded-xl border-2 bg-card shadow-lg min-w-[180px] transition-all ${
        data.isActive ? 'opacity-100' : 'opacity-50'
      }`}
      style={{ borderColor: color }}
    >
      {/* Point de connexion ENTRÉE (gauche) - rond bleu */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-blue-500 !border-2 !border-white !rounded-full"
        style={{ left: -8 }}
      />

      {/* Point de connexion SORTIE (droite) - rond vert */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-green-500 !border-2 !border-white !rounded-full"
        style={{ right: -8 }}
      />

      <div className="flex items-center gap-2 mb-2">
        <div
          className="p-1.5 rounded-lg"
          style={{ backgroundColor: `${color}20` }}
        >
          <Bot className="h-4 w-4" style={{ color }} />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm">{data.displayName}</div>
          <div className="text-[10px] text-muted-foreground font-mono">
            {data.name}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px]">
        <Badge
          variant={data.isActive ? 'default' : 'secondary'}
          className="text-[10px] h-5"
        >
          {data.isActive ? 'Actif' : 'Inactif'}
        </Badge>
        <div className="flex items-center gap-1 text-muted-foreground">
          <span className="text-blue-500 font-medium">{data.inputs?.length || 0}←</span>
          <span className="text-green-500 font-medium">→{data.outputs?.length || 0}</span>
        </div>
      </div>
    </div>
  );
}

const nodeTypes = {
  agent: AgentNodeComponent,
};

export function WorkflowEditor({ onSave }: WorkflowEditorProps) {
  const [graph, setGraph] = useState<AgentGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const fetchGraph = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/agents/graph');
      const data = await response.json();
      if (data.success) {
        setGraph(data.data);
        transformGraphToFlow(data.data);
      } else {
        setError(data.error || 'Erreur lors du chargement');
      }
    } catch {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }, []);

  const transformGraphToFlow = useCallback((graphData: AgentGraph) => {
    const levels = new Map<number, typeof graphData.nodes>();

    for (const node of graphData.nodes) {
      if (!levels.has(node.level)) {
        levels.set(node.level, []);
      }
      levels.get(node.level)!.push(node);
    }

    const flowNodes: Node[] = [];
    const xGap = 280;
    const yGap = 150;

    levels.forEach((nodesAtLevel, level) => {
      const totalHeight = (nodesAtLevel.length - 1) * yGap;
      const startY = -totalHeight / 2;

      nodesAtLevel.forEach((node, idx) => {
        flowNodes.push({
          id: node.id,
          type: 'agent',
          position: {
            x: level * xGap,
            y: startY + idx * yGap,
          },
          data: {
            ...node,
          },
        });
      });
    });

    const flowEdges: Edge[] = graphData.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: edge.isActive,
      style: {
        stroke: edge.isActive ? '#3b82f6' : '#9ca3af',
        strokeWidth: 2,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edge.isActive ? '#3b82f6' : '#9ca3af',
      },
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [setNodes, setEdges]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      try {
        setSaving(true);
        const response = await fetch('/api/agents/connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceAgentId: connection.source,
            targetAgentId: connection.target,
          }),
        });

        const data = await response.json();
        if (!data.success) {
          setError(data.error || 'Erreur lors de la création');
          return;
        }

        await fetchGraph();
        onSave?.();
      } catch {
        setError('Erreur lors de la création');
      } finally {
        setSaving(false);
      }
    },
    [fetchGraph, onSave]
  );

  const onEdgeClick = useCallback(
    async (_: React.MouseEvent, edge: Edge) => {
      if (!confirm('Supprimer cette connexion ?')) return;

      try {
        setSaving(true);
        const response = await fetch(`/api/agents/connections/${edge.id}`, {
          method: 'DELETE',
        });

        const data = await response.json();
        if (!data.success) {
          setError(data.error || 'Erreur lors de la suppression');
          return;
        }

        await fetchGraph();
        onSave?.();
      } catch {
        setError('Erreur lors de la suppression');
      } finally {
        setSaving(false);
      }
    },
    [fetchGraph, onSave]
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-[600px]">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between py-3 border-b">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg">Workflow des Agents</CardTitle>
          {graph?.isValid ? (
            <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Valide
            </Badge>
          ) : (
            <Badge variant="destructive">
              <AlertCircle className="h-3 w-3 mr-1" />
              Invalide
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {graph?.nodes.length || 0} agents
          </Badge>
          <Badge variant="secondary">
            {graph?.edges.length || 0} connexions
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchGraph}
            disabled={loading || saving}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${saving ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {error && (
          <Alert variant="destructive" className="m-4 mb-0">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div style={{ height: '600px' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeClick={onEdgeClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            defaultEdgeOptions={{
              type: 'smoothstep',
              animated: true,
            }}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <Controls />
            <MiniMap
              nodeColor={(node) => nodeColors[(node.data as any)?.name] || '#6b7280'}
              maskColor="rgba(0, 0, 0, 0.1)"
            />

            <Panel position="bottom-left" className="bg-card/90 backdrop-blur p-3 rounded-lg border shadow-lg m-4">
              <div className="text-sm font-medium mb-2 flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-500" />
                Comment utiliser
              </div>
              <ul className="text-xs text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Créer connexion:</strong> Glissez depuis le <span className="text-green-500 font-bold">rond vert</span> (sortie) vers le <span className="text-blue-500 font-bold">rond bleu</span> (entrée) d'un autre agent</span>
                </li>
                <li className="flex items-start gap-2">
                  <Trash2 className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Supprimer:</strong> Cliquez sur une ligne de connexion</span>
                </li>
                <li className="flex items-start gap-2">
                  <Bot className="h-3 w-3 text-gray-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Déplacer:</strong> Glissez les agents pour réorganiser</span>
                </li>
              </ul>
            </Panel>

            <Panel position="top-left" className="bg-card/90 backdrop-blur p-3 rounded-lg border shadow-lg m-4">
              <div className="text-sm font-medium mb-2">Légende</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(nodeColors).map(([name, color]) => (
                  <div key={name} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: color }}
                    />
                    <span className="capitalize">{name}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </ReactFlow>
        </div>
      </CardContent>
    </Card>
  );
}
