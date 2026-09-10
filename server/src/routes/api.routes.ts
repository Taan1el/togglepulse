import { Router } from 'express';
import { FlagController } from '../controllers/flag.controller.js';

export function createApiRouter(controller: FlagController): Router {
  const router = Router();

  router.get('/health', controller.health);
  router.get('/flags', controller.listFlags);
  router.post('/flags', controller.createFlag);
  router.get('/flags/:key', controller.getFlag);
  router.patch('/flags/:key/rollout', controller.updateRollout);
  router.post('/flags/:key/killswitch', controller.toggleKillSwitch);
  router.post('/flags/:key/evaluate', controller.evaluate);
  router.delete('/flags/:key', controller.deleteFlag);
  router.get('/flags/:key/stats', controller.getStats);
  router.get('/audits', controller.getAudits);

  return router;
}
