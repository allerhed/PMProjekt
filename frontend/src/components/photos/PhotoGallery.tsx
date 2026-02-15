import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { uploadApi } from '../../services/upload.api';
import Spinner from '../ui/Spinner';

interface PhotoGalleryProps {
  projectId: string;
  taskId: string;
}

export default function PhotoGallery({ projectId, taskId }: PhotoGalleryProps) {
  const queryClient = useQueryClient();
  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['photos', projectId, taskId],
    queryFn: () => uploadApi.listPhotos(projectId, taskId),
  });

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  async function handleDelete(photoId: string) {
    setDeleting(photoId);
    setDeleteTarget(null);
    try {
      await uploadApi.deletePhoto(projectId, taskId, photoId);
      queryClient.invalidateQueries({ queryKey: ['photos', projectId, taskId] });
    } finally {
      setDeleting(null);
    }
  }

  if (isLoading) {
    return <div className="flex justify-center py-4"><Spinner size="sm" /></div>;
  }

  if (photos.length === 0) {
    return <p className="text-sm text-gray-500">No photos</p>;
  }

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {photos.map((photo: any, index: number) => (
          <div key={photo.id} className="relative group">
            <img
              src={photo.thumbnail_download_url || photo.download_url}
              alt={photo.caption || 'Task photo'}
              className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setLightboxIndex(index)}
            />
            <button
              onClick={() => setDeleteTarget(photo.id)}
              disabled={deleting === photo.id}
              className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              x
            </button>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
          <button
            className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300"
            onClick={() => setLightboxIndex(null)}
          >
            x
          </button>

          {lightboxIndex > 0 && (
            <button
              className="absolute left-4 text-white text-3xl hover:text-gray-300"
              onClick={() => setLightboxIndex(lightboxIndex - 1)}
            >
              &lsaquo;
            </button>
          )}

          {lightboxIndex < photos.length - 1 && (
            <button
              className="absolute right-4 text-white text-3xl hover:text-gray-300"
              onClick={() => setLightboxIndex(lightboxIndex + 1)}
            >
              &rsaquo;
            </button>
          )}

          <img
            src={photos[lightboxIndex].download_url}
            alt={photos[lightboxIndex].caption || 'Task photo'}
            className="max-h-[90vh] max-w-[90vw] object-contain"
          />

          {photos[lightboxIndex].caption && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/60 px-4 py-2 rounded">
              {photos[lightboxIndex].caption}
            </div>
          )}
        </div>
      )}
      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Photo</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete this photo? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
