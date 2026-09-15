import { Router, type Response } from 'express';
import type Database from 'better-sqlite3';
import { toTodo } from '../db';

export function todosRouter(db: Database.Database) {
  const router = Router();
  const notFound = (res: Response, id: string) =>
    res.status(404).json({ error: `Todo with id ${id} was not found` });

  router.get('/', (_req, res) => {
    const rows = db.prepare('SELECT id, title, completed FROM todos ORDER BY id DESC').all() as Array<{ id: number; title: string; completed: number }>;
    res.json(rows.map(toTodo));
  });

  router.post('/', (req, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const result = db.prepare('INSERT INTO todos (title) VALUES (?)').run(title);
    res.status(201).json(toTodo(db.prepare('SELECT id, title, completed FROM todos WHERE id = ?').get(result.lastInsertRowid) as any));
  });

  router.patch('/:id', (req, res) => {
    const result = db.prepare('UPDATE todos SET completed = 1 - completed WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return notFound(res, req.params.id);
    res.json(toTodo(db.prepare('SELECT id, title, completed FROM todos WHERE id = ?').get(req.params.id) as any));
  });

  router.delete('/:id', (req, res) => {
    const result = db.prepare('DELETE FROM todos WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return notFound(res, req.params.id);
    res.status(204).send();
  });

  return router;
}
