// ============================================================
// Synth MVP — Anthropic API Client
// ============================================================
// All LLM calls happen server-side only. The API key is never
// exposed to the client. The LLM receives precomputed heuristic
// numbers and interprets them — it never does arithmetic.
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import { MergedDataset, SynthInsight } from '../types';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 2048;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set.');
  }

  client = new Anthropic({ apiKey });
  return client;
}

/**
 * Generate a synthesized insight from merged training + health data.
 * Sends precomputed heuristics to the LLM for interpretation.
 */
export async function generateInsight(
  mergedData: MergedDataset
): Promise<SynthInsight> {
  const anthropic = getClient();
  const userPrompt = buildUserPrompt(mergedData);

  console.log('[LLM] Sending request to Anthropic...');

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  });

  // Extract text content from the response
  const textBlock = message.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text content in Anthropic response');
  }

  const rawText = textBlock.text.trim();

  // Try to parse as JSON (the prompt asks for JSON output)
  let parsed: {
    text?: string;
    keyFindings?: string[];
    score?: number;
    recommendations?: string[];
    citedMetrics?: string[];
  };

  try {
    // Handle potential markdown code fence around JSON
    const jsonStr = rawText.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '');
    parsed = JSON.parse(jsonStr);
  } catch {
    // If JSON parsing fails, treat the entire response as the insight text
    console.warn('[LLM] Response was not valid JSON, using as raw text insight.');
    parsed = {
      text: rawText,
      keyFindings: [],
      score: 50,
      recommendations: [],
      citedMetrics: [],
    };
  }

  const insight: SynthInsight = {
    text: parsed.text || rawText,
    keyFindings: parsed.keyFindings || [],
    score: typeof parsed.score === 'number' ? Math.min(100, Math.max(1, parsed.score)) : 50,
    recommendations: parsed.recommendations || [],
    citedMetrics: parsed.citedMetrics || [],
    generatedAt: new Date().toISOString(),
  };

  console.log(`[LLM] Insight generated. Score: ${insight.score}/100, ${insight.keyFindings.length} findings.`);

  return insight;
}
