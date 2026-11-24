-- Internal MOKDO player account for the first-login flow.

CREATE TABLE account (
    id UUID PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    intro_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_account_status
        CHECK (status IN ('ACTIVE', 'BAN', 'DELETED'))
);

COMMENT ON TABLE account IS 'Internal MOKDO player account';
COMMENT ON COLUMN account.intro_completed_at IS
    'Timestamp when the account completed the first-time story comic';

