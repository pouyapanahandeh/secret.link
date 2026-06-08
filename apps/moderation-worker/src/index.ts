import { PubSub } from "@google-cloud/pubsub";
import pino from "pino";
import { moderateContent } from "./moderate.js";

const logger = pino({ level: process.env["LOG_LEVEL"] ?? "info" });
const pubsub = new PubSub();
const subscriptionName = process.env["MODERATION_SUBSCRIPTION"] ?? "moderation-sub";

async function start() {
  const subscription = pubsub.subscription(subscriptionName);

  subscription.on("message", async (message) => {
    try {
      const data = JSON.parse(message.data.toString());
      const result = await moderateContent(data);

      if (result.flagged) {
        logger.warn({ messageId: message.id, reasons: result.reasons }, "Content flagged");
      }

      message.ack();
    } catch (err) {
      logger.error({ err, messageId: message.id }, "Failed to moderate");
      message.nack();
    }
  });

  logger.info({ subscriptionName }, "Moderation worker started");
}

start().catch((err) => {
  logger.fatal({ err }, "Failed to start moderation worker");
  process.exit(1);
});
