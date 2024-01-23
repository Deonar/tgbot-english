import OpenAI from "openai";
import config from 'config'
import fs from "fs";
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

class OpenAIService {
  roles = {
    ASSISTANT: "assistant",
    USER: "user",
    SYSTEM: "system",
  };

  constructor(apiKey) {
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  async chat(messages, temp = 1, tokens = 256, model = 'gpt-3.5-turbo-1106' ) {
    try {
      const response = await this.openai.chat.completions.create({
        model: model,
        messages,
        max_tokens: tokens,
        temperature: temp,
      })
      return response.choices[0].message
    } catch (e) {
      console.error('Error while gpt chat', e.message)
    }
  }

  async analyzeImage(imageUrl, systemPrompt = '', userPrompt = '') {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: imageUrl },
            ],
          },
        ],
        max_tokens: 100,
      });

      return response.choices[0].message.content;
    } catch (e) {
      console.error("Error in image analysis:", e.message);
    }
  }

  async transcription(filepath) {
    try {
      const response = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(filepath),
        model: 'whisper-1'
      })

      return response.text
    } catch (e) {
      console.error('Error in transcription:', e.message)
    }
  }

  async textToSpeech(messages, filename){
    
    const mp3Path = resolve(__dirname, '../voices', `${filename}.mp3`)
    try{
      const mp3 = await this.openai.audio.speech.create({
        model: "tts-1",
        voice: "alloy",
        input: messages,
      }
    )
    const buffer = Buffer.from(await mp3.arrayBuffer());

    await fs.promises.writeFile(mp3Path, buffer);
    return mp3Path
    }catch (e) {
      console.error('Error in text-to-speech:', e.message);
    }
  }
}

export const openaiService = new OpenAIService(config.get("OPENAI_KEY"));
