import { Telegraf, session } from "telegraf";
import config from "config";
import { message } from "telegraf/filters";
import { code } from "telegraf/format";

import {
  sendWelcomeMessage,
  processTextToChat,
  processHomeworkSubmission,
  processVoiceMessage,
  processTextToVoice,
  analyzeDialogue,
  randomTopic,
  INITIAL_SESSION,
} from "./logic.js";

const bot = new Telegraf(config.get("TELEGRAM_TOKEN"));

bot.use(session())

function initializeSession(ctx) {
  ctx.session ??= INITIAL_SESSION;
}

bot.command("new", sendWelcomeMessage);

bot.command("start", sendWelcomeMessage);

bot.command("homework", async (ctx) => {
  await ctx.reply(code("Please send an image or photo of your homework 📸"));
});

bot.command("random", async (ctx) => {
  initializeSession(ctx);
  try {
    await ctx.reply(code("🤔 Just a minute, let me see what we have here"));
    await randomTopic(ctx);
  } catch (e) {
    console.log(`Error while handling text message`, e.message);
  }
});

bot.command("results", async (ctx) => {
  initializeSession(ctx);
  try {
    await ctx.reply(code("🤔 Just a minute, let me see what we have here"));
    await analyzeDialogue(ctx, ctx.message.text);
  } catch (e) {
    console.log(`Error while handling text message`, e.message);
  }
});



bot.on(message("text"), async (ctx) => {
  initializeSession(ctx);
  try {
    const text = await processTextToChat(ctx, ctx.message.text);
    
    await processTextToVoice(ctx, text);
    await ctx.reply(text);
    await ctx.reply('Start a dialogue by sending me an voice message 🎙️👇');
    
  } catch (e) {
    console.log(`Error while handling text message`, e.message);
  }
  console.log(ctx.session)
});

bot.on(message("photo"), async (ctx) => {
  initializeSession(ctx);
  try {
    await processHomeworkSubmission(ctx);
  } catch (e) {
    console.log(`Error while handling photo message`, e.message);
  }
});

bot.on(message("voice"), async (ctx) => {
  initializeSession(ctx);
  try {
    await ctx.reply(
      code("Message received. Waiting for a response from the server...")
    );

    const voiceText = await processVoiceMessage(ctx);

    await ctx.reply(code(`Your request: ${voiceText}`));

    const text = await processTextToChat(ctx, voiceText);

    await processTextToVoice(ctx, text);
    await ctx.reply(text);
  } catch (e) {
    console.log(`Error while voice message`, e.message);
  }
  console.log(ctx.session)
});

bot
  .launch()
  .then(() => console.log("Bot started successfully"))
  .catch((error) => console.error("Bot did not start", error));
