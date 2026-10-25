ALTER TABLE account_invitations
  ADD COLUMN closed_at timestamptz;

ALTER TABLE account_invitations
  ADD COLUMN closed_reason text;

ALTER TABLE account_invitations
  ADD CONSTRAINT account_invitations_closed_reason_valid
  CHECK (
    (closed_at IS NULL AND closed_reason IS NULL)
    OR (closed_at IS NOT NULL AND closed_reason IN ('expired', 'revoked'))
  );

DROP INDEX account_invitations_email_pending_idx;
DROP INDEX account_invitations_one_pending_per_role_school;

CREATE INDEX account_invitations_email_pending_idx
  ON account_invitations (lower(email), expires_at)
  WHERE consumed_at IS NULL AND closed_at IS NULL;

CREATE UNIQUE INDEX account_invitations_one_pending_per_role_school
  ON account_invitations (lower(email), role, school_id)
  WHERE consumed_at IS NULL AND closed_at IS NULL;
