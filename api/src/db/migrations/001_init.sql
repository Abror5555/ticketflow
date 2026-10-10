-- TicketFlow initial schema

CREATE TABLE agents (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(160) NOT NULL UNIQUE,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE tickets (
  id               SERIAL PRIMARY KEY,
  subject          VARCHAR(200) NOT NULL,
  description      TEXT         NOT NULL,
  requester_name   VARCHAR(120) NOT NULL,
  requester_email  VARCHAR(160) NOT NULL,
  priority         VARCHAR(10)  NOT NULL DEFAULT 'medium'
                   CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status           VARCHAR(30)  NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed')),
  assignee_id      INTEGER      REFERENCES agents(id),
  due_at           TIMESTAMPTZ  NOT NULL,
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  -- resolved_at is set exactly when the ticket is resolved or closed
  CONSTRAINT tickets_resolved_at_check CHECK (
    (status IN ('resolved', 'closed')) = (resolved_at IS NOT NULL)
  )
);

CREATE INDEX tickets_status_idx ON tickets (status);
CREATE INDEX tickets_assignee_idx ON tickets (assignee_id);
CREATE INDEX tickets_due_idx ON tickets (due_at);

CREATE TABLE ticket_comments (
  id           SERIAL PRIMARY KEY,
  ticket_id    INTEGER     NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_name  VARCHAR(120) NOT NULL,
  body         TEXT        NOT NULL,
  is_internal  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ticket_comments_ticket_idx ON ticket_comments (ticket_id, created_at);

-- Audit trail: every change of status, priority or assignee is recorded.
CREATE TABLE ticket_events (
  id          SERIAL PRIMARY KEY,
  ticket_id   INTEGER     NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  type        VARCHAR(30) NOT NULL
              CHECK (type IN ('created', 'status_changed', 'priority_changed', 'assigned')),
  from_value  VARCHAR(120),
  to_value    VARCHAR(120),
  actor       VARCHAR(120) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ticket_events_ticket_idx ON ticket_events (ticket_id, created_at);
