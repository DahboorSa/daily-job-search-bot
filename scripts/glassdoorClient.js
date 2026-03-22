const GLASSDOOR_HOST = 'real-time-glassdoor-data.p.rapidapi.com';

export async function getGlassdoorData(jobTitle, location) {
  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY ?? '';
  if (!RAPIDAPI_KEY) return { salaryRange: null };

  const params = new URLSearchParams({
    job_title: jobTitle,
    location,
    location_type: 'ANY',
    years_of_experience: 'ALL',
    domain: 'www.glassdoor.com',
  });

  try {
    const res = await fetch(
      `https://${GLASSDOOR_HOST}/salary-estimation?${params}`,
      {
        headers: {
          'x-rapidapi-host': GLASSDOOR_HOST,
          'x-rapidapi-key': RAPIDAPI_KEY,
        },
      },
    );
    if (!res.ok) {
      console.error(`   ❌ Glassdoor salary-estimation failed: HTTP ${res.status}`);
      return { salaryRange: null };
    }
    const data = await res.json();
    const est = data?.data;
    if (!est?.min_salary || !est?.max_salary) {
      console.log(`   ⚠️  Glassdoor salary: no data found`);
      return { salaryRange: null };
    }
    const fmt = (n) => `$${Math.round(n).toLocaleString()}`;
    const salaryRange = `${fmt(est.min_salary)} – ${fmt(est.max_salary)}/yr`;
    console.log(`   ✅ Glassdoor salary: ${salaryRange}`);
    return { salaryRange };
  } catch (err) {
    console.error(`   ❌ Glassdoor error: ${err.message}`);
    return { salaryRange: null };
  }
}
