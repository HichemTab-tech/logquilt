import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {resolve,dirname,basename,extname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon','.png':'image/png','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8','.webmanifest':'application/manifest+json'};
const publicFiles = new Set(['/','/index.html','/favicon.svg','/favicon-16x16.png','/favicon-32x32.png','/apple-touch-icon.png','/icon-192.png','/icon-512.png','/social-preview.png','/robots.txt','/sitemap.xml','/site.webmanifest']);

export async function createViewerServer({file,root=resolve(projectRoot,'dist'),dev=false}={}) {
  const selected = file ? resolve(file) : null;
  let vite;
  const server = createServer(async(req,res)=>{
    const end = (code,message) => {res.writeHead(code,{'Content-Type':'text/plain; charset=utf-8'});res.end(message);};
    const port = server.address()?.port;
    const allowed = new Set([`127.0.0.1:${port}`,`localhost:${port}`]);
    const origin = req.headers.origin;
    if (!allowed.has(req.headers.host) || (origin && ![...allowed].some(host=>origin===`http://${host}`)) || req.headers['sec-fetch-site']==='cross-site') return end(403,'Local access only.');
    if (req.method!=='GET' && req.method!=='HEAD') return end(405,'Read-only viewer.');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Cache-Control','no-store');
    const pathname = new URL(req.url,'http://localhost').pathname;
    if (pathname.startsWith('/api/')) {
      res.setHeader('X-Robots-Tag','noindex, nofollow');
      let info;
      if (selected) {try {info=await stat(selected);} catch { /* File moved or unavailable. */ }}
      if (pathname==='/api/session') {
        res.writeHead(200,{'Content-Type':'application/json'});
        return res.end(JSON.stringify(info?.isFile()?{available:true,name:basename(selected),size:info.size}:{available:false}));
      }
      if (pathname!=='/api/transcript' || !info?.isFile()) return end(404,'No transcript selected. Open a JSONL file in the viewer.');
      res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Content-Length':info.size});
      if (req.method==='HEAD') return res.end();
      const stream = createReadStream(selected);
      stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
      return;
    }
    if (vite) return vite.middlewares(req,res,()=>end(404,'Not found.'));
    let decoded;
    try {decoded=decodeURIComponent(pathname);} catch {return end(400,'Invalid path.');}
    if (!publicFiles.has(decoded) && !decoded.startsWith('/assets/')) return end(404,'Not found.');
    const target=resolve(root,decoded==='/'?'index.html':`.${decoded}`);
    if (!target.startsWith(resolve(root)+sep) || !mime[extname(target)]) return end(404,'Not found.');
    try {
      const info=await stat(target);
      if (!info.isFile()) return end(404,'Not found.');
      res.writeHead(200,{'Content-Type':mime[extname(target)]});
      if (req.method==='HEAD') return res.end();
      const stream=createReadStream(target);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
    } catch {end(404,'Build the viewer first with npm run build.');}
  });
  if(dev) {
    vite=await (await import('vite')).createServer({root:projectRoot,server:{middlewareMode:true,hmr:{server},allowedHosts:['localhost','127.0.0.1'],fs:{strict:true,deny:['**/*.jsonl','**/*.ndjson','**/.env*','**/.git/**']}},appType:'spa'});
    server.on('close',()=>vite.close());
  }
  return server;
}

if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const args=process.argv.slice(2);
  const value=name=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
  const port=Number(value('--port') || 4173);
  if (!Number.isInteger(port) || port<1 || port>65535) {console.error('Choose a valid --port.');process.exit(1);}
  if (args.includes('--file') && (!value('--file') || value('--file').startsWith('--'))) {console.error('Provide a JSONL path after --file.');process.exit(1);}
  const server=await createViewerServer({dev:args.includes('--dev'),file:value('--file')});
  server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Port in use. Choose another with --port.':'Could not start the local viewer.');process.exit(1);});
  server.listen(port,'127.0.0.1',()=>console.log(`Logquilt: http://127.0.0.1:${port}`));
  for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(()=>process.exit(0)));
}
