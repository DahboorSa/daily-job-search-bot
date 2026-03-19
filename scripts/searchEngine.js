/**
 * Detect which themes the job description matches and compute a score.
 * @param {string} title
 * @param {string} description
 * @param {object} config - profile.search_config
 * @returns {{ dominantTheme, matchScore, matchedKeywords, matchReason, topSkills }}
 */
export function analyzeJob(title, description, config) {
  const text = `${title} ${description}`.toLowerCase();
  const { themes, match_reasons } = config;

  const themeScores = {};
  const allMatchedKeywords = new Set();

  for (const [themeName, theme] of Object.entries(themes)) {
    let themeScore = 0;

    for (const kw of theme.keywords) {
      if (text.includes(kw.toLowerCase())) {
        themeScore += theme.score;
        allMatchedKeywords.add(kw);
      }
    }

    if (themeScore > 0) {
      themeScores[themeName] = themeScore;
    }
  }

  // Pick dominant theme
  const dominantTheme =
    Object.entries(themeScores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'default';

  // Normalize match score to 0–100
  const rawScore = Object.values(themeScores).reduce((sum, t) => sum + t, 0);
  const matchScore = Math.min(Math.round((rawScore / 80) * 100), 98);

  // Build match reason
  const topThemes = Object.entries(themeScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name]) => name);

  const matchReason = buildMatchReason(
    topThemes,
    [...allMatchedKeywords].slice(0, 5),
    match_reasons,
  );

  return {
    dominantTheme,
    matchScore,
    matchedKeywords: [...allMatchedKeywords],
    matchReason,
    topSkills: themes[dominantTheme]?.skills ?? themes.default?.skills ?? [],
  };
}

function buildMatchReason(themes, keywords, match_reasons) {
  const primaryTheme = themes[0] ?? 'default';
  let reason = match_reasons[primaryTheme] ?? match_reasons.default;

  if (keywords.length > 0) {
    const kwList = keywords.slice(0, 3).join(', ');
    reason += ` Key matched skills: ${kwList}.`;
  }

  return reason;
}

export function getSummary(analysis, config) {
  return config.summaries[analysis.dominantTheme] ?? config.summaries.default;
}
