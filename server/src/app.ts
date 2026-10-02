import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createDatabase } from './db/database.js';
import { initializeSchema } from './db/schema.js';
import { seedDatabase } from './db/seed.js';
import { FlagRepository } from './repositories/flag.repository.js';
import { EvaluationEngine } from './services/evaluation-engine.js';
import { FlagService } from './services/flag.service.js';
import { FlagController } from './controllers/flag.controller.js';
import { createApiRouter } from './routes/api.routes.js';

export interface AppContext {
  app: Express;
  db: DatabaseSync;
  repo: FlagRepository;
  engine: EvaluationEngine;
  service: FlagService;
  controller: FlagController;
}

export function createApp(dbPath?: string, shouldSeed = true): AppContext {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const db = createDatabase(dbPath);
  initializeSchema(db);
  if (shouldSeed) {
    seedDatabase(db);
  }

  const repo = new FlagRepository(db);
  const engine = new EvaluationEngine();
  const service = new FlagService(repo, engine);
  const controller = new FlagController(service);

  // Mount API
  app.use('/api', createApiRouter(controller));
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ success: false, code: 'NOT_FOUND', error: 'Route not found' });
  });

  // Serve client bundle in production
  const candidateDistPaths = [
    path.resolve(process.cwd(), 'client/dist'),
    path.resolve(process.cwd(), '../client/dist'),
  ];
  const clientDist = candidateDistPaths.find((p) => fs.existsSync(p));
  if (clientDist) {
    app.use(express.static(clientDist));
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // Global error handler
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
      res.status(400).json({ success: false, code: 'INVALID_JSON', error: 'Malformed JSON body' });
      return;
    }

    console.error('Unhandled server error:', err);
    res.status(500).json({ success: false, code: 'INTERNAL_ERROR', error: 'Internal Server Error' });
  });

  return {
    app,
    db,
    repo,
    engine,
    service,
    controller,
  };
}
