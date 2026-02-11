/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  // Extensions
  pgm.sql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  pgm.sql('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  pgm.sql('CREATE EXTENSION IF NOT EXISTS "pg_trgm"');

  // Organizations
  pgm.createTable('organizations', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'varchar(255)', notNull: true },
    subdomain: { type: 'varchar(50)', notNull: true, unique: true },
    logo_url: { type: 'varchar(500)' },
    primary_color: { type: 'varchar(7)' },
    storage_used_bytes: { type: 'bigint', default: 0 },
    storage_limit_bytes: { type: 'bigint', default: 10737418240 },
    is_active: { type: 'boolean', default: true },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });
  pgm.createIndex('organizations', 'subdomain', { name: 'idx_organizations_subdomain' });

  // Users
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations', onDelete: 'CASCADE' },
    email: { type: 'varchar(255)', notNull: true, unique: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    first_name: { type: 'varchar(100)', notNull: true },
    last_name: { type: 'varchar(100)', notNull: true },
    role: {
      type: 'varchar(20)',
      notNull: true,
      check: "role IN ('super_admin', 'org_admin', 'project_manager', 'field_user')",
    },
    is_active: { type: 'boolean', default: true },
    failed_login_attempts: { type: 'int', default: 0 },
    locked_until: { type: 'timestamptz' },
    last_login_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });
  pgm.createIndex('users', ['organization_id', 'email'], { name: 'idx_users_org_email' });
  pgm.createIndex('users', 'role', { name: 'idx_users_role' });
  pgm.createIndex('users', 'email', { name: 'idx_users_email' });

  // Projects
  pgm.createTable('projects', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    address: { type: 'text' },
    status: {
      type: 'varchar(20)',
      default: 'active',
      check: "status IN ('active', 'completed', 'archived')",
    },
    start_date: { type: 'date' },
    target_completion_date: { type: 'date' },
    created_by: { type: 'uuid', references: 'users' },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });
  pgm.createIndex('projects', ['organization_id', 'status'], { name: 'idx_projects_org_status' });
  pgm.createIndex('projects', ['start_date', 'target_completion_date'], { name: 'idx_projects_dates' });

  // Blueprints
  pgm.createTable('blueprints', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    project_id: { type: 'uuid', notNull: true, references: 'projects', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    file_url: { type: 'varchar(500)', notNull: true },
    file_size_bytes: { type: 'bigint', notNull: true },
    mime_type: { type: 'varchar(50)', notNull: true },
    thumbnail_url: { type: 'varchar(500)' },
    width_pixels: { type: 'int' },
    height_pixels: { type: 'int' },
    uploaded_by: { type: 'uuid', references: 'users' },
    uploaded_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });
  pgm.createIndex('blueprints', 'project_id', { name: 'idx_blueprints_project' });

  // Tasks
  pgm.createTable('tasks', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    project_id: { type: 'uuid', notNull: true, references: 'projects', onDelete: 'CASCADE' },
    blueprint_id: { type: 'uuid', references: 'blueprints', onDelete: 'SET NULL' },
    title: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    status: {
      type: 'varchar(20)',
      default: 'open',
      check: "status IN ('open', 'in_progress', 'completed', 'verified')",
    },
    priority: {
      type: 'varchar(20)',
      default: 'normal',
      check: "priority IN ('low', 'normal', 'high', 'critical')",
    },
    trade: { type: 'varchar(50)' },
    location_x: { type: 'float' },
    location_y: { type: 'float' },
    assigned_to_user: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    assigned_to_contractor_email: { type: 'varchar(255)' },
    created_by: { type: 'uuid', references: 'users' },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    completed_at: { type: 'timestamptz' },
    verified_at: { type: 'timestamptz' },
  });
  pgm.createIndex('tasks', ['project_id', 'status'], { name: 'idx_tasks_project_status' });
  pgm.createIndex('tasks', ['assigned_to_user', 'status'], { name: 'idx_tasks_assigned' });
  pgm.createIndex('tasks', 'assigned_to_contractor_email', { name: 'idx_tasks_contractor' });
  pgm.createIndex('tasks', ['trade', 'status'], { name: 'idx_tasks_trade' });
  pgm.sql(`CREATE INDEX idx_tasks_search ON tasks USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')))`);

  // Task Photos
  pgm.createTable('task_photos', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    task_id: { type: 'uuid', notNull: true, references: 'tasks', onDelete: 'CASCADE' },
    file_url: { type: 'varchar(500)', notNull: true },
    file_size_bytes: { type: 'bigint', notNull: true },
    thumbnail_url: { type: 'varchar(500)' },
    caption: { type: 'varchar(500)' },
    uploaded_by: { type: 'uuid', references: 'users' },
    uploaded_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });
  pgm.createIndex('task_photos', 'task_id', { name: 'idx_task_photos_task' });

  // Task Comments
  pgm.createTable('task_comments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    task_id: { type: 'uuid', notNull: true, references: 'tasks', onDelete: 'CASCADE' },
    user_id: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    external_email: { type: 'varchar(255)' },
    comment_text: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });
  pgm.createIndex('task_comments', ['task_id', 'created_at'], { name: 'idx_task_comments_task' });

  // Protocols
  pgm.createTable('protocols', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    project_id: { type: 'uuid', notNull: true, references: 'projects', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    filters: { type: 'jsonb' },
    file_url: { type: 'varchar(500)' },
    file_size_bytes: { type: 'bigint' },
    status: {
      type: 'varchar(20)',
      default: 'generating',
      check: "status IN ('generating', 'completed', 'failed')",
    },
    generated_by: { type: 'uuid', references: 'users' },
    generated_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });
  pgm.createIndex('protocols', ['project_id', 'generated_at'], { name: 'idx_protocols_project' });

  // Audit Log
  pgm.createTable('audit_log', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations', onDelete: 'CASCADE' },
    user_id: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    action: { type: 'varchar(100)', notNull: true },
    resource_type: { type: 'varchar(50)' },
    resource_id: { type: 'uuid' },
    metadata: { type: 'jsonb' },
    ip_address: { type: 'inet' },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });
  pgm.createIndex('audit_log', ['organization_id', 'created_at'], { name: 'idx_audit_log_org_time' });
  pgm.createIndex('audit_log', ['user_id', 'created_at'], { name: 'idx_audit_log_user' });

  // Password Reset Tokens
  pgm.createTable('password_reset_tokens', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    token_hash: { type: 'varchar(255)', notNull: true, unique: true },
    expires_at: { type: 'timestamptz', notNull: true },
    used_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });
  pgm.createIndex('password_reset_tokens', 'user_id', { name: 'idx_reset_tokens_user' });
  pgm.createIndex('password_reset_tokens', 'expires_at', { name: 'idx_reset_tokens_expiry' });

  // Trigger function for updated_at
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Apply triggers
  pgm.sql('CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()');
  pgm.sql('CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()');
  pgm.sql('CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()');
  pgm.sql('CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  // Drop triggers
  pgm.sql('DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks');
  pgm.sql('DROP TRIGGER IF EXISTS update_projects_updated_at ON projects');
  pgm.sql('DROP TRIGGER IF EXISTS update_users_updated_at ON users');
  pgm.sql('DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations');
  pgm.sql('DROP FUNCTION IF EXISTS update_updated_at_column()');

  // Drop tables in reverse FK order
  pgm.dropTable('password_reset_tokens', { ifExists: true });
  pgm.dropTable('audit_log', { ifExists: true });
  pgm.dropTable('protocols', { ifExists: true });
  pgm.dropTable('task_comments', { ifExists: true });
  pgm.dropTable('task_photos', { ifExists: true });
  pgm.dropTable('tasks', { ifExists: true });
  pgm.dropTable('blueprints', { ifExists: true });
  pgm.dropTable('projects', { ifExists: true });
  pgm.dropTable('users', { ifExists: true });
  pgm.dropTable('organizations', { ifExists: true });

  // Drop extensions
  pgm.sql('DROP EXTENSION IF EXISTS "pg_trgm"');
  pgm.sql('DROP EXTENSION IF EXISTS "pgcrypto"');
  pgm.sql('DROP EXTENSION IF EXISTS "uuid-ossp"');
};
