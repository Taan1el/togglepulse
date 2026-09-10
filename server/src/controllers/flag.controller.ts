import { Request, Response } from 'express';
import { FlagService } from '../services/flag.service.js';

export class FlagController {
  constructor(private flagService: FlagService) {}

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
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to list flags' });
    }
  };

  getFlag = (req: Request, res: Response): void => {
    try {
      const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
      const flag = this.flagService.getFlag(key);

      if (!flag) {
        res.status(404).json({ success: false, error: `Flag not found: ${key}` });
        return;
      }

      res.json({ success: true, data: flag });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to get flag' });
    }
  };

  createFlag = (req: Request, res: Response): void => {
    try {
      const flag = this.flagService.createFlag(req.body);
      res.status(201).json({ success: true, data: flag });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Creation failed' });
    }
  };

  updateRollout = (req: Request, res: Response): void => {
    try {
      const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
      const updated = this.flagService.updateRollout(key, req.body);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Update failed' });
    }
  };

  toggleKillSwitch = (req: Request, res: Response): void => {
    try {
      const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
      const { environment = 'production', active } = req.body;
      const updated = this.flagService.toggleKillSwitch(key, environment, Boolean(active));
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Kill switch toggle failed' });
    }
  };

  evaluate = (req: Request, res: Response): void => {
    try {
      const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
      const { environment = 'production', context } = req.body;

      if (!context || !context.userId) {
        res.status(400).json({ success: false, error: 'Context with userId is required for evaluation' });
        return;
      }

      const result = this.flagService.evaluate(key, environment, context);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Evaluation failed' });
    }
  };

  deleteFlag = (req: Request, res: Response): void => {
    try {
      const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
      const deleted = this.flagService.deleteFlag(key);
      res.json({ success: true, data: { deleted } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Delete failed' });
    }
  };

  getAudits = (req: Request, res: Response): void => {
    try {
      const flagKey = req.query.flagKey as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const audits = this.flagService.getRecentAudits(flagKey, limit);
      res.json({ success: true, data: audits });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to get audits' });
    }
  };

  getStats = (req: Request, res: Response): void => {
    try {
      const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
      const stats = this.flagService.getFlagStats(key);
      res.json({ success: true, data: stats });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to get stats' });
    }
  };
}
