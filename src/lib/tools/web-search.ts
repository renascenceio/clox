/**
 * `web_search` tool — server-side, callable by the model via the AI SDK 4
 * `tool()` API. Backed by Tavily (https://tavily.com), which has a small
 * free tier and a stable JSON contract that doesn't require the model to
 * scrape HTML or rotate headers.
 *
 * Why Tavily instead of building a scraper:
 *   - We need RESULTS, not raw HTML — Tavily already chunks and dedupes
 *     across multiple search engines, returns clean snippets, and tags
 *     the score so the model can rank.
 *   - DDG / Bing scraping is fragile (rate limits, captchas, layout
 *     drift) and would need a 200-line workaround for every change.
 *   - The free tier comfortably covers an exploratory chat workload;
 *     anyone running this in production should pay for a real plan.
 *
 * Contract:
 *   The model calls `web_search({ query, max_results })`. We return a
 *   small JSON envelope:
 *     {
 *       results: [{ title, url, snippet, score }],
 *       answer:  "Tavily's quick-look summary",
 *     }
 *   Errors come back as `{ error: "..."}` so the model can decide
 *   whether to retry, ask the user, or carry on with caveats. We
 *   never throw — throwing inside `tool.execute` aborts the whole
 *   stream and looks worse than a graceful "search unavailable".
 *
 * Configuration:
 *   Reads `TAVILY_API_KEY` from the env. If unset, we return a clear
 *   error so the model can tell the user "web search isn't configured"
 *   rather than producing a hallucinated answer claiming to have
 *   browsed the web.
 */

import { tool } from 'ai'
import { z } from 'zod'

interface TavilyResult {
  title?: string
  url?: string
  content?: string
  score?: number
}
interface TavilyResponse {
  results?: TavilyResult[]
  answer?: string
}

export const webSearchTool = tool({
  description: [
    'Search the live web for current information. Use this when the user asks',
    'about recent events, today\'s date-sensitive facts (weather, news, prices,',
    'sports scores), or any URL / domain you don\'t already know about. Do NOT',
    'use this for general knowledge that hasn\'t changed in years — it costs the',
    'user money and adds latency. ALWAYS cite the result urls in your answer',
    'using inline markdown links so the user can verify.',
  ].join(' '),
  parameters: z.object({
    query: z.string().min(1).describe('The natural-language search query.'),
    max_results: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe('How many top results to return. Default 5; cap 10.'),
  }),
  // The execute function runs server-side once the model emits a tool
  // call. The return value is sent back to the model as a tool result
  // and shows up in the transcript via the `toolInvocations` array on
  // the assistant message.
  execute: async ({ query, max_results = 5 }) => {
    const apiKey = process.env.TAVILY_API_KEY
    if (!apiKey) {
      return {
        error:
          'web_search is not configured: the operator needs to set the ' +
          'TAVILY_API_KEY environment variable. Tell the user the tool is ' +
          'unavailable rather than guessing the answer.',
      }
    }
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results,
          search_depth: 'basic',
          include_answer: true,
          include_raw_content: false,
        }),
        // Tavily's median is sub-second; cap at 10s so a slow upstream
        // doesn't lock up the chat stream.
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        return { error: `Tavily ${res.status}: ${detail.slice(0, 200)}` }
      }
      const data = (await res.json()) as TavilyResponse
      const results = (data.results ?? []).slice(0, max_results).map(r => ({
        title:   r.title   ?? '',
        url:     r.url     ?? '',
        snippet: r.content ?? '',
        score:   typeof r.score === 'number' ? Number(r.score.toFixed(3)) : undefined,
      }))
      return { results, answer: data.answer ?? null }
    } catch (e) {
      return { error: `web_search failed: ${(e as Error).message}` }
    }
  },
})
