'use strict';

const express = require('express');
const { getTask, listTasks } = require('../../services/tasks');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ ok: true, tasks: listTasks() });
});

router.get('/:id', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ ok: false, error: 'Unknown or expired task' });
  res.json({ ok: true, task });
});

module.exports = router;
