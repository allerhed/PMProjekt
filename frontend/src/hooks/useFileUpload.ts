import { useState, useCallback } from 'react';

type UploadState = 'idle' | 'uploading' | 'confirming' | 'done' | 'error';

interface UseFileUploadOptions {
  onRequestUrl: (file: File) => Promise<{ uploadUrl: string; resourceId: string }>;
  onConfirm: (resourceId: string) => Promise<void>;
}

interface UseFileUploadReturn {
  state: UploadState;
  progress: number;
  error: string | null;
  upload: (file: File) => Promise<void>;
  reset: () => void;
}

export function useFileUpload({ onRequestUrl, onConfirm }: UseFileUploadOptions): UseFileUploadReturn {
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setState('idle');
    setProgress(0);
    setError(null);
  }, []);

  const upload = useCallback(async (file: File) => {
    try {
      setState('uploading');
      setProgress(0);
      setError(null);

      // Step 1: Get presigned URL
      const { uploadUrl, resourceId } = await onRequestUrl(file);

      // Step 2: Upload file via XHR for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setProgress(Math.round((event.loaded / event.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.send(file);
      });

      // Step 3: Confirm upload
      setState('confirming');
      await onConfirm(resourceId);

      setState('done');
      setProgress(100);
    } catch (err: any) {
      setState('error');
      setError(err.message || 'Upload failed');
    }
  }, [onRequestUrl, onConfirm]);

  return { state, progress, error, upload, reset };
}
