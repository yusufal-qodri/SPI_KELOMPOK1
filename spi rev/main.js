// ═══════════════════════════════════════════════════════════════
//  THE CLIMATE SYSTEM — Cinematic Interactive Visualization
//  Source: Perdinan slides + Understanding Earth 6th Ed. + IPCC 2007
// ═══════════════════════════════════════════════════════════════
// 1. Deklarasi Variabel (Wajib ada di paling atas)
const C = document.getElementById('c'), X = C.getContext('2d');
let W, H, cx, cy, T = 0, scene = 0, transAlpha = 0, transitioning = false;

// 2. Fungsi Resize (Instruksi cara menghitung ukuran)
function resize() {
  W = C.width = window.innerWidth;
  H = C.height = window.innerHeight;
  cx = W / 2;
  cy = H / 2;
}

// 3. Eksekusi (Jalankan fungsinya)
resize(); // Jalankan sekali saat pertama kali buka
window.addEventListener('resize', resize); // Jalankan setiap kali layar HP diputar/diubah

// ── STATE ──
const S={co2:280,sunPower:1,iceLevel:1,forestLevel:1,temp:0,tog:{}};

function updateStats(){
  const hf=Math.max(0,(S.co2-280)/520);
  S.temp=Math.max(-0.5,hf*4.2+(1-S.iceLevel)*1.2+(1-S.forestLevel)*0.6);
  const q=(v,id)=>document.getElementById(id);
  document.getElementById('sf-temp').style.width=Math.min(100,S.temp/6*100)+'%';
  document.getElementById('sv-temp').textContent=(S.temp>=0?'+':'')+S.temp.toFixed(1)+'°C';
  document.getElementById('sf-co2').style.width=((S.co2-250)/600*100)+'%';
  document.getElementById('sv-co2').textContent=Math.round(S.co2)+'ppm';
  document.getElementById('sf-ice').style.width=(S.iceLevel*100)+'%';
  document.getElementById('sv-ice').textContent=Math.round(S.iceLevel*100)+'%';
  document.getElementById('sf-forest').style.width=(S.forestLevel*100)+'%';
  document.getElementById('sv-forest').textContent=Math.round(S.forestLevel*100)+'%';
}

// ── MATH UTILS ──
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rnd=(a,b)=>a+Math.random()*(b-a);
const ease=(t)=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
const easeIn=(t)=>t*t*t;
const easeOut=(t)=>1-Math.pow(1-t,3);
const sin=Math.sin,cos=Math.cos,PI=Math.PI,TAU=PI*2;

// Perlin noise
const _p=new Uint8Array(512);
(()=>{const p=new Uint8Array(256);for(let i=0;i<256;i++)p[i]=i;for(let i=255;i>0;i--){const j=~~(Math.random()*(i+1));[p[i],p[j]]=[p[j],p[i]];}for(let i=0;i<512;i++)_p[i]=p[i&255];})();
const _fade=t=>t*t*t*(t*(t*6-15)+10);
const _g2=(h,x,y)=>(h&=3,(h<2?x:-x)+(h&1?-y:y));
function noise(x,y){
  const X=~~x&255,Y=~~y&255;x-=~~x;y-=~~y;
  const u=_fade(x),v=_fade(y),a=_p[X]+Y,b=_p[X+1]+Y;
  return lerp(lerp(_g2(_p[a],x,y),_g2(_p[b],x-1,y),u),lerp(_g2(_p[a+1],x,y-1),_g2(_p[b+1],x-1,y-1),u),v);
}
function fbm(x,y,o=4){let v=0,a=.5,f=1,m=0;for(let i=0;i<o;i++){v+=noise(x*f,y*f)*a;m+=a;f*=2;a*=.5;}return v/m;}

// ── PARTICLE ENGINE ──
const POOL=[];const MAXP=3000;
class Particle{
  constructor(){this.alive=false;}
  init(x,y,o={}){
    this.x=x;this.y=y;this.vx=o.vx||0;this.vy=o.vy||0;
    this.ax=o.ax||0;this.ay=o.ay||0;
    this.life=1;this.decay=o.decay||.015;
    this.size=o.size||2;this.startSize=this.size;
    this.col=o.col||'#fff';this.col2=o.col2||null;
    this.glow=o.glow||0;this.drag=o.drag||1;
    this.wobble=o.wobble||0;this.wfreq=o.wfreq||.05;
    this.shape=o.shape||'circle';this.alive=true;
    this._t=0;return this;
  }
  step(){
    this._t++;
    if(this.wobble)this.vx+=sin(this._t*this.wfreq)*this.wobble;
    this.vx+=this.ax;this.vy+=this.ay;
    this.vx*=this.drag;this.vy*=this.drag;
    this.x+=this.vx;this.y+=this.vy;
    this.life-=this.decay;
    if(this.life<=0)this.alive=false;
  }
  draw(){
    if(!this.alive)return;
    const a=easeOut(this.life);
    X.save();X.globalAlpha=a;
    const s=Math.max(.1,this.size);
    if(this.glow>0){
      const g=X.createRadialGradient(this.x,this.y,0,this.x,this.y,s*this.glow);
      g.addColorStop(0,this.col);g.addColorStop(1,'transparent');
      X.beginPath();X.arc(this.x,this.y,s*this.glow,0,TAU);X.fillStyle=g;X.fill();
    }
    if(this.shape==='circle'){
      X.beginPath();X.arc(this.x,this.y,s,0,TAU);
      X.fillStyle=this.col2&&this.life<.4?this.col2:this.col;X.fill();
    }else if(this.shape==='cross'){
      X.strokeStyle=this.col;X.lineWidth=s*.5;
      X.beginPath();X.moveTo(this.x-s,this.y);X.lineTo(this.x+s,this.y);
      X.moveTo(this.x,this.y-s);X.lineTo(this.x,this.y+s);X.stroke();
    }
    X.restore();
  }
}
for(let i=0;i<MAXP;i++)POOL.push(new Particle());
let _pi=0;
function spawn(x,y,o={}){
  for(let i=0;i<MAXP;i++){const p=POOL[(_pi+i)%MAXP];if(!p.alive){_pi=(_pi+i+1)%MAXP;return p.init(x,y,o);}}
  return POOL[_pi++%MAXP].init(x,y,o);
}
function burst(x,y,n,o={}){
  for(let i=0;i<n;i++){
    const a=rnd(0,TAU),sp=rnd(o.spMin||1,o.spMax||5);
    spawn(x+rnd(-4,4),y+rnd(-4,4),{...o,vx:cos(a)*sp,vy:sin(a)*sp});
  }
}
function ring(x,y,n,o={}){
  for(let i=0;i<n;i++){
    const a=(TAU*i/n)+rnd(-.1,.1),sp=rnd(o.spMin||1,o.spMax||3);
    spawn(x,y,{...o,vx:cos(a)*sp,vy:sin(a)*sp});
  }
}

// ── COLOR UTIL ──
function hexToRgba(hex,a){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

// ── DRAW PRIMITIVES ──

// Stars
const STARS=Array.from({length:380},()=>({x:rnd(0,1),y:rnd(0,.92),s:rnd(.2,2),t:rnd(0,TAU),sp:rnd(.004,.025),l:~~rnd(0,3)}));
function drawStars(a=1){
  STARS.forEach(s=>{
    s.t+=s.sp;
    const alpha=a*(.15+.5*Math.abs(sin(s.t)));
    X.fillStyle=`rgba(${190+s.l*22},${210+s.l*18},255,${alpha})`;
    X.beginPath();X.arc(s.x*W,s.y*H,s.s,0,TAU);X.fill();
  });
}

// Milky Way band
function drawMilkyWay(alpha=.3){
  const g=X.createLinearGradient(0,H*.1,W,H*.6);
  g.addColorStop(0,'transparent');
  g.addColorStop(.2,`rgba(160,140,255,${alpha*.4})`);
  g.addColorStop(.5,`rgba(200,180,255,${alpha})`);
  g.addColorStop(.8,`rgba(150,130,240,${alpha*.5})`);
  g.addColorStop(1,'transparent');
  X.save();X.globalAlpha=1;
  X.fillStyle=g;
  X.beginPath();
  X.ellipse(cx,cy,W*.8,H*.12,-.25,0,TAU);
  X.fill();X.restore();
}

// Sun with full corona
function drawSun(x,y,r,power=1,t=0){
  const pulse=1+.04*sin(t*.028)+.02*sin(t*.07);
  const R=r*pulse*Math.sqrt(power);
  // Outer corona layers
  for(let i=4;i>=1;i--){
    const g=X.createRadialGradient(x,y,R,x,y,R*i*2.8);
    g.addColorStop(0,`rgba(255,${155+i*15},${35+i*8},${.05*power})`);
    g.addColorStop(1,'transparent');
    X.beginPath();X.arc(x,y,R*i*2.8,0,TAU);X.fillStyle=g;X.fill();
  }
  // Dynamic rays
  for(let i=0;i<20;i++){
    const angle=(TAU*i/20)+t*.005;
    const len=R*(.5+.55*Math.abs(sin(t*.018+i*.9)));
    const rg=X.createLinearGradient(x+cos(angle)*R,y+sin(angle)*R,x+cos(angle)*(R+len),y+sin(angle)*(R+len));
    rg.addColorStop(0,`rgba(255,${185+power*25},70,${.55*power})`);
    rg.addColorStop(1,'transparent');
    X.beginPath();X.moveTo(x+cos(angle)*R,y+sin(angle)*R);
    X.lineTo(x+cos(angle)*(R+len),y+sin(angle)*(R+len));
    X.strokeStyle=rg;X.lineWidth=1.5+power*.5;X.stroke();
  }
  // Prominence arcs
  for(let i=0;i<4;i++){
    const pa=t*.01+i*1.57,spx=x+cos(pa)*R,spy=y+sin(pa)*R;
    const pl=R*(.35+.2*sin(t*.04+i));
    const cpx=spx+cos(pa+.8)*pl,cpy=spy+sin(pa+.8)*pl;
    const epx=spx+cos(pa+1.5)*pl*.7,epy=spy+sin(pa+1.5)*pl*.7;
    X.save();X.globalAlpha=.5*power*(.5+.5*sin(t*.05+i));
    X.strokeStyle=`rgba(255,150,60,0.7)`;X.lineWidth=2.5;
    X.beginPath();X.moveTo(spx,spy);X.quadraticCurveTo(cpx,cpy,epx,epy);X.stroke();
    X.restore();
  }
  // Core
  const core=X.createRadialGradient(x-R*.3,y-R*.3,0,x,y,R);
  core.addColorStop(0,'#fffef0');core.addColorStop(.25,'#fff5b0');
  core.addColorStop(.6,`hsl(${38-power*8},100%,${54+power*5}%)`);
  core.addColorStop(1,'hsl(18,100%,42%)');
  X.beginPath();X.arc(x,y,R,0,TAU);X.fillStyle=core;X.fill();
  // Limb
  const limb=X.createRadialGradient(x,y,R*.45,x,y,R);
  limb.addColorStop(0,'transparent');limb.addColorStop(1,'rgba(160,50,0,.28)');
  X.beginPath();X.arc(x,y,R,0,TAU);X.fillStyle=limb;X.fill();
}

// Earth with detail
function drawEarth(x,y,r,rot=0){
  X.save();X.translate(x,y);
  // Space glow
  const eg=X.createRadialGradient(0,0,r*.85,0,0,r*2.2);
  eg.addColorStop(0,'rgba(25,70,130,.18)');eg.addColorStop(1,'transparent');
  X.beginPath();X.arc(0,0,r*2.2,0,TAU);X.fillStyle=eg;X.fill();
  X.rotate(rot);
  X.save();X.beginPath();X.arc(0,0,r,0,TAU);X.clip();
  // Ocean
  const oc=X.createRadialGradient(-r*.2,-r*.2,0,0,0,r);
  oc.addColorStop(0,'#1a6898');oc.addColorStop(.55,'#0b3e62');oc.addColorStop(1,'#051e35');
  X.fillStyle=oc;X.fillRect(-r,-r,r*2,r*2);
  // Ocean shimmer
  for(let i=0;i<8;i++){
    const sa=T*.001+i*.8,sr=r*(.3+.5*Math.abs(sin(i*.7)));
    const sg=X.createRadialGradient(cos(sa)*sr*.5,sin(sa)*sr*.4,0,cos(sa)*sr*.5,sin(sa)*sr*.4,r*.3);
    sg.addColorStop(0,`rgba(40,120,180,.12)`);sg.addColorStop(1,'transparent');
    X.fillStyle=sg;X.fillRect(-r,-r,r*2,r*2);
  }
  // Continents
  const fl=S.forestLevel;
  [
    [[-0.05,-0.6],[0.4,-0.55],[0.6,-0.3],[0.55,0.1],[0.2,0.2],[-0.1,0.15],[-0.35,0],[-0.4,-0.3]],
    [[-0.7,-0.55],[-0.45,-0.5],[-0.4,-0.2],[-0.5,0.1],[-0.6,0.5],[-0.75,0.6],[-0.8,0.3],[-0.75,-0.1]],
    [[0,0.15],[0.25,0.1],[0.3,0.3],[0.2,0.7],[0,.75],[-0.15,0.55],[-0.1,0.2]],
    [[0.5,0.25],[0.75,0.2],[0.8,0.45],[0.65,0.6],[0.45,0.5]],
  ].forEach(pts=>{
    X.save();X.beginPath();
    pts.forEach(([px,py],i)=>{const sx=px*r,sy=py*r;i?X.lineTo(sx,sy):X.moveTo(sx,sy);});
    X.closePath();
    const cg=X.createLinearGradient(0,-r*.5,0,r*.5);
    cg.addColorStop(0,`hsl(${115+fl*12},${38+fl*22}%,${18+fl*14}%)`);
    cg.addColorStop(1,`hsl(${105+fl*8},${28+fl*16}%,${12+fl*8}%)`);
    X.fillStyle=cg;X.fill();X.restore();
  });
  // Deserts (warm tones on continents)
  X.fillStyle='rgba(180,140,80,.1)';
  [[-.2,.05,.15,.12],[.15,.35,.1,.08]].forEach(([dx,dy,rx,ry])=>{
    X.beginPath();X.ellipse(dx*r,dy*r,rx*r,ry*r,0,0,TAU);X.fill();
  });
  // Ice caps
  const iL=S.iceLevel;
  const ic1=X.createRadialGradient(0,-r,0,0,-r,r*.5);
  ic1.addColorStop(0,`rgba(225,242,255,${iL*.92})`);ic1.addColorStop(1,'transparent');
  X.fillStyle=ic1;X.fillRect(-r,-r,r*2,r*.52);
  const ic2=X.createRadialGradient(0,r,0,0,r,r*.38);
  ic2.addColorStop(0,`rgba(215,238,255,${iL*.85})`);ic2.addColorStop(1,'transparent');
  X.fillStyle=ic2;X.fillRect(-r,r*.58,r*2,r*.42);
  // Cloud layer
  X.rotate(T*.0008);
  for(let i=0;i<8;i++){
    const ca=TAU*i/8+T*.0025,lat=sin(i*.9)*.55;
    const ccx=cos(ca)*r*.82,ccy=lat*r*.82;
    if(Math.hypot(ccx,ccy)>r*.92)continue;
    const cg=X.createRadialGradient(ccx,ccy,0,ccx,ccy,r*.22);
    cg.addColorStop(0,'rgba(255,255,255,.32)');cg.addColorStop(1,'transparent');
    X.beginPath();X.arc(ccx,ccy,r*.22,0,TAU);X.fillStyle=cg;X.fill();
  }
  X.restore();
  // Terminator
  const tg=X.createLinearGradient(-r*.28,0,r*.28,0);
  tg.addColorStop(0,'rgba(0,0,12,.72)');tg.addColorStop(.42,'rgba(0,0,8,.04)');
  tg.addColorStop(.55,'transparent');tg.addColorStop(1,'transparent');
  X.beginPath();X.arc(0,0,r,0,TAU);X.fillStyle=tg;X.fill();
  // Atmosphere halo
  const co2h=clamp((S.co2-280)/400,0,1);
  const atm=X.createRadialGradient(0,0,r*.95,0,0,r*1.14);
  atm.addColorStop(0,`rgba(${95+co2h*75},${155-co2h*38},255,.3)`);
  atm.addColorStop(.5,`rgba(${75+co2h*55},${135-co2h*28},225,.16)`);
  atm.addColorStop(1,'transparent');
  X.beginPath();X.arc(0,0,r*1.14,0,TAU);X.fillStyle=atm;X.fill();
  X.restore();
}

// Water droplet
function drawDrop(x,y,size,alpha,col='#4ab0e8'){
  X.save();X.globalAlpha=alpha;X.translate(x,y);
  X.fillStyle=col;X.strokeStyle='rgba(255,255,255,.3)';X.lineWidth=.8;
  X.beginPath();X.moveTo(0,-size*1.4);
  X.bezierCurveTo(size*.8,-size*.2,size,size*.8,0,size*1.2);
  X.bezierCurveTo(-size,size*.8,-size*.8,-size*.2,0,-size*1.4);
  X.fill();X.stroke();X.restore();
}

// Arrow with glow
function drawArrow(x1,y1,x2,y2,col,w=2,alpha=1,dashed=false){
  X.save();X.globalAlpha=alpha;
  const angle=Math.atan2(y2-y1,x2-x1);
  const len=Math.hypot(x2-x1,y2-y1);
  if(dashed){X.setLineDash([8,5]);}
  X.strokeStyle=col;X.lineWidth=w;
  X.shadowColor=col;X.shadowBlur=8;
  X.beginPath();X.moveTo(x1,y1);X.lineTo(x2,y2);X.stroke();
  X.setLineDash([]);X.shadowBlur=0;
  // Arrowhead
  const hs=8+w*2;
  X.fillStyle=col;X.beginPath();
  X.translate(x2,y2);X.rotate(angle);
  X.moveTo(0,0);X.lineTo(-hs,-hs*.45);X.lineTo(-hs*.5,0);X.lineTo(-hs,hs*.45);
  X.closePath();X.fill();X.restore();
}

// Molecule draw (CO2, H2O, CH4)
function drawMolecule(x,y,type,size,alpha){
  X.save();X.globalAlpha=alpha;
  if(type==='CO2'){
    X.fillStyle='#ff6b3d';X.strokeStyle='rgba(255,255,255,.3)';X.lineWidth=.8;
    [-size*1.5,0,size*1.5].forEach((dx,i)=>{
      X.beginPath();X.arc(x+dx,y,size*(i===1?.95:.7),0,TAU);
      X.fillStyle=i===1?'#ff8c5a':'#ff5533';X.fill();X.stroke();
    });
    X.strokeStyle='rgba(255,255,255,.5)';X.lineWidth=1.2;
    [[-size*.8,0],[size*.8,0]].forEach(([dx])=>{X.beginPath();X.moveTo(x+dx,y);X.lineTo(x+dx*.3,y);X.stroke();});
  }else if(type==='H2O'){
    X.fillStyle='#4ab0e8';X.strokeStyle='rgba(255,255,255,.3)';X.lineWidth=.8;
    [[0,0,size],[size*1.2,size*.6,size*.75],[-size*1.2,size*.6,size*.75]].forEach(([dx,dy,r])=>{
      X.beginPath();X.arc(x+dx,y+dy,r,0,TAU);X.fill();X.stroke();
    });
  }else if(type==='CH4'){
    X.fillStyle='#f0c040';X.strokeStyle='rgba(255,255,255,.3)';X.lineWidth=.8;
    X.beginPath();X.arc(x,y,size,0,TAU);X.fill();X.stroke();
    X.fillStyle='rgba(255,255,255,.6)';
    [[-size*1.5,-size*.8],[size*1.5,-size*.8],[0,size*1.6]].forEach(([dx,dy])=>{
      X.beginPath();X.arc(x+dx,y+dy,size*.6,0,TAU);X.fill();
    });
  }
  X.restore();
}

// ═══════════════════════════════════════════════════════════════
//  SCENE 0 — Komponen Sistem Iklim
//  Layout PERSIS gambar referensi:
//  LANGIT BIRU CERAH — awan hitam kiri, awan putih tengah, matahari kanan
//  DARATAN KIRI (rumah, pohon kelapa, gunung hijau) | PANTAI PASIR | LAUT BIRU TOSKA
//  TANAH BAWAH (layer infiltrasi, aliran air tanah)
// ═══════════════════════════════════════════════════════════════
let earthRot=0,moonAngle=0;

// ── STATIS: data yang tidak berubah tiap frame ──
const _s0={
  // Gelombang laut
  waves:Array.from({length:7},(_,i)=>({
    spd:0.013+i*0.005, amp:1.8+i*0.9, freq:0.010+i*0.003,
    phase:rnd(0,TAU), alpha:0.07+i*0.025,
    col:`rgba(${60+i*14},${170+i*7},${215-i*3},0.8)`
  })),
  // Tetesan hujan (zona kiri: 0.01–0.47 W)
  rain:Array.from({length:65},()=>({
    x:rnd(0.01,0.47), y:rnd(-0.18,0.63),
    sp:rnd(6,14), len:rnd(7,16), alpha:rnd(0.35,0.75)
  })),
  // Uap air (garis bergelombang dari laut)
  vapors:Array.from({length:10},(_,i)=>({
    x:0.58+i*0.042, phase:rnd(0,TAU), sp:rnd(0.8,1.5)
  })),
  // Batu pantai
  rocks:[{x:0.497,s:0.010},{x:0.515,s:0.013},{x:0.532,s:0.008},{x:0.548,s:0.011}],
  // Semak/tanaman kecil di daratan
  bushes:[
    {x:0.05,s:0.022},{x:0.13,s:0.018},{x:0.35,s:0.020},{x:0.44,s:0.016}
  ],
};

// ── HELPER: pohon kelapa realistis (batang bezier, pelepah kurva) ──
function _palm(px,py,ph,lean,t2,fl){
  const c1=`hsl(${108+fl*16},${56+fl*18}%,${20+fl*14}%)`;
  const c2=`hsl(${118+fl*12},${62+fl*14}%,${30+fl*10}%)`;
  const c3=`hsl(${128+fl*8}, ${66+fl*10}%,${40+fl*6}%)`;
  const bw=ph*0.040;
  const sway=sin(t2*0.016+lean*4)*0.032;
  X.save();X.translate(px,py);

  // Batang bezier melengkung — shadow dulu
  X.save();X.globalAlpha=0.18;
  X.fillStyle='rgba(0,0,0,0.5)';
  const sx=lean*ph*1.15+bw*1.2;
  X.beginPath();
  X.moveTo(bw*0.4,0);
  X.bezierCurveTo(bw*0.5+lean*ph*0.2,-ph*0.36,sx*0.9-bw*0.3,-ph*0.72,sx-bw*0.5,-ph);
  X.bezierCurveTo(sx+bw*0.5,-ph,sx+bw*1.1+lean*ph*0.2,-ph*0.72,bw*1.6+lean*ph*0.2,-ph*0.36);
  X.closePath();X.fill();X.restore();

  // Batang utama — gradasi
  const tg=X.createLinearGradient(-bw,0,bw*2,0);
  tg.addColorStop(0,'#1a0c04');tg.addColorStop(0.3,'#6a3c18');tg.addColorStop(0.6,'#8a5428');tg.addColorStop(1,'#3a1c08');
  X.fillStyle=tg;
  const tx=lean*ph*1.15;
  X.beginPath();
  X.moveTo(-bw*0.5,0);
  X.bezierCurveTo(-bw*0.4+lean*ph*0.2,-ph*0.36,tx-bw*0.5,-ph*0.72,tx-bw*0.4,-ph);
  X.bezierCurveTo(tx+bw*0.4,-ph,tx+bw*0.5,-ph*0.72,bw*0.4+lean*ph*0.2,-ph*0.36);
  X.closePath();X.fill();

  // Lingkaran ruas batang
  X.save();X.globalAlpha=0.22;X.strokeStyle='rgba(0,0,0,0.6)';X.lineWidth=0.9;
  for(let ri=1;ri<7;ri++){
    const ry=-ph*(ri/7), rx=lean*ph*(ri/7)*0.9;
    X.beginPath();X.moveTo(rx-bw*(0.9-ri*0.08),ry);X.lineTo(rx+bw*(0.55-ri*0.05),ry);X.stroke();
  }
  X.restore();

  // Pelepah daun (8 helai menyebar dari puncak)
  const topX=tx, topY=-ph;
  for(let li=0;li<8;li++){
    const baseA=(li/8)*TAU;
    const ls=sway*cos(baseA+t2*0.02);
    const llen=ph*(0.50+0.12*sin(li*1.4));
    const lw=ph*0.025*(1.1-li*0.03);
    X.save();X.translate(topX,topY);X.rotate(baseA*0.48-PI*0.22+ls);
    // Gradient daun
    const lg=X.createLinearGradient(0,0,llen*0.9,0);
    lg.addColorStop(0,c2);lg.addColorStop(0.4,c1);lg.addColorStop(0.75,c1);lg.addColorStop(1,'transparent');
    X.strokeStyle=lg;X.lineWidth=lw;X.lineCap='round';
    X.beginPath();X.moveTo(0,0);
    X.bezierCurveTo(llen*0.3,ph*0.10+sin(li)*ph*0.04, llen*0.65,ph*0.20+cos(li)*ph*0.05, llen,ph*0.28+sin(li*0.8)*ph*0.07);
    X.stroke();
    // Tulang tengah daun
    X.strokeStyle=`rgba(15,50,10,0.28)`;X.lineWidth=0.8;
    X.beginPath();X.moveTo(0,0);X.quadraticCurveTo(llen*0.45,ph*0.08,llen*0.88,ph*0.24);X.stroke();
    X.restore();
  }

  // Buah kelapa (3 biji di pangkal pelepah)
  X.save();X.translate(topX,topY+ph*0.038);
  for(let ci=0;ci<3;ci++){
    const ca=ci*2.09+0.5, cr=ph*0.062;
    const kcx=cos(ca)*ph*0.065, kcy=sin(ca)*ph*0.042+ph*0.055;
    const kg=X.createRadialGradient(kcx-cr*0.2,kcy-cr*0.2,0,kcx,kcy,cr);
    kg.addColorStop(0,'#7a4818');kg.addColorStop(0.5,'#4a2808');kg.addColorStop(1,'#281404');
    X.fillStyle=kg;X.beginPath();X.arc(kcx,kcy,cr,0,TAU);X.fill();
  }
  X.restore();
  X.restore();
}

// ── HELPER: rumah seperti gambar (atap coklat-merah, dinding putih, jendela) ──
function _house0(hx,hy,hw,hh){
  X.save();X.translate(hx,hy);

  // Shadow tanah
  X.save();X.globalAlpha=0.15;
  const sg=X.createRadialGradient(0,hh*0.06,0,0,hh*0.06,hw*0.9);
  sg.addColorStop(0,'rgba(0,0,0,0.55)');sg.addColorStop(1,'transparent');
  X.fillStyle=sg;X.fillRect(-hw*0.95,0,hw*1.9,hh*0.14);X.restore();

  // Dinding utama (putih agak krem)
  const wg=X.createLinearGradient(-hw*0.5,0,hw*0.5,-hh*0.55);
  wg.addColorStop(0,'#ddd5c0');wg.addColorStop(0.5,'#f0e8d8');wg.addColorStop(1,'#e8e0d0');
  X.fillStyle=wg;X.fillRect(-hw*0.5,-hh*0.55,hw,hh*0.55);
  // Garis bata horizontal (tipis)
  X.save();X.globalAlpha=0.07;X.strokeStyle='#806050';X.lineWidth=0.8;
  for(let bi=1;bi<6;bi++){X.beginPath();X.moveTo(-hw*0.5,-hh*0.55*(bi/6));X.lineTo(hw*0.5,-hh*0.55*(bi/6));X.stroke();}
  X.restore();

  // Atap — coklat kemerahan, bentuk segitiga dengan overhang
  const rg=X.createLinearGradient(0,-hh,0,-hh*0.52);
  rg.addColorStop(0,'#7a2010');rg.addColorStop(0.45,'#9a3418');rg.addColorStop(1,'#8a2c14');
  X.fillStyle=rg;
  X.beginPath();X.moveTo(-hw*0.65,-hh*0.55);X.lineTo(0,-hh);X.lineTo(hw*0.65,-hh*0.55);X.closePath();X.fill();
  // Highlight tepi atap
  X.save();X.globalAlpha=0.18;X.fillStyle='rgba(255,230,200,1)';
  X.beginPath();X.moveTo(-hw*0.65,-hh*0.55);X.lineTo(0,-hh);X.lineTo(-hw*0.05,-hh*0.92);X.lineTo(-hw*0.58,-hh*0.52);X.closePath();X.fill();
  X.restore();
  // Cerobong
  X.fillStyle='#6a2010';X.fillRect(hw*0.18,-hh*0.96,hw*0.12,hh*0.22);
  X.fillStyle='#7a2818';X.fillRect(hw*0.16,-hh*0.98,hw*0.16,hh*0.04);

  // Pintu (coklat tua, lengkung atas)
  X.fillStyle='#5a2e0a';
  X.beginPath();X.rect(-hw*0.13,-hh*0.55,hw*0.26,hh*0.38);X.fill();
  X.beginPath();X.arc(0,-hh*0.55+hw*0.0,hw*0.13,PI,0);X.fill();
  // Gagang pintu
  X.fillStyle='#d4a020';X.beginPath();X.arc(hw*0.07,-hh*0.38,hw*0.025,0,TAU);X.fill();
  // Strip pintu tengah
  X.strokeStyle='rgba(0,0,0,0.2)';X.lineWidth=1;X.beginPath();X.moveTo(0,-hh*0.55);X.lineTo(0,-hh*0.17);X.stroke();

  // Jendela (kiri & kanan)
  const _win=(wx)=>{
    X.fillStyle='rgba(160,210,255,0.65)';X.fillRect(wx-hw*0.11,-hh*0.50,hw*0.22,hh*0.22);
    // Frame
    X.strokeStyle='#8a7050';X.lineWidth=1.8;X.strokeRect(wx-hw*0.11,-hh*0.50,hw*0.22,hh*0.22);
    // Bilah tengah
    X.lineWidth=1.0;X.beginPath();X.moveTo(wx,-hh*0.50);X.lineTo(wx,-hh*0.28);X.stroke();
    X.beginPath();X.moveTo(wx-hw*0.11,-hh*0.39);X.lineTo(wx+hw*0.11,-hh*0.39);X.stroke();
    // Pantulan cahaya
    X.save();X.globalAlpha=0.25;X.fillStyle='rgba(255,255,255,0.9)';
    X.fillRect(wx-hw*0.09,-hh*0.48,hw*0.07,hh*0.07);X.restore();
  };
  _win(-hw*0.34);_win(hw*0.34);
  X.restore();
}

// ── HELPER: pondok bambu kecil (tengah daratan seperti gambar) ──
function _hut(hx,hy,hw,hh){
  X.save();X.translate(hx,hy);
  // Dinding (coklat alami)
  const wg=X.createLinearGradient(-hw*0.5,0,hw*0.5,-hh*0.55);
  wg.addColorStop(0,'#a87840');wg.addColorStop(1,'#c8a060');
  X.fillStyle=wg;X.fillRect(-hw*0.5,-hh*0.50,hw,hh*0.50);
  // Atap jerami (segitiga tinggi seperti pondok tropis)
  const rg=X.createLinearGradient(0,-hh,0,-hh*0.48);
  rg.addColorStop(0,'#6a4010');rg.addColorStop(0.6,'#8a5828');rg.addColorStop(1,'#704818');
  X.fillStyle=rg;
  X.beginPath();X.moveTo(-hw*0.62,-hh*0.50);X.lineTo(0,-hh);X.lineTo(hw*0.62,-hh*0.50);X.closePath();X.fill();
  // Tekstur jerami
  X.save();X.globalAlpha=0.12;X.strokeStyle='#402008';X.lineWidth=0.8;
  for(let ri=0;ri<5;ri++){
    const ry=-hh*(0.52+ri*0.1);
    X.beginPath();X.moveTo(-hw*(0.62-ri*0.08),ry);X.lineTo(hw*(0.62-ri*0.08),ry);X.stroke();
  }
  X.restore();
  // Pintu kecil
  X.fillStyle='#381a04';X.beginPath();X.rect(-hw*0.15,-hh*0.50,hw*0.30,hh*0.35);X.fill();
  X.restore();
}

// ── HELPER: awan realistis (gelap atau putih) ──
function _cld0(cx2,cy2,cw,dark,alpha){
  const base=dark?[75,75,95]:[232,242,255];
  const top=dark?[55,55,78]:[255,255,255];
  const puffs=dark
    ?[{dx:-0.42,dy:0.14,r:0.36},{dx:-0.14,dy:-0.06,r:0.50},{dx:0.16,dy:0.02,r:0.44},{dx:0.44,dy:0.16,r:0.32},{dx:-0.60,dy:0.24,r:0.24},{dx:0.28,dy:-0.08,r:0.28}]
    :[{dx:-0.36,dy:0.10,r:0.32},{dx:-0.06,dy:-0.10,r:0.46},{dx:0.24,dy:0.02,r:0.40},{dx:0.50,dy:0.14,r:0.26},{dx:0.08,dy:0.14,r:0.30}];
  X.save();X.globalAlpha=alpha;
  // Bayangan bawah awan
  X.save();X.globalAlpha=dark?0.10:0.04;
  X.fillStyle=dark?'rgba(40,40,70,1)':'rgba(100,140,200,1)';
  X.beginPath();X.ellipse(cx2,cy2+cw*0.26,cw*0.52,cw*0.075,0,0,TAU);X.fill();X.restore();
  // Puff utama (belakang→depan)
  [...puffs].sort((a,b)=>a.dy-b.dy).forEach(p=>{
    const px2=cx2+p.dx*cw, py2=cy2+p.dy*cw*0.52;
    const pr=p.r*cw*0.40;
    // AO bawah puff
    if(dark){
      X.save();X.globalAlpha=0.22;
      const ao=X.createRadialGradient(px2,py2+pr*0.4,0,px2,py2+pr*0.4,pr);
      ao.addColorStop(0,'rgba(20,20,40,0.5)');ao.addColorStop(1,'transparent');
      X.beginPath();X.arc(px2,py2,pr,0,TAU);X.fillStyle=ao;X.fill();X.restore();
    }
    const cg=X.createRadialGradient(px2-pr*0.22,py2-pr*0.28,pr*0.04,px2,py2,pr);
    cg.addColorStop(0,`rgba(${top[0]},${top[1]},${top[2]},0.97)`);
    cg.addColorStop(0.4,`rgba(${base[0]+22},${base[1]+22},${base[2]+18},0.88)`);
    cg.addColorStop(0.78,`rgba(${base[0]},${base[1]},${base[2]},0.68)`);
    cg.addColorStop(1,'transparent');
    X.beginPath();X.arc(px2,py2,pr,0,TAU);X.fillStyle=cg;X.fill();
  });
  X.restore();
}

// ── HELPER: panel label (rounded, tidak overlap) ──
function _lbl0(txt,sub,lx,ly,col){
  X.save();
  X.font='bold 12px "Courier New"';
  const tw=X.measureText(txt).width, pad=11, bh=sub?38:22, r=5;
  const bx=lx-tw/2-pad, by=ly-17;
  X.globalAlpha=0.80;
  X.fillStyle='rgba(3,7,20,0.84)';X.strokeStyle=col+'99';X.lineWidth=1.1;
  X.beginPath();
  X.moveTo(bx+r,by);X.lineTo(bx+tw+pad*2-r,by);X.arcTo(bx+tw+pad*2,by,bx+tw+pad*2,by+r,r);
  X.lineTo(bx+tw+pad*2,by+bh-r);X.arcTo(bx+tw+pad*2,by+bh,bx+tw+pad*2-r,by+bh,r);
  X.lineTo(bx+r,by+bh);X.arcTo(bx,by+bh,bx,by+bh-r,r);
  X.lineTo(bx,by+r);X.arcTo(bx,by,bx+r,by,r);
  X.closePath();X.fill();X.stroke();
  X.globalAlpha=1;
  X.fillStyle=col;X.textAlign='center';X.shadowColor=col;X.shadowBlur=9;
  X.fillText(txt,lx,ly);
  if(sub){X.shadowBlur=0;X.font='9px "Courier New"';X.fillStyle='rgba(255,255,255,0.48)';X.fillText(sub,lx,ly+14);}
  X.restore();
}

function scene0(t){
  // ══ ZONA LAYOUT persis gambar referensi ══
  // SKY:        0 → GY=62%H   (langit biru terang)
  // DARATAN:    GY → UY=73%H  x=0 → LX=52%W
  // PANTAI:     GY → UY        x=LX → OX=61%W
  // LAUT:       GY → H         x=OX → W
  // UNDERGROUND:UY → H         x=0 → OX
  const GY=H*0.62, UY=H*0.73, LX=W*0.52, OX=W*0.61;

  // ══════════════════════════════════════
  // 1. LANGIT — biru toska cerah seperti gambar
  // ══════════════════════════════════════
  const skyG=X.createLinearGradient(0,0,0,GY);
  skyG.addColorStop(0,'#72c8e8');skyG.addColorStop(0.3,'#88d4f0');
  skyG.addColorStop(0.65,'#a0dff5');skyG.addColorStop(1,'#b8eaf8');
  X.fillStyle=skyG;X.fillRect(0,0,W,GY+1);

  // ══════════════════════════════════════
  // 2. MATAHARI kanan atas — kuning, sinar zigzag oranye
  // ══════════════════════════════════════
  const SX=W*0.925,SY=H*0.108,SR=Math.min(W,H)*0.062;
  // Glow luar berlapis
  for(let gi=4;gi>=1;gi--){
    const gg=X.createRadialGradient(SX,SY,SR,SX,SY,SR*gi*2.0);
    gg.addColorStop(0,`rgba(255,195,40,${0.07/gi})`);gg.addColorStop(1,'transparent');
    X.beginPath();X.arc(SX,SY,SR*gi*2.0,0,TAU);X.fillStyle=gg;X.fill();
  }
  // Badan matahari
  const sunC=X.createRadialGradient(SX-SR*0.28,SY-SR*0.28,0,SX,SY,SR);
  sunC.addColorStop(0,'#fff8c0');sunC.addColorStop(0.35,'#ffe448');sunC.addColorStop(0.72,'#ffc018');sunC.addColorStop(1,'#f09500');
  X.beginPath();X.arc(SX,SY,SR,0,TAU);X.fillStyle=sunC;X.fill();
  // Sinar zigzag oranye (persis gambar)
  X.save();X.strokeStyle='rgba(255,145,20,0.80)';X.lineWidth=2.8;X.lineCap='round';
  for(let ri=0;ri<12;ri++){
    const ra=(TAU*ri/12)+t*0.007;
    const r0=SR*1.18, rM=SR*(1.38+0.08*sin(t*0.05+ri)), r1=SR*(1.62+0.10*cos(t*0.04+ri));
    X.beginPath();
    X.moveTo(SX+cos(ra)*r0,SY+sin(ra)*r0);
    X.lineTo(SX+cos(ra+0.13)*rM,SY+sin(ra+0.13)*rM);
    X.lineTo(SX+cos(ra+0.26)*r1,SY+sin(ra+0.26)*r1);
    X.stroke();
  }
  X.restore();

  // ══════════════════════════════════════
  // 3. GUNUNG HIJAU di latar belakang
  //    (seperti gambar: 2-3 gunung berbeda tinggi, biru-hijau)
  // ══════════════════════════════════════
  const _mtn=(mx,mBase,mw,mh,c0,c1)=>{
    const mg=X.createLinearGradient(mx,mBase,mx,mBase-mh);
    mg.addColorStop(0,c0);mg.addColorStop(0.5,c1);mg.addColorStop(1,c1);
    X.fillStyle=mg;
    X.beginPath();X.moveTo(mx-mw,mBase);
    X.bezierCurveTo(mx-mw*0.55,mBase-mh*0.38,mx-mw*0.14,mBase-mh*0.88,mx,mBase-mh);
    X.bezierCurveTo(mx+mw*0.14,mBase-mh*0.88,mx+mw*0.55,mBase-mh*0.38,mx+mw,mBase);
    X.closePath();X.fill();
    // Highlight sisi terang
    X.save();X.globalAlpha=0.10;X.fillStyle='rgba(200,240,160,1)';
    X.beginPath();X.moveTo(mx+mw*0.04,mBase-mh*0.85);X.lineTo(mx,mBase-mh);X.lineTo(mx-mw*0.05,mBase-mh*0.82);X.lineTo(mx-mw*0.02,mBase-mh*0.48);X.closePath();X.fill();
    X.restore();
  };
  // Gunung biru jauh (paling belakang)
  _mtn(W*0.40,GY,W*0.20,H*0.40,'#3a6840','#4e8850');
  _mtn(W*0.53,GY,W*0.16,H*0.33,'#325e38','#447248');
  // Gunung hijau dekat (lebih besar, depan)
  _mtn(W*0.47,GY+H*0.02,W*0.13,H*0.28,'#2e5830','#3a7040');

  // ══════════════════════════════════════
  // 4. DARATAN — pasir + rumput di atas, tanah coklat
  // ══════════════════════════════════════
  // Kontur permukaan daratan (sedikit bergelombang)
  const lpts=[];
  for(let lxi=0;lxi<=OX+6;lxi+=5){
    lpts.push([lxi, GY+sin(lxi*0.019)*H*0.010+cos(lxi*0.013)*H*0.006]);
  }
  // Tanah pasir-coklat
  const ldG=X.createLinearGradient(0,GY,0,UY+H*0.04);
  ldG.addColorStop(0,'#d4aa6a');ldG.addColorStop(0.15,'#c09050');ldG.addColorStop(0.5,'#a87038');ldG.addColorStop(1,'#885020');
  X.fillStyle=ldG;
  X.beginPath();X.moveTo(0,UY+H*0.04);X.lineTo(0,lpts[0][1]);
  lpts.forEach(([xi,yi])=>X.lineTo(xi,yi));
  X.lineTo(OX+6,UY+H*0.04);X.closePath();X.fill();
  // Lapisan rumput hijau tipis di atas tanah (zona kiri LX)
  const gG=X.createLinearGradient(0,GY-H*0.028,0,GY+H*0.022);
  gG.addColorStop(0,`hsl(${106+S.forestLevel*14},${52+S.forestLevel*20}%,${30+S.forestLevel*14}%)`);
  gG.addColorStop(1,'transparent');
  X.fillStyle=gG;
  X.beginPath();X.moveTo(0,GY+H*0.022);
  const lEnd=lpts.findIndex(([xi])=>xi>=LX-4)+1||lpts.length;
  lpts.slice(0,lEnd).forEach(([xi,yi])=>X.lineTo(xi,yi+H*0.008));
  X.lineTo(LX,GY+H*0.022);X.closePath();X.fill();

  // ══════════════════════════════════════
  // 5. PANTAI PASIR (LX → OX)
  // ══════════════════════════════════════
  const beachG=X.createLinearGradient(LX,GY,OX,GY+H*0.04);
  beachG.addColorStop(0,'#e8d28a');beachG.addColorStop(0.55,'#d8be70');beachG.addColorStop(1,'#c8a850');
  X.fillStyle=beachG;
  X.beginPath();X.moveTo(LX,GY+H*0.04);
  lpts.filter(([xi])=>xi>=LX-2&&xi<=OX+2).forEach(([xi,yi])=>X.lineTo(xi,yi+H*0.010));
  X.lineTo(OX,GY+H*0.04);X.closePath();X.fill();
  // Batu pantai
  _s0.rocks.forEach(r=>{
    const rx=r.x*W, ry=lpts.find(([xi])=>xi>=rx)?.[1]??GY+H*0.016;
    X.fillStyle='#786858';X.beginPath();X.ellipse(rx,ry+H*0.008,r.s*W,r.s*W*0.60,0,0,TAU);X.fill();
    X.fillStyle='rgba(255,255,255,0.12)';X.beginPath();X.ellipse(rx-r.s*W*0.2,ry+H*0.004,r.s*W*0.38,r.s*W*0.25,-0.3,0,TAU);X.fill();
  });

  // ══════════════════════════════════════
  // 6. LAUT — biru toska cerah seperti gambar, semakin gelap ke bawah
  // ══════════════════════════════════════
  const ocG=X.createLinearGradient(OX,GY,W,H);
  ocG.addColorStop(0,'#30c0e0');ocG.addColorStop(0.12,'#1aa8c8');
  ocG.addColorStop(0.38,'#0890b0');ocG.addColorStop(0.70,'#056888');ocG.addColorStop(1,'#034060');
  X.fillStyle=ocG;X.fillRect(OX,GY,W-OX,H-GY);
  // Shimmer permukaan laut
  X.save();
  const shimG=X.createLinearGradient(OX,GY,W,GY+H*0.06);
  shimG.addColorStop(0,'rgba(255,255,255,0)');shimG.addColorStop(0.5,'rgba(200,245,255,0.18)');shimG.addColorStop(1,'rgba(255,255,255,0)');
  X.fillStyle=shimG;X.globalAlpha=1;X.fillRect(OX,GY,W-OX,H*0.06);X.restore();
  // Gelombang
  _s0.waves.forEach((w,wi)=>{
    X.save();X.globalAlpha=w.alpha*(S.tog.hydro_comp?1.65:1.0);
    X.strokeStyle=w.col;X.lineWidth=1.0+wi*0.11;
    X.beginPath();let fw=true;
    for(let wx=OX-2;wx<=W+2;wx+=2){
      const wy=GY+wi*2.0+sin(wx*w.freq+t*w.spd+w.phase)*w.amp+cos(wx*w.freq*1.65+t*w.spd*0.62+w.phase)*w.amp*0.34;
      fw?(X.moveTo(wx,wy),fw=false):X.lineTo(wx,wy);
    }
    X.stroke();X.restore();
  });
  // Glitter sinar matahari di laut
  X.save();
  for(let gi=0;gi<24;gi++){
    const gx=OX+((gi*59+t*1.0)%(W-OX));
    const gy2=GY+4+((gi*17+~~(t*0.35))%30);
    X.globalAlpha=Math.max(0,0.18+0.13*sin(t*0.08+gi*0.55));
    X.fillStyle='rgba(255,252,190,0.92)';
    X.beginPath();X.ellipse(gx,gy2,rnd(2,10),1.1,0,0,TAU);X.fill();
  }
  X.restore();

  // ══════════════════════════════════════
  // 7. UNDERGROUND — layer tanah bawah (persis gambar: 3 layer coklat)
  // ══════════════════════════════════════
  const uL=[
    {y:UY,      h:H*0.050, c0:'#d0a068',c1:'#b88048'},  // top soil (pasir/tanah)
    {y:UY+H*0.050,h:H*0.045,c0:'#987840',c1:'#806030'}, // sub soil
    {y:UY+H*0.095,h:H*0.050,c0:'#685028',c1:'#503818'}, // clay/liat
    {y:UY+H*0.145,h:H*0.065,c0:'#382010',c1:'#201008'}, // bedrock
  ];
  uL.forEach((ul,uli)=>{
    const ug=X.createLinearGradient(0,ul.y,0,ul.y+ul.h);
    ug.addColorStop(0,ul.c0);ug.addColorStop(1,ul.c1);
    X.fillStyle=ug;X.fillRect(0,ul.y,OX+W*0.02,ul.h+1);
    // Garis batas antar layer
    X.save();X.globalAlpha=0.18;X.strokeStyle='rgba(0,0,0,0.5)';X.lineWidth=0.8;
    X.beginPath();X.moveTo(0,ul.y);X.lineTo(OX+W*0.02,ul.y);X.stroke();X.restore();
    // Tekstur butir tanah (titik-titik kecil)
    if(uli<3){
      X.save();X.globalAlpha=0.06;
      for(let di=0;di<14;di++){
        X.fillStyle='rgba(0,0,0,0.5)';
        X.beginPath();X.arc(rnd(4,OX-4),ul.y+rnd(3,ul.h-3),rnd(0.8,2.2),0,TAU);X.fill();
      }
      X.restore();
    }
  });
  // Air tanah (warna biru di lapisan ke-2)
  const ugwG=X.createLinearGradient(0,UY+H*0.050,0,UY+H*0.095);
  ugwG.addColorStop(0,'rgba(40,120,200,0.18)');ugwG.addColorStop(1,'rgba(20,80,160,0.08)');
  X.fillStyle=ugwG;X.fillRect(W*0.03,UY+H*0.055,OX*0.65,H*0.032);

  // ══════════════════════════════════════
  // 8. POHON KELAPA — 6 pohon, ukuran & posisi seperti gambar
  // ══════════════════════════════════════
  // posisi: 3 di daratan, 2 di pantai, 1 di tepi pantai
  const palmDefs=[
    {x:0.195,lean:-0.14,size:1.12},{x:0.285,lean:0.10,size:1.30},
    {x:0.360,lean:-0.08,size:0.98},{x:0.430,lean:0.12,size:1.08},
    {x:0.490,lean:-0.16,size:0.88},{x:0.545,lean:0.06,size:0.95},
  ];
  palmDefs.forEach(p=>{
    const px=p.x*W;
    const ptY=lpts.find(([xi])=>xi>=px)?.[1]??GY;
    const ph=H*(0.20+p.size*0.115);
    _palm(px,ptY+H*0.005,ph,p.lean,t,S.forestLevel);
  });

  // ══════════════════════════════════════
  // 9. RUMAH BESAR KIRI + PONDOK TENGAH
  // ══════════════════════════════════════
  const hY=GY+H*0.002;
  _house0(W*0.075,hY,W*0.105,H*0.195); // rumah utama
  _hut(W*0.305,hY+H*0.006,W*0.058,H*0.110); // pondok

  // Semak/tanaman kecil
  _s0.bushes.forEach(b=>{
    const bx=b.x*W,bsize=b.s*W;
    const bY=lpts.find(([xi])=>xi>=bx)?.[1]??GY;
    const bG=X.createRadialGradient(bx,bY-bsize*0.5,0,bx,bY-bsize*0.5,bsize);
    bG.addColorStop(0,`hsl(${115+S.forestLevel*14},${58+S.forestLevel*18}%,${28+S.forestLevel*10}%)`);
    bG.addColorStop(0.6,`hsl(${108+S.forestLevel*10},${50+S.forestLevel*14}%,${20+S.forestLevel*8}%)`);
    bG.addColorStop(1,'transparent');
    X.beginPath();X.arc(bx,bY-bsize*0.5,bsize,0,TAU);X.fillStyle=bG;X.fill();
  });

  // ══════════════════════════════════════
  // 10. AWAN — hitam kiri (presipitasi), putih tengah (kondensasi)
  // ══════════════════════════════════════
  const rcX=W*0.218+sin(t*0.004)*W*0.006, rcY=H*0.195;
  const wcX=W*0.615+sin(t*0.003)*W*0.005, wcY=H*0.152;
  // Bayangan awan di daratan
  X.save();X.globalAlpha=0.07;
  X.fillStyle='rgba(30,30,60,1)';
  X.beginPath();X.ellipse(rcX,GY+H*0.008,W*0.085,H*0.018,0,0,TAU);X.fill();
  X.restore();
  _cld0(rcX,rcY,W*0.198,true,0.90);   // awan gelap/hujan
  _cld0(wcX,wcY,W*0.175,false,0.84);  // awan putih
  _cld0(W*0.475,H*0.235,W*0.095,false,0.62); // awan kecil tambahan

  // ══════════════════════════════════════
  // 11. HUJAN — dari awan gelap ke daratan kiri
  // ══════════════════════════════════════
  if(S.tog.hydro_comp){
    _s0.rain.forEach(r=>{
      r.y+=r.sp;
      if(r.y>0.66){r.y=-0.18;r.x=rnd(0.01,0.47);}
      const rx=r.x*W, ry=r.y*H;
      // Hanya gambar hujan yang di bawah awan gelap (x < LX, y < GY+0.02)
      if(rx>LX||ry>GY+H*0.02){return;}
      X.save();X.globalAlpha=r.alpha*(0.65+0.18*sin(t*0.04+r.x*6));
      X.strokeStyle='rgba(100,170,230,0.88)';X.lineWidth=1.1;X.lineCap='round';
      X.beginPath();X.moveTo(rx,ry);X.lineTo(rx-1.5,ry+r.len);X.stroke();
      // Percikan di tanah
      if(ry>GY-10&&ry<GY+6){
        X.strokeStyle='rgba(130,200,255,0.40)';X.lineWidth=0.8;
        X.beginPath();X.arc(rx,GY+2,rnd(1.5,4.5),PI,TAU);X.stroke();
      }
      X.restore();
    });
  } else {
    // Hujan sangat tipis selalu ada (sedikit)
    _s0.rain.slice(0,10).forEach(r=>{
      r.y+=r.sp*0.4;if(r.y>0.66)r.y=-0.15;
      if(r.x*W>LX)return;
      X.save();X.globalAlpha=r.alpha*0.20;
      X.strokeStyle='rgba(100,170,230,0.7)';X.lineWidth=0.8;
      X.beginPath();X.moveTo(r.x*W,r.y*H);X.lineTo(r.x*W-1,(r.y*H)+r.len*0.65);X.stroke();
      X.restore();
    });
  }

  // ══════════════════════════════════════
  // 12. UAP AIR dari laut — garis bergelombang putih naik
  //     (persis gambar: garis bergelombang di atas laut)
  // ══════════════════════════════════════
  _s0.vapors.forEach((v,vi)=>{
    const vBase=((t*v.sp*0.0018+v.phase/TAU)%1);
    const vx=v.x*W;
    if(vx>W*0.97||vx<OX)return;
    const vH=H*0.32*vBase;
    const alpha=0.60*(1-vBase)*(S.tog.hydro_comp||S.tog.atmo_comp?1:0.28);
    X.save();X.globalAlpha=alpha;
    X.strokeStyle='rgba(210,238,255,0.90)';X.lineWidth=1.8;X.lineCap='round';
    // Garis bergelombang (3 lengkung bergantian)
    X.beginPath();
    const vy0=GY-vH*0.0;
    X.moveTo(vx,vy0);
    X.bezierCurveTo(vx+7, vy0-vH*0.22, vx-6, vy0-vH*0.44, vx+5, vy0-vH*0.64);
    X.bezierCurveTo(vx+12,vy0-vH*0.80, vx-4, vy0-vH*0.92, vx+3, vy0-vH);
    X.stroke();X.restore();
  });

  // ══════════════════════════════════════
  // 13. ATMOSFER — efek saat aktif
  // ══════════════════════════════════════
  if(S.tog.atmo_comp){
    // God rays dari matahari
    X.save();
    for(let ri=0;ri<5;ri++){
      const ra=PI*0.74+ri*0.088;
      const rg=X.createLinearGradient(SX,SY,SX+cos(ra)*W*0.55,SY+sin(ra)*H*0.55);
      rg.addColorStop(0,`rgba(255,240,130,${0.085-ri*0.012})`);rg.addColorStop(1,'transparent');
      X.strokeStyle=rg;X.lineWidth=15-ri*2;
      X.beginPath();X.moveTo(SX+cos(ra)*SR*1.1,SY+sin(ra)*SR*1.1);
      X.lineTo(SX+cos(ra)*W*0.55,SY+sin(ra)*H*0.55);X.stroke();
    }
    X.restore();
    // Glow langit troposfer
    const trG=X.createLinearGradient(0,H*0.08,0,GY);
    trG.addColorStop(0,'transparent');trG.addColorStop(1,'rgba(80,180,255,0.09)');
    X.fillStyle=trG;X.fillRect(0,H*0.08,W,GY-H*0.08);
    // Partikel gas
    if(t%8===0)spawn(rnd(0,W),rnd(H*0.04,GY*0.82),{
      vx:rnd(-0.12,0.12),vy:rnd(-0.25,-0.04),decay:0.004,
      size:rnd(1.5,2.8),col:'rgba(160,215,255,0.55)',glow:1.5,drag:0.999});
  }

  // ══════════════════════════════════════
  // 14. BIOSFER — efek saat aktif
  // ══════════════════════════════════════
  if(S.tog.bio_comp){
    // CO2 turun ke pohon (fotosintesis)
    if(t%5===0)spawn(rnd(W*0.04,LX*0.92),rnd(H*0.25,H*0.50),{
      vx:rnd(-0.2,0.2),vy:rnd(0.55,1.6),decay:0.010,
      size:rnd(2,4),col:'rgba(255,130,55,0.52)',glow:2,drag:0.994});
    // O2 naik
    if(t%7===0)spawn(rnd(W*0.04,LX*0.88),GY-rnd(H*0.04,H*0.12),{
      vx:rnd(-0.18,0.18),vy:rnd(-1.0,-0.3),decay:0.007,
      size:rnd(1.5,3.2),col:'rgba(140,225,255,0.55)',glow:1.8,drag:0.996,wobble:0.008,wfreq:0.06});
    // Boost warna rumput
    X.save();X.globalAlpha=0.20*S.forestLevel;
    X.fillStyle=`hsl(${110+S.forestLevel*14},${60+S.forestLevel*18}%,${32+S.forestLevel*10}%)`;
    X.beginPath();X.moveTo(0,GY+H*0.018);
    lpts.slice(0,lEnd).forEach(([xi,yi])=>X.lineTo(xi,yi+H*0.009));
    X.lineTo(LX,GY+H*0.018);X.closePath();X.fill();X.restore();
  }

  // ══════════════════════════════════════
  // 15. HIDROSFER — ikan + evaporasi saat aktif
  // ══════════════════════════════════════
  if(S.tog.hydro_comp){
    // Ikan berenang di laut
    for(let fi=0;fi<9;fi++){
      const ft=((t*0.0028+fi*0.38)%1);
      const fx=OX+(ft*(W-OX-20));
      const fy=GY+H*(0.065+fi*0.030+sin(t*0.018+fi)*0.020);
      if(fy>UY-4)continue;
      const dir=fi%2===0?1:-1;
      const fc=['rgba(45,165,200,0.65)','rgba(255,170,45,0.55)','rgba(55,200,155,0.55)'][fi%3];
      const fs=2.2+(fi%3)*0.9;
      X.save();X.globalAlpha=0.52+0.08*sin(t*0.05+fi);
      X.translate(dir<0?W-fx+OX:fx,fy);X.scale(dir,1);
      X.fillStyle=fc;
      X.beginPath();X.ellipse(0,0,fs*2.2,fs,0,0,TAU);X.fill();
      X.beginPath();X.moveTo(-fs*2.2,0);X.lineTo(-fs*3.4,-fs*1.0);X.lineTo(-fs*3.4,fs*1.0);X.closePath();X.fill();
      X.fillStyle='rgba(0,0,0,0.65)';X.beginPath();X.arc(fs*1.15,-fs*0.26,fs*0.30,0,TAU);X.fill();
      X.restore();
    }
    // Gelembung naik
    if(t%6===0)spawn(OX+rnd(0,W-OX),GY+rnd(H*0.03,H*0.10),{
      vx:rnd(-0.12,0.12),vy:rnd(-0.65,-0.22),decay:0.008,
      size:rnd(1.2,3),col:'rgba(180,235,255,0.5)',glow:1.5,drag:0.995,wobble:0.007,wfreq:0.09});
  }

  // ══════════════════════════════════════
  // 16. KRIOSFER — partikel salju saat aktif
  // ══════════════════════════════════════
  if(S.tog.cryo_comp){
    // Overlay biru dingin di langit
    X.save();X.globalAlpha=0.10+0.04*sin(t*0.018);
    X.fillStyle='rgba(180,220,255,0.15)';X.fillRect(0,0,W,GY);X.restore();
    // Salju jatuh
    if(t%3===0)spawn(rnd(0,W),rnd(H*0.04,GY*0.6),{
      vx:rnd(-0.4,0.4),vy:rnd(0.35,1.0),decay:0.010,
      size:rnd(1.8,3.5),col:'rgba(225,242,255,0.80)',glow:2.2,drag:0.997});
    // Salju di atap rumah
    X.save();X.globalAlpha=0.40;X.fillStyle='rgba(235,248,255,0.65)';
    X.beginPath();X.moveTo(W*0.02,GY-H*0.185);X.lineTo(W*0.075,GY-H*0.200);X.lineTo(W*0.13,GY-H*0.185);X.closePath();X.fill();
    X.restore();
  }

  // ══════════════════════════════════════
  // 17. LITOSFER — underground + magma saat aktif
  // ══════════════════════════════════════
  if(S.tog.litho_comp){
    // Magma glow bawah
    const mgG=X.createLinearGradient(0,H*0.90,0,H);
    mgG.addColorStop(0,'transparent');
    mgG.addColorStop(0.4,`rgba(210,${55+~~(sin(t*0.04)*28)},0,${0.38+0.12*sin(t*0.035)})`);
    mgG.addColorStop(1,'rgba(160,25,0,0.25)');
    X.fillStyle=mgG;X.fillRect(0,H*0.90,OX,H*0.10);
    // Retakan tanah — partikel merah naik
    if(t%9===0)spawn(rnd(W*0.05,LX*0.88),UY+H*0.10,{
      vx:rnd(-0.25,0.25),vy:rnd(-0.5,-0.12),decay:0.009,
      size:rnd(1.5,3.2),col:'rgba(255,75,0,0.42)',glow:2,drag:0.996});
    // Aliran air tanah animasi
    X.save();X.globalAlpha=0.50+0.08*sin(t*0.03);
    X.strokeStyle='rgba(55,155,230,0.72)';X.lineWidth=1.8;X.setLineDash([8,6]);
    X.beginPath();X.moveTo(W*0.05,UY+H*0.070);
    X.bezierCurveTo(W*0.15,UY+H*0.082,W*0.28,UY+H*0.065,W*0.40,UY+H*0.075);
    X.stroke();X.setLineDash([]);
    // Titik bergerak di aliran
    const fp2=((t*0.004)%1);
    const spx=lerp(W*0.05,W*0.40,fp2),spy=UY+H*0.070+sin(fp2*PI)*H*0.010;
    X.shadowColor='rgba(55,155,230,0.6)';X.shadowBlur=6;
    X.fillStyle='rgba(100,200,255,0.88)';X.beginPath();X.arc(spx,spy,3.5,0,TAU);X.fill();
    X.restore();
    // Label layer tanah
    X.save();X.globalAlpha=0.72;X.font='8.5px "Courier New"';X.textAlign='left';
    [['Tanah & Sedimen',UY+H*0.036,'rgba(210,165,85,0.72)'],
     ['Kerak Bumi ~35 km',UY+H*0.083,'rgba(190,145,65,0.68)'],
     ['Mantel Atas',UY+H*0.127,'rgba(225,105,35,0.62)'],
     ['Mantel 1300°C',UY+H*0.178,'rgba(255,85,22,0.68)']].forEach(([l,ly,lc])=>{
      X.fillStyle=lc;X.fillText('▸ '+l,W*0.012,ly);});
    X.restore();
  }

  // ══════════════════════════════════════
  // 18. LABEL KOMPONEN — posisi tidak tabrakan
  // Atmo: atas tengah  |  Hidro: laut kanan bawah awan
  // Krio: kiri atas    |  Bio: daratan kiri tengah
  // Litho: underground kiri
  // ══════════════════════════════════════
  if(S.tog.atmo_comp) _lbl0('ATMOSFER','N₂ 78% · O₂ 21% · CO₂ 0.04%',cx,H*0.068,'rgba(74,176,232,0.95)');
  if(S.tog.hydro_comp) _lbl0('HIDROSFER','1,335,040 ×10³ km³ · Siklus Air',W*0.796,GY+H*0.082,'rgba(55,175,255,0.95)');
  if(S.tog.cryo_comp)  _lbl0('KRIOSFER','Es & Salju 26,350 ×10³ km³',W*0.188,H*0.072,'rgba(168,216,240,0.95)');
  if(S.tog.bio_comp)   _lbl0('BIOSFER','GPP 120 GtC/yr · Hutan 610 GtC',W*0.260,GY-H*0.082,'rgba(88,200,98,0.95)');
  if(S.tog.litho_comp) _lbl0('LITOSFER','Kerak · Mantel · Magma',W*0.215,H*0.835,'rgba(201,168,76,0.95)');

  // ══════════════════════════════════════
  // 19. INTERAKSI antar komponen aktif
  // ══════════════════════════════════════
  const ac0=[];
  if(S.tog.atmo_comp)  ac0.push({x:cx,        y:H*0.068,      col:'#4ab0e8'});
  if(S.tog.hydro_comp) ac0.push({x:W*0.796,   y:GY+H*0.082,   col:'#1976d2'});
  if(S.tog.cryo_comp)  ac0.push({x:W*0.188,   y:H*0.072,      col:'#a8d8f0'});
  if(S.tog.bio_comp)   ac0.push({x:W*0.260,   y:GY-H*0.082,   col:'#5cba74'});
  if(S.tog.litho_comp) ac0.push({x:W*0.215,   y:H*0.835,      col:'#c9a84c'});
  if(ac0.length>1){
    for(let ii=0;ii<ac0.length-1;ii++){
      const pa=ac0[ii],pb=ac0[ii+1];
      X.save();X.globalAlpha=0.15+0.05*sin(t*0.020+ii);
      X.strokeStyle=pa.col;X.lineWidth=1;X.setLineDash([5,10]);
      X.beginPath();X.moveTo(pa.x,pa.y);X.lineTo(pb.x,pb.y);X.stroke();X.setLineDash([]);X.restore();
      if(t%(16+ii*4)===0){
        const pp=((t/(16+ii*4))%1);
        spawn(lerp(pa.x,pb.x,pp),lerp(pa.y,pb.y,pp),{
          vx:rnd(-0.3,0.3),vy:rnd(-0.2,0.2),decay:0.038,size:3,col:pa.col,glow:4,drag:0.94});
      }
    }
  }

  // ══════════════════════════════════════
  // 20. HINT bawah layar
  // ══════════════════════════════════════
  X.save();X.globalAlpha=0.30+0.05*sin(t*0.020);
  X.font='italic 11px "Times New Roman"';X.fillStyle='rgba(232,240,252,0.70)';
  X.textAlign='center';
  X.fillText('Klik tombol di kiri untuk mengaktifkan animasi tiap komponen sistem iklim',cx,H*0.978);
  X.restore();
}

// ═══════════════════════════════════════════════════════════════
//  SCENE 1 — Atmosphere: layers + Hadley cells + lapse rate
//  Full cinematic vertical cross-section
// ═══════════════════════════════════════════════════════════════
function scene1(t){
  // Sky gradient darkening with altitude
  const bg=X.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#000205');
  bg.addColorStop(.18,'#010812');
  bg.addColorStop(.38,'#031528');
  bg.addColorStop(.58,'#082240');
  bg.addColorStop(.75,'#0e3a6a');
  bg.addColorStop(.88,'#1560a8');
  bg.addColorStop(1,'#1e78c8');
  X.fillStyle=bg;X.fillRect(0,0,W,H);
  drawStars(.5);

  const gY=H*.82;

  // Ground
  const gr=X.createLinearGradient(0,gY,0,H);
  gr.addColorStop(0,'#1b5e20');gr.addColorStop(.3,'#2e7d32');gr.addColorStop(1,'#0f2e12');
  X.fillStyle=gr;X.fillRect(0,gY,W,H-gY);

  // ATMOSPHERIC LAYER BANDS with animated shimmer
  const layers=[
    {name:'TROPOSFER',  km:'0–12 km',   yB:.82, yT:.6,  col:'rgba(74,176,232,.06)', line:'rgba(74,176,232,.35)',  desc:'Cuaca, awan, 75% massa atmosfer'},
    {name:'STRATOSFER', km:'12–50 km',  yB:.6,  yT:.38, col:'rgba(100,220,150,.05)',line:'rgba(100,220,150,.3)',   desc:'Lapisan ozon O₃, T naik'},
    {name:'MESOSFER',   km:'50–80 km',  yB:.38, yT:.22, col:'rgba(160,120,255,.04)',line:'rgba(160,120,255,.28)',  desc:'Titik terdingin, meteor terbakar'},
    {name:'TERMOSFER',  km:'80+ km',    yB:.22, yT:.08, col:'rgba(255,80,80,.03)',   line:'rgba(255,80,80,.22)',   desc:'Aurora, ISS, T >2000°C'},
  ];

  layers.forEach((l,i)=>{
    const y1=H*l.yT,y2=H*l.yB;
    // Band fill with shimmer
    const g=X.createLinearGradient(0,y1,0,y2);
    const shimmer=.5+.5*sin(t*.02+i*.8);
    g.addColorStop(0,l.col.replace(/[\d.]+\)$/,(v)=>String(parseFloat(v)+.08*shimmer)+')'));
    g.addColorStop(.5,l.col);g.addColorStop(1,'transparent');
    X.fillStyle=g;X.fillRect(0,y1,W,y2-y1);
    // Boundary line with glow
    if(S.tog.layers_on){
      X.save();X.strokeStyle=l.line;X.lineWidth=1;
      X.shadowColor=l.line;X.shadowBlur=8;
      X.setLineDash([5,10]);
      X.beginPath();X.moveTo(0,y1);X.lineTo(W,y1);X.stroke();
      X.setLineDash([]);X.shadowBlur=0;X.restore();

      // Layer label + desc
      X.save();
      X.font='500 11px Space Grotesk';
      X.fillStyle=l.line.replace(/[\d.]+\)$/,'0.85)');
      X.fillText(l.name+'  '+l.km,18,y1+14);
      X.font='300 9px Space Grotesk';X.fillStyle='rgba(255,255,255,.32)';
      X.fillText(l.desc,18,y1+28);
      X.restore();
    }
  });

  // TEMPERATURE PROFILE curve (slide 9: troposphere cools, stratosphere warms...)
  if(S.tog.lapse_on){
    const profilePts=[
      [288,gY],[215,H*.61],[215,H*.595],[270,H*.38],[188,H*.22],[1500,H*.09]
    ];
    // Normalize T to x position
    const tMin=180,tMax=310,xMin=W*.08,xMax=W*.35;
    X.save();
    X.strokeStyle='rgba(255,200,80,.85)';X.lineWidth=2.5;
    X.shadowColor='rgba(255,200,80,.6)';X.shadowBlur=12;
    X.beginPath();
    profilePts.forEach(([T_val,py],i)=>{
      const px=xMin+(T_val-tMin)/(tMax-tMin)*(xMax-xMin);
      i?X.lineTo(px,py):X.moveTo(px,py);
    });
    X.stroke();X.shadowBlur=0;
    // T axis label
    X.font='10px Space Mono';X.fillStyle='rgba(255,200,80,.6)';
    X.fillText('Γ = 6.5 K/km',xMin+8,gY-10);
    X.fillText('−∂T/∂z',xMin+8,gY-24);
    // Dots at key points
    profilePts.forEach(([T_val,py])=>{
      const px=xMin+(T_val-tMin)/(tMax-tMin)*(xMax-xMin);
      if(T_val>200&&T_val<1000){
        X.beginPath();X.arc(px,py,3,0,TAU);
        X.fillStyle='rgba(255,200,80,.9)';X.fill();
      }
    });
    X.restore();
  }

  // COMPOSITION PIE (slide 8)
  if(S.tog.comp_on){
    const px=W*.84,py=H*.36,pr=55;
    const segs=[
      {f:.781, col:'#4ab0e8', lbl:'N₂ 78.1%'},
      {f:.209, col:'#5cba74', lbl:'O₂ 20.9%'},
      {f:.0093,col:'#f0c040', lbl:'Ar 0.93%'},
      {f:.0004,col:'#e8622a', lbl:'CO₂ 0.04%'},
    ];
    // Bg dark circle
    X.save();
    X.fillStyle='rgba(4,8,20,.88)';X.strokeStyle='rgba(255,255,255,.06)';X.lineWidth=1;
    X.beginPath();X.arc(px,py,pr+30,0,TAU);X.fill();X.stroke();
    let ang=-PI/2;
    segs.forEach((s,si)=>{
      const slice=s.f*TAU;
      X.beginPath();X.moveTo(px,py);X.arc(px,py,pr,ang,ang+slice);X.closePath();
      X.fillStyle=s.col;X.fill();
      // Animated glow segment if large
      if(s.f>.1){
        const mid=ang+slice/2;
        X.font='bold 9px Space Mono';X.fillStyle='rgba(255,255,255,.85)';
        X.textAlign='center';
        X.fillText(s.lbl,px+cos(mid)*(pr+22),py+sin(mid)*(pr+22));
      }
      ang+=slice;
    });
    // Center hole
    X.beginPath();X.arc(px,py,pr*.45,0,TAU);X.fillStyle='rgba(4,8,20,.95)';X.fill();
    X.font='italic 11px Cormorant Garamond';X.fillStyle='rgba(255,255,255,.6)';
    X.textAlign='center';X.fillText('Udara',px,py+4);
    X.restore();
  }

  // HADLEY CELLS (slide 11) — animated convection loops
  if(S.tog.hadley_on){
    const cells=[
      {name:'Sel Hadley', yc:H*.71,  h:H*.2, col:'#e8622a', dir:1},
      {name:'Sel Ferrel',  yc:H*.52,  h:H*.16,col:'#4ab0e8', dir:-1},
      {name:'Sel Polar',   yc:H*.37,  h:H*.12,col:'#a8d8f0', dir:1},
    ];
    cells.forEach(c=>{
      const xc=cx*.95,hw=W*.22;
      X.save();X.globalAlpha=.75;
      // Cell oval
      X.strokeStyle=c.col+'88';X.lineWidth=1.5;
      X.beginPath();X.ellipse(xc,c.yc,hw,c.h*.5,0,0,TAU);X.stroke();
      // Fill
      const fg=X.createRadialGradient(xc,c.yc,0,xc,c.yc,hw);
      fg.addColorStop(0,c.col+'12');fg.addColorStop(1,'transparent');
      X.fillStyle=fg;X.beginPath();X.ellipse(xc,c.yc,hw,c.h*.5,0,0,TAU);X.fill();
      // Moving dot along ellipse (animation!)
      const dp=(t*.015*c.dir)%(TAU);
      const dotX=xc+cos(dp)*hw,dotY=c.yc+sin(dp)*c.h*.5;
      X.fillStyle=c.col;X.shadowColor=c.col;X.shadowBlur=10;
      X.beginPath();X.arc(dotX,dotY,4,0,TAU);X.fill();
      X.shadowBlur=0;
      // Label
      X.font='9px Space Mono';X.fillStyle=c.col+'cc';X.textAlign='center';
      X.fillText(c.name,xc,c.yc-c.h*.5-6);
      X.restore();
    });
    // ITCZ marker
    X.save();X.globalAlpha=.55;X.strokeStyle='rgba(255,200,80,.6)';X.lineWidth=1;X.setLineDash([3,6]);
    X.beginPath();X.moveTo(W*.4,H*.8);X.lineTo(W*.6,H*.8);X.stroke();X.setLineDash([]);
    X.font='8px Space Mono';X.fillStyle='rgba(255,200,80,.6)';X.textAlign='center';
    X.fillText('ITCZ  (0°)',cx*.95,H*.8-8);X.restore();
  }

  // Aircraft silhouette at tropopause
  const planY=H*.61;
  X.save();X.globalAlpha=.5+.15*sin(t*.04);
  X.font='20px serif';X.fillText('✈',W*.5+sin(t*.02)*W*.06,planY+3);
  X.restore();

  // Ozone layer glow (25 km ~ H*.48)
  X.save();X.globalAlpha=.4+.15*sin(t*.025);
  const ozG=X.createLinearGradient(0,H*.47,0,H*.51);
  ozG.addColorStop(0,'transparent');ozG.addColorStop(.5,'rgba(80,220,100,.18)');ozG.addColorStop(1,'transparent');
  X.fillStyle=ozG;X.fillRect(0,H*.47,W,H*.04);
  X.font='8.5px Space Mono';X.fillStyle='rgba(80,220,100,.6)';X.textAlign='right';
  X.fillText('↔  OZON  ~25 km',W-18,H*.49);X.restore();

  // Sun top-right
  drawSun(W*.88,H*.09,H*.055,S.sunPower,t);

  // Shooting particle (meteor?)
  if(t%180<4){
    for(let i=0;i<8;i++)spawn(W*.7+rnd(-20,20),H*.22+rnd(-10,10),{
      vx:rnd(-4,-2),vy:rnd(3,5),decay:.025,size:rnd(1.5,3.5),
      col:`rgba(255,${~~rnd(150,230)},80,.9)`,glow:3,drag:.98
    });
  }
}


// ═══════════════════════════════════════════════════════════════
//  SCENE 2 — Hydrosphere: animated water cycle
//  Evaporation → clouds → rain → runoff → ocean
// ═══════════════════════════════════════════════════════════════
let _raindrops=[],_clouds=[],_wavePhase=0;
function initHydroScene(){
  _raindrops=Array.from({length:60},()=>({x:rnd(0,W),y:rnd(-H,0),sp:rnd(6,12),alpha:rnd(.3,.7)}));
  _clouds=Array.from({length:6},()=>({x:rnd(0,W),y:rnd(H*.08,H*.28),w:rnd(80,180),sp:rnd(.2,.5)}));
}
initHydroScene();

function scene2(t){
  _wavePhase+=.022;
  const bg=X.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#02050e');bg.addColorStop(.4,'#030d20');bg.addColorStop(.7,'#041530');bg.addColorStop(1,'#041020');
  X.fillStyle=bg;X.fillRect(0,0,W,H);
  drawStars(.35);

  const oceanY=H*.58,groundY=H*.75;

  // Ocean deep
  const oc=X.createLinearGradient(0,oceanY,0,H);
  oc.addColorStop(0,'#0d47a1');oc.addColorStop(.4,'#0a3580');oc.addColorStop(1,'#03102e');
  X.fillStyle=oc;X.fillRect(0,oceanY,W,H-oceanY);

  // Ocean waves (multiple layers)
  for(let wl=0;wl<3;wl++){
    X.save();X.globalAlpha=.18+wl*.08;
    X.strokeStyle=`rgba(${80+wl*30},${160+wl*20},${220+wl*12},.7)`;
    X.lineWidth=1.5-wl*.3;
    X.beginPath();
    for(let x=0;x<=W;x+=3){
      const wy=oceanY+sin(x*.012+_wavePhase+wl*1.2)*6+sin(x*.022+_wavePhase*.7)*3;
      x?X.lineTo(x,wy):X.moveTo(x,wy);
    }
    X.stroke();X.restore();
  }
  // Ocean shimmer
  X.save();X.globalAlpha=.08;
  for(let i=0;i<12;i++){
    const sx=((i*W*.085)+t*0.4)%W,sy=oceanY+20+i*8;
    X.fillStyle='rgba(180,220,255,.5)';
    X.fillRect(sx,sy,rnd(15,40),1.5);
  }
  X.restore();

  // Land mass left
  X.save();
  const lg=X.createLinearGradient(0,groundY*.5,0,H);
  lg.addColorStop(0,`hsl(${112+S.forestLevel*12},${35+S.forestLevel*20}%,${17+S.forestLevel*12}%)`);
  lg.addColorStop(1,'#0a1208');
  X.fillStyle=lg;
  X.beginPath();X.moveTo(0,H);X.lineTo(0,groundY-H*.06);
  for(let x=0;x<=W*.5;x+=18)
    X.lineTo(x,groundY-H*.06+sin(x*.025)*H*.03+cos(x*.018)*H*.02);
  X.lineTo(W*.5,H);X.closePath();X.fill();
  // Mountain
  X.fillStyle='#2c3a2a';
  [[W*.15,groundY-H*.22,W*.32,groundY],[W*.08,groundY-H*.14,W*.2,groundY]].forEach(([x1,y1,x2,y2])=>{
    X.beginPath();X.moveTo(x1,y2);X.lineTo((x1+x2)/2,y1);X.lineTo(x2,y2);X.closePath();X.fill();
  });
  // Snow cap
  X.fillStyle='rgba(220,238,255,.88)';
  X.beginPath();X.moveTo(W*.15-12,groundY-H*.175);X.lineTo(W*.235,groundY-H*.22);X.lineTo(W*.32+12,groundY-H*.175);X.closePath();X.fill();
  X.restore();

  // Animated EVAPORATION from ocean surface
  if(S.tog.evap_on){
    if(t%3===0){
      const sx=rnd(W*.5,W*.98);
      spawn(sx,oceanY-5,{vx:rnd(-.3,.3),vy:rnd(-1.8,-.8),decay:.008,size:rnd(2,6),
        col:`rgba(${~~rnd(60,120)},${~~rnd(160,220)},255,.7)`,glow:3,drag:.99,ay:-.02,wobble:.02,wfreq:.08});
    }
    // Label with animated value
    X.save();X.font='bold 11px Space Grotesk';X.fillStyle='rgba(74,176,232,.9)';
    X.textAlign='center';
    X.fillText('EVAPORASI LAUT',W*.74,oceanY-28);
    X.font='9px Space Mono';X.fillStyle='rgba(74,176,232,.55)';
    X.fillText('413 × 10³ km³ / tahun',W*.74,oceanY-14);X.restore();
  }

  // CLOUD system (animated drift)
  _clouds.forEach(c=>{
    c.x=(c.x+c.sp)%(W+c.w*2)-c.w;
    const cloudAlpha=.65+.1*sin(t*.02+c.x*.01);
    X.save();X.globalAlpha=cloudAlpha;
    // Cloud shadow on ocean
    if(c.y<oceanY){
      X.save();X.globalAlpha=.04;X.fillStyle='rgba(0,30,80,1)';
      X.beginPath();X.ellipse(c.x,oceanY+10,c.w*.5,10,0,0,TAU);X.fill();X.restore();
    }
    // Puffs
    [[0,0,.5,1],[-.35,.05,.4,.8],[.35,.08,.38,.75],[-.22,-.18,.3,.65],[.22,-.15,.28,.6]].forEach(([dx,dy,rx,ry])=>{
      X.beginPath();X.ellipse(c.x+dx*c.w,c.y+dy*c.w*.4,rx*c.w*.5,ry*c.w*.38,0,0,TAU);
      X.fillStyle='rgba(210,228,250,.85)';X.fill();
    });
    X.restore();
  });

  // RAIN animation
  if(S.tog.precip_on){
    _raindrops.forEach(d=>{
      d.y+=d.sp;
      if(d.y>H*1.05)d.y=rnd(-H*.3,-20),d.x=rnd(0,W*.5);
      X.save();X.globalAlpha=d.alpha*.8;
      X.strokeStyle='rgba(120,185,230,.8)';X.lineWidth=1.2;
      X.beginPath();X.moveTo(d.x,d.y);X.lineTo(d.x-1.5,d.y+d.sp*.7);X.stroke();
      X.restore();
      // Splash when hits ground
      if(d.y>groundY-5&&d.y<groundY+5&&t%3===0){
        ring(d.x,groundY,4,{spMin:.5,spMax:1.5,decay:.08,size:1.2,col:'rgba(120,185,230,.6)',drag:.9});
      }
    });
    X.save();X.font='bold 11px Space Grotesk';X.fillStyle='rgba(100,165,230,.85)';
    X.textAlign='center';
    X.fillText('PRESIPITASI',W*.22,H*.06);
    X.font='9px Space Mono';X.fillStyle='rgba(100,165,230,.5)';
    X.fillText('Darat: 113 × 10³ km³/yr',W*.22,H*.075);X.restore();
  }

  // ═══════════════════════════════════════════════════════════
  //  ARUS PERMUKAAN LAUT — realistis & animasi penuh
  //  Berdasarkan peta arus permukaan global nyata:
  //  Arus Ekuatorial (barat, hangat), Gyre Subtropik,
  //  Gulf Stream / Kuroshio (ke kutub, hangat),
  //  Arus Dingin kembali (ke ekuator, dingin)
  // ═══════════════════════════════════════════════════════════
  if(S.tog.thermo_on){
    // ─── DEFINISI JALUR ARUS (bezier control points, relatif W×H) ───
    // Setiap arus: {pts:[x0,y0,cx1,cy1,cx2,cy2,x1,y1,...], col, width, label, labelT, warm}
    // Koordinat Y: oceanY=H*.58, bottom=H
    const oY=oceanY, bY=H;

    const currents=[
      // 1. ARUS EKUATORIAL UTARA — hangat, dari timur ke barat di lapisan atas
      {
        pts:[W,oY+H*.025, W*.68,oY+H*.018, W*.35,oY+H*.022, W*.02,oY+H*.028],
        col:'rgba(240,90,30,',  w:4.5, warm:true,
        label:'Arus Ekuatorial Utara (Hangat)', lx:W*.48, ly:oY+H*.008,
      },
      // 2. ARUS EKUATORIAL SELATAN — hangat, dari timur ke barat lebih dalam
      {
        pts:[W,oY+H*.075, W*.65,oY+H*.068, W*.32,oY+H*.072, W*.02,oY+H*.082],
        col:'rgba(235,110,20,', w:3.8, warm:true,
        label:'Arus Ekuatorial Selatan (Hangat)', lx:W*.48, ly:oY+H*.055,
      },
      // 3. GULF STREAM / KUROSHIO — hangat, naik ke utara di sisi kanan daratan
      {
        pts:[W*.02,oY+H*.028, W*.08,oY+H*.015, W*.12,oY-H*.015, W*.18,oY-H*.040],
        col:'rgba(230,60,20,',  w:5.5, warm:true,
        label:'Gulf Stream (Hangat, 30 Sv)', lx:W*.13, ly:oY-H*.055,
      },
      // 4. NORTH ATLANTIC DRIFT — hangat, melengkung ke timur laut
      {
        pts:[W*.18,oY-H*.040, W*.28,oY-H*.060, W*.44,oY-H*.058, W*.60,oY-H*.048],
        col:'rgba(230,60,20,',  w:4.0, warm:true,
        label:'', lx:0, ly:0,
      },
      // 5. ARUS DINGIN LABRADOR / OYASHIO — dingin, turun dari utara
      {
        pts:[W*.60,oY-H*.048, W*.72,oY-H*.055, W*.84,oY-H*.040, W*.96,oY+H*.005],
        col:'rgba(30,110,230,', w:4.5, warm:false,
        label:'Arus Labrador/Oyashio (Dingin)', lx:W*.78, ly:oY-H*.055,
      },
      // 6. ARUS DINGIN CANARY / CALIFORNIA — dingin, turun di sisi kiri laut
      {
        pts:[W*.96,oY+H*.005, W*.99,oY+H*.042, W*.99,oY+H*.075, W*.96,oY+H*.120],
        col:'rgba(30,110,230,', w:3.8, warm:false,
        label:'', lx:0, ly:0,
      },
      // 7. ARUS DALAM / BALIK — dingin, kembali ke bawah laut kanan
      {
        pts:[W*.96,oY+H*.120, W*.80,oY+H*.150, W*.60,oY+H*.145, W*.40,oY+H*.152],
        col:'rgba(20,80,200,',  w:3.2, warm:false,
        label:'Arus Balik Bawah (Dingin)', lx:W*.68, ly:oY+H*.170,
      },
      // 8. COUNTER EQUATORIAL — balik ke timur di antara 2 arus ekuatorial
      {
        pts:[W*.04,oY+H*.050, W*.28,oY+H*.046, W*.55,oY+H*.048, W*.88,oY+H*.052],
        col:'rgba(255,165,0,',  w:2.8, warm:true,
        label:'Arus Balik Ekuatorial', lx:W*.46, ly:oY+H*.032,
      },
    ];

    // ─── HELPER: gambar kurva bezier multi-segmen + glow ───
    const drawCurrent=(pts,col,width,alpha)=>{
      // glow luar
      X.save();X.globalAlpha=alpha*0.28;
      X.strokeStyle=col+'0.9)';X.lineWidth=width*2.8;X.lineCap='round';X.lineJoin='round';
      X.shadowColor=col+'1)';X.shadowBlur=14;
      X.beginPath();X.moveTo(pts[0],pts[1]);
      for(let i=2;i<pts.length-2;i+=2){
        const mx=(pts[i]+pts[i+2])/2, my=(pts[i+1]+pts[i+3])/2;
        X.quadraticCurveTo(pts[i],pts[i+1],mx,my);
      }
      X.lineTo(pts[pts.length-2],pts[pts.length-1]);
      X.stroke();X.shadowBlur=0;
      // garis inti
      X.globalAlpha=alpha;
      X.strokeStyle=col+'0.88)';X.lineWidth=width;
      X.beginPath();X.moveTo(pts[0],pts[1]);
      for(let i=2;i<pts.length-2;i+=2){
        const mx=(pts[i]+pts[i+2])/2, my=(pts[i+1]+pts[i+3])/2;
        X.quadraticCurveTo(pts[i],pts[i+1],mx,my);
      }
      X.lineTo(pts[pts.length-2],pts[pts.length-1]);
      X.stroke();X.restore();
    };

    // ─── HELPER: interpolasi posisi di sepanjang polyline ───
    const getPtOnPath=(pts,frac)=>{
      const n=pts.length/2-1;
      const seg=Math.min(~~(frac*n),n-1);
      const f=frac*n-seg;
      return [lerp(pts[seg*2],pts[seg*2+2],f), lerp(pts[seg*2+1],pts[seg*2+3],f)];
    };

    // ─── HELPER: sudut arah di titik tertentu ───
    const getAngle=(pts,frac)=>{
      const f1=Math.max(0,frac-0.02), f2=Math.min(1,frac+0.02);
      const [x1,y1]=getPtOnPath(pts,f1);
      const [x2,y2]=getPtOnPath(pts,f2);
      return Math.atan2(y2-y1,x2-x1);
    };

    // ─── GAMBAR SEMUA ARUS ───
    currents.forEach((c,ci)=>{
      drawCurrent(c.pts, c.col, c.w, 0.72);

      // Panah arah (tiap ~20% jalur)
      for(let ai=0;ai<4;ai++){
        const af=(ai+0.5)/4;
        const [ax,ay]=getPtOnPath(c.pts,af);
        const ang=getAngle(c.pts,af);
        // Hanya gambar jika dalam zona laut
        if(ay<oceanY-H*0.07||ay>H-4)continue;
        const aw=c.w*1.4;
        X.save();X.globalAlpha=0.65+0.12*sin(t*0.02+ci+ai);
        X.translate(ax,ay);X.rotate(ang);
        X.fillStyle=c.col+'0.9)';
        X.shadowColor=c.col+'1)';X.shadowBlur=6;
        X.beginPath();
        X.moveTo(aw*1.5,0);
        X.lineTo(-aw*0.8,-aw*0.7);
        X.lineTo(-aw*0.3,0);
        X.lineTo(-aw*0.8,aw*0.7);
        X.closePath();X.fill();
        X.restore();
      }

      // Partikel mengalir di sepanjang arus
      const nParticles=3+ci%2;
      for(let pi=0;pi<nParticles;pi++){
        const speed=c.warm?0.006:0.004;
        const pf=((t*speed + (ci*0.31+pi*0.28))%1);
        const [px,py]=getPtOnPath(c.pts,pf);
        if(py<oceanY-H*0.08||py>H-4)continue;
        const pulse=0.70+0.25*sin(t*0.09+pi*1.8+ci);
        X.save();
        X.globalAlpha=pulse;
        X.fillStyle=c.col+'1)';
        X.shadowColor=c.col+'1)';X.shadowBlur=c.warm?10:7;
        X.beginPath();X.arc(px,py, c.warm?3.5:2.8, 0,TAU);X.fill();
        // Jejak partikel (ekor kecil)
        const pf2=Math.max(0,pf-0.025);
        const [px2,py2]=getPtOnPath(c.pts,pf2);
        X.globalAlpha=pulse*0.35;
        X.strokeStyle=c.col+'0.7)';X.lineWidth=c.w*0.55;X.lineCap='round';
        X.beginPath();X.moveTo(px,py);X.lineTo(px2,py2);X.stroke();
        X.restore();
      }

      // Label arus
      if(c.label&&c.lx){
        X.save();
        const isWarm=c.warm;
        const lcol=isWarm?'rgba(255,140,60,0.95)':'rgba(80,160,255,0.95)';
        X.font='bold 10px "Courier New"';
        const tw=X.measureText(c.label).width;
        X.globalAlpha=0.82;
        X.fillStyle='rgba(2,6,18,0.78)';
        X.strokeStyle=lcol.replace('0.95','0.5)').replace('rgba(','').replace(')','');
        // Panel label mini
        X.beginPath();
        const bx=c.lx-tw/2-7,by=c.ly-14;
        X.roundRect?X.roundRect(bx,by,tw+14,22,3):X.rect(bx,by,tw+14,22);
        X.fill();X.strokeStyle=isWarm?'rgba(255,130,40,0.5)':'rgba(60,140,255,0.5)';
        X.lineWidth=0.9;X.stroke();
        X.globalAlpha=1;
        X.fillStyle=lcol;X.textAlign='center';
        X.shadowColor=lcol;X.shadowBlur=6;
        X.fillText(c.label,c.lx,c.ly);
        X.restore();
      }
    });

    // ─── LEGENDA WARNA ───
    X.save();X.globalAlpha=0.82;
    // Panel legenda
    const lgX=W*0.04, lgY=oceanY+H*0.192;
    X.fillStyle='rgba(2,6,18,0.80)';X.strokeStyle='rgba(255,255,255,0.10)';X.lineWidth=1;
    X.beginPath();X.roundRect?X.roundRect(lgX,lgY,200,48,4):X.rect(lgX,lgY,200,48);
    X.fill();X.stroke();
    // Warm
    X.strokeStyle='rgba(240,90,30,0.9)';X.lineWidth=3.5;
    X.shadowColor='rgba(240,90,30,0.6)';X.shadowBlur=6;
    X.beginPath();X.moveTo(lgX+10,lgY+14);X.lineTo(lgX+42,lgY+14);X.stroke();
    X.shadowBlur=0;
    X.font='10px "Courier New"';X.fillStyle='rgba(240,180,100,0.9)';X.textAlign='left';
    X.fillText('Arus Hangat (ke kutub)',lgX+50,lgY+18);
    // Cold
    X.strokeStyle='rgba(30,110,230,0.9)';X.lineWidth=3.5;
    X.shadowColor='rgba(30,110,230,0.6)';X.shadowBlur=6;
    X.beginPath();X.moveTo(lgX+10,lgY+34);X.lineTo(lgX+42,lgY+34);X.stroke();
    X.shadowBlur=0;
    X.fillStyle='rgba(130,190,255,0.9)';X.fillText('Arus Dingin (ke ekuator)',lgX+50,lgY+38);
    X.restore();

    // ─── DOWNWELLING & UPWELLING marker ───
    // Downwelling kanan (arus dingin turun)
    X.save();X.globalAlpha=0.55+0.10*sin(t*0.035);
    X.strokeStyle='rgba(80,160,255,0.6)';X.lineWidth=1.4;X.setLineDash([3,4]);
    X.beginPath();X.moveTo(W*0.97,oceanY+H*0.005);X.lineTo(W*0.97,oceanY+H*0.13);X.stroke();
    X.setLineDash([]);
    // Panah bawah
    X.fillStyle='rgba(80,160,255,0.7)';
    X.beginPath();X.moveTo(W*0.97,oceanY+H*0.13);
    X.lineTo(W*0.964,oceanY+H*0.110);X.lineTo(W*0.976,oceanY+H*0.110);X.closePath();X.fill();
    X.font='8px "Courier New"';X.fillStyle='rgba(120,190,255,0.65)';X.textAlign='center';
    X.fillText('▼ Penenggelaman',W*0.97,oceanY+H*0.145);
    // Upwelling kiri (arus naik)
    X.strokeStyle='rgba(255,160,60,0.5)';X.setLineDash([3,4]);
    X.beginPath();X.moveTo(W*0.04,oceanY+H*0.10);X.lineTo(W*0.04,oceanY+H*0.005);X.stroke();
    X.setLineDash([]);
    X.fillStyle='rgba(255,160,60,0.65)';
    X.beginPath();X.moveTo(W*0.04,oceanY+H*0.005);
    X.lineTo(W*0.034,oceanY+H*0.025);X.lineTo(W*0.046,oceanY+H*0.025);X.closePath();X.fill();
    X.font='8px "Courier New"';X.fillStyle='rgba(255,180,80,0.65)';X.textAlign='center';
    X.fillText('▲ Upwelling',W*0.04,oceanY+H*0.118);
    X.restore();
  }

  // Vapor transport arrow (dashed)
  if(S.tog.evap_on){
    const prog2=((t*.012)%1);
    const vx=lerp(W*.7,W*.15,prog2),vy=lerp(H*.22,H*.18,prog2);
    X.save();X.globalAlpha=.55;
    X.setLineDash([8,6]);X.strokeStyle='rgba(74,176,232,.5)';X.lineWidth=1.5;
    X.beginPath();X.moveTo(W*.7,H*.22);X.lineTo(W*.15,H*.18);X.stroke();X.setLineDash([]);
    X.fillStyle='rgba(74,176,232,.85)';X.beginPath();X.arc(vx,vy,4,0,TAU);X.fill();
    X.font='8px Space Mono';X.fillStyle='rgba(74,176,232,.55)';X.textAlign='center';
    X.fillText('transpor uap  40×10³ km³/yr',W*.43,H*.14);X.restore();
  }

  // Water drop animation falling
  if(S.tog.evap_on&&t%12===0){
    for(let i=0;i<3;i++)spawn(rnd(W*.55,W*.95),rnd(H*.3,H*.4),{
      vx:rnd(-1,1),vy:rnd(2,4),decay:.012,size:rnd(2,5),
      col:'rgba(74,176,232,.8)',glow:2,drag:.995,ay:.1
    });
  }

  // Reservoir data (bottom bar)
  X.save();X.globalAlpha=.4;
  X.font='8px Space Mono';X.fillStyle='rgba(180,210,240,.7)';
  X.fillText('Atmosfer 12.7k km³ | Sungai 2.1k | Danau 91k | Es 26,350k | Samudra 1,335,040k km³',cx,H*.96);
  X.textAlign='center';X.restore();
}


// ═══════════════════════════════════════════════════════════════
//  SCENE 3 — Cryosphere: polar world + ice-albedo feedback
// ═══════════════════════════════════════════════════════════════
function scene3(t){
  // Polar night sky
  const bg=X.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#000508');bg.addColorStop(.5,'#010a12');bg.addColorStop(1,'#021525');
  X.fillStyle=bg;X.fillRect(0,0,W,H);
  drawStars(.9);

  // Aurora borealis — multi-layer curtains
  for(let i=0;i<5;i++){
    const aY=H*(.1+i*.04);
    const hue=145+i*22,speed=t*.012+i*.8;
    X.save();X.globalAlpha=.12+.07*sin(t*.018+i*1.2);
    const ag=X.createLinearGradient(0,aY-50,0,aY+50);
    ag.addColorStop(0,'transparent');
    ag.addColorStop(.4,`hsla(${hue},85%,55%,1)`);
    ag.addColorStop(.6,`hsla(${hue+15},80%,60%,1)`);
    ag.addColorStop(1,'transparent');
    X.fillStyle=ag;
    X.beginPath();X.moveTo(0,aY);
    for(let x=0;x<=W;x+=15)
      X.lineTo(x,aY+sin(x*.006+speed)*30+sin(x*.012+speed*.7)*15+cos(x*.009+i)*10);
    X.lineTo(W,0);X.lineTo(0,0);X.closePath();X.fill();
    X.restore();
  }

  const horizY=H*.55;

  // Ice terrain
  X.save();
  const iceG=X.createLinearGradient(0,horizY*.5,0,H);
  iceG.addColorStop(0,`rgba(${~~(190*S.iceLevel+40)},${~~(220*S.iceLevel+20)},${~~(240*S.iceLevel+15)},${.88+.1*S.iceLevel})`);
  iceG.addColorStop(.5,`rgba(${~~(160*S.iceLevel+30)},${~~(200*S.iceLevel+15)},${~~(230*S.iceLevel+10)},.8)`);
  iceG.addColorStop(1,`rgba(40,80,120,.9)`);
  X.fillStyle=iceG;
  X.beginPath();X.moveTo(0,H);X.lineTo(0,horizY);
  for(let x=0;x<=W;x+=20)X.lineTo(x,horizY+sin(x*.014)*12+cos(x*.022)*6);
  X.lineTo(W,H);X.closePath();X.fill();
  // Ice cracks
  X.globalAlpha=.25*S.iceLevel;X.strokeStyle='rgba(180,220,255,.5)';X.lineWidth=.8;
  for(let i=0;i<20;i++){
    const ix=rnd(0,W),iy=horizY+rnd(0,H*.3);
    X.beginPath();X.moveTo(ix,iy);
    for(let j=0;j<3;j++)X.lineTo(ix+rnd(-40,40),iy+rnd(-15,25));
    X.stroke();
  }
  X.restore();

  // Floating icebergs
  for(let i=0;i<4;i++){
    const bx=((i*W*.28+t*.3)%(W+200))-100,by=horizY-5;
    const bw=40+i*20,bh=25+i*12;
    X.save();X.globalAlpha=S.iceLevel*.85;
    const ig=X.createLinearGradient(bx,by-bh,bx,by);
    ig.addColorStop(0,'rgba(220,240,255,.92)');ig.addColorStop(.6,'rgba(180,215,245,.75)');ig.addColorStop(1,'rgba(120,175,220,.5)');
    X.fillStyle=ig;
    X.beginPath();X.moveTo(bx-bw/2,by);X.lineTo(bx-bw*.35,by-bh);X.lineTo(bx,by-bh*1.3);
    X.lineTo(bx+bw*.3,by-bh*.8);X.lineTo(bx+bw/2,by);X.closePath();X.fill();
    // Underwater part
    X.globalAlpha=S.iceLevel*.25;X.fillStyle='rgba(100,160,210,.6)';
    X.beginPath();X.ellipse(bx,by+bh*.3,bw*.35,bh*.5,0,0,TAU);X.fill();
    X.restore();
  }

  // Solar radiation arrows hitting ice vs. ocean (albedo feedback animation!)
  if(S.tog.albedo_on){
    for(let i=0;i<6;i++){
      const bx=W*.15+i*W*.12,prog=(t*.015+i*.18)%1;
      // Incoming ray
      const ry=lerp(0,horizY,prog);
      X.save();X.globalAlpha=.6*(1-prog*.4);
      X.strokeStyle='rgba(255,225,80,.7)';X.lineWidth=1.8;
      X.setLineDash([6,4]);X.beginPath();X.moveTo(bx,0);X.lineTo(bx,ry);X.stroke();X.setLineDash([]);
      X.restore();
      // At surface: ice reflects back (white arrows up), ocean absorbs (red dot)
      if(prog>.85){
        if(i<3&&S.iceLevel>.3){
          // Reflection off ice — white arrows back up
          for(let r=0;r<3;r++){
            spawn(bx+rnd(-5,5),horizY,{vx:rnd(-1.5,1.5),vy:rnd(-4,-2),decay:.025,
              size:rnd(1.5,3),col:'rgba(230,245,255,.9)',glow:2,drag:.97});
          }
        } else {
          // Absorption by dark ocean — heat dot
          spawn(bx,horizY+5,{vx:0,vy:0,decay:.04,size:8,
            col:'rgba(255,80,40,.7)',glow:4,drag:1});
        }
      }
    }
    // Labels
    X.save();X.font='10px Space Grotesk';X.fillStyle='rgba(255,225,80,.8)';
    X.fillText('Albedo Es = 0.85',W*.04,H*.5);
    X.fillText('Albedo Laut = 0.06',W*.04,H*.52);
    X.font='9px Space Mono';X.fillStyle='rgba(255,255,255,.35)';
    X.fillText('↑ Es mencair → albedo ↓ → lebih panas terserap → feedback positif',W*.04,H*.54);
    X.restore();
  }

  // ICE EXTENT graphic data (slides 17)
  if(S.tog.arctic_on){
    X.save();
    const bx=W*.6,by=H*.08;
    // Animated extent bar
    const maxE=14,minE=6,curE=lerp(minE,maxE,S.iceLevel);
    X.font='300 12px Space Grotesk';X.fillStyle='rgba(168,216,240,.9)';
    X.fillText('ES LAUT BELAHAN UTARA',bx,by);
    X.font='9px Space Mono';X.fillStyle='rgba(168,216,240,.55)';
    ['Maks: 14.0×10⁶ km² (Maret)','Min:    6.0×10⁶ km² (September)','Vol maks: 0.05×10⁶ km³'].forEach((s,i)=>X.fillText(s,bx,by+18+i*14));
    // Animated extent circle
    const cR=28+20*S.iceLevel;
    const cg=X.createRadialGradient(bx+180,by+40,0,bx+180,by+40,cR);
    cg.addColorStop(0,'rgba(220,240,255,.9)');cg.addColorStop(1,'rgba(100,170,220,.2)');
    X.beginPath();X.arc(bx+180,by+40,cR,0,TAU);X.fillStyle=cg;X.fill();
    X.font='9px Space Mono';X.fillStyle='rgba(168,216,240,.8)';X.textAlign='center';
    X.fillText(`${curE.toFixed(1)}M km²`,bx+180,by+44);
    X.restore();
  }

  // Melt particles
  if(S.tog.melt_sim&&t%6===0){
    for(let i=0;i<3;i++)spawn(rnd(0,W),horizY,{
      vx:rnd(-1,1),vy:rnd(2,5),decay:.012,size:rnd(3,7),
      col:'rgba(140,205,250,.8)',glow:3,drag:.99,ay:.05
    });
  }

  // Permafrost label
  X.save();X.globalAlpha=.35;X.font='9px Space Mono';X.fillStyle='rgba(180,220,255,.6)';
  X.fillText('Permafrost: 22×10³ km³  |  Tutupan Salju BU maks 46.5×10⁶ km²',cx,H*.97);
  X.textAlign='center';X.restore();
}

// _ghMols — molekul gas melayang di scene4
let _ghMols=[];
function _initGHMols(){
  _ghMols=Array.from({length:95},()=>({
    x:rnd(10,W||800),y:rnd((H||600)*0.05,(H||600)*0.66),
    vx:rnd(-.22,.22),vy:rnd(-.18,.18),
    type:['CO2','CO2','CO2','H2O','CH4'][~~rnd(0,5)],
    size:rnd(4,8),t:rnd(0,100)
  }));
}
setTimeout(_initGHMols,50);

// ══════════════════════════════════════════════════════════════
//  SCENE 4 — Biosfer & Siklus Karbon
//
//  Layout cross-section:
//  LANGIT — CO₂ meter berjalan, molekul gas melayang
//  HUTAN  — pohon hidup / terbakar / ditebang (kiri)
//  PABRIK — emisi asap (tengah-kanan)
//  LAUT   — karbon sink (kanan)
//  TANAH  — cadangan karbon bawah tanah
//
//  Efek terintegrasi:
//  - CO₂ slider → langit makin merah, pohon mengering, laut coklat
//  - forest_on  → fotosintesis: CO₂ turun ke pohon, O₂ naik
//  - defor_on   → api besar + asap, hutan hilang bertahap
//  - fossil_on  → asap tebal dari cerobong
//  - ocean_c    → gelembung CO₂ masuk laut, asidifikasi warna
// ══════════════════════════════════════════════════════════════

// Static: pohon-pohon (kiri)
const _s4trees = Array.from({length:22},(_,i)=>({
  x: 0.015 + i*0.042 + rnd(-0.008,0.008),
  h: rnd(0.11,0.19), w: rnd(0.024,0.040),
  type: i%3, swayP: rnd(0,TAU), burnt: false, chopProg: 0
}));

// CO₂ reservoir boxes (posisi tetap, nilai animasi)
const _s4reservoirs=[
  {id:'atmo',  label:'Atmosfer',     val:()=>S.co2*2.1,  unit:'GtC', x:0.50, y:0.08, col:'rgba(74,176,232,0.9)'},
  {id:'veg',   label:'Vegetasi',     val:()=>610*S.forestLevel, unit:'GtC', x:0.12, y:0.34, col:'rgba(92,200,100,0.9)'},
  {id:'soil',  label:'Tanah',        val:()=>1580*S.forestLevel, unit:'GtC', x:0.12, y:0.52, col:'rgba(180,140,70,0.9)'},
  {id:'ocean', label:'Laut Dalam',   val:()=>38000,       unit:'GtC', x:0.86, y:0.42, col:'rgba(30,100,220,0.9)'},
  {id:'fossil',label:'B. Fosil',     val:()=>3700,        unit:'GtC', x:0.60, y:0.52, col:'rgba(232,98,42,0.9)'},
];

// Flux arrows (dari→ke, label, arah aktif)
const _s4fluxes=[
  // fotosintesis: atmo→veg
  {from:'atmo',to:'veg',   label:'Fotosintesis\n120 GtC/yr',  col:'rgba(80,220,100,0.8)',  tog:'forest_on', dir:1},
  // respirasi: veg→atmo
  {from:'veg', to:'atmo',  label:'Respirasi\n119.6 GtC/yr',  col:'rgba(180,220,120,0.65)', tog:'forest_on', dir:-1},
  // dekomposisi: soil→atmo
  {from:'soil',to:'atmo',  label:'Dekomposisi\n1.6 GtC/yr',  col:'rgba(200,160,80,0.7)',  tog:null,        dir:1},
  // laut serap: atmo→ocean
  {from:'atmo',to:'ocean', label:'Serap Laut\n2.2 GtC/yr',   col:'rgba(30,140,255,0.8)',  tog:'ocean_c',   dir:1},
  // emisi fosil: fossil→atmo
  {from:'fossil',to:'atmo',label:'Emisi Fosil\n6.3 GtC/yr',  col:'rgba(255,100,30,0.85)', tog:'fossil_on', dir:1},
  // deforestasi: veg→atmo
  {from:'veg',to:'atmo',   label:'Deforestasi\n1.6 GtC/yr',  col:'rgba(255,60,20,0.85)',  tog:'defor_on',  dir:1},
];

// Pohon siklus penebangan
let _s4chopT=0;

function _s4drawTree(tx,ty,h,w,type,sway,fl,burnt,chopP){
  const dead= chopP>0 || burnt;
  const hue = burnt? rnd(8,25) : 108+fl*16;
  const sat = burnt? 60 : 50+fl*20;
  const lit  = burnt? 12 : 18+fl*14;
  const c1=`hsl(${hue},${sat}%,${lit}%)`;
  const c2=`hsl(${hue+10},${sat+8}%,${lit+8}%)`;
  const scaleY = 1 - chopP;
  X.save(); X.translate(tx, ty); X.rotate(sway + chopP*0.8);
  // Batang
  const tg=X.createLinearGradient(-w*0.1,0,w*0.1,0);
  tg.addColorStop(0,'#1a0c04'); tg.addColorStop(0.5,burnt?'#2a1006':'#5a3018'); tg.addColorStop(1,'#1a0c04');
  X.fillStyle=tg;
  X.beginPath();
  X.moveTo(-w*0.09,0);
  X.bezierCurveTo(-w*0.08,-h*0.35,w*0.04*sway*10-w*0.04,-h*0.65,w*0.02,-h*scaleY);
  X.bezierCurveTo(w*0.1,-h*scaleY,w*0.1,-h*0.65,w*0.09,0);
  X.closePath(); X.fill();

  if(chopP>=1){ X.restore(); return; }
  if(type===0){
    // Konifer 3 lapis
    [[h*scaleY,w*1.0],[h*scaleY*0.70,w*0.85],[h*scaleY*0.42,w*0.60]].forEach(([hh,ww],li)=>{
      const shade=burnt?`hsl(${hue},${sat-li*10}%,${lit+li*3}%)`:`hsl(${hue+li*5},${sat+li*5}%,${lit+li*5}%)`;
      // Shadow
      X.save(); X.globalAlpha=0.20;
      X.fillStyle='rgba(0,0,0,0.5)';
      X.beginPath();X.moveTo(w*0.06,-hh*0.14);X.lineTo(ww*0.52,-hh*0.14);X.lineTo(w*0.06,-hh);X.closePath();X.fill();
      X.restore();
      const cg=X.createLinearGradient(-ww*0.5,-hh,-hh*0.05,-hh*0.12);
      cg.addColorStop(0,shade); cg.addColorStop(1,c2);
      X.fillStyle=cg;
      X.beginPath();X.moveTo(0,-hh);X.lineTo(ww*0.52,-hh*0.14);X.lineTo(-ww*0.52,-hh*0.14);X.closePath();X.fill();
    });
  } else if(type===1){
    // Pohon lebar / oak
    const rad=w*1.1;
    const cg=X.createRadialGradient(-rad*0.2,-h*scaleY*0.88,0,0,-h*scaleY*0.72,rad);
    cg.addColorStop(0,c2); cg.addColorStop(0.6,c1); cg.addColorStop(1,'rgba(0,0,0,0.3)');
    X.fillStyle=cg;
    X.beginPath();X.arc(0,-h*scaleY*0.78,rad,0,TAU); X.fill();
    // Depth puff
    X.save(); X.globalAlpha=0.18;
    X.fillStyle='rgba(0,0,0,0.5)';
    X.beginPath();X.arc(rad*0.28,-h*scaleY*0.68,rad*0.6,0,TAU); X.fill();
    X.restore();
  } else {
    // Palem
    X.save(); X.translate(0,-h*scaleY);
    for(let li=0;li<7;li++){
      const la=(li/7)*TAU*0.7-PI*0.25;
      X.save(); X.rotate(la+sway*2);
      const lg=X.createLinearGradient(0,0,w*1.6,0);
      lg.addColorStop(0,c2); lg.addColorStop(0.7,c1); lg.addColorStop(1,'transparent');
      X.strokeStyle=lg; X.lineWidth=w*0.22; X.lineCap='round';
      X.beginPath(); X.moveTo(0,0);
      X.quadraticCurveTo(w*0.9,h*0.12*scaleY,w*1.6,h*0.25*scaleY);
      X.stroke(); X.restore();
    }
    X.restore();
  }

  // Api saat terbakar
  if(burnt){
    for(let fi=0;fi<5;fi++){
      const fa=sin(TAU*fi/5)*w*0.4;
      const fg=X.createRadialGradient(fa,-h*scaleY*0.5+fi*3,0,fa,-h*scaleY*0.5,w*0.6);
      fg.addColorStop(0,`rgba(255,${200-fi*20},0,0.7)`);
      fg.addColorStop(1,'transparent');
      X.fillStyle=fg;
      X.beginPath();X.arc(fa,-h*scaleY*0.5,w*0.6,0,TAU);X.fill();
    }
  }
  X.restore();
}

// Gambar pabrik realistis
function _s4factory(fx,fy,scale,t2){
  X.save(); X.translate(fx,fy);
  // Gedung utama
  const bg=X.createLinearGradient(-scale*0.5,-scale*0.8,scale*0.5,0);
  bg.addColorStop(0,'#1a2028'); bg.addColorStop(0.5,'#242e38'); bg.addColorStop(1,'#1a2028');
  X.fillStyle=bg; X.fillRect(-scale*0.5,-scale*0.8,scale,scale*0.8);
  // Jendela pabrik
  X.save(); X.globalAlpha=0.5;
  for(let wi=0;wi<3;wi++){
    for(let wj=0;wj<2;wj++){
      const wx=-scale*0.35+wi*scale*0.3, wy=-scale*0.65+wj*scale*0.28;
      X.fillStyle='rgba(255,200,60,0.6)';
      X.fillRect(wx,wy,scale*0.12,scale*0.12);
      X.strokeStyle='rgba(255,255,255,0.1)'; X.lineWidth=0.8;
      X.strokeRect(wx,wy,scale*0.12,scale*0.12);
    }
  }
  X.restore();
  // Badan bawah
  X.fillStyle='#2c3840'; X.fillRect(-scale*0.65,-scale*0.5,scale*1.3,scale*0.5);
  // Pintu
  X.fillStyle='#0a1018'; X.fillRect(-scale*0.08,0-scale*0.28,scale*0.16,scale*0.28);

  // Cerobong (3 ukuran berbeda)
  const chimneys=[[-scale*0.28,scale*0.14],[scale*0.06,scale*0.18],[scale*0.36,scale*0.12]];
  chimneys.forEach(([cx2,cw],ci)=>{
    const chH=scale*(0.6+ci*0.15);
    // Badan cerobong gradasi
    const chG=X.createLinearGradient(cx2-cw/2,0,cx2+cw/2,0);
    chG.addColorStop(0,'#1c2830'); chG.addColorStop(0.5,'#2e3e4a'); chG.addColorStop(1,'#1c2830');
    X.fillStyle=chG; X.fillRect(cx2-cw/2,-chH,cw,chH);
    // Garis horizontal cerobong
    X.save(); X.globalAlpha=0.15;
    for(let ri=0;ri<4;ri++){
      X.strokeStyle='rgba(255,255,255,0.3)'; X.lineWidth=0.7;
      X.beginPath(); X.moveTo(cx2-cw/2,-chH*ri/4); X.lineTo(cx2+cw/2,-chH*ri/4); X.stroke();
    }
    X.restore();
    // Rim atas cerobong
    X.fillStyle='#384858'; X.fillRect(cx2-cw/2-2,-chH-3,cw+4,5);
    // Asap mengepul dari tiap cerobong
    const smokeCount = S.tog.fossil_on ? 9 : 3;
    for(let si=0;si<smokeCount;si++){
      const sp=(t2*1.3+si*22+ci*40)%120;
      const sy=-chH-sp*0.9;
      const sw= S.tog.fossil_on? (cw*0.6+si*cw*0.45) : (cw*0.4+si*cw*0.25);
      if(sy < -chH*4) continue;
      const hf2=clamp((S.co2-280)/520,0,1);
      const sr=~~(100+si*8+hf2*60), sg=~~(80+si*5), sb=~~(70+si*4);
      const sa=S.tog.fossil_on? clamp(0.42-si*0.04,0,0.42) : clamp(0.18-si*0.02,0,0.18);
      X.save(); X.globalAlpha=sa;
      X.fillStyle=`rgba(${sr},${sg},${sb},1)`;
      X.beginPath();
      X.arc(cx2+sin(t2*0.06+si*0.8+ci)*sw*0.4, sy, sw, 0, TAU);
      X.fill(); X.restore();
    }
  });
  X.restore();
}

// Gambar kolom CO₂ meter (kanan atas)
function _s4co2meter(t2){
  const hf=clamp((S.co2-280)/520,0,1);
  const mx=W*0.76, my=H*0.06, mw=W*0.22, mh=H*0.28;

  X.save();
  // Panel background
  X.globalAlpha=0.88;
  X.fillStyle='rgba(4,8,20,0.85)'; X.strokeStyle='rgba(255,255,255,0.08)'; X.lineWidth=1;
  X.beginPath();
  X.roundRect?X.roundRect(mx,my,mw,mh,6):X.rect(mx,my,mw,mh);
  X.fill(); X.stroke();

  X.globalAlpha=1;
  // Judul
  X.font='bold 11px "Courier New"'; X.fillStyle='rgba(255,255,255,0.75)'; X.textAlign='left';
  X.fillText('KONSENTRASI CO₂', mx+12, my+18);
  X.font='9px "Courier New"'; X.fillStyle='rgba(255,255,255,0.35)';
  X.fillText('Atmosfer Global', mx+12, my+30);

  // Nilai besar berubah warna
  const valCol = S.co2<350?'rgba(80,220,100,0.95)':S.co2<450?'rgba(255,200,50,0.95)':S.co2<550?'rgba(255,130,30,0.95)':'rgba(255,50,30,0.95)';
  X.font='bold 28px "Courier New"'; X.fillStyle=valCol; X.textAlign='center';
  X.shadowColor=valCol; X.shadowBlur=18;
  X.fillText(`${~~S.co2}`, mx+mw*0.38, my+68);
  X.shadowBlur=0;
  X.font='13px "Courier New"'; X.fillStyle='rgba(255,255,255,0.5)'; X.textAlign='left';
  X.fillText('ppm', mx+mw*0.56, my+68);

  // Bar gradient
  const barX=mx+12, barY=my+80, barW=mw-24, barH=12;
  // background bar
  X.fillStyle='rgba(255,255,255,0.06)';
  X.beginPath(); X.roundRect?X.roundRect(barX,barY,barW,barH,3):X.rect(barX,barY,barW,barH); X.fill();
  // fill bar
  const barFill=hf;
  const barG=X.createLinearGradient(barX,0,barX+barW,0);
  barG.addColorStop(0,'rgba(80,220,100,0.9)');
  barG.addColorStop(0.4,'rgba(255,200,50,0.9)');
  barG.addColorStop(0.7,'rgba(255,120,30,0.9)');
  barG.addColorStop(1,'rgba(255,40,20,0.9)');
  X.fillStyle=barG;
  X.beginPath();
  const fw=barW*barFill;
  X.roundRect?X.roundRect(barX,barY,fw,barH,3):X.rect(barX,barY,fw,barH);
  X.fill();
  // Marker referensi
  const markers=[{v:280,l:'280\nPra-ind'},{v:350,l:'350\nAman'},{v:450,l:'450\nBatas'},{v:800,l:'800\nEkstrem'}];
  markers.forEach(m=>{
    const mx2=barX+barW*clamp((m.v-280)/520,0,1);
    X.strokeStyle='rgba(255,255,255,0.25)'; X.lineWidth=1;
    X.beginPath(); X.moveTo(mx2,barY-2); X.lineTo(mx2,barY+barH+2); X.stroke();
    X.font='7px "Courier New"'; X.fillStyle='rgba(255,255,255,0.35)'; X.textAlign='center';
    X.fillText(m.l.split('\n')[1], mx2, barY+barH+11);
  });

  // Status label
  const statusTxt = S.co2<350?'■ AMAN':S.co2<450?'▲ WASPADA':S.co2<550?'● BERBAHAYA':'⚠ KRITIS';
  X.font='bold 10px "Courier New"'; X.fillStyle=valCol; X.textAlign='center';
  X.fillText(statusTxt, mx+mw/2, my+mh-52);

  // Mini grafik tren (garis naik)
  const gx=mx+10, gy2=my+mh-42, gw=mw-20, gh2=30;
  X.strokeStyle='rgba(255,255,255,0.08)'; X.lineWidth=0.7;
  X.beginPath(); X.moveTo(gx,gy2); X.lineTo(gx,gy2+gh2); X.lineTo(gx+gw,gy2+gh2); X.stroke();
  // Kurva tren Keeling — dari 280 ke nilai saat ini
  X.strokeStyle=valCol; X.lineWidth=1.8; X.shadowColor=valCol; X.shadowBlur=5;
  X.beginPath();
  for(let xi=0;xi<=gw;xi+=4){
    const frac=xi/gw;
    const co2Val=280+frac*frac*(S.co2-280); // kurva eksponensial
    const yi=gy2+gh2-gh2*clamp((co2Val-280)/520,0,1);
    xi===0?X.moveTo(gx+xi,yi):X.lineTo(gx+xi,yi);
  }
  X.stroke(); X.shadowBlur=0;
  X.font='8px "Courier New"'; X.fillStyle='rgba(255,255,255,0.3)'; X.textAlign='left';
  X.fillText('1750→Sekarang', gx, gy2+gh2+10);

  // Dampak suhu
  const dT=(S.co2-280)*0.008;
  X.font='10px "Courier New"'; X.fillStyle=valCol; X.textAlign='center';
  X.fillText(`ΔT ≈ +${dT.toFixed(2)}°C`, mx+mw/2, my+mh-8);

  X.restore();
}

// Panel reservoir dengan nilai animasi
function _s4reservoir(rx,ry,rw,rh,label,val,unit,col){
  X.save();
  X.globalAlpha=0.82;
  X.fillStyle='rgba(4,8,20,0.80)'; X.strokeStyle=col.replace('0.9','0.5'); X.lineWidth=1;
  X.beginPath();
  X.roundRect?X.roundRect(rx-rw/2,ry-rh/2,rw,rh,4):X.rect(rx-rw/2,ry-rh/2,rw,rh);
  X.fill(); X.stroke();
  X.globalAlpha=1;
  X.font='bold 10px "Courier New"'; X.fillStyle=col; X.textAlign='center';
  X.shadowColor=col; X.shadowBlur=6;
  X.fillText(label, rx, ry-rh/2+14);
  X.shadowBlur=0;
  X.font='11px "Courier New"'; X.fillStyle='rgba(255,255,255,0.8)';
  X.fillText(`${val>=1000?(val/1000).toFixed(0)+'k':~~val} ${unit}`, rx, ry+5);
  X.restore();
}

function scene4(t){
  const hf=clamp((S.co2-280)/520,0,1);

  // ══ 1. LANGIT — warna berubah sesuai CO₂ (biru→oranye→merah)
  const skyH1=220-hf*80, skyS1=45+hf*28, skyL1=12+hf*14;
  const skyG=X.createLinearGradient(0,0,0,H);
  skyG.addColorStop(0,`hsl(${skyH1},${skyS1}%,${skyL1}%)`);
  skyG.addColorStop(0.5,`hsl(${skyH1-18},${skyS1-8}%,${skyL1-3}%)`);
  skyG.addColorStop(1,'#050a08');
  X.fillStyle=skyG; X.fillRect(0,0,W,H);

  // Smog layer saat CO₂ tinggi
  if(hf>0.3){
    const smogG=X.createLinearGradient(0,0,0,H*0.55);
    smogG.addColorStop(0,'transparent');
    smogG.addColorStop(0.6,`rgba(${~~(180+hf*50)},${~~(100-hf*50)},${~~(40-hf*30)},${hf*0.18})`);
    smogG.addColorStop(1,'transparent');
    X.fillStyle=smogG; X.fillRect(0,0,W,H*0.55);
  }

  const gY=H*0.70; // horizon

  // ══ 2. TANAH BAWAH — layer bertingkat
  // Layer tanah atas (coklat, simpan karbon)
  const soilG=X.createLinearGradient(0,gY,0,H);
  soilG.addColorStop(0,`hsl(${28+hf*8},${45+S.forestLevel*18}%,${22+S.forestLevel*8}%)`);
  soilG.addColorStop(0.4,'#6a4020'); soilG.addColorStop(0.75,'#3a2010'); soilG.addColorStop(1,'#1a0c04');
  X.fillStyle=soilG; X.fillRect(0,gY,W,H-gY);
  // Garis batas layer
  X.save(); X.globalAlpha=0.15;
  X.strokeStyle='rgba(255,200,100,0.4)'; X.lineWidth=0.8;
  [[0.35,'Humus & Akar'],[0.60,'Subsoil'],[0.82,'Batuan Dasar']].forEach(([frac,lbl])=>{
    const ly=gY+(H-gY)*frac;
    X.beginPath(); X.moveTo(0,ly); X.lineTo(W,ly); X.stroke();
  });
  X.restore();

  // Akar pohon di tanah (visible saat forest_on)
  if(S.tog.forest_on){
    X.save(); X.globalAlpha=0.18+0.06*S.forestLevel;
    X.strokeStyle='rgba(120,70,20,0.6)'; X.lineWidth=1.2;
    _s4trees.forEach((tr,ti)=>{
      if(tr.x>0.58) return;
      const tx=tr.x*W, ty=gY;
      for(let ri=0;ri<3;ri++){
        X.beginPath(); X.moveTo(tx,ty);
        X.quadraticCurveTo(tx+rnd(-30,30),ty+H*0.05,tx+rnd(-50,50),ty+H*(0.08+ri*0.04));
        X.stroke();
      }
    });
    X.restore();
  }

  // ══ 3. LAUT (kanan) — warna berubah saat acidifikasi
  const seaX=W*0.72;
  const acidH=S.tog.ocean_c? hf*0.4 : hf*0.15;
  const seaG=X.createLinearGradient(seaX,gY,W,H);
  seaG.addColorStop(0,`rgba(${~~(18+acidH*80)},${~~(100-acidH*40)},${~~(200-acidH*80)},1)`);
  seaG.addColorStop(0.5,`rgba(${~~(12+acidH*60)},${~~(70-acidH*30)},${~~(160-acidH*60)},1)`);
  seaG.addColorStop(1,`rgba(${~~(6+acidH*40)},${~~(40-acidH*20)},${~~(100-acidH*40)},1)`);
  X.fillStyle=seaG; X.fillRect(seaX,gY,W-seaX,H-gY);
  // Ombak laut
  for(let wi=0;wi<5;wi++){
    X.save(); X.globalAlpha=0.06+wi*0.025;
    X.strokeStyle=`rgba(${~~(100-acidH*40)},${~~(180-acidH*40)},${~~(240-acidH*40)},0.8)`;
    X.lineWidth=1+wi*0.15;
    X.beginPath(); let fw=true;
    for(let wx=seaX;wx<=W;wx+=3){
      const wy=gY+wi*2.8+sin(wx*0.012+t*0.016+wi)*2.2;
      fw?(X.moveTo(wx,wy),fw=false):X.lineTo(wx,wy);
    }
    X.stroke(); X.restore();
  }
  // Pantai
  const beachG=X.createLinearGradient(W*0.68,gY,seaX,gY+H*0.03);
  beachG.addColorStop(0,'#c8a060'); beachG.addColorStop(1,'rgba(180,140,80,0)');
  X.fillStyle=beachG; X.fillRect(W*0.68,gY,W*0.06,H*0.04);

  // ══ 4. POHON-POHON di zona kiri
  // Urutkan belakang → depan
  [..._s4trees].sort((a,b)=>a.h-b.h).forEach((tr,ti)=>{
    if(tr.x>0.60) return;
    const tx=tr.x*W;
    const tY=gY+H*0.005+sin(tx*0.02)*H*0.006;
    const sway=sin(t*0.016+tr.swayP)*0.022;
    // Penebangan progresif saat defor_on
    if(S.tog.defor_on){
      tr.chopProg=Math.min(1,tr.chopProg+(0.00008+ti*0.00002));
    } else {
      tr.chopProg=Math.max(0,tr.chopProg-0.001);
    }
    const fl2=S.forestLevel*(1-tr.chopProg);
    _s4drawTree(tx,tY,tr.h*H,tr.w*W,tr.type,sway,fl2,tr.burnt,tr.chopProg);
    // Serbuk gergaji saat ditebang
    if(S.tog.defor_on && tr.chopProg>0 && tr.chopProg<0.95 && t%6===0 && ti%2===0){
      for(let si=0;si<2;si++) spawn(tx+rnd(-8,8),tY-tr.h*H*0.1,{
        vx:rnd(-2,2),vy:rnd(-1.5,0.5),decay:0.022,size:rnd(1.5,3),
        col:'rgba(180,120,40,0.8)',glow:1,drag:0.96,ay:0.04
      });
    }
  });

  // ══ 5. PABRIK di tengah-kanan daratan
  const facX=W*0.57, facY=gY;
  _s4factory(facX,facY,W*0.072,t);

  // ══ 6. EFEK per toggle ─────────────────────────────────────

  // ── forest_on: Fotosintesis (CO₂ turun ke pohon, O₂ naik) ──
  if(S.tog.forest_on){
    if(t%4===0 && S.forestLevel>0.1){
      // CO₂ menuju pohon (oranye turun)
      spawn(rnd(W*0.02,W*0.58),rnd(H*0.15,H*0.45),{
        vx:rnd(-0.4,0.4),vy:rnd(0.8,2.0),decay:0.010,
        size:rnd(2.5,4.5),col:'rgba(255,120,40,0.62)',glow:2.5,drag:0.993
      });
    }
    if(t%5===0 && S.forestLevel>0.1){
      // O₂ keluar dari pohon (biru-putih naik)
      const tx2=_s4trees[~~rnd(0,14)].x*W;
      spawn(tx2+rnd(-10,10),gY-rnd(H*0.08,H*0.20),{
        vx:rnd(-0.3,0.3),vy:rnd(-1.5,-0.4),decay:0.007,
        size:rnd(2,3.5),col:'rgba(140,230,255,0.65)',glow:2,drag:0.997,wobble:0.009,wfreq:0.06
      });
    }
    // Label GPP
    X.save(); X.globalAlpha=0.75;
    X.font='10px "Courier New"'; X.fillStyle='rgba(92,200,100,0.9)'; X.textAlign='left';
    X.shadowColor='rgba(50,180,80,0.5)'; X.shadowBlur=6;
    X.fillText('↓ CO₂  GPP=120 GtC/yr', W*0.02, gY-H*0.20);
    X.fillText('↑ O₂   Resp=119.6 GtC/yr', W*0.02, gY-H*0.175);
    X.shadowBlur=0; X.restore();
  }

  // ── fossil_on: Emisi pabrik + CO₂ menyebar ke atmosfer ──
  if(S.tog.fossil_on){
    if(t%4===0){
      spawn(facX+rnd(-W*0.04,W*0.04),facY-H*0.18,{
        vx:rnd(-0.6,0.6),vy:rnd(-2.2,-0.7),decay:0.006,
        size:rnd(4,9),col:`rgba(${~~(160+hf*60)},${~~(100-hf*40)},${~~(70-hf*30)},0.35)`,
        glow:0,drag:0.992,wobble:0.014,wfreq:0.04
      });
      // Partikel CO₂ merah-oranye
      spawn(facX+rnd(-20,20),facY-H*0.14,{
        vx:rnd(-0.8,0.8),vy:rnd(-2.5,-0.8),decay:0.008,
        size:rnd(2,5),col:`rgba(255,${~~(80+hf*60)},20,0.72)`,glow:3,drag:0.990
      });
    }
    X.save(); X.globalAlpha=0.80;
    X.font='bold 10px "Courier New"'; X.fillStyle='rgba(255,120,40,0.95)'; X.textAlign='center';
    X.shadowColor='rgba(255,80,20,0.6)'; X.shadowBlur=8;
    X.fillText('Emisi Fosil', facX, facY-H*0.24);
    X.font='9px "Courier New"'; X.fillStyle='rgba(255,160,60,0.7)'; X.shadowBlur=0;
    X.fillText('6.3 GtC/yr', facX, facY-H*0.225);
    X.restore();
  }

  // ── ocean_c: Laut serap CO₂ ──
  if(S.tog.ocean_c){
    if(t%5===0){
      spawn(W*0.76+rnd(0,W*0.22),gY-rnd(2,6),{
        vx:rnd(-0.2,0.2),vy:rnd(0.8,2.5),decay:0.012,
        size:rnd(2,4.5),col:'rgba(30,140,255,0.65)',glow:2.5,drag:0.995
      });
    }
    // Gelembung CO₂ di dalam laut
    if(t%7===0){
      spawn(W*0.76+rnd(0,W*0.22),gY+rnd(H*0.02,H*0.06),{
        vx:rnd(-0.12,0.12),vy:rnd(-0.8,-0.25),decay:0.009,
        size:rnd(1.5,3.2),col:'rgba(180,230,255,0.5)',glow:1.5,drag:0.995,wobble:0.007,wfreq:0.09
      });
    }
    X.save(); X.globalAlpha=0.80;
    X.font='bold 10px "Courier New"'; X.fillStyle='rgba(60,160,255,0.95)'; X.textAlign='center';
    X.shadowColor='rgba(30,100,255,0.5)'; X.shadowBlur=8;
    X.fillText('Serap Laut', W*0.855, gY-H*0.10);
    X.font='9px "Courier New"'; X.fillStyle='rgba(100,180,255,0.7)'; X.shadowBlur=0;
    X.fillText('2.2 GtC/yr', W*0.855, gY-H*0.085);
    if(hf>0.3){
      X.font='9px "Courier New"'; X.fillStyle='rgba(255,150,50,0.8)';
      X.fillText(`⚠ pH ≈ ${(8.2-hf*0.35).toFixed(2)} (asidifikasi)`, W*0.855, gY-H*0.065);
    }
    X.restore();
  }

  // ── defor_on: Api besar + smoke tebal + CO₂ rilis ──
  if(S.tog.defor_on){
    // Api deforestasi di beberapa spot pohon
    [0.12,0.24,0.38].forEach(fx2=>{
      const fxc=fx2*W;
      for(let fi=0;fi<14;fi++){
        const fp=(t*1.8+fi*24)%140;
        const ffw=12+fi*1.2-fp*0.06;
        if(ffw<0) continue;
        X.save(); X.globalAlpha=0.58-fi*0.035;
        const fire_h = fp*(0.6+fi*0.04);
        X.fillStyle=`hsl(${15+fi*6},90%,${30+fi*4}%)`;
        X.beginPath();
        X.arc(fxc+sin(t*0.12+fi+fx2*10)*(4+fi*0.6),gY-fire_h,ffw,0,TAU);
        X.fill(); X.restore();
      }
      // Asap hitam tebal
      if(t%3===0){
        spawn(fxc+rnd(-15,15),gY-40,{
          vx:rnd(-1.0,1.0),vy:rnd(-3.5,-1.2),decay:0.005,
          size:rnd(8,20),col:`rgba(${~~rnd(30,60)},${~~rnd(25,50)},${~~rnd(20,40)},0.45)`,
          glow:0,drag:0.990,wobble:0.018,wfreq:0.035
        });
        // CO₂ rilis merah
        spawn(fxc+rnd(-10,10),gY-30,{
          vx:rnd(-0.8,0.8),vy:rnd(-2.8,-1.0),decay:0.008,
          size:rnd(3,6),col:'rgba(255,80,20,0.68)',glow:3,drag:0.988
        });
      }
    });
    X.save(); X.globalAlpha=0.85;
    X.font='bold 10px "Courier New"'; X.fillStyle='rgba(255,80,20,0.95)'; X.textAlign='center';
    X.shadowColor='rgba(255,40,0,0.7)'; X.shadowBlur=10;
    X.fillText('⚠ DEFORESTASI', W*0.26, gY-H*0.26);
    X.font='9px "Courier New"'; X.fillStyle='rgba(255,140,50,0.8)'; X.shadowBlur=0;
    X.fillText('1.6 GtC/yr dilepas', W*0.26, gY-H*0.242);
    X.restore();
  }

  // ══ 7. MOLEKUL GAS RUMAH KACA melayang di atmosfer
  const molCount = ~~(20+hf*40);
  _ghMols.slice(0,molCount).forEach(m=>{
    m.t++; m.x+=m.vx; m.y+=m.vy;
    m.vx+=fbm(m.x*0.004+t*0.0005,m.y*0.004)*0.035;
    m.vy+=fbm(m.x*0.004,m.y*0.004+t*0.0005)*0.035;
    m.vx*=0.998; m.vy*=0.998;
    if(m.x<-30)m.x=W+20; if(m.x>W+30)m.x=-20;
    if(m.y<H*0.04)m.vy+=0.06; if(m.y>gY-12)m.vy-=0.09;
    const alpha=(0.28+0.15*sin(m.t*0.04))*Math.min(1,hf*1.5+0.4);
    // Lebih banyak molekul = lebih rapat = lebih nyata
    drawMolecule(m.x,m.y,m.type,m.size*0.75,alpha);
  });

  // ══ 8. ALIRAN FLUX antar reservoir (panah berpartikel)
  _s4fluxes.forEach((fl,fi)=>{
    const active = !fl.tog || S.tog[fl.tog];
    if(!active) return;
    const from = _s4reservoirs.find(r=>r.id===fl.from);
    const to   = _s4reservoirs.find(r=>r.id===fl.to);
    if(!from||!to) return;
    const x1=from.x*W, y1=from.y*H, x2=to.x*W, y2=to.y*H;
    // Garis flux
    X.save(); X.globalAlpha=0.22+0.06*sin(t*0.02+fi);
    X.strokeStyle=fl.col; X.lineWidth=1.2; X.setLineDash([5,8]);
    X.beginPath(); X.moveTo(x1,y1); X.lineTo(x2,y2); X.stroke();
    X.setLineDash([]); X.restore();
    // Partikel bergerak di jalur
    const sp=fl.from==='fossil'?0.009:fl.from==='veg'?0.006:0.005;
    const pf=((t*sp+fi*0.22)%1);
    const px=lerp(x1,x2,pf), py=lerp(y1,y2,pf);
    X.save(); X.globalAlpha=0.75;
    X.fillStyle=fl.col.replace('0.8','1').replace('0.85','1');
    X.shadowColor=fl.col; X.shadowBlur=8;
    X.beginPath(); X.arc(px,py,3.5,0,TAU); X.fill();
    X.shadowBlur=0; X.restore();
  });

  // ══ 9. CO₂ METER (kanan atas)
  _s4co2meter(t);

  // ══ 10. RESERVOIR BOXES
  _s4reservoirs.forEach(r=>{
    // Jangan tampilkan jika tidak relevan
    if(r.id==='veg'&&!S.tog.forest_on&&!S.tog.defor_on) return;
    if(r.id==='fossil'&&!S.tog.fossil_on) return;
    if(r.id==='ocean'&&!S.tog.ocean_c) return;
    if(r.id==='soil'&&!S.tog.forest_on) return;
    _s4reservoir(r.x*W,r.y*H, W*0.10, H*0.07, r.label, r.val(), 'GtC', r.col);
  });

  // ══ 11. DAMPAK VISUAL CO₂ TINGGI
  if(hf>0.5){
    // Heat shimmer di permukaan tanah
    X.save(); X.globalAlpha=0.08+0.04*sin(t*0.04);
    const shimG=X.createLinearGradient(0,gY-H*0.05,0,gY+H*0.02);
    shimG.addColorStop(0,'transparent');
    shimG.addColorStop(0.5,`rgba(255,${~~(120-hf*80)},0,0.25)`);
    shimG.addColorStop(1,'transparent');
    X.fillStyle=shimG; X.fillRect(0,gY-H*0.05,W*0.70,H*0.07);
    X.restore();
    // Partikel panas melayang di atas tanah
    if(t%8===0){
      spawn(rnd(0,W*0.65),gY-rnd(5,30),{
        vx:rnd(-0.5,0.5),vy:rnd(-1.5,-0.3),decay:0.015,
        size:rnd(2,5),col:`rgba(255,${~~(100-hf*60)},0,0.35)`,glow:3,drag:0.996
      });
    }
  }

  // ══ 12. LABEL DATA KARBON bawah
  X.save(); X.globalAlpha=0.40+0.05*sin(t*0.02);
  X.font='9px "Courier New"'; X.fillStyle='rgba(200,220,180,0.7)'; X.textAlign='center';
  X.fillText('Atmosfer 800GtC · Vegetasi 610GtC · Tanah 1580GtC · Laut 38,000GtC · B.Fosil 3,700GtC',cx,H*0.978);
  X.restore();
}


// ═══════════════════════════════════════════════════════════════
//  SCENE 5 — Energy Balance: cinematic radiation flow
//  S₀=1368 W/m², 342 W/m² avg, albedo, GHG back-radiation
// ═══════════════════════════════════════════════════════════════
function scene5(t){
  const bg=X.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#000308');bg.addColorStop(.6,'#020814');bg.addColorStop(1,'#050e20');
  X.fillStyle=bg;X.fillRect(0,0,W,H);
  drawStars(.45);

  const gY=H*.8,atmY=H*.48;

  // EARTH surface
  const gr=X.createLinearGradient(0,gY,0,H);
  gr.addColorStop(0,'#1b5e20');gr.addColorStop(1,'#0a1208');
  X.fillStyle=gr;X.fillRect(0,gY,W,H-gY);

  // ATMOSPHERE band
  X.save();
  const ag=X.createLinearGradient(0,atmY,0,gY);
  ag.addColorStop(0,'rgba(30,80,160,.07)');ag.addColorStop(.5,'rgba(50,130,220,.12)');ag.addColorStop(1,'rgba(30,70,140,.05)');
  X.fillStyle=ag;X.fillRect(0,atmY,W,gY-atmY);
  X.strokeStyle='rgba(74,176,232,.2)';X.lineWidth=1;
  X.beginPath();X.moveTo(0,atmY);X.lineTo(W,atmY);X.stroke();
  X.font='8px Space Mono';X.fillStyle='rgba(74,176,232,.38)';
  X.fillText('ATMOSFER + GAS RUMAH KACA',10,atmY+10);
  X.restore();

  // Sun (top left)
  drawSun(W*.1,H*.1,H*.065,S.sunPower,t);

  // ── INCOMING SOLAR ── animated beams
  if(S.tog.solar_in){
    const beams=[W*.18,W*.28,W*.38,W*.48,W*.58];
    beams.forEach((bx,i)=>{
      const ph=(t*.015+i*.22)%1;
      // Beam line
      X.save();X.globalAlpha=.55;
      X.strokeStyle='rgba(255,218,60,.65)';X.lineWidth=2;X.setLineDash([10,5]);
      X.beginPath();X.moveTo(bx,0);X.lineTo(bx,gY);X.stroke();X.setLineDash([]);
      // Photon dot travelling down
      const py=ph*gY;
      X.globalAlpha=.9-ph*.4;
      X.fillStyle='rgba(255,230,80,.95)';X.shadowColor='rgba(255,220,80,.8)';X.shadowBlur=12;
      X.beginPath();X.arc(bx,py,4.5,0,TAU);X.fill();X.shadowBlur=0;X.restore();
    });
    // Data box
    X.save();X.font='bold 11px Space Grotesk';X.fillStyle='rgba(255,218,60,.9)';
    X.fillText('☀ RADIASI MASUK',W*.2,H*.04);
    X.font='9px Space Mono';X.fillStyle='rgba(255,218,60,.55)';
    X.fillText('S₀ = 1368 W/m²  →  S₀/4 = 342 W/m²',W*.2,H*.055);X.restore();
  }

  // ── ALBEDO REFLECTION ── white beams going back up
  if(S.tog.albedo_e){
    for(let i=0;i<4;i++){
      const bx=W*.14+i*W*.1,ph=(t*.018+i*.25+.5)%1;
      X.save();X.globalAlpha=.45;
      X.strokeStyle='rgba(200,228,255,.5)';X.lineWidth=1.5;X.setLineDash([6,6]);
      X.beginPath();X.moveTo(bx,gY*.5);X.lineTo(bx*.5,0);X.stroke();X.setLineDash([]);
      const py=lerp(gY*.5,0,ph);const px=lerp(bx,bx*.5,ph);
      X.fillStyle='rgba(210,235,255,.85)';X.beginPath();X.arc(px,py,3.5,0,TAU);X.fill();
      X.restore();
    }
    X.save();X.font='300 10px Space Grotesk';X.fillStyle='rgba(200,228,255,.7)';
    X.fillText('↖ Dipantulkan (αₚ = 0.30)',W*.03,H*.3);
    X.font='9px Space Mono';X.fillStyle='rgba(200,228,255,.42)';
    X.fillText('107 W/m²  (77 awan + 30 permukaan)',W*.03,H*.315);X.restore();
  }

  // ── SURFACE IR EMISSION ── red upward beams
  if(S.tog.surface_r){
    for(let i=0;i<5;i++){
      const bx=W*.52+i*W*.09,ph=(t*.016+i*.2)%1;
      X.save();X.globalAlpha=.6;
      X.strokeStyle='rgba(220,60,30,.55)';X.lineWidth=2;X.setLineDash([5,5]);
      X.beginPath();X.moveTo(bx,gY);X.lineTo(bx,atmY);X.stroke();X.setLineDash([]);
      const py=lerp(gY,atmY,ph);
      X.fillStyle='rgba(220,70,40,.9)';X.shadowColor='rgba(220,60,30,.7)';X.shadowBlur=10;
      X.beginPath();X.arc(bx,py,4,0,TAU);X.fill();X.shadowBlur=0;X.restore();
    }
    X.save();X.font='bold 10px Space Grotesk';X.fillStyle='rgba(220,70,40,.88)';X.textAlign='center';
    X.fillText('↑ EMISI IR PERMUKAAN',W*.74,gY-10);
    X.font='9px Space Mono';X.fillStyle='rgba(220,70,40,.5)';
    X.fillText('390 W/m²',W*.74,gY-22);X.restore();
  }

  // ── GHG BACK RADIATION ── orange beams back down
  if(S.tog.ghg_on){
    // Molecules in atmosphere
    for(let i=0;i<6;i++){
      const mx=W*.5+cos(t*.008+i*1.05)*W*.2,my=lerp(atmY+20,gY-20,.3+.4*sin(i*.9));
      drawMolecule(mx,my,'CO2',7,.6+.25*sin(t*.04+i));
    }
    for(let i=0;i<3;i++){
      const bx=W*.55+i*W*.12,ph=(t*.014+i*.3+.3)%1;
      X.save();X.globalAlpha=.65;
      X.strokeStyle='rgba(255,110,40,.5)';X.lineWidth=2.2;X.setLineDash([5,4]);
      X.beginPath();X.moveTo(bx,atmY+20);X.lineTo(bx,gY);X.stroke();X.setLineDash([]);
      const py=lerp(atmY+20,gY,ph);
      X.fillStyle='rgba(255,120,50,.9)';X.shadowColor='rgba(255,100,40,.7)';X.shadowBlur=10;
      X.beginPath();X.arc(bx,py,4,0,TAU);X.fill();X.shadowBlur=0;X.restore();
    }
    X.save();X.font='bold 10px Space Grotesk';X.fillStyle='rgba(255,120,50,.88)';X.textAlign='center';
    X.fillText('↓ BACK RADIATION (GRK)',W*.72,atmY-10);
    X.font='9px Space Mono';X.fillStyle='rgba(255,120,50,.52)';
    X.fillText('324 W/m²',W*.72,atmY-22);X.restore();
  }

  // OLR arrow going to space
  X.save();X.globalAlpha=.42;
  const op=(t*.01)%1;
  X.strokeStyle='rgba(160,80,220,.5)';X.lineWidth=2;X.setLineDash([6,5]);
  X.beginPath();X.moveTo(W*.82,atmY);X.lineTo(W*.82,H*.02);X.stroke();X.setLineDash([]);
  X.fillStyle='rgba(170,90,230,.85)';X.beginPath();X.arc(W*.82,lerp(atmY,H*.02,op),4,0,TAU);X.fill();
  X.font='9px Space Mono';X.fillStyle='rgba(160,80,220,.65)';X.textAlign='center';
  X.fillText('OLR: 235 W/m² ↑',W*.82,atmY-12);X.restore();

  // ── ENERGY BALANCE SUMMARY ── elegant data panel
  X.save();
  const bx=W*.02,by=H*.1,bw=W*.3,bh=H*.42;
  X.fillStyle='rgba(4,8,20,.88)';X.strokeStyle='rgba(255,255,255,.06)';X.lineWidth=1;
  X.fillRect(bx,by,bw,bh);X.strokeRect(bx,by,bw,bh);
  // Header
  X.font='300 13px Cormorant Garamond';X.fillStyle='rgba(232,240,252,.75)';X.fillStyle='rgba(74,176,232,.85)';
  X.fillText('Keseimbangan Energi Bumi',bx+12,by+18);
  X.strokeStyle='rgba(74,176,232,.15)';X.lineWidth=.5;
  X.beginPath();X.moveTo(bx+10,by+24);X.lineTo(bx+bw-10,by+24);X.stroke();
  const rows=[
    ['S₀ (Konstanta Matahari)', '1368 W/m²','rgba(255,218,60,.8)'],
    ['Masukan rata-rata (S₀/4)', '342 W/m²','rgba(255,218,60,.65)'],
    ['Dipantulkan (albedo 30%)', '107 W/m²','rgba(200,228,255,.7)'],
    ['Diserap atmosfer',         '67 W/m²', 'rgba(74,176,232,.7)'],
    ['Diserap permukaan',        '168 W/m²','rgba(92,186,116,.7)'],
    ['Emisi IR permukaan',       '390 W/m²','rgba(220,70,40,.75)'],
    ['Back Radiation GRK',       '324 W/m²','rgba(255,120,50,.75)'],
    ['Efek Rumah Kaca (ΔA)',     '155 W/m²','rgba(255,150,80,.7)'],
    ['T_e (tanpa atmosfer)',      '255 K (−18°C)','rgba(160,200,240,.6)'],
    ['T_s (dengan GRK)',          '288 K (+15°C)','rgba(92,186,116,.8)'],
  ];
  rows.forEach(([lbl,val,col],i)=>{
    const ry=by+36+i*24;
    X.font='300 9px Space Grotesk';X.fillStyle='rgba(232,240,252,.4)';X.textAlign='left';
    X.fillText(lbl,bx+12,ry);
    X.font='500 9px Space Mono';X.fillStyle=col;X.textAlign='right';
    X.fillText(val,bx+bw-10,ry);
  });
  // Animated bar: greenhouse warming
  const barW=(bw-24)*(155/390);
  X.fillStyle='rgba(255,120,50,.18)';X.fillRect(bx+12,by+bh-28,bw-24,12);
  X.fillStyle='rgba(255,120,50,.55)';X.fillRect(bx+12,by+bh-28,barW*(sin(t*.02)*.05+.95),12);
  X.font='8px Space Mono';X.fillStyle='rgba(255,255,255,.3)';X.textAlign='left';
  X.fillText('Efek GRK = 390−235 = 155 W/m²',bx+12,by+bh-5);
  X.restore();

  // Stefan-Boltzmann equation floating
  X.save();X.globalAlpha=.38+.08*sin(t*.025);
  X.font='italic 14px Cormorant Garamond';X.fillStyle='rgba(255,218,60,.6)';
  X.textAlign='center';
  X.fillText('πR²(1−αₚ)S₀ = 4πR²σTe⁴  →  ΔT_GRK = +33°C',cx,H*.91);
  X.font='9px Space Mono';X.fillStyle='rgba(255,255,255,.22)';
  X.fillText('σ = 5.67×10⁻⁸ W m⁻² K⁻⁴  ·  ΔQ₍₂×CO₂₎ ≈ 4 W/m²  ·  λ = 0.50 °C per W/m²',cx,H*.94);
  X.restore();
}


// ═══════════════════════════════════════════════════════════════
//  KNOWLEDGE BASE  (info card content)
// ═══════════════════════════════════════════════════════════════
const KB={
  atmo_comp: {solo:'<b>Atmosfer</b> — selimut gas tipis Bumi. Komposisi: N₂ 78%, O₂ 21%, Ar 0.93%, CO₂ 0.04%. Lapisan: Troposfer (0–12 km, lapse rate 6.5 K/km), Stratosfer (12–50 km, ozon), Mesosfer, Termosfer. Transfer panas: radiasi, konduksi, konveksi, laten. <span class="src">Understanding Earth 6th Ed.; Slide 7–11</span>'},
  hydro_comp:{solo:'<b>Hidrosfer</b> — seluruh air Bumi. Samudra: 1,335,040×10³ km³ (97% air global). Sirkulasi: permukaan (digerakkan angin) + termohalin (density-driven). Pertukaran panas laut-atmosfer mengontrol variabilitas iklim. <span class="src">Slide 12–15</span>'},
  cryo_comp: {solo:'<b>Kriosfer</b> — semua air beku. Es Arktik: 6–14 ×10⁶ km² (musiman). Antarktika: 2–15 ×10⁶ km². Gletser+ice sheets menyimpan 26,350×10³ km³ air. Albedo es (0.80–0.88) vs laut (0.06) — perbedaan ini menggerakkan ice-albedo feedback. <span class="src">Slide 16–19; NSIDC</span>'},
  bio_comp:  {solo:'<b>Biosfer</b> — semua organisme hidup. GPP darat: 120 GtC/yr. Respirasi: 119.6 GtC/yr. Net land sink: 2.6 GtC/yr. Laut: 70.6 GtC/yr flux masuk, 70 GtC/yr keluar — net sink 0.6–2.2 GtC/yr. Vegetasi+tanah: 2300 GtC cadangan. <span class="src">Slide 20–28; IPCC 2007</span>'},
  litho_comp:{solo:'<b>Litosfer</b> — kerak dan mantel atas. Interaksi iklim: vulkanisme (emisi CO₂, SO₂, aerosol), pelapukan batuan (weathering = CO₂ sink jangka panjang), sedimentasi karbon organik. Aktivitas tektonik mengontrol iklim skala jutaan tahun. <span class="src">Slide 4–6; Understanding Earth</span>'},
  layers_on: {solo:'<b>Lapisan Atmosfer (Slide 9):</b> Troposfer: Γ = 6.5 K/km — DALR: 9.8 K/km, SALR: ~4–5 K/km. Tropopause: 216 K. Stratosfer: suhu naik (serapan UV ozon). Stratopause: 270 K. Mesosfer: suhu turun. Mesopause: 185 K (titik terdingin). Termosfer: suhu naik >2000 K (ionisasi UV). <span class="src">Slide 7–10</span>'},
  hadley_on: {solo:'<b>Sirkulasi Global (Slide 11):</b> Sel Hadley (0°–30°): ITCZ → ascending → diverge → Hadley descent at 30°. Sel Ferrel (30°–60°): sel tidak langsung. Sel Polar (60°–90°). Jet stream tropopause: terbentuk di batas antarsel. Angin permukaan: Pasat, Barat, Timur Kutub. <span class="src">Slide 11; Understanding Earth Fig. 15</span>'},
  lapse_on:  {solo:'<b>Lapse Rate & Profil Suhu:</b> Γ = −∂T/∂z = 6.5 K/km (Environmental Lapse Rate rata-rata global). DALR = 9.8 K/km (udara kering, adiabatik). SALR = 4–5 K/km (udara jenuh). Inversasi suhu terjadi di atas troposfer. Stabilitas atmosfer tergantung pada perbandingan ELR vs DALR/SALR. <span class="src">Slide 9; Understanding Earth</span>'},
  comp_on:   {solo:'<b>Komposisi Udara (Slide 8):</b> Gas tetap: N₂ (78.1%), O₂ (20.9%), Ar (0.93%), CO₂ (0.038%), Ne, He, Kr. Gas variabel: H₂O (0–4%), O₃ (0.00006%), CH₄, N₂O. CO₂ meski kecil (0.04%) berperan besar dalam efek rumah kaca karena sifat serapan inframerah-nya. <span class="src">Slide 8</span>'},
  evap_on:   {solo:'<b>Siklus Hidrologi (Slide 13):</b> Evaporasi laut: 413×10³ km³/yr. Evapotranspirasi darat: 73×10³ km³/yr. Presipitasi laut: 373×10³ km³/yr. Presipitasi darat: 113×10³ km³/yr. Transpor uap laut→darat: 40×10³ km³/yr. Aliran sungai ke laut: 40×10³ km³/yr. <span class="src">Slide 13</span>'},
  precip_on: {solo:'<b>Distribusi Presipitasi:</b> Curah hujan tinggi di ITCZ (0°, konvergensi Hadley), rendah di 30° LU/LS (turunnya Hadley → gurun subtropik), sedang di 50°–60°. Iklim Indonesia sebagai zona ITCZ menerima ~2000–4000 mm/tahun. Siklus ENSO mengubah distribusi ini. <span class="src">Slide 13; Understanding Earth</span>'},
  thermo_on: {solo:'<b>Sirkulasi Termohalin / Ocean Conveyor Belt (Slide 15):</b> Didorong perbedaan densitas (ρ = f(T,S)). Gulf Stream: arus hangat permukaan ke utara. North Atlantic Deep Water (NADW): tenggelam di Atlantik Utara. Waktu siklus: ~1000 tahun. Melemahnya THC bisa membekukan Eropa Barat. <span class="src">Slide 15; Understanding Earth Fig. 15.3b</span>'},
  surface_on:{solo:'<b>Arus Permukaan (Slide 14):</b> Digerakkan angin (Ekman transport). Membentuk 5 gyre besar: N. Pacific, S. Pacific, N. Atlantic, S. Atlantic, Indian Ocean. Arus hangat (ke kutub) vs arus dingin (ke ekuator). Arus Kuroshio, Gulf Stream = pembawa panas ke lintang tinggi. <span class="src">Slide 14</span>'},
  arctic_on: {solo:'<b>Es Laut Arktik (Slide 17):</b> Luas maks: 14.0×10⁶ km² (Maret). Luas min: 6.0×10⁶ km² (September). Volume maks: 0.05×10⁶ km³. Tren penurunan ~13% per dekade (1979–kini). Kehilangan es Arktik memperparah pemanasan global via ice-albedo feedback. <span class="src">Slide 17; NSIDC</span>'},
  antarc_on: {solo:'<b>Es Laut Antarktika (Slide 17):</b> Luas maks: 15.0×10⁶ km² (September). Luas min: 2.0×10⁶ km² (Februari). Volume min: 0.002×10⁶ km³. Antarktika menyimpan ~70% air tawar Bumi. Sheet ice tebal rata-rata 2.3 km. Pencairan total akan menaikkan permukaan laut ~70 m. <span class="src">Slide 17–18</span>'},
  albedo_on: {solo:'<b>Ice-Albedo Feedback (Slide 45–46):</b> ↑ Suhu → Es mencair → Albedo turun (0.85→0.06) → Lebih banyak energi terserap → Suhu naik lagi. Umpan balik POSITIF (memperkuat gangguan awal). Δλ⁻¹ₑᵢ = −0.1 to −0.9 W m⁻² K⁻¹. Ini mengapa kutub menghangat 3× lebih cepat dari rata-rata global. <span class="src">Slide 45–46; NRC 1979</span>'},
  melt_sim:  {solo:'<b>Dampak Pencairan Es:</b> Setiap 1°C kenaikan global → kehilangan ~3% es Arktik. Melt-water input → melemahkan termohalin (dilusi salinitas). Greenland ice sheet menyimpan 7.2 m setara kenaikan muka laut jika mencair total. Pencairan permafrost melepas CH₄ (GRK 25× lebih kuat dari CO₂). <span class="src">IPCC AR4; Slide 19</span>'},
  forest_on: {solo:'<b>Biosfer Darat (Slide 25–27):</b> GPP = 120 GtC/yr. Respirasi ekosistem = 119.6 GtC/yr. Net Ecosystem Production ≈ 0.4 GtC/yr (sink). Cadangan: Vegetasi 610 GtC, Tanah 1580 GtC, Serasah 60 GtC (total ~2300 GtC). Hutan tropis = 40% dari semua NPP darat. <span class="src">Slide 25–27</span>'},
  fossil_on: {solo:'<b>Emisi Antropogenik (Slide 27–28):</b> Total: 8.0 GtC/yr. Bahan bakar fosil: 6.3 GtC/yr. Deforestasi+pertanian: 1.6 GtC/yr. Produksi semen: 0.1 GtC/yr. Pertumbuhan CO₂ atmosfer: +3.2 GtC/yr (= emisi − serap laut − serap biosfer). Ini menyebabkan CO₂ naik 280→370 ppm (1750–2000). <span class="src">Slide 27–28; IPCC 2007</span>'},
  ocean_c:   {solo:'<b>Karbon Laut (Slide 25):</b> Fluks masuk: 70.6 GtC/yr (dissolved CO₂). Fluks keluar: 70 GtC/yr. Net sink: ~2.2 GtC/yr. Cadangan: Permukaan 900+18 GtC; Dalam 37,100+100 GtC; Sedimen 150 GtC; Biota 3 GtC. Laut menjadi lebih asam (pH turun 0.1 unit sejak industri). <span class="src">Slide 25; IPCC 2007</span>'},
  defor_on:  {solo:'<b>Deforestasi (Slide 27–28):</b> Alih guna lahan melepas 1.6 GtC/yr — sumber emisi terbesar ke-2 setelah bahan bakar fosil. Hutan tropis menyimpan 200–300 GtC di atas tanah; kehilangan 1 ha = 100–200 ton karbon dilepas. Deforestasi juga mengurangi evapotranspirasi, mengubah pola hujan regional. <span class="src">Slide 27–28</span>'},
  solar_in:  {solo:'<b>Radiasi Matahari Masuk (Slide 31–32, 42):</b> S₀ = 1368 W/m² (konstanta matahari). Rata-rata masukan Bumi = S₀/4 = 342 W/m² (faktor 1/4 karena Bumi bulat). Diserap atmosfer: 67 W/m². Diserap permukaan: 168 W/m². Dipantulkan: 107 W/m². <span class="src">Slide 31–32; 42; Understanding Earth Fig. 15.6</span>'},
  albedo_e:  {solo:'<b>Albedo Bumi (Slide 32, 45):</b> αₚ = 0.30. Total dipantulkan: 107 W/m² (77 dari awan+aerosol+atmosfer, 30 dari permukaan). Nilai albedo: Es 0.80–0.88, Pasir 0.35–0.45, Hutan 0.10–0.18, Laut 0.03–0.10. Perubahan albedo 1% = perubahan forcing 2.3 W/m². <span class="src">Slide 32; 45; Understanding Earth</span>'},
  ghg_on:    {solo:'<b>Gas Rumah Kaca & Back Radiation (Slide 42–44):</b> GRK (H₂O, CO₂, CH₄, N₂O, O₃) menyerap & memancarkan IR. Back radiation ke permukaan: <em>324 W/m²</em>. Efek GRK = 390 − 235 = <em>155 W/m²</em>. Tanpa GRK: T_e = 255 K (−18°C). Dengan GRK: T_s = 288 K (+15°C). Delta: 33°C berkat GRK alami. <span class="src">Slide 42–50</span>'},
  surface_r: {solo:'<b>Emisi IR Permukaan (Slide 34–36, 42):</b> Bumi ≈ black body: F = σT⁴. σ = 5.67×10⁻⁸ W m⁻² K⁻⁴. Emisi permukaan: 390 W/m². Window IR (8–12 μm): 40 W/m² langsung ke luar angkasa. Emisi atmosfer ke atas: 195 W/m². OLR total ke luar: 235 W/m² (= 40 + 195). <span class="src">Slide 34–36; 42</span>'},
};

function getInfo(lastId){
  const sc=SCENES[scene];
  const activeIds=sc.btns.filter(b=>b.toggle&&S.tog[b.id]).map(b=>b.id);
  if(lastId&&!activeIds.includes(lastId)){const k=KB[lastId];if(k)return k.solo;}
  if(activeIds.length===0)return sc.info;
  const k=KB[activeIds[0]];return k?k.solo:sc.info;
}
function updateInfo(id){document.getElementById('info-card').innerHTML=getInfo(id);}

// ═══════════════════════════════════════════════════════════════
//  SCENE DEFINITIONS
// ═══════════════════════════════════════════════════════════════
const SCENES=[
  {name:'Komponen Sistem Iklim',        info:'<b>Sistem Iklim Bumi</b> terdiri dari 5 komponen utama yang saling berinteraksi: <em>Atmosfer, Hidrosfer, Kriosfer, Biosfer,</em> dan Litosfer. Setiap komponen bertukar energi, materi, dan momentum. Klik komponen untuk detail. <span class="src">IPCC 2007; Understanding Earth, 6th Ed.</span>',
    btns:[{id:'atmo_comp',label:'Atmosfer',ico:'',rgb:'74,176,232',toggle:true},{id:'hydro_comp',label:'Hidrosfer',ico:'',rgb:'25,118,210',toggle:true},{id:'cryo_comp',label:'Kriosfer',ico:'',rgb:'168,216,240',toggle:true},{id:'bio_comp',label:'Biosfer',ico:'',rgb:'92,186,116',toggle:true},{id:'litho_comp',label:'Litosfer',ico:'',rgb:'201,168,76',toggle:true}],fn:scene0},
  {name:'Atmosfer',  info:'<b>Atmosfer</b>: N₂ 78%, O₂ 21%, Ar 0.93%, CO₂ 0.04%. Troposfer: lapse rate <em>6.5 K/km</em>. Sirkulasi global: Sel Hadley, Ferrel, dan Polar. Jet stream di tropopause. Aktifkan layer untuk melihat detail. <span class="src">Slide 7–11; Understanding Earth</span>',
    btns:[{id:'layers_on',label:'Lapisan Atmosfer',ico:'',rgb:'74,176,232',toggle:true},{id:'hadley_on',label:'Sel Sirkulasi',ico:'',rgb:'100,181,246',toggle:true},{id:'lapse_on',label:'Profil Suhu',ico:'',rgb:'255,183,77',toggle:true},{id:'comp_on',label:'Komposisi Udara',ico:'',rgb:'129,199,132',toggle:true}],fn:scene1},
  {name:'Hidrosfer',        info:'<b>Hidrosfer</b>: Evaporasi laut <em>413×10³ km³/yr</em>. Presipitasi laut 373×10³ km³/yr. Transpor uap ke darat 40×10³ km³/yr. Sirkulasi termohalin memindahkan panas global. <span class="src">Slide 12–15; Understanding Earth</span>',
    btns:[{id:'evap_on',label:'Evaporasi & Vapor',ico:'',rgb:'74,176,232',toggle:true},{id:'precip_on',label:'Presipitasi & Hujan',ico:'',rgb:'100,181,246',toggle:true},{id:'thermo_on',label:'Arus Termohalin',ico:'',rgb:'25,118,210',toggle:true},{id:'surface_on',label:'Arus Permukaan',ico:'',rgb:'29,233,182',toggle:true}],fn:scene2},
  {name:'Kriosfer',          info:'<b>Kriosfer</b>: Es Arktik maks <em>14.0×10⁶ km²</em> (Maret), min 6.0×10⁶ km² (September). Es Antarktika maks 15.0×10⁶ km². Ice-albedo feedback memperkuat perubahan iklim. <span class="src">Slide 16–19; NSIDC</span>',
    btns:[{id:'arctic_on',label:'Es Laut Arktik',ico:'',rgb:'168,216,240',toggle:true},{id:'antarc_on',label:'Es Antarktika',ico:'',rgb:'144,202,249',toggle:true},{id:'albedo_on',label:'Ice-Albedo Feedback',ico:'',rgb:'255,241,118',toggle:true},{id:'melt_sim',label:'Simulasi Pencairan',ico:'',rgb:'255,138,101',toggle:false}],
    slider:{label:'Tutupan Es',key:'iceLevel',min:0,max:1,step:.05,unit:''},fn:scene3},
  {name:'Biosfer',       info:'<b>Siklus Karbon:</b> CO₂ pra-industri 280 ppm → 370 ppm (2000). Emisi manusia: <em>8.0 GtC/yr</em> (fosil 6.3 + lahan 1.6 + semen 0.1). Biosfer+laut serap 4.8 GtC/yr → net +3.2 GtC/yr ke atmosfer. <span class="src">Slide 23–29; IPCC 2007</span>',
    btns:[{id:'forest_on',label:'Hutan & Biosfer',ico:'',rgb:'92,186,116',toggle:true},{id:'fossil_on',label:'B. Fosil 6.3 GtC/yr',ico:'',rgb:'232,98,42',toggle:true},{id:'ocean_c',label:'Serap Laut 2.2 GtC',ico:'',rgb:'25,118,210',toggle:true},{id:'defor_on',label:'Deforestasi 1.6 GtC',ico:'',rgb:'220,50,50',toggle:true}],
    slider:{label:'Konsentrasi CO₂',key:'co2',min:280,max:800,step:10,unit:'ppm'},fn:scene4},
  {name:'Keseimbangan Energi',           info:'<b>Energi:</b> S₀ = <em>1368 W/m²</em>. Rata-rata masukan = 342 W/m². Albedo αₚ = 0.30. T_e tanpa atmosfer = 255 K (−18°C). Efek GRK = 390 − 235 = <em>155 W/m²</em>. T_s = 288 K (+15°C). <span class="src">Slide 30–53; Stefan-Boltzmann Law</span>',
    btns:[{id:'solar_in',label:'Radiasi Masuk 342',ico:'',rgb:'255,213,79',toggle:true},{id:'albedo_e',label:'Refleksi Albedo 107',ico:'',rgb:'200,228,255',toggle:true},{id:'ghg_on',label:'Back Radiation 324',ico:'',rgb:'255,120,50',toggle:true},{id:'surface_r',label:'Emisi Permukaan 390',ico:'',rgb:'220,60,40',toggle:true}],fn:scene5},
];

// ═══════════════════════════════════════════════════════════════
//  UI BUILDER
// ═══════════════════════════════════════════════════════════════
function buildControls(){
  const sc=SCENES[scene],ctrl=document.getElementById('controls');
  ctrl.innerHTML='';
  const bg=document.createElement('div');
  bg.className='ctrl-group';
  bg.innerHTML='<div class="ctrl-label">Kontrol Interaktif</div><div class="btn-grid"></div>';
  const grid=bg.querySelector('.btn-grid');
  sc.btns.forEach(b=>{
    const btn=document.createElement('button');
    btn.className='action-btn'+(S.tog[b.id]?' on':'');
    btn.style.setProperty('--rgb',b.rgb);
    btn.innerHTML=`<span class="ico">${b.ico}</span>${b.label}`;
    btn.onclick=(e)=>{
      const r=document.createElement('span');r.className='ripple';
      const rect=btn.getBoundingClientRect();
      r.style.cssText=`width:${btn.offsetWidth*2}px;height:${btn.offsetWidth*2}px;left:${e.clientX-rect.left-btn.offsetWidth}px;top:${e.clientY-rect.top-btn.offsetWidth}px`;
      btn.appendChild(r);setTimeout(()=>r.remove(),500);
      if(b.toggle){S.tog[b.id]=!S.tog[b.id];btn.classList.toggle('on',S.tog[b.id]);}
      else{S.tog[b.id]=true;btn.classList.add('on');setTimeout(()=>{S.tog[b.id]=false;btn.classList.remove('on');updateInfo();},2500);}
      updateInfo(b.id);
    };
    btn.onmouseenter=()=>{const tip=document.getElementById('tip');tip.style.display='block';tip.textContent=b.label;};
    btn.onmouseleave=()=>document.getElementById('tip').style.display='none';
    grid.appendChild(btn);
  });
  ctrl.appendChild(bg);
  if(sc.slider){
    const sl=sc.slider,sg=document.createElement('div');
    sg.className='ctrl-group';
    const dv=sl.key==='co2'?~~S[sl.key]:S[sl.key];
    sg.innerHTML=`<div class="ctrl-label">${sl.label}</div><div class="s-row"><div class="s-top">${sl.label}<span id="slv">${dv}${sl.unit}</span></div><input type="range" min="${sl.min}" max="${sl.max}" step="${sl.step}" value="${S[sl.key]}" id="main-sl"></div>`;
    ctrl.appendChild(sg);
    sg.querySelector('#main-sl').addEventListener('input',e=>{
      S[sl.key]=parseFloat(e.target.value);
      const dv2=sl.key==='co2'?~~S[sl.key]:S[sl.key];
      sg.querySelector('#slv').textContent=dv2+sl.unit;
    });
  }
}

function go(idx){
  if(idx===scene)return;
  scene=idx;transitioning=true;transAlpha=1;
  Object.keys(S.tog).forEach(k=>S.tog[k]=false);
  // Update active pill di nav-panel
  document.querySelectorAll('#nav-panel .nav-pill').forEach((p,i)=>p.classList.toggle('active',i===idx));
  document.getElementById('scene-title').textContent=SCENES[idx].name;
  setTimeout(updateInfo,60);buildControls();
  POOL.forEach(p=>{p.alive=false;});
}

// ── NAV DRAWER toggle ──
function toggleNav(){
  document.getElementById('nav-drawer').classList.toggle('open');
}
function closeNav(){
  document.getElementById('nav-drawer').classList.remove('open');
}

// ═══════════════════════════════════════════════════════════════
//  MOBILE IMPROVEMENTS
// ═══════════════════════════════════════════════════════════════
(function(){
  const drawer   = document.getElementById('ctrl-drawer');
  const infoCard = document.getElementById('info-card');
  const statsEl  = document.getElementById('stats');
  const SCENES_COUNT = 6;

  // 1. Sembunyikan info-card & stats saat drawer terbuka di mobile
  function onDrawerChange(){
    const isMobile = window.innerWidth <= 768;
    if(!isMobile) return;
    const isOpen = drawer.classList.contains('open');
    if(infoCard) infoCard.style.opacity = isOpen ? '0' : '';
    if(statsEl)  statsEl.style.opacity  = isOpen ? '0' : '';
  }
  new MutationObserver(onDrawerChange)
    .observe(drawer, {attributes:true, attributeFilter:['class']});

  // 2. Swipe horizontal → ganti scene
  let sx0=0, sy0=0;
  document.addEventListener('touchstart', e=>{
    if(e.target.closest('#ctrl-drawer,#nav-drawer,#intro')) return;
    sx0 = e.touches[0].clientX;
    sy0 = e.touches[0].clientY;
  }, {passive:true});
  document.addEventListener('touchend', e=>{
    if(e.target.closest('#ctrl-drawer,#nav-drawer,#intro')) return;
    const dx = e.changedTouches[0].clientX - sx0;
    const dy = e.changedTouches[0].clientY - sy0;
    if(Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.8){
      if(dx < 0 && scene < SCENES_COUNT-1) go(scene+1);
      if(dx > 0 && scene > 0)              go(scene-1);
    }
  }, {passive:true});

  // 3. Tutup nav saat tap canvas
  const cv = document.getElementById('c');
  cv.addEventListener('touchend', ()=>{ closeNav(); }, {passive:true});

  // 4. CSS --vh fix (address bar mobile)
  function setVH(){
    document.documentElement.style.setProperty('--vh', window.innerHeight*0.01+'px');
  }
  setVH();
  window.addEventListener('resize', setVH);

  // 5. Cegah double-tap zoom di canvas
  let lastTap=0;
  cv.addEventListener('touchend', e=>{
    const now=Date.now();
    if(now-lastTap<320) e.preventDefault();
    lastTap=now;
  }, {passive:false});

  // 6. Drawer body: hentikan touch propagation biar tombol bisa diklik
  const ctrlBody = document.getElementById('ctrl-body');
  if(ctrlBody){
    ctrlBody.addEventListener('touchstart', e=>e.stopPropagation(), {passive:true});
    ctrlBody.addEventListener('touchmove',  e=>e.stopPropagation(), {passive:true});
  }
})();

// ═══════════════════════════════════════════════════════════════
//  MAIN LOOP
// ═══════════════════════════════════════════════════════════════
function loop(){
  T++;
  SCENES[scene].fn(T);
  POOL.forEach(p=>{if(p.alive){p.step();p.draw();}});
  if(transitioning){
    transAlpha=Math.max(0,transAlpha-.042);
    if(transAlpha<=0)transitioning=false;
    X.save();X.globalAlpha=transAlpha;X.fillStyle='#000';X.fillRect(0,0,W,H);X.restore();
  }
  if(T%30===0)updateStats();
  requestAnimationFrame(loop);
}

// ═══════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════
buildControls();
document.getElementById('scene-title').textContent=SCENES[0].name;
updateInfo();loop();
document.addEventListener('mousemove',e=>{
  const tip=document.getElementById('tip');
  if(tip.style.display==='block'){tip.style.left=(e.clientX+14)+'px';tip.style.top=(e.clientY-32)+'px';}
});

// ═══════════════════════════════════════════════════════════════
//  BOTTOM DRAWER — toggle + drag
// ═══════════════════════════════════════════════════════════════
function toggleDrawer(force){
  const d=document.getElementById('ctrl-drawer');
  const open = force!==undefined ? force : !d.classList.contains('open');
  d.classList.toggle('open', open);
}

// Drag-to-open drawer (swipe up on tab)
(function(){
  const drawer=document.getElementById('ctrl-drawer');
  const tab=document.getElementById('ctrl-tab');
  let startY=0, startOpen=false, dragging=false;

  function onDown(e){
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startOpen = drawer.classList.contains('open');
    dragging = true;
    drawer.style.transition='none';
  }
  function onMove(e){
    if(!dragging) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const dy = startY - y; // positive = swipe up
    if(Math.abs(dy)<4) return;
    e.preventDefault();
    // If dragging up → open, down → close
    if(dy > 30 && !startOpen) toggleDrawer(true);
    if(dy < -30 && startOpen) toggleDrawer(false);
  }
  function onUp(){
    dragging=false;
    drawer.style.transition='';
  }
  tab.addEventListener('touchstart', onDown, {passive:true});
  tab.addEventListener('touchmove',  onMove, {passive:false});
  tab.addEventListener('touchend',   onUp);
})();

// ═══════════════════════════════════════════════════════════════
//  INTRO SCREEN — bumi HD + drag ke atas untuk dismiss
// ═══════════════════════════════════════════════════════════════
(function(){
  const intro  = document.getElementById('intro');
  const ic     = document.getElementById('intro-canvas');
  let dismissed = false;

  // ── Resize intro canvas
  function resizeIC(){
    ic.width  = ic.offsetWidth  * devicePixelRatio;
    ic.height = ic.offsetHeight * devicePixelRatio;
  }
  resizeIC();
  window.addEventListener('resize', resizeIC);

  // ── Animasi bumi di intro canvas (high-quality sphere + clouds + atmosphere)
  const IX = ic.getContext('2d');
  let iT   = 0;
  const TAU2 = Math.PI*2;

  function drawIntroBg(){
    const iw=ic.width, ih=ic.height;
    IX.clearRect(0,0,iw,ih);

    // Deep space background
    const bg=IX.createRadialGradient(iw/2,ih/2,0,iw/2,ih/2,Math.max(iw,ih)*0.7);
    bg.addColorStop(0,'#020c1e');
    bg.addColorStop(0.5,'#010810');
    bg.addColorStop(1,'#000408');
    IX.fillStyle=bg; IX.fillRect(0,0,iw,ih);

    // Stars
    const rng=(s)=>{let x=Math.sin(s*7919)*43758.5453123;return x-Math.floor(x);};
    IX.save();
    for(let i=0;i<220;i++){
      const sx=rng(i*1.1)*iw, sy=rng(i*2.3)*ih;
      const ss=rng(i*3.7)*1.6+0.3;
      const sa=0.3+rng(i*5.1)*0.65+0.2*Math.sin(iT*0.018+i);
      IX.globalAlpha=sa;
      IX.fillStyle='#fff';
      IX.beginPath(); IX.arc(sx,sy,ss,0,TAU2); IX.fill();
    }
    IX.restore();
  }

  function drawIntroEarth(){
    const iw=ic.width, ih=ic.height;
    const er = Math.min(iw,ih) * 0.338;
    const ex = iw/2, ey = ih/2 - ih*0.04;
    const rot = iT*0.004;
    const dpr = devicePixelRatio||1;

    // ── Outer glow (corona atmosfer)
    const cg=IX.createRadialGradient(ex,ey,er*0.88,ex,ey,er*1.55);
    cg.addColorStop(0,'rgba(50,140,255,0.16)');
    cg.addColorStop(0.4,'rgba(30,100,220,0.08)');
    cg.addColorStop(0.7,'rgba(10,50,160,0.04)');
    cg.addColorStop(1,'transparent');
    IX.beginPath(); IX.arc(ex,ey,er*1.55,0,TAU2);
    IX.fillStyle=cg; IX.fill();

    // ── Atmosphere rim (thin blue ring)
    const atg=IX.createRadialGradient(ex,ey,er*0.96,ex,ey,er*1.08);
    atg.addColorStop(0,'rgba(80,160,255,0.22)');
    atg.addColorStop(0.6,'rgba(60,120,240,0.10)');
    atg.addColorStop(1,'transparent');
    IX.beginPath(); IX.arc(ex,ey,er*1.08,0,TAU2);
    IX.fillStyle=atg; IX.fill();

    // ── Save clip to sphere
    IX.save();
    IX.beginPath(); IX.arc(ex,ey,er,0,TAU2); IX.clip();

    // Base ocean
    const og=IX.createRadialGradient(ex-er*0.28,ey-er*0.22,er*0.1,ex,ey,er);
    og.addColorStop(0,'#1a6fc8');
    og.addColorStop(0.35,'#0e50a0');
    og.addColorStop(0.7,'#083880');
    og.addColorStop(1,'#042460');
    IX.fillStyle=og; IX.fillRect(ex-er,ey-er,er*2,er*2);

    // Continents (procedural shapes that scroll with rot)
    const continents=[
      // [cx_frac, cy_frac, w_frac, h_frac, color, roundness]
      [0.14, 0.25, 0.18, 0.28,'#2d7a32',0.45],   // Americas
      [0.52, 0.20, 0.22, 0.26,'#3a8838',0.40],   // Europe/Africa
      [0.76, 0.22, 0.20, 0.24,'#4a9840',0.42],   // Asia
      [0.82, 0.60, 0.12, 0.12,'#3d8830',0.50],   // Australia
      [0.30, 0.62, 0.14, 0.10,'#2d7020',0.48],   // S. America bottom
    ];
    continents.forEach(([cfx,cfy,cfw,cfh,col,rnd2])=>{
      // Scroll with rotation
      const cx2=((cfx + rot/(TAU2)) % 1.0) * er*2 - er + ex;
      const cy2=ey - er + cfy*er*2;
      const cw2=cfw*er*1.8, ch2=cfh*er*1.8;
      // Land gradient
      const lg=IX.createRadialGradient(cx2-cw2*0.2,cy2-ch2*0.2,0,cx2,cy2,Math.max(cw2,ch2));
      lg.addColorStop(0,'#5ab850');
      lg.addColorStop(0.4,col);
      lg.addColorStop(1,'#1a4010');
      IX.fillStyle=lg;
      IX.beginPath();
      IX.ellipse(cx2,cy2,cw2/2,ch2/2,0,0,TAU2);
      IX.fill();
      // Second smaller offset ellipse for more organic shape
      IX.fillStyle=col;
      IX.beginPath();
      IX.ellipse(cx2+cw2*0.15,cy2+ch2*0.1,cw2*0.38,ch2*0.45,0.4,0,TAU2);
      IX.fill();
    });

    // Ice caps
    const icg=IX.createRadialGradient(ex,ey-er,0,ex,ey-er,er*0.38);
    icg.addColorStop(0,'rgba(240,248,255,0.95)');
    icg.addColorStop(0.5,'rgba(200,230,255,0.7)');
    icg.addColorStop(1,'transparent');
    IX.beginPath(); IX.arc(ex,ey-er,er*0.38,0,TAU2);
    IX.fillStyle=icg; IX.fill();

    const icg2=IX.createRadialGradient(ex,ey+er,0,ex,ey+er,er*0.28);
    icg2.addColorStop(0,'rgba(240,248,255,0.90)');
    icg2.addColorStop(1,'transparent');
    IX.beginPath(); IX.arc(ex,ey+er,er*0.28,0,TAU2);
    IX.fillStyle=icg2; IX.fill();

    // Cloud layer (semi-transparent, rotating faster)
    const cr = rot*1.4;
    const cloudPatterns=[
      [0.18,0.30,0.22,0.10],[0.55,0.25,0.20,0.09],[0.72,0.45,0.18,0.11],
      [0.35,0.55,0.24,0.09],[0.08,0.60,0.18,0.08],[0.90,0.32,0.15,0.10],
    ];
    IX.save(); IX.globalAlpha=0.68;
    cloudPatterns.forEach(([cfx,cfy,cfw,cfh])=>{
      const cx2=((cfx + cr/(TAU2)*0.6) % 1.0)*er*2 - er + ex;
      const cy2=ey - er + cfy*er*2;
      const cg2=IX.createRadialGradient(cx2,cy2,0,cx2,cy2,cfw*er);
      cg2.addColorStop(0,'rgba(255,255,255,0.88)');
      cg2.addColorStop(0.5,'rgba(240,248,255,0.55)');
      cg2.addColorStop(1,'transparent');
      IX.fillStyle=cg2;
      IX.beginPath(); IX.ellipse(cx2,cy2,cfw*er,cfh*er,0,0,TAU2); IX.fill();
    });
    IX.restore();

    // Specular highlight (sun reflection)
    const sg=IX.createRadialGradient(ex-er*0.30,ey-er*0.30,0,ex-er*0.15,ey-er*0.15,er*0.75);
    sg.addColorStop(0,'rgba(255,255,255,0.22)');
    sg.addColorStop(0.35,'rgba(255,255,255,0.06)');
    sg.addColorStop(1,'transparent');
    IX.fillStyle=sg; IX.fillRect(ex-er,ey-er,er*2,er*2);

    // Night-side shadow (terminator)
    const shg=IX.createRadialGradient(ex+er*0.55,ey,er*0.1,ex+er*0.55,ey,er*1.2);
    shg.addColorStop(0,'rgba(0,0,0,0.0)');
    shg.addColorStop(0.45,'rgba(0,0,0,0.08)');
    shg.addColorStop(0.72,'rgba(0,2,8,0.50)');
    shg.addColorStop(1,'rgba(0,2,8,0.82)');
    IX.fillStyle=shg; IX.fillRect(ex-er,ey-er,er*2,er*2);

    IX.restore(); // end clip

    // ── Sphere rim / edge highlight
    const rim=IX.createRadialGradient(ex,ey,er*0.85,ex,ey,er);
    rim.addColorStop(0,'transparent');
    rim.addColorStop(0.7,'rgba(60,130,255,0.08)');
    rim.addColorStop(1,'rgba(100,180,255,0.28)');
    IX.beginPath(); IX.arc(ex,ey,er,0,TAU2);
    IX.fillStyle=rim; IX.fill();
  }

  let animRunning=true;
  function introLoop(){
    if(!animRunning) return;
    iT++;
    drawIntroBg();
    drawIntroEarth();
    requestAnimationFrame(introLoop);
  }
  introLoop();

  // ── Dismiss logic (drag up / click / touch)
  function dismiss(){
    if(dismissed) return;
    dismissed=true;
    animRunning=false;
    intro.classList.add('dismissed');
    // Hapus dari DOM setelah transisi selesai
    intro.addEventListener('transitionend',()=>intro.remove(),{once:true});
  }

  // Drag-to-dismiss
  let dy0=0, dragging2=false, dragThreshold=60;

  intro.addEventListener('touchstart',e=>{
    dy0 = e.touches[0].clientY;
    dragging2=true;
  },{passive:true});

  intro.addEventListener('touchmove',e=>{
    if(!dragging2) return;
    const dy = dy0 - e.touches[0].clientY; // positive = swipe up
    if(dy>8){
      const clamped = Math.min(dy, window.innerHeight);
      intro.style.transition='none';
      intro.style.transform=`translateY(-${clamped}px)`;
      intro.style.opacity = Math.max(0, 1 - clamped/window.innerHeight*1.4);
    }
  },{passive:true});

  intro.addEventListener('touchend',e=>{
    dragging2=false;
    const dy = dy0 - e.changedTouches[0].clientY;
    if(dy > dragThreshold){
      dismiss();
    } else {
      // Snap back
      intro.style.transition='';
      intro.style.transform='';
      intro.style.opacity='';
    }
  });

  // Mouse drag (desktop)
  intro.addEventListener('mousedown',e=>{ dy0=e.clientY; dragging2=true; });
  window.addEventListener('mousemove',e=>{
    if(!dragging2) return;
    const dy=dy0-e.clientY;
    if(dy>8){
      intro.style.transition='none';
      intro.style.transform=`translateY(-${Math.min(dy,window.innerHeight)}px)`;
      intro.style.opacity=Math.max(0,1-dy/window.innerHeight*1.4);
    }
  });
  window.addEventListener('mouseup',e=>{
    if(!dragging2) return;
    dragging2=false;
    const dy=dy0-e.clientY;
    if(dy>dragThreshold) dismiss();
    else{ intro.style.transition=''; intro.style.transform=''; intro.style.opacity=''; }
  });

  // Klik juga dismiss (untuk kemudahan)
  document.getElementById('intro-drag-hint').addEventListener('click', dismiss);

})();
