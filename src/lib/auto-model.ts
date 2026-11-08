/**
 * "Auto" picks a model per message by how hard it looks: most turns go
 * to Haiku, work that needs more (documents, code, long inputs, files)
 * goes to Sonnet, and explicitly hard reasoning on paid plans to Opus.
 */

export const AUTO_MODEL_ID = 'clox/auto'

export const AUTO_TIERS = {
  fast: 'anthropic/claude-haiku-5.5',
  smart: 'anthropic/claude-sonnet-5.5',
  deep: 'anthropic/claude-opus-5.5',
} as const

const DOC_RE = /\b(deck|slides?|presentation|ppt|pptx|powerpoint|excel|xlsx|spreadsheet|workbook|word doc|docx|pdf|report|proposal|business plan|one[- ]pager|brochure)\b/i
const CODE_RE = /```|\b(function|class|component|refactor|debug|stack ?trace|typescript|python|javascript|sql|regex|api|bug|error:|exception)\b/i
const ANALYSIS_RE = /\b(analy[sz]e|analysis|compare|evaluate|critique|research|summari[sz]e (this|the|these)|step[- ]by[- ]step|plan (for|out)|strategy|financial model|forecast|rewrite|translate)\b/i
const DEEP_RE = /\b(think (hard|deeply|carefully)|ultrathink|rigorous(ly)?|prove|proof|in[- ]depth|deep dive|comprehensive|architecture|edge cases|trade-?offs)\b/i

export function pickAutoModel(input: {
  text: string
  hasFiles: boolean
  usedTools: boolean
  historyChars: number
  lowCostOnly: boolean
}): string {
  if (input.lowCostOnly) return AUTO_TIERS.fast
  const t = input.text
  if (DEEP_RE.test(t) && (t.length > 400 || input.historyChars > 20_000)) return AUTO_TIERS.deep
  if (
    input.hasFiles ||
    input.usedTools ||
    DOC_RE.test(t) ||
    CODE_RE.test(t) ||
    ANALYSIS_RE.test(t) ||
    t.length > 1200 ||
    input.historyChars > 40_000
  ) {
    return AUTO_TIERS.smart
  }
  return AUTO_TIERS.fast
}
