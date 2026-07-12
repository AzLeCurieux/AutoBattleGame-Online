import { OpenManySchema, RunActionSchema, toPublic, type AdminStats } from '@autobattle/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppContext } from '../app.js';
import { HttpError, parse, requireUser } from '../http.js';

export function gameRoutes(app: FastifyInstance, { runs, inventory, leaderboard, users, monitoring, notify }: AppContext) {
  app.get('/api/run', async (req) => toPublic(runs.get(requireUser(req))));

  app.post('/api/run/action', async (req) => {
    const userId = requireUser(req);
    const action = parse(RunActionSchema, req.body);
    const outcome = runs.act(userId, action);
    notify.run(userId);
    if (outcome.casesGranted > 0) notify.inventory(userId);
    notify.leaderboard();
    return { state: toPublic(outcome.state), fight: outcome.fight ?? null, newBest: outcome.newBest, palierUnlocked: outcome.palierUnlocked ?? null };
  });

  app.get('/api/inventory', async (req) => inventory.get(requireUser(req)));

  app.post('/api/cases/:id/open', async (req) => {
    const userId = requireUser(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const opening = inventory.open(userId, id);
    notify.inventory(userId);
    return opening;
  });

  app.post('/api/cases/open-many', async (req) => {
    const userId = requireUser(req);
    const { caseId, count } = parse(OpenManySchema, req.body);
    const openings = inventory.openMany(userId, caseId, count);
    notify.inventory(userId);
    return openings;
  });

  app.post('/api/cases/open-all', async (req) => {
    const userId = requireUser(req);
    const openings = inventory.openAll(userId);
    notify.inventory(userId);
    return openings;
  });

  app.get('/api/leaderboard', async (req) => {
    requireUser(req);
    return leaderboard.snapshot();
  });

  app.get('/api/admin/stats', async (req): Promise<AdminStats> => {
    const user = users.findById(requireUser(req));
    if (user?.role !== 'admin') throw new HttpError(403, 'FORBIDDEN', 'Réservé aux administrateurs');
    return monitoring.stats();
  });
}
