import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFieldApi } from '../services/customField.api';
import type { EntityType, FieldType } from '../types';

// Public hook — used by entity forms to render custom fields
export function useCustomFieldDefinitions(entityType: EntityType) {
  return useQuery({
    queryKey: ['customFieldDefinitions', entityType],
    queryFn: () => customFieldApi.listByEntityType(entityType),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Admin hooks — used by Form Builder page
export function useAdminCustomFields(entityType: EntityType) {
  return useQuery({
    queryKey: ['adminCustomFields', entityType],
    queryFn: () => customFieldApi.adminList(entityType),
  });
}

export function useCreateCustomField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      entityType: EntityType;
      label: string;
      fieldType: FieldType;
      options?: string[];
      isRequired?: boolean;
    }) => customFieldApi.create(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['adminCustomFields', variables.entityType] });
      queryClient.invalidateQueries({ queryKey: ['customFieldDefinitions', variables.entityType] });
    },
  });
}

export function useUpdateCustomField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { label?: string; fieldType?: FieldType; options?: string[]; isRequired?: boolean } }) =>
      customFieldApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCustomFields'] });
      queryClient.invalidateQueries({ queryKey: ['customFieldDefinitions'] });
    },
  });
}

export function useDeactivateCustomField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customFieldApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCustomFields'] });
      queryClient.invalidateQueries({ queryKey: ['customFieldDefinitions'] });
    },
  });
}

export function useActivateCustomField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customFieldApi.activate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCustomFields'] });
      queryClient.invalidateQueries({ queryKey: ['customFieldDefinitions'] });
    },
  });
}

export function useReorderCustomFields() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entityType, orderedIds }: { entityType: EntityType; orderedIds: string[] }) =>
      customFieldApi.reorder(entityType, orderedIds),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['adminCustomFields', variables.entityType] });
      queryClient.invalidateQueries({ queryKey: ['customFieldDefinitions', variables.entityType] });
    },
  });
}
