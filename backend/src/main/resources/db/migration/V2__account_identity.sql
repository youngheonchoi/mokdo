-- External login identities linked to an internal MOKDO account.

CREATE TABLE account_identity (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL,
    provider VARCHAR(32) NOT NULL,
    provider_subject VARCHAR(255) NOT NULL,
    email TEXT,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_account_identity_account
        FOREIGN KEY (account_id)
        REFERENCES account (id)
        ON DELETE CASCADE,
    CONSTRAINT uq_account_identity_provider_subject
        UNIQUE (provider, provider_subject),
    CONSTRAINT uq_account_identity_account_provider
        UNIQUE (account_id, provider),
    CONSTRAINT chk_account_identity_provider
        CHECK (provider = UPPER(BTRIM(provider)) AND provider <> '')
);

COMMENT ON TABLE account_identity IS
    'External login identities linked to an internal MOKDO account';
COMMENT ON COLUMN account_identity.provider_subject IS
    'Stable subject identifier from the verified provider token; do not use email as the identifier';

