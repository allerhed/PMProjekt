/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('project_notes', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    project_id: { type: 'uuid', notNull: true, references: 'projects', onDelete: 'CASCADE' },
    content: { type: 'text', notNull: true, default: '' },
    created_by: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });

  pgm.createIndex('project_notes', ['project_id'], {
    name: 'idx_project_notes_project',
  });

  pgm.createTrigger('project_notes', 'update_project_notes_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    level: 'ROW',
    function: 'update_updated_at_column',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('project_notes', { ifExists: true });
};
