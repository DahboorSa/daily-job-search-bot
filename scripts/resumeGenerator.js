import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  LevelFormat,
  BorderStyle,
  TabStopType,
  TabStopPosition,
} from 'docx';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { getSummary } from './searchEngine.js';

const BLUE = '1F4E79';
const DARK = '2E2E2E';
const GRAY = '555555';

const FONT = 'Arial';
const FONT_SIZE_NAME = 40;
const FONT_SIZE_HEADER = 24;
const FONT_SIZE_TITLE = 22;
const FONT_SIZE_BODY = 20;

function sectionHeader(text) {
  return new Paragraph({
    spacing: { before: 180, after: 60 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE, space: 1 },
    },
    children: [
      new TextRun({
        text,
        bold: true,
        size: FONT_SIZE_HEADER,
        color: BLUE,
        font: FONT,
      }),
    ],
  });
}

function jobTitleLine(title, company, locationDates) {
  return new Paragraph({
    spacing: { before: 120, after: 40 },
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: FONT_SIZE_TITLE,
        color: DARK,
        font: FONT,
      }),
      new TextRun({
        text: `  |  ${company}`,
        size: FONT_SIZE_TITLE,
        color: GRAY,
        font: FONT,
      }),
      new TextRun({
        text: `\t${locationDates}`,
        size: FONT_SIZE_BODY,
        color: GRAY,
        font: FONT,
        italics: true,
      }),
    ],
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { before: 30, after: 30 },
    children: [
      new TextRun({ text, size: FONT_SIZE_BODY, font: FONT, color: DARK }),
    ],
  });
}

function plain(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({
        text,
        size: FONT_SIZE_BODY,
        font: FONT,
        color: DARK,
        ...opts,
      }),
    ],
  });
}

function buildSkillsSection(profile, topSkills) {
  const skills = { ...profile.skills };

  if (skills.backend) {
    skills.backend = [...skills.backend].sort((a, b) => {
      const aTop = topSkills.includes(a) ? 0 : 1;
      const bTop = topSkills.includes(b) ? 0 : 1;
      return aTop - bTop;
    });
  }

  const toLabel = (key) =>
    key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const entries = Object.entries(skills);
  const lines = [];

  for (let i = 0; i < entries.length; i += 2) {
    const [keyA, valA] = entries[i];
    const partA = `${toLabel(keyA)}: ${valA.join(', ')}`;

    if (entries[i + 1]) {
      const [keyB, valB] = entries[i + 1];
      lines.push(plain(`${partA}  |  ${toLabel(keyB)}: ${valB.join(', ')}`));
    } else {
      lines.push(plain(partA));
    }
  }

  return lines;
}

function buildExperienceSection(profile, matchedKeywords) {
  const children = [];
  const kwLower = matchedKeywords.map((k) => k.toLowerCase());

  for (const exp of profile.experience) {
    children.push(
      jobTitleLine(exp.title, exp.company, `${exp.location}  ·  ${exp.dates}`),
    );
    if (exp.client) {
      children.push(plain(`Client: ${exp.client}`, { italics: true }));
    }

    const scored = exp.bullets.map((b) => {
      const bLow = b.toLowerCase();
      const score = kwLower.filter((kw) => bLow.includes(kw)).length;
      return { text: b, score };
    });
    scored.sort((a, b) => b.score - a.score);

    for (const { text } of scored) {
      children.push(bullet(text));
    }
  }

  return children;
}

function buildDocx(profile, summary, topSkills, matchedKeywords) {
  const { personal, education, certifications } = profile;

  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: personal.name,
          bold: true,
          size: FONT_SIZE_NAME,
          color: BLUE,
          font: FONT,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 160 },
      children: [
        new TextRun({
          text: `${personal.phone}  |  ${personal.email}  |  ${personal.location}`,
          size: FONT_SIZE_BODY,
          color: GRAY,
          font: FONT,
        }),
      ],
    }),

    sectionHeader('PROFESSIONAL SUMMARY'),
    plain(summary),

    sectionHeader('TECHNICAL SKILLS'),
    ...buildSkillsSection(profile, topSkills),

    sectionHeader('EXPERIENCE'),
    ...buildExperienceSection(profile, matchedKeywords),

    sectionHeader('EDUCATION'),
    jobTitleLine(
      education.degree,
      education.school,
      `${education.location}${education.gpa ? `  ·  GPA: ${education.gpa}` : ''}`,
    ),

    ...(certifications.length > 0
      ? [
          sectionHeader('CERTIFICATIONS'),
          ...certifications.map((c) => bullet(c)),
        ]
      : []),
  ];

  return new Document({
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 480, hanging: 240 } } },
            },
          ],
        },
      ],
    },
    styles: {
      default: { document: { run: { font: FONT, size: FONT_SIZE_BODY } } },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        children,
      },
    ],
  });
}

// Builds a tailored resume .docx for a job (no API calls) and returns its path
export async function generateResumeForJob(profile, job, analysis, outputDir) {
  const summary = getSummary(analysis, profile.search_config);

  const doc = buildDocx(
    profile,
    summary,
    analysis.topSkills,
    analysis.matchedKeywords,
  );
  const buffer = await Packer.toBuffer(doc);

  const companySlug = (job.company ?? 'Company').replace(/[^a-zA-Z0-9]/g, '_');
  const titleSlug = (job.title ?? 'Role').replace(/[^a-zA-Z0-9]/g, '_');
  mkdirSync(outputDir, { recursive: true });

  // Avoid overwriting resumes for the same company and title
  const baseName = `Resume_${companySlug}_${titleSlug}`;
  let filename = `${baseName}.docx`;
  for (let n = 2; existsSync(join(outputDir, filename)); n++) {
    filename = `${baseName}_${n}.docx`;
  }
  const filePath = join(outputDir, filename);
  writeFileSync(filePath, buffer);

  console.log(
    `   ✅ Saved: ${filename}  |  Match score: ${analysis.matchScore}/100`,
  );

  return { filePath, filename };
}
