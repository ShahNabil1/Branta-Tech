/** Hiring pipeline statuses (client-safe). */
export const APPLICATION_STATUSES = ["new", "reviewing", "shortlisted", "interview", "offer", "hired", "rejected", "withdrawn"] as const;
export const APPLICATION_STATUS_OPTIONS = APPLICATION_STATUSES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }));
