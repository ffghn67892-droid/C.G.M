const {app,BrowserWindow}=require('electron'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');app.setPath('userData',path.join(root,'.qa-desktop'));app.commandLine.appendSwitch('qa-hidden');
require(path.join(process.env.DECKROOM_QA_ROOT||root,'desktop-main.js'));
app.whenReady().then(async()=>{try{
 const win=BrowserWindow.getAllWindows()[0];if(win.webContents.isLoading())await new Promise(resolve=>win.webContents.once('did-finish-load',resolve));
 const run=code=>win.webContents.executeJavaScript(code);
 assert.equal(await run("typeof window.deckroom.openShop"),'function');assert.equal(await run("typeof require"),'undefined');
 await run("resetGame('mtga');openSetup('mtga');let v=values();v.dailyWins=4;state.games.mtga=makeInitial('mtga',v);closeDialog();state.activeGame='mtga';save();renderAll()");assert.equal(await run("totals('mtga').gold"),550);
 await win.reload();if(win.webContents.isLoading())await new Promise(resolve=>win.webContents.once('did-finish-load',resolve));assert.equal(await run("totals('mtga').gold"),550);
 await run('window.deckroom.setTray(true)');await new Promise(r=>setTimeout(r,100));win.close();assert.equal(win.isDestroyed(),false);assert.equal(win.isVisible(),false);
 await run('window.deckroom.setTray(false)');await new Promise(r=>setTimeout(r,100));win.once('closed',()=>console.log('DESKTOP_SMOKE_PASS preload isolation, saved rewards on reload, close-to-tray and normal close'));win.close();
 }catch(error){console.error(error);app.exit(1);}});
