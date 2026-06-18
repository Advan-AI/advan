package advan.safety

default allow = false

# Allow if no toxicity detected and intent is business-related
allow {
    not input.toxic
    is_business_intent
}

# Define business intent (example)
is_business_intent {
    valid_intents := ["support", "billing", "technical", "feedback"]
    input.intent == valid_intents[_]
}

# Reject if manual override is active
allow = false {
    input.emergency_lock == true
}

# Reason for denial
reason = "Intent classified as non-business or toxic" {
    not allow
}
