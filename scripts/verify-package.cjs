const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),asar=require('@electron/asar');
const root=path.resolve(__dirname,'..'),archive=path.join(root,'dist','win-unpacked','resources','app.asar');
const files=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).build.files.filter(f=>/\.(js|css|html)$/.test(f));
for(const file of files)assert.ok(asar.extractFile(archive,file).equals(fs.readFileSync(path.join(root,file))),`${file} differs from the tested source`);
const installer=path.join(root,'dist','DECKROOM-Setup-1.0.0.exe');assert.ok(fs.statSync(installer).size>1000000);console.log(`PACKAGE_PASS ${files.length} runtime files match; installer ${fs.statSync(installer).size} bytes`);
