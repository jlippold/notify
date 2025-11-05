const { SNSClient, CreateTopicCommand, PublishCommand, CreatePlatformEndpointCommand, SubscribeCommand, UnsubscribeCommand, GetTopicAttributesCommand } = require('@aws-sdk/client-sns');
const { query } = require('./db');

const sns = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

async function ensureTopic(slug, name) {
  const existing = await query('SELECT id, slug, sns_topic_arn FROM topics WHERE slug=$1', [slug]);
  if (existing.rows[0]?.sns_topic_arn) return existing.rows[0].sns_topic_arn;

  const topic = await sns.send(new CreateTopicCommand({ Name: slugToAwsName(slug) }));
  const arn = topic.TopicArn;
  if (existing.rows[0]) {
    await query('UPDATE topics SET sns_topic_arn=$1 WHERE id=$2', [arn, existing.rows[0].id]);
  } else {
    await query('INSERT INTO topics(slug, name, sns_topic_arn) VALUES ($1,$2,$3) ON CONFLICT (slug) DO UPDATE SET sns_topic_arn=EXCLUDED.sns_topic_arn', [slug, name || slug, arn]);
  }
  return arn;
}

function slugToAwsName(slug) {
  return slug.replace(/[^A-Za-z0-9-_:.]/g, '-');
}

async function createOrGetEndpoint({ platform, deviceToken }) {
  const platformArn = platform === 'ios' ? process.env.SNS_APNS_PLATFORM_ARN : process.env.SNS_FCM_PLATFORM_ARN;
  const cmd = new CreatePlatformEndpointCommand({ PlatformApplicationArn: platformArn, Token: deviceToken });
  const res = await sns.send(cmd);
  return res.EndpointArn;
}

async function subscribeDeviceToTopic(endpointArn, topicArn) {
  const res = await sns.send(new SubscribeCommand({ TopicArn: topicArn, Protocol: 'application', Endpoint: endpointArn }));
  return res.SubscriptionArn;
}

async function unsubscribeDeviceFromTopic(subscriptionArn) {
  await sns.send(new UnsubscribeCommand({ SubscriptionArn: subscriptionArn }));
}

async function publishToTopic(topicArn, payload) {
  const Message = buildPlatformMessage(payload);
  const params = { TopicArn: topicArn, MessageStructure: 'json', Message };
  const res = await sns.send(new PublishCommand(params));
  return res.MessageId;
}

async function publishToEndpoint(endpointArn, payload) {
  const Message = buildPlatformMessage(payload);
  const params = { TargetArn: endpointArn, MessageStructure: 'json', Message };
  const res = await sns.send(new PublishCommand(params));
  return res.MessageId;
}

function buildPlatformMessage({ title, body, sound, badge, link }) {
  const apnsPayload = {
    aps: {
      alert: { title, body },
      ...(sound ? { sound } : {}),
      ...(typeof badge === 'number' ? { badge } : {}),
    },
    ...(link ? { link } : {}),
  };
  const fcmPayload = {
    notification: { title, body, ...(sound ? { sound } : {}) },
    data: { ...(link ? { link } : {}) },
  };
  return JSON.stringify({
    default: body || title || 'Notification',
    APNS: JSON.stringify(apnsPayload),
    APNS_SANDBOX: JSON.stringify(apnsPayload),
    GCM: JSON.stringify(fcmPayload),
  });
}

module.exports = {
  ensureTopic,
  createOrGetEndpoint,
  subscribeDeviceToTopic,
  unsubscribeDeviceFromTopic,
  publishToTopic,
  publishToEndpoint,
};


