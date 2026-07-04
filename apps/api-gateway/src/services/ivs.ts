import {
  IvsClient,
  CreateChannelCommand,
  GetStreamCommand,
  StopStreamCommand,
  type ChannelType,
  type ChannelLatencyMode,
} from "@aws-sdk/client-ivs";

// IVS is not available in eu-north-1; use eu-west-1 (Ireland).
// Streaming/viewing is global regardless of control-plane region.
const IVS_REGION = process.env["IVS_REGION"] ?? "eu-west-1";

// Credentials resolve via the default AWS provider chain. In production this is
// the EC2 instance-profile role (no static keys on disk). Static env keys are
// only used if explicitly present (e.g. local development).
const ivs = new IvsClient({ region: IVS_REGION });

export interface IvsChannel {
  channelArn: string;
  streamKeyValue: string;
  ingestEndpoint: string;
  playbackUrl: string;
}

/**
 * Create a new IVS channel. One channel per user, reused across streams.
 * Uses BASIC type ($0.20/hr) with LOW latency (<5s).
 */
export async function createIvsChannel(name: string): Promise<IvsChannel> {
  const res = await ivs.send(
    new CreateChannelCommand({
      name,
      type: "BASIC" as ChannelType,
      latencyMode: "LOW" as ChannelLatencyMode,
      authorized: false, // public playback (anonymous viewers)
    }),
  );

  if (!res.channel || !res.streamKey) {
    throw new Error("IVS CreateChannel returned incomplete response");
  }

  return {
    channelArn: res.channel.arn!,
    streamKeyValue: res.streamKey.value!,
    ingestEndpoint: res.channel.ingestEndpoint!,
    playbackUrl: res.channel.playbackUrl!,
  };
}

/**
 * Check if a channel is currently live.
 * Returns viewer count if live, null if offline.
 */
export async function getStreamStatus(
  channelArn: string,
): Promise<{ live: boolean; viewerCount: number; health: string } | null> {
  try {
    const res = await ivs.send(new GetStreamCommand({ channelArn }));
    if (!res.stream) return null;
    return {
      live: res.stream.state === "LIVE",
      viewerCount: res.stream.viewerCount ?? 0,
      health: res.stream.health ?? "UNKNOWN",
    };
  } catch (err: unknown) {
    // ChannelNotBroadcasting is expected when offline
    if ((err as { name?: string }).name === "ChannelNotBroadcasting") return null;
    throw err;
  }
}

/**
 * Force-stop a stream (admin or user ending their own stream).
 */
export async function stopStream(channelArn: string): Promise<void> {
  try {
    await ivs.send(new StopStreamCommand({ channelArn }));
  } catch (err: unknown) {
    // Ignore if not broadcasting
    if ((err as { name?: string }).name === "ChannelNotBroadcasting") return;
    throw err;
  }
}
