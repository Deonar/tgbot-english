import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import installer from "@ffmpeg-installer/ffmpeg";
// import { createWriteStream } from "fs";
import fs from "fs";
import path from "path";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

class audioConverter {
  constructor() {
    ffmpeg.setFfmpegPath(installer.path);
  }

  toMp3(input, output) {
    try {
      const outputPath = resolve(dirname(input), `${output}.mp3`);
      return new Promise((resolve, reject) => {
        ffmpeg(input)
          .inputOption("-t 30")
          .output(outputPath)
          .on("end", () => resolve(outputPath))
          .on("error", (err) => reject(err.message))
          .run();
      });
    } catch (e) {
      console.log("Error while creating mp3", e.message);
    }
  }

  toOgg(input, output) {
    try {
      const outputPath = resolve(dirname(input), `${output}.ogg`);
      return new Promise((resolve, reject) => {
        ffmpeg(input)
          .audioCodec("libopus") // Use libopus codec for encoding
          .output(outputPath)
          .on("end", () => resolve(outputPath))
          .on("error", (err) => reject(err.message))
          .run();
      });
    } catch (e) {
      console.log("Error while creating ogg", e.message);
    }
  }

  async create(url, userId, messageId) {
    try {

      const userDir = path.resolve(__dirname, "../voices", userId.toString());
     
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
    
      const oggPath = path.resolve(userDir, `${messageId}.ogg`);
      const response = await axios({
        method: "get",
        url,
        responseType: "stream",
      });
      return new Promise((resolve, reject) => {
        const stream = fs.createWriteStream(oggPath);
        response.data.pipe(stream);
        stream.on("finish", () => resolve(oggPath));
        stream.on("error", (err) => reject(err.message));
      });
    } catch (e) {
      console.log("Error while creating ogg", e.message);
    }
  }
}

export const converter = new audioConverter();
