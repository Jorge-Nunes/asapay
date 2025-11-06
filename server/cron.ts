import cron from 'node-cron';
import { ExecutionService } from './services/execution.service';

export function setupCronJobs() {
  // Run every day at 10:00 AM
  cron.schedule('0 10 * * *', async () => {
    console.log('[CRON] Starting scheduled execution at 10:00 AM');
    
    try {
      await ExecutionService.runExecution();
      console.log('[CRON] Scheduled execution completed successfully');
    } catch (error) {
      console.error('[CRON] Scheduled execution failed:', error);
    }
  }, {
    timezone: 'America/Sao_Paulo'
  });

  console.log('[CRON] Scheduled job configured: Daily execution at 10:00 AM (America/Sao_Paulo)');
}
