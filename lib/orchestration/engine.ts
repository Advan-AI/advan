import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { createAnthropicModel, getLlmRuntimeConfig } from '@/lib/llm/config';
import { createOllamaChatOpenAI } from '@/lib/llm/ollama-openai';
import { PIIMasker } from '@/lib/governance/pii-masker';
import { PolicyClient } from '@/lib/governance/policy-client';

/**
 * Advan AI Orchestration Engine (Layer 4)
 * Implements a Hierarchical Supervisor-Worker pattern using LangGraph.
 */

// 1. Define the State
const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  next: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => 'supervisor',
  }),
  instructions: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
  citations: Annotation<string[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
});

// 2. Chat model — Anthropic Sonnet (legacy) or local Ollama (OpenAI-compatible /v1)
const getModel = () => {
  const cfg = getLlmRuntimeConfig();
  if (cfg.chatProvider === 'anthropic' || cfg.chatProvider === 'vertex-anthropic') {
    return createAnthropicModel(cfg, 'claude-3-5-sonnet-20240620', 0);
  }
  return createOllamaChatOpenAI(cfg, cfg.ollamaChatModel);
};

// 3. Define the Supervisor Node
const supervisorNode = async (state: typeof AgentState.State) => {
  // Governance Check: Safety Policy
  const safetyCheck = await PolicyClient.evaluate('advan/system/intent', {
    messages: state.messages,
  });

  if (!safetyCheck.allow) {
    return {
      messages: [new AIMessage(`Policy Violation: ${safetyCheck.reason}`)],
      next: 'end',
    };
  }

  // Supervisor Logic: Determine the next worker or finish
  const lastMessage = state.messages[state.messages.length - 1]?.content;
  if (lastMessage?.toString().toLowerCase().includes('finish')) {
    return { next: 'end' };
  }

  return { next: 'worker' };
};

// 4. Define the Worker Node
const workerNode = async (state: typeof AgentState.State) => {
  // Data Safety: Mask PII before processing
  const lastMsg = state.messages[state.messages.length - 1];
  const maskedContent = PIIMasker.mask(lastMsg?.content?.toString() || '');

  const model = getModel();
  const response = await model.invoke([
    { role: 'system', content: 'You are an Advan AI Specialist Worker.' },
    new HumanMessage(maskedContent),
  ]);

  return {
    messages: [response],
    next: 'supervisor', 
  };
};

// 5. Construct the Graph
const workflow = new StateGraph(AgentState)
  .addNode('supervisor', supervisorNode)
  .addNode('worker', workerNode)
  .addEdge(START, 'supervisor')
  .addConditionalEdges('supervisor', (state) => state.next === 'end' ? END : 'worker')
  .addEdge('worker', 'supervisor');

export const orchestrationEngine = workflow.compile();
