const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../js/schedule.js','utf8'),ctx);const S=ctx.MMCSchedule;
const source=fs.readFileSync(__dirname+'/../js/app.js','utf8');vm.runInContext(source.slice(0,source.indexOf('$("enter").onclick'))+'globalThis.api={calc,blank,syncTemporal,durationNote};})();',ctx);const app=ctx.api;
let checks=0;const time=n=>String(Math.floor(n/60)%24).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
function schedule(parts,extra={}){let cursor=480;const blocks=parts.map(([minutes,type,recovery])=>{const b={start:time(cursor),end:time(cursor+minutes),type,recovery:recovery||''};cursor+=minutes;return b});return{start:'08:00',end:time(cursor),overnight:cursor>=1440,blocks,...extra}}
function expect(parts,cat,minutes,rest,extra={}){const s=schedule(parts,extra),before=JSON.stringify(s),r=S.analyze(s);assert.equal(JSON.stringify(s),before);assert.deepEqual(Array.from(r.problems),[]);assert.equal(r.category,cat);assert.equal(r.minutes,minutes);assert.equal(r.recoveryMinutes,rest);checks++;return r}
expect([[45,'mmc'],[45,'pausa']],'corta',45,45);
expect([[45,'mmc'],[15,'pausa']],'media',45,15);
expect([[90,'mmc'],[27,'pausa']],'media',90,27);
expect([[120,'mmc'],[36,'pausa']],'media',120,36);
expect([[90,'mmc'],[20,'pausa']],'larga',90,20,{postRecovery:'0'});
expect([[121,'mmc'],[36,'pausa']],'larga',121,36);
const manual=expect([[50,'mmc'],[10,'pausa'],[50,'mmc'],[10,'pausa'],[50,'mmc'],[70,'pausa']],'larga',170,70);assert.equal(manual.totalMMC,150);assert.equal(manual.shiftMinutes,240);checks++;
const separated=expect([[30,'mmc'],[30,'pausa'],[45,'mmc'],[45,'pausa']],'corta',45,45);assert.equal(separated.groups.length,2);assert.equal(separated.totalMMC,75);checks++;
expect([[50,'mmc'],[10,'pausa'],[50,'mmc'],[33,'pausa']],'media',110,33);
expect([[45,'mmc'],[45,'otra','si'],[45,'mmc'],[45,'pausa']],'corta',45,45);
expect([[45,'mmc'],[15,'otra','no'],[45,'mmc'],[32,'pausa']],'media',105,32);
expect([[45,'mmc']],'larga',45,0,{postRecovery:'45'});
expect([[45,'mmc']],'larga',45,0,{postRecovery:'0'});
expect([[45,'mmc'],[15,'pausa']],'media',45,15,{postRecovery:'30'});
const noPost=S.analyze(schedule([[45,'mmc']]));assert.equal(noPost.problems.length,0);assert.equal(noPost.category,'larga');assert.equal(noPost.recoveryMinutes,0);checks++;
assert.equal(S.analyze(schedule([[90,'mmc'],[20,'pausa']])).category,'larga');checks++;
for(const postRecovery of ['',0,45,1440,-1,'bad',true]){const s=schedule([[45,'mmc'],[15,'pausa']],{postRecovery}),r=S.analyze(s);assert.equal(r.problems.length,0);assert.equal(r.category,'media');assert.equal(r.recoveryMinutes,15);checks++}
assert.ok(!Object.hasOwn(S.blank(),'postRecovery'));
const night={start:'22:00',end:'00:00',overnight:true,postRecovery:'',blocks:[{start:'22:00',end:'23:00',type:'mmc'},{start:'23:00',end:'00:00',type:'pausa'}]};assert.equal(S.analyze(night).category,'corta');assert.equal(S.analyze(night).shiftMinutes,120);checks++;
const nine=expect([[540,'mmc'],[60,'pausa']],'larga',540,60);assert.equal(nine.extension,9);checks++;
const twelve=expect([[720,'mmc']],'larga',720,0,{postRecovery:'0'});assert.equal(twelve.extension,12);checks++;
assert.ok(S.analyze(schedule([[721,'mmc']],{postRecovery:'0'})).problems.some(x=>x.includes('12 horas')));checks++;
for(const mutate of [s=>s.blocks[0].start='08:01',s=>s.blocks[1].start='08:40',s=>s.blocks[1].end='09:29',s=>s.blocks[0].type='',s=>{s.blocks[1].type='otra';s.blocks[1].recovery=''},s=>s.blocks[0].start='25:00',s=>s.overnight='true']){const s=schedule([[45,'mmc'],[45,'pausa']]);mutate(s);if(s.overnight==='true'){s.end='07:00'}assert.ok(S.analyze(s).problems.length,JSON.stringify(s));checks++}
const shuffled=schedule([[45,'mmc'],[45,'pausa']]);shuffled.blocks.reverse();assert.equal(S.analyze(shuffled).category,'corta');checks++;
const base={peso:'15',horizontal:'25',vertical:'50',verticalDestino:'75',desplazamiento:'25',asimetria:'0',frecuencia:'3',agarre:'bueno',unaMano:'no',dosPersonas:'no',extension:'12',grupoDuracion:'larga',duracion:'999',recuperacion:'0',controlDestino:'no',horario:schedule([[45,'mmc'],[45,'pausa']])};
const result=app.calc(base);assert.ok(result.indices,JSON.stringify(result.problems));assert.equal(result.vals.FM,.88);assert.equal(result.vals.EM,1);assert.equal(result.duration.category,'corta');assert.ok(Math.abs(result.indices[0].index-15/(25*.93*.88))<1e-12);checks++;
const long=app.calc({...base,grupoDuracion:'corta',horario:schedule([[50,'mmc'],[10,'pausa'],[50,'mmc'],[10,'pausa'],[50,'mmc'],[70,'pausa']])});assert.equal(long.vals.FM,.55);assert.equal(long.duration.category,'larga');checks++;
const extended=app.calc({...base,horario:schedule([[540,'mmc'],[60,'pausa']])});assert.equal(extended.vals.EM,.97);checks++;
const invalid=app.calc({...base,horario:S.blank()});assert.equal(invalid.indices,undefined);assert.ok(invalid.problems.length);checks++;
const legacy=app.calc({...base,horario:undefined});assert.equal(legacy.indices,undefined);assert.match(legacy.problems.join(' '),/Complete el horario/);checks++;
const persisted=JSON.parse(JSON.stringify(base));assert.equal(app.calc(persisted).duration.category,'corta');checks++;
console.log(JSON.stringify({ok:true,checks,manualExample:{work:manual.minutes,recovery:manual.recoveryMinutes,totalMMC:manual.totalMMC,category:manual.category},overnight:true,missingDataBlocked:true,autoFM:true,autoExtension:true}));

