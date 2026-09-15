import express from 'express';
import path from 'node:path';
import { createDatabase } from './db';
import { todosRouter } from './routes/todos';

export function createApp(db = createDatabase(path.resolve(__dirname, '../data/todos.sqlite'))) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.resolve(__dirname, 'public')));
  app.use('/todos', todosRouter(db));
  return app;
}

if (require.main === module) {
  const app = createApp();
  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => console.log(`Todo app listening on http://localhost:${port}`));
}
