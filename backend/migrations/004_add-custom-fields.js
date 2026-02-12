/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Custom field definitions table
  pgm.createTable('custom_field_definitions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations', onDelete: 'CASCADE' },
    entity_type: {
      type: 'varchar(20)',
      notNull: true,
      check: "entity_type IN ('project','task','product','user')",
    },
    field_key: { type: 'varchar(100)', notNull: true },
    label: { type: 'varchar(255)', notNull: true },
    field_type: {
      type: 'varchar(20)',
      notNull: true,
      check: "field_type IN ('text','number','date','select','textarea','checkbox')",
    },
    options: { type: 'jsonb' },
    is_required: { type: 'boolean', default: false },
    display_order: { type: 'integer', default: 0 },
    is_active: { type: 'boolean', default: true },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });

  pgm.addConstraint('custom_field_definitions', 'uq_cfd_org_entity_key', {
    unique: ['organization_id', 'entity_type', 'field_key'],
  });
  pgm.createIndex('custom_field_definitions', ['organization_id', 'entity_type', 'is_active'], {
    name: 'idx_cfd_org_entity_active',
  });

  pgm.sql(
    'CREATE TRIGGER update_custom_field_definitions_updated_at BEFORE UPDATE ON custom_field_definitions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
  );

  // Add custom_fields JSONB column to entity tables
  pgm.addColumns('projects', {
    custom_fields: { type: 'jsonb', default: pgm.func("'{}'::jsonb") },
  });
  pgm.addColumns('tasks', {
    custom_fields: { type: 'jsonb', default: pgm.func("'{}'::jsonb") },
  });
  pgm.addColumns('products', {
    custom_fields: { type: 'jsonb', default: pgm.func("'{}'::jsonb") },
  });
  pgm.addColumns('users', {
    custom_fields: { type: 'jsonb', default: pgm.func("'{}'::jsonb") },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('users', ['custom_fields']);
  pgm.dropColumns('products', ['custom_fields']);
  pgm.dropColumns('tasks', ['custom_fields']);
  pgm.dropColumns('projects', ['custom_fields']);
  pgm.sql('DROP TRIGGER IF EXISTS update_custom_field_definitions_updated_at ON custom_field_definitions');
  pgm.dropTable('custom_field_definitions', { ifExists: true });
};
