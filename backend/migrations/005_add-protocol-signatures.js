/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('protocol_signatures', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    protocol_id: { type: 'uuid', notNull: true, references: 'protocols', onDelete: 'CASCADE' },
    token: { type: 'varchar(64)', notNull: true, unique: true },
    token_hash: { type: 'varchar(128)', notNull: true },
    expires_at: { type: 'timestamptz', notNull: true },
    signer_name: { type: 'varchar(255)' },
    signer_email: { type: 'varchar(255)' },
    signature_data: { type: 'text' },
    signed_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });

  pgm.createIndex('protocol_signatures', ['protocol_id'], {
    name: 'idx_protocol_signatures_protocol',
  });
  pgm.createIndex('protocol_signatures', ['token_hash'], {
    name: 'idx_protocol_signatures_token_hash',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('protocol_signatures', { ifExists: true });
};
