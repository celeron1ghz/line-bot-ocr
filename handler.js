'use strict';

const aws = require('aws-sdk');
const rekognition = new aws.Rekognition();

const line = require('@line/bot-sdk');
const client = new line.Client({ channelAccessToken: process.env.LINE_ACCESS_TOKEN });

const crypto = require('crypto');
const ua = require('superagent');

module.exports.callback = async (event, context) => {
  try {
    const signature = crypto.createHmac('sha256', process.env.LINE_CHANNEL_SECRET).update(event.body).digest('base64');
    const checkHeader = (event.headers || {})['X-Line-Signature'];

    if (signature !== checkHeader) {
      console.log("signature check failed");

      return context.succeed({ statusCode: 403 });
    }

    const body = JSON.parse(event.body);
    const mess = body.events[0];

    if (mess.replyToken === '00000000000000000000000000000000') {
      // for line's connection test
      return context.succeed({ statusCode: 200 });
    }

    if (mess.message.type !== 'image') {
      await client.replyMessage(mess.replyToken, { 'type': 'text', 'text': '画像を投稿してね' })
      return context.succeed({ statusCode: 200 });
    }

    const res = await ua
      .get(`https://api.line.me/v2/bot/message/${mess.message.id}/content`)
      .set('Authorization', 'Bearer ' + process.env.LINE_ACCESS_TOKEN);

    const parsed = await rekognition.detectText({  Image: { Bytes: res.body } }).promise();
    const texts = parsed.TextDetections
        .map(e => e.DetectedText)
        .filter(t => t.match(/^[\w\d]{6,}$/) && t.match(/\w/) && t.match(/\d/))
        .filter((x, i, self)  => self.indexOf(x) === i);

    await client.replyMessage(mess.replyToken, {
      'type': 'text',
      'text': texts.length === 0 ? 'シリアルっぽい文字列が見当たりませんでした。' : texts.join("\n"),
    });

    return context.succeed({ statusCode: 200 });

  } catch (e) {
    console.log("Error: ", e);
    return context.succeed({ statusCode: 200 });
  }
};
