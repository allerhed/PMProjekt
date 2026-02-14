import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useFileUpload } from '../../hooks/useFileUpload';
import { uploadApi } from '../../services/upload.api';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface BlueprintUploaderProps {
  projectId: string;
}

const MAX_BLUEPRINT_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_TYPES = ['application/pdf'];

export default function BlueprintUploader({ projectId }: BlueprintUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { state, progress, error, upload, reset } = useFileUpload({
    onRequestUrl: async (file) => {
      const result = await uploadApi.requestBlueprintUpload(projectId, {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        name: name || file.name,
      });
      return { uploadUrl: result.uploadUrl, resourceId: result.blueprintId };
    },
    onConfirm: async (blueprintId) => {
      await uploadApi.confirmBlueprint(projectId, blueprintId);
      queryClient.invalidateQueries({ queryKey: ['blueprints', projectId] });
    },
  });

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setValidationError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setValidationError('Only PDF files are allowed');
      return;
    }
    if (file.size > MAX_BLUEPRINT_SIZE) {
      setValidationError('File must be smaller than 50 MB');
      return;
    }

    setSelectedFile(file);
    if (!name) setName(file.name.replace(/\.[^.]+$/, ''));
  }

  async function handleUpload() {
    if (!selectedFile) return;
    await upload(selectedFile);
  }

  const isUploading = state === 'uploading' || state === 'confirming';

  if (state === 'done') {
    return (
      <div className="flex items-center gap-2 text-green-600 text-sm">
        <span>Blueprint uploaded</span>
        <Button variant="ghost" size="sm" onClick={() => { reset(); setSelectedFile(null); setName(''); }}>
          Upload another
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileSelect}
      />

      {!selectedFile ? (
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
          Select Blueprint File
        </Button>
      ) : (
        <>
          <div className="text-sm text-gray-600">
            Selected: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
          </div>
          <Input
            label="Blueprint Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Floor Plan Level 1"
          />
          <div className="flex gap-2">
            <Button onClick={handleUpload} loading={isUploading} disabled={!name}>
              {isUploading ? `Uploading ${progress}%` : 'Upload'}
            </Button>
            <Button variant="ghost" onClick={() => { setSelectedFile(null); setName(''); }}>
              Cancel
            </Button>
          </div>
        </>
      )}

      {(error || validationError) && (
        <p className="text-sm text-red-600">{error || validationError}</p>
      )}
    </div>
  );
}
