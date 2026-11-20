// https://llmstxt.org: see src/lib/llms.js.
import { llmsTxt } from '../lib/llms.js';

export function GET() {
  return new Response(llmsTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
