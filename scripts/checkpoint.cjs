const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),name=process.argv[2];
if(!/^E[1-8]-before$/.test(name))throw Error('Invalid checkpoint');
const dest=path.join(root,'.refactor-checkpoints',name);if(fs.existsSync(path.join(dest,'manifest.json')))process.exit(0);
fs.mkdirSync(path.join(dest,'files'),{recursive:true});const files=[];
for(const dir of ['','tests','scripts'])for(const file of fs.readdirSync(path.join(root,dir),{withFileTypes:true}))if(file.isFile()&&/\.(js|cjs|css|html|md)$/.test(file.name)){
 const rel=path.join(dir,file.name),data=fs.readFileSync(path.join(root,rel));fs.mkdirSync(path.dirname(path.join(dest,'files',rel)),{recursive:true});fs.writeFileSync(path.join(dest,'files',rel),data);files.push({path:rel,sha256:crypto.createHash('sha256').update(data).digest('hex')});
}fs.writeFileSync(path.join(dest,'manifest.json'),JSON.stringify({files},null,2));
