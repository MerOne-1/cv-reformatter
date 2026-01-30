'use client';

import { useState, useCallback } from 'react';
import { Upload, Loader2, CheckCircle2, FileUp, Sparkles, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CVUploadProps {
  onUploadComplete: () => void;
  compact?: boolean;
}

export function CVUpload({ onUploadComplete, compact }: CVUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('/api/cv/upload', {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data.originalName;
  };

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(f => /\.(pdf|docx?|doc)$/i.test(f.name));

    if (validFiles.length === 0) {
      setError('Format non supporté. Utilisez PDF, DOC ou DOCX.');
      setTimeout(() => setError(null), 4000);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      for (const file of validFiles) {
        const name = await uploadFile(file);
        setUploaded(name);
      }
      setTimeout(() => {
        onUploadComplete();
        setUploaded(null);
      }, 1200);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'upload';
      console.error('Upload error:', err);
      setError(message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(f => /\.(pdf|docx?|doc)$/i.test(f.name));

    if (validFiles.length === 0) {
      setError('Format non supporté. Utilisez PDF, DOC ou DOCX.');
      setTimeout(() => setError(null), 4000);
      return;
    }

    handleFiles(validFiles);
  }, [onUploadComplete]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
  };

  if (error) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20 animate-scale-in">
        <div className="w-8 h-8 rounded-lg bg-destructive/20 flex items-center justify-center">
          <AlertCircle className="w-4 h-4 text-destructive" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-destructive truncate">{error}</p>
          <p className="text-[10px] text-destructive/70">Erreur d'upload</p>
        </div>
      </div>
    );
  }

  if (uploaded) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-success/10 border border-success/20 animate-scale-in">
        <div className="w-8 h-8 rounded-lg bg-success/20 flex items-center justify-center">
          <CheckCircle2 className="w-4 h-4 text-success" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-success truncate">{uploaded}</p>
          <p className="text-[10px] text-success/70">Upload termine</p>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'relative border-2 border-dashed rounded-xl transition-all duration-200 group',
        compact ? 'p-3' : 'p-5',
        isDragging
          ? 'border-dreamit bg-dreamit/5 scale-[1.02]'
          : 'border-border hover:border-muted-foreground/30 hover:bg-card-hover',
        uploading && 'pointer-events-none opacity-60'
      )}
    >
      <input
        type="file"
        accept=".pdf,.doc,.docx"
        multiple
        onChange={handleInputChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={uploading}
      />

      <div className="flex flex-col items-center gap-2 text-center">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200',
          isDragging
            ? 'bg-dreamit/20 text-dreamit scale-110'
            : 'bg-secondary text-muted-foreground group-hover:bg-secondary/80'
        )}>
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isDragging ? (
            <Sparkles className="w-5 h-5" />
          ) : (
            <FileUp className="w-5 h-5" />
          )}
        </div>

        <div>
          <p className={cn(
            'text-xs font-medium transition-colors',
            isDragging ? 'text-dreamit' : 'text-muted-foreground'
          )}>
            {uploading ? 'Upload en cours...' : isDragging ? 'Deposez ici' : 'Deposer un CV'}
          </p>
          {!compact && (
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
              PDF, DOC, DOCX
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
