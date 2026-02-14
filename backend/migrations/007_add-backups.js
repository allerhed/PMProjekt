/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('backups', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'in_progress',
      check: "status IN ('in_progress', 'completed', 'failed')",
    },
    file_key: { type: 'varchar(500)' },
    file_size_bytes: { type: 'bigint' },
    error_message: { type: 'text' },
    triggered_by: {
      type: 'varchar(20)',
      notNull: true,
      default: 'manual',
      check: "triggered_by IN ('manual', 'scheduled')",
    },
    initiated_by: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    completed_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });

  pgm.createIndex('backups', ['organization_id', 'created_at'], {
    name: 'idx_backups_org_created',
  });

  pgm.createTrigger('backups', 'update_backups_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    level: 'ROW',
    function: 'update_updated_at_column',
  });

  pgm.createTable('backup_settings', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, unique: true, references: 'organizations', onDelete: 'CASCADE' },
    schedule_enabled: { type: 'boolean', default: false },
    schedule_cron: { type: 'varchar(100)', default: "'0 3 * * *'" },
    retention_days: { type: 'integer', default: 30 },
    updated_by: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });

  pgm.createTrigger('backup_settings', 'update_backup_settings_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    level: 'ROW',
    function: 'update_updated_at_column',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('backup_settings', { ifExists: true });
  pgm.dropTable('backups', { ifExists: true });
};
