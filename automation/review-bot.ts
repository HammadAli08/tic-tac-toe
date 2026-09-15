import { readFile, writeFile } from 'node:fs/promises';

type Verdict = 'approve' | 'request_changes';
type Review = { verdict: Verdict; comments: string[] };

const diffFile = process.env.PR_DIFF_FILE ?? 'pr.diff';
const outputFile = process.env.REVIEW_OUTPUT_FILE ?? 'review.json';
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) throw new Error('OPENAI_API_KEY is required');

const diff = await readFile(diffFile, 'utf8');
if (!diff.trim()) throw new Error('The pull request diff is empty');

const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You are a careful code reviewer. Review only the supplied pull request diff. Return JSON with exactly: verdict (approve or request_changes) and comments (an array of short strings). Use request_changes for any real bug, missing important test, or obvious issue; otherwise approve with an empty comments array.',
      },
      { role: 'user', content: `Review this pull request diff for bugs, missing tests, and obvious issues:\n\n${diff}` },
    ],
  }),
});

if (!response.ok) throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`);
const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
const content = payload.choices?.[0]?.message?.content;
if (!content) throw new Error('OpenAI returned no review content');

let parsed: unknown;
try { parsed = JSON.parse(content); } catch { throw new Error('OpenAI returned invalid JSON'); }
const review = parsed as Partial<Review>;
if ((review.verdict !== 'approve' && review.verdict !== 'request_changes') || !Array.isArray(review.comments) || review.comments.some(comment => typeof comment !== 'string')) {
  throw new Error('Review JSON did not match the required schema');
}

await writeFile(outputFile, JSON.stringify({ verdict: review.verdict, comments: review.comments }, null, 2));
