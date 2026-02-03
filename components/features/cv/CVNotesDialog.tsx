'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Loader2, AlertCircle, Plus, Trash2, X, Copy, CheckCircle2, Clock, Play, Pause, FileAudio, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AudioNote } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useDebouncedSave } from '@/hooks';

interface AudioNoteWithSignedUrl extends AudioNote {
  signedUrl?: string | null;
}

type TabType = 'past' | 'future';

interface CVNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: string | null;
  futureMissionNotes: string | null;
  onSave: (notes: string | null, futureMissionNotes: string | null) => Promise<void>;
  cvId: string;
  audioNotes?: AudioNote[];
  onAudioNotesChange?: () => void;
}

export function CVNotesDialog({
  open,
  onOpenChange,
  notes,
  futureMissionNotes,
  onSave,
  cvId,
  audioNotes = [],
  onAudioNotesChange,
}: CVNotesDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>('past');
  const [pastDraft, setPastDraft] = useState(notes ?? '');
  const [futureDraft, setFutureDraft] = useState(futureMissionNotes ?? '');

  // Audio states
  const [audios, setAudios] = useState<AudioNoteWithSignedUrl[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  // Autosave
  const saveData = useMemo(
    () => ({ past: pastDraft, future: futureDraft }),
    [pastDraft, futureDraft]
  );

  const handleAutoSave = useCallback(
    async (data: { past: string; future: string }) => {
      await onSave(
        data.past.trim() || null,
        data.future.trim() || null
      );
    },
    [onSave]
  );

  const { isSaving, lastSaved, error: saveError } = useDebouncedSave({
    value: saveData,
    onSave: handleAutoSave,
    delay: 1000,
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setPastDraft(notes ?? '');
      setFutureDraft(futureMissionNotes ?? '');
      setUploadError(null);
      loadAudiosWithSignedUrls();
    }
  }, [open, notes, futureMissionNotes, cvId]);

  // Auto-refresh pour voir les mises à jour de transcription
  useEffect(() => {
    if (!open) return;

    const hasProcessingAudios = audios.some(
      (a) => a.status === 'PENDING' || a.status === 'UPLOADING' || a.status === 'PROCESSING'
    );

    if (!hasProcessingAudios) return;

    const interval = setInterval(() => {
      loadAudiosWithSignedUrls();
    }, 3000);

    return () => clearInterval(interval);
  }, [open, audios, cvId]);

  const loadAudiosWithSignedUrls = async () => {
    try {
      const response = await fetch(`/api/cv/${cvId}/audio`);
      const result = await response.json();
      if (result.success) {
        setAudios(result.data);
      }
    } catch (err) {
      console.error('Failed to load audio notes:', err);
      setAudios(audioNotes as AudioNoteWithSignedUrl[]);
    }
  };

  // Audio upload handlers
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadError(null);

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append('audio', file);

        const response = await fetch(`/api/cv/${cvId}/audio`, {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Upload failed');
        }

        setAudios((prev) => [result.data, ...prev]);
        onAudioNotesChange?.();
      } catch (err) {
        setUploadError(
          err instanceof Error ? err.message : 'Erreur lors de l\'upload'
        );
      }
    }

    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, [cvId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDeleteAudio = async (audioId: string) => {
    setDeletingId(audioId);
    try {
      const response = await fetch(`/api/cv/${cvId}/audio/${audioId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Delete failed');
      }

      setAudios((prev) => prev.filter((a) => a.id !== audioId));
      onAudioNotesChange?.();
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Erreur lors de la suppression'
      );
    } finally {
      setDeletingId(null);
    }
  };

  const togglePlayAudio = (audioId: string) => {
    const audioEl = audioRefs.current[audioId];
    if (!audioEl) return;

    if (playingId === audioId) {
      audioEl.pause();
      setPlayingId(null);
    } else {
      if (playingId && audioRefs.current[playingId]) {
        audioRefs.current[playingId]?.pause();
      }
      audioEl.play();
      setPlayingId(audioId);
    }
  };

  const handleAudioEnded = (audioId: string) => {
    if (playingId === audioId) {
      setPlayingId(null);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const copyTranscriptionToNotes = (transcription: string, audioId: string) => {
    const setDraft = activeTab === 'past' ? setPastDraft : setFutureDraft;
    const currentDraft = activeTab === 'past' ? pastDraft : futureDraft;

    const separator = currentDraft.trim() ? '\n\n---\n\n' : '';
    setDraft((prev) => prev.trim() + separator + transcription);
    setCopiedId(audioId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="w-3.5 h-3.5 text-zinc-400" />;
      case 'UPLOADING':
      case 'PROCESSING':
        return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />;
      case 'COMPLETED':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
      case 'FAILED':
        return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
      default:
        return null;
    }
  };

  const currentDraft = activeTab === 'past' ? pastDraft : futureDraft;
  const setCurrentDraft = activeTab === 'past' ? setPastDraft : setFutureDraft;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className={cn(
          "p-0 gap-0 border-zinc-200 dark:border-zinc-800",
          "w-[95vw] max-w-5xl h-[85vh] flex flex-col"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* Accessible title (visually hidden) */}
        <DialogTitle className="sr-only">Notes et transcriptions du CV</DialogTitle>

        {/* Drag overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-50 bg-primary/5 border-2 border-dashed border-primary rounded-lg flex items-center justify-center">
            <div className="text-center">
              <FileAudio className="w-12 h-12 mx-auto text-primary/60 mb-2" />
              <p className="text-sm font-medium text-primary">Deposez vos fichiers audio ici</p>
            </div>
          </div>
        )}

        {/* Header with Tabs */}
        <DialogHeader className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
              <button
                onClick={() => setActiveTab('past')}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-md transition-all",
                  activeTab === 'past'
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                )}
              >
                Missions passees
                {pastDraft && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />}
              </button>
              <button
                onClick={() => setActiveTab('future')}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-md transition-all",
                  activeTab === 'future'
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                )}
              >
                Mission a venir
                {futureDraft && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />}
              </button>
            </div>
            <div className="flex items-center gap-3">
              {/* Save indicator */}
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                {isSaving ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Sauvegarde...</span>
                  </>
                ) : lastSaved ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span>Sauvegarde</span>
                  </>
                ) : null}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.opus,.ogg,.mp3,.m4a,.wav,.webm,.aac,.oga,.flac"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                {uploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                Audio
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Notes Section */}
          <div className="flex-1 flex flex-col p-6 md:border-r border-zinc-100 dark:border-zinc-800 overflow-hidden">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
              {activeTab === 'past' ? 'Notes sur les missions passees' : 'Notes sur la mission a venir'}
            </label>
            <Textarea
              value={currentDraft}
              onChange={(e) => setCurrentDraft(e.target.value)}
              placeholder={
                activeTab === 'past'
                  ? "Contexte sur les experiences passees du candidat..."
                  : "Contexte sur la mission envisagee pour ce candidat..."
              }
              className={cn(
                "flex-1 min-h-[200px] resize-none overflow-y-auto",
                "text-sm leading-relaxed",
                "border-zinc-200 dark:border-zinc-700",
                "focus-visible:ring-1 focus-visible:ring-zinc-400",
                "placeholder:text-zinc-400"
              )}
              maxLength={10000}
            />
          </div>

          {/* Transcriptions Section */}
          <div className="flex-1 flex flex-col bg-zinc-50/50 dark:bg-zinc-900/50 overflow-hidden">
            <div className="px-6 py-3 border-b border-zinc-100 dark:border-zinc-800 flex-shrink-0">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Transcriptions audio ({audios.length})
              </label>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {(uploadError || saveError) && (
                <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{uploadError || saveError?.message}</span>
                  <button
                    onClick={() => setUploadError(null)}
                    className="hover:text-red-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {audios.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
                    <FileAudio className="w-5 h-5 text-zinc-400" />
                  </div>
                  <p className="text-sm text-zinc-500 mb-1">Aucun audio</p>
                  <p className="text-xs text-zinc-400">
                    Glissez un fichier ou cliquez sur + Audio
                  </p>
                </div>
              ) : (
                audios.map((audio) => (
                  <div
                    key={audio.id}
                    className={cn(
                      "group rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700",
                      "transition-all duration-200",
                      "hover:border-zinc-300 dark:hover:border-zinc-600"
                    )}
                  >
                    {/* Audio header - compact */}
                    <div className="flex items-center gap-2 px-3 py-2">
                      {audio.signedUrl && (
                        <audio
                          ref={(el) => { audioRefs.current[audio.id] = el; }}
                          src={audio.signedUrl}
                          onEnded={() => handleAudioEnded(audio.id)}
                          preload="metadata"
                        />
                      )}

                      <button
                        onClick={() => audio.signedUrl && togglePlayAudio(audio.id)}
                        disabled={!audio.signedUrl}
                        className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
                          "transition-colors",
                          audio.signedUrl
                            ? "bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                            : "bg-zinc-50 dark:bg-zinc-800 cursor-not-allowed"
                        )}
                      >
                        {playingId === audio.id ? (
                          <Pause className="w-3 h-3 text-zinc-600 dark:text-zinc-300" />
                        ) : (
                          <Play className="w-3 h-3 text-zinc-600 dark:text-zinc-300 ml-0.5" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300 truncate">
                          {audio.originalName}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {audio.duration && (
                          <span className="text-xs text-zinc-400">{formatDuration(audio.duration)}</span>
                        )}
                        {getStatusIndicator(audio.status)}
                        <button
                          onClick={() => handleDeleteAudio(audio.id)}
                          disabled={deletingId === audio.id}
                          className={cn(
                            "w-6 h-6 rounded flex items-center justify-center",
                            "opacity-0 group-hover:opacity-100 transition-opacity",
                            "hover:bg-zinc-100 dark:hover:bg-zinc-700",
                            "text-zinc-400 hover:text-red-500"
                          )}
                        >
                          {deletingId === audio.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Transcription */}
                    {audio.transcription && (
                      <div className="px-3 pb-3">
                        <div className="relative p-2 bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-100 dark:border-zinc-700">
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed pr-7">
                            {audio.transcription}
                          </p>
                          <button
                            onClick={() => copyTranscriptionToNotes(audio.transcription!, audio.id)}
                            className={cn(
                              "absolute top-2 right-2",
                              "w-6 h-6 rounded flex items-center justify-center",
                              "hover:bg-zinc-200 dark:hover:bg-zinc-700",
                              "transition-colors",
                              copiedId === audio.id ? "text-emerald-500" : "text-zinc-400 hover:text-zinc-600"
                            )}
                            title="Copier dans les notes"
                          >
                            {copiedId === audio.id ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Processing status */}
                    {(audio.status === 'PENDING' || audio.status === 'UPLOADING' || audio.status === 'PROCESSING') && (
                      <div className="px-3 pb-2">
                        <p className="text-xs text-zinc-400 italic">Transcription en cours...</p>
                      </div>
                    )}

                    {/* Error message */}
                    {audio.status === 'FAILED' && audio.errorMessage && (
                      <div className="px-3 pb-2">
                        <p className="text-xs text-red-500">{audio.errorMessage}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
