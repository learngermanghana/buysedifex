import { mkdir, appendFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const analyticsDirCandidates = [
  path.join(process.cwd(), '.analytics'),
  path.join(os.tmpdir(), 'sedifex-analytics'),
];

async function resolveAnalyticsDir() {
  for (const dir of analyticsDirCandidates) {
    try {
      await mkdir(dir, { recursive: true });
      return dir;
    } catch {
      // Try the next writable location.
    }
  }

  throw new Error('Unable to initialize analytics directory');
}

export async function persistAnalytics(eventType: string, payload: Record<string, unknown>) {
  try {
    const analyticsDir = await resolveAnalyticsDir();
    const logPath = path.join(analyticsDir, `${eventType}.jsonl`);

    await appendFile(
      logPath,
      `${JSON.stringify({ eventType, payload, createdAt: new Date().toISOString() })}\n`,
      'utf8',
    );
  } catch {
    // Analytics persistence is best-effort and should never break request handling.
  }
}
