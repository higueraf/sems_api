import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** GET /api/health — usado por Render, UptimeRobot, y el propio frontend */
  @Public()
  @Get()
  async check() {
    const start = Date.now();

    // Verifica conexión real a la BD con un query liviano
    let dbStatus = 'ok';
    let dbLatencyMs = 0;
    try {
      await this.ds.query('SELECT 1');
      dbLatencyMs = Date.now() - start;
    } catch {
      dbStatus = 'error';
    }

    return {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      db: { status: dbStatus, latencyMs: dbLatencyMs },
      memory: {
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
      version: process.env.npm_package_version || '1.0.0',
    };
  }

  /** GET /api/health/ping — respuesta mínima para keep-alive */
  @Public()
  @Get('ping')
  ping() {
    return { pong: true, ts: Date.now() };
  }
}
