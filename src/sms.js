'use strict';
const fs = require('fs');
const path = require('path');
const { SMS } = require('./config');

// Sends sign-in codes by SMS.
// With Twilio settings (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM) the message goes to the phone.
// Without them, it is printed in the server terminal and saved in data/sms-outbox.log, for setting up and testing.

const OUTBOX = path.join(__dirname, '..', 'data', 'sms-outbox.log');
const configured = () => !!(SMS.TWILIO_SID && SMS.TWILIO_TOKEN && SMS.TWILIO_FROM);

async function send(to, text) {
  const e164 = `+${to}`;
  if (!configured()) {
    const line = `${new Date().toISOString()}  to ${e164}  ${text}`;
    console.log(`  [SMS not set up] ${line}`);
    fs.mkdirSync(path.dirname(OUTBOX), { recursive: true });
    fs.appendFileSync(OUTBOX, line + '\n');
    return { sent: false, outbox: true };
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(SMS.TWILIO_SID)}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${SMS.TWILIO_SID}:${SMS.TWILIO_TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ To: e164, From: SMS.TWILIO_FROM, Body: text })
  });
  if (!res.ok) {
    console.error('SMS failed:', res.status, await res.text().catch(() => ''));
    throw Object.assign(new Error('We could not send the SMS. Please try again in a minute.'), { status: 502 });
  }
  return { sent: true };
}

module.exports = { send, configured };
