/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  // Products table (organization-scoped product catalog)
  pgm.createTable('products', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations', onDelete: 'CASCADE' },
    product_id: { type: 'varchar(100)' },
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    image_url: { type: 'varchar(500)' },
    thumbnail_url: { type: 'varchar(500)' },
    link: { type: 'varchar(500)' },
    comment: { type: 'text' },
    created_by: { type: 'uuid', references: 'users' },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });
  pgm.createIndex('products', 'organization_id', { name: 'idx_products_org' });
  pgm.createIndex('products', ['organization_id', 'product_id'], { name: 'idx_products_org_product_id' });

  // Task products junction table
  pgm.createTable('task_products', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    task_id: { type: 'uuid', notNull: true, references: 'tasks', onDelete: 'CASCADE' },
    product_id: { type: 'uuid', notNull: true, references: 'products', onDelete: 'CASCADE' },
    added_by: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });
  pgm.addConstraint('task_products', 'uq_task_products_task_product', {
    unique: ['task_id', 'product_id'],
  });
  pgm.createIndex('task_products', 'task_id', { name: 'idx_task_products_task' });
  pgm.createIndex('task_products', 'product_id', { name: 'idx_task_products_product' });

  // Updated_at trigger for products
  pgm.sql('CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql('DROP TRIGGER IF EXISTS update_products_updated_at ON products');
  pgm.dropTable('task_products', { ifExists: true });
  pgm.dropTable('products', { ifExists: true });
};
