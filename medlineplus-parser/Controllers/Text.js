import dotenv from 'dotenv';
import fetch from 'node-fetch';
import multer from 'multer';
import { PDFDocument } from 'pdf-lib';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const API_KEY = process.env.Ravi_key;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const healthTopics = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'structured_health_topics.json'), 'utf8')
);

const storage = multer.memoryStorage();
export const Uploadmiddleware = multer({ storage }).single('file');

// Helper function to extract text from PDF using pdf-lib
async function extractTextFromPDF(buffer) {
  try {
    const pdfDoc = await PDFDocument.load(buffer);
    let textContent = '';
    
    for (let i = 0; i < pdfDoc.getPageCount(); i++) {
      const page = pdfDoc.getPage(i);
      const text = await page.getTextContent();
      textContent += text.items.map(item => item.str).join(' ') + '\n';
    }
    
    return textContent;
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    throw new Error('Failed to parse PDF');
  }
}

async function Text(req, res) {
  const prompt = req.body.prompt;
  const file = req.file;
  let fileContent = '';

  // Parse chatHistory from request, fallback to empty array
  let chatHistory = [];
  try {
    chatHistory = req.body.chatHistory ? JSON.parse(req.body.chatHistory) : [];
  } catch {
    chatHistory = [];
  }

  // Add system message if chatHistory is empty
  if (chatHistory.length === 0) {
    chatHistory.push({
      role: "system",
      content:
        "You are Doctor.ai, a medical assistant trained to help users with medical information. You provide accurate information based on trusted medical resources."
    });
  }

  try {
    // File parsing
    if (file) {
      const fileType = file.mimetype;
      if (fileType === 'application/pdf') {
        fileContent = await extractTextFromPDF(file.buffer);
      } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const docData = await mammoth.extractRawText({ buffer: file.buffer });
        fileContent = docData.value;
      } else if (fileType === 'text/plain') {
        fileContent = file.buffer.toString('utf8');
      } else {
        return res.status(400).json({ msg: `Unsupported file type: ${fileType}` });
      }
    }

    const finalUserMessage = [fileContent, prompt].filter(Boolean).join('\n\n');

    const normalizedPrompt = prompt.trim().toLowerCase();
    const GENERIC_INPUTS = ['hi', 'hello', 'hey', 'help', 'good morning', 'good evening'];

    // Handle greetings
    if (GENERIC_INPUTS.includes(normalizedPrompt)) {
      const reply = "Hello! I'm Doctor.AI — your trusted medical assistant. You can ask me about symptoms, diseases, treatments, or share a medical file to get started.";
      chatHistory.push({ role: "user", content: prompt });
      chatHistory.push({ role: "assistant", content: reply });
      return res.status(200).json({ msg: "Success", reply, chatHistory });
    }

    chatHistory.push({ role: "user", content: finalUserMessage });

    let matchedTopic = null;

    if (normalizedPrompt.length > 3) {
      matchedTopic = healthTopics.find(topic =>
        normalizedPrompt.includes(topic.title.toLowerCase()) ||
        topic.title.toLowerCase().includes(normalizedPrompt)
      );
    }

    // Use MedlinePlus topic if matched
    if (matchedTopic) {
      const $ = cheerio.load(matchedTopic.content);
      let sectionTitle = "";

      if (normalizedPrompt.includes("symptom")) sectionTitle = "what are the symptoms of";
      else if (normalizedPrompt.includes("treatment")) sectionTitle = "what are the treatments for";
      else if (normalizedPrompt.includes("cause")) sectionTitle = "how do you get";
      else if (normalizedPrompt.includes("diagnos")) sectionTitle = "how is";
      else if (normalizedPrompt.includes("prevent")) sectionTitle = "can";
      else if (normalizedPrompt.includes("what is")) sectionTitle = "what is";

      let reply = "";
      if (sectionTitle) {
        $('h3').each((_, el) => {
          const heading = $(el).text().trim().toLowerCase();
          if (heading.startsWith(sectionTitle)) {
            const sectionHtml = $(el).nextUntil('h3').addBack().map((_, el) => $.html(el)).get().join('\n');
            const plainText = cheerio.load(sectionHtml).text().trim();
            reply = `According to MedlinePlus:\n\n${plainText}`;
            return false; // break loop
          }
        });
      }

      if (!reply) {
        const plainText = cheerio.load(matchedTopic.content).text().trim();
        reply = `According to MedlinePlus:\n\n${plainText}`;
      }

      chatHistory.push({ role: "assistant", content: reply });
      return res.status(200).json({ msg: "Success", reply, chatHistory });
    }

    // Fallback to OpenRouter if no topic matched
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "HTTP-Referer": "https://www.webstylepress.com",
        "X-Title": "wenstylepress",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat-v3-0324:free",
        messages: chatHistory
      })
    });

    if (!response.ok) {
      return res.status(500).json({ msg: "Failed to fetch from OpenRouter" });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Sorry, no reply.";

    chatHistory.push({
      role: "assistant",
      content: reply
    });

    res.status(200).json({ msg: "Success", reply, chatHistory });

  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Server Error" });
  }
}

export default Text;