'use strict';

const express = require('express');
const { getTask, listTasks } = require('../../services/tasks');
const permissions = require('../../services/permissions');

const router = express.Router();

// A task's title names its server ("Backing up Alpha…"), so a server the user
// may not view is left out of the list and answers "unknown" by id.
router.get('/', (req, res) => {
  const visible = permissions.visibleServerIds(req.user);
  res.json({ ok: true, tasks: listTasks().filter((t) => !t.serverId || visible.has(t.serverId)) });
});

router.get('/:id', (req, res) => {
  const task = getTask(req.params.id);
  if (!task || (task.serverId && !permissions.can(req.user, task.serverId, 'view'))) {
    return res.status(404).json({ ok: false, error: 'Unknown or expired task' });
  }
  res.json({ ok: true, task });
});

module.exports = router;
