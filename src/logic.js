import { openaiService } from "./openai.js";
import { converter } from "./converter.js";
import { removeFile } from "./utils.js";

export const INITIAL_SESSION = {
  messages: [],
};

export async function sendWelcomeMessage(ctx) {
  ctx.session = { ...INITIAL_SESSION };
  await ctx.reply(
    "What do you want to practice today?"
  );
}

async function getFileLink(ctx) {
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  const document = ctx.message.document;
  const fileLink = photo
    ? await ctx.telegram.getFileLink(photo.file_id)
    : await ctx.telegram.getFileLink(document.file_id);
  return fileLink.href;
}

async function analyzeHomeworkImage(fileLink) {
  const systemPrompt =
    "You are a helpful assistant. Analyze the image and provide educational feedback.";
  const userPrompt =
    "Make a summary of the text in the image. Identify the main topic of the text.";
  return await openaiService.analyzeImage(fileLink, systemPrompt, userPrompt);
}

export async function processHomeworkSubmission(ctx) {
  ctx.session = { ...INITIAL_SESSION };
  try {
    await ctx.reply("🤔 Just a minute, let me see what we have here");

    const fileLink = await getFileLink(ctx);
    const analyzeImageText = await analyzeHomeworkImage(fileLink);

    const systemPrompt = [
      {
        role: "system",
        content:
          "You are a teacher of English. Based on summary you need to imagine a situation to practise your student's homework.",
      },
      {
        role: "user",
        content:
          "Summary: The main topic of this image is Restaurants. \nDescribe an imaginary situation on this topic. Write an example of how to start a dialog on this topic.",
      },
      {
        role: "assistant",
        content:
          "Imagine you're in a restaurant and you need to determine what's on the menu, what's vegetarian, and whether you can order food to go. Start the dialog with a phrase. Hi, I like your restaurant, can I ask for the menu?",
      },
      {
        role: "user",
        content:
          "Summary: " +
          analyzeImageText +
          "\nDescribe an imaginary situation on this topic. Write an example of how to start a dialog on this topic.",
      }
    ];

    const response = await openaiService.chat(systemPrompt, 1.63);

    const text = response.content

    ctx.session.messages.push({
      role: "system",
      content:
        "You are a teacher of English. Use short messages. Talk with your student based situation. " + text,
    });

    await ctx.reply(text);
    await processTextToVoice(ctx, text)

  } catch (e) {
    console.error(`Error in processHomeworkSubmission: ${e.message}`, e);
    await ctx.reply(
      "Sorry, there was a problem analyzing your homework. Please try again later."
    );
  }
}

export async function processVoiceMessage(ctx) {
  ctx.session = { ...INITIAL_SESSION };
  try {
    const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
    const userId = String(ctx.message.from.id);
    const oggPath = await converter.create(link.href, userId);
    const mp3Path = await converter.toMp3(oggPath, userId);

    removeFile(oggPath);

    const text = await openaiService.transcription(mp3Path);

    return text;
  } catch (e) {
    console.log(`Error while voice message`, e.message);
  }
}

export async function processTextToChat(ctx, content) {
  ctx.session = { ...INITIAL_SESSION };
  try {
    ctx.session.messages.push({ role: openaiService.roles.USER, content });

    const response = await openaiService.chat(ctx.session.messages);

    ctx.session.messages.push({
      role: openaiService.roles.ASSISTANT,
      content: response.content,
    });

    return response.content;

  } catch (e) {
    console.log("Error while proccesing text to gpt", e.message);
  }
}

export async function processTextToVoice(ctx, content) {
  try {
    const userId = String(ctx.message.from.id);
    const mp3Path = await openaiService.textToSpeech(content, userId);
    const oggPath = await converter.toOgg(mp3Path, userId);

    await ctx.replyWithVoice({ source: oggPath });
    
  } catch (e) {
    await ctx.reply("🙈 Opps, something went wrong, try sending agai");
    console.log("Error while proccesing text to gpt", e.message);
  }
}

export async function randomTopic(ctx) {
  ctx.session = { ...INITIAL_SESSION };
  try {
    const startPromt = [
      {
        role: "system",
        content:
          "You are a supportive teacher of English. Use short messages. Goal is to practice English by speaking.",
      },
      {
        role: "user",
        content:
          "Imagine some random situation we could talk about. Just briefly describe this situation and provide few examples how I could start the dialogue.",
      }
    ];
    const response = await openaiService.chat(startPromt, 0.45, 256);

    const text = response.content
    
    ctx.session.messages.push(
      {
        role: "system",
        content:
          "You are a teacher of English. The goal is to practice English. You will talk with your student about some imaginary situation. You should continue dialogue by this topic: " + text,
      }
    );

    await processTextToVoice(ctx, text)
    await ctx.reply(text);
    await ctx.reply('Start a dialogue by sending me an voice message 🎙️👇');
    
  } catch (e) {
    console.error("Error while processing text to gpt", e.message);
    ctx.reply("Sorry, I encountered an error while analyzing the dialogue.");
    ctx.session = {};
  }
}

export async function analyzeDialogue(ctx) {
  const systemPrompt =
    "You are a teacher of English. Use short messages. Analyze our user's dialog and assess their English level. Give tips on how to improve their English ";
  try {
    ctx.session.messages.push({
      role: openaiService.roles.SYSTEM,
      content: systemPrompt,
    });

    const response = await openaiService.chat(ctx.session.messages);

    await ctx.reply(response.content);

  } catch (e) {
    console.error("Error while processing text to gpt", e.message);
    ctx.reply("Sorry, I encountered an error while analyzing the dialogue.");
    ctx.session = {};
  }
}



