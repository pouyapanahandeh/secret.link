import { PubSub } from "@google-cloud/pubsub";
import pino from "pino";
import { analyzeContent } from "./analyze.js";

const logger = pino({ level: process.env["LOG_LEVEL"] ?? "info" });
const pubsub = new PubSub();
const subscriptionName = process.env["AI_SUBSCRIPTION"] ?? "ai-analysis-sub";

async function start() {
  const subscription = pubsub.subscription(subscriptionName);

  subscription.on("message", async (message) => {
    try {
      const data = JSON.parse(message.data.toString());
      await analyzeContent(data);
      message.ack();
    } catch (err) {
      logger.error({ err, messageId: message.id }, "Failed to analyze");
      message.nack();
    }
  });

  logger.info({ subscriptionName }, "AI worker started");
}

start().catch((err) => {
  logger.fatal({ err }, "Failed to start AI worker");
  process.exit(1);
});
