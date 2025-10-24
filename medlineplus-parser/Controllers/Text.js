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

// Debug: Check if API key is loaded
console.log('OpenRouter API Key loaded:', API_KEY ? 'Yes' : 'No');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const healthTopics = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'structured_health_topics.json'), 'utf8')
);

const storage = multer.memoryStorage();
export const Uploadmiddleware = multer({ storage }).single('file');

// Enhanced model fallback with better error handling
async function callOpenRouter(chatHistory) {
  const models = [
    "google/gemini-2.0-flash-exp:free",
    "meta-llama/llama-3.1-8b-instruct:free",
    "mistralai/mistral-7b-instruct:free",
    "huggingfaceh4/zephyr-7b-beta:free",
    "microsoft/wizardlm-2-8x22b:free"
  ];

  let lastError = null;

  for (const model of models) {
    try {
      console.log(`Trying model: ${model}`);
      
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "HTTP-Referer": "https://www.webstylepress.com",
          "X-Title": "wenstylepress", 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: model,
          messages: chatHistory,
          max_tokens: 500 // Limit tokens to reduce load
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        const errorText = await response.text();
        lastError = { model, status: response.status, error: errorText };
        console.warn(`Model ${model} failed with status ${response.status}`);
        
        // If it's a rate limit, try next model after short delay
        if (response.status === 429) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      }
    } catch (error) {
      lastError = error;
      console.error(`Error with model ${model}:`, error);
    }
  }

  throw new Error(`All models failed. Last error: ${JSON.stringify(lastError)}`);
}

// Add a simple cache for common medical questions
const medicalCache = new Map();

function getCachedResponse(prompt) {
  const normalizedPrompt = prompt.toLowerCase().trim();
  const commonQuestions = {
    'headache': "Headaches can have various causes including tension, migraines, or dehydration. For persistent or severe headaches, please consult a healthcare provider for proper diagnosis and treatment.",
    'fever': "Fever is often a sign of infection. Rest and hydration are important. Seek medical care if fever is high (over 103°F/39.4°C), lasts more than 3 days, or is accompanied by other concerning symptoms.",
    'cough': "Coughs can be due to colds, allergies, or infections. Stay hydrated and consider seeing a doctor if it persists for more than 2-3 weeks or is accompanied by breathing difficulties.",
    'cold': "Common cold symptoms include runny nose, cough, and congestion. Rest, fluids, and over-the-counter remedies may help. Most colds resolve within 7-10 days.",
    'pain': "Pain can indicate various conditions. For persistent or severe pain, please consult a healthcare professional for proper evaluation and treatment.",
    'flu': "Influenza symptoms include fever, body aches, and fatigue. Rest, hydration, and antiviral medications if prescribed. Seek medical attention for severe symptoms.",
    'allergy': "Allergies can cause sneezing, itching, and congestion. Antihistamines may help, but consult a doctor for persistent or severe allergies.",
    'stomach': "Stomach issues can range from indigestion to infections. Stay hydrated and seek medical care for persistent vomiting, severe pain, or dehydration signs.",
    'rash': "Rashes can have many causes including allergies, infections, or skin conditions. Consult a healthcare provider for proper diagnosis, especially if widespread or accompanied by fever.",
    'fatigue': "Fatigue can result from various factors including sleep issues, stress, or medical conditions. Maintain good sleep hygiene and consult a doctor if fatigue persists.",
    'anxiety': "Anxiety can manifest as worry, restlessness, or physical symptoms. Breathing exercises and stress management may help. Consider speaking with a mental health professional for persistent anxiety.",
    'depression': "Depression symptoms include persistent sadness, loss of interest, and changes in sleep/appetite. Professional help is recommended for diagnosis and treatment."
  };

  for (const [key, response] of Object.entries(commonQuestions)) {
    if (normalizedPrompt.includes(key)) {
      console.log(`Using cached response for: ${key}`);
      return response;
    }
  }
  return null;
}

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
        "You are Doctor.ai, a medical assistant trained to help users with medical information. You provide accurate information based on trusted medical resources. Always recommend consulting healthcare professionals for medical advice."
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
    const GENERIC_INPUTS = ['hi', 'hello', 'hey', 'help', 'good morning', 'good evening', 'good afternoon'];

    // Handle greetings
    if (GENERIC_INPUTS.includes(normalizedPrompt)) {
      const reply = "Hello! I'm Doctor.AI — your trusted medical assistant. You can ask me about symptoms, diseases, treatments, or share a medical file to get started. Remember, I provide informational support but always recommend consulting healthcare professionals for medical advice.";
      chatHistory.push({ role: "user", content: prompt });
      chatHistory.push({ role: "assistant", content: reply });
      return res.status(200).json({ msg: "Success", reply, chatHistory });
    }

    // Check cache for common medical questions
    const cachedResponse = getCachedResponse(prompt);
    if (cachedResponse) {
      chatHistory.push({ role: "user", content: finalUserMessage });
      chatHistory.push({ role: "assistant", content: cachedResponse });
      return res.status(200).json({ 
        msg: "Success (cached)", 
        reply: cachedResponse, 
        chatHistory 
      });
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

    // Fallback to OpenRouter with enhanced error handling
    try {
      const data = await callOpenRouter(chatHistory);
      const reply = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";
      
      chatHistory.push({
        role: "assistant", 
        content: reply
      });

      return res.status(200).json({ msg: "Success", reply, chatHistory });
    } catch (error) {
      console.error('All OpenRouter models failed:', error);
      // Fallback to local response
      const fallbackReply = "I'm currently experiencing high demand. For accurate medical information, please consult healthcare professionals directly or try again in a few moments. You can also try rephrasing your question or asking about specific symptoms.";
      
      chatHistory.push({
        role: "assistant",
        content: fallbackReply
      });

      return res.status(200).json({ 
        msg: "Using fallback response", 
        reply: fallbackReply, 
        chatHistory 
      });
    }

  } catch (error) {
    console.error('Server Error Details:', error);
    
    // Provide a helpful fallback even for server errors
    const errorReply = "I apologize, but I'm having technical difficulties. Please try again in a moment or consult a healthcare professional for immediate medical concerns.";
    
    chatHistory.push({
      role: "assistant",
      content: errorReply
    });

    res.status(200).json({ 
      msg: "Server error - using fallback", 
      reply: errorReply, 
      chatHistory 
    });
  }
}

export default Text;