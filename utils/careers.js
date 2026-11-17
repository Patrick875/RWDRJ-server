/*
 * Job deadline logic (mirrored in client/src/cms/careers.ts). Jobs live in collections/jobs.
 * A deadline is a calendar date (YYYY-MM-DD); applications close at the END of that day in Kigali (UTC+2).
 */
const KIGALI_OFFSET_MINUTES = 120;

const deadlineEndsAt = (deadline) => {
	const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(deadline || ""));
	if (!match) return null;
	const [, y, m, d] = match.map(Number);
	return Date.UTC(y, m - 1, d, 23, 59, 59, 999) - KIGALI_OFFSET_MINUTES * 60 * 1000;
};

const isJobOpen = (job, now = Date.now()) => {
	const end = deadlineEndsAt(job?.deadline);
	return end === null ? true : now <= end;
};

/** Public listing filter for jobs: published, visible, and deadline not passed. */
const isPubliclyListed = (job, now = Date.now()) => Boolean(job) && job.status === "published" && job.visible !== false && isJobOpen(job, now);

module.exports = { deadlineEndsAt, isJobOpen, isPubliclyListed };
