import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectNoteApi } from '../services/projectNote.api';

export function useProjectNotes(projectId: string, params?: { sortBy?: string; sortOrder?: string }) {
  return useQuery({
    queryKey: ['project-notes', projectId, params],
    queryFn: () => projectNoteApi.list(projectId, params),
    enabled: !!projectId,
  });
}

export function useCreateNote(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { content: string }) =>
      projectNoteApi.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-notes', projectId] });
    },
  });
}

export function useUpdateNote(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, data }: { noteId: string; data: { content: string } }) =>
      projectNoteApi.update(projectId, noteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-notes', projectId] });
    },
  });
}

export function useDeleteNote(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) =>
      projectNoteApi.remove(projectId, noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-notes', projectId] });
    },
  });
}
