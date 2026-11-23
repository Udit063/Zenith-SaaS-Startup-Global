import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { verifyAndParseEvent, mapPaymentEvent, forwardEvent } from './integration.js';
const env = resolve(process.cwd(), '.env');
if (existsSync(env)) for (const line of readFileSync(env,'utf8').split(/\r?\n/)) {
  if (!line.trim() || line.trim().startsWith('#')) continue;
  const eq = line.indexOf('=');
  if (eq > 0) { const key=line.slice(0,eq).trim(); if (!process.env[key]) process.env[key]=line.slice(eq+1).trim(); }
}
const port = Number(process.env.WEBHOOK_PORT || 4242);
const server=http.createServer(async(req,res)=>{
  if (req.method==='GET' && req.url==='/health') {res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({status:'ok',service:'webhook-starter'}));}
  if (req.url!=='/webhooks/stripe' || req.method!=='POST'){res.writeHead(404);return res.end('Not found');}
  const parts=[];let size=0;
  for await(const c of req){size+=c.length;if(size>1048576){res.writeHead(413);return res.end('Payload too large');}parts.push(c);}
  const rawBody=Buffer.concat(parts);
  try {
    // Mandatory implementation: verify signature BEFORE JSON decoding or forwarding.
    const event=await verifyAndParseEvent(rawBody,req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET);
    if(event.type!=='checkout.session.completed'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({received:true,ignored:true}));}
    const mapped=mapPaymentEvent(event);
    await forwardEvent(mapped,process.env.RECEIVER_URL,Number(process.env.FORWARD_TIMEOUT_MS||3000));
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({received:true}));
  }catch(err){let code=err.statusCode||500;res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify({error:err.message}));}
});
server.listen(port,'127.0.0.1',()=>console.log(`Webhook starter: http://127.0.0.1:${port}/webhooks/stripe`));
