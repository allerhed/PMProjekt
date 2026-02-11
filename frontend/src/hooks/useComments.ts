import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commentApi } from '../services/comment.api';

export function useComments(projectId: string, taskId: string) {
  return useQuery({
    queryKey: ['comments', projectId, taskId],
    queryFn: () => commentApi.list(projectId, taskId),
    enabled: !!projectId && !!taskId,
  });
}

export function useCreateComment(projectId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentText: string) =>
      commentApi.create(projectId, taskId, commentText),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', projectId, taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', projectId, taskId] });
    },
  });
}
