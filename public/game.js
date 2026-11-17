
const VIEW_W=240, VIEW_H=320, R=20, DT=1/120;
const tuning={gravity:400,acceleration:500,runSpeed:280,airControl:1.5,jump:288,friction:.60,ricochet:.10};
const $=id=>document.getElementById(id);
const canvas=$("game"), ctx=canvas.getContext("2d",{alpha:false});
const artFiles={
 ball:"ball",egg:"egg",springPlant:"spring",castleArch:"arch",lever:"lever",rose:"rose",
 limboFire:"fire",poet:"poet",homer:"poet",crystals:"crystals",exit:"arch",
 "bg-ravine":"bg-ravine","bg-firelight":"bg-firelight","bg-grotto":"bg-grotto","bg-meadow":"bg-meadow",
 "stone-ravine":"stone-ravine","stone-firelight":"stone-firelight","stone-grotto":"stone-grotto","stone-meadow":"stone-meadow"
};
const [stage,assets]=await Promise.all([
 fetch("./level.json").then(response=>{
  if(!response.ok)throw new Error("Could not load the Limbo level.");
  return response.json();
 }),
 Promise.all(Object.entries(artFiles).map(async ([key,name])=>{
  const img=new Image();img.src="./assets/"+name+".webp";
  try{await img.decode();return [key,img];}
  catch{return [key,null];}
 })).then(entries=>Object.fromEntries(entries))
]);
const keys=new Set();
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
const mix=(a,b,t)=>a+(b-a)*t;
const ease=t=>t*t*(3-2*t);
const toward=(now,target,rate,dt)=>mix(now,target,1-Math.exp(-rate*dt));
const sine=(x)=>Math.sin(x);
const distance=(x,y,a,b)=>Math.hypot(x-a,y-b);
const random=(i)=>{const a=Math.sin(i*127.1+327.81)*43758.5453;return a-Math.floor(a);};
const goalCount=stage.eggs.length;
function polygonEdges(points) {
 return points.map(([ax,ay],i)=>{
  const [bx,by]=points[(i+1)%points.length];
  const dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy);
  return {ax,ay,bx,by,dx,dy,len,normalX:dy/len,normalY:-dx/len,
    xmin:Math.min(ax,bx)-R-1,xmax:Math.max(ax,bx)+R+1,
    ymin:Math.min(ay,by)-R-1,ymax:Math.max(ay,by)+R+1};
 }).filter(edge=>edge.len>.01);
}
const staticEdges=stage.ground.filter(g=>!g.oneWay).flatMap(g=>polygonEdges(g.points));
const footholds=stage.ground.filter(g=>g.oneWay).flatMap(g=>g.points.slice(0,g.rim-1).map(([x,y],i)=>({x,y,right:g.points[i+1][0],endY:g.points[i+1][1]})));
let ball,cam,eggs,fx,progress,cave,phase,now,sceneTitle,checkpoint,stepsOnWater,pop,spring,bloom,previous,departure,lift;
let sound, hasThunder=false;
function newBall([x,y]){
 return {x,y,vx:0,vy:0,ground:false,normalX:0,normalY:-1,rotation:0,face:1,squash:0,elasticVel:0,tilt:0,spring:null,riding:false,onFoothold:false,drop:0};
}
function remember(){
 previous={x:ball.x,y:ball.y,rotation:ball.rotation,squash:ball.squash,cameraX:cam.x,cameraY:cam.y};
}
function reset(){
 ball=newBall(stage.start);
 cam={x:clamp(ball.x-VIEW_W*.5,0,stage.width-VIEW_W),y:clamp(ball.y-VIEW_H*.61,0,stage.height-VIEW_H),vx:0,vy:0};
 eggs=stage.eggs.map(([x,y,kind],id)=>({x,y,kind,id,pickup:0,taken:false}));
 fx=[];phase="play";now=0;pop=0;bloom=0;departure=null;
 progress={count:0,marks:new Map(),gate:0,rose:false,arches:new Set(),visited:new Set(["hub"]),springJumps:0,caveVisits:0};
 cave={discovered:false,reveal:0,entered:false,relief:0};
 spring={bend:0,x:0,y:0};
 sceneTitle={title:"Limbo",sub:"Canto IV",t:2.55};
 checkpoint=stage.start;stepsOnWater=0;
 lift={y:stage.lift.bottom,last:stage.lift.bottom};
 $("location").textContent="I � Limbo";
 remember();
}
function chime(from,to,seconds=.14,vol=.046,type="sine",delay=0) {
 if(!sound||sound.state!=="running")return;
 const t=sound.currentTime+delay,o=sound.createOscillator(),a=sound.createGain();
 o.type=type;o.frequency.setValueAtTime(from,t);o.frequency.exponentialRampToValueAtTime(to,t+seconds);
 a.gain.setValueAtTime(.0003,t);a.gain.linearRampToValueAtTime(vol,t+Math.min(.016,seconds*.27));
 a.gain.exponentialRampToValueAtTime(.0001,t+seconds);
 o.connect(a).connect(sound.destination);o.start(t);o.stop(t+seconds);
}
function wakeAudio(){
 try{
  sound??=new AudioContext();
  const ready=sound.state==="suspended"?sound.resume():Promise.resolve();
  if(!hasThunder){
   hasThunder=true;
   void ready.then(()=>{chime(53,26,.66,.076,"triangle");chime(73,36,.49,.032,"sine",.055);}).catch(()=>{});
  }else void ready.catch(()=>{});
 }catch{}
}
function emit(kind,x,y,color,n,strength,seed=now*117){
 for(let i=0;i<n;i++){
  const angle=(i+.4)*Math.PI*2/n+(random(seed+i)-.5)*.35,speed=strength*(.40+random(seed+77+i)*.65);
  const life=kind==="star"?(.40+random(seed+10+i)*.18):kind==="water"?.36:.28+random(seed+i+92)*.30;
  fx.push({kind,x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-(kind==="water"?27:7),
   time:0,life,color,angle:angle+1.3,x0:x,y0:y});
 }
}
function snapCamera(){
 cam.x=clamp(ball.x-VIEW_W*.5,0,stage.width-VIEW_W);
 cam.y=clamp(ball.y-VIEW_H*.60,0,stage.height-VIEW_H);
 cam.vx=0;cam.vy=0;remember();
}
function respawn(){
 ball=newBall(checkpoint);
 fx=[];snapCamera();bloom=.50;
}
function updateCamera(dt){
 // Track both axes with a dead band, velocity lead, and separate damped camera velocity.
 const leadX=clamp(ball.vx*.15,-44,44);
 const leadY=clamp(ball.vy*.12,-51,59);
 const px=ball.x-VIEW_W*.49+leadX,py=ball.y-VIEW_H*.64+leadY;
 const tx=clamp(px,0,stage.width-VIEW_W),ty=clamp(py,0,stage.height-VIEW_H);
 const dx=Math.abs(tx-cam.x)>3?tx-cam.x:0;
 const dy=Math.abs(ty-cam.y)>4?ty-cam.y:0;
 cam.vx+=(dx*68-cam.vx*15.0)*dt;
 cam.vy+=(dy*76-cam.vy*17.2)*dt;
 cam.x=clamp(cam.x+cam.vx*dt,0,stage.width-VIEW_W);
 cam.y=clamp(cam.y+cam.vy*dt,0,stage.height-VIEW_H);
 // Keep the ball readable at the edge of a very fast drop or spring launch.
 cam.x=clamp(clamp(cam.x,ball.x-VIEW_W+32,ball.x-32),0,stage.width-VIEW_W);
 cam.y=clamp(clamp(cam.y,ball.y-VIEW_H+38,ball.y-36),0,stage.height-VIEW_H);
}
function collideTerrain(){
 const s=ball;
 let support=null, strongest=0, impactX=0,impactY=0;
 let nearby=staticEdges;
 if(progress.gate<.95){
  const gate=stage.port,bottom=gate.bottom-gate.travel*ease(progress.gate);
  nearby=nearby.concat(polygonEdges([[gate.x-8,gate.top],[gate.x+8,gate.top],[gate.x+8,bottom],[gate.x-8,bottom]]));
 }
 for(let pass=0;pass<3;pass++){
  for(const e of nearby){
   if(s.x<e.xmin||s.x>e.xmax||s.y<e.ymin||s.y>e.ymax)continue;
   const t=clamp(((s.x-e.ax)*e.dx+(s.y-e.ay)*e.dy)/(e.len*e.len),0,1);
   const px=e.ax+e.dx*t,py=e.ay+e.dy*t;
   const dx=s.x-px,dy=s.y-py,d=Math.hypot(dx,dy);
   if(d>R+.17)continue;
   let nx=d>.001?dx/d:e.normalX,ny=d>.001?dy/d:e.normalY,depth=R-d;
   if(t>0&&t<1 && nx*e.normalX+ny*e.normalY<0){
    // The step can enter the edge at a joined corner. Recover to its outward side.
    if(d>R*.68)continue;
    nx=e.normalX;ny=e.normalY;depth=R+d;
   }
   if(depth>0){s.x+=nx*(depth+.002);s.y+=ny*(depth+.002);}
   const vn=s.vx*nx+s.vy*ny;
   if(vn<0){
    const rebound=-vn>77?tuning.ricochet:0;
    s.vx-=vn*(1+rebound)*nx;s.vy-=vn*(1+rebound)*ny;
    if(-vn>strongest){strongest=-vn;impactX=px;impactY=py;}
   }
   if(ny<-.54 && (!support||ny<support.ny))support={nx,ny};
  }
 }
 s.ground=Boolean(support);
 if(support){s.normalX=support.nx;s.normalY=support.ny;}
 if(strongest>95){
  s.elasticVel-=clamp(strongest*.026,1.4,9.3);
  emit("dust",impactX,impactY,"#e5c3a0",strongest>220?6:3,32+strongest*.07);
  chime(88,58,.12,.02+clamp(strongest*.000055,0,.025),"triangle");
 }
 if(s.x<R){s.x=R;if(s.vx<0)s.vx*=-tuning.ricochet;}
 if(s.x>stage.width-R){s.x=stage.width-R;if(s.vx>0)s.vx*=-tuning.ricochet;}
}
function catchSpring(oldY){
 if(ball.vy<39)return false;
 for(const [x,y,multiplier] of stage.pads){
  if(Math.abs(ball.x-x)>48||oldY+R>y||ball.y+R<y)continue;
  const hit=ball.vy;
  ball.riding=false;
  ball.spring={x,y,impactX:ball.x,age:0,
   duration:((1100-clamp(hit,100,1000))*.5+20)*.00078,
   force:Math.min(400,hit)*multiplier};
  ball.y=y-R;ball.vx=0;ball.vy=0;ball.ground=false;
  chime(118,83,.15,.045,"triangle");return true;
 }
 return false;
}
function animateSpring(dt){
 const s=ball.spring;
 s.age+=dt;
 const t=clamp(s.age/s.duration,0,1),bend=Math.sin(t*Math.PI);
 ball.x=mix(s.impactX,s.x,ease(Math.min(1,t*2.5)));ball.y=s.y-R+bend*13;
 ball.squash=-bend*.29;
 spring={x:s.x,y:s.y,bend};
 if(t<1)return;
 ball.spring=null;ball.vy=-s.force;ball.elasticVel=8;progress.springJumps++;
 emit("star",s.x,s.y+2,"#f3cf8f",8,81);
 chime(143,381,.275,.041,"triangle");
}
function simulateBall(dt){
 const s=ball;
 const direction=Number(keys.has("ArrowRight")||keys.has("KeyD"))-Number(keys.has("ArrowLeft")||keys.has("KeyA"));
 const jump=keys.has("Space")||keys.has("ArrowUp")||keys.has("KeyW");
 s.drop=Math.max(0,s.drop-dt);
 if(keys.has("ArrowDown")&&(s.riding||s.onFoothold)){
  s.riding=false;s.onFoothold=false;s.ground=false;s.drop=.25;s.y+=3;s.vy=62;
 }
 const wasGround=s.ground;
 if(wasGround&&jump&&s.normalY<-.59){
  s.vy-=tuning.jump;
  s.ground=false;s.riding=false;s.elasticVel+=7;
  chime(165,245,.13,.021,"triangle");
 }
 if(direction&&direction*s.vx<tuning.runSpeed){
  s.vx+=direction*tuning.acceleration*dt/(s.ground?1:tuning.airControl);
 }
 if(s.ground){
  const tx=-s.normalY,ty=s.normalX;
  const along=s.vx*tx+s.vy*ty,weight=-s.normalY*tuning.gravity;
  const friction=Math.sign(along)*Math.min(Math.abs(along),weight*tuning.friction*dt);
  s.vx-=friction*tx;s.vy-=friction*ty;
 }
 s.vy+=tuning.gravity*dt;
 const speed=Math.hypot(s.vx,s.vy);
 if(speed>999){s.vx*=999/speed;s.vy*=999/speed;}
 const ox=s.x,oy=s.y;
 s.x+=s.vx*dt;s.y+=s.vy*dt;
 if(!catchSpring(oy)){collideTerrain();landOnFoothold(oy);landOnLift(oy);}
 const displacement=s.x-ox;
 s.rotation+=displacement/R*(s.ground?1:.65);
 if(direction||Math.abs(s.vx)>12)s.face=toward(s.face,direction||Math.sign(s.vx),16,dt);
 s.tilt=toward(s.tilt,s.ground?Math.atan2(s.normalX,-s.normalY):clamp(s.vx*.0015,-.33,.33),15,dt);
}
function moveLift(){
 const {top,bottom,speed,wait}=stage.lift;
 const travel=(bottom-top)/speed;
 const loop=(travel+wait)*2;
 const t=now%loop;
 lift.last=lift.y;
 if(t<wait)lift.y=bottom;
 else if(t<wait+travel)lift.y=bottom-(t-wait)*speed;
 else if(t<2*wait+travel)lift.y=top;
 else lift.y=top+(t-2*wait-travel)*speed;
 if(ball.riding)ball.y+=lift.y-lift.last;
}
function landOnFoothold(oldY){
 const s=ball;
 s.onFoothold=false;
 if(s.vy<0||s.drop>0)return;
 let best=null;
 for(const top of footholds){
  if(s.x<top.x-3||s.x>top.right+3)continue;
  const span=top.right-top.x;
  const q=clamp((s.x-top.x)/span,0,1);
  const y=mix(top.y,top.endY,q);
  if(oldY+R<=y+.35&&s.y+R>=y-.3&&(!best||y<best.y)){
   const rise=top.endY-top.y,n=Math.hypot(span,rise);
   best={y,nx:rise/n,ny:-span/n};
  }
 }
 if(!best)return;
 s.y=best.y-R;s.vy=0;s.ground=true;s.onFoothold=true;s.normalX=best.nx;s.normalY=best.ny;
}
function landOnLift(oldY){
 const s=ball,{x,width}=stage.lift;
 const above=(oldY+R<=Math.max(lift.last,lift.y)+1.3);
 s.riding=s.drop===0&&above&&s.y+R>=lift.y-.3&&s.vy>=0&&Math.abs(s.x-x)<width*.5+8;
 if(!s.riding)return;
 s.y=lift.y-R;s.vy=0;s.ground=true;s.normalX=0;s.normalY=-1;
}
function insideCave(){
 const [x,y,w,h]=stage.cave.bounds;
 return ball.x>=x+12&&ball.x<x+w-20&&ball.y>y+74&&ball.y<y+h-9;
}
function gather(){
 const inCave=insideCave();
 if(inCave&&!cave.entered){
  progress.caveVisits++;
  cave.entered=true;cave.discovered=true;
  chime(260,392,.31,.026);chime(391,523,.38,.022,"sine",.07);
 } else if(!inCave)cave.entered=false;
 if(inCave&&ball.x<448)cave.relief=1;
 cave.reveal=toward(cave.reveal,inCave?1:0,10,DT);
 for(const item of eggs){
  if(item.taken||(item.kind==="secret"&&!cave.entered)||distance(ball.x,ball.y,item.x,item.y)>33)continue;
  item.taken=true;item.pickup=now+.00001;
  progress.count++;pop=1;
  emit("star",item.x,item.y,item.kind==="secret"?"#c4f2d1":"#ffdc80",8,94,now*79+item.id);
  emit("flake",item.x,item.y,"#fff1bb",4,48,now*99+item.id);
  const notes=[514,579,650,728,815];
  const n=notes[(progress.count-1)%notes.length];
  chime(n,n*.98,.118,.036);chime(n*1.50,n*1.5,.22,.015,"sine",.035);
 }
 if(!progress.rose&&cave.entered&&distance(ball.x,ball.y,...stage.cave.rose)<35){
  progress.rose=true;pop=1;bloom=1;
  emit("star",...stage.cave.rose,"#ffb6c2",14,93);
  chime(438,554,.45,.037);chime(660,887,.55,.021,"sine",.055);
  sceneTitle={title:"Six among the poets",sub:"",t:2.4};
 }
}
function worldEvents(dt){
 const s=ball;
 gather();
 for(const point of stage.checkpoints){
  if(checkpoint!==point && distance(s.x,s.y,...point)<27)checkpoint=point;
 }
 for(const mark of stage.switches){
  if(progress.marks.has(mark.id)||distance(s.x,s.y,mark.x,mark.y)>30)continue;
  progress.marks.set(mark.id,now);
  emit("star",mark.x,mark.y,"#e4efb2",8,65);
  chime(175,260,.28,.043,"triangle");
  if(progress.marks.size===stage.switches.length)chime(311,391,.37,.037,"sine",.14);
 }
 if(progress.marks.size===stage.switches.length&&progress.gate<1){
  const before=progress.gate;
  progress.gate=Math.min(1,progress.gate+dt/.72);
  if(before<1&&progress.gate===1)chime(312,387,.24,.027);
 }
 for(let i=0;i<stage.arches.length;i++){
  const x=stage.arches[i];
  if(s.y>248&&s.y<457&&Math.abs(s.x-x)<14&&!progress.arches.has(i)){
   progress.arches.add(i);
   emit("dust",x,s.y+11,"#f2c795",4,33);
  }
 }
 const w=stage.stream;
 if(s.ground&&s.y>w.y-29&&s.y<w.y+9&&s.x>w.left&&s.x<w.right&&Math.abs(s.vx)>19){
  stepsOnWater+=Math.abs(s.vx)*dt;
  if(stepsOnWater>15){
   stepsOnWater=0;emit("water",s.x,s.y+R-4,"#c8f0e0",4,36);
   if(Math.abs(s.vx)>100)chime(280,131,.11,.011);
  }
 }else stepsOnWater=0;
 const zone=stage.zones.find(area=>s.x>=area.x&&s.x<=area.x+area.w&&s.y>=area.y&&s.y<=area.y+area.h);
 if(zone&&!progress.visited.has(zone.id)){
  progress.visited.add(zone.id);
  sceneTitle={title:zone.title,sub:"",t:2.06};
 }
 if(s.y>stage.height+30){respawn();return;}
 if(distance(s.x,s.y,...stage.exit)<32 && progress.marks.size===stage.switches.length){
  phase="exit";departure={x:s.x,y:s.y,t:0};s.vx=0;s.vy=0;
  chime(294,391,.44,.047);chime(440,586,.53,.027,"sine",.15);
 }
}
function tick(dt){
 remember();now+=dt;
 if(phase==="play"){
  moveLift();
  if(ball.spring)animateSpring(dt);
  else simulateBall(dt);
  worldEvents(dt);
 }else if(phase==="exit"){
  departure.t=Math.min(1,departure.t+dt/.72);
  const t=ease(departure.t),x=mix(departure.x,stage.exit[0],t);
  ball.rotation+=(x-ball.x)/R;ball.x=x;ball.y=mix(departure.y,stage.exit[1]+8,t);
  if(departure.t===1){
   phase="clear";bloom=.55;$("location").textContent="I � Limbo cleared";
  }
 }
 if(!ball.spring){
  ball.elasticVel+=(-143*ball.squash-15.7*ball.elasticVel)*dt;
  ball.squash=clamp(ball.squash+ball.elasticVel*dt,-.34,.33);
  spring.bend=toward(spring.bend,0,9,dt);
 }
 updateCamera(dt);
 sceneTitle.t=Math.max(0,sceneTitle.t-dt);
 pop=Math.max(0,pop-dt*3.8);bloom=Math.max(0,bloom-dt*1.6);
 for(const part of fx){
  part.time+=dt;
  part.x+=part.vx*dt;part.y+=part.vy*dt;
  part.vy+=dt*(part.kind==="water"?188:part.kind==="star"?47:38);
  part.vx*=1-dt*1.35;
 }
 fx=fx.filter(part=>part.time<part.life);
}

const palettes={
 mist:{sky0:"#6d8996",sky1:"#a9b5a5",far:"#718f95",mid:"#5b7679",near:"#435c62",ground:"#5a6b6f",core:"#2c4047",line:"#9da698",rim:"#a9bb90",grass:"#657c67"},
 clear:{sky0:"#9e796b",sky1:"#cec095",far:"#b3957f",mid:"#8a806e",near:"#65685c",ground:"#676a65",core:"#3a4444",line:"#ac947b",rim:"#c6bd8a",grass:"#788758"},
 cave:{sky0:"#323748",sky1:"#667074",far:"#536471",mid:"#465b68",near:"#394655",ground:"#53506a",core:"#272838",line:"#787289",rim:"#a4a2a6",grass:"#60726f"},
 castle:{sky0:"#a0856a",sky1:"#d1bd94",far:"#a9927d",mid:"#84796e",near:"#686b64",ground:"#77675d",core:"#423f43",line:"#9d826c",rim:"#c0ad85",grass:"#899065"},
 meadow:{sky0:"#78999a",sky1:"#d0cba1",far:"#a2af9a",mid:"#7a917f",near:"#576f65",ground:"#687254",core:"#3c4c43",line:"#adb286",rim:"#d1cc8a",grass:"#90a565"}
};
const stoneForSkin={mist:"ravine",clear:"firelight",castle:"meadow",cave:"grotto",meadow:"meadow"};
const patterns=Object.fromEntries(Object.entries(stoneForSkin).map(([skin,kind])=>{
 const img=assets["stone-"+kind];
 return [skin,img?ctx.createPattern(img,"repeat"):null];
}));
const pale="#fff1ca",black="#242837";
function rgba(hex,alpha){return hex+Math.round(clamp(alpha,0,1)*255).toString(16).padStart(2,"0");}
function colorBetween(a,b,t){
 const x=Number.parseInt(a.slice(1),16),y=Number.parseInt(b.slice(1),16);
 const r=Math.round(mix(x>>16,y>>16,t)),g=Math.round(mix((x>>8)&255,(y>>8)&255,t)),q=Math.round(mix(x&255,y&255,t));
 return "#"+((1<<24)|(r<<16)|(g<<8)|q).toString(16).slice(1);
}
let frameView={x:0,y:0,t:0};
function visible(x,y,reach=0){
 return x>=frameView.x-reach&&x<=frameView.x+VIEW_W+reach&&y>=frameView.y-reach&&y<=frameView.y+VIEW_H+reach;
}
function fillRect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
function ellipse(x,y,rx,ry,fill,angle=0) {
 if(rx<=0||ry<=0)return;
 ctx.beginPath();ctx.ellipse(x,y,rx,ry,angle,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();
}
function outline(points,fill,stroke,width=1) {
 ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
 for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);
 ctx.closePath();
 if(fill){ctx.fillStyle=fill;ctx.fill();}
 if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
}
function line(points,color,width=1) {
 if(points.length<2)return;
 ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
 for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);
 ctx.lineJoin="round";ctx.lineCap="round";ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
function glow(x,y,r,color,intensity=1){
 const g=ctx.createRadialGradient(x,y,0,x,y,r);
 g.addColorStop(0,rgba(color,intensity));g.addColorStop(1,rgba(color,0));ellipse(x,y,r,r,g);
}
function sprite(id,x,y,w,h){
 const a=assets[id];
 if(!a||!a.complete||!a.naturalWidth)return false;
 ctx.drawImage(a,x-w/2,y-h/2,w,h);return true;
}
function arch(x,bottom,w,h,fill,edge,width=1.3){
 const r=w/2;
 ctx.beginPath();ctx.moveTo(x-r,bottom);ctx.lineTo(x-r,bottom-h+r);
 ctx.arc(x,bottom-h+r,r,Math.PI,Math.PI*2);
 ctx.lineTo(x+r,bottom);ctx.closePath();
 if(fill){ctx.fillStyle=fill;ctx.fill();}
 if(edge){ctx.strokeStyle=edge;ctx.lineWidth=width;ctx.stroke();}
}
function pave(x,y,w,h,fill,edge){
 fillRect(x,y,w,h,fill);if(edge){ctx.strokeStyle=edge;ctx.lineWidth=.65;ctx.strokeRect(x,y,w,h);}
}
function lightArch(x,y,w,h,frame,inner){
 arch(x,y,w+11,h+9,frame,rgba("#282839",.65),1.2);
 arch(x,y+1,w,h,inner,rgba(pale,.43),1);
}
function flare(x,y,r,color,angle=0){
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);
 outline([[0,-r],[r*.19,-r*.21],[r*.78,0],[r*.19,r*.20],[0,r],[-r*.19,r*.20],[-r*.78,0],[-r*.19,-r*.21]],color);
 ctx.restore();
}
function scenery(){
 const {x,y,t}=frameView;
 const posX=x+VIEW_W*.5,posY=y+VIEW_H*.62;
 const east=ease(clamp((posX-980)/360,0,1));
 const under=ease(clamp((posY-830)/145,0,1));
 const high=ease(clamp((570-posY)/133,0,1))*ease(clamp((posX-730)/275,0,1));
 const sky=ctx.createLinearGradient(0,0,0,VIEW_H);
 sky.addColorStop(0,"#465065");sky.addColorStop(1,"#969783");
 fillRect(0,0,VIEW_W,VIEW_H,sky);
 const xOffset=-20-(x/Math.max(1,stage.width-VIEW_W))*83;
 const yOffset=-24-(y/Math.max(1,stage.height-VIEW_H))*77;
 const size=VIEW_H+125;
 for(const [name,a] of [["ravine",1],["firelight",east],["meadow",high],["grotto",under]]){
  const img=assets["bg-"+name];
  if(!img||a<.005)continue;
  ctx.save();ctx.globalAlpha=a;
  ctx.drawImage(img,xOffset,yOffset,size,size);ctx.restore();
 }
 const tint=ctx.createLinearGradient(0,0,0,VIEW_H);
 tint.addColorStop(0,"#1c253115");tint.addColorStop(.8,rgba("#152334",.13+under*.09));tint.addColorStop(1,"#1726324c");
 fillRect(0,0,VIEW_W,VIEW_H,tint);
 for(let i=0;i<7;i++){
  const Y=65+i*42+sine(t*.36+i*1.2)*6-(y*.17)%54;
  const X=((random(i+17)*410+t*(5+i*.27)-x*.17+600)%410)-72;
  ellipse(X,Y,59+random(i)*46,7+random(10+i)*7,rgba("#e6d4b7",.06+under*.03));
 }
}
const surfaceArt=stage.ground.map((shape,i)=>{
 const rim=shape.points.slice(0,shape.rim);
 const x0=Math.min(...shape.points.map(p=>p[0])),x1=Math.max(...shape.points.map(p=>p[0]));
 const y0=Math.min(...shape.points.map(p=>p[1])),y1=Math.max(...shape.points.map(p=>p[1]));
 const flecks=Array.from({length:Math.ceil((x1-x0)*(y1-y0)/1050)},(_,j)=>{
  const id=i*233+j;
  return [mix(x0,x1,random(id)),mix(y0,y1,random(id+1.1)),2+random(id+2.4)*12,random(id+4.6)];
 });
 const stems=rim.flatMap(([x,y],j)=>{
  if(j===rim.length-1)return [];
  const [u,v]=rim[j+1],count=Math.max(1,Math.floor((u-x)/11));
  return Array.from({length:count},(_,n)=>{
   const t=(n+.28+random(i*381+j*93+n)*.39)/count;
   return [mix(x,u,t),mix(y,v,t),random(n+j*31+i*9),random(n+j*11+i*3+44)];
  });
 });
 return {shape,rim,x0,x1,y0,y1,flecks,stems};
});
function terrain(){
 for(const {shape,rim,x0,x1,y0,y1,flecks,stems} of surfaceArt){
  if(x0>frameView.x+VIEW_W||x1<frameView.x||y0>frameView.y+VIEW_H+10||y1<frameView.y-10)continue;
  const p=palettes[shape.skin],g=ctx.createLinearGradient(0,y0,0,y1);
  g.addColorStop(0,p.ground);g.addColorStop(.37,p.ground);g.addColorStop(1,p.core);
  outline(shape.points,g,p.core,2.5);
  ctx.save();ctx.clip();
  if(patterns[shape.skin]){
   ctx.globalAlpha=.70;fillRect(x0-2,y0-2,x1-x0+4,y1-y0+4,patterns[shape.skin]);ctx.globalAlpha=1;
   const shade=ctx.createLinearGradient(0,y0,0,y1);
   shade.addColorStop(0,rgba(p.rim,.03));shade.addColorStop(.52,rgba(p.core,.23));shade.addColorStop(1,rgba(p.core,.87));
   fillRect(x0-2,y0-2,x1-x0+4,y1-y0+4,shade);
  }
  for(let band=0;band<3;band++){
   const bands=rim.map(([x,y],i)=>[x,y+14+band*(9+random(i+5)*4)+random(i*.71+band)*7]);
   line(bands,rgba(band%2?p.line:p.core,band===0?.28:.30),band%2?1.1:3.8);
  }
  for(const [x,y,size,s] of flecks){
   if(!visible(x,y,18))continue;
   if(s>.61){
    outline([[x,y],[x+size*.60,y-1.5],[x+size,y+1.6],[x+size*.36,y+3.5]],
      rgba(s>.82?p.line:p.core,.39));
   }else ellipse(x,y,size*.57,.64,rgba(p.line,.27),s-.4);
  }
  line(rim.map(([x,y])=>[x,y+4]),p.grass,7.0);
  line(rim.map(([x,y])=>[x,y+1.25]),p.rim,2.3);
  ctx.restore();
  if(shape.skin==="cave"||shape.skin==="castle")continue;
  for(const [x,y,s,q] of stems){
   if(!visible(x,y,8))continue;
   const n=shape.skin==="meadow"?1.35:1,h=(3+s*5)*n;
   line([[x-1,y],[x-2,y-h*.55],[x-5,y-h]],p.grass,.9);
   line([[x+1,y],[x+1,y-h*.66],[x+4,y-h]],p.rim,.85);
   if(q>.81){
    line([[x+2,y],[x+3,y-h-2]],p.grass,.85);
    ellipse(x+3,y-h-3.2,1.8,1.4,q>.92?"#d09c82":"#f0d4a0");
   }
  }
 }
}
function mist(){
 const {x,y,t}=frameView;
 if(y>690||x>1080)return;
 for(let i=0;i<7;i++){
  const yy=y+71+i*35+sine(t*.65+i)*9;
  const xx=x+((i*67+random(i+12)*35+t*(7+i*.7))%365)-67;
  const g=ctx.createRadialGradient(xx,yy,2,xx,yy,70);
  g.addColorStop(0,rgba("#d2d9c3",.21));g.addColorStop(1,"#d2d9c300");
  ellipse(xx,yy,68,12+random(i+3)*6,g,-.06+random(i+18)*.12);
 }
}

function leaf(x,y,len,w,angle,color,rib=null){
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);
 ctx.beginPath();ctx.moveTo(0,0);
 ctx.bezierCurveTo(len*.24,-w,len*.77,-w*.86,len,0);
 ctx.bezierCurveTo(len*.72,w*.84,len*.22,w*.67,0,0);
 ctx.fillStyle=color;ctx.fill();
 if(rib)line([[1,0],[len*.70,0]],rib,.65);
 ctx.restore();
}
function willow(x,y,size,seed,green=true){
 if(!visible(x,y-size*.45,size))return;
 if(green&&sprite("willow",x,y-size*.5,size*.84,size))return;
 const t=frameView.t,c1=green?"#364b43":"#35444d",c2=green?"#617556":"#586663";
 ctx.save();ctx.translate(x,y);ctx.scale(size/100,size/100);
 ctx.beginPath();ctx.moveTo(-6,3);
 ctx.bezierCurveTo(2,-18,3,-28,-6,-45);ctx.bezierCurveTo(-12,-62,-8,-71,0,-80);
 ctx.bezierCurveTo(-4,-63,-4,-55,4,-48);ctx.bezierCurveTo(12,-26,9,-11,13,1);
 ctx.closePath();ctx.fillStyle=c1;ctx.fill();
 line([[0,0],[7,-26],[1,-44],[-3,-62],[0,-75]],rgba("#d2ba8d",.47),1.8);
 for(let i=0;i<5;i++){
  const s=i%2===0?-1:1,k=(23+random(seed+i)*27)*s;
  const Y=-50-i*6;
  line([[0,Y+7],[k*.42,Y-8],[k*.78,Y-11],[k,Y-25]],c1,2.5);
  if(!green)continue;
  const drift=sine(t*1.18+i+seed)*3;
  for(let j=0;j<9;j++){
   const q=random(seed+i*16+j),p=random(j+i*30.21);
   const X=k*.45+(p-.5)*46+drift*.39,B=Y-7-q*19;
   const long=12+p*22;
   leaf(X,B,long,6,1.54+(q-.5)*1.2,rgba(p>.61?"#91a06c":p>.30?c2:"#526b54",.94),rgba("#c2c18b",.38));
  }
 }
 ctx.restore();
}
function littleFern(x,y,size,seed=x){
 if(!visible(x,y,size+4))return;
 const drift=sine(frameView.t*1.15+seed)*size*.06;
 line([[x,y],[x+drift,y-size*.65],[x-size*.15+drift,y-size]],"#5c795d",1.3);
 for(let i=0;i<4;i++){
  const q=(i+1)/5,xx=x+drift*q-size*.08*q,yy=y-q*size;
  leaf(xx,yy,size*(.72-q*.27),size*.095,-.72+i*.095,i%2?"#83a06b":"#a4ae74","#c5c1876e");
  leaf(xx,yy+2,size*(.70-q*.25),size*.088,3.90-i*.11,i%2?"#6f8b63":"#94a472","#ccc0805c");
 }
}
const groves=[
 [92,794,64,1,false],[262,645,91,2,false],[316,792,61,3,false],[484,727,55,4,false],
 [577,655,73,5,false],[725,646,58,6,true],[989,633,75,7,true],
 [1174,781,84,8,true],[1406,775,70,9,true],[1634,774,74,10,true],
 [1525,392,71,11,true],[1726,390,95,12,true]
];
const ferns=[[711,649,12],[788,637,14],[835,634,15],[569,662,15],[908,440,13],[1080,430,10],[1399,417,11],
 [1195,779,14],[1274,774,20],[1457,769,15],[1663,771,20],[1504,390,14],[1539,393,16],[1723,391,18],
 [155,791,13],[333,790,19],[384,787,16],[553,1080,15],[1084,1056,18]];
function statuesInMist(){
 const shades=[[47,795,43,.53],[111,796,49,.60],[228,797,41,.59],[293,799,49,.66],[371,785,36,.51],[169,635,37,.45],[243,642,36,.47]];
 for(const [x,y,h,opacity] of shades){
  if(!visible(x,y-h/2,h))continue;
  ctx.save();ctx.globalAlpha=opacity;
  if(!sprite("sighShade",x,y-h*.5,h*.63,h)){
   const g=ctx.createLinearGradient(x,y-h,x,y+2);
   g.addColorStop(0,"#b2c2bb");g.addColorStop(.6,"#859696");g.addColorStop(1,"#7d929400");
   ellipse(x,y-h*.89,h*.104,h*.125,g,-.07);
   outline([[x-h*.15,y-h*.75],[x+h*.155,y-h*.72],[x+h*.225,y-h*.23],[x+h*.24,y],[x-h*.23,y]],g);
   line([[x-2,y-h*.50],[x+4,y-h*.15]],"#d4dcb353",.8);
  }
  ctx.restore();
  const t=(frameView.t*.42+x*.045)%1;
  if(t<.78){
   const bx=x+19*t,by=y-h*.85-10*t;
   ellipse(bx,by,9+6*t,2.2+3*t,rgba("#d7e0ce",.19*Math.sin(t/.78*Math.PI)));
  }
 }
}
function person(x,y,h,robe,id,prop,opacity=1){
 if(!visible(x,y-h*.45,h))return;
 ctx.save();ctx.globalAlpha=opacity;
 const key=prop==="sword"?"homer":"poet";
 if(assets[key]){
  ctx.save();ctx.translate(x,y-h*.5);
  if(id%2===0)ctx.scale(-1,1);
  ctx.filter=["none","hue-rotate(11deg) saturate(.77)","hue-rotate(-27deg) saturate(.73)","saturate(.57)"][id%4];
  sprite(key,0,0,h*.65,h);
  ctx.restore();
  if(prop==="sword"){
   line([[x+6,y-h*.52],[x+11,y-1]],"#dfd5b2",1.65);
   line([[x+3,y-h*.5],[x+11,y-h*.53]],"#efc989",1.5);
  }
  ctx.restore();return;
 }
 const face=["#ac967e","#baa086","#a58e7a","#ccb591"][id%4];
 ctx.translate(x,y);ctx.scale(h/48,h/48);
 ellipse(0,0,13,2,"#28313950");
 const g=ctx.createLinearGradient(-9,-42,8,-2);
 g.addColorStop(0,robe);g.addColorStop(1,colorBetween(robe,"#282b37",.57));
 outline([[-6,-32],[-2,-37],[6,-35],[10,-29],[8,-19],[12,-1],[-12,-1],[-8,-19]],g,rgba("#3f3a42",.85),.65);
 ellipse(0,-38,7.2,9.6,rgba(robe,.93),-.07);
 ellipse(1,-38,4.6,5.8,face,-.08);
 ellipse(1.9,-39.3,1.6,1.3,"#ecd2a2");
 line([[-5,-28],[-2,-18],[-8,-3]],rgba("#e6c7a4",.53),.68);
 line([[5,-26],[4,-16],[7,-3]],rgba("#e6c7a4",.34),.74);
 if(prop==="sword"){
  line([[9,-30],[14,-5],[16,-1]],"#c9c4a4",1.75);line([[4,-29],[13,-31]],"#e6c282",1.45);
 }else if(prop==="scroll"){
  fillRect(4,-20,9,5.5,"#d9c297");ellipse(12.5,-17,1.8,3.2,"#e5d1aa");
 }else if(prop==="laurel"){
  leaf(-7,-41,6,2,-.61,"#aab382");leaf(2,-45,6,2,.55,"#aab382");
 }else if(prop==="staff")line([[10,-22],[13,-3]],"#cdbd97",1.3);
 ctx.restore();
}
function fire(){
 const [x,y]=stage.fire,t=frameView.t;
 if(!visible(x,y-20,87))return;
 glow(x,y-18,66,"#ffe6a3",.34+.07*sine(t*2));
 const painted=sprite("limboFire",x,y-19-sine(t*7)*1.2,43,47+sine(t*8)*2.6);
 if(painted){
  for(let j=0;j<8;j++){
   const q=(t*(.5+j*.035)+j*.161)%1;
   ellipse(x+sine(q*6+j)*10+q*8,y-20-q*32,.9,1.5,rgba("#ffe7ad",1-q));
  }
  return;
 }
 ellipse(x,y+4,29,7,"#4e4a42");
 for(let i=0;i<7;i++){
  const a=i*1.9,px=x+Math.cos(a)*19,py=y+Math.sin(a)*4;
  ellipse(px,py,5.5,3.2,i%2?"#8a7460":"#6e6256",a*.19);
 }
 for(let j=0;j<3;j++){
  const h=29+j*9+sine(t*(4+j)+j)*6,w=14-j*3,offset=sine(t*(2+j)+j)*8;
  ctx.beginPath();ctx.moveTo(x-w,y);
  ctx.quadraticCurveTo(x-16+j*4,y-13,x+offset,y-h);
  ctx.quadraticCurveTo(x+15+offset,y-11,x+w,y);ctx.closePath();
  ctx.fillStyle=["#a75c54","#e39a68","#fbd691"][j];ctx.fill();
 }
 for(let j=0;j<7;j++){
  const q=(t*(.48+j*.03)+j*.161)%1;
  ellipse(x+sine(q*6+j)*10+q*8,y-16-q*38,1.0,1.55,rgba("#ffe7ad",1-q));
 }
}
function poets(){
 if(!visible(1230,757,148))return;
 person(1163,785,45,"#687c80",3,"staff",.94);
 person(1187,784,51,"#b38b72",0,"sword");
 person(1211,777,45,"#947e86",1,"scroll");
 person(1264,772,44,"#a5a17a",2,"laurel");
 person(1291,777,42,"#807d8b",3,"scroll");
 fire();
}
function crystal(x,y,h,seed){
 if(sprite("crystals",x,y-h*.56,h*1.06,h*1.25))return;
 const col=["#aacaba","#8fabb8","#beb0bd"][seed%3];
 for(let i=0;i<3;i++){
  const q=random(seed+i*41.2),X=x+i*6,Y=y-i*1.8,len=h*(.47+q*.64),dx=(q-.5)*13;
  outline([[X-4,Y],[X+dx-2,Y-len*.76],[X+dx+2,Y-len],[X+dx+5,Y-len*.65],[X+6,Y]],rgba(col,.66),rgba("#e1dbca",.48),.6);
  line([[X+1,Y-3],[X+dx+2,Y-len+1]],rgba("#e2ead3",.61),.75);
 }
}
function carvedRose(x,y,r,alpha=1){
 ctx.save();ctx.globalAlpha*=alpha;
 if(sprite("rose",x,y,r*3,r*3)){ctx.restore();return;}
 glow(x,y,r*2.3,"#ffbcb1",.48);
 for(let i=0;i<6;i++){
  const a=i*Math.PI/3;
  ellipse(x+Math.cos(a)*r*.43,y+Math.sin(a)*r*.43,r*.64,r*.36,i%2?"#dc7d90":"#ab566f",a);
 }
 ellipse(x,y,r*.24,r*.24,"#f0b28f");
 ctx.restore();
}
function caveChamber(){
 const {bounds:[x,y,w,h],mouth:[mx,my],relief:[rx,ry],rose:[sx,sy]}=stage.cave;
 if(frameView.x>x+w+20||frameView.x+VIEW_W<x-10||frameView.y>y+h||frameView.y+VIEW_H<y)return;
 const shape=[[x-4,y+27],[x+26,y+7],[x+85,y+9],[x+132,y-4],[x+188,y+7],[x+245,y+24],[x+w-26,y+46],[x+w,y+89],[x+w+4,y+h-43],[x+w-12,y+h-13],[x+31,y+h-11],[x+2,y+h-36]];
 const g=ctx.createLinearGradient(x,y,x+w,y+h);
 g.addColorStop(0,"#323040");g.addColorStop(.67,"#45455a");g.addColorStop(1,"#252e3b");
 outline(shape,g,"#2b2a37",3);
 ctx.save();ctx.clip();
 if(cave.reveal>.004){
  glow(rx,ry-12,108,"#b9b8cf",.41*cave.reveal);
  glow(sx+7,sy-2,53,"#e0bdcc",.44*cave.reveal);
  for(let i=0;i<6;i++){
   const X=rx-63+i*23;
   const active=i<5 || cave.relief===1;
   if(i===5&&active)glow(X,ry-24,20,"#f3ccac",.50);
   lightArch(X,ry-9,14,36,"#8f8295",active?"#5a5166":"#393642");
   if(active){
    ellipse(X,ry-28,3.0,4.0,"#d3baad",.11);
    outline([[X-3,ry-25],[X+3,ry-25],[X+6,ry-14],[X-6,ry-14]],i===5?"#d0a084":"#a892a5");
    if(i===0)line([[X+5,ry-25],[X+6,ry-12]],"#eed4a4",.9);
   }
  }
  sprite("caveRelief",rx-5,ry-24,155,55);
  crystal(x+45,y+h-33,25,2);crystal(x+222,y+h-33,20,9);crystal(x+258,y+h-33,18,7);
  if(!progress.rose)carvedRose(sx,sy,8.7,cave.reveal);
 }
 const shadow=ctx.createLinearGradient(x,y,x+w,y);
 shadow.addColorStop(0,rgba("#2d303e",1-cave.reveal));
 shadow.addColorStop(.83,rgba("#343b49",1-cave.reveal));
 shadow.addColorStop(1,rgba("#293b47",.39*(1-cave.reveal)));
 fillRect(x-10,y-12,w+25,h+15,shadow);
 ctx.restore();
 if(cave.reveal<.96){
  ctx.save();ctx.globalAlpha=1-cave.reveal;
  for(let i=0;i<17;i++){
   const dx=random(i+261)*w,dy=y+31+random(i+143)*110;
   line([[x+dx,dy],[x+dx+10,dy+3],[x+dx+20,dy]],"#65717860",.83);
  }
  const tint="#b9d9c8";
  line([[mx-5,my-29],[mx-10,my-14],[mx-12,my+13],[mx-17,my+21]],rgba(tint,.54),1.5);
  glow(mx-11,my+1,22,tint,.23);
  carvedRose(mx-21,my+3,4,.56);
  for(let i=0;i<5;i++){
   const step=(frameView.t*.82+i*.21)%1;
   ellipse(mx-13+step*11,my-30+step*67,1,2.1,rgba(tint,.68*Math.sin(step*Math.PI)));
  }
  ctx.restore();
 }
}

function streamDraw(){
 const {left,right,y}=stage.stream;
 if(frameView.x+VIEW_W<left-30||frameView.x>right+30||Math.abs(frameView.y+150-y)>190)return;
 const top=[[left-6,y+7],[left+14,y+6],[left+37,y+11],[left+79,y+13],[left+126,y+8],[left+177,y+8],[right+11,y+5]];
 const bank=[[right+8,y+15],[right-26,y+22],[left+117,y+20],[left+66,y+25],[left+15,y+18]];
 const g=ctx.createLinearGradient(0,y,0,y+24);
 g.addColorStop(0,"#ccdec394");g.addColorStop(.42,"#abd0b3b9");g.addColorStop(1,"#668f8dd6");
 outline([...top,...bank],g,rgba("#d9e3c5",.50),.7);
 ctx.save();ctx.clip();
 for(let i=0;i<15;i++){
  const q=(frameView.t*(.63+i*.027)+i*.172)%1;
  const x=left+q*(right-left+14)-7,py=y+9+i%5*2.8;
  line([[x,py],[x+5,py-1],[x+18,py]],rgba(i%3?"#e2ebcf":"#778f8b",.65*Math.sin(q*Math.PI)),.72);
 }
 ctx.restore();
 for(const [dx,dy,w] of [[12,15,8],[36,16,7],[66,16,10],[103,14,5],[142,11,9]]){
  const x=left+dx,yy=y+dy;
  ellipse(x,yy,w,2.6,rgba("#5f7569",.89),.075);ellipse(x-1,yy-1,w*.55,1.15,"#b9bf9b");
 }
}
const archY=[439,432,432,428,421,418,403];
function nobleCastle(){
 if(frameView.y+VIEW_H<295||frameView.y>454)return;
 const roman=["I","II","III","IV","V","VI","VII"];
 for(let i=0;i<stage.arches.length;i++){
  const x=stage.arches[i],y=archY[i],w=38+i%3*4,h=102-i%2*12;
  if(!visible(x,y-h*.51,69))continue;
  const entered=progress.arches.has(i),p=palettes.castle;
  const back=ctx.createLinearGradient(x-30,y-h,x+40,y+4);
  back.addColorStop(0,"#5d5961");back.addColorStop(1,"#897762");
  pave(x-31,y-h-11,65,h+12,back,"#746859");
  for(let s=0;s<6;s++){
   const X=x-32+s*11;
   pave(X,y-h-19-s%2*3,7,10+s%2*3,"#82735f","#a28c6d");
  }
  for(let row=0;row<9;row++){
   const Y=y-2-row*10.8;
   line([[x-31,Y],[x+33,Y]],"#dcc7a22e",.73);
   for(let j=0;j<4;j++){
    const X=x-25+j*16+row%2*7;
    line([[X,Y],[X,Y-7]],"#403b4542",.8);
   }
  }
  lightArch(x,y,w,h-11,entered?"#c3a479":"#a3987b",entered?"#415052":"#54545c");
  arch(x+3,y,w*.68,h-22,"#707c70","#afab82",.7);
  sprite("castleArch",x,y-h*.40,h*.69,h*.80);
  pave(x-10,y-h+1,20,13,entered?"#c5ad7d":"#816e62","#463d45");
  ctx.fillStyle=entered?"#302d34":"#ead2a8";ctx.font="8px Georgia";ctx.textAlign="center";ctx.fillText(roman[i],x,y-h+10.5);
  if(entered)glow(x,y-h+9,16,"#f3d19a",.24);
  line([[x-28,y],[x+28,y]],p.rim,1.5);
 }
}
function leverAndGate(){
 for(const {id,x,y} of stage.switches){
  if(!visible(x,y,42))continue;
  const hit=progress.marks.get(id),on=hit!==undefined;
  ctx.save();ctx.translate(x,y+3);
  if(on){glow(0,-13,23,id==="mist"?"#c4f3d6":"#ffdd89",.49);ctx.scale(-1,1);}
  if(!sprite("lever",0,0,26,29)){
   ellipse(0,12,14,4,"#3f4246");line([[-7,9],[6,-9]],"#bc9667",4);
  }
  ctx.restore();
  if(on&&now-hit<.3)glow(x,y,17,"#e4eeac",(1-(now-hit)/.3)*.34);
 }
 const g=stage.port;
 if(!visible(g.x,(g.top+g.bottom)/2,65))return;
 const bottom=g.bottom-g.travel*ease(progress.gate),height=bottom-g.top;
 pave(g.x-15,g.top-7,30,10,"#a0856c","#e4bf8c");
 if(!sprite("portcullis",g.x,g.top+height*.5,16,height)){
  for(let j=-2;j<=2;j++){
   const X=g.x+j*3.3;
   line([[X,g.top],[X,bottom-5]],"#504551",2.8);line([[X+.5,g.top],[X+.5,bottom-5]],"#ab9085",.74);
   outline([[X-1.4,bottom-5],[X+1.4,bottom-5],[X,bottom]],"#604e57");
  }
  for(let Y=g.top+6;Y<bottom-4;Y+=14)line([[g.x-8,Y],[g.x+8,Y]],"#776364",1.55);
 }
}
function meadowGathering(){
 const x=1532,y=392;
 if(!visible(x,y-54,110))return;
 glow(x,y-77,93,"#eff0a3",.24);
 paver(x,y);
 person(1477,400,32,"#7c8b81",1,"scroll");
 person(1501,391,34,"#9c977f",2,"laurel");
 person(1532,387,44,"#b59f7e",0,"scroll");
 person(1560,394,34,"#858476",3,"scroll");
 person(1586,400,31,"#998685",1,"staff");
}
function paver(x,y){
 ellipse(x,y+2,43,5,"#66735a");pave(x-23,y-8,46,7,"#8e9277","#bec28b");
 pave(x-15,y-14,30,6,"#a5a27c","#c8c392");
}
function springPlants(){
 for(const [x,y] of stage.pads){
  if(!visible(x,y+29,51))continue;
  const bend=spring.x===x?spring.bend*13:0,t=frameView.t;
  const drift=sine(t*1.45)*3.4;
  ctx.beginPath();ctx.moveTo(x-24,y+68);
  ctx.quadraticCurveTo(x-17,y+34,x+drift,y+bend+7);
  ctx.quadraticCurveTo(x+8,y+35,x+17,y+63);
  ctx.strokeStyle="#4b6553";ctx.lineWidth=7.5;ctx.stroke();
  leaf(x-15,y+51,25,5.7,-2.52,"#79976b","#c3c3908c");leaf(x+9,y+42,24,5,-.7,"#657e54","#d4cf8d8c");
  if(sprite("springPlant",x+drift,y+bend+19,92,49))continue;
  glow(x,y+bend+8,36,"#f5ba99",.20);
  for(let j=-3;j<=3;j++){
   const X=x+j*12, Y=y+bend+8+Math.abs(j)*1.6;
   ellipse(X,Y,16,6.5,j%2?"#c27676":"#ab5d70",j*.13);
   ellipse(X,Y-2.4,11,3.8,"#e59c82",j*.09);
  }
  ellipse(x,y+bend+4,24,5.5,"#e6a380");ellipse(x,y+bend+4,12,3.2,"#f4c691");
 }
}
function endArch(){
 const [x,y]=stage.exit;
 if(!visible(x,y-38,95))return;
 const floor=y+37;
 const g=ctx.createLinearGradient(x,floor-117,x,floor);
 g.addColorStop(0,"#514b58");g.addColorStop(1,"#292735");
 arch(x,floor,88,113,g,"#716e76",2.4);
 for(let i=0;i<6;i++)line([[x-42,floor-14-i*12],[x-24,floor-12-i*12]],"#9a90905c",.8);
 if(sprite("exit",x,floor-54,81,112))return;
 lightArch(x,floor,47,91,"#77717b","#1c2230");
 arch(x,floor,35,82,"#252633","#383842",.95);
 line([[x-21,floor-4],[x-19,floor-60]],"#b6a48d5e",1);
}
function waymarks(){
 const marks=[[535,637,-1],[1172,699,1],[852,609,1],[941,599,-1],[1595,736,1],[1735,870,-1],[732,585,1]];
 for(const [x,y,dir] of marks){
  if(!visible(x,y,35))continue;
  ctx.save();ctx.translate(x,y);
  line([[-dir*5,-5],[dir*3,1],[dir*8,9]],"#eddeaa92",1.05);
  line([[dir*1,7],[dir*8,9],[dir*7,2]],"#eddeaa92",1.05);ctx.restore();
 }
}

function liftShaft(tracks){
 const shaft=stage.lift;
 if(frameView.x+VIEW_W<shaft.x-50||frameView.x>shaft.x+50||frameView.y+VIEW_H<shaft.top||frameView.y>shaft.bottom+20)return;
 if(tracks){
  for(const dx of [-shaft.width*.38,shaft.width*.38]){
   line([[shaft.x+dx,shaft.top-25],[shaft.x+dx,shaft.bottom+25]],"#4f4b59a3",3.0);
   line([[shaft.x+dx+.9,shaft.top-25],[shaft.x+dx+.9,shaft.bottom+25]],"#b79a7478",.8);
  }
  return;
 }
 if(!visible(shaft.x,lift.y,49))return;
 const half=shaft.width*.5,x=shaft.x,y=lift.y;
 outline([[x-half-4,y+1],[x-half,y-2],[x+half,y-2],[x+half+4,y+1],[x+half-1,y+11],[x-half+1,y+11]],"#64545d","#3e3b49",.9);
 line([[x-half,y],[x+half,y]],"#d3ae79",2.25);
 for(let i=-2;i<=2;i++){
  ellipse(x+i*12,y+5,2,2,"#be936e");ellipse(x+i*12,y+5,1,1,"#e3c493");
 }
}

function eggShape(x,y,scale=1,turn=.12,secret=false){
 ctx.save();ctx.translate(x,y);ctx.rotate(turn);ctx.scale(scale,scale);
 if(!sprite("egg",0,0,18,23)){
  const yellow=secret?"#eff3ba":"#ffedac",gold=secret?"#96bcaa":"#edbb68",low=secret?"#608f8e":"#a96550";
  const g=ctx.createLinearGradient(-6,-10,8,9);
  g.addColorStop(0,yellow);g.addColorStop(.57,gold);g.addColorStop(1,low);
  ctx.beginPath();ctx.moveTo(0,-11);
  ctx.bezierCurveTo(-4.8,-11,-8.6,-3.2,-8.3,3.2);
  ctx.bezierCurveTo(-7.7,11,8.1,11,8.3,3.2);ctx.bezierCurveTo(8.6,-3.2,4.5,-11,0,-11);
  ctx.fillStyle=g;ctx.fill();ctx.lineWidth=.62;ctx.strokeStyle=secret?"#577a76":"#98654a";ctx.stroke();
  ellipse(-2.3,-4.8,2.1,3.7,"#fffceb96",.47);
  ellipse(4,2.3,1.15,1.15,secret?"#dcdf9c":"#ffdc80");
 }
 ctx.restore();
}
function drawEggs(){
 const t=frameView.t;
 for(const item of eggs){
  if(!visible(item.x,item.y,28))continue;
  if(item.kind==="secret"&&cave.reveal<.04)continue;
  const hidden=item.kind==="secret",q=sine(t*2.15+item.id*.37),y=item.y+q*2.7;
  if(!item.taken){
   ctx.save();
   if(hidden)ctx.globalAlpha=cave.reveal;
   glow(item.x,y,18,hidden?"#ceeac1":"#ffe6a0",.23+q*.05);
   eggShape(item.x,y,1,.06+q*.14,hidden);
   if(q>.63)flare(item.x+8,y-6,3.1,rgba("#fff2be",(q-.63)*2.35),.25);
   ctx.restore();
  }else{
   const age=now-item.pickup;
   if(age<0||age>.25)continue;
   const e=age/.25,r=6+e*18;
   ctx.save();ctx.globalAlpha=(1-e)*(1-e);
   ctx.strokeStyle=hidden?"#d3efe0":"#fff0ae";ctx.lineWidth=1.35*(1-e)+.42;
   ctx.beginPath();ctx.arc(item.x,item.y-age*10,r,0,Math.PI*2);ctx.stroke();
   eggShape(item.x,item.y-age*42,1+e*.66,e*.5,hidden);
   ctx.restore();
  }
 }
}
function drawParticles(){
 for(const part of fx){
  if(!visible(part.x,part.y,11))continue;
  const t=part.time/part.life,alpha=(1-t)*(t<.12?t/.12:1);
  if(part.kind==="star"){
   const r=(3.5+Math.sin(t*Math.PI)*4.3)*(1-t*.70);
   ctx.save();ctx.globalAlpha=alpha;
   if(!sprite("eggSpark",part.x,part.y,r*2,r*2)){
    flare(part.x,part.y,r,part.color,part.angle+t*2.4);
    ellipse(part.x,part.y,r*.20,r*.20,"#fff9dc");
   }
   ctx.restore();
  }else if(part.kind==="water"){
   ellipse(part.x,part.y,1.3,2.3,rgba(part.color,alpha),clamp(part.vx*.017,-.8,.8));
  }else{
   ellipse(part.x,part.y,part.kind==="flake"?1.1:2.0,part.kind==="flake"?1.5:1.1,rgba(part.color,alpha),part.angle);
  }
 }
}
function drawBall(alpha){
 if(phase==="clear")return;
 const x=mix(previous.x,ball.x,alpha),y=mix(previous.y,ball.y,alpha);
 const rot=mix(previous.rotation,ball.rotation,alpha);
 const compress=clamp(mix(previous.squash,ball.squash,alpha)+clamp(-ball.vy/2200,-.14,.14),-.38,.37);
 const face=ball.face,t=frameView.t;
 if(ball.ground)ellipse(x,y+17,19,4,"#28313575",ball.tilt);
 ctx.save();ctx.translate(x,y-(ball.ground?compress*6:0));ctx.rotate(ball.tilt*.64);
 const shrink=phase==="exit"?1-ease(departure.t)*.49:1;
 if(phase==="exit")ctx.globalAlpha=1-ease(departure.t);
 ctx.scale((1-compress*.76)*shrink,(1+compress)*shrink);
 if(assets.ball){
  ctx.save();ctx.rotate(Math.sin(rot)*.055);
  if(face<-.04)ctx.scale(-1,1);
  sprite("ball",0,0,40.6,41.8);ctx.restore();ctx.restore();return;
 }
 const body=ctx.createRadialGradient(-5,-7,3,3,5,24);
 body.addColorStop(0,"#ff8064");body.addColorStop(.40,"#f4513e");body.addColorStop(.77,"#d73742");body.addColorStop(1,"#88364b");
 ellipse(0,0,20.2,20.1,"#572f43");
 ellipse(0,0,19.1,18.85,body);
 ctx.save();ctx.beginPath();ctx.ellipse(0,0,18.8,18.5,0,0,Math.PI*2);ctx.clip();
 ctx.rotate(rot);
 for(const [xx,yy,s,a] of [[11,12,4.7,.32],[-14,7,3.4,1.46],[8,-15,3.7,2.1],[-3,-17,2.4,.7]]){
  ellipse(xx,yy,s,1.3,"#ff9e8b88",a);
 }
 ctx.restore();
 ellipse(-7,-10,6.05,2.65,"#ffe6c8ad",-.40);
 const look=clamp(face*.64+ball.vx/500,-1,1),blink=t%4.35>4.23;
 const jolt=clamp(ball.vy/600,-1,1),eyeLift=blink?.72:5.1+Math.abs(jolt)*1.05;
 for(const ox of [-5.4,4.4]){
  const cx=ox+look*2.45,cy=-1.7+jolt*.83;
  ellipse(cx,cy,4.15,eyeLift,"#fff4d2",-.05);
  if(!blink){
   ellipse(cx+look*1.50,cy+.2+jolt*.71,1.95,2.8,"#413442");
   ellipse(cx+look*1.48-.47,cy-1.02, .55,.65,"#fff4dd");
  }
 }
 ctx.beginPath();
 ctx.moveTo(look*2.6-3.5,6.55);
 ctx.quadraticCurveTo(look*2.6+.4,10.2+jolt*.6,look*2.6+4.0,6.35);
 ctx.strokeStyle="#7d3943";ctx.lineWidth=1.22;ctx.stroke();
 ctx.restore();
}
function textWithShadow(str,x,y,style,alpha=1,align="center"){
 if(!str||alpha<=0)return;
 ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle="#fff4d2";ctx.textAlign=align;ctx.font=style;
 ctx.shadowColor="#2d293a";ctx.shadowBlur=5.5;ctx.fillText(str,x,y);ctx.restore();
}
function hud(){
 const fade=ctx.createLinearGradient(0,0,0,68);
 fade.addColorStop(0,"#28343e66");fade.addColorStop(1,"#28343e00");fillRect(0,0,VIEW_W,68,fade);
 const s=.72+Math.sin(pop*Math.PI*.75)*.17;
 eggShape(13,14,s,.24);
 textWithShadow(String(progress.count),24,19,"14px Georgia",1,"left");
 for(let i=0;i<stage.switches.length;i++){
  const on=progress.marks.has(stage.switches[i].id);
  const x=53+i*13,y=14;
  ellipse(x,y,4.2,4.2,on?(i===0?"#afdbc1":"#fbd184"):"#5c575f");
  if(on)flare(x,y,2.8,"#fff6d0");
 }
 if(progress.rose)carvedRose(83,13.6,4.8,.9);
 if(phase==="clear"){
  const glass=ctx.createLinearGradient(0,79,0,212);
  glass.addColorStop(0,"#212b3700");glass.addColorStop(.45,"#212b37d4");glass.addColorStop(1,"#212b3700");fillRect(0,79,VIEW_W,133,glass);
  textWithShadow("Limbo cleared",120,134,"24px Georgia");
  textWithShadow(progress.count+" / "+goalCount+" eggs",120,156,"12px Georgia",.95);
  textWithShadow("Jump to replay",120,174,"10px Georgia",.83);
 }else if(sceneTitle.t>0){
  const opacity=clamp(sceneTitle.t/.67,0,1);
  textWithShadow(sceneTitle.title,VIEW_W/2,51,sceneTitle.title==="Limbo"?"29px Georgia":"18px Georgia",opacity);
  textWithShadow(sceneTitle.sub,VIEW_W/2,67,"10px Georgia",opacity*.85);
 }
}
function draw(alpha){
 frameView={x:mix(previous.cameraX,cam.x,alpha),y:mix(previous.cameraY,cam.y,alpha),t:Math.max(0,now-(1-alpha)*DT)};
 ctx.setTransform(canvas.width/VIEW_W,0,0,canvas.height/VIEW_H,0,0);
 scenery();ctx.save();ctx.translate(-frameView.x,-frameView.y);
 liftShaft(true);statuesInMist();caveChamber();
 for(const args of groves)willow(...args);
 nobleCastle();endArch();terrain();streamDraw();liftShaft(false);
 for(const args of ferns)littleFern(...args);
 poets();meadowGathering();leverAndGate();springPlants();
 for(const [x,y] of stage.checkpoints){
  if(!visible(x,y,34))continue;
  const lit=checkpoint[0]===x&&checkpoint[1]===y;
  glow(x,y,lit?18:12,"#fcdaa5",lit?.48:.21);
  strokeCheckpoint(x,y,lit);
 }
 waymarks();drawEggs();drawParticles();mist();drawBall(alpha);ctx.restore();
 const vignette=ctx.createRadialGradient(VIEW_W*.51,VIEW_H*.43,VIEW_W*.26,VIEW_W*.52,VIEW_H*.43,VIEW_H*.61);
 vignette.addColorStop(0,"#28323c00");vignette.addColorStop(1,"#2d26364e");fillRect(0,0,VIEW_W,VIEW_H,vignette);
 if(bloom>0)fillRect(0,0,VIEW_W,VIEW_H,rgba("#fff2ca",bloom*.09));
 hud();
}
function strokeCheckpoint(x,y,lit){
 line([[x,y-8],[x,y+24]],"#817464",1.45);
 outline([[x,y-8],[x+4,y-2],[x+2,y+4],[x-3,y+4],[x-4,y-2]],lit?"#f4dfa9":"#b5aa88","#e4c7a283",.7);
}
const controlKeys=new Set(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space","KeyA","KeyD","KeyW","KeyR","Enter"]);
window.addEventListener("keydown",event=>{
 if(!controlKeys.has(event.code)||event.altKey||event.ctrlKey||event.metaKey)return;
 if(event.target.tagName==="BUTTON"&&(event.code==="Space"||event.code==="Enter"))return;
 event.preventDefault();wakeAudio();
 if(!event.repeat&&(event.code==="KeyR"||phase==="clear"&&(event.code==="Space"||event.code==="Enter"))){
  keys.clear();reset();return;
 }
 keys.add(event.code);
});
window.addEventListener("keyup",event=>keys.delete(event.code));
window.addEventListener("blur",()=>keys.clear());
document.addEventListener("visibilitychange",()=>{if(document.hidden)keys.clear();});
for(const control of document.querySelectorAll("[data-key]")){
 const key=control.dataset.key;
 control.addEventListener("pointerdown",event=>{
  event.preventDefault();wakeAudio();control.setPointerCapture(event.pointerId);
  if(phase==="clear"&&key==="Space"){keys.clear();reset();return;}
  keys.add(key);
 });
 for(const event of ["pointerup","pointercancel","lostpointercapture"])control.addEventListener(event,()=>keys.delete(key));
}
$("restart").addEventListener("click",()=>{keys.clear();reset();canvas.focus();});
canvas.addEventListener("pointerdown",()=>{canvas.focus();wakeAudio();});
let previousTime=0,carry=0;
function frame(ms){
 if(previousTime)carry+=Math.min(.05,(ms-previousTime)/1000);
 previousTime=ms;
 while(carry>=DT){tick(DT);carry-=DT;}
 draw(carry/DT);requestAnimationFrame(frame);
}
reset();
$("location").textContent="I · Limbo";
requestAnimationFrame(frame);
