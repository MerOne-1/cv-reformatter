'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';

interface MissingInfoAlertProps {
  missingFields: string[];
}

export function MissingInfoAlert({ missingFields }: MissingInfoAlertProps) {
  const [dismissed, setDismissed] = useState(false);

  if (missingFields.length === 0 || dismissed) {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 animate-slide-up">
      {/* Decorative element */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-amber-100 rounded-full -translate-y-12 translate-x-12 opacity-50" />

      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 p-1 rounded-lg hover:bg-amber-100 transition-colors"
      >
        <X className="w-4 h-4 text-amber-600" />
      </button>

      <div className="relative flex gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <h4 className="font-medium text-amber-900 text-sm">
            {missingFields.length} information{missingFields.length > 1 ? 's' : ''} manquante{missingFields.length > 1 ? 's' : ''}
          </h4>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {missingFields.map((field, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-0.5 rounded-md bg-white border border-amber-200 text-xs text-amber-800"
              >
                {field}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-amber-700/70">
            Recherchez <code className="px-1 py-0.5 bg-amber-100 rounded text-amber-800 font-mono">##INFO MANQUANTE##</code> dans l&apos;éditeur
          </p>
        </div>
      </div>
    </div>
  );
}
