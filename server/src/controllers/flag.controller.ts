import { Request, Response } from 'express';
import { FlagService } from '../services/flag.service.js';
import { ValidationError, NotFoundError } from '../errors.js';

export class FlagController {
  constructor(private flagService: FlagService) {}

  private handleError(err: unknown, res: Response, fallbackMessage: string): void {
    if (err instanceof ValidationError) {
      res.status(400).json({ success: false, code: err.code, error: err.message });
      return;
    }
    if (err instanceof NotFoundError) {
      res.status(404).json({ success: false, code: err.code, error: err.message });
      return;
    }
    console.error(fallbackMessage, err);
    res.status(500).json({ success: false, code: 'INTERNAL_ERROR', error: fallbackMessage });
  }

  health = (_req: Request, res: Response): void => {
    res.json({
      status: 'healthy',
      service: 'togglepulse-engine',
      timestamp: new Date().toISOString(),
    });
  };

  listFlags = (_req: Request, res: Response): void => {
    try {
      const flags = this.flagService.getAllFlags();
      res.json({ success: true, data: flags });
    } catch (err) {
      this.handleError(err, res, 'Failed to list flags');
    }
  };

  getFlag = (req: Request, res: Response): void => {
    try {
      const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
      const flag = this.flagService.getFlag(key);

      if (!flag) {
        res.status(404).json({ success: false, code: 'NOT_FOUND', error: `Flag not found: ${key}` });
        return;
      }

      res.json({ success: true, data: flag });
    } catch (err) {
      this.handleError(err, res, 'Failed to get flag');
    }
  };

  createFlag = (req: Request, res: Response): void => {
    try {
      const flag = this.flagService.createFlag(req.body);
      res.status(201).json({ success: true, data: flag });
    } catch (err) {
      this.handleError(err, res, 'Failed to create flag');
    }
  };

  updateRollout = (req: Request, res: Response): void => {
    try {
      const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
      const updated = this.flagService.updateRollout(key, req.body);
      res.json({ success: true, data: updated });
    } catch (err) {
      this.handleError(err, res, 'Failed to update rollout');
    }
  };

  toggleKillSwitch = (req: Request, res: Response): void => {
    try {
      const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
      const { environment = 'production', active } = req.body;
      const updated = this.flagService.toggleKillSwitch(key, environment, active);
      res.json({ success: true, data: updated });
    } catch (err) {
      this.handleError(err, res, 'Failed to toggle kill switch');
    }
  };

  evaluate = (req: Request, res: Response): void => {
    try {
      const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
      const { environment = 'production', context } = req.body;

      if (!context || typeof context.userId !== 'string' || !context.userId) {
        res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          error: 'Context with userId is required for evaluation',
        });
        return;
      }

      const result = this.flagService.evaluate(key, environment, context);
      res.json({ success: true, data: result });
    } catch (err) {
      this.handleError(err, res, 'Failed to evaluate flag');
    }
  };

  deleteFlag = (req: Request, res: Response): void => {
    try {
      const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
      const deleted = this.flagService.deleteFlag(key);
      res.json({ success: true, data: { deleted } });
    } catch (err) {
      this.handleError(err, res, 'Failed to delete flag');
    }
  };

  getAudits = (req: Request, res: Response): void => {
    try {
      const flagKey = req.query.flagKey as string | undefined;
      const parsed = parseInt(String(req.query.limit ?? ''), 10);
      const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 500) : 50;
      const audits = this.flagService.getRecentAudits(flagKey, limit);
      res.json({ success: true, data: audits });
    } catch (err) {
      this.handleError(err, res, 'Failed to get audits');
    }
  };

  getStats = (req: Request, res: Response): void => {
    try {
      const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
      const stats = this.flagService.getFlagStats(key);
      res.json({ success: true, data: stats });
    } catch (err) {
      this.handleError(err, res, 'Failed to get stats');
    }
  };
}
