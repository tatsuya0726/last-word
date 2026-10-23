import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const args=process.argv.slice(2),value=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const root=path.resolve('dist'),port=Number(value('--port',4173)),host=value('--host','127.0.0.1');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.json':'application/json'};
http.createServer((req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const dest=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if(!dest.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  const stat=fs.statSync(dest);if(!stat.isFile()){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(dest)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache'});
  fs.createReadStream(dest).pipe(res);
 }catch{res.writeHead(404).end('Not found');}
}).listen(port,host,()=>console.log(`Last Word ready on port ${port}`));
