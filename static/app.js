const celebration=document.getElementById("celebration"),fx=celebration.getContext("2d");
let particles=[],fxFrame=null;
function resizeFx(){const dpr=Math.min(window.devicePixelRatio||1,2);celebration.width=innerWidth*dpr;celebration.height=innerHeight*dpr;celebration.style.width=innerWidth+"px";celebration.style.height=innerHeight+"px";fx.setTransform(dpr,0,0,dpr,0,0)}
window.addEventListener("resize",resizeFx);resizeFx();
function burst(x,y,count=70){
  for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=2+Math.random()*6;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:55+Math.random()*35,max:90,size:2+Math.random()*4,hue:38+Math.random()*18})}
}
function celebrate(jackpot=false){
  particles=[];burst(innerWidth*.25,innerHeight*.28,jackpot?110:70);burst(innerWidth*.75,innerHeight*.32,jackpot?110:70);
  setTimeout(()=>burst(innerWidth*.5,innerHeight*.2,jackpot?130:80),220);
  if(fxFrame)cancelAnimationFrame(fxFrame);
  const tick=()=>{fx.clearRect(0,0,innerWidth,innerHeight);particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.075;p.vx*=.992;p.life--;fx.globalAlpha=Math.max(0,p.life/p.max);fx.fillStyle=`hsl(${p.hue} 90% 60%)`;fx.beginPath();fx.arc(p.x,p.y,p.size,0,Math.PI*2);fx.fill()});fx.globalAlpha=1;particles=particles.filter(p=>p.life>0);if(particles.length)fxFrame=requestAnimationFrame(tick);else fx.clearRect(0,0,innerWidth,innerHeight)};tick();
}
const prizes=[10,20,30,40,50,88], canvas=document.getElementById("wheel"),ctx=canvas.getContext("2d"),btn=document.getElementById("spin"),statusEl=document.getElementById("status"),result=document.getElementById("result");
let rotation=0,busy=false;const arc=Math.PI*2/prizes.length;
function draw(){const c=450,r=414;ctx.clearRect(0,0,900,900);prizes.forEach((p,i)=>{let s=-Math.PI/2+i*arc,e=s+arc,g=ctx.createRadialGradient(c,c,60,c,c,r);g.addColorStop(0,i%2?"#d8a84f":"#7d571f");g.addColorStop(1,i%2?"#5b3911":"#1c1308");ctx.beginPath();ctx.moveTo(c,c);ctx.arc(c,c,r,s,e);ctx.closePath();ctx.fillStyle=g;ctx.fill();ctx.lineWidth=7;ctx.strokeStyle="#e3bd67";ctx.stroke();ctx.save();ctx.translate(c,c);ctx.rotate(s+arc/2);ctx.textAlign="right";ctx.textBaseline="middle";ctx.fillStyle="#fff0c4";ctx.font=`900 ${p===88?58:54}px Arial`;ctx.fillText(p+" $",r-58,0);if(p===88){ctx.font="900 22px Arial";ctx.fillText("JACKPOT",r-62,38)}ctx.restore()});ctx.beginPath();ctx.arc(c,c,92,0,Math.PI*2);ctx.fillStyle="#080604";ctx.fill();ctx.lineWidth=10;ctx.strokeStyle="#d9ae5a";ctx.stroke();ctx.fillStyle="#f2d184";ctx.textAlign="center";ctx.font="900 66px Georgia";ctx.fillText("88",c,c+18)}
draw();
const tg=window.Telegram?.WebApp; if(tg){tg.ready();tg.expand()}
function headers(){return {"Content-Type":"application/json","X-Telegram-Init-Data":tg?.initData||""}}
async function load(){try{let r=await fetch("/api/me",{headers:headers()}),d=await r.json();if(!r.ok)throw d;if(d.spins_available>0){statusEl.textContent="✅ Votre tour a été validé";btn.disabled=false}else{statusEl.textContent="🔒 Aucun tour disponible — validation requise";btn.disabled=true}}catch(e){statusEl.textContent="Ouvrez cette roulette depuis le bot Telegram.";btn.disabled=true}}
load();
btn.addEventListener("click",async()=>{if(busy)return;busy=true;btn.disabled=true;result.textContent="Bonne chance…";try{let r=await fetch("/api/spin",{method:"POST",headers:headers(),body:"{}"}),d=await r.json();if(!r.ok)throw d;let idx=prizes.indexOf(d.prize),cur=((rotation%360)+360)%360;
const slice=360/prizes.length;
// La flèche reste à l'intérieur du lot gagnant, avec une position visuelle aléatoire.
// Marge de sécurité pour éviter qu'elle tombe sur une séparation.
const margin=8;
const jitter=(Math.random()*2-1)*(slice/2-margin);
// Le centre du premier secteur (10 $) est à -60°, alors que la flèche est à -90°.
// Il faut donc appliquer un décalage supplémentaire de -30° pour aligner le bon secteur.
const target=(360-(idx*slice+slice/2+jitter))%360;
const delta=(target-cur+360)%360;
rotation+=360*7+delta;canvas.style.transform=`rotate(${rotation}deg)`;setTimeout(()=>{result.textContent=d.prize===88?"🏆 JACKPOT — 88 $ !":`🎉 Vous gagnez ${d.prize} $ !`;celebrate(d.prize===88);statusEl.textContent="Tour utilisé — en attente d'une nouvelle validation";busy=false},5750)}catch(e){result.textContent=e.error==="no_spin_available"?"Aucun tour disponible.":"Impossible d'effectuer le tirage.";busy=false}});
