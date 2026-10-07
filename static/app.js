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
rotation+=360*7+delta;canvas.style.transform=`rotate(${rotation}deg)`;setTimeout(()=>{result.textContent="";safeCelebrate(d.prize);statusEl.textContent="Tour utilisé — en attente d'une nouvelle validation";busy=false},5750)}catch(e){result.textContent=e.error==="no_spin_available"?"Aucun tour disponible.":"Impossible d'effectuer le tirage.";busy=false}});


function safeCelebrate(prize){
  try{
    const layer=document.getElementById("celebration");
    const overlay=document.getElementById("win-overlay");
    const amount=document.getElementById("win-amount");
    const label=document.getElementById("win-label");
    if(!layer || !overlay || !amount || !label) return;
    const fx=layer.getContext("2d");
    if(!fx) return;

    const jackpot=Number(prize)===88;
    amount.textContent=`${prize} $`;
    label.textContent=jackpot?"★ JACKPOT 88 ★":"★ 88 POKER CLUB ★";
    overlay.classList.remove("show","jackpot");
    void overlay.offsetWidth;
    if(jackpot) overlay.classList.add("jackpot");
    overlay.classList.add("show");

    const dpr=Math.min(window.devicePixelRatio||1,2);
    const w=window.innerWidth,h=window.innerHeight;
    layer.width=Math.max(1,Math.floor(w*dpr));
    layer.height=Math.max(1,Math.floor(h*dpr));
    fx.setTransform(dpr,0,0,dpr,0,0);

    let particles=[];
    const burst=(x,y,count)=>{
      for(let i=0;i<count;i++){
        const a=Math.random()*Math.PI*2,speed=2.5+Math.random()*7;
        particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,
          life:70+Math.random()*35,max:105,size:1.8+Math.random()*4.5,
          hue:28+Math.random()*35,trail:Math.random()>.45});
      }
    };
    burst(w*.18,h*.27,jackpot?125:80);
    burst(w*.82,h*.27,jackpot?125:80);
    setTimeout(()=>burst(w*.5,h*.15,jackpot?150:95),260);
    if(jackpot) setTimeout(()=>{burst(w*.32,h*.20,90);burst(w*.68,h*.20,90)},620);

    const started=performance.now();
    function frame(){
      fx.clearRect(0,0,w,h);
      fx.globalCompositeOperation="lighter";
      for(const p of particles){
        const ox=p.x,oy=p.y;
        p.x+=p.vx;p.y+=p.vy;p.vy+=.045;p.vx*=.994;p.life--;
        const alpha=Math.max(0,p.life/p.max);
        fx.globalAlpha=alpha;
        fx.strokeStyle=fx.fillStyle=`hsl(${p.hue},100%,62%)`;
        if(p.trail){fx.lineWidth=Math.max(1,p.size*.55);fx.beginPath();fx.moveTo(ox,oy);fx.lineTo(p.x-p.vx*2.5,p.y-p.vy*2.5);fx.stroke()}
        fx.beginPath();fx.arc(p.x,p.y,p.size,0,Math.PI*2);fx.fill();
      }
      fx.globalAlpha=1;fx.globalCompositeOperation="source-over";
      particles=particles.filter(p=>p.life>0);
      if((particles.length || performance.now()-started<1700) && performance.now()-started<4300) requestAnimationFrame(frame);
      else fx.clearRect(0,0,w,h);
    }
    requestAnimationFrame(frame);
    clearTimeout(window.__winOverlayTimer);
    window.__winOverlayTimer=setTimeout(()=>overlay.classList.remove("show"),3600);
  }catch(e){}
}
