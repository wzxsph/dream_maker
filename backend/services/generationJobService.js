import { nanoid } from 'nanoid';

const jobs = new Map();
const JOB_TTL_MS = 10 * 60 * 1000;

function cleanupJobs() {
  const now = Date.now();
  for (const [jobId, job] of jobs.entries()) {
    if (now - job.created_at_ms > JOB_TTL_MS) {
      jobs.delete(jobId);
    }
  }
}

export function startGenerationJob(task) {
  cleanupJobs();

  const job = {
    job_id: `job_${nanoid(10)}`,
    status: 'pending',
    result: null,
    error: null,
    created_at: new Date().toISOString(),
    created_at_ms: Date.now(),
    updated_at: new Date().toISOString()
  };

  jobs.set(job.job_id, job);

  Promise.resolve()
    .then(async () => {
      job.status = 'running';
      job.updated_at = new Date().toISOString();
      job.result = await task();
      job.status = 'done';
      job.updated_at = new Date().toISOString();
    })
    .catch((error) => {
      job.status = 'error';
      job.error = error?.message || '生成失败';
      job.updated_at = new Date().toISOString();
      console.error(error);
    });

  return job;
}

export function getGenerationJob(jobId) {
  cleanupJobs();
  return jobs.get(jobId) || null;
}
