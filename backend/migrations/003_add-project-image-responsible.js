/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('projects', {
    image_url: { type: 'varchar(500)', default: null },
    thumbnail_url: { type: 'varchar(500)', default: null },
    responsible_user_id: {
      type: 'uuid',
      default: null,
      references: 'users(id)',
      onDelete: 'SET NULL',
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('projects', ['image_url', 'thumbnail_url', 'responsible_user_id']);
};
