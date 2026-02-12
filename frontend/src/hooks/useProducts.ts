import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productApi } from '../services/product.api';

export function useProducts(params?: { search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => productApi.list(params),
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => productApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; productId?: string; description?: string; link?: string; comment?: string }) =>
      productApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      productApi.update(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', variables.id] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => productApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// Task-product hooks

export function useTaskProducts(projectId: string, taskId: string) {
  return useQuery({
    queryKey: ['taskProducts', projectId, taskId],
    queryFn: () => productApi.listByTask(projectId, taskId),
    enabled: !!projectId && !!taskId,
  });
}

export function useAddProductToTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, productId }: { taskId: string; productId: string }) =>
      productApi.addToTask(projectId, taskId, productId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['taskProducts', projectId, variables.taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task'] });
    },
  });
}

export function useRemoveProductFromTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, productId }: { taskId: string; productId: string }) =>
      productApi.removeFromTask(projectId, taskId, productId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['taskProducts', projectId, variables.taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task'] });
    },
  });
}
