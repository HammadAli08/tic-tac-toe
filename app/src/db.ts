import Database from 'better-sqlite3';

export type Todo = { id: number; title: string; completed: boolean };

export function createDatabase(filename = process.env.TODO_DB_PATH ?? 'data/todos.sqlite') {
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0
    )
  `);
  return db;
}

export function toTodo(row: { id: number; title: string; completed: number }): Todo {
  return { id: row.id, title: row.title, completed: Boolean(row.completed) };
}
