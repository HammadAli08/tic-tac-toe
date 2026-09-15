import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../src/server';

let db: Database.Database;
let app: ReturnType<typeof createApp>;
beforeEach(() => { db = new Database(':memory:'); app = createApp(db); });
afterEach(() => db.close());

describe('todos API', () => {
  it('GET /todos returns todos', async () => expect((await request(app).get('/todos')).status).toBe(200));
  it('POST /todos adds a todo', async () => { const response = await request(app).post('/todos').send({ title: 'Write tests' }); expect(response.status).toBe(201); expect(response.body.title).toBe('Write tests'); });
  it('PATCH /todos/:id toggles completion', async () => { const created = await request(app).post('/todos').send({ title: 'Toggle me' }); const response = await request(app).patch(`/todos/${created.body.id}`); expect(response.status).toBe(200); expect(response.body.completed).toBe(true); });
  it('DELETE /todos/:id deletes a todo', async () => { const created = await request(app).post('/todos').send({ title: 'Delete me' }); expect((await request(app).delete(`/todos/${created.body.id}`)).status).toBe(204); });
  it('returns 404 with a clear error for an unknown id', async () => {
    const toggleResponse = await request(app).patch('/todos/999');
    const deleteResponse = await request(app).delete('/todos/999');
    expect(toggleResponse.status).toBe(404);
    expect(toggleResponse.body).toEqual({ error: 'Todo with id 999 was not found', code: 'TODO_NOT_FOUND' });
    expect(deleteResponse.status).toBe(404);
    expect(deleteResponse.body).toEqual({ error: 'Todo with id 999 was not found', code: 'TODO_NOT_FOUND' });
  });
});
