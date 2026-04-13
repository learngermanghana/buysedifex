import { mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';

const analyticsDir = path.join(process.cwd(), '.analytics');

export async function persistAnalytics(eventType: string, payload: Record<string, unknown>) {
  await mkdir(analyticsDir, { recursive: true });
  const logPath = path.join(analyticsDir, `${eventType}.jsonl`);
  await appendFile(
    logPath,
    `${JSON.stringify({ eventType, payload, createdAt: new Date().toISOString() })}\n`,
    'utf8',
  );
}
