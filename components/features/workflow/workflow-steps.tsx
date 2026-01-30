'use client';

import { CVStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Upload,
  FileSearch,
  Edit3,
  Sparkles,
  FileOutput,
  CheckCircle,
} from 'lucide-react';

interface WorkflowStepsProps {
  currentStatus: CVStatus;
}

const steps = [
  { status: 'PENDING', label: 'Upload', icon: Upload },
  { status: 'EXTRACTED', label: 'Extraction', icon: FileSearch },
  { status: 'EDITING', label: 'Édition', icon: Edit3 },
  { status: 'IMPROVED', label: 'IA', icon: Sparkles },
  { status: 'GENERATED', label: 'Export', icon: FileOutput },
  { status: 'COMPLETED', label: 'Fini', icon: CheckCircle },
] as const;

const statusOrder: Record<CVStatus, number> = {
  PENDING: 0,
  EXTRACTED: 1,
  EDITING: 2,
  IMPROVED: 3,
  GENERATED: 4,
  COMPLETED: 5,
};

export function WorkflowSteps({ currentStatus }: WorkflowStepsProps) {
  const currentIndex = statusOrder[currentStatus];

  return (
    <div className="flex items-center gap-1 p-1 bg-secondary/50 rounded-xl">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div
            key={step.status}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-300',
              isCompleted && 'text-emerald-600',
              isCurrent && 'bg-white shadow-sm text-foreground',
              !isCompleted && !isCurrent && 'text-muted-foreground'
            )}
          >
            <Icon className={cn(
              'w-3.5 h-3.5 transition-colors',
              isCompleted && 'text-emerald-500',
              isCurrent && 'text-[hsl(var(--dreamit))]'
            )} />
            <span className="hidden sm:inline">{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}
