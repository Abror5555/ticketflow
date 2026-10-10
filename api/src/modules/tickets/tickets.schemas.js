const { z } = require('zod');
const { PRIORITIES, STATUSES } = require('./ticket.rules');

const actor = z.string().trim().min(1).max(120).default('Support agent');

const createTicketSchema = z.object({
  subject: z.string().trim().min(5, 'Subject must be at least 5 characters').max(200),
  description: z.string().trim().min(10, 'Please describe the problem (at least 10 characters)').max(5000),
  requesterName: z.string().trim().min(2, 'Name is too short').max(120),
  requesterEmail: z.string().trim().toLowerCase().email('Invalid email address'),
  priority: z.enum(PRIORITIES).default('medium'),
  actor,
});

const updateTicketSchema = z
  .object({
    priority: z.enum(PRIORITIES).optional(),
    // null = unassign
    assigneeId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
    actor,
  })
  .refine((v) => v.priority !== undefined || v.assigneeId !== undefined, {
    message: 'Nothing to update: send priority and/or assigneeId',
    path: ['priority'],
  });

const changeStatusSchema = z.object({
  status: z.enum(STATUSES),
  actor,
});

const addCommentSchema = z.object({
  authorName: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1, 'Comment cannot be empty').max(5000),
  isInternal: z.boolean().default(false),
});

const listTicketsQuerySchema = z.object({
  status: z.enum([...STATUSES, 'active']).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assigneeId: z.union([z.literal('unassigned'), z.coerce.number().int().positive()]).optional(),
  overdue: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(['newest', 'due', 'priority']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

module.exports = {
  createTicketSchema,
  updateTicketSchema,
  changeStatusSchema,
  addCommentSchema,
  listTicketsQuerySchema,
  idParamSchema,
};
