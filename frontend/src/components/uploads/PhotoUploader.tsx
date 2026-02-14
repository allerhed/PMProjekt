import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useFileUpload } from '../../hooks/useFileUpload';
import { uploadApi } from '../../services/upload.api';
import Button from '../ui/Button';

interface PhotoUploaderProps {
  projectId: string;
  taskId: string;
}

const MAX_PHOTO_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

export default function PhotoUploader({ projectId, taskId }: PhotoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { state, progress, error, upload, reset } = useFileUpload({
    onRequestUrl: async (file) => {
      const result = await uploadApi.requestPhotoUpload(projectId, taskId, {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });
      return { uploadUrl: result.uploadUrl, resourceId: result.photoId };
    },
    onConfirm: async (photoId) => {
      await uploadApi.confirmPhoto(projectId, taskId, photoId);
      queryClient.invalidateQueries({ queryKey: ['photos', projectId, taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', projectId, taskId] });
    },
  });

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setValidationError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setValidationError('Only JPG and PNG files are allowed');
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setValidationError('File must be smaller than 10 MB');
      return;
    }

    upload(file);
  }

  const isUploading = state === 'uploading' || state === 'confirming';

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png"
        className="hidden"
        onChange={handleFileSelect}
      />

      {state === 'done' ? (
        <div className="flex items-center gap-2 text-green-600 text-sm">
          <span>Photo uploaded</span>
          <Button variant="ghost" size="sm" onClick={() => { reset(); fileInputRef.current?.click(); }}>
            Upload another
          </Button>
        </div>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          loading={isUploading}
          disabled={isUploading}
        >
          {isUploading ? `Uploading ${progress}%` : 'Add Photo'}
        </Button>
      )}

      {(error || validationError) && (
        <p className="mt-1 text-sm text-red-600">{error || validationError}</p>
      )}
    </div>
  );
}
