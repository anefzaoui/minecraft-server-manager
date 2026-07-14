'use strict';

// PUBLIC status pages (MP9). Mounted at /status BEFORE the auth middleware —
// everything rendered here must be safe for the open internet: no admin data,
// no panel links, only what the server owner opted to share.

const asyncHandler = require('../middleware/asyncHandler');
const express = require('express');
const serversService = require('../../services/servers');
const statusPage = require('../../integrations/statusPage');
const { serverVM } = require('../viewModels');

const router = express.Router();

router.get(
  '/:slug',
  asyncHandler(async (req, res, next) => {
    const serverId = statusPage.findBySlug(req.params.slug);
    const row = serverId ? serversService.getServer(serverId) : null;
    if (!row) {
      return res.status(404).render('status', { layout: 'bare', title: 'Not found', notFound: true });
    }

    // serverVM reads only the in-memory live cache — no Docker work per
    // request, so anonymous traffic cannot exhaust the daemon.
    const vm = await serverVM(row);
    res.render('status', {
      layout: 'bare',
      title: vm.name,
      page: {
        name: vm.name,
        icon: vm.icon,
        accent: vm.accent,
        motd: (row.env.MOTD || '').replace(/[§&][0-9a-fk-or]/gi, ''),
        flavor: vm.flavor,
        mcVersion: vm.mcVersion,
        status: vm.status,
        online: vm.players.online,
        max: vm.players.max,
        uptime: vm.stats.uptime,
      },
    });
  })
);

module.exports = router;
