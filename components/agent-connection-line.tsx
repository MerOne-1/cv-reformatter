'use client';

import { cn } from '@/lib/utils';

interface Position {
  x: number;
  y: number;
}

interface AgentConnectionLineProps {
  sourcePosition: Position;
  targetPosition: Position;
  isActive?: boolean;
  isHighlighted?: boolean;
  onClick?: () => void;
}

export function AgentConnectionLine({
  sourcePosition,
  targetPosition,
  isActive = true,
  isHighlighted = false,
  onClick,
}: AgentConnectionLineProps) {
  const dx = targetPosition.x - sourcePosition.x;
  const dy = targetPosition.y - sourcePosition.y;

  const controlPoint1X = sourcePosition.x + dx * 0.5;
  const controlPoint1Y = sourcePosition.y;
  const controlPoint2X = sourcePosition.x + dx * 0.5;
  const controlPoint2Y = targetPosition.y;

  const pathD = `
    M ${sourcePosition.x} ${sourcePosition.y}
    C ${controlPoint1X} ${controlPoint1Y},
      ${controlPoint2X} ${controlPoint2Y},
      ${targetPosition.x} ${targetPosition.y}
  `;

  const arrowSize = 8;
  const angle = Math.atan2(
    targetPosition.y - controlPoint2Y,
    targetPosition.x - controlPoint2X
  );
  const arrowPoint1X = targetPosition.x - arrowSize * Math.cos(angle - Math.PI / 6);
  const arrowPoint1Y = targetPosition.y - arrowSize * Math.sin(angle - Math.PI / 6);
  const arrowPoint2X = targetPosition.x - arrowSize * Math.cos(angle + Math.PI / 6);
  const arrowPoint2Y = targetPosition.y - arrowSize * Math.sin(angle + Math.PI / 6);

  const arrowD = `
    M ${targetPosition.x} ${targetPosition.y}
    L ${arrowPoint1X} ${arrowPoint1Y}
    L ${arrowPoint2X} ${arrowPoint2Y}
    Z
  `;

  return (
    <g
      className={cn(
        'cursor-pointer transition-all',
        !isActive && 'opacity-40'
      )}
      onClick={onClick}
    >
      <path
        d={pathD}
        fill="none"
        className={cn(
          'transition-all',
          isHighlighted
            ? 'stroke-primary stroke-[3]'
            : isActive
            ? 'stroke-muted-foreground/50 stroke-2'
            : 'stroke-muted-foreground/30 stroke-2 stroke-dasharray-4'
        )}
        strokeDasharray={!isActive ? '4 4' : undefined}
      />

      <path
        d={arrowD}
        className={cn(
          'transition-all',
          isHighlighted
            ? 'fill-primary'
            : isActive
            ? 'fill-muted-foreground/50'
            : 'fill-muted-foreground/30'
        )}
      />

      <path
        d={pathD}
        fill="none"
        stroke="transparent"
        strokeWidth="20"
        className="cursor-pointer"
      />
    </g>
  );
}
