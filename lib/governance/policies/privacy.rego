package advan.privacy

default allow = true

# Reject if PII is detected and redact mode is off
allow = false {
    input.has_pii == true
    input.redact_mode == false
}

# Reason for denial
reason = "Unmasked PII detected in non-redacting session" {
    not allow
}
