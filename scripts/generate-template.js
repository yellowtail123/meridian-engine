#!/usr/bin/env node
// Generate Meridian Publication Template (.docx)
// Uses raw Office Open XML (no dependencies beyond built-in Node)

const fs = require('fs');
const path = require('path');

// We'll build the docx using the JSZip already in the project
// But since this is a Node script, let's use the archiver approach with raw XML

const { execSync } = require('child_process');

// OOXML constants
const NAMESPACE = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

// Template sections with instruction text
const sections = [
  {
    heading: 'Meridian Engine — Publication Template',
    level: 0, // title page header
    instruction: null,
    isTitle: true
  },
  {
    heading: 'Title Page',
    level: 1,
    instruction: 'Enter the full title of your publication here. The title should be concise, descriptive, and accurately reflect the content of your research. Maximum 200 characters recommended.'
  },
  {
    heading: 'Authors & Affiliations',
    level: 1,
    instruction: 'List all authors with their full names, institutional affiliations, email addresses, and ORCID identifiers. Use the format:\n\nFirst Author Name¹, Second Author Name²\n\n¹ Institution, Department, City, Country (email@example.com, ORCID: 0000-0000-0000-0000)\n² Institution, Department, City, Country (email@example.com, ORCID: 0000-0000-0000-0000)\n\nDesignate the corresponding author with an asterisk (*).'
  },
  {
    heading: 'Collaborators',
    level: 1,
    instruction: 'List any collaborating organizations, agencies, or individuals who contributed to the research but are not listed as authors. Include:\n\n• Organization/Individual Name\n• Type: Government Agency / University / Research Organization / NGO / Independent Researcher\n• Country\n\nLeave blank if not applicable.'
  },
  {
    heading: 'Abstract',
    level: 1,
    instruction: 'Provide a structured abstract of 150–300 words summarizing the research. Include: background/context, objectives, methods, key results, and conclusions. The abstract should stand alone and be understandable without reference to the full paper.'
  },
  {
    heading: 'Keywords',
    level: 1,
    instruction: 'List 4–8 keywords or phrases that describe the main topics of your research. Separate with semicolons. Example: coral reef ecology; fish community structure; marine protected areas; Indo-Pacific; visual census methodology'
  },
  {
    heading: 'Introduction',
    level: 1,
    instruction: 'Provide background context for your research. Include:\n\n• The broader scientific context and importance of the topic\n• A review of relevant prior work with citations\n• Identification of the knowledge gap your research addresses\n• Clear statement of objectives and/or hypotheses\n\nMinimum 400 words. All citations should follow APA 7th edition format.'
  },
  {
    heading: 'Methods',
    level: 1,
    instruction: 'Describe your methodology in sufficient detail for reproducibility. Include:\n\n• Study area description (coordinates, habitat type, depth range)\n• Sampling design and data collection protocols\n• Equipment and materials used\n• Sample sizes and temporal coverage\n• Statistical analyses performed (software, version, specific tests)\n• Any permits or ethical approvals obtained\n\nMinimum 500 words. Use subheadings (e.g., Study Area, Data Collection, Statistical Analysis) for clarity.'
  },
  {
    heading: 'Results',
    level: 1,
    instruction: 'Present your findings clearly and objectively. Include:\n\n• Key results organized by objective/hypothesis\n• Statistical test outcomes with effect sizes and p-values\n• Reference all tables and figures in the text\n• Do not interpret results here — save interpretation for the Discussion\n\nMinimum 300 words. Use subheadings to organize results by theme or analysis.'
  },
  {
    heading: 'Discussion',
    level: 1,
    instruction: 'Interpret your results in the context of existing knowledge. Include:\n\n• Summary of key findings and how they address your objectives\n• Comparison with previous studies — agreements and disagreements\n• Ecological/biological significance of the findings\n• Study limitations and potential sources of bias\n• Implications for management, conservation, or future research\n\nMinimum 500 words.'
  },
  {
    heading: 'Conclusion',
    level: 1,
    instruction: 'Provide a concise summary of the main findings and their significance. Include:\n\n• 2–3 key takeaway points\n• Practical implications or recommendations\n• Suggested directions for future research\n\nMinimum 100 words. Avoid introducing new information not discussed in the paper.'
  },
  {
    heading: 'Acknowledgements',
    level: 1,
    instruction: 'Acknowledge funding sources, field assistants, data providers, reviewers, and anyone who contributed to the research but does not meet authorship criteria. Include grant numbers where applicable.'
  },
  {
    heading: 'Data Availability Statement',
    level: 1,
    instruction: 'Describe where the data supporting this publication can be accessed. If archived on Meridian Engine, include the Meridian Data ID (MD-YYYY-NNNN). Example:\n\n"The datasets generated and analyzed during this study are available in the Meridian Engine Archived Data repository under accession number MD-2026-0042 (https://meridian-engine.com)."\n\nIf data cannot be shared, explain why.'
  },
  {
    heading: 'References',
    level: 1,
    instruction: 'List all cited works in APA 7th edition format. Minimum 10 references for original research. Examples:\n\nSmith, J. A., & Jones, B. C. (2024). Title of the article. Journal Name, 45(2), 123–145. https://doi.org/10.xxxx/xxxxx\n\nBrown, L. M. (2023). Title of the book (2nd ed.). Publisher Name.\n\nWorld Wildlife Fund. (2024). Living Planet Report 2024. https://www.worldwildlife.org/lpr'
  }
];

// Build the document.xml content
function buildDocumentXml() {
  let body = '';

  for (const sec of sections) {
    if (sec.isTitle) {
      // Title page — large centered header
      body += `
      <w:p>
        <w:pPr>
          <w:jc w:val="center"/>
          <w:spacing w:before="2400" w:after="200"/>
          <w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter"/><w:b/><w:color w:val="1B6090"/><w:sz w:val="56"/></w:rPr>
        </w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter"/><w:b/><w:color w:val="1B6090"/><w:sz w:val="56"/></w:rPr><w:t>Meridian Engine</w:t></w:r>
      </w:p>
      <w:p>
        <w:pPr>
          <w:jc w:val="center"/>
          <w:spacing w:after="400"/>
          <w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter"/><w:color w:val="C9956B"/><w:sz w:val="28"/></w:rPr>
        </w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter"/><w:color w:val="C9956B"/><w:sz w:val="28"/></w:rPr><w:t>Publication Template</w:t></w:r>
      </w:p>
      <w:p>
        <w:pPr>
          <w:jc w:val="center"/>
          <w:spacing w:after="200"/>
          <w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter"/><w:color w:val="888888"/><w:sz w:val="20"/></w:rPr>
        </w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter"/><w:color w:val="888888"/><w:sz w:val="20"/></w:rPr><w:t>All submissions to the Meridian Engine publications repository must follow this template format.</w:t></w:r>
      </w:p>
      <w:p>
        <w:pPr>
          <w:jc w:val="center"/>
          <w:spacing w:after="200"/>
          <w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter"/><w:color w:val="888888"/><w:sz w:val="20"/></w:rPr>
        </w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter"/><w:color w:val="888888"/><w:sz w:val="20"/></w:rPr><w:t>Download and replace each section's placeholder text with your content.</w:t></w:r>
      </w:p>
      <w:p><w:pPr><w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720"/></w:sectPr></w:pPr></w:p>`;
      continue;
    }

    // Section heading
    body += `
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
        <w:spacing w:before="360" w:after="120"/>
        <w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter"/><w:b/><w:color w:val="1B6090"/><w:sz w:val="32"/></w:rPr>
      </w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter"/><w:b/><w:color w:val="1B6090"/><w:sz w:val="32"/></w:rPr><w:t>${escXml(sec.heading)}</w:t></w:r>
    </w:p>`;

    // Instruction text (grey italic)
    if (sec.instruction) {
      const lines = sec.instruction.split('\n');
      for (const line of lines) {
        body += `
    <w:p>
      <w:pPr>
        <w:spacing w:after="60"/>
        <w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter"/><w:i/><w:color w:val="999999"/><w:sz w:val="22"/></w:rPr>
      </w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter"/><w:i/><w:color w:val="999999"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${escXml(line)}</w:t></w:r>
    </w:p>`;
      }
    }

    // Add some blank lines for content
    body += `
    <w:p><w:pPr><w:spacing w:after="200"/></w:pPr></w:p>`;
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
            xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
            xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
            xmlns:v="urn:schemas-microsoft-com:vml"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:w10="urn:schemas-microsoft-com:office:word"
            xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
            xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
            xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
            xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
            xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
            mc:Ignorable="w14 wp14">
  <w:body>
    ${body}
    <w:sectPr>
      <w:headerReference w:type="default" r:id="rId6"/>
      <w:footerReference w:type="default" r:id="rId7"/>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720"/>
      <w:pgNumType w:start="1"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function buildHeaderXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:p>
    <w:pPr>
      <w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="1B6090"/></w:pBdr>
      <w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter"/><w:color w:val="1B6090"/><w:sz w:val="16"/></w:rPr>
    </w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter"/><w:b/><w:color w:val="1B6090"/><w:sz w:val="16"/></w:rPr><w:t>Meridian Engine</w:t></w:r>
    <w:r><w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter"/><w:color w:val="C9956B"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve"> — Publication Template</w:t></w:r>
  </w:p>
</w:hdr>`;
}

function buildFooterXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr>
      <w:pBdr><w:top w:val="single" w:sz="4" w:space="1" w:color="CCCCCC"/></w:pBdr>
      <w:jc w:val="center"/>
      <w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter"/><w:color w:val="999999"/><w:sz w:val="16"/></w:rPr>
    </w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter"/><w:color w:val="999999"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">Page </w:t></w:r>
    <w:r><w:fldChar w:fldCharType="begin"/></w:r>
    <w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
    <w:r><w:fldChar w:fldCharType="separate"/></w:r>
    <w:r><w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter"/><w:color w:val="999999"/><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r>
    <w:r><w:fldChar w:fldCharType="end"/></w:r>
    <w:r><w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter"/><w:color w:val="999999"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve"> — meridian-engine.com</w:t></w:r>
  </w:p>
</w:ftr>`;
}

function buildContentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>`;
}

function buildRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function buildWordRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
  <Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`;
}

function buildStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Inter" w:hAnsi="Inter" w:cs="Inter"/>
        <w:sz w:val="24"/>
        <w:szCs w:val="24"/>
        <w:lang w:val="en-US"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="120" w:line="276" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal" w:default="1">
    <w:name w:val="Normal"/>
    <w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter"/><w:sz w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Inter" w:hAnsi="Inter"/><w:b/><w:color w:val="1B6090"/><w:sz w:val="32"/></w:rPr>
  </w:style>
</w:styles>`;
}

function escXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// Build ZIP manually using Node's zlib
const zlib = require('zlib');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function buildZip(files) {
  // files: [{name, data (Buffer)}]
  const entries = [];
  let offset = 0;

  // Local file headers + data
  const localParts = [];
  for (const f of files) {
    const nameB = Buffer.from(f.name, 'utf8');
    const compressed = zlib.deflateRawSync(f.data);
    const crc = crc32(f.data);

    // Local file header
    const lfh = Buffer.alloc(30 + nameB.length);
    lfh.writeUInt32LE(0x04034b50, 0); // signature
    lfh.writeUInt16LE(20, 4); // version needed
    lfh.writeUInt16LE(0, 6); // flags
    lfh.writeUInt16LE(8, 8); // compression: deflate
    lfh.writeUInt16LE(0, 10); // mod time
    lfh.writeUInt16LE(0, 12); // mod date
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(compressed.length, 18);
    lfh.writeUInt32LE(f.data.length, 22);
    lfh.writeUInt16LE(nameB.length, 26);
    lfh.writeUInt16LE(0, 28); // extra field length
    nameB.copy(lfh, 30);

    entries.push({ nameB, crc, compSize: compressed.length, uncompSize: f.data.length, offset });
    localParts.push(lfh, compressed);
    offset += lfh.length + compressed.length;
  }

  // Central directory
  const cdParts = [];
  let cdSize = 0;
  for (const e of entries) {
    const cd = Buffer.alloc(46 + e.nameB.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4); // version made by
    cd.writeUInt16LE(20, 6); // version needed
    cd.writeUInt16LE(0, 8); // flags
    cd.writeUInt16LE(8, 10); // compression
    cd.writeUInt16LE(0, 12); // time
    cd.writeUInt16LE(0, 14); // date
    cd.writeUInt32LE(e.crc, 16);
    cd.writeUInt32LE(e.compSize, 20);
    cd.writeUInt32LE(e.uncompSize, 24);
    cd.writeUInt16LE(e.nameB.length, 28);
    cd.writeUInt16LE(0, 30); // extra
    cd.writeUInt16LE(0, 32); // comment
    cd.writeUInt16LE(0, 34); // disk
    cd.writeUInt16LE(0, 36); // internal attrs
    cd.writeUInt32LE(0, 38); // external attrs
    cd.writeUInt32LE(e.offset, 42);
    e.nameB.copy(cd, 46);
    cdParts.push(cd);
    cdSize += cd.length;
  }

  // End of central directory
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); // disk
  eocd.writeUInt16LE(0, 6); // disk with cd
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...cdParts, eocd]);
}

// Generate
const files = [
  { name: '[Content_Types].xml', data: Buffer.from(buildContentTypesXml()) },
  { name: '_rels/.rels', data: Buffer.from(buildRelsXml()) },
  { name: 'word/document.xml', data: Buffer.from(buildDocumentXml()) },
  { name: 'word/_rels/document.xml.rels', data: Buffer.from(buildWordRelsXml()) },
  { name: 'word/styles.xml', data: Buffer.from(buildStylesXml()) },
  { name: 'word/header1.xml', data: Buffer.from(buildHeaderXml()) },
  { name: 'word/footer1.xml', data: Buffer.from(buildFooterXml()) },
];

const zip = buildZip(files);
const outPath = path.join(__dirname, '..', 'template', 'Meridian_Publication_Template.docx');
fs.writeFileSync(outPath, zip);
console.log('Generated:', outPath, '(' + zip.length + ' bytes)');
