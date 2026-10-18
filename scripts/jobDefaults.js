// Fallback values and labels shared by the job normalizers, email and dashboard
export const NOT_SPECIFIED = 'Not specified';
export const UNKNOWN_LOCATION = 'Unknown';
export const FALLBACK_URL = '#';

export const jobTypeFor = (isRemote) => (isRemote ? 'Remote' : 'On-site / Hybrid');

export function buildTitleMatch(titleKeyword) {
  if (!titleKeyword || (Array.isArray(titleKeyword) && titleKeyword.length === 0)) {
    throw new Error('buildTitleMatch: titleKeyword is required');
  }
  const keywords = (Array.isArray(titleKeyword) ? titleKeyword : [titleKeyword])
    .map((k) => k.toLowerCase());
  return (t) => keywords.some((k) => t.includes(k));
}
