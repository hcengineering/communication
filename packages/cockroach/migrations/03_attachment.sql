CREATE TABLE IF NOT EXISTS communication.attachment
(
    message_id INT8         NOT NULL,
    card_id    VARCHAR(255) NOT NULL,
    creator    VARCHAR(255) NOT NULL,
    created    TIMESTAMPTZ  NOT NULL DEFAULT now(),

    PRIMARY KEY (message_id, card_id)
);

CREATE INDEX IF NOT EXISTS attachment_message_idx ON communication.attachment (message_id);
