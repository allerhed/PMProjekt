import api from './api';
import type { EntityType, FieldType, CustomFieldDefinition } from '../types';

// Map snake_case DB row to camelCase frontend type
function mapDefinition(row: Record<string, unknown>): CustomFieldDefinition {
  return {
    id: row.id as string,
    organizationId: (row.organization_id as string) || '',
    entityType: row.entity_type as EntityType,
    fieldKey: row.field_key as string,
    label: row.label as string,
    fieldType: row.field_type as FieldType,
    options: (row.options as string[] | null) ?? null,
    isRequired: (row.is_required as boolean) ?? false,
    displayOrder: (row.display_order as number) ?? 0,
    isActive: (row.is_active as boolean) ?? true,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export const customFieldApi = {
  // Public endpoint — active definitions for form rendering
  async listByEntityType(entityType: EntityType): Promise<CustomFieldDefinition[]> {
    const res = await api.get('/custom-fields', { params: { entityType } });
    return (res.data.data.definitions as Record<string, unknown>[]).map(mapDefinition);
  },

  // Admin endpoints — include inactive fields
  async adminList(entityType: EntityType): Promise<CustomFieldDefinition[]> {
    const res = await api.get('/admin/custom-fields', {
      params: { entityType, includeInactive: 'true' },
    });
    return (res.data.data.definitions as Record<string, unknown>[]).map(mapDefinition);
  },

  async create(data: {
    entityType: EntityType;
    label: string;
    fieldType: FieldType;
    options?: string[];
    isRequired?: boolean;
  }): Promise<CustomFieldDefinition> {
    const res = await api.post('/admin/custom-fields', data);
    return mapDefinition(res.data.data.definition);
  },

  async update(id: string, data: {
    label?: string;
    fieldType?: FieldType;
    options?: string[];
    isRequired?: boolean;
    isActive?: boolean;
  }): Promise<CustomFieldDefinition> {
    const res = await api.patch(`/admin/custom-fields/${id}`, data);
    return mapDefinition(res.data.data.definition);
  },

  async deactivate(id: string) {
    const res = await api.delete(`/admin/custom-fields/${id}`);
    return res.data;
  },

  async activate(id: string): Promise<CustomFieldDefinition> {
    const res = await api.patch(`/admin/custom-fields/${id}`, { isActive: true });
    return mapDefinition(res.data.data.definition);
  },

  async reorder(entityType: EntityType, orderedIds: string[]) {
    const res = await api.put('/admin/custom-fields/reorder', { entityType, orderedIds });
    return res.data;
  },
};
