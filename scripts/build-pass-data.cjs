const fs=require('node:fs');
const sheets=JSON.parse(fs.readFileSync('pass-source-extract.json','utf8').replace(/^\uFEFF/,''));
const ids=['master-duel','hearthstone','might-magic'];
function parse(value,id) {
  const s=String(value||'').trim(); if(!s||s==='-')return {};
  if(/^\d+(\.0)?$/.test(s))return {[id==='master-duel'?'gems':'gold']:Number(s)};
  if(/^\d+골드$/.test(s))return {gold:parseInt(s)};
  const cp=s.match(/^(n|r|sr|ur)(\d+)$/); if(cp)return {[`${cp[1].toUpperCase()} 제작 포인트`]:Number(cp[2])};
  if(s.includes('경험치 부스트'))return {}; // Multipliers aren't additive currencies.
  const count=Number(s.match(/(\d+)[장종]/)?.[1]||1);
  return {[s.replace(/\s*\d+[장종]$/,'')]:count};
}
const output={};
sheets.forEach((sheet,i)=> {const cells=Object.fromEntries(sheet.cells.map(c=>[c.cell,c.value]));const levels=[];
 for(let row=2;row<=101;row++){const level=Number(String(cells[`A${row}`]).match(/\d+/)?.[0]);if(level!==row-1)throw Error(`Invalid grade ${row}`);levels.push({level,free:parse(cells[`B${row}`],ids[i]),paid:parse(cells[`C${row}`],ids[i]),source:`${sheet.name}!B${row}:C${row}`});}
 output[ids[i]]={levels,max:i===1?400:i===2?10000:100,repeat:i===1?{free:{gold:50},paid:{}}:i===2?{free:{},paid:{'무작위 포일 카드':1}}:null};});
fs.writeFileSync('pass-data.js','// Generated from the user workbook; run node scripts/build-pass-data.cjs.\nconst PASS_DATA = '+JSON.stringify(output,null,2)+';\n');
