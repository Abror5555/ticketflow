const express = require('express');
const { validate, asyncHandler } = require('../../lib/validate');
const service = require('./tickets.service');
const s = require('./tickets.schemas');

const router = express.Router();

router.get(
  '/',
  validate(s.listTicketsQuerySchema, 'query'),
  asyncHandler(async (req, res) => res.json(await service.listTickets(req.query))),
);

router.post(
  '/',
  validate(s.createTicketSchema),
  asyncHandler(async (req, res) => res.status(201).json(await service.createTicket(req.body))),
);

router.get(
  '/:id',
  validate(s.idParamSchema, 'params'),
  asyncHandler(async (req, res) => res.json(await service.getTicketDetails(req.params.id))),
);

router.patch(
  '/:id',
  validate(s.idParamSchema, 'params'),
  validate(s.updateTicketSchema),
  asyncHandler(async (req, res) => res.json(await service.updateTicket(req.params.id, req.body))),
);

router.post(
  '/:id/status',
  validate(s.idParamSchema, 'params'),
  validate(s.changeStatusSchema),
  asyncHandler(async (req, res) => res.json(await service.changeStatus(req.params.id, req.body))),
);

router.post(
  '/:id/comments',
  validate(s.idParamSchema, 'params'),
  validate(s.addCommentSchema),
  asyncHandler(async (req, res) => res.status(201).json(await service.addComment(req.params.id, req.body))),
);

module.exports = router;
