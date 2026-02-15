/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('tasks', {
    annotation_markers: { type: 'jsonb' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('tasks', ['annotation_markers']);
};
