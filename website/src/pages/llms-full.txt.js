// The documentation, FAQ and latest release notes in one Markdown file: see src/lib/llms.js.
import { llmsFullTxt } from '../lib/llms.js';

export function GET() {
  return new Response(llmsFullTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
