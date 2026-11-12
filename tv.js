'use strict';
/* Pixel Gridiron Network: the TV. Draws the broadcast for whatever slot the clock is in. */

/* ============================== RUNDOWN ============================== */
const ADS=['fizz','truck','pizza','insure','wings','promo'];
const BC=new Map();
function pregameBoards(w,slot){
  if(w<REGW)return slot%2?[`conf${slot%5}`,'recruit']:['scores','top25'];
  if(w===12)return slot<5?['scores','top25']:['bracket','scores'];
  if(w===13)return ['bracket','scores'];
  return ['signing','portal'];
}
function broadcast(slotG){
  if(BC.has(slotG))return BC.get(slotG);
  const S=Math.floor(slotG/SPS),inS=slotG-S*SPS,w=Math.floor(inS/12),slot=inS%12;
  let g=airedGame(S,w,slot);
  if(!g)g=classics(Math.max(0,S-1))[slot];
  const res=simulate(g),r=mulberry32(hashN('bc',slotG));
  const ads=shuffle(ADS.slice(),r);
  const h1=pickHighlights(res.halves[0],2),h2=pickHighlights(res.halves[1],2,h1);
  const [b1,b2]=pregameBoards(w,slot);
  const segs=[
    {type:'studio',t0:0,t1:45},{type:'board',kind:b1,t0:45,t1:75},{type:'board',kind:b2,t0:75,t1:105},{type:'matchup',t0:105,t1:120},
    {type:'game',half:1,t0:120,t1:840},{type:'board',kind:'half',t0:840,t1:885},
    {type:'replay',play:h1[0],label:'FIRST HALF TOP PLAYS',t0:885,t1:900},{type:'replay',play:h1[1]||h1[0],label:'FIRST HALF TOP PLAYS',t0:900,t1:915},
    {type:'ad',ad:ads[0],t0:915,t1:930},{type:'ad',ad:ads[1],t0:930,t1:945},{type:'ad',ad:ads[2],t0:945,t1:960},
    {type:'game',half:2,t0:960,t1:1680},{type:'board',kind:'final',t0:1680,t1:1725},
    {type:'replay',play:h2[0]||h1[0],label:'GAME HIGHLIGHTS',t0:1725,t1:1740},{type:'replay',play:h2[1]||h2[0]||h1[0],label:'GAME HIGHLIGHTS',t0:1740,t1:1755},
    {type:'ad',ad:ads[3],t0:1755,t1:1770},{type:'ad',ad:ads[4],t0:1770,t1:1785},{type:'ad',ad:ads[5],t0:1785,t1:1800},
  ];
  segs.forEach((s,i)=>s.i=i);
  const B={slotG,S,w,slot,inS,g,res,segs,n0:Math.min(inS,SPS)};
  B.lines=studioLines(B,r);
  BC.set(slotG,B);if(BC.size>6)BC.delete(BC.keys().next().value);
  return B;
}
function pickHighlights(list,n,exclude=[]){
  const sc=p=>(p.td?50:0)+(p.kind==='int'?32:0)+(p.kind==='fumble'?22:0)+(p.kind==='fg'&&p.dist>=45&&p.good?24:0)+(p.safety?40:0)+Math.max(0,p.gain||0);
  return list.filter(p=>!['qend','pat','kneel','two'].includes(p.kind)&&!exclude.includes(p)).map(p=>({p,s:sc(p)})).sort((a,b)=>b.s-a.s||a.p.ln-b.p.ln).slice(0,n).map(o=>o.p).sort((a,b)=>a.ln-b.ln);
}
function rankOf(S,n,t){const i=poll(S,n).indexOf(t);return i<25?i+1:0;}
function teamTag(S,n,t){const k=rankOf(S,n,t);return (k?`NO. ${k} `:'')+TEAMS[t].name.toUpperCase();}
function fmtNum(n){return n>=1000?Math.floor(n/1000)+','+String(n%1000).padStart(3,'0'):String(n);}
function studioLines(B,r){
  const g=B.g,S=g.S,H=TEAMS[g.home],A=TEAMS[g.away],n=B.n0,cH=teamCtx(S,g.home),cA=teamCtx(S,g.away);
  const v=g.neutral?'VS':'AT',L=[];
  if(g.kind==='classic'){
    L.push(`WELCOME TO PGN CLASSICS. SIGNING DAY IS DONE AND THE PORTAL IS BUZZING.`);
    L.push(`TODAY'S REPLAY: ${A.name.toUpperCase()} ${v} ${H.name.toUpperCase()}, ${g.origTitle} OF ${seasonYear(S)}.`);
    L.push(`ONE OF THE BEST GAMES OF THE YEAR. NO SPOILERS, WATCH IT LIKE IT'S LIVE.`);
    const top=classRankings(S,IDX_SIGN+1)[0];L.push(`SIGNING DAY WINNER: ${TEAMS[top.t].name.toUpperCase()} WITH ${top.n} SIGNEES AND ${top.s5} FIVE-STARS.`);
    L.push(`SEASON ${seasonYear(S+1)} KICKS OFF RIGHT AFTER CLASSICS WEEK.`);
    return L;
  }
  const kindIntro={reg:`WELCOME TO PGN GAMEDAY. WEEK ${g.w+1}, GAME ${g.slot+1} OF 12 ON THE NETWORK.`,ccg:`IT'S CHAMPIONSHIP WEEK! THE ${g.title} IS ON THE LINE.`,
    cfp1:`THE PLAYOFF IS HERE. FIRST ROUND, ON CAMPUS, LOSER GOES HOME.`,qf:`PLAYOFF QUARTERFINAL: THE ${g.title}.`,sf:`PLAYOFF SEMIFINAL: THE ${g.title}. WINNER PLAYS FOR IT ALL.`,
    final:`THIS IS IT. THE NATIONAL CHAMPIONSHIP, SEASON ${seasonYear(S)}.`,bowl:`WELCOME TO THE ${g.title}! BOWL SEASON ROLLS ON.`};
  L.push(kindIntro[g.kind]||kindIntro.reg);
  L.push(`${teamTag(S,n,g.away)} (${recStr(S,n,g.away)}) ${v} ${teamTag(S,n,g.home)} (${recStr(S,n,g.home)}).`);
  const diff=cH.ovr+(g.neutral?0:1.5)-cA.ovr,fav=diff>=0?H:A,spread=Math.max(1,Math.round(Math.abs(diff)*2.4*2)/2);
  L.push(`THE LINE: ${fav.abbr} BY ${spread}. THE ${fav.mascot.toUpperCase()} HAVE THE EDGE UP FRONT.`);
  const pick=r()<0.5?g.home:g.away,c=teamCtx(S,pick),qb=c.by.QB[0];
  if(n>g.w*12&&g.w>0){const st=seasonStats(S,pick,n).get(qb.id);
    if(st&&st.att)L.push(`${TEAMS[pick].abbr} QB ${qb.f.toUpperCase()} ${qb.l.toUpperCase()}: ${fmtNum(st.pyd)} YDS, ${st.ptd} TD, ${st.int} INT THIS SEASON.`);
    else L.push(`KEEP AN EYE ON ${TEAMS[pick].abbr} QB ${qb.f.toUpperCase()} ${qb.l.toUpperCase()}.`);}
  else L.push(`${TEAMS[pick].abbr} QB ${qb.f.toUpperCase()} ${qb.l.toUpperCase()} IS A ${classLabel(qb)} FROM ${qb.city.toUpperCase()}, ${qb.st}.`);
  const cr=classRankings(S,B.inS),ri=cr.findIndex(x=>x.t===g.home);
  L.push(cr[ri].n?`RECRUITING: ${H.abbr} HAS THE NO. ${ri+1} CLASS IN THE COUNTRY WITH ${cr[ri].n} COMMITS.`:`${H.abbr} IS STILL WAITING ON ITS FIRST COMMIT FOR NEXT YEAR'S CLASS.`);
  return L;
}

/* ============================== CANVAS + FONT ============================== */
const W=320,H=180;
const cv=document.getElementById('c'),ctx=cv.getContext('2d',{willReadFrequently:true});
ctx.imageSmoothingEnabled=false;
const GSRC={A:'.#.|#.#|###|#.#|#.#',B:'##.|#.#|##.|#.#|##.',C:'.##|#..|#..|#..|.##',D:'##.|#.#|#.#|#.#|##.',E:'###|#..|##.|#..|###',F:'###|#..|##.|#..|#..',
G:'.##|#..|#.#|#.#|.##',H:'#.#|#.#|###|#.#|#.#',I:'###|.#.|.#.|.#.|###',J:'..#|..#|..#|#.#|.#.',K:'#.#|#.#|##.|#.#|#.#',L:'#..|#..|#..|#..|###',
M:'#.#|###|###|#.#|#.#',N:'##.|#.#|#.#|#.#|#.#',O:'.#.|#.#|#.#|#.#|.#.',P:'##.|#.#|##.|#..|#..',Q:'.#.|#.#|#.#|##.|.##',R:'##.|#.#|##.|#.#|#.#',
S:'.##|#..|.#.|..#|##.',T:'###|.#.|.#.|.#.|.#.',U:'#.#|#.#|#.#|#.#|###',V:'#.#|#.#|#.#|#.#|.#.',W:'#.#|#.#|###|###|#.#',X:'#.#|#.#|.#.|#.#|#.#',
Y:'#.#|#.#|.#.|.#.|.#.',Z:'###|..#|.#.|#..|###',0:'###|#.#|#.#|#.#|###',1:'.#.|##.|.#.|.#.|###',2:'##.|..#|.#.|#..|###',3:'###|..#|.##|..#|###',
4:'#.#|#.#|###|..#|..#',5:'###|#..|##.|..#|##.',6:'.##|#..|###|#.#|###',7:'###|..#|.#.|.#.|.#.',8:'###|#.#|###|#.#|###',9:'###|#.#|###|..#|##.',
' ':'...|...|...|...|...','.':'...|...|...|...|.#.',',':'...|...|...|.#.|#..',':':'...|.#.|...|.#.|...','-':'...|...|###|...|...','/':'..#|..#|.#.|#..|#..',
'!':'.#.|.#.|.#.|...|.#.','?':'##.|..#|.#.|...|.#.',"'":'.#.|.#.|...|...|...','#':'#.#|###|#.#|###|#.#','&':'.#.|#.#|.#.|#.#|.##','(':'.#.|#..|#..|#..|.#.',
')':'.#.|..#|..#|..#|.#.','+':'...|.#.|###|.#.|...','%':'#.#|..#|.#.|#..|#.#','>':'#..|.#.|..#|.#.|#..','<':'..#|.#.|#..|.#.|..#','*':'.#.|###|.#.|#.#|...',
'$':'.##|##.|.#.|.##|##.','·':'...|...|.#.|...|...','=':'...|###|...|###|...','"':'#.#|#.#|...|...|...','…':'...|...|...|...|#.#','★':'.#.|###|.#.|#.#|...'};
const GL={};for(const k in GSRC){GL[k]=[...GSRC[k].replace(/\|/g,'')].map(c=>c==='#');}
const tw=(s,sc=1)=>Math.max(0,[...String(s)].length*4*sc-sc);
function txtOn(c,s,x,y,col,sc=1,align='l'){
  s=String(s).toUpperCase().replace(/\s/g,' ');const w=tw(s,sc);
  if(align==='c')x-=Math.floor(w/2);else if(align==='r')x-=w;
  x=Math.round(x);y=Math.round(y);c.fillStyle=col;
  for(const ch of s){const g=GL[ch]||GL['?'];for(let i=0;i<15;i++)if(g[i])c.fillRect(x+(i%3)*sc,y+((i/3)|0)*sc,sc,sc);x+=4*sc;}
}
const txt=(s,x,y,col,sc,align)=>txtOn(ctx,s,x,y,col,sc,align);
function txtS(s,x,y,col,sc=1,align='l',sh='#000'){txt(s,x+sc,y+sc,sh,sc,align);txt(s,x,y,col,sc,align);}
function fit(s,max){s=String(s);return s.length>max?s.slice(0,max-1)+'…':s;}
function wrap(s,max){const out=[];let line='';for(const w of s.split(' ')){if((line+' '+w).trim().length>max){out.push(line);line=w;}else line=(line+' '+w).trim();}if(line)out.push(line);return out;}
const rect=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
function disc(cx,cy,rad,c,c2=ctx){c2.fillStyle=c;for(let y=-rad;y<=rad;y++){const w=Math.floor(Math.sqrt(rad*rad-y*y));c2.fillRect(Math.round(cx-w),Math.round(cy+y),2*w+1,1);}}
function line(x0,y0,x1,y1,c){x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);ctx.fillStyle=c;const dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let e=dx+dy;for(let k=0;k<600;k++){ctx.fillRect(x0,y0,1,1);if(x0===x1&&y0===y1)break;const e2=2*e;if(e2>=dy){e+=dy;x0+=sx;}if(e2<=dx){e+=dx;y0+=sy;}}}

/* ============================== FIELD ============================== */
const PX=6,SH=0.6,VY=2.35,FY0=14;
const syOf=Y=>FY0+(Y+29)*VY;
let cam=50;
const sxOf=(X,Y)=>160+(X-cam)*PX+Y*SH;
const FIELD_W=(130*PX)+60,FIELD_H=Math.ceil(57*VY)+2;
const fieldCache=new Map();
function fieldCanvas(home){
  if(fieldCache.has(home))return fieldCache.get(home);
  const T=TEAMS[home],c=document.createElement('canvas');c.width=FIELD_W;c.height=FIELD_H;const f=c.getContext('2d');
  const fx=(X,Y)=>(X+15)*PX+30+Y*SH,fy=Y=>(Y+29)*VY;
  f.fillStyle='#2d6a2f';f.fillRect(0,0,FIELD_W,FIELD_H);
  for(let py=0;py<FIELD_H;py++){
    const Y=py/VY-29;if(Y<-26.65||Y>26.65)continue;
    for(let X=-10;X<110;X+=5){const x0=Math.round(fx(X,Y)),x1=Math.round(fx(X+5,Y));f.fillStyle=X<0||X>=100?T.c1:(Math.floor(X/5)%2?'#3f8f3c':'#469c42');f.fillRect(x0,py,x1-x0,1);}
    f.fillStyle='#f4f4ee';for(let X=0;X<=100;X+=5)f.fillRect(Math.round(fx(X,Y)),py,X===0||X===100?2:1,1);
    f.fillRect(Math.round(fx(-10,Y)),py,1,1);f.fillRect(Math.round(fx(110,Y))-1,py,1,1);
  }
  f.fillStyle='#f4f4ee';
  for(const Ys of [-26.65,26.65]){const py=Math.round(fy(Ys));f.fillRect(Math.round(fx(-10,Ys)),py,Math.round(fx(110,Ys)-fx(-10,Ys)),1);}
  for(let X=1;X<100;X++){if(X%5===0)continue;for(const Yh of [-6.65,6.65,-25.6,25.6])f.fillRect(Math.round(fx(X,Yh)),Math.round(fy(Yh)),1,2);}
  for(let X=10;X<=90;X+=10){const n=X<=50?X:100-X;for(const Yn of [-20,17.5])txtOn(f,String(n),fx(X,Yn)-1,fy(Yn),'#f4f4ee',2,'c');}
  for(let dy=-9;dy<=9;dy++)for(let dx=-17;dx<=17;dx++){const d=(dx/17)**2+(dy/9)**2;if(d>1)continue;f.fillStyle=d>0.72?T.c2:T.c1;f.fillRect(Math.round(fx(50,0)+dx+dy*SH/VY),Math.round(fy(0)+dy),1,1);}
  txtOn(f,T.abbr,fx(50,0),fy(0)-4,lum(T.c1)>0.6?'#111':'#fff',2,'c');
  const nm=T.name.toUpperCase();
  for(const [Xc,flip] of [[-5,1],[105,-1]]){
    const sc=2,len=nm.length*4*sc,ystart=fy(0)-len/2;
    for(let k=0;k<nm.length;k++){const g=GL[nm[k]]||GL['?'];for(let i=0;i<15;i++){if(!g[i])continue;const gx=i%3,gy=(i/3)|0;
      const ox=flip>0?(4-gy):gy,oy=flip>0?gx:(2-gx),pyy=ystart+(flip>0?k:nm.length-1-k)*4*sc+oy*sc,Y=pyy/VY-29;
      f.fillStyle=T.c2;f.fillRect(Math.round(fx(Xc,Y)-5+ox*sc),Math.round(pyy),sc,sc);}}
  }
  fieldCache.set(home,c);if(fieldCache.size>4)fieldCache.delete(fieldCache.keys().next().value);
  return c;
}
let excite=0;
function drawStands(B,t){
  rect(0,0,W,FY0+6,'#1c2230');
  const T=[TEAMS[B.g.home],TEAMS[B.g.away]],pal=[T[0].c1,T[0].c2,T[0].c1,T[1].c1,'#f2f2f2','#e0b48a','#8a5a3c',T[0].c2];
  const off=Math.floor(cam*PX*0.5),tick=Math.floor(t*6);
  for(let row=0;row<4;row++)for(let x=-2;x<W+2;x+=2){const i=Math.floor((x+off)/2),h=(Math.imul(i,73856093)^Math.imul(row+1,19349663))>>>0;
    if(h%7===0)continue;const bounce=excite>0&&((h+tick)%3===0)?1:0;ctx.fillStyle=pal[h%pal.length];ctx.fillRect(x-(off%2),2+row*3-bounce,2,2);}
  rect(0,FY0+1,W,3,'#2a3242');rect(0,FY0+4,W,1,'#3b4558');
}
function drawField(B){ctx.drawImage(fieldCanvas(B.g.home),Math.round(160-(cam+15)*PX-30),FY0);}
function drawGoalposts(){
  for(const Xg of [-10,110]){const gx=sxOf(Xg,0),gy=syOf(0);if(gx<-40||gx>W+40)continue;const hc=10,col='#ffd23a';
    rect(gx,gy-hc,1,hc,col);const ax=sxOf(Xg,-3.1),ay=syOf(-3.1)-hc,bx=sxOf(Xg,3.1),by=syOf(3.1)-hc;
    line(ax,ay,bx,by,col);rect(ax,ay-24,1,24,col);rect(bx,by-24,1,24,col);}
}
function lateralLine(X,col){ctx.fillStyle=col;for(let py=Math.ceil(syOf(-26.6));py<=syOf(26.6);py++){const Y=(py-FY0)/VY-29;ctx.fillRect(Math.round(sxOf(X,Y)),py,1,1);}}

/* ============================== SPRITES ============================== */
const SPR=[['.HHH.','HHHHM','JJJJJ','JJNJJ','.JJJ.','.PPP.','.L.L.','.B.B.'],['.HHH.','HHHHM','JJJJJ','JJNJJ','.JJJ.','.PPP.','L...L','B...B']];
const SPRL=SPR.map(f=>f.map(r=>[...r].reverse().join('')));
function kit(B,side){
  const T=TEAMS[side===0?B.g.home:B.g.away];
  if(side===0)return {H:T.c1,M:'#bfbfbf',J:T.c1,N:Math.abs(lum(T.c1)-lum(T.c2))>0.25?T.c2:'#fff',P:T.c2,L:T.c1,B:'#111'};
  return {H:T.c1,M:'#bfbfbf',J:'#f3f1ea',N:lum(T.c1)<0.7?T.c1:T.c2,P:T.c2,L:'#f3f1ea',B:'#111'};
}
function drawPlayer(sx,sy,k,face,fr){
  const rows=(face>0?SPR:SPRL)[fr],x=Math.round(sx-2),y=Math.round(sy-8);
  ctx.fillStyle='rgba(0,0,0,.32)';ctx.fillRect(x,y+7,5,2);
  for(let j=0;j<8;j++){const r=rows[j];for(let i=0;i<5;i++){const ch=r[i];if(ch==='.')continue;ctx.fillStyle=k[ch];ctx.fillRect(x+i,y+j,1,1);}}
}
function drawBall(b){if(!b)return;const sx=sxOf(b.x,b.y),sy=syOf(b.y);ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect(Math.round(sx-1),Math.round(sy),3,1);
  const by=sy-4-b.h*VY;rect(sx-1,by,3,2,'#7a4520');rect(sx,by,1,1,'#f0e0c0');}

/* ============================== PLAY ANIMATION ============================== */
const OFF_F=[[-1,-4],[-1,-2],[-1,0],[-1,2],[-1,4],[-1.3,6],[-1,-21],[-1,20],[-2.5,-13],[-5,0],[-5.5,2.5]];
const DEF_F=[[1.3,-5.5],[1.3,-1.8],[1.3,1.8],[1.3,5.5],[5,-8],[5,0],[5,8],[7,-21],[7,20],[13,-9],[13,9]];
const DEF_K=[1.25,1.25,1.25,1.25,1.05,1.05,1.05,0.9,0.9,0.95,0.95];
function sceneFor(P,p){
  const dir=P.team===0?1:-1,los=P.x0,fl=(P.ln%2)?-1:1,a=cl((p-0.15)/0.62,0,1);
  const O=OFF_F.map(([dx,dy])=>({x:los+dir*dx,y:dy*fl})),D=DEF_F.map(([dx,dy])=>({x:los+dir*dx,y:dy*fl}));
  const offA=[],defA=[];let ball=null,carrier=null;
  const chase=(s,tg,i,f0)=>{const f=cl(f0,0,0.94),o=((i*2.3)%5)-2.5;return {x:lerp(s.x,tg.x+o*0.4,f),y:lerp(s.y,tg.y+o*0.5,f)};};
  const k=P.kind;
  if(k==='run'||k==='fumble'||k==='kneel'){
    const qb=O[9],rb=O[10],hand={x:qb.x+dir*0.3,y:qb.y+0.6},end={x:P.x1,y:P.y1??0};let rbP,qbP=qb;
    if(k==='kneel'){qbP={x:lerp(qb.x,P.x1,ease(a/0.3)),y:0};rbP=rb;ball={x:qbP.x,y:0,h:a<0.06?0.5:1};carrier=qbP;}
    else{
      rbP=a<0.15?{x:lerp(rb.x,hand.x,a/0.15),y:lerp(rb.y,hand.y,a/0.15)}:(()=>{const e=ease((a-0.15)/0.85);return {x:lerp(hand.x,end.x,e),y:lerp(hand.y,end.y,e)+Math.sin(e*7)*1.2*(1-e)};})();
      qbP=a<0.15?qb:{x:qb.x-dir*1.6*ease((a-0.15)/0.5),y:qb.y-1.5*fl*ease((a-0.15)/0.5)};
      ball=a<0.06?{x:lerp(los,qb.x,a/0.06),y:0,h:0.8}:a<0.15?{x:qb.x,y:qb.y,h:1}:{x:rbP.x,y:rbP.y,h:1};carrier=a<0.15?qb:rbP;
      if(k==='fumble'&&a>0.82){const t=(a-0.82)/0.18;ball={x:end.x+dir*2.2*t,y:end.y+1.6*t,h:Math.abs(Math.sin(t*Math.PI*2))*1.4};}
    }
    O.forEach((s,i)=>{let pos=s;if(i<6)pos={x:s.x+dir*1.2*ease(a),y:s.y};else if(i<9)pos={x:s.x+dir*7*ease(a),y:s.y*0.9};else if(i===9)pos=qbP;else pos=rbP;offA.push(pos);});
    D.forEach((s,i)=>defA.push(chase(s,carrier,i,a*DEF_K[i]*(k==='kneel'?0.3:1))));
  } else if(k==='pass'||k==='inc'||k==='int'||k==='sack'||k==='two'){
    const qb=O[9],drop=ease(a/0.3)*2.5;let qbP={x:qb.x-dir*drop,y:qb.y};
    const wi=6+(P.wr||0),ct={x:P.xc??los+dir*8,y:P.yc??0},comp=k==='pass'||(k==='two'&&P.good);
    const route=i=>{const s=O[i];if(i===wi&&k!=='sack'){const t=cl(a/0.55,0,1);let pos={x:lerp(s.x,ct.x,t),y:lerp(s.y,ct.y,t*t)};
        if(a>0.55){const e=ease((a-0.55)/0.45);pos=comp?{x:lerp(ct.x,P.x1,e),y:lerp(ct.y,P.y1??ct.y,e)}:{x:ct.x+dir*1.5*e,y:ct.y};}return pos;}
      return {x:s.x+dir*cl(9+i,9,14)*ease(a/0.6),y:s.y+(i===8?6*fl:0)*ease(a)};};
    if(k==='sack'&&a>0.4)qbP={x:lerp(qbP.x,P.x1,ease((a-0.4)/0.25)),y:lerp(0,P.y1||0,ease((a-0.4)/0.25))};
    const qb35={x:qb.x-dir*2.5,y:qb.y},u=(a-0.35)/0.2,dist=Math.abs(ct.x-qb35.x);
    if(a<0.06){ball={x:lerp(los,qb.x,a/0.06),y:0,h:0.8};carrier=qb;}
    else if(k==='sack'||a<0.35){ball={x:qbP.x,y:qbP.y,h:1.2};carrier=qbP;}
    else if(a<0.55){ball={x:lerp(qb35.x,ct.x,u),y:lerp(qb35.y,ct.y,u),h:1.5+Math.sin(Math.PI*u)*(2+dist*0.12)};carrier=ball;}
    else if(comp){const rp=route(wi);ball={x:rp.x,y:rp.y,h:1};carrier=rp;}
    else if(k==='int'){const e=ease((a-0.55)/0.45),ip={x:lerp(ct.x,P.x1,e),y:lerp(ct.y,P.y1??ct.y,e)};ball={x:ip.x,y:ip.y,h:1};carrier=ip;}
    else{const t=cl((a-0.55)/0.12,0,1);ball={x:ct.x+dir*2.5*t,y:ct.y+t,h:1.5*(1-t)};carrier=ball;}
    O.forEach((s,i)=>{let pos;if(i<5)pos={x:s.x-dir*1*ease(a),y:s.y};else if(i===5)pos={x:s.x-dir*0.5,y:s.y+0.5};else if(i<9)pos=route(i);else if(i===9)pos=qbP;else pos={x:qb.x+dir*0.6,y:1.2*fl};offA.push(pos);});
    const cover=[null,null,null,null,null,null,null,6,7,8,wi];
    D.forEach((s,i)=>{let pos;
      if(i<4)pos=chase(s,a<0.45||k==='sack'?qbP:carrier,i,a*(k==='sack'?1.6:1.05));
      else{const preT=t=>{if(i<7)return {x:s.x+dir*3*ease(t/0.45),y:s.y};const w=route(cover[i]);return {x:w.x+dir*1.6,y:w.y+(i>8?2:0)};};
        if(k==='int'&&i===(ct.y*fl<0?7:8)){const t=cl(a/0.55,0,1);pos=a<0.55?{x:lerp(s.x,ct.x,ease(t)),y:lerp(s.y,ct.y,ease(t))}:carrier;}
        else if(a<0.45)pos=preT(a);else pos=chase(preT(0.45),carrier,i,ease((a-0.45)/0.55)*1.05);}
      defA.push(pos);});
  } else if(k==='kickoff'){
    const spot=P.x0,rd=-dir,ret=a<0.5||P.tb?{x:P.xc,y:P.yc}:(()=>{const e=ease((a-0.5)/0.5);return {x:lerp(P.xc,P.x1,e),y:lerp(P.yc,P.y1,e)};})(),u=cl((a-0.15)/0.35,0,1);
    ball=a<0.15?{x:spot,y:0,h:0.2}:a<0.5?{x:lerp(spot,P.xc,u),y:lerp(0,P.yc,u),h:Math.sin(Math.PI*u)*14+0.3}:{x:ret.x,y:ret.y,h:1};carrier=ret;
    for(let i=0;i<11;i++){const s=i===5?{x:spot-dir*7,y:0}:{x:spot-dir*1,y:-23+i*4.6};let pos=s;
      if(i===5&&a<0.15)pos={x:lerp(s.x,spot,a/0.15),y:0};else if(a>=0.15)pos=chase(i===5?{x:spot,y:0}:s,ret,i,ease((a-0.15)/0.85)*(0.75+(i%3)*0.08));offA.push(pos);}
    for(let i=0;i<11;i++){let s;if(i===0){defA.push(ret);continue;}if(i===1)s={x:P.xc-rd*6,y:-P.yc*0.5};else s={x:P.xc-rd*(14+(i%3)*7),y:-20+((i-2)%5)*10};defA.push(chase(s,{x:s.x-rd*5,y:s.y*0.8},i,ease(a)*0.8));}
  } else if(k==='punt'){
    const punter={x:los-dir*13,y:0},ret=a<0.55||P.fair?{x:P.xc,y:P.yc}:(()=>{const e=ease((a-0.55)/0.45);return {x:lerp(P.xc,P.x1,e),y:lerp(P.yc,P.y1,e)};})(),u=cl((a-0.15)/0.4,0,1);
    ball=a<0.1?{x:lerp(los,punter.x,a/0.1),y:0,h:1}:a<0.15?{x:punter.x,y:0,h:1.2}:a<0.55?{x:lerp(punter.x,P.xc,u),y:lerp(0,P.yc,u),h:1.2+Math.sin(Math.PI*u)*12}:{x:ret.x,y:ret.y,h:P.fair?0.6:1};carrier=ret;
    O.forEach((s,i)=>{if(i===9){offA.push(punter);return;}const st=i===10?{x:los-dir*5,y:1}:s;offA.push(a<0.15?st:chase(st,ret,i,ease((a-0.15)/0.85)*(0.7+(i%4)*0.07)));});
    D.forEach((s,i)=>{if(i===10){defA.push(ret);return;}const st=i>=7?{x:s.x+dir*8,y:s.y}:s;defA.push(a<0.25?{x:st.x-dir*1.5*ease(a/0.25),y:st.y}:chase({x:st.x-dir*1.5,y:st.y},{x:ret.x+dir*4,y:ret.y},i,ease((a-0.25)/0.75)*0.5));});
  } else if(k==='fg'||k==='pat'){
    const holder={x:los-dir*7,y:0},kick0={x:los-dir*9.5,y:-1.5*fl},goalX=dir>0?110:-10;
    const kp=a<0.15?{x:lerp(kick0.x,holder.x-dir*0.6,a/0.15),y:lerp(kick0.y,-0.4*fl,a/0.15)}:{x:holder.x-dir*0.6,y:-0.4*fl},u=cl((a-0.15)/0.45,0,1);
    ball=a<0.1?{x:lerp(los,holder.x,a/0.1),y:0,h:0.5}:a<0.15?{x:holder.x,y:0,h:0.3}:{x:lerp(holder.x,goalX,u),y:lerp(0,P.yc||0,u),h:0.3+u*6+Math.sin(Math.PI*u)*3};
    if(a>=0.6){const t=cl((a-0.6)/0.3,0,1);ball={x:goalX+dir*3*t,y:P.yc||0,h:Math.max(0,6.3-t*6.3)};}
    carrier=holder;const lineY=[-6.5,-4,-2,0,2,4,6.5,-8.5,8.5];
    for(let i=0;i<11;i++){if(i===9){offA.push(holder);continue;}if(i===10){offA.push(kp);continue;}offA.push({x:los-dir*(i>=7?1.6:1),y:lineY[i]*0.9});}
    D.forEach((s,i)=>{const st=i<7?{x:los+dir*1.3,y:-7+i*2.3}:{x:los+dir*(i<9?3:7),y:(i%2?1:-1)*8};defA.push(chase(st,holder,i,a*(i<7?0.45:0.2)));});
  } else {O.forEach((s,i)=>offA.push({x:s.x-dir*2,y:s.y*0.6+((i%3)-1)}));D.forEach((s,i)=>defA.push({x:s.x+dir*2,y:s.y*0.6+((i%3)-1)}));}
  return {offA,defA,ball,cam:ball?ball.x:los,moving:a>0&&a<1,dir};
}

/* ============================== OVERLAYS ============================== */
const NAVY='#0b1838',ORANGE='#ff7a1a',CREAM='#f4ecd8',GOLD='#ffd23a',LIVE='#e5483b',DIM='#9aa7c7';
function bug(label,col,t){
  rect(W-38,4,34,9,ORANGE);txt('PGN',W-35,6,'#1a0f05');
  if(label){rect(W-38,13,34,7,col);txt(label,W-21,14,'#fff',1,'c');if(label==='LIVE'&&Math.floor(t*2)%2===0)rect(W-36,15,2,2,'#fff');}
}
function teamBox(x,y,t,score,poss,rank){
  const T=TEAMS[t];rect(x,y,62,14,'#0a1020');rect(x,y,4,14,T.c1);rect(x+4,y,1,14,T.c2);
  if(rank)txt(rank,x+8,y+5,DIM);txt(T.abbr,x+(rank?8+tw(rank)+3:8),y+5,'#fff');
  if(poss){rect(x+30+(rank?tw(rank)+3:0),y+11,4,2,'#c27a3a');}
  txt(String(score),x+59,y+2,'#fff',2,'r');
}
function shortTitle(t){return t.length>14?t.replace(' CHAMPIONSHIP',' TITLE').replace(' BOWL','').replace('PLAYOFF ','').replace('NATIONAL ','').replace('FIRST ROUND','CFP RD 1').slice(0,14):t;}
function scoreBar(B,P,p){
  const g=B.g,sc=p<0.78?P.s0:P.s1,y=150,rk=t=>{if(g.kind==='classic')return '';const k=rankOf(g.S,B.n0,t);return k?String(k):'';};
  rect(0,y-1,W,16,'#050913');
  teamBox(4,y,g.away,sc[1],P.poss===1&&P.kind!=='qend',rk(g.away));
  teamBox(68,y,g.home,sc[0],P.poss===0&&P.kind!=='qend',rk(g.home));
  rect(132,y,58,14,'#121c38');
  const qs=P.q>4?(P.q>5?`${P.q-4}OT`:'OT'):ORD[P.q],clk=P.q>4?'':fmtClock(p<0.15?P.clock0:lerp(P.clock0,P.clock1,cl((p-0.15)/0.75,0,1)));
  txt(qs,136,y+5,'#fff');txt(clk,186,y+5,'#fff',1,'r');
  rect(192,y,64,14,'#121c38');
  let dd='';
  if(P.kind==='kickoff')dd='KICKOFF';else if(P.kind==='pat')dd='EXTRA POINT';else if(P.kind==='two')dd='2-PT TRY';else if(P.kind==='qend')dd=P.q===2?'HALFTIME':'';
  else dd=`${ORD[P.down]} & ${P.togo>=100-P.yd?'GOAL':P.togo}`;
  txt(dd,224,y+5,P.down===4&&!['kickoff','pat','two','qend'].includes(P.kind)?GOLD:'#fff',1,'c');
  rect(258,y,58,14,ORANGE);txt(shortTitle(g.kind==='classic'?'PGN CLASSIC':g.title),287,y+5,'#1a0f05',1,'c');
}
function caption(str,y=139){const lines=wrap(str,74);let yy=y-(lines.length-1)*7;for(const l of lines){rect(160-tw(l)/2-4,yy-2,tw(l)+8,9,'rgba(5,9,19,.86)');txt(l,160,yy,CREAM,1,'c');yy+=7;}}
function banner(text,col,col2,sub,y=60){rect(0,y,W,34,col);rect(0,y,W,2,col2);rect(0,y+32,W,2,col2);txtS(text,160,y+6,'#fff',3,'c','rgba(0,0,0,.45)');if(sub)txt(sub,160,y+24,lum(col)>0.6?'#111':CREAM,1,'c');}

/* ============================== TICKER ============================== */
let tick={str:'',x:W*0.4};
function currentScoreOf(g,s){
  if(s<120)return null;const res=simulate(g);if(s>=1680)return {sc:res.final,lab:'FINAL'};
  const half=s<960?0:1,list=res.halves[half],ts=s-(half?960:120);
  if(half===0&&s>=840)return {sc:list[list.length-1].s1,lab:'HALF'};
  let P=list[0];for(const x of list){if(x.t0<=ts)P=x;else break;}
  return {sc:(ts-P.t0)/P.dur<0.78?P.s0:P.s1,lab:P.q>4?'OT':`Q${P.q}`};
}
function gameLine(g,L,n){
  const a=TEAMS[g.away].abbr,h=TEAMS[g.home].abbr,ra=rankOf(g.S,n,g.away),rh=rankOf(g.S,n,g.home),A=(ra?`${ra} `:'')+a,Hh=(rh?`${rh} `:'')+h;
  if(gIdx(g)<L.n){const f=finalOf(g);return `${A} ${f.f[1]} ${Hh} ${f.f[0]} FINAL${f.ot?'/OT':''}`;}
  if(gIdx(g)===L.inS){const cs=currentScoreOf(g,L.s);return cs?`${A} ${cs.sc[1]} ${Hh} ${cs.sc[0]} ${cs.lab}`:`${A} ${g.neutral?'VS':'AT'} ${Hh} KICKOFF SOON`;}
  return `${A} ${g.neutral?'VS':'AT'} ${Hh} ${fmtTime(slotStart(g.S*SPS+gIdx(g))).replace(' ','')}`;
}
function tickerText(){
  const L=locate(nowMs()),S=L.S,items=[],n=Math.min(L.inS,SPS);
  if(L.w<14){
    items.push(L.w<REGW?`WEEK ${L.w+1}`:L.w===12?'CHAMPIONSHIP WEEK':'BOWLS + PLAYOFF');
    const wg=weekGames(S,L.w).filter(g=>known(g,L)).sort((a,b)=>Math.abs(gIdx(a)-L.inS)-Math.abs(gIdx(b)-L.inS)||gIdx(a)-gIdx(b));
    for(const g of wg.slice(0,40))items.push((g.kind==='reg'?'':shortTitle(g.title)+': ')+gameLine(g,L,n));
  } else {
    const sum=seasonSummary(S);items.push(`${seasonYear(S)} NATIONAL CHAMPION: ${TEAMS[sum.champ].full.toUpperCase()}`);
    const left=slotStart((S+1)*SPS)-nowMs();items.push(`${seasonYear(S+1)} SEASON KICKS OFF IN ${Math.floor(left/3600000)}H ${Math.floor(left/60000)%60}M`);
  }
  items.push(`PGN TOP 25${n===0?' (PRESEASON)':''}: `+poll(S,n).slice(0,25).map((t,i)=>`${i+1} ${TEAMS[t].abbr} ${recStr(S,n,t)}`).join('  '));
  const rc=recentCommits(S,L.fIdx,6);
  for(const c of rc)items.push(c.first?`COMMIT: ${'★'.repeat(c.p.stars)} ${c.p.pos} ${c.p.f} ${c.p.l} (${c.p.st}) PICKS ${TEAMS[c.team].abbr}`:c.flip?`FLIP! ${'★'.repeat(c.p.stars)} ${c.p.pos} ${c.p.f} ${c.p.l} FLIPS TO ${TEAMS[c.team].abbr}`:`${L.fIdx>=IDX_SIGN&&c.at>=IDX_SIGN?'SIGNED':'COMMIT'}: ${'★'.repeat(c.p.stars)} ${c.p.pos} ${c.p.f} ${c.p.l} (${c.p.st}) TO ${TEAMS[c.team].abbr}`);
  if(L.fIdx>=IDX_PORTAL){const ev=[];for(const e of portal(S).entries){const s=portalStatus(e,L.fIdx);if(!s)continue;ev.push({e,s,at:s.state==='committed'?e.commitAt:e.enterAt});}
    ev.sort((a,b)=>b.at-a.at);for(const {e,s} of ev.slice(0,5))items.push(s.state==='committed'?`PORTAL: ${TEAMS[e.from].abbr} ${e.p.pos} ${e.p.f} ${e.p.l} COMMITS TO ${TEAMS[s.team].abbr}`:`PORTAL: ${TEAMS[e.from].abbr} ${e.p.pos} ${e.p.f} ${e.p.l} (${e.p.ovr} OVR) ENTERS THE PORTAL`);}
  return items.join('   ·   ');
}
function drawTicker(dt){
  const y=167;rect(0,y,W,13,NAVY);rect(0,y,W,1,'#24335f');
  if(!tick.str||tick.x<-tw(tick.str)){const fresh=!tick.str;tick.str=tickerText();if(!fresh)tick.x=W;}
  tick.x-=dt*26;txt(tick.str,Math.round(tick.x),y+4,CREAM);
  rect(0,y,28,13,ORANGE);txt('PGN',14,y+4,'#1a0f05',1,'c');
}

/* ============================== SCENES ============================== */
let lastPlayKey='',lastPhase=0;
function renderPlay(B,P,p,t,opts){
  const sc=sceneFor(P,p),target=cl(sc.cam+sc.dir*4,16,84);
  if(opts.snap||Math.abs(cam-target)>45)cam=target;else cam+=(target-cam)*Math.min(1,opts.dt*4);
  drawStands(B,t);drawField(B);
  if(['run','pass','inc','sack','int','fumble','kneel'].includes(P.kind)&&p<0.8){lateralLine(P.x0,'#3d7bff');if(P.yd+P.togo<100)lateralLine(P.team===0?P.yd+P.togo:100-(P.yd+P.togo),GOLD);}
  drawGoalposts();
  const kO=kit(B,P.team),kD=kit(B,1-P.team),fr=sc.moving?Math.floor(t*8)%2:0,act=[];
  sc.offA.forEach(a=>act.push([a,kO,sc.dir]));sc.defA.forEach(a=>act.push([a,kD,-sc.dir]));
  act.sort((u,v)=>u[0].y-v[0].y);
  for(const [a,k,f] of act){const yy=cl(a.y,-27.5,27.5);drawPlayer(sxOf(a.x,yy),syOf(yy),k,f,fr);}
  drawBall(sc.ball);
  if(p>=0.78&&!opts.replay){
    const T=TEAMS[(P.td?(P.s1[0]>P.s0[0]?0:1):P.team)===0?B.g.home:B.g.away],D=TEAMS[P.team===0?B.g.away:B.g.home];
    if(P.td)banner('TOUCHDOWN',T.c1,T.c2,`${T.name} ${T.mascot}`);
    else if(P.kind==='int')banner('PICKED OFF',D.c1,'#fff');else if(P.kind==='fumble')banner('FUMBLE!',D.c1,'#fff');
    else if(P.safety)banner('SAFETY',D.c1,'#fff');else if(P.kind==='fg'&&P.good)banner('IT IS GOOD',T.c1,T.c2);
  }
  if(P.kind==='qend')caption(P.text,100);else if(p>=0.78)caption(P.text);
}
function drawGame(B,seg,s,t,dt){
  const list=B.res.halves[seg.half-1],ts=s-seg.t0;let i=0;for(let k=0;k<list.length;k++){if(list[k].t0<=ts)i=k;else break;}
  const P=list[i],p=cl((ts-P.t0)/P.dur,0,1),key=B.slotG+':'+seg.half+':'+i;
  renderPlay(B,P,p,t,{snap:lastPlayKey==='',dt});scoreBar(B,P,p);
  bug(B.g.kind==='classic'?'CLASSIC':'LIVE',B.g.kind==='classic'?'#5b4bb7':LIVE,t);
  if(key!==lastPlayKey){lastPlayKey=key;lastPhase=0;if(P.kind==='kickoff')sfx('whistle');}
  if(p>=0.78&&!lastPhase){lastPhase=1;if(P.td){sfx('td');excite=5;}else if((P.gain||0)>=15||P.kind==='int'||P.kind==='fumble'){sfx('crowd');excite=2.5;}else if(P.kind!=='qend')sfx('whistle');}
}
function drawReplay(B,seg,s,t,dt){
  const P=seg.play;if(!P){drawBoard(B,{kind:'final'},s,t);return;}
  renderPlay(B,P,cl((s-seg.t0)/(seg.t1-seg.t0)*1.05,0,1),t,{replay:true,snap:s-seg.t0<0.05,dt});
  rect(6,150,W-12,13,'rgba(5,9,19,.86)');txt(fit(P.text,76),160,154,CREAM,1,'c');
  rect(6,4,tw(seg.label)+8,9,NAVY);txt(seg.label,10,6,GOLD);bug('REPLAY','#2e5bd6',t);
  if(Math.floor(t*2)%2===0)rect(8,17,3,3,LIVE);txt('SLOW MO',14,17,'#fff');
}
function helmet(cx,cy,R,t,face=1){
  const T=TEAMS[t];disc(cx+face*2,cy+1,R+4,'rgba(5,9,19,.82)');disc(cx+face*2,cy+1,R+4,'rgba(255,255,255,.06)');
  for(let y=-R;y<=R;y++){const w=Math.floor(Math.sqrt(R*R-y*y));for(let x=-w;x<=w;x++){const fx=x*face;if(fx>R*0.38&&y>-R*0.1)continue;const d=Math.sqrt(x*x+y*y);
    ctx.fillStyle=(d>R-3.2&&d<R-1.2&&y<R*0.15&&fx<R*0.3)?T.c2:(d>R-0.9?'rgba(0,0,0,.35)':T.c1);ctx.fillRect(cx+x,cy+y,1,1);}}
  const sc=Math.max(1,Math.floor(R/6));txt(T.abbr[0],cx-face*R*0.2,cy-2.5*sc,T.c2,sc,'c');rect(cx+face*R*0.05-1,cy+R*0.35,2,2,'rgba(0,0,0,.6)');
  const mc='#c9c9c9',x0=cx+face*R*0.38,x1=cx+face*R*1.12;for(const fy of [0,0.32,0.62])line(x0,cy+R*fy,x1,cy+R*fy,mc);
  line(x1,cy,x1,cy+R*0.62,mc);line(x0+face*R*0.35,cy,x0+face*R*0.35,cy+R*0.75,mc);
}
function stripes(t,c1,c2){rect(0,0,W,H,c1);ctx.fillStyle=c2;const o=Math.floor(t*8)%24;for(let y=0;y<H;y++)for(let x=-24+((o+y)%24);x<W;x+=24)ctx.fillRect(x,y,10,1);}
function anchorFig(x,y,skin,hair,suit,tie,talk,t,long){
  rect(x-9,y+12,18,16,suit);rect(x-3,y+12,6,6,'#f3f0e6');rect(x-1,y+13,2,7,tie);rect(x-9,y+12,18,1,'rgba(255,255,255,.15)');
  rect(x-5,y,10,11,skin);rect(x-2,y+11,4,2,skin);rect(x-6,y-2,12,4,hair);if(long){rect(x-6,y,2,13,hair);rect(x+4,y,2,13,hair);}else{rect(x-6,y,1,5,hair);rect(x+5,y,1,5,hair);}
  rect(x-3,y+4,2,2,'#1a1a1a');rect(x+2,y+4,2,2,'#1a1a1a');rect(x-2,y+8,4,talk&&Math.floor(t*7)%2?2:1,'#7a2e2e');
}
function drawStudio(B,seg,s,t){
  const g=B.g,Ht=TEAMS[g.home],A=TEAMS[g.away];
  rect(0,0,W,H,'#0b1530');for(let y=0;y<110;y+=8)rect(0,y,W,1,'#13214a');for(let x=0;x<W;x+=8)rect(x,0,1,110,'#101c40');
  rect(78,10,164,62,'#05070f');ctx.save();ctx.beginPath();ctx.rect(80,12,160,58);ctx.clip();
  rect(80,12,80,58,A.c1);rect(160,12,80,58,Ht.c1);for(let y=12;y<70;y++)rect(156+(y-12)*0.15,y,8,1,'#05070f');ctx.restore();
  helmet(116,40,14,g.away,1);helmet(204,40,14,g.home,-1);txtS(g.neutral?'VS':'AT',160,37,'#fff',2,'c');
  rect(80,62,160,8,'rgba(0,0,0,.55)');txt(g.kind==='classic'?`PGN CLASSICS · ${seasonYear(g.S)}`:`PGN GAMEDAY · ${shortTitle(g.title)}`,160,64,GOLD,1,'c');
  const li=Math.floor((s-seg.t0)/9)%B.lines.length,who=li%2;
  anchorFig(122,82,'#e0b48a','#3a2414','#24324f','#c0392b',who===0,t,false);anchorFig(198,82,'#a8714a','#1a1a1a','#4a2a52','#e8c547',who===1,t,true);
  ctx.fillStyle='#1e2d5c';ctx.beginPath();ctx.moveTo(70,106);ctx.lineTo(250,106);ctx.lineTo(262,140);ctx.lineTo(58,140);ctx.fill();
  rect(70,106,180,3,'#3b55a0');rect(144,116,32,12,ORANGE);txt('PGN',160,119,'#1a0f05',1,'c');
  const nm=who===0?'DAN PIXELSON':'KAY BYTEWELL',ln=wrap(B.lines[li],74);
  rect(0,142,W,24,'rgba(5,9,19,.92)');rect(0,142,tw(nm)+10,8,ORANGE);txt(nm,5,143,'#1a0f05');ln.slice(0,2).forEach((l,i)=>txt(l,6,151+i*7,CREAM));
  rect(4,4,82,9,NAVY);txt(`KICKOFF IN ${fmtClock(120-s)}`,8,6,GOLD);bug('PRE',NAVY,t);
}
function panel(title,sub){rect(10,8,W-20,140,'rgba(5,9,19,.9)');rect(10,8,W-20,16,ORANGE);txt(title,16,11,'#1a0f05',2);if(sub)txt(fit(sub,26),W-44,13,'#1a0f05',1,'r');}
function chip(x,y,t){rect(x,y-1,3,7,TEAMS[t].c1);}
function drawBoard(B,seg,s,t){
  const g=B.g,S=g.S,L=locate(nowMs()),n=Math.min(B.n0,SPS);
  stripes(t,'#0c1a3f','#10214f');
  const k=seg.kind;
  if(k==='scores'){
    const wk=B.w,list=(wk===14?classics(S):weekGames(S,wk).filter(x=>x.aired)).slice().sort((a,b)=>a.slot-b.slot);
    panel(wk<REGW?`WEEK ${wk+1} ON PGN`:wk===12?'CHAMPIONSHIP WEEK':'BOWLS + PLAYOFF','TODAY ON THE NETWORK');
    list.forEach((x,i)=>{const y=30+i*9.5;
      if(!known(x,L)){txt(shortTitle(slotTitle(S,wk,x.slot)),18,y,DIM);txt('TBD',W-18,y,DIM,1,'r');return;}
      const a=TEAMS[x.away],h=TEAMS[x.home],ra=rankOf(S,n,x.away),rh=rankOf(S,n,x.home);
      if(wk>=12)txt(shortTitle(x.title),18,y,DIM);const x0=wk>=12?80:18;
      txt((ra?ra+' ':'')+a.abbr,x0,y,CREAM);txt((rh?rh+' ':'')+h.abbr,x0+52,y,CREAM);
      if(gIdx(x)<B.inS){const f=finalOf(x).f;txt(String(f[1]),x0+40,y,f[1]>f[0]?GOLD:CREAM,1,'r');txt(String(f[0]),x0+92,y,f[0]>f[1]?GOLD:CREAM,1,'r');txt('FINAL',W-18,y,DIM,1,'r');}
      else if(x.slot===B.slot){txt(x.neutral?'VS':'AT',x0+32,y,DIM);txt('ON NOW',W-18,y,LIVE,1,'r');}
      else{txt(x.neutral?'VS':'AT',x0+32,y,DIM);txt(fmtTime(slotStart(S*SPS+gIdx(x))),W-18,y,DIM,1,'r');}
      if(wk<12)txt(fit(`${a.name} ${x.neutral?'VS':'AT'} ${h.name}`,30),x0+100,y,'#6f7ea8');
    });
  } else if(k==='top25'){
    const rk=poll(S,n);panel('PGN TOP 25',n===0?'PRESEASON':n>=IDX_CCG_END?'FINAL REGULAR SEASON':`AFTER ${Math.floor(n/12)} WEEKS`);
    rk.slice(0,25).forEach((tm,i)=>{const col=i<13?0:1,row=i<13?i:i-13,x=18+col*150,y=30+row*8.6;
      txt(String(i+1),x+8,y,GOLD,1,'r');chip(x+12,y,tm);txt(fit(TEAMS[tm].name,18),x+18,y,CREAM);txt(recStr(S,n,tm),x+136,y,DIM,1,'r');});
  } else if(k.startsWith('conf')){
    const ci=+k.slice(4),order=confStandings(S,Math.min(n,IDX_REG_END),ci),rec=records(S,Math.min(n,IDX_REG_END));
    panel(CONFS[ci].short,'CONFERENCE STANDINGS');txt('CONF',232,28,DIM,1,'r');txt('ALL',W-18,28,DIM,1,'r');
    if(order.length<=12){
      order.forEach((tm,i)=>{const y=36+i*9,r=rec[tm],rr=rankOf(S,n,tm);chip(18,y,tm);txt((rr?`${rr} `:'')+TEAMS[tm].full,25,y,CREAM);txt(`${r.cw}-${r.cl}`,232,y,CREAM,1,'r');txt(`${r.w}-${r.l}`,W-18,y,DIM,1,'r');});
    } else {
      rect(10,25,W-20,10,'rgba(5,9,19,1)');txt('CONF',138,28,DIM,1,'r');txt('CONF',W-20,28,DIM,1,'r');
      const half=Math.ceil(order.length/2);
      order.forEach((tm,i)=>{const col=i<half?0:1,row=col?i-half:i,x=16+col*150,y=37+row*12,r=rec[tm],rr=rankOf(S,n,tm);
        chip(x,y,tm);txt(fit((rr?`${rr} `:'')+TEAMS[tm].name,22),x+7,y,CREAM);txt(`${r.cw}-${r.cl}`,x+142-(col?2:0),y,CREAM,1,'r');});
    }
  } else if(k==='recruit'||k==='signing'){
    const idx=k==='signing'?Math.max(L.fIdx,IDX_SIGN+1):B.inS,cr=classRankings(S,idx),rc=recentCommits(S,idx,8);
    panel(k==='signing'?'SIGNING DAY':'RECRUITING',`CLASS OF ${seasonYear(S+1)}`);
    txt('TOP CLASSES',18,29,GOLD);cr.slice(0,10).forEach((c,i)=>{const y=38+i*10;txt(String(i+1),26,y,DIM,1,'r');chip(30,y,c.t);txt(TEAMS[c.t].abbr,36,y,CREAM);txt(`${c.n}`,74,y,DIM,1,'r');txt(`${c.s5}·${c.s4}`,98,y,'#8fe39a',1,'r');});
    txt('5★·4★',98,29,DIM,1,'r');
    txt('LATEST COMMITS',116,29,GOLD);rc.slice(0,8).forEach((c,i)=>{const y=37+i*13.5;chip(116,y,c.team);txt(`${'★'.repeat(c.p.stars)} ${c.p.pos} ${c.p.f[0]}. ${c.p.l}`,122,y,CREAM);txt(`${c.flip?'FLIPS TO':'TO'} ${TEAMS[c.team].abbr} · ${c.p.st}`,122,y+6,DIM);});
  } else if(k==='portal'){
    const ent=portal(S).entries.map(e=>({e,s:portalStatus(e,L.fIdx)})).filter(o=>o.s).sort((a,b)=>b.e.p.ovr-a.e.p.ovr);
    panel('TRANSFER PORTAL',`${ent.length} PLAYERS IN`);
    txt('FROM',18,29,DIM);txt('PLAYER',52,29,DIM);txt('OVR',214,29,DIM,1,'r');txt('STATUS',W-18,29,DIM,1,'r');
    ent.slice(0,12).forEach(({e,s},i)=>{const y=38+i*9;chip(18,y,e.from);txt(TEAMS[e.from].abbr,24,y,CREAM);txt(`${e.p.pos} ${e.p.f[0]}. ${e.p.l}`,52,y,CREAM);txt(String(e.p.ovr),214,y,GOLD,1,'r');
      txt(s.state==='committed'?`TO ${TEAMS[s.team].abbr}`:s.state==='withdrawn'?'WITHDREW':'OPEN',W-18,y,s.state==='committed'?'#8fe39a':DIM,1,'r');});
  } else if(k==='bracket'){
    panel('THE PLAYOFF',`${seasonYear(S)} BRACKET`);
    if(L.n<IDX_CCG_END){txt('THE 12-TEAM FIELD IS SET AFTER CHAMPIONSHIP WEEK.',160,70,CREAM,1,'c');}
    else{const f=cfpField(S),cols=[['FIRST ROUND','cfp1'],['QUARTERFINALS','qf'],['SEMIFINALS','sf'],['TITLE','final']];
      cols.forEach(([lab,name],ci)=>{const x=16+ci*76;txt(lab,x,29,GOLD);
        const games=postList(S,name);games.forEach((x2,gi)=>{const y=38+gi*(ci===0||ci===1?26:ci===2?50:0)+(ci===2?12:ci===3?36:0);
          if(!known(x2,L)){txt('TBD',x,y,DIM);return;}
          const done=gIdx(x2)<L.n,fz=done?finalOf(x2).f:null;
          [[x2.away,1],[x2.home,0]].forEach(([tm,side],j)=>{const yy=y+j*8,win=done&&fz[side]>fz[1-side];chip(x,yy,tm);txt(`${f.indexOf(tm)+1} ${TEAMS[tm].abbr}`,x+6,yy,win?GOLD:CREAM);if(done)txt(String(fz[side]),x+62,yy,win?GOLD:DIM,1,'r');});});});
      if(L.n>IDX_SF_END+1){const ch=winnerOf(postList(S,'final')[0]);txt(`CHAMPION: ${TEAMS[ch].full}`,160,136,GOLD,1,'c');}}
  } else if(k==='half'||k==='final'){
    const fin=k==='final',plays=fin?B.res.plays:B.res.halves[0],sc=fin?B.res.final:plays[plays.length-1].s1,st=teamStats(plays);
    panel(fin?(B.res.ot?'FINAL / OT':'FINAL'):'HALFTIME',shortTitle(g.kind==='classic'?g.origTitle:g.title));
    helmet(52,48,13,g.away,1);helmet(W-52,48,13,g.home,-1);
    txt(TEAMS[g.away].abbr,52,66,CREAM,1,'c');txt(TEAMS[g.home].abbr,W-52,66,CREAM,1,'c');
    txtS(String(sc[1]),120,36,sc[1]>sc[0]?GOLD:'#fff',4,'c');txtS(String(sc[0]),200,36,sc[0]>sc[1]?GOLD:'#fff',4,'c');txt('-',160,44,DIM,2,'c');
    if(g.kind!=='classic'){const nn=fin?B.n0+1:B.n0;txt(recStr(S,nn,g.away),52,74,DIM,1,'c');txt(recStr(S,nn,g.home),W-52,74,DIM,1,'c');}
    const champ=fin&&g.kind==='final';
    if(!champ)[['TOTAL YARDS','yds'],['PASSING','pass'],['RUSHING','rush'],['FIRST DOWNS','fd'],['TURNOVERS','to']].forEach(([lb,kk],i)=>{const y=86+i*8;txt(String(st[1][kk]),110,y,CREAM,1,'r');txt(lb,160,y,DIM,1,'c');txt(String(st[0][kk]),210,y,CREAM);});
    if(fin){rect(14,128,W-28,15,'#121c38');txt('PLAYER OF THE GAME',20,130,GOLD);txt(fit(playerOfGame(B.res,g),72),20,137,CREAM);
      if(champ){const w=TEAMS[winnerOf(g)];banner('CHAMPIONS',w.c1,w.c2,`${w.full} · ${seasonYear(S)} NATIONAL CHAMPIONS`,86);}}
  }
  bug(k==='final'?'FINAL':k==='half'?'HALF':'',NAVY,t);
}
function drawMatchup(B,seg,s,t){
  const g=B.g,A=TEAMS[g.away],Hm=TEAMS[g.home],k=ease((s-seg.t0)/1.5),n=B.n0;
  rect(0,0,W/2,H,A.c1);rect(W/2,0,W/2,H,Hm.c1);for(let y=0;y<H;y+=4)rect(0,y,W,1,'rgba(0,0,0,.12)');
  helmet(Math.round(lerp(-30,90,k)),70,26,g.away,1);helmet(Math.round(lerp(W+30,W-90,k)),70,26,g.home,-1);
  rect(0,112,W,30,'rgba(5,9,19,.85)');
  const ra=rankOf(g.S,n,g.away),rh=rankOf(g.S,n,g.home),sa=g.seeds?`NO. ${g.seeds[1]} SEED`:ra?`NO. ${ra}`:'',sh=g.seeds?`NO. ${g.seeds[0]} SEED`:rh?`NO. ${rh}`:'';
  txt((sa?sa+' ':'')+A.name,90,118,'#fff',1,'c');txt(A.mascot,90,126,'#c7cfe6',1,'c');
  txt((sh?sh+' ':'')+Hm.name,W-90,118,'#fff',1,'c');txt(Hm.mascot,W-90,126,'#c7cfe6',1,'c');
  txtS(g.neutral?'VS':'AT',160,118,GOLD,2,'c');
  if(g.kind!=='classic'){txt(recStr(g.S,n,g.away),90,134,DIM,1,'c');txt(recStr(g.S,n,g.home),W-90,134,DIM,1,'c');}
  rect(0,6,W,16,NAVY);txt(g.kind==='classic'?`PGN CLASSIC · ${shortTitle(g.origTitle)}`:shortTitle(g.title),160,9,GOLD,2,'c');
  txt('KICKOFF',160,146,'#fff',2,'c');bug('PRE',NAVY,t);
}

/* ============================== ADS ============================== */
function drawAd(seg,s,t){
  const a=seg.ad,u=s-seg.t0,ph=u<5?0:u<10?1:2;
  if(a==='fizz'){
    stripes(t,'#4b1d8f','#5c27a8');const by=70+Math.abs(Math.sin(u*3))*-14;
    rect(146,by,28,46,'#6c2bd9');rect(146,by,28,4,'#c9c9d6');rect(146,by+42,28,4,'#c9c9d6');
    ctx.fillStyle=GOLD;ctx.beginPath();ctx.moveTo(164,by+8);ctx.lineTo(152,by+24);ctx.lineTo(160,by+24);ctx.lineTo(155,by+38);ctx.lineTo(168,by+20);ctx.lineTo(160,by+20);ctx.fill();
    const L=[['FOURTH QUARTER FEELING?',''],['CRACK OPEN A BOLT FIZZ','ZERO SUGAR. ALL SPEED.'],['BOLT FIZZ','NOW IN BLITZ BERRY']][ph];
    txtS(L[0],160,ph===2?16:22,GOLD,ph===2?4:2,'c');txt(L[1],160,140,'#fff',1,'c');
  } else if(a==='truck'){
    for(let y=0;y<120;y++)rect(0,y,W,1,`rgb(${255-y},${150+y*0.5|0},${90+y|0})`);
    disc(250,60,18,'#ffe08a');rect(0,120,W,60,'#3b3b3b');for(let x=-40;x<W;x+=40)rect(x+((u*120)%40),148,20,3,'#f2d14a');
    const x=lerp(-90,W+10,(u%8)/8);rect(x,96,70,20,'#b3261e');rect(x+44,82,22,16,'#b3261e');rect(x+48,85,14,9,'#9fd3f2');rect(x,96,70,3,'#d84a3a');
    disc(x+14,118,7,'#111');disc(x+56,118,7,'#111');disc(x+14,118,3,'#aaa');disc(x+56,118,3,'#aaa');
    const L=[['GRIDLOCK G-24','BUILT FOR TAILGATES'],['TOWS A WHOLE MARCHING BAND','MAYBE. WE HAVE NOT TRIED.'],['GRIDLOCK TRUCKS','VISIT YOUR LOCAL DEALER']][ph];
    txtS(L[0],160,14,'#fff',2,'c');txt(L[1],160,30,'#1a0f05',1,'c');
  } else if(a==='pizza'){
    for(let y=0;y<H;y+=12)for(let x=0;x<W;x+=12)rect(x,y,12,12,((x+y)/12)%2?'#c0392b':'#f4ecd8');
    rect(70,40,180,100,'rgba(255,255,255,.92)');const sw=Math.sin(u*2)*4;
    ctx.fillStyle='#e8b04a';ctx.beginPath();ctx.moveTo(110,60+sw);ctx.lineTo(150,60+sw);ctx.lineTo(130,125);ctx.fill();
    rect(108,56+sw,44,6,'#b07020');disc(126,72+sw,3,'#b3261e');disc(138,80+sw,3,'#b3261e');disc(130,95+sw,3,'#b3261e');
    const L=[['END ZONE PIZZA','DELIVERED BEFORE THE TWO-MINUTE WARNING'],['TWO LARGES','ONE EXTRA POINT OF CHEESE'],['$5.99 GAME DAY DEAL','END ZONE PIZZA']][ph];
    txt(L[0],210,72,'#b3261e',2,'c');wrap(L[1],22).forEach((l,i)=>txt(l,210,94+i*8,'#1a0f05',1,'c'));
  } else if(a==='insure'){
    rect(0,0,W,H,'#d7ecf7');rect(0,128,W,52,'#7fbf6a');helmet(160,112,16,0,1);
    ctx.fillStyle='#2e5bd6';ctx.beginPath();ctx.arc(160,82,40,Math.PI,0);ctx.fill();rect(159,82,2,26,'#333');
    for(let i=0;i<14;i++){const x=(i*37+u*40)%W,y=(i*53+u*90)%120;rect(x,y,1,4,'#6aa6d8');}
    const L=[['FUMBLED YOUR FENDER?',''],['HELMETGUARD HAS YOU COVERED','HOME · AUTO · HELMET'],['HELMETGUARD INSURANCE','CALL 1-800-555-0124']][ph];
    txtS(L[0],160,14,'#14306b',2,'c','#fff');txt(L[1],160,150,'#14306b',1,'c');
  } else if(a==='wings'){
    stripes(t,'#e0582a','#e8693e');rect(126,80,68,52,'#f4ecd8');rect(126,80,68,6,'#b3261e');txt('PIXEL',160,96,'#b3261e',1,'c');txt('WINGS',160,104,'#b3261e',1,'c');
    for(let i=0;i<5;i++){const x=134+i*12,y=70+Math.sin(u*4+i)*3;disc(x,y,5,'#a0461d');disc(x-1,y-1,2,'#c96a32');}
    const L=[['PIXEL WINGS','50 FLAVORS. 8 BITS EACH.'],['TRY THE NEW','RED ZONE HEAT'],['PIXEL WINGS','ORDER AHEAD AT HALFTIME']][ph];
    txtS(L[0],160,18,'#fff',3,'c','#7a2a10');txt(L[1],160,146,'#fff',2,'c');
  } else {
    stripes(t,NAVY,'#12224d');rect(0,56,W,40,ORANGE);txtS('PGN',160,62,'#1a0f05',4,'c','rgba(255,255,255,.3)');
    const L=[['EVERY GAME. EVERY DOWN.','ALL DAY. ALL NIGHT.'],['RECRUITING. THE PORTAL. A TITLE.','EVERY SEASON, EVERY FEW DAYS.'],['THE PIXEL GRIDIRON NETWORK','CHANNEL 24']][ph];
    txt(L[0],160,24,CREAM,2,'c');txt(L[1],160,120,GOLD,1,'c');
  }
  rect(W-60,H-10,58,8,'rgba(0,0,0,.45)');txt('ADVERTISEMENT',W-31,H-9,'#ddd',1,'c');
}

/* ============================== AUDIO ============================== */
let AC=null,crowdGain=null,soundOn=false,baseCrowd=0;
function initAudio(){
  if(AC)return;try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){AC=null;return;}
  const len=AC.sampleRate*2,buf=AC.createBuffer(1,len,AC.sampleRate),d=buf.getChannelData(0);let b=0;for(let i=0;i<len;i++){b=0.97*b+0.03*(Math.random()*2-1);d[i]=b*3;}
  const src=AC.createBufferSource();src.buffer=buf;src.loop=true;const f=AC.createBiquadFilter();f.type='bandpass';f.frequency.value=700;f.Q.value=0.6;
  crowdGain=AC.createGain();crowdGain.gain.value=0;src.connect(f).connect(crowdGain).connect(AC.destination);src.start();
}
function tone(freq,t0,dur,type='square',vol=0.06){const o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(freq,AC.currentTime+t0);
  g.gain.setValueAtTime(vol,AC.currentTime+t0);g.gain.exponentialRampToValueAtTime(0.0001,AC.currentTime+t0+dur);o.connect(g).connect(AC.destination);o.start(AC.currentTime+t0);o.stop(AC.currentTime+t0+dur+0.05);}
function swell(v,dur){if(!crowdGain)return;const g=crowdGain.gain,n=AC.currentTime;g.cancelScheduledValues(n);g.setValueAtTime(g.value,n);g.linearRampToValueAtTime(v,n+0.3);g.linearRampToValueAtTime(baseCrowd,n+dur);}
function sfx(kind){
  if(!soundOn||!AC)return;
  if(kind==='whistle'){const o=AC.createOscillator(),l=AC.createOscillator(),lg=AC.createGain(),g=AC.createGain();o.frequency.value=2900;l.frequency.value=28;lg.gain.value=120;l.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001,AC.currentTime);g.gain.exponentialRampToValueAtTime(0.05,AC.currentTime+0.02);g.gain.exponentialRampToValueAtTime(0.0001,AC.currentTime+0.35);o.connect(g).connect(AC.destination);o.start();l.start();o.stop(AC.currentTime+0.4);l.stop(AC.currentTime+0.4);}
  if(kind==='td'){[523,659,784,1047,784,1047].forEach((f,i)=>tone(f,i*0.11,0.16));swell(0.5,3);}
  if(kind==='crowd')swell(0.3,2);
  if(kind==='sting')[392,523,659].forEach((f,i)=>tone(f,i*0.09,0.14,'triangle',0.08));
}

/* ============================== MAIN LOOP ============================== */
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
let lastSeg='',segStartWall=0,lastFrame=performance.now(),lastUi=0,tvReady=false;
function staticNoise(k){const img=ctx.getImageData(0,0,W,H),d=img.data;for(let i=0;i<d.length;i+=4){const v=Math.random()*255;d[i]=lerp(d[i],v,k);d[i+1]=lerp(d[i+1],v,k);d[i+2]=lerp(d[i+2],v,k);}ctx.putImageData(img,0,0);}
function drawTuning(t){staticNoise(1);rect(80,78,160,24,'rgba(5,9,19,.85)');txt('TUNING IN…',160,83,GOLD,2,'c');}
function frame(){
  const wall=performance.now(),dt=Math.min(0.1,(wall-lastFrame)/1000);lastFrame=wall;
  const ms=nowMs(),L=locate(ms),t=ms/1000;
  if(!tvReady){drawTuning(t);requestAnimationFrame(frame);return;}
  const B=broadcast(L.slotG),seg=B.segs.find(x=>L.s>=x.t0&&L.s<x.t1)||B.segs[B.segs.length-1],segKey=B.slotG+':'+seg.i;
  if(segKey!==lastSeg){if(lastSeg){segStartWall=wall;if(seg.type!=='game')sfx('sting');}lastSeg=segKey;if(seg.type!=='game')lastPlayKey='';}
  excite=Math.max(0,excite-dt);
  baseCrowd=soundOn&&(seg.type==='game'||seg.type==='replay')?0.12:0;
  if(crowdGain&&soundOn&&excite<=0)crowdGain.gain.setTargetAtTime(baseCrowd,AC.currentTime,0.5);
  if(crowdGain&&!soundOn)crowdGain.gain.setTargetAtTime(0,AC.currentTime,0.1);
  if(seg.type==='studio')drawStudio(B,seg,L.s,t);else if(seg.type==='board')drawBoard(B,seg,L.s,t);else if(seg.type==='matchup')drawMatchup(B,seg,L.s,t);
  else if(seg.type==='game')drawGame(B,seg,L.s,t,dt);else if(seg.type==='replay')drawReplay(B,seg,L.s,t,dt);else drawAd(seg,L.s,t);
  if(seg.type!=='ad')drawTicker(dt);
  const since=(wall-segStartWall)/1000;if(!reduce&&segStartWall&&since<0.45)staticNoise(1-since/0.45);
  if(ms-lastUi>1000){lastUi=ms;if(window.onTvTick)window.onTvTick(B,seg,L);}
  requestAnimationFrame(frame);
}
function tvSetTime(iso){timeOffset=iso?new Date(iso).getTime()-Date.now():0;tick.str='';tick.x=W*0.4;lastSeg='';lastPlayKey='';BC.clear();}
requestAnimationFrame(frame);
