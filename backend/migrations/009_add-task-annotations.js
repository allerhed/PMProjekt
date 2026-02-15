/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('tasks', {
    annotation_x: { type: 'real' },
    annotation_y: { type: 'real' },
    annotation_width: { type: 'real' },
    annotation_height: { type: 'real' },
    annotation_page: { type: 'integer' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('tasks', [
    'annotation_x',
    'annotation_y',
    'annotation_width',
    'annotation_height',
    'annotation_page',
  ]);
};
