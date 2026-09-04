import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root = resolve(import.meta.dirname,'../dist');
const port = Number(process.env.PORT || 9897);
createServer(async (req,res)=> {
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if (!file.startsWith(root+'/')) {res.writeHead(403);res.end();return;}
    const types={'.html':'text/html;charset=utf-8','.zip':'application/zip','.svg':'image/svg+xml','.ico':'image/x-icon'};
    const bytes=await readFile(file);
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(bytes);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`LayerLock: http://127.0.0.1:${port}/`));
