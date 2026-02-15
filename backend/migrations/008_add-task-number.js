/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn('tasks', {
    task_number: { type: 'integer' },
  });

  // Backfill existing tasks with sequential numbers per project
  pgm.sql(`
    WITH numbered AS (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at) AS rn
      FROM tasks
    )
    UPDATE tasks SET task_number = numbered.rn
    FROM numbered WHERE tasks.id = numbered.id
  `);
};

exports.down = (pgm) => {
  pgm.dropColumn('tasks', 'task_number');
};
