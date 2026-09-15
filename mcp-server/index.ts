import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const projectRoot = path.resolve(process.env.TODO_AGENT_ROOT ?? process.cwd());
const appSrc = path.join(projectRoot, 'app', 'src');
const databasePath = path.join(projectRoot, 'app', 'data', 'todos.sqlite');
const server = new McpServer({ name: 'todo-agent-loop', version: '1.0.0' });

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(file));
    else if (/\.(ts|js|html|css)$/.test(entry.name)) files.push(file);
  }
  return files;
}

function safeAppSourcePath(input: string): string {
  const resolved = path.resolve(appSrc, input);
  if (resolved !== appSrc && !resolved.startsWith(`${appSrc}${path.sep}`)) throw new Error('Path must be under app/src');
  return resolved;
}

function text(value: unknown) {
  return { content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] };
}

server.registerTool('list_routes', {
  description: 'List Express API routes in app/src, including handler file and line.',
}, async () => {
  const routes: Array<{ method: string; path: string; file: string; line: number }> = [];
  for (const file of await sourceFiles(appSrc)) {
    const lines = (await readFile(file, 'utf8')).split('\n');
    lines.forEach((line, index) => {
      const match = line.match(/(?:router|app)\.(get|post|patch|put|delete)\s*\(\s*['"`]([^'"`]+)['"`]/i);
      if (match) {
        const prefix = file.endsWith(`${path.sep}routes${path.sep}todos.ts`) ? '/todos' : '';
        routes.push({ method: match[1].toUpperCase(), path: `${prefix}${match[2] === '/' ? '' : match[2]}`, file: path.relative(projectRoot, file), line: index + 1 });
      }
    });
  }
  return text(routes);
});

server.registerTool('get_file', {
  description: 'Return source content for a file under app/src.',
  inputSchema: { path: z.string().describe('Relative path under app/src, such as routes/todos.ts') },
}, async ({ path: filePath }) => text(await readFile(safeAppSourcePath(filePath), 'utf8')));

server.registerTool('explain_symbol', {
  description: 'Find a function or const by name in app/src and return its source with a short explanation.',
  inputSchema: { name: z.string().min(1).describe('Function or const name') },
}, async ({ name }) => {
  for (const file of await sourceFiles(appSrc)) {
    const lines = (await readFile(file, 'utf8')).split('\n');
    const start = lines.findIndex(line => new RegExp(`(?:function|const|let|var)\\s+${name}\\b`).test(line));
    if (start < 0) continue;
    let end = start;
    let braces = 0;
    for (; end < lines.length; end++) {
      braces += (lines[end].match(/{/g) ?? []).length - (lines[end].match(/}/g) ?? []).length;
      if (end > start && braces <= 0) break;
    }
    const source = lines.slice(start, end + 1).join('\n');
    return text({ name, file: path.relative(projectRoot, file), line: start + 1, source, explanation: `This symbol is defined in ${path.relative(projectRoot, file)} and encapsulates the behavior shown in its source.` });
  }
  throw new Error(`Symbol not found: ${name}`);
});

server.registerTool('get_db_schema', {
  description: 'Return the SQLite schema for the todos table.',
}, async () => {
  const db = new Database(databasePath, { readonly: true, fileMustExist: false });
  try {
    return text(db.prepare("SELECT name, type, sql FROM sqlite_master WHERE type = 'table' AND name = 'todos'").all());
  } finally { db.close(); }
});

server.registerTool('query_todos', {
  description: 'Run a read-only SELECT query against the todos table.',
  inputSchema: { sql: z.string().min(1).describe('A single SELECT statement against todos') },
}, async ({ sql }) => {
  const normalized = sql.trim();
  if (!/^SELECT\b/i.test(normalized) || /;\s*\S/.test(normalized) || !/\bFROM\s+todos\b/i.test(normalized)) throw new Error('Only a single SELECT query from the todos table is allowed');
  const db = new Database(databasePath, { readonly: true, fileMustExist: false });
  try { return text(db.prepare(normalized).all()); } finally { db.close(); }
});

await server.connect(new StdioServerTransport());
