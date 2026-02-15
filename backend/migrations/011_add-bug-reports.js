exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('bug_reports', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations', onDelete: 'CASCADE' },
    report_number: { type: 'integer', notNull: true },
    title: { type: 'varchar(500)', notNull: true },
    description: { type: 'text' },
    steps_to_reproduce: { type: 'text' },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'open',
    },
    priority: {
      type: 'varchar(20)',
      notNull: true,
      default: 'medium',
    },
    screenshot_url: { type: 'varchar(500)' },
    console_logs: { type: 'jsonb' },
    metadata: { type: 'jsonb' },
    reported_by: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    assigned_to: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    resolution_notes: { type: 'text' },
    resolved_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });

  pgm.addConstraint('bug_reports', 'chk_bug_reports_status', {
    check: "status IN ('open', 'in_progress', 'resolved', 'closed')",
  });

  pgm.addConstraint('bug_reports', 'chk_bug_reports_priority', {
    check: "priority IN ('low', 'medium', 'high', 'critical')",
  });

  pgm.createIndex('bug_reports', ['organization_id', 'report_number'], {
    name: 'idx_bug_reports_org_number',
    unique: true,
  });

  pgm.createIndex('bug_reports', ['organization_id', 'status'], {
    name: 'idx_bug_reports_org_status',
  });

  pgm.createIndex('bug_reports', ['organization_id', 'created_at'], {
    name: 'idx_bug_reports_org_created',
  });

  pgm.sql(
    `CREATE TRIGGER update_bug_reports_updated_at BEFORE UPDATE ON bug_reports
     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
  );
};

exports.down = (pgm) => {
  pgm.sql('DROP TRIGGER IF EXISTS update_bug_reports_updated_at ON bug_reports');
  pgm.dropTable('bug_reports', { ifExists: true });
};
