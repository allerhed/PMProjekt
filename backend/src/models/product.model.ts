import pool from '../config/database';

export interface ProductRow {
  id: string;
  organization_id: string;
  product_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
  link: string | null;
  comment: string | null;
  custom_fields: Record<string, unknown> | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface TaskProductRow {
  id: string;
  task_id: string;
  product_id: string;
  added_by: string | null;
  created_at: Date;
}

export interface TaskProductWithDetails extends TaskProductRow {
  product_name: string;
  product_product_id: string | null;
  product_description: string | null;
  product_image_url: string | null;
  product_thumbnail_url: string | null;
  product_link: string | null;
  product_comment: string | null;
}

export async function findProductsByOrganization(
  organizationId: string,
  pagination: { limit: number; offset: number },
  search?: string,
): Promise<{ products: ProductRow[]; total: number }> {
  const conditions = ['p.organization_id = $1'];
  const values: unknown[] = [organizationId];
  let paramIndex = 2;

  if (search) {
    conditions.push(`(p.name ILIKE $${paramIndex} OR p.product_id ILIKE $${paramIndex})`);
    values.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM products p WHERE ${whereClause}`,
    values,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await pool.query(
    `SELECT p.*
     FROM products p
     WHERE ${whereClause}
     ORDER BY p.name ASC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...values, pagination.limit, pagination.offset],
  );

  return { products: result.rows, total };
}

export async function findProductById(
  id: string,
  organizationId?: string,
): Promise<ProductRow | null> {
  const conditions = ['p.id = $1'];
  const values: unknown[] = [id];

  if (organizationId) {
    conditions.push('p.organization_id = $2');
    values.push(organizationId);
  }

  const result = await pool.query(
    `SELECT p.* FROM products p WHERE ${conditions.join(' AND ')}`,
    values,
  );
  return result.rows[0] || null;
}

export async function createProduct(data: {
  organizationId: string;
  productId?: string;
  name: string;
  description?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  link?: string;
  comment?: string;
  customFields?: Record<string, unknown>;
  createdBy: string;
}): Promise<ProductRow> {
  const result = await pool.query(
    `INSERT INTO products (organization_id, product_id, name, description, image_url, thumbnail_url, link, comment, custom_fields, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      data.organizationId,
      data.productId || null,
      data.name,
      data.description || null,
      data.imageUrl || null,
      data.thumbnailUrl || null,
      data.link || null,
      data.comment || null,
      JSON.stringify(data.customFields || {}),
      data.createdBy,
    ],
  );
  return result.rows[0];
}

export async function updateProduct(
  id: string,
  data: Record<string, unknown>,
): Promise<ProductRow | null> {
  const fieldMap: Record<string, string> = {
    productId: 'product_id',
    name: 'name',
    description: 'description',
    imageUrl: 'image_url',
    thumbnailUrl: 'thumbnail_url',
    link: 'link',
    comment: 'comment',
    customFields: 'custom_fields',
  };

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(data)) {
    const dbField = fieldMap[key];
    if (dbField) {
      setClauses.push(`${dbField} = $${paramIndex}`);
      values.push(dbField === 'custom_fields' ? JSON.stringify(value) : value);
      paramIndex++;
    }
  }

  if (setClauses.length === 0) return findProductById(id);

  values.push(id);
  const result = await pool.query(
    `UPDATE products SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values,
  );
  return result.rows[0] || null;
}

export async function deleteProduct(id: string): Promise<ProductRow | null> {
  const result = await pool.query(
    'DELETE FROM products WHERE id = $1 RETURNING *',
    [id],
  );
  return result.rows[0] || null;
}

// Task-product junction operations

export async function findProductsByTask(
  taskId: string,
  organizationId: string,
): Promise<TaskProductWithDetails[]> {
  const result = await pool.query(
    `SELECT tp.id, tp.task_id, tp.product_id, tp.added_by, tp.created_at,
            p.name as product_name, p.product_id as product_product_id,
            p.description as product_description, p.image_url as product_image_url,
            p.thumbnail_url as product_thumbnail_url, p.link as product_link,
            p.comment as product_comment
     FROM task_products tp
     JOIN products p ON p.id = tp.product_id
     JOIN tasks t ON t.id = tp.task_id
     JOIN projects pr ON pr.id = t.project_id
     WHERE tp.task_id = $1 AND pr.organization_id = $2
     ORDER BY tp.created_at DESC`,
    [taskId, organizationId],
  );
  return result.rows;
}

export async function addProductToTask(
  taskId: string,
  productId: string,
  addedBy: string,
): Promise<TaskProductRow> {
  const result = await pool.query(
    `INSERT INTO task_products (task_id, product_id, added_by)
     VALUES ($1, $2, $3) RETURNING *`,
    [taskId, productId, addedBy],
  );
  return result.rows[0];
}

export async function removeProductFromTask(
  taskId: string,
  productId: string,
): Promise<TaskProductRow | null> {
  const result = await pool.query(
    'DELETE FROM task_products WHERE task_id = $1 AND product_id = $2 RETURNING *',
    [taskId, productId],
  );
  return result.rows[0] || null;
}
