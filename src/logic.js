import { openaiService } from "./openai.js";
import { converter } from "./converter.js";
import { removeFile } from "./utils.js";

function initializeSession(ctx) {
  if (!ctx.session || typeof ctx.session !== "object") {
    ctx.session = { context: [], context_meta: [], startTime: new Date().toLocaleString('en-US', { hour12: false }) };
  }
}

export async function sendWelcomeMessage(ctx) {
  initializeSession(ctx);
  await ctx.reply(
    "What do you want to practice today?"
  );
}

export async function processTextToChat(ctx, content, type = 'text') {
  initializeSession(ctx);

  const messageId = ctx.message.message_id;
  const userId = ctx.from.id;
  
  ctx.session.context.push({ role: openaiService.roles.USER, content });
  if (type == 'text') {
    ctx.session.context_meta.push({
      role: 'user',
      message_id: messageId,
      type: 'text',
      text_message: content,
      date: Date.now(),
    });
  }

  try {
    const chatResponse = await openaiService.chat(ctx.session.context);

    if (chatResponse && chatResponse.message) {
      ctx.session.context.push({
        role: openaiService.roles.ASSISTANT,
        content: chatResponse.message.content,
      });

      ctx.session.context_meta.push({
        role: 'assistant',
        message_id: messageId,
        type: 'text',
        text_message: chatResponse.message.content,
        date: Date.now(),
        usage_tokens: chatResponse.usage_tokens,
      });

      return chatResponse.message.content;
    }
 
  } catch (e) {
    console.log("Error while processing text to gpt", e.message);
  }
}

export async function processVoiceMessage(ctx) {
  initializeSession(ctx);

  try {
    const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
    const userId = String(ctx.message.from.id);
    const messageId = ctx.message.message_id;
    const oggPath = await converter.create(link.href, userId, messageId);
    const mp3Path = await converter.toMp3(oggPath, messageId);

    removeFile(oggPath);

    const text = await openaiService.transcription(mp3Path);

    ctx.session.context_meta.push({
      role: 'user',
      user_id: userId,
      message_id: messageId,
      type: 'audio',
      path: link,
      duration: ctx.message.voice.duration,
      text_message: text,
      date: Date.now(),
    });

    return text;
  } catch (e) {
    console.log(`Error while voice message`, e.message);
  }
}

export async function processTextToVoice(ctx, content) {
 
  try {
    const userId = String(ctx.message.from.id);
    const mp3Path = await openaiService.textToSpeech(content, userId);
    const oggPath = await converter.toOgg(mp3Path, userId);

    return oggPath
  } catch (e) {
    await ctx.reply("🙈 Opps, something went wrong, try sending agai");
    console.log("Error while proccesing text to gpt", e.message);
  }
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
  initializeSession(ctx);

  const messageId = ctx.message.message_id;
  const userId = ctx.from.id;
  try {
    const fileLink = await getFileLink(ctx);
    ctx.session.context_meta.push({
      role: 'user',
      user_id: userId,
      message_id: messageId,
      type: 'photo',
      path: fileLink,
      date: Date.now(),
    });

    const analyzeImageResponse = await analyzeHomeworkImage(fileLink);
    const analyzeImageText = analyzeImageResponse.choices[0].message.content;
    
    ctx.session.context_meta.push({
      role: 'assistant',
      user_id: userId,
      message_id: messageId,
      type: 'photo',
      model: analyzeImageResponse.model,
      text_message: analyzeImageText,
      date: Date.now(),
      usage_tokens:  analyzeImageResponse.usage,
    });

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


    const chatResponse = await openaiService.chat(systemPrompt, 1.63);
    const text = chatResponse.message.content

    ctx.session.context.push({
      role: "system",
      content:
        "You are a teacher of English. Use short messages. Talk with your student based situation. " + text,
    });

    ctx.session.context_meta.push({
      role: 'assistant',
      message_id: messageId,
      type: 'text',
      text_message: text,
      date: Date.now(),
      usage_tokens: chatResponse.usage_tokens,
    });

   return text

  } catch (e) {
    console.error(`Error in processHomeworkSubmission: ${e.message}`, e);
    await ctx.reply(
      "Sorry, there was a problem analyzing your homework. Please try again later."
    );
  }
}