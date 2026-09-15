import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Finding = { category: string; priority: 'high' | 'medium' | 'low'; file: string; detail: string };
type Summary = { summary: string; findings: Array<{ priority: string; category: string; detail: string; file?: string }> };

async function main() {
const root = path.resolve('app');
const output = process.env.DISCOVERY_OUTPUT ?? 'automation/discovery-report.md';
const apiKey = process.env.OPENAI_API_KEY;

async function filesIn(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'data') continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(file));
    else if (/\.(ts|js|html|css)$/.test(entry.name)) files.push(file);
  }
  return files;
}

const files = await filesIn(root);
const contents = new Map<string, string>();
for (const file of files) contents.set(file, await readFile(file, 'utf8'));
const sourceFiles = files.filter(file => file.includes(`${path.sep}src${path.sep}`));
const testText = files.filter(file => file.includes(`${path.sep}tests${path.sep}`)).map(file => contents.get(file) ?? '').join('\n');
const findings: Finding[] = [];

for (const [file, text] of contents) {
  for (const line of text.split('\n')) {
    const match = line.match(/(?:\/\/|\/\*|\*)\s*(TODO|FIXME)\b:?\s*(.*)/);
    if (match) findings.push({ category: `${match[1]} comment`, priority: 'low', file: path.relative('.', file), detail: match[2].trim() || 'Comment needs follow-up.' });
  }
}

const exported = sourceFiles.flatMap(file => [...(contents.get(file) ?? '').matchAll(/export\s+(?:function|class|const|let|type|interface)\s+(\w+)/g)].map(match => ({ file, name: match[1] })));
for (const item of exported) {
  const usedElsewhere = [...contents.entries()].some(([file, text]) => file !== item.file && new RegExp(`\\b${item.name}\\b`).test(text));
  if (!usedElsewhere) findings.push({ category: 'Unused export/dead code', priority: 'low', file: path.relative('.', item.file), detail: `Exported symbol ${item.name} is not referenced by another app file.` });
}

const routeText = sourceFiles.filter(file => file.includes(`${path.sep}routes${path.sep}`)).map(file => contents.get(file) ?? '').join('\n');
for (const method of ['get', 'post', 'patch', 'delete']) {
  if (new RegExp(`router\\.${method}\\s*\\(`, 'i').test(routeText) && !new RegExp(`\\.${method}\\s*\\(`, 'i').test(testText)) {
    findings.push({ category: 'Route without corresponding test', priority: 'medium', file: 'app/tests', detail: `The ${method.toUpperCase()} route has no matching test call.` });
  }
}

for (const file of sourceFiles.filter(file => file.endsWith('.ts'))) {
  const text = contents.get(file) ?? '';
  if (text.includes('router.') && !text.includes('try {')) findings.push({ category: 'Missing error handling', priority: 'medium', file: path.relative('.', file), detail: 'Route handlers perform database or request work without an explicit try/catch or error middleware path.' });
}

let summary: Summary;
if (apiKey) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini', temperature: 0, response_format: { type: 'json_object' }, messages: [
      { role: 'system', content: 'Summarize code-discovery findings. Return JSON with summary (short string) and findings (array of priority, category, detail, and optional file). Preserve real findings; prioritize actionable issues.' },
      { role: 'user', content: JSON.stringify(findings) },
    ] }),
  });
  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  summary = JSON.parse(payload.choices?.[0]?.message?.content ?? '{}') as Summary;
} else {
  summary = { summary: 'Static discovery completed. LLM prioritization was skipped because OPENAI_API_KEY was not set.', findings };
}

const lines = [`# Discovery Report`, '', `Generated: ${new Date().toISOString()}`, '', `## Summary`, '', summary.summary, '', `## Findings`, ''];
if (!summary.findings?.length) lines.push('No findings.', '');
else for (const finding of summary.findings) lines.push(`- **${finding.priority.toUpperCase()} — ${finding.category}**${finding.file ? ` (${finding.file})` : ''}: ${finding.detail}`);
await writeFile(output, `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
