import dotenv from 'dotenv';
import fetch from 'node-fetch';
import multer from 'multer';
import pdfParse from 'pdf-parse';
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

let chatHistory = [
  {
    role: "system",
    content: "You are Doctor.ai, a medical assistant trained to help users with medical information. You provide accurate information based on trusted medical resources."
  }
];

const storage = multer.memoryStorage();
export const Uploadmiddleware = multer({ storage }).single('file');

async function Text(req, res) {
  const prompt = req.body.prompt;
  const file = req.file;
  let fileContent = '';

  try {
    if (file) {
      const fileType = file.mimetype;
      if (fileType === 'application/pdf') {
        const pdfData = await pdfParse(file.buffer);
        fileContent = pdfData.text;
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

    chatHistory.push({
      role: "user",
      content: finalUserMessage
    });

    const matchedTopic = healthTopics.find(topic =>
      prompt.toLowerCase().includes(topic.title.toLowerCase()) ||
      topic.title.toLowerCase().includes(prompt.toLowerCase())
    );

    if (matchedTopic) {
      const $ = cheerio.load(matchedTopic.content);
      const lowerPrompt = prompt.toLowerCase();

      let sectionTitle = "";

      if (lowerPrompt.includes("symptom")) {
        sectionTitle = "what are the symptoms of";
      } else if (lowerPrompt.includes("treatment")) {
        sectionTitle = "what are the treatments for";
      } else if (lowerPrompt.includes("cause")) {
        sectionTitle = "how do you get";
      } else if (lowerPrompt.includes("diagnos")) {
        sectionTitle = "how is";
      } else if (lowerPrompt.includes("prevent")) {
        sectionTitle = "can";
      } else if (lowerPrompt.includes("what is")) {
        sectionTitle = "what is";
      }

      let reply = "";
      if (sectionTitle) {
        $('h3').each((_, el) => {
          const heading = $(el).text().trim().toLowerCase();
          if (heading.startsWith(sectionTitle)) {
            const sectionHtml = $(el).nextUntil('h3').addBack().map((_, el) => $.html(el)).get().join('\n');
            reply = `According to MedlinePlus:\n\n${sectionHtml}`;
            return false;
          }
        });
      }

      if (!reply) {
        reply = `According to MedlinePlus:\n\n${matchedTopic.content}`;
      }

      chatHistory.push({
        role: "assistant",
        content: reply
      });

      return res.status(200).json({ msg: "Success", reply });
    }

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
    const reply = data.choices?.[0]?.message?.content;

    chatHistory.push({
      role: "assistant",
      content: reply
    });

    res.status(200).json({ msg: "Success", reply });

  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Server Error" });
  }
}

export default Text;
