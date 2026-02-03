import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cvKeys } from '@/lib/queries';
import { useCVStore } from '@/lib/stores';
import { CVWithImprovementsAndAudio } from '@/lib/types';

/**
 * Downloads a blob response as a file
 */
function downloadBlobAsFile(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

/**
 * Extracts filename from Content-Disposition header
 */
function getFilenameFromResponse(response: Response, fallback: string): string {
  const disposition = response.headers.get('content-disposition');
  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match) return match[1];
  }
  return fallback;
}

export function useCVActions() {
  const queryClient = useQueryClient();
  const { selectedCV, markdown, templateName, updateSelectedCV } = useCVStore();

  const [extracting, setExtracting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);

  const refreshCV = useCallback(async (cvId: string) => {
    const response = await fetch(`/api/cv/${cvId}`);
    const data = await response.json();
    if (data.success) {
      updateSelectedCV(data.data);
      queryClient.invalidateQueries({ queryKey: cvKeys.lists() });
    }
  }, [queryClient, updateSelectedCV]);

  const extract = useCallback(async () => {
    if (!selectedCV) return;

    try {
      setExtracting(true);
      const response = await fetch('/api/cv/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvId: selectedCV.id }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to extract CV');
      }

      updateSelectedCV(data.data);
      queryClient.invalidateQueries({ queryKey: cvKeys.lists() });

      return data.data as CVWithImprovementsAndAudio;
    } finally {
      setExtracting(false);
    }
  }, [selectedCV, queryClient, updateSelectedCV]);

  const generate = useCallback(async () => {
    if (!selectedCV) return;

    try {
      setGenerating(true);

      // Save current content first
      await fetch(`/api/cv/${selectedCV.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdownContent: markdown, templateName }),
      });

      // Generate DOCX
      const response = await fetch('/api/cv/generate-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvId: selectedCV.id, templateName }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate DOCX');
      }

      const blob = await response.blob();
      const filename = getFilenameFromResponse(response, 'cv.docx');
      downloadBlobAsFile(blob, filename);
    } finally {
      setGenerating(false);
    }
  }, [selectedCV, markdown, templateName]);

  const uploadFinal = useCallback(async () => {
    if (!selectedCV) return;

    try {
      setUploading(true);

      // Save current content first
      await fetch(`/api/cv/${selectedCV.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdownContent: markdown, templateName }),
      });

      // Upload final CV
      const response = await fetch('/api/cv/upload-final', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvId: selectedCV.id, templateName }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to upload final CV');
      }

      queryClient.invalidateQueries({ queryKey: cvKeys.lists() });
    } finally {
      setUploading(false);
    }
  }, [selectedCV, markdown, templateName, queryClient]);

  const saveNotes = useCallback(async (notes: string | null, futureMissionNotes: string | null) => {
    if (!selectedCV) return;

    const response = await fetch(`/api/cv/${selectedCV.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, futureMissionNotes }),
    });

    if (!response.ok) {
      throw new Error('Failed to save notes');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to save notes');
    }

    updateSelectedCV({ notes, futureMissionNotes });
  }, [selectedCV, updateSelectedCV]);

  const refreshAudioNotes = useCallback(async () => {
    if (!selectedCV) return;
    await refreshCV(selectedCV.id);
  }, [selectedCV, refreshCV]);

  return {
    // Actions
    extract,
    generate,
    uploadFinal,
    saveNotes,
    refreshAudioNotes,
    refreshCV,

    // Loading states
    extracting,
    generating,
    uploading,
  };
}
