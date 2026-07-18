from anthropic import AnthropicVertex

client = AnthropicVertex(region="us-east1", project_id="arslantoor")
message = client.messages.create(
 max_tokens=1024,
 messages=[{"role": "user", "content": "Hello! Can you help me?"}],
 model="claude-opus-4-7"
)
print(message.content[0].text)