/**
 * Cloudflare Worker — Claude API proxy for the chess trainer.
 *
 * Keeps your Anthropic API key server-side so it never reaches the browser.
 *
 * Deploy:
 *   1. dash.cloudflare.com -> Workers & Pages -> Create -> Worker
 *   2. Paste this file in, Deploy
 *   3. Settings -> Variables -> add a SECRET named ANTHROPIC_API_KEY
 *   4. Settings -> Variables -> add a plain variable ALLOWED_ORIGIN
 *      set to your site's origin, e.g. https://yourname.github.io
 *   5. Copy the worker URL into the chess trainer's Settings tab
 */

export default {
  async fetch(request, env) {
    const allowed = env.ALLOWED_ORIGIN || '*';

    const cors = {
      'Access-Control-Allow-Origin': allowed,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: cors });
    }

    // Only serve the site you configured.
    const origin = request.headers.get('Origin');
    if (allowed !== '*' && origin && origin !== allowed) {
      return new Response('Forbidden', { status: 403, headers: cors });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Bad JSON', { status: 400, headers: cors });
    }

    // Clamp the request so a stolen endpoint can't be used for arbitrary jobs.
    const safeBody = {
      model: 'claude-sonnet-4-6',
      max_tokens: Math.min(body.max_tokens || 1000, 1500),
      messages: Array.isArray(body.messages) ? body.messages.slice(-2) : []
    };

    if (!safeBody.messages.length) {
      return new Response('No messages', { status: 400, headers: cors });
    }

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(safeBody)
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
};
