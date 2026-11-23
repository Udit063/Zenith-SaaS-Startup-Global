import http from 'node:http';
const port=4545;let count=0;
http.createServer(async(req,res)=>{
 if(req.method==='GET'&&req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({status:'ok',received:count}));}
 if(req.method!=='POST'||req.url!=='/internal/events'){res.writeHead(404);return res.end('Not found');}
 const chunks=[];for await(const c of req)chunks.push(c);
 let obj;try{obj=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{res.writeHead(400);return res.end('Invalid JSON');}
 const required=['event_id','event_type','transaction_id','payment_intent','customer_email','amount_total','currency','payment_status','occurred_at'];
 if(required.some(k=>!(k in obj))){res.writeHead(422);return res.end('Missing schema fields');}
 count++;console.log(JSON.stringify({received_event:obj.event_id,received_count:count}));
 res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,received_id:obj.event_id}));
}).listen(port,'127.0.0.1',()=>console.log(`Local receiver: http://127.0.0.1:${port}/internal/events`));
