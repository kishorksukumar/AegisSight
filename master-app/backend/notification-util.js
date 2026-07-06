const nodemailer = require('nodemailer');
const db = require('./database');

// Memory map to track active metric alerts for each agent
// format: { 'agent_id:cpu': true/false, 'agent_id:ram': true/false }
const activeMetricAlerts = new Map();

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

async function sendNotification(subject, text) {
  const smtpEnabled = getSetting('notification_enabled_smtp') === 'true';
  const telegramEnabled = getSetting('notification_enabled_telegram') === 'true';

  console.log(`[Notification] Dispatching alert: "${subject}"`);

  // 1. SMTP Notification
  if (smtpEnabled) {
    try {
      const host = getSetting('notification_smtp_host');
      const port = parseInt(getSetting('notification_smtp_port'), 10) || 587;
      const user = getSetting('notification_smtp_user');
      const pass = getSetting('notification_smtp_pass');
      const from = getSetting('notification_smtp_from');
      const to = getSetting('notification_smtp_to');

      if (host && user && pass && to) {
        const transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465, // true for 465, false for other ports
          auth: { user, pass }
        });

        await transporter.sendMail({
          from: from || user,
          to,
          subject: `[AegisSight Alert] ${subject}`,
          text
        });
        console.log('✓ SMTP email sent successfully.');
      } else {
        console.warn('⚠️ SMTP is enabled but some settings are missing.');
      }
    } catch (err) {
      console.error('Error sending SMTP notification:', err.message);
    }
  }

  // 2. Telegram Notification
  if (telegramEnabled) {
    try {
      const token = getSetting('notification_telegram_bot_token');
      const chatId = getSetting('notification_telegram_chat_id');

      if (token && chatId) {
        const message = `*AegisSight Alert*\n\n*${subject}*\n${text}`;
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'Markdown'
          })
        });
        const resData = await response.json();
        if (response.ok && resData.ok) {
          console.log('✓ Telegram alert sent successfully.');
        } else {
          console.error('Telegram API error:', resData.description || 'Unknown error');
        }
      } else {
        console.warn('⚠️ Telegram is enabled but token or chatId is missing.');
      }
    } catch (err) {
      console.error('Error sending Telegram notification:', err.message);
    }
  }
}

async function testSmtpSettings(config) {
  const { host, port, user, pass, from, to } = config;
  const transporter = nodemailer.createTransport({
    host,
    port: parseInt(port, 10) || 587,
    secure: parseInt(port, 10) === 465,
    auth: { user, pass }
  });

  await transporter.sendMail({
    from: from || user,
    to,
    subject: '[AegisSight] SMTP Test Connection',
    text: 'This is a test notification confirming that your AegisSight SMTP configuration is working correctly!'
  });
}

async function testTelegramSettings(config) {
  const { token, chatId } = config;
  const message = `*AegisSight Bot Test*\n\nConnection test successful! This Telegram bot is now configured to receive alerts from your AegisSight server.`;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown'
    })
  });
  const resData = await response.json();
  if (!response.ok || !resData.ok) {
    throw new Error(resData.description || 'Failed to send message via Telegram Bot API');
  }
}

function checkTelemetryAlerts(agentId, hostname, cpuLoad, ramUsage) {
  const cpuThreshold = parseFloat(getSetting('notification_cpu_threshold')) || 2.0;
  const ramThreshold = parseFloat(getSetting('notification_ram_threshold')) || 80.0;

  const currentCpu = parseFloat(cpuLoad) || 0;
  const currentRam = parseFloat(ramUsage) || 0;

  // 1. CPU Alert Toggling
  const cpuKey = `${agentId}:cpu`;
  const cpuAlertActive = activeMetricAlerts.get(cpuKey) || false;
  if (currentCpu > cpuThreshold && !cpuAlertActive) {
    activeMetricAlerts.set(cpuKey, true);
    sendNotification(
      `High CPU Load: ${hostname}`,
      `Agent "${hostname}" (${agentId}) load average is currently ${currentCpu}, exceeding the threshold of ${cpuThreshold}.`
    );
  } else if (currentCpu <= cpuThreshold && cpuAlertActive) {
    activeMetricAlerts.set(cpuKey, false);
    sendNotification(
      `CPU Load Recovered: ${hostname}`,
      `Agent "${hostname}" (${agentId}) load average has returned to normal: ${currentCpu} (threshold: ${cpuThreshold}).`
    );
  }

  // 2. RAM Alert Toggling
  const ramKey = `${agentId}:ram`;
  const ramAlertActive = activeMetricAlerts.get(ramKey) || false;
  if (currentRam > ramThreshold && !ramAlertActive) {
    activeMetricAlerts.set(ramKey, true);
    sendNotification(
      `High Memory Usage: ${hostname}`,
      `Agent "${hostname}" (${agentId}) memory usage is currently ${currentRam}%, exceeding the threshold of ${ramThreshold}%.`
    );
  } else if (currentRam <= ramThreshold && ramAlertActive) {
    activeMetricAlerts.set(ramKey, false);
    sendNotification(
      `Memory Usage Recovered: ${hostname}`,
      `Agent "${hostname}" (${agentId}) memory usage has returned to normal: ${currentRam}% (threshold: ${ramThreshold}%).`
    );
  }
}

module.exports = {
  sendNotification,
  testSmtpSettings,
  testTelegramSettings,
  checkTelemetryAlerts
};
