import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// For __dirname support in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the input XML file
const inputFile = path.join(__dirname, 'data', 'mplus_topics_2025-05-10.xml');

// Read the XML content
fs.readFile(inputFile, 'utf8', (err, data) => {
  if (err) {
    console.error('❌ Error reading the file:', err);
    return;
  }

  // Step 1: Extract topic title, paragraph content, and links
  const regex = /<health-topic[^>]*title="([^"]+)"[^>]*>[\s\S]*?<full-summary>([\s\S]*?)<\/full-summary>/g;

  let match;
  const topics = [];

  while ((match = regex.exec(data)) !== null) {
    const title = match[1].trim();
    const rawContent = match[2].trim();

    // Decode HTML entities and strip tags if needed
    const content = rawContent.replace(/&lt;/g, '<').replace(/&gt;/g, '>');

    // Extract links
    const linkRegex = /<a href="(.*?)">(.*?)<\/a>/g;
    const links = [];
    let linkMatch;
    while ((linkMatch = linkRegex.exec(content)) !== null) {
      links.push({ url: linkMatch[1], text: linkMatch[2] });
    }

    topics.push({ title, content, links });
  }

  // Step 2: Save structured output
  const outputFile = path.join(__dirname, 'data', 'structured_health_topics.json');
  fs.writeFile(outputFile, JSON.stringify(topics, null, 2), (err) => {
    if (err) {
      console.error('❌ Error writing JSON:', err);
    } else {
      console.log('✅ Successfully parsed and saved the data!');
    }
  });
});
