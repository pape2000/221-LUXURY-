export default async function handler(req, res) {
  try {
    const upstream = await fetch('https://221-luxury-beige.vercel.app/static-index.html', {
      cache: 'no-store',
      headers: { accept: 'text/html' }
    });

    if (!upstream.ok || !upstream.body) {
      throw new Error('Static storefront HTTP ' + upstream.status);
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let injected = false;

    const prelude = `<script>var handleFirebaseRedirect=window.handleFirebaseRedirect=window.handleFirebaseRedirect||function(){};(function(){const native=window.scrollTo;window.scrollTo=function(x,y){if(typeof x==='object'&&x&&Number(x.top)===0)return;if(typeof x==='number'&&Number(x)===0&&Number(y)===0)return;return native.apply(this,arguments);};})();<\/script>`;

    const injection = `
<script src="/supabase-config.js?v=live-final"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="/221-luxury-supabase-runtime.js?v=live-final-2"></script>
`;

    while (true) {
      const part = await reader.read();
      if (part.done) break;

      buffer += decoder.decode(part.value, { stream: true });

      if (!injected) {
        const marker = '</head>';
        const index = buffer.indexOf(marker);

        if (index === -1) {
          if (buffer.length > 512000) {
            res.write(buffer);
            buffer = '';
          }
          continue;
        }

        const headOpen=buffer.indexOf('<head>');
        if(headOpen===-1) throw new Error('HEAD_OPEN_NOT_FOUND');
        const headOpenEnd=headOpen+6;
        res.write(buffer.slice(0, headOpenEnd) + prelude + buffer.slice(headOpenEnd, index) + injection + buffer.slice(index));
        buffer = '';
        injected = true;
      } else {
        res.write(buffer);
        buffer = '';
      }
    }

    buffer += decoder.decode();
    if (buffer) res.write(buffer);

    res.end();
  } catch (error) {
    console.error('[221 LUXURY] streamed storefront failed', error);
    if (!res.headersSent) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    }
    res.end('Impossible de charger 221 LUXURY.');
  }
}
