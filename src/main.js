import { Telegraf, session } from "telegraf";
import { message } from "telegraf/filters";
import config from "config";
import { code } from "telegraf/format";
import { randomTopic, analyzeDialogue } from "./scenes.js";
import {
  sendWelcomeMessage,
  processTextToChat,
  processVoiceMessage,
  processTextToVoice,
  processHomeworkSubmission,
} from "./logic.js";

const bot = new Telegraf(config.get("TELEGRAM_TOKEN"));

async function handleCommand(ctx, commandFunction, voiceReply = false) {
  try {
    const responseMessage = await commandFunction(ctx);
    if (voiceReply) {
      const oggPath = await processTextToVoice(ctx, responseMessage);
      await ctx.replyWithVoice({ source: oggPath });
    }
    await ctx.reply(responseMessage);
  } catch (e) {
    console.log(`Error while handling command: ${e.message}`);
    await ctx.reply("An error occurred, please try again.");
  }
}

bot.use(session());

bot.command("new", sendWelcomeMessage);

bot.command("start", sendWelcomeMessage);

bot.command("homework", async (ctx) => {
  await ctx.reply(code("Please send an image or photo of your homework 📸"));
});

bot.command("random", async (ctx) => {
  try {
    await ctx.reply(code("🤔 Just a minute, let me see what we have here"));

    await handleCommand(ctx, randomTopic, true);

    await ctx.reply(
      code("Start a dialogue by sending me an voice message 🎙️👇")
    );
  } catch (e) {
    console.log(`Error while handling text message`, e.message);
  }
});

bot.command("results", async (ctx) => {
  try {
    await ctx.reply(code("🤔 Just a minute, let me see what we have here"));
    await handleCommand(ctx, analyzeDialogue);
  } catch (e) {
    console.log(`Error while handling text message`, e.message);
  }
});


bot.on(message("text"), async (ctx) => {
  if (!ctx.message.text.startsWith("/")) {
    await handleCommand(ctx, () => processTextToChat(ctx, ctx.message.text), true);
  }
});

bot.on(message("voice"), async (ctx) => {
  await ctx.reply(
    code("Message received. Waiting for a response from the server...")
  );

  const voiceText = await processVoiceMessage(ctx);

  await ctx.reply(`Your request: ${voiceText}`);

  const responseMessage = await processTextToChat(ctx, voiceText, "voice");
  const oggPath = await processTextToVoice(ctx, responseMessage);

  //Send Voice to chat
  await ctx.replyWithVoice({ source: oggPath });
  //Send Text to chat
  await ctx.reply(responseMessage);
});

bot.on(message("photo"), async (ctx) => {
  await ctx.reply(code("🤔 Just a minute, let me see what we have here"));
  try {

    await handleCommand(ctx, () => processHomeworkSubmission(ctx), true);

    await ctx.reply(
      code("Start a dialogue by sending me an voice message 🎙️👇")
    );
  } catch (e) {
    console.log(`Error while handling photo message`, e.message);
  }
});

bot.launch().catch((error) => console.error(error));
