import pool from '../config/database';

export interface CustomFieldDefinitionRow {
  id: string;
  organization_id: string;
  entity_type: string;
  field_key: string;
  label: string;
  field_type: string;
  options: string[] | null;
  is_required: boolean;
  display_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export function generateFieldKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 100);
}

export async function findByOrganizationAndEntity(
  organizationId: string,
  entityType: string,
  includeInactive = false,
): Promise<CustomFieldDefinitionRow[]> {
  const conditions = ['organization_id = $1', 'entity_type = $2'];
  const values: unknown[] = [organizationId, entityType];

  if (!includeInactive) {
    conditions.push('is_active = true');
  }

  const result = await pool.query(
    `SELECT * FROM custom_field_definitions
     WHERE ${conditions.join(' AND ')}
     ORDER BY display_order ASC, created_at ASC`,
    values,
  );
  return result.rows;
}

export async function findById(
  id: string,
  organizationId: string,
): Promise<CustomFieldDefinitionRow | null> {
  const result = await pool.query(
    'SELECT * FROM custom_field_definitions WHERE id = $1 AND organization_id = $2',
    [id, organizationId],
  );
  return result.rows[0] || null;
}

export async function create(data: {
  organizationId: string;
  entityType: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  options?: string[];
  isRequired?: boolean;
  displayOrder?: number;
}): Promise<CustomFieldDefinitionRow> {
  const result = await pool.query(
    `INSERT INTO custom_field_definitions
       (organization_id, entity_type, field_key, label, field_type, options, is_required, display_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.organizationId,
      data.entityType,
      data.fieldKey,
      data.label,
      data.fieldType,
      data.options ? JSON.stringify(data.options) : null,
      data.isRequired ?? false,
      data.displayOrder ?? 0,
    ],
  );
  return result.rows[0];
}

export async function update(
  id: string,
  organizationId: string,
  updates: Record<string, unknown>,
): Promise<CustomFieldDefinitionRow | null> {
  const fieldMap: Record<string, string> = {
    label: 'label',
    fieldType: 'field_type',
    options: 'options',
    isRequired: 'is_required',
    displayOrder: 'display_order',
    isActive: 'is_active',
  };

  const sets: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    const dbField = fieldMap[key];
    if (!dbField) continue;

    sets.push(`${dbField} = $${paramIndex}`);
    if (dbField === 'options') {
      values.push(value ? JSON.stringify(value) : null);
    } else {
      values.push(value);
    }
    paramIndex++;
  }

  if (sets.length === 0) return findById(id, organizationId);

  values.push(id, organizationId);
  const result = await pool.query(
    `UPDATE custom_field_definitions SET ${sets.join(', ')}
     WHERE id = $${paramIndex} AND organization_id = $${paramIndex + 1}
     RETURNING *`,
    values,
  );
  return result.rows[0] || null;
}

export async function deactivate(
  id: string,
  organizationId: string,
): Promise<CustomFieldDefinitionRow | null> {
  const result = await pool.query(
    `UPDATE custom_field_definitions SET is_active = false
     WHERE id = $1 AND organization_id = $2
     RETURNING *`,
    [id, organizationId],
  );
  return result.rows[0] || null;
}

export async function reorder(
  organizationId: string,
  entityType: string,
  orderedIds: string[],
): Promise<void> {
  const cases = orderedIds
    .map((_, index) => `WHEN id = $${index + 3} THEN ${index}`)
    .join(' ');

  await pool.query(
    `UPDATE custom_field_definitions
     SET display_order = CASE ${cases} ELSE display_order END
     WHERE organization_id = $1 AND entity_type = $2`,
    [organizationId, entityType, ...orderedIds],
  );
}
