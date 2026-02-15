exports.up = (pgm) => {
  pgm.addColumn('organizations', {
    logo_thumbnail_url: { type: 'varchar(500)', notNull: false },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('organizations', 'logo_thumbnail_url');
};
