// ═══════════════════════════════════════════════════════════════
//  THE CLIMATE SYSTEM — Cinematic Interactive Visualization
//  Source: Perdinan slides + Understanding Earth 6th Ed. + IPCC 2007
// ═══════════════════════════════════════════════════════════════
const C=document.getElementById('c'),X=C.getContext('2d');
let W,H,cx,cy,T=0,scene=0,transAlpha=0,transitioning=false;

function resize(){W=C.width=window.innerWidth;H=C.height=window.innerHeight;cx=W/2;cy=H/2;}
resize();window.addEventListener('resize',resize);

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
//  SCENE 0 — Components of Climate System
//  Animated Earth with 5 orbiting component spheres
// ═══════════════════════════════════════════════════════════════
let earthRot=0,moonAngle=0;
function scene0(t){
  // Deep space
  const bg=X.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#01030a');bg.addColorStop(1,'#02050f');
  X.fillStyle=bg;X.fillRect(0,0,W,H);
  drawMilkyWay(.18);drawStars();

  const ex=cx,ey=cy,er=Math.min(W,H)*.2;
  earthRot+=.002;moonAngle+=.009;

  // 5 components orbiting
  const comps=[
    {id:'atmo_comp', name:'ATMOSFER',   sub:'N₂ 78% · O₂ 21% · CO₂ 0.04%', col:'#4ab0e8', r:er*2.1,  speed:.008, phase:0,      yScale:.45},
    {id:'hydro_comp',name:'HIDROSFER',  sub:'Samudra 1,335,040 ×10³ km³',   col:'#1976d2', r:er*2.5,  speed:.006, phase:1.26,   yScale:.42},
    {id:'cryo_comp', name:'KRIOSFER',   sub:'Es 26,350 ×10³ km³',           col:'#a8d8f0', r:er*2.2,  speed:.007, phase:2.51,   yScale:.4},
    {id:'bio_comp',  name:'BIOSFER',    sub:'GPP 120 GtC/yr',               col:'#5cba74', r:er*2.4,  speed:.0055,phase:3.77,   yScale:.43},
    {id:'litho_comp',name:'LITOSFER',   sub:'Vulkanik · Pelapukan · Sedimen', col:'#c9a84c', r:er*1.95, speed:.0065,phase:5.02,  yScale:.41},
  ];

  comps.forEach(c=>{
    const a=c.phase+t*c.speed;
    const px=ex+cos(a)*c.r, py=ey+sin(a)*c.r*c.yScale;
    const isOn=S.tog[c.id];
    const alpha=isOn?1:.35;

    // Orbit path (faint ellipse)
    X.save();X.globalAlpha=.06+( isOn?.06:0);
    X.strokeStyle=c.col;X.lineWidth=.8;X.setLineDash([3,6]);
    X.beginPath();X.ellipse(ex,ey,c.r,c.r*c.yScale,0,0,TAU);
    X.stroke();X.setLineDash([]);X.restore();

    // Component sphere
    X.save();X.globalAlpha=alpha;
    if(isOn){X.shadowColor=c.col;X.shadowBlur=20;}
    // Glow aura
    const aura=X.createRadialGradient(px,py,0,px,py,36);
    aura.addColorStop(0,hexToRgba(c.col,.28));aura.addColorStop(1,'transparent');
    X.beginPath();X.arc(px,py,36,0,TAU);X.fillStyle=aura;X.fill();
    // Sphere
    X.shadowBlur=0;
    X.beginPath();X.arc(px,py,18,0,TAU);
    const sg=X.createRadialGradient(px-5,py-5,0,px,py,18);
    sg.addColorStop(0,'rgba(255,255,255,.55)');
    sg.addColorStop(.45,c.col);
    sg.addColorStop(1,hexToRgba(c.col,.65));
    X.fillStyle=sg;X.fill();
    // Rim highlight
    X.strokeStyle=hexToRgba(c.col,.6);X.lineWidth=1.2;X.stroke();
    X.restore();

    // Label
    const lx=px+(px>ex?22:-22),ly=py;
    const talign=px>ex?'left':'right';
    X.save();X.globalAlpha=alpha;
    X.font=`${isOn?'500':'400'} ${isOn?11:10}px Space Grotesk`;
    X.fillStyle=c.col;X.textAlign=talign;
    X.shadowColor=c.col;X.shadowBlur=isOn?12:0;
    X.fillText(c.name,lx,ly-1);
    X.shadowBlur=0;
    X.font='9px Space Grotesk';X.fillStyle='rgba(255,255,255,.35)';
    X.fillText(c.sub,lx,ly+12);
    X.restore();

    // Connection line
    X.save();X.globalAlpha=alpha*.5;
    X.strokeStyle=c.col;X.lineWidth=.8;
    X.beginPath();X.moveTo(ex,ey);X.lineTo(px,py);X.stroke();
    X.restore();

    // If active: emit interaction particles
    if(isOn&&t%4===0){
      spawn(px+rnd(-5,5),py+rnd(-5,5),{
        vx:(ex-px)*.015+rnd(-.5,.5),vy:(ey-py)*.015+rnd(-.5,.5),
        decay:.018,size:rnd(2,5),col:c.col,glow:3,drag:.97
      });
    }
  });

  drawEarth(ex,ey,er,earthRot);

  // Moon
  const mx=ex+cos(moonAngle)*er*1.8,my=ey+sin(moonAngle)*er*.65,mr=er*.25;
  X.save();
  const mg=X.createRadialGradient(mx,my,mr,mx,my,mr*2.2);
  mg.addColorStop(0,'rgba(200,200,165,.14)');mg.addColorStop(1,'transparent');
  X.beginPath();X.arc(mx,my,mr*2.2,0,TAU);X.fillStyle=mg;X.fill();
  const mc=X.createRadialGradient(mx-mr*.28,my-mr*.28,0,mx,my,mr);
  mc.addColorStop(0,'#eae8d8');mc.addColorStop(.5,'#c5c3a5');mc.addColorStop(1,'#787060');
  X.beginPath();X.arc(mx,my,mr,0,TAU);X.fillStyle=mc;X.fill();
  const ms=X.createRadialGradient(mx+mr*.3,my,0,mx+mr*.3,my,mr*1.2);
  ms.addColorStop(0,'rgba(0,0,15,.72)');ms.addColorStop(1,'transparent');
  X.beginPath();X.arc(mx,my,mr,0,TAU);X.fillStyle=ms;X.fill();
  X.restore();

  // Floating data label
  X.save();X.globalAlpha=.45;
  X.font='italic 13px Cormorant Garamond';X.fillStyle='rgba(232,240,252,.65)';
  X.textAlign='center';
  X.fillText('Klik komponen untuk menampilkan detail interaksi sistem iklim', cx,H*.92);
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

  // THERMOHALINE CIRCULATION (animated current)
  if(S.tog.thermo_on){
    const prog=(t*.008)%1;
    const warmPath=[W*.5,oceanY+20,W*.7,oceanY+15,W*.88,oceanY+25,W*.96,oceanY+18];
    const coldPath=[W*.96,H*.8,W*.72,H*.85,W*.52,H*.82,W*.5,oceanY+20];
    // Draw warm (red) and cold (blue) streams
    [[warmPath,'rgba(229,80,40,.7)','ARUS HANGAT'],[coldPath,'rgba(30,100,220,.7)','ARUS DINGIN']].forEach(([pts,col,lbl],si)=>{
      X.save();X.strokeStyle=col;X.lineWidth=3.5;X.lineJoin='round';
      X.shadowColor=col;X.shadowBlur=8;
      X.beginPath();
      for(let i=0;i<pts.length;i+=2)i?X.lineTo(pts[i],pts[i+1]):X.moveTo(pts[i],pts[i+1]);
      X.stroke();X.shadowBlur=0;
      // Animated dot along path
      const ti=si===0?prog:(prog+.5)%1;
      const idx=~~(ti*(pts.length/2-1))*2;
      const frac=ti*(pts.length/2-1)-~~(ti*(pts.length/2-1));
      const dx=lerp(pts[idx],pts[idx+2]||pts[idx],frac);
      const dy=lerp(pts[idx+1],pts[idx+3]||pts[idx+1],frac);
      X.fillStyle=col.replace('.7','.95');X.shadowColor=col;X.shadowBlur=12;
      X.beginPath();X.arc(dx,dy,5.5,0,TAU);X.fill();X.shadowBlur=0;
      X.font='9px Space Mono';X.fillStyle=col.replace('.7','.9');X.textAlign='center';
      X.fillText(lbl,dx,dy+(si?12:-12));X.restore();
    });
    // Downwelling marker at right
    X.save();X.globalAlpha=.5;
    const dwX=W*.95,dw1Y=oceanY+15,dw2Y=H*.8;
    X.strokeStyle='rgba(180,220,255,.4)';X.lineWidth=1.5;X.setLineDash([4,5]);
    X.beginPath();X.moveTo(dwX,dw1Y);X.lineTo(dwX,dw2Y);X.stroke();X.setLineDash([]);
    X.font='8px Space Mono';X.fillStyle='rgba(180,220,255,.5)';X.textAlign='center';
    X.fillText('↓ Penenggelaman',dwX,dw2Y+12);X.restore();
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

// ═══════════════════════════════════════════════════════════════
//  SCENE 4 — Biosphere & Carbon Cycle
//  Animated molecule flow between atmosphere, biosphere, ocean
// ═══════════════════════════════════════════════════════════════
let _ghMols=[];
function initGHMols(){
  _ghMols=Array.from({length:55},()=>({
    x:rnd(0,W),y:rnd(H*.08,H*.72),
    vx:rnd(-.22,.22),vy:rnd(-.18,.18),
    type:['CO2','CO2','CO2','H2O','CH4'][~~rnd(0,5)],
    size:rnd(5,10),t:rnd(0,100),pulsed:false
  }));
}
initGHMols();

function scene4(t){
  const hf=clamp((S.co2-280)/520,0,1);
  // Sky shifts orange/red as CO2 rises
  const skyHue=220-hf*65,skySat=40+hf*22,skyLit=8+hf*8;
  const bg=X.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,`hsl(${skyHue},${skySat}%,${skyLit}%)`);
  bg.addColorStop(.65,`hsl(${skyHue-20},${skySat-10}%,${skyLit-2}%)`);
  bg.addColorStop(1,'#04090a');
  X.fillStyle=bg;X.fillRect(0,0,W,H);

  const gY=H*.72;
  // Ground
  const gr=X.createLinearGradient(0,gY,0,H);
  gr.addColorStop(0,`hsl(${112-hf*45},${28+S.forestLevel*22}%,${14+S.forestLevel*10}%)`);
  gr.addColorStop(1,'#050c05');
  X.fillStyle=gr;X.fillRect(0,gY,W,H-gY);

  // FOREST TREES
  if(S.tog.forest_on){
    const n=18;
    for(let i=0;i<n;i++){
      const tx=W*(i/(n-1)*.82+.04);
      const th=(H*.09+H*.06*sin(i*1.1))*S.forestLevel;
      const trunk_h=th*.4;
      const g=`hsl(${108+S.forestLevel*18},${36+S.forestLevel*25}%,${14+S.forestLevel*14}%)`;
      X.save();
      X.fillStyle='#3e2723';X.fillRect(tx-3,gY-trunk_h,6,trunk_h);
      // Canopy layers
      for(let lay=0;lay<3;lay++){
        const cy2=gY-trunk_h-(lay*th*.3);
        const cw=th*(1-.28*lay);
        X.fillStyle=`hsl(${106+S.forestLevel*16+lay*5},${35+S.forestLevel*22}%,${13+S.forestLevel*12+lay*3}%)`;
        X.beginPath();X.moveTo(tx,cy2-th*.5);X.lineTo(tx-cw/2,cy2);X.lineTo(tx+cw/2,cy2);X.closePath();X.fill();
      }
      // Breathing animation — CO2 absorption dots
      if(S.tog.forest_on&&t%8===0&&i%3===0){
        spawn(tx+rnd(-8,8),gY-th,{vx:rnd(-.3,.3),vy:rnd(-2.5,-.8),decay:.014,
          size:rnd(1.5,4),col:'rgba(80,200,100,.6)',glow:2,drag:.97});
      }
      X.restore();
    }
    X.save();X.font='10px Space Grotesk';X.fillStyle='rgba(92,186,116,.85)';
    X.textAlign='center';X.fillText('GPP: 120 GtC/yr  |  Respirasi: 119.6 GtC/yr  |  Net Sink: 2.6 GtC/yr',cx,H*.9);X.restore();
  }

  // FACTORY (fossil fuel emissions 6.3 GtC/yr)
  if(S.tog.fossil_on){
    const fx=W*.55,fy=gY;
    X.save();
    X.fillStyle='#1c2428';X.fillRect(fx-28,fy-70,56,70);
    X.fillStyle='#263035';X.fillRect(fx-40,fy-45,80,45);
    // Chimneys
    [fx-14,fx+14].forEach(cx2=>{
      X.fillStyle='#2c3840';X.fillRect(cx2-7,fy-95,14,35);
      // Animated smoke plumes
      for(let i=0;i<8;i++){
        const sy=fy-95-i*20+((t*1.2)%20);
        const sw=8+i*3.5;
        const sa=clamp(.45-i*.05,0,.45);
        X.beginPath();X.arc(cx2+sin(t*.05+i*.8)*5,sy,sw,0,TAU);
        X.fillStyle=`rgba(${150+i*5},${100+i*5},${70+i*5},${sa})`;X.fill();
      }
    });
    X.font='500 9px Space Grotesk';X.fillStyle='rgba(232,98,42,.92)';X.textAlign='center';
    X.fillText('B. Fosil + Industri',fx,fy-100);
    X.fillText('6.3 GtC/yr',fx,fy-87);X.restore();
    // CO2 particle burst
    if(t%5===0){
      spawn(fx+rnd(-18,18),fy-92,{vx:rnd(-.4,.4),vy:rnd(-3,-1.2),decay:.007,
        size:rnd(3,7),col:`rgba(255,${~~(80+S.co2*.1)},40,.65)`,glow:2.5,drag:.98});
    }
  }

  // DEFORESTATION fire
  if(S.tog.defor_on){
    const dx=W*.33,dy=gY;
    // Fire animation
    for(let i=0;i<12;i++){
      const fy2=dy-i*8+(t*1.5)%8;
      const fw=14-i*.8;
      if(fw<0)continue;
      X.save();X.globalAlpha=.65-i*.05;
      X.fillStyle=`hsl(${20+i*5},88%,${38+i*4}%)`;
      X.beginPath();X.arc(dx+sin(t*.1+i)*(3+i*.5),fy2,fw,0,TAU);X.fill();
      X.restore();
    }
    X.save();X.font='9px Space Mono';X.fillStyle='rgba(232,98,42,.85)';X.textAlign='center';
    X.fillText('Deforestasi',dx,dy-105);X.fillText('1.6 GtC/yr',dx,dy-91);X.restore();
    if(t%4===0)spawn(dx+rnd(-10,10),dy-40,{vx:rnd(-1.2,1.2),vy:rnd(-4,-1.5),decay:.012,
      size:rnd(2,5.5),col:`hsl(${~~rnd(10,40)},85%,50%)`,glow:3,drag:.97});
  }

  // OCEAN carbon sink
  if(S.tog.ocean_c){
    const ox=W*.82,oy=gY-20;
    X.save();
    const og=X.createLinearGradient(ox-55,oy,ox-55,oy+65);
    og.addColorStop(0,'#0d47a1');og.addColorStop(1,'#01579b');
    X.fillStyle=og;X.beginPath();X.ellipse(ox,oy+32,62,38,0,0,TAU);X.fill();
    // Wave top
    X.strokeStyle='rgba(80,160,240,.4)';X.lineWidth=1.2;
    X.beginPath();
    for(let xi=-60;xi<=60;xi+=6)X.lineTo(ox+xi,oy+sin(xi*.08+t*.05)*4+3);
    X.stroke();
    // CO2 bubbles going INTO ocean
    if(t%6===0)spawn(ox+rnd(-30,30),oy-10,{vx:rnd(-.5,.5),vy:rnd(1.5,3),decay:.02,
      size:rnd(1.5,3.5),col:'rgba(33,150,243,.7)',glow:2,drag:.99});
    X.font='9px Space Mono';X.fillStyle='rgba(33,150,243,.88)';X.textAlign='center';
    X.fillText('Serap Laut',ox,oy-8);X.fillText('2.2 GtC/yr',ox,oy+3);X.restore();
  }

  // GAS MOLECULES floating (CO2, H2O, CH4)
  _ghMols.forEach(m=>{
    m.t++;m.x+=m.vx;m.y+=m.vy;
    m.vx+=fbm(m.x*.004+t*.0005,m.y*.004)*.04;
    m.vy+=fbm(m.x*.004,m.y*.004+t*.0005)*.04;
    m.vx*=.998;m.vy*=.998;
    if(m.x<-30)m.x=W+20;if(m.x>W+30)m.x=-20;
    if(m.y<H*.05)m.vy+=.05;if(m.y>gY-10)m.vy-=.08;
    const alpha=.5+.2*sin(m.t*.04);
    drawMolecule(m.x,m.y,m.type,m.size,alpha);
  });

  // CO2 concentration display
  const co2col=S.co2<350?'rgba(92,186,116,.9)':S.co2<450?'rgba(240,192,64,.9)':'rgba(232,98,42,.9)';
  X.save();X.font='bold 14px Space Grotesk';X.fillStyle=co2col;X.textAlign='center';
  X.shadowColor=co2col;X.shadowBlur=15;
  X.fillText(`CO₂: ${~~S.co2} ppm`,cx,H*.07);X.shadowBlur=0;
  X.font='300 9px Space Grotesk';X.fillStyle='rgba(255,255,255,.3)';
  X.fillText('Pra-industri: 280 ppm  ·  Tahun 2000: 370 ppm  ·  Batas aman: <450 ppm',cx,H*.1);X.restore();
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
  {name:'Atmosfer & Sirkulasi Global',  info:'<b>Atmosfer</b>: N₂ 78%, O₂ 21%, Ar 0.93%, CO₂ 0.04%. Troposfer: lapse rate <em>6.5 K/km</em>. Sirkulasi global: Sel Hadley, Ferrel, dan Polar. Jet stream di tropopause. Aktifkan layer untuk melihat detail. <span class="src">Slide 7–11; Understanding Earth</span>',
    btns:[{id:'layers_on',label:'Lapisan Atmosfer',ico:'',rgb:'74,176,232',toggle:true},{id:'hadley_on',label:'Sel Sirkulasi',ico:'',rgb:'100,181,246',toggle:true},{id:'lapse_on',label:'Profil Suhu',ico:'',rgb:'255,183,77',toggle:true},{id:'comp_on',label:'Komposisi Udara',ico:'',rgb:'129,199,132',toggle:true}],fn:scene1},
  {name:'Hidrosfer & Siklus Air',        info:'<b>Hidrosfer</b>: Evaporasi laut <em>413×10³ km³/yr</em>. Presipitasi laut 373×10³ km³/yr. Transpor uap ke darat 40×10³ km³/yr. Sirkulasi termohalin memindahkan panas global. <span class="src">Slide 12–15; Understanding Earth</span>',
    btns:[{id:'evap_on',label:'Evaporasi & Vapor',ico:'',rgb:'74,176,232',toggle:true},{id:'precip_on',label:'Presipitasi & Hujan',ico:'',rgb:'100,181,246',toggle:true},{id:'thermo_on',label:'Arus Termohalin',ico:'',rgb:'25,118,210',toggle:true},{id:'surface_on',label:'Arus Permukaan',ico:'',rgb:'29,233,182',toggle:true}],fn:scene2},
  {name:'Kriosfer & Es Global',          info:'<b>Kriosfer</b>: Es Arktik maks <em>14.0×10⁶ km²</em> (Maret), min 6.0×10⁶ km² (September). Es Antarktika maks 15.0×10⁶ km². Ice-albedo feedback memperkuat perubahan iklim. <span class="src">Slide 16–19; NSIDC</span>',
    btns:[{id:'arctic_on',label:'Es Laut Arktik',ico:'',rgb:'168,216,240',toggle:true},{id:'antarc_on',label:'Es Antarktika',ico:'',rgb:'144,202,249',toggle:true},{id:'albedo_on',label:'Ice-Albedo Feedback',ico:'',rgb:'255,241,118',toggle:true},{id:'melt_sim',label:'Simulasi Pencairan',ico:'',rgb:'255,138,101',toggle:false}],
    slider:{label:'Tutupan Es',key:'iceLevel',min:0,max:1,step:.05,unit:''},fn:scene3},
  {name:'Biosfer & Siklus Karbon',       info:'<b>Siklus Karbon:</b> CO₂ pra-industri 280 ppm → 370 ppm (2000). Emisi manusia: <em>8.0 GtC/yr</em> (fosil 6.3 + lahan 1.6 + semen 0.1). Biosfer+laut serap 4.8 GtC/yr → net +3.2 GtC/yr ke atmosfer. <span class="src">Slide 23–29; IPCC 2007</span>',
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
  document.querySelectorAll('.nav-pill').forEach((p,i)=>p.classList.toggle('active',i===idx));
  document.getElementById('scene-title').textContent=SCENES[idx].name;
  setTimeout(updateInfo,60);buildControls();
  POOL.forEach(p=>{p.alive=false;});
}

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

// INIT
buildControls();
document.getElementById('scene-title').textContent=SCENES[0].name;
updateInfo();loop();
document.addEventListener('mousemove',e=>{
  const tip=document.getElementById('tip');
  if(tip.style.display==='block'){tip.style.left=(e.clientX+14)+'px';tip.style.top=(e.clientY-32)+'px';}
});
