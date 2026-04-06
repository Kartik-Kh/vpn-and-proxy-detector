import { Router, Request, Response } from 'express';
import Lookup from '../models/Lookup';
import { logger } from '../config/logger';

const router = Router();

// GET /api/history - Get lookup history
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      verdict,
      startDate,
      endDate,
      search,
    } = req.query;

    // Build query
    const query: any = {};

    // Filter by verdict
    if (verdict && (verdict === 'PROXY/VPN' || verdict === 'ORIGINAL')) {
      query.verdict = verdict;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate as string);
      if (endDate) query.timestamp.$lte = new Date(endDate as string);
    }

    // Search by IP
    if (search) {
      query.ip = { $regex: search as string, $options: 'i' };
    }

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Execute query
    const [lookups, total] = await Promise.all([
      Lookup.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Lookup.countDocuments(query),
    ]);

    res.json({
      lookups,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('History fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// GET /api/history/:id - Get specific lookup
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const lookup = await Lookup.findById(req.params.id);

    if (!lookup) {
      return res.status(404).json({ error: 'Lookup not found' });
    }

    res.json(lookup);
  } catch (error) {
    logger.error('Lookup fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch lookup' });
  }
});

// DELETE /api/history/:id - Delete lookup
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const lookup = await Lookup.findById(req.params.id);

    if (!lookup) {
      return res.status(404).json({ error: 'Lookup not found' });
    }

    // Check if user owns this lookup or is admin
    if (
      lookup.userId?.toString() !== req.user?.id &&
      req.user?.role !== 'admin'
    ) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await Lookup.findByIdAndDelete(req.params.id);

    logger.info(`Lookup deleted: ${req.params.id} by user ${req.user?.id}`);

    res.json({ message: 'Lookup deleted successfully' });
  } catch (error) {
    logger.error('Lookup delete error:', error);
    res.status(500).json({ error: 'Failed to delete lookup' });
  }
});

// GET /api/history/export - Export history as CSV
router.get('/export/csv', async (req: Request, res: Response) => {
  try {
    const query: any = {};
    if (req.user) {
      query.userId = req.user.id;
    }

    const lookups = await Lookup.find(query).sort({ timestamp: -1 }).limit(1000);

    // Generate CSV
    const csv = [
      'IP,Verdict,Score,Confidence,Timestamp',
      ...lookups.map(
        (lookup) =>
          `${lookup.ip},${lookup.verdict},${lookup.score},${lookup.confidence || 'N/A'},${lookup.timestamp}`
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=vpn-detection-history.csv');
    res.send(csv);
  } catch (error) {
    logger.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export history' });
  }
});

// GET /api/history/stats - Get statistics
router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const query: any = {};
    if (req.user) {
      query.userId = req.user.id;
    }

    const [total, vpnCount, originalCount] = await Promise.all([
      Lookup.countDocuments(query),
      Lookup.countDocuments({ ...query, verdict: 'PROXY/VPN' }),
      Lookup.countDocuments({ ...query, verdict: 'ORIGINAL' }),
    ]);

    res.json({
      total,
      vpn: vpnCount,
      original: originalCount,
      vpnPercentage: total > 0 ? Math.round((vpnCount / total) * 100) : 0,
    });
  } catch (error) {
    logger.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
