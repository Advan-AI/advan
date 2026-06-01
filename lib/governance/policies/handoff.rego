package advan.handoff

# Default: AI handles everything
default human_required = false

# Escalate if confidence is low
human_required {
    input.confidence < 85
}

# Escalate if refund amount > $50
human_required {
    input.intent == "billing"
    input.amount > 50
}

# Reason for escalation
reason = "Low confidence or high-value billing transaction" {
    human_required
}
