function updateStatus(index, select) {
  const status = select.value;
  const c = STATUS_CFG[status];
  select.style.background = c.bg;
  select.style.color = c.color;
  select.style.borderColor = c.color;

  jobs[index].status = status;
  document.getElementById('card-' + index).style.borderLeftColor = c.color;

  localStorage.setItem(
    'jobStatuses',
    JSON.stringify(jobs.map((j) => ({ id: j.id, status: j.status }))),
  );

  refreshCounts();

  const msg = document.getElementById('saved-msg');
  msg.classList.add('show');
  setTimeout(() => msg.classList.remove('show'), 2000);
}

function refreshCounts() {
  const counts = {
    new: 0,
    saved: 0,
    applied: 0,
    rejected: 0,
    accepted: 0,
    not_interested: 0,
  };
  jobs.forEach((j) => {
    const s = j.status ?? 'new';
    if (s in counts) counts[s]++;
  });

  document.querySelectorAll('.stat-pill').forEach((pill) => {
    const key = pill.dataset.status;
    if (key && key in counts)
      pill.textContent = pill.dataset.label + ': ' + counts[key];
  });
  document.querySelectorAll('.filter-btn[data-status]').forEach((btn) => {
    const key = btn.dataset.status;
    if (key && key in counts)
      btn.textContent = btn.dataset.label + ' (' + counts[key] + ')';
  });
}

function filterJobs(status, btn) {
  document
    .querySelectorAll('.filter-btn')
    .forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.job-card').forEach((card, i) => {
    const jobStatus = jobs[i]?.status ?? 'new';
    card.style.display =
      status === 'all' || jobStatus === status ? 'block' : 'none';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('jobStatuses');
  if (saved) {
    const map = new Map(JSON.parse(saved).map((j) => [j.id, j.status]));
    jobs.forEach((job, i) => {
      if (map.has(job.id)) {
        const select = document.getElementById('status-' + i);
        if (select) {
          select.value = map.get(job.id);
          select.dispatchEvent(new Event('change'));
        }
      }
    });
  }
});
