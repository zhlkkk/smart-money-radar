export async function sendAlert(
  html: string,
  botToken: string,
  channelId: string,
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload = JSON.stringify({
    chat_id: channelId,
    text: html,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  });
  const headers = { 'Content-Type': 'application/json' };

  const response = await fetch(url, { method: 'POST', headers, body: payload });

  if (!response.ok) {
    const body = await response.text();
    await new Promise((r) => setTimeout(r, 2000));
    const retry = await fetch(url, { method: 'POST', headers, body: payload });
    if (!retry.ok) {
      throw new Error(`Telegram send failed after retry: ${retry.status} ${body}`);
    }
  }
}
