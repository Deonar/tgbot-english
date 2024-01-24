import { openaiService } from "./openai.js";
import { getCollection } from "./db.js";

export async function saveSession(ctx) {
  if (
    !ctx.session ||
    (!ctx.session.context.length && !ctx.session.context_meta.length)
  ) {
    console.log("No session data to save.");
    return;
  }

  const collection = await getCollection();
  const uniqueId = Date.now().toString();
  const endTime = new Date().toLocaleString('en-US', { hour12: false });

  await collection.insertOne({
    _id: uniqueId,
    user_id: ctx.from.id,
    start_time: ctx.session.startTime,
    end_time: endTime,
    context: ctx.session.context,
    context_meta: ctx.session.context_meta,
  });

  ctx.session = { context: [], context_meta: [] };
  console.log("Session saved to database.");
}

export async function randomTopic(ctx) {
  const messageId = ctx.message.message_id;
  const userId = ctx.from.id;
  saveSession(ctx);
  if (!ctx.session) {
    ctx.session = { context: [], context_meta: [], startTime: new Date().toLocaleString('en-US', { hour12: false }) };
  }

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
      },
    ];
    const response = await openaiService.chat(startPromt, 0.45, 256);

    const text = response.message.content;

    ctx.session.context.push({
      role: "system",
      content:
        "You are a teacher of English. The goal is to practice English. You will talk with your student about some imaginary situation. You should continue dialogue by this topic: " +
        text,
    });
    ctx.session.context_meta.push({
      role: "system",
      message_id: messageId,
      type: "text",
      text_message: text,
      date: Date.now(),
      usage_tokens: response.usage_tokens,
    });

    console.log(ctx.session.context.length)

    return text;
  } catch (e) {
    console.error("Error while processing text to gpt", e.message);
    ctx.reply("Sorry, I encountered an error while analyzing the dialogue.");
    ctx.session = {};
  }
}

export async function analyzeDialogue(ctx) {
  const messageId = ctx.message.message_id;
  const userId = ctx.from.id;

  if (!ctx.session) {
    ctx.session = { context: [], context_meta: [], startTime: new Date().toLocaleString('en-US', { hour12: false }) };
  }

  const systemPrompt =
    "You are a teacher of English. Use short messages. Analyze our user's dialog and assess their English level. Give tips on how to improve their English ";
  try {
    ctx.session.context.push({
      role: openaiService.roles.SYSTEM,
      content: systemPrompt,
    });

    const response = await openaiService.chat(ctx.session.context);

    const text = response.message.content;

    ctx.session.context.push({
      role: openaiService.roles.ASSISTANT,
      content: text,
    });

    ctx.session.context_meta.push({
      role: 'assistant',
      message_id: messageId,
      text_message: text,
      date: Date.now(),
      usage_tokens: response.usage_tokens,
    });

    saveSession(ctx);
    return text;
  } catch (e) {
    console.error("Error while processing text to gpt", e.message);
    ctx.reply("Sorry, I encountered an error while analyzing the dialogue.");
  }
}
