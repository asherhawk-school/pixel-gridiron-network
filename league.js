'use strict';
/* Pixel Gridiron Network: league engine.
   Everything is a pure function of the clock: teams, rosters, games, recruiting and the
   transfer portal are rebuilt from seeds, so every viewer sees the same league. */

/* ============================== UTIL ============================== */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function hashN(...xs){let h=2166136261>>>0;for(const x of xs){const s=String(x);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}h^=0x7c;h=Math.imul(h,16777619);}return h>>>0;}
const rngOf=(...k)=>mulberry32(hashN(...k));
const cl=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t, ease=t=>{t=cl(t,0,1);return t*(2-t);};
const nrmR=r=>(r()+r()+r()+r()-2)*1.73, riR=(r,a,b)=>a+Math.floor(r()*(b-a+1));
function shuffle(a,r){for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function pickW(r,items,w){let s=0;for(const x of w)s+=x;let u=r()*s;for(let i=0;i<items.length;i++){u-=w[i];if(u<=0)return items[i];}return items[items.length-1];}
function memo(fn,max=600){const m=new Map();const f=(...a)=>{const k=a.join('|');if(m.has(k))return m.get(k);const v=fn(...a);m.set(k,v);if(m.size>max)m.delete(m.keys().next().value);return v;};f.cache=m;return f;}

/* ============================== TIME ============================== */
// One 30-minute slot = one televised game. 12 slots = one league week (6 hours).
// Season = 12 regular weeks + championship week + bowl/playoff week + offseason week = 90 hours.
const EPOCH=Date.UTC(2026,10,1), SLOT=1800, SPW=12, WEEKS=15, SPS=SPW*WEEKS, REGW=12, ERA=16;
const IDX_REG_END=144, IDX_CCG_END=149, IDX_CFP1_END=153, IDX_QF_END=160, IDX_SF_END=166, IDX_SIGN=168, IDX_PORTAL=156;
let timeOffset=0;
const nowMs=()=>Date.now()+timeOffset;
function locate(ms){
  const sec=(ms-EPOCH)/1000, slotG=Math.floor(sec/SLOT), s=sec-slotG*SLOT;
  const S=Math.floor(slotG/SPS), inS=slotG-S*SPS;
  return {slotG,s,S,inS,w:Math.floor(inS/SPW),slot:inS%SPW,n:inS+(s>=1680?1:0),fIdx:inS+s/SLOT};
}
const slotStart=slotG=>EPOCH+slotG*SLOT*1000;
const idxMs=(S,idx)=>slotStart(S*SPS)+idx*SLOT*1000;
const fmtTime=ms=>new Date(ms).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}).replace(/\s+/g,' ');
const fmtDay=ms=>new Date(ms).toLocaleDateString([], {weekday:'short'});
const fmtClock=c=>{c=Math.max(0,Math.ceil(c));return Math.floor(c/60)+':'+String(c%60).padStart(2,'0');};
const ORD=['','1ST','2ND','3RD','4TH'];
const seasonYear=S=>2026+S;

/* ============================== TEAMS ============================== */
const CONFS=[
  {key:'MAG',name:'Magnolia Conference',short:'MAGNOLIA'},
  {key:'BNC',name:'Big North Conference',short:'BIG NORTH'},
  {key:'PRA',name:'Prairie Conference',short:'PRAIRIE'},
  {key:'ASC',name:'Atlantic Seaboard Conference',short:'ATLANTIC'},
  {key:'PFC',name:'Pacific Frontier Conference',short:'PACIFIC'},
];
// [school, mascot, abbr, primary, secondary, base prestige, home state]
const TEAM_SRC=[[
 ['Tuscaloosa','Tide','TUS','#9e1b32','#e8e8e8',95,'AL'],['Athens','Hounds','ATH','#ba0c2f','#111111',94,'GA'],
 ['Austin','Steers','AUS','#bf5700','#ffffff',91,'TX'],['Baton Rouge','Bengals','BRB','#461d7c','#fdd023',87,'LA'],
 ['Lee County','Plainsmen','LEE','#0c2340','#e87722',84,'AL'],['Gainesville','Crocs','GNV','#0021a5','#fa4616',84,'FL'],
 ['Knoxville','Smokies','KNX','#ff8200','#ffffff',84,'TN'],['Norman','Boomers','NOR','#841617','#fdf9d8',85,'OK'],
 ['College Station','Cadets','CST','#500000','#ffffff',84,'TX'],['Oxford','Landsharks','OXF','#ce1126','#14213d',82,'MS'],
 ['Starkville','Cowbells','STK','#660000','#ffffff',72,'MS'],['Fayetteville','Hogs','FAY','#9d2235','#ffffff',74,'AR'],
 ['Columbia','Stripes','CMO','#f1b82d','#111111',78,'MO'],['Lexington','Thoroughbreds','LEX','#0033a0','#ffffff',72,'KY'],
 ['Palmetto','Roosters','PAL','#73000a','#111111',75,'SC'],['Music City','Admirals','MCA','#111111','#cfae70',66,'TN'],
],[
 ['Columbus','Bucks','CLB','#bb0000','#a7b1b7',96,'OH'],['Ann Arbor','Wolves','ANN','#00274c','#ffcb05',91,'MI'],
 ['Happy Valley','Lions','HVL','#041e42','#ffffff',88,'PA'],['Eugene','Mallards','EUG','#154733','#fee123',90,'OR'],
 ['Exposition Park','Gladiators','EXP','#990000','#ffc72c',85,'CA'],['Westwood','Grizzlies','WWD','#2d68c4','#f2a900',77,'CA'],
 ['Montlake','Malamutes','MON','#4b2e83','#b7a57a',80,'WA'],['Madison','Minks','MAD','#c5050c','#ffffff',79,'WI'],
 ['Iowa City','Hawks','ICH','#111111','#ffcd00',77,'IA'],['Lincoln','Harvesters','LIN','#e41c38','#f5f1e7',77,'NE'],
 ['East Lansing','Hoplites','ELH','#18453b','#ffffff',76,'MI'],['Twin Cities','Prairie Dogs','TWC','#7a0019','#ffcc33',72,'MN'],
 ['Champaign','Fighting Corn','CHA','#e84a27','#13294b',71,'IL'],['West Lafayette','Boilers','WLF','#111111','#cfb991',68,'IN'],
 ['Bloomington','Limestones','BLM','#990000','#eeedeb',74,'IN'],['College Park','Turtles','CPK','#e03a3e','#ffd520',70,'MD'],
 ['Raritan','Knights','RAR','#cc0033','#111111',66,'NJ'],['Evanston','Lakers','EVN','#4e2a84','#ffffff',67,'IL'],
],[
 ['Salt Lake','Redtails','SLC','#cc0000','#ffffff',79,'UT'],['Provo','Pioneers','PRV','#002e5d','#ffffff',76,'UT'],
 ['Tucson','Saguaros','TUC','#cc0033','#003366',72,'AZ'],['Tempe','Scorchers','TMP','#8c1d40','#ffc627',77,'AZ'],
 ['Boulder','Bison','BOU','#111111','#cfb87c',76,'CO'],['Manhattan','Harvest Cats','MHK','#512888','#ffffff',76,'KS'],
 ['Lawrence','Jays','LAW','#0051ba','#e8000d',68,'KS'],['Ames','Twisters','AME','#c8102e','#f1be48',75,'IA'],
 ['Stillwater','Wranglers','STW','#ff7300','#111111',74,'OK'],['Lubbock','Riders','LUB','#cc0000','#111111',75,'TX'],
 ['Fort Worth','Toads','FTW','#4d1979','#ffffff',74,'TX'],['Waco','Cubs','WAC','#154734','#ffb81c',72,'TX'],
 ['Houston','Pumas','HOU','#c8102e','#ffffff',68,'TX'],['Queen City','Cats','QCC','#e00122','#111111',69,'OH'],
 ['Orlando','Astronauts','ORL','#111111','#ba9b37',70,'FL'],['Morgantown','Miners','MGT','#002855','#eaaa00',70,'WV'],
],[
 ['Upstate','Paws','UPS','#f56600','#522d80',88,'SC'],['Tallahassee','Spears','TLH','#782f40','#ceb888',84,'FL'],
 ['Coral Gables','Ibis','CGB','#005030','#f47321',85,'FL'],['South Bend','Shamrocks','SBN','#0c2340','#c99700',90,'IN'],
 ['Chapel Hill','Heels','CHH','#7bafd4','#13294b',73,'NC'],['Raleigh','Pack','RAL','#cc0000','#ffffff',73,'NC'],
 ['Durham','Imps','DUR','#003087','#ffffff',70,'NC'],['Blacksburg','Gobblers','BBG','#861f41','#e5751f',72,'VA'],
 ['Charlottesville','Swords','CVL','#232d4b','#f84c1e',67,'VA'],['Derby City','Redbirds','DCR','#ad0000','#111111',76,'KY'],
 ['Steel City','Lynx','SCL','#003594','#ffb81c',71,'PA'],['Salt City','Citrus','SYR','#f76900','#002d72',68,'NY'],
 ['Atlanta','Hornets','ATL','#003057','#b3a369',72,'GA'],['Chestnut Hill','Falcons','CHF','#98002e','#bc9b6a',69,'MA'],
],[
 ['Corvallis','Lumberjacks','COR','#dc4405','#111111',66,'OR'],['Pullman','Palouse','PUL','#981e32','#a7b1b7',66,'WA'],
 ['Boise','Mustangs','BOI','#0033a0','#d64309',75,'ID'],['San Diego','Surf','SDS','#a6192e','#111111',64,'CA'],
 ['Fresno','Valley Dogs','FRE','#db0032','#002e6d',64,'CA'],['Fort Collins','Bighorns','FCO','#1e4d2b','#c8c372',60,'CO'],
 ['Academy','Aviators','AFA','#003087','#8a8d8f',62,'CO'],['Las Vegas','Aces','LVA','#cf0a2c','#8a8d8f',63,'NV'],
 ['Honolulu','Waves','HNL','#024731','#ffffff',58,'HI'],['Logan','Bulls','LOG','#0f2439','#ffffff',58,'UT'],
]];
const TEAMS=[];
TEAM_SRC.forEach((list,conf)=>list.forEach(([name,mascot,abbr,c1,c2,base,state])=>TEAMS.push({i:TEAMS.length,name,mascot,abbr,c1,c2,base,state,conf,full:`${name} ${mascot}`})));
const NT=TEAMS.length;
const byAbbr=Object.fromEntries(TEAMS.map(t=>[t.abbr,t]));
const lum=h=>{const n=parseInt(h.slice(1),16);return(0.299*(n>>16)+0.587*((n>>8)&255)+0.114*(n&255))/255;};

/* ============================== GEOGRAPHY + NAMES ============================== */
const REGION={AL:'SE',GA:'SE',FL:'SE',SC:'SE',TN:'SE',MS:'SE',LA:'SC',TX:'SC',AR:'SC',OK:'SC',OH:'MW',MI:'MW',IN:'MW',IL:'MW',WI:'MW',MN:'MW',IA:'PL',NE:'PL',MO:'PL',KS:'PL',PA:'NE',NJ:'NE',NY:'NE',MA:'NE',MD:'MA',VA:'MA',NC:'MA',KY:'MA',WV:'MA',CA:'W',OR:'W',WA:'W',NV:'W',HI:'W',UT:'MT',CO:'MT',AZ:'MT',ID:'MT'};
const STATE_W={TX:13,FL:12,CA:9,GA:9,OH:4,AL:4,LA:4,NC:3.5,PA:3,VA:3,TN:3,SC:2.5,MS:2.5,NJ:2.5,MI:2.5,IL:2,MD:2,AZ:2,WA:1.5,MO:1.5,OK:1.5,IN:1.3,KY:1,AR:1,UT:1,CO:1,NY:1,MN:.8,WI:.8,KS:.6,NV:.8,OR:.7,IA:.6,NE:.4,HI:.4,MA:.6,WV:.3,ID:.2};
const STATES=Object.keys(STATE_W), STATE_WV=STATES.map(s=>STATE_W[s]);
const CITIES={TX:['Houston','Dallas','Katy','Austin','San Antonio','Duncanville','Allen','Fort Worth','Tyler','Beaumont'],FL:['Miami','Tampa','Jacksonville','Fort Lauderdale','Orlando','Bradenton','Tallahassee','Pensacola'],CA:['Los Angeles','Santa Ana','San Diego','Sacramento','Corona','Bellflower','Oakland','Fresno'],GA:['Atlanta','Buford','Savannah','Valdosta','Columbus','Marietta','Macon'],OH:['Cincinnati','Cleveland','Columbus','Toledo','Massillon'],AL:['Birmingham','Mobile','Montgomery','Hoover','Huntsville'],LA:['New Orleans','Baton Rouge','Shreveport','Lafayette','Monroe'],NC:['Charlotte','Raleigh','Greensboro','Durham','Fayetteville'],PA:['Pittsburgh','Philadelphia','Harrisburg','Erie'],VA:['Richmond','Norfolk','Chesapeake','Roanoke'],TN:['Memphis','Nashville','Knoxville','Chattanooga'],SC:['Columbia','Greenville','Charleston','Spartanburg'],MS:['Jackson','Hattiesburg','Tupelo','Biloxi'],NJ:['Newark','Paterson','Trenton','Montclair'],MI:['Detroit','Grand Rapids','Lansing','Saginaw'],IL:['Chicago','Peoria','Joliet','Naperville'],MD:['Baltimore','Silver Spring','Annapolis'],AZ:['Phoenix','Chandler','Tucson','Mesa'],WA:['Seattle','Tacoma','Spokane'],MO:['St. Louis','Kansas City','Springfield'],OK:['Tulsa','Oklahoma City','Lawton'],IN:['Indianapolis','Fort Wayne','Carmel'],KY:['Louisville','Lexington','Bowling Green'],AR:['Little Rock','Fayetteville','Pine Bluff'],UT:['Salt Lake City','Provo','Ogden'],CO:['Denver','Aurora','Colorado Springs'],NY:['Buffalo','Rochester','Brooklyn'],MN:['Minneapolis','St. Paul','Eden Prairie'],WI:['Milwaukee','Madison','Green Bay'],KS:['Wichita','Topeka','Olathe'],NV:['Las Vegas','Henderson','Reno'],OR:['Portland','Salem','Eugene'],IA:['Des Moines','Cedar Rapids','Iowa City'],NE:['Omaha','Lincoln'],HI:['Honolulu','Kailua','Hilo'],MA:['Boston','Worcester','Springfield'],WV:['Charleston','Huntington'],ID:['Boise','Nampa']};
const FIRST=['Jalen','Marcus','Tyler','Caleb','Trey','Devin','Jordan','Isaiah','Elijah','Malik','Brandon','Cameron','Xavier','Darius','Jaylen','Bryce','Mason','Ethan','Logan','Cole','Tre','Josiah','Amari','Kendrick','Dante','Jace','Carson','Gavin','Nolan','Owen','Quinn','Reggie','Terrell','Andre','Cedric','DeShawn','Jamal','Keon','Lamar','Nate','Omar','Rashad','Shane','Tavion','Vernon','Wesley','Zion','Aiden','Blake','Brody','Chase','Colby','Dylan','Eli','Grant','Hunter','Ian','Jake','Kai','Landon','Max','Micah','Noah','Parker','Reid','Ryan','Sam','Tanner','Trent','Tucker','Ty','Wyatt','Jaxon','Kyler','Dallas','Hayden','Bo','Cade','Drew','Kade','Luke','Matt','Pierce','Rhett','Spencer','Tate','Brock','Desmond','Emmanuel','Fabian','Hassan','Jerome','Kamari','Laquan','Mekhi','Nehemiah','Quentin','Rodney','Santana','Tariq','Ulysses','Victor','Walker','Yusuf','Zay','Javon','Kobe','Treylon','Armani','Bijan','Cortez','Davion','Keshawn','Marquise','Tyrese','Jahmir','Sincere','Nico','Mateo','Diego','Luis','Kalani','Keoni','Tua'];
const LAST=['Holloway','Reed','Carter','Williams','Johnson','Brooks','Jackson','Harris','Coleman','Washington','Bennett','Hayes','Mitchell','Simmons','Foster','Bryant','Jenkins','Perry','Powell','Patterson','Hughes','Butler','Barnes','Henderson','Wallace','Griffin','Ross','Sanders','Price','Russell','Howard','Ward','Torres','Peterson','Gray','Ramirez','James','Watson','Kelly','Long','Ellis','Graham','Fisher','Hunt','Gibson','Stephens','Dixon','Robertson','Black','Holmes','Stone','Meyer','Boyd','Mills','Warren','Fox','Rose','Rice','Moreno','Schmidt','Patel','Ferguson','Nichols','Herrera','Medina','Ryan','Fernandez','Weaver','Daniels','Stevens','Gardner','Payne','Kelley','Dunn','Pierce','Arnold','Tran','Spencer','Peters','Hawkins','Grant','Hansen','Castro','Hoffman','Hart','Elliott','Cunningham','Knight','Bradley','Lane','Andrews','Ruiz','Harper','Fox','Riley','Armstrong','Carpenter','Freeman','Willis','Hale','Burke','Shaw','Mack','Lowe','Cross','Odom','Banks','Crawford','Tate','Monroe','McCoy','Vance','Booker','Pruitt','Gaines','Battle','Mosley','Blackwell','Whitfield','Thornton','Calloway','Kingsley','Dawson','Mercer','Langston','Pope','Rivers','Sutton','Hollins','Abernathy','Okafor','Adeyemi','Nwosu','Mahoe','Kealoha','Fuimaono','Tuiasosopo','Sapolu','Lindqvist','Kowalski','Novak','Becker','Brennan','Gallagher','McBride','Quinlan','Fitzgerald','Doyle','Sullivan','Delgado','Ortega','Salazar','Navarro','Vargas','Fuentes','Zimmerman','Schaefer','Dorsey','Merritt','Pickett','Hairston','Lockett','Whitlock','Stallworth','Bolden','Strickland','Goodwin','Ivory','Pringle','Swain','Kimbrough','Toussaint','Belcher','Rudd','Ransom','Keel','Story','Sledge','Faulk','Rome','Hightower','Mayfield','Burrow','Easley'];
const COACH_FIRST=['Mike','Bill','Steve','Dan','Gary','Kirk','Mark','Jim','Tom','Rich','Brent','Lane','Kalen','Dabo','Ryan','Dave','Jeff','Bret','Sonny','Chip','Kevin','Matt','Pete','Scott'];

/* ============================== PLAYERS ============================== */
const POS=['QB','RB','WR','TE','OL','DL','LB','CB','S','K','P'];
const ROSTER_T={QB:4,RB:5,WR:10,TE:4,OL:16,DL:14,LB:10,CB:11,S:7,K:2,P:2};
const STARTERS={QB:1,RB:1,WR:3,TE:1,OL:5,DL:4,LB:3,CB:2,S:2,K:1,P:1};
const POS_W=[6,7,13,5,17,17,11,12,8,2,2];
const BODY={QB:[73,77,200,232],RB:[68,73,190,222],WR:[70,76,172,210],TE:[75,79,235,260],OL:[75,79,290,330],DL:[74,78,260,310],LB:[72,76,222,245],CB:[69,74,175,198],S:[70,74,190,212],K:[69,74,175,200],P:[72,76,190,215]};
const NUMS={QB:[[1,19]],RB:[[1,49]],WR:[[1,19],[80,89]],TE:[[80,89],[40,49]],OL:[[50,79]],DL:[[90,99],[50,59]],LB:[[1,59]],CB:[[1,39]],S:[[1,49]],K:[[1,49],[90,99]],P:[[1,49],[90,99]]};
const MAXR=85;
const STAR_BAND={5:[0.983,1.0],4:[0.89,0.983],3:[0.80,0.89],2:[0.70,0.80]};
const CLASS=['FR','SO','JR','SR'];
const classLabel=p=>(p.rs?'RS ':'')+CLASS[Math.min(3,p.el)];
const htStr=h=>`${Math.floor(h/12)}-${h%12}`;

function homeState(r,T){const u=r();if(u<0.42)return T.state;if(u<0.66){const reg=STATES.filter(s=>REGION[s]===REGION[T.state]);return reg[Math.floor(r()*reg.length)];}return pickW(r,STATES,STATE_WV);}
function makeProspect(r,pos,stars,state,rating){
  const b=STAR_BAND[stars];rating=rating??lerp(b[0],b[1],r());
  const ovr=cl(Math.round(52+(rating-0.75)*100+nrmR(r)*3),35,85);
  const pot=cl(Math.round(ovr+10+(rating-0.75)*60+nrmR(r)*5),ovr+2,99);
  const [h0,h1,w0,w1]=BODY[pos],cs=CITIES[state];
  return {f:FIRST[Math.floor(r()*FIRST.length)],l:LAST[Math.floor(r()*LAST.length)],pos,st:state,city:cs[Math.floor(r()*cs.length)],
    ht:riR(r,h0,h1),wt:Math.round(riR(r,w0,w1)/2)*2,stars,rating:Math.round(rating*10000)/10000,ovr,pot};
}
function develop(r,p){const g=Math.round((p.pot-p.ovr)*0.33+nrmR(r)*2.2+0.5);p.ovr=cl(p.ovr+Math.max(-2,g),30,99);p.wt=Math.min(p.wt+riR(r,0,6),BODY[p.pos][3]+20);}
function starsFor(r,pr){const x=(pr-55)/45,p5=Math.max(0,x-0.5)*0.2,p4=cl(0.04+x*0.5,0,0.62),p2=cl(0.45-x*0.6,0.02,0.5),u=r();if(u<p5)return 5;if(u<p5+p4)return 4;if(u<1-p2)return 3;return 2;}
function newCoach(r){return {name:`${COACH_FIRST[Math.floor(r()*COACH_FIRST.length)]} ${LAST[Math.floor(r()*LAST.length)]}`,yrs:1+Math.floor(r()*8)};}
function assignNumbers(list,r){
  const used=new Set();for(const p of list)if(p.num!=null){if(used.has(p.num))p.num=null;else used.add(p.num);}
  for(const p of list){if(p.num!=null)continue;const opts=[];for(const [a,b] of NUMS[p.pos])for(let n=a;n<=b;n++)if(!used.has(n))opts.push(n);
    if(!opts.length)for(let n=0;n<=99;n++)if(!used.has(n))opts.push(n);p.num=opts.length?opts[Math.floor(r()*opts.length)]:riR(r,1,99);used.add(p.num);}
}
function finalizeState(st,r){
  const by=TEAMS.map(()=>[]);for(const p of st.players)by[p.team].push(p);
  const keep=new Set();
  by.forEach(list=>{
    if(list.length>MAXR){list.sort((a,b)=>(a.el===0&&a.yr===1?1:0)-(b.el===0&&b.yr===1?1:0)||a.ovr-b.ovr);list.splice(0,list.length-MAXR);}
    assignNumbers(list,r);for(const p of list)keep.add(p);
  });
  st.players=st.players.filter(p=>keep.has(p));
  st.byId=new Map(st.players.map(p=>[p.id,p]));
  st.roster=by.map(list=>list.sort((a,b)=>POS.indexOf(a.pos)-POS.indexOf(b.pos)||b.ovr-a.ovr).map(p=>p.id));
  return st;
}
function genesis(S){
  const r=rngOf('genesis',S),st={S,players:[],nid:S*100000+1,prestige:TEAMS.map(t=>t.base),coach:TEAMS.map(()=>newCoach(r))};
  for(const T of TEAMS)for(const pos of POS)for(let k=0;k<ROSTER_T[pos];k++){
    const yrs=pickW(r,[1,2,3,4,5],[25,24,22,20,9]),p=makeProspect(r,pos,starsFor(r,T.base),homeState(r,T));
    const rs=yrs===5||(yrs>=2&&r()<0.22);for(let y=1;y<yrs;y++)develop(r,p);
    Object.assign(p,{id:st.nid++,team:T.i,yr:yrs,el:Math.min(3,yrs-1-(rs?1:0)),rs,from:null});st.players.push(p);
  }
  return finalizeState(st,r);
}
// Rosters chain season to season; a fresh league is drafted every ERA seasons (~2 months) so first loads stay fast.
// Browsers cache the latest start-of-season state, so a returning viewer skips the chain entirely.
const STATE_KEY='pgn-state-v2-';
function packState(st){return JSON.stringify({S:st.S,nid:st.nid,prestige:st.prestige,coach:st.coach,players:st.players});}
function unpackState(js){const o=JSON.parse(js);return finalizeState(o,()=>0.5);}
const stateStart=memo(S=>{
  if(S%ERA===0)return genesis(S);
  try{if(typeof localStorage!=='undefined'){const js=localStorage.getItem(STATE_KEY+S);if(js)return unpackState(js);}}catch(e){}
  const st=transition(S-1);
  try{if(typeof localStorage!=='undefined'){for(let k=0;k<localStorage.length;k++){const key=localStorage.key(k);if(key&&key.startsWith('pgn-state-')&&key!==STATE_KEY+S)localStorage.removeItem(key);}localStorage.setItem(STATE_KEY+S,packState(st));}}catch(e){}
  return st;
},4);

/* ============================== TEAM CONTEXT ============================== */
const teamCtx=memo((S,t)=>{
  const st=stateStart(S),ros=st.roster[t].map(id=>st.byId.get(id)),by={};
  for(const p of POS)by[p]=[];for(const p of ros)by[p.pos].push(p);
  for(const p of POS)by[p].sort((a,b)=>b.ovr-a.ovr);
  const avg=(pos,n)=>{const a=by[pos].slice(0,n);return a.length?a.reduce((s,p)=>s+p.ovr,0)/a.length:40;};
  const off=0.30*avg('QB',1)+0.10*avg('RB',1)+0.20*avg('WR',3)+0.05*avg('TE',1)+0.35*avg('OL',5);
  const def=0.35*avg('DL',4)+0.25*avg('LB',3)+0.25*avg('CB',2)+0.15*avg('S',2);
  const depth={};for(const pos of POS)by[pos].forEach((p,d)=>depth[p.id]=d);
  return {t,ros,by,off,def,ovr:(off+def)/2,kick:avg('K',1),depth,prestige:st.prestige[t],coach:st.coach[t]};
},400);

/* ============================== GAME SIM ============================== */
const NOM={run:8,pass:9,inc:7.5,sack:8,int:10,fumble:9,kickoff:9,punt:10,fg:9,pat:6,two:8,kneel:5,qend:4.5};
const SIMC=new Map(), FINALS=new Map();
const lastName=p=>p?p.l.toUpperCase():'?';
function simulate(g){
  if(SIMC.has(g.seed))return SIMC.get(g.seed);
  const C=[teamCtx(g.S,g.home),teamCtx(g.S,g.away)],AB=[TEAMS[g.home].abbr,TEAMS[g.away].abbr];
  const hfa=g.neutral?0:3;
  const r=mulberry32(g.seed),ri=(a,b)=>a+Math.floor(r()*(b-a+1)),nrm=()=>(r()+r()+r()+r()-2)*1.73;
  const pk=(arr,w)=>{const a=arr.filter(Boolean),ww=w.slice(0,a.length);return a.length?pickW(r,a,ww):null;};
  const by=t=>C[t].by;
  const qb=t=>by(t).QB[0],kk=t=>by(t).K[0]||by(t).P[0],pp=t=>by(t).P[0]||by(t).K[0];
  const rusher=t=>pk([by(t).RB[0],by(t).RB[1],by(t).QB[0]],[68,22,10]);
  const target=t=>pk([by(t).WR[0],by(t).WR[1],by(t).WR[2],by(t).TE[0],by(t).RB[0],by(t).WR[3]],[28,22,16,16,10,8]);
  const tackler=t=>pk([...by(t).LB.slice(0,3),...by(t).S.slice(0,2),...by(t).CB.slice(0,2),...by(t).DL.slice(0,4)],[14,13,12,10,9,7,7,6,6,6,5]);
  const sacker=t=>pk([...by(t).DL.slice(0,4),by(t).LB[0]],[22,22,18,18,20]);
  const picker=t=>pk([by(t).CB[0],by(t).CB[1],by(t).S[0],by(t).S[1],by(t).LB[0]],[26,24,20,16,14]);
  const returner=t=>by(t).WR[3]||by(t).RB[1]||by(t).WR[0];
  const score=[0,0],plays=[];
  let q=1,clock=900,off=0,yd=25,down=1,togo=10,drive=true;
  const X=(t,y)=>t===0?y:100-y;
  const base=(kind,team)=>({kind,team,q,clock0:clock,down,togo,yd,poss:off,s0:score.slice(),x0:X(off,yd)});
  const finish=(P,run)=>{if(q<=4)clock=Math.max(0,clock-run);P.clock1=clock;P.s1=score.slice();P.ln=plays.length;plays.push(P);};
  const changePoss=(t,y)=>{off=t;yd=cl(y,1,99);down=1;togo=Math.min(10,100-yd);if(q>4)drive=false;};
  const hurryNow=()=>{const lead=score[off]-score[1-off];return q<=4&&(q===2||q===4)&&clock<=120&&(q===2||lead<=0);};
  const df=o=>((C[o].off-C[1-o].def)+(o===0?hfa:-hfa))/100*2.3;
  function tryPoint(t,forceTwo){
    off=t;yd=97;down=0;togo=3;
    const lead=score[t]-score[1-t],two=forceTwo||q>=6||(q===4&&clock<=600&&[-2,-5,1,-10].includes(lead));
    const P=base(two?'two':'pat',t);
    if(two){const ok=r()<0.45+df(t)*0.4,tg=target(t);P.good=ok;P.wr=ri(0,2);P.xc=X(t,100+ri(1,6));P.yc=ri(-8,8);P.x1=P.xc;P.y1=P.yc;if(ok)score[t]+=2;
      P.text=`${AB[t]} TWO-POINT TRY ${ok?`IS GOOD, ${lastName(qb(t))} TO ${lastName(tg)}`:'FAILS'}`;}
    else{const ok=r()<0.965,k=kk(t);P.good=ok;P.yc=ok?0:(r()<0.5?-5:5);if(ok)score[t]+=1;P.st={xp:k&&k.id,team:t,made:ok?1:0};P.text=`${lastName(k)} EXTRA POINT ${ok?'IS GOOD':'IS NO GOOD'}`;}
    finish(P,0);
  }
  function afterTD(t){tryPoint(t,false);if(q<=4)kickoff(t);else drive=false;}
  function kickoff(k,spot=35){
    const rc=1-k,P=base('kickoff',k),ret=returner(rc);P.x0=X(k,spot);P.poss=rc;P.down=0;
    let land,end,tb=false;
    land=spot===35?100-spot-ri(58,71):100-spot-ri(40,52);
    if(land<=0&&r()<0.86){tb=true;end=25;land=Math.max(land,-8);P.text=`${lastName(kk(k))} KICKOFF · TOUCHBACK`;}
    else{land=Math.max(land,-6);let rr=ri(16,30);if(r()<0.05)rr=ri(30,55);if(r()<0.006)rr=200;end=Math.min(100,Math.max(land,0)+rr);
      P.text=end>=100?`${lastName(ret)} KICK RETURN TOUCHDOWN!`:`${lastName(ret)} RETURNS KICK ${end-Math.max(land,0)} YDS`;}
    P.tb=tb;P.xc=X(rc,land);P.yc=ri(-10,10);P.x1=X(rc,end);P.y1=ri(-8,8);
    if(!tb)P.st={team:rc,ret:ret&&ret.id,yds:end-Math.max(land,0),tk:end<100?(tackler(k)||{}).id:null};
    if(end>=100){score[rc]+=6;P.td=true;P.st.td=1;finish(P,12);off=rc;afterTD(rc);return;}
    finish(P,tb?0:ri(5,8));changePoss(rc,end);
  }
  function punt(){
    const o=off,d=1-o,P=base('punt',o),dist=ri(36,50),pu=pp(o),ret=returner(d);let land=yd+dist,end,tb=false,fair=false,rr=0;
    if(land>=100){tb=true;land=Math.min(land,105);end=20;}
    else{fair=r()<0.4;rr=fair?0:ri(0,12);if(!fair&&r()<0.04)rr=ri(15,40);if(!fair&&r()<0.004)rr=200;end=Math.min(100,(100-land)+rr);}
    P.xc=X(o,land);P.yc=ri(-10,10);P.x1=X(d,end);P.y1=P.yc*0.4;P.fair=fair||tb;
    P.st={team:o,punt:pu&&pu.id,pyds:dist};
    P.text=`${lastName(pu)} PUNTS ${dist} YDS`+(tb?' · TOUCHBACK':fair?' · FAIR CATCH':end>=100?` · ${lastName(ret)} TAKES IT TO THE HOUSE!`:` · ${lastName(ret)} RETURNS ${rr}`);
    if(end>=100){score[d]+=6;P.td=true;P.st.ret=ret&&ret.id;P.st.rteam=d;P.st.ryds=100-land;P.st.td=1;finish(P,10);off=d;afterTD(d);return;}
    finish(P,tb||fair?6:10);changePoss(d,end);
  }
  function fieldGoal(){
    const o=off,d=1-o,P=base('fg',o),dist=100-yd+17,k=kk(o),kr=k?k.ovr:60;
    const p=cl(0.99-Math.max(0,dist-25)*0.016+(kr-75)*0.004,0.15,0.99),ok=r()<p;
    P.good=ok;P.yc=ok?ri(-1,1):(r()<0.5?-5:5);P.dist=dist;P.st={team:o,fg:k&&k.id,made:ok?1:0,dist};
    P.text=`${lastName(k)} ${dist}-YD FIELD GOAL ${ok?'IS GOOD':'IS NO GOOD'}`;
    if(ok){score[o]+=3;finish(P,5);if(q<=4)kickoff(o);else drive=false;}
    else{finish(P,5);changePoss(d,Math.max(20,100-(yd-7)));}
  }
  function advance(P,ny,stop,ps){
    const o=off,d=1-o,g=ny-yd;
    let between=(stop||q>4)?0:(hurryNow()?ri(9,15):ri(28,40));
    if(r()<0.12)between=Math.min(between,4);
    if(ny>=100){score[o]+=6;P.td=true;if(P.st)P.st.td=1;P.text+=' · TOUCHDOWN';if(P.st)P.st.tk=null;finish(P,ps);afterTD(o);return;}
    if(ny<=0){score[d]+=2;P.safety=true;P.text+=' · SAFETY';finish(P,ps);if(q<=4)kickoff(o,20);else drive=false;return;}
    if(g>=togo){P.first=true;yd=ny;down=1;togo=Math.min(10,100-ny);finish(P,ps+between);return;}
    down++;togo-=g;yd=ny;
    if(down>4){P.text+=' · TURNOVER ON DOWNS';P.downs=true;finish(P,ps);changePoss(d,100-ny);return;}
    finish(P,ps+between);
  }
  function runPlay(){
    const o=off,d=1-o,P=base('run',o),rb=rusher(o);
    let g=Math.round(3.7+nrm()*3.1+df(o)*5+((rb?rb.ovr:70)-78)*0.04);
    if(r()<0.022+df(o)*0.035)g=ri(12,42);
    g=Math.max(-4,g);let ny=Math.min(100,yd+g);g=ny-yd;
    P.gain=g;P.x1=X(o,ny);P.y1=ri(-14,14);P.st={team:o,ru:rb&&rb.id,yds:g,tk:(tackler(d)||{}).id};
    if(r()<0.012&&ny>0&&ny<100){const rec=tackler(d);P.kind='fumble';P.to=o;P.st.ff=rec&&rec.id;P.text=`${lastName(rb)} FUMBLES! ${lastName(rec)} RECOVERS FOR ${AB[d]}`;finish(P,6);changePoss(d,100-ny);return;}
    P.text=g>0?`${lastName(rb)} RUSH FOR ${g} YD${g===1?'':'S'}`:g===0?`${lastName(rb)} RUSH, NO GAIN`:`${lastName(rb)} STOPPED FOR A LOSS OF ${-g}`;
    advance(P,ny,false,ri(5,8));
  }
  function passPlay(){
    const o=off,d=1-o,P=base('pass',o),q1=qb(o),tg=target(o),qr=(q1?q1.ovr:65)-78;P.wr=ri(0,2);
    if(r()<0.065-df(o)*0.05){
      const g=-ri(2,9),ny=yd+g,sk=sacker(d);P.kind='sack';P.gain=g;P.x1=X(o,Math.max(-2,ny));P.y1=ri(-3,3);
      P.st={team:o,qb:q1&&q1.id,sack:sk&&sk.id,yds:g};P.text=`${lastName(q1)} SACKED BY ${lastName(sk)} FOR A LOSS OF ${-g}`;advance(P,ny,false,ri(5,7));return;
    }
    const deep=r()<0.17;let air=deep?ri(18,40):ri(1,11);
    if(yd+air>=100)air=100-yd+ri(1,7);
    const cx=Math.min(yd+air,108);P.xc=X(o,cx);P.yc=ri(-20,20);P.air=air;P.deep=deep;
    if(r()<0.03-df(o)*0.025-qr*0.0006){
      const db=picker(d);let ret=ri(0,20);if(r()<0.08)ret+=ri(20,60);
      const spot=cx>=100?0:100-cx;let end=Math.min(100,spot+ret);if(cx>=100&&end<20)end=20;
      P.kind='int';P.to=o;P.x1=X(d,end);P.y1=P.yc*0.5;P.st={team:o,qb:q1&&q1.id,att:1,pick:db&&db.id,dteam:d};
      if(end>=100){score[d]+=6;P.td=true;P.st.pick6=1;P.text=`INTERCEPTED! ${lastName(db)} TAKES IT BACK FOR A TOUCHDOWN!`;finish(P,8);off=d;afterTD(d);return;}
      P.text=`INTERCEPTED! ${lastName(db)} PICKS OFF ${lastName(q1)}`;finish(P,8);changePoss(d,end);return;
    }
    const tr=((tg?tg.ovr:70)-78)*0.003+qr*0.004;
    if(r()<(deep?0.36+df(o)*0.25:0.66+df(o)*0.2)+tr){
      let yac=deep?ri(0,10):ri(0,6);if(r()<0.035)yac+=ri(10,35);
      const ny=Math.min(100,yd+Math.min(air,100-yd)+yac),g=ny-yd;
      P.gain=g;P.x1=X(o,ny);P.y1=cl(P.yc+ri(-6,6),-24,24);
      P.st={team:o,qb:q1&&q1.id,rec:tg&&tg.id,yds:g,att:1,cmp:1,tk:(tackler(d)||{}).id};
      P.text=`${lastName(q1)} PASS TO ${lastName(tg)} FOR ${g} YD${g===1?'':'S'}`;
      advance(P,ny,r()<0.25,ri(5,8));
    } else {
      P.kind='inc';P.gain=0;P.x1=P.xc;P.y1=P.yc;P.st={team:o,qb:q1&&q1.id,att:1};
      P.text=`${lastName(q1)} INCOMPLETE, INTENDED FOR ${lastName(tg)}`;advance(P,yd,true,5);
    }
  }
  function kneel(){const P=base('kneel',off);P.gain=-1;P.x1=X(off,yd-1);P.y1=0;P.text=`${AB[off]} TAKES A KNEE`;down++;togo++;yd--;finish(P,40);}
  function qEnd(text){const P=base('qend',off);P.text=text;finish(P,0);}
  function scrimmage(){
    const o=off,lead=score[o]-score[1-o],ot=q>4,late=q===4&&clock<=300,fgDist=100-yd+17;
    if(q===4&&lead>0&&down<4&&clock<=(4-down)*40){kneel();return;}
    if(!ot&&(q===2||q===4)&&clock<=20&&fgDist<=55&&(q===2||(lead<=0&&lead>=-3))){fieldGoal();return;}
    if(down===4){
      const needTD=(late||ot)&&lead<-3;
      const go=needTD||(togo<=1&&yd>=45&&r()<0.4)||(togo<=3&&yd>=55&&yd<=64&&r()<0.35)||(late&&lead<0&&fgDist>54)||(ot&&fgDist>52);
      if(!go){if(fgDist<=54)fieldGoal();else punt();return;}
    }
    const hurry=hurryNow();
    const pp2=0.47+(togo>=7?0.18:0)-(togo<=2?0.22:0)+(hurry||(late&&lead<0)?0.3:0)-(late&&lead>0?0.3:0);
    if(r()<pp2)passPlay();else runPlay();
  }
  const recv0=r()<0.5?0:1;
  kickoff(1-recv0);
  let guard=0;
  while(guard++<600){
    if(clock<=0){
      if(q===1||q===3){qEnd(`END OF ${ORD[q]} QUARTER`);q++;clock=900;continue;}
      if(q===2){qEnd('HALFTIME');q=3;clock=900;kickoff(recv0);continue;}
      if(score[0]!==score[1])break;
      qEnd('END OF REGULATION · OVERTIME');
      const first=r()<0.5?0:1;
      for(let round=1;round<=8&&score[0]===score[1];round++){
        q=4+round;
        for(const t of [first,1-first]){
          if(round>=3)tryPoint(t,true);
          else{changePoss(t,75);drive=true;let gg=0;while(drive&&gg++<40)scrimmage();}
        }
      }
      if(score[0]===score[1]){q=13;off=0;yd=75;down=1;togo=10;const P=base('fg',0);P.good=true;P.yc=0;score[0]+=3;P.text=`${AB[0]} WALK-OFF FIELD GOAL IS GOOD`;finish(P,0);}
      break;
    }
    scrimmage();
  }
  qEnd(q>4?'FINAL · OVERTIME':'FINAL');
  for(const P of plays){P.half=P.q<=2?1:2;P.nd=NOM[P.kind]+(P.td?4:0)+((P.gain||0)>=20?1.5:0);}
  const halves=[1,2].map(h=>{const L=plays.filter(p=>p.half===h),sum=L.reduce((a,p)=>a+p.nd,0),f=720/sum;let t=0;for(const p of L){p.t0=t;p.dur=p.nd*f;t+=p.dur;}return L;});
  let lc=0,prev=0;for(const p of plays){const s=Math.sign(p.s1[0]-p.s1[1]);if(s&&prev&&s!==prev)lc++;if(s)prev=s;}
  const res={plays,halves,final:score.slice(),ot:q>4,leadChanges:lc,ab:AB};
  SIMC.set(g.seed,res);if(SIMC.size>900)SIMC.delete(SIMC.keys().next().value);
  FINALS.set(g.seed,{f:res.final,ot:res.ot,lc});if(FINALS.size>20000)FINALS.delete(FINALS.keys().next().value);
  return res;
}
function finalOf(g){return FINALS.get(g.seed)||(simulate(g),FINALS.get(g.seed));}
const winnerOf=g=>{const f=finalOf(g).f;return f[0]>f[1]?g.home:g.away;};
const loserOf=g=>{const f=finalOf(g).f;return f[0]>f[1]?g.away:g.home;};

// Box score: per-player stats for one game (or a list of plays)
function boxScore(plays){
  const m=new Map(),S=id=>{if(id==null)return null;let o=m.get(id);if(!o){o={att:0,cmp:0,pyd:0,ptd:0,int:0,car:0,ryd:0,rtd:0,rec:0,ryds:0,rectd:0,tkl:0,sack:0,dint:0,fgm:0,fga:0,xpm:0,xpa:0,ret:0,retyd:0,rettd:0,punts:0,puyd:0};m.set(id,o);}return o;};
  for(const p of plays){const s=p.st;if(!s)continue;const td=p.td?1:0;
    if(p.kind==='run'||p.kind==='fumble'){const o=S(s.ru);if(o){o.car++;o.ryd+=s.yds;o.rtd+=td;}const t=S(s.tk);if(t&&!td)t.tkl++;}
    else if(p.kind==='pass'){const q=S(s.qb);if(q){q.att++;q.cmp++;q.pyd+=s.yds;q.ptd+=td;}const w=S(s.rec);if(w){w.rec++;w.ryds+=s.yds;w.rectd+=td;}const t=S(s.tk);if(t&&!td)t.tkl++;}
    else if(p.kind==='inc'){const q=S(s.qb);if(q)q.att++;}
    else if(p.kind==='int'){const q=S(s.qb);if(q){q.att++;q.int++;}const d=S(s.pick);if(d)d.dint++;}
    else if(p.kind==='sack'){const k=S(s.sack);if(k){k.sack++;k.tkl++;}}
    else if(p.kind==='fg'){const k=S(s.fg);if(k){k.fga++;k.fgm+=s.made;}}
    else if(p.kind==='pat'){const k=S(s.xp);if(k){k.xpa++;k.xpm+=s.made;}}
    else if(p.kind==='kickoff'&&s.ret){const o=S(s.ret);o.ret++;o.retyd+=s.yds;o.rettd+=s.td||0;const t=S(s.tk);if(t)t.tkl++;}
    else if(p.kind==='punt'){const o=S(s.punt);if(o){o.punts++;o.puyd+=s.pyds;}if(s.ret){const rr=S(s.ret);rr.ret++;rr.retyd+=s.ryds||0;rr.rettd+=s.td||0;}}
  }
  return m;
}
function teamStats(plays){
  const s=[0,1].map(()=>({yds:0,pass:0,rush:0,fd:0,to:0}));
  for(const p of plays){const st=p.st;
    if(st&&st.team!=null&&(p.kind==='run'||p.kind==='fumble'))s[st.team].rush+=st.yds;
    if(st&&st.team!=null&&(p.kind==='pass'||p.kind==='sack'))s[st.team].pass+=st.yds;
    if(p.first)s[p.team].fd++;if(p.to!=null)s[p.to].to++;}
  for(const t of s)t.yds=t.pass+t.rush;return s;
}
function playerOfGame(res,g){
  const st=stateStart(g.S),box=boxScore(res.plays),win=res.final[0]>res.final[1]?g.home:g.away;let best=null,bs=-1e9;
  for(const [id,o] of box){const p=st.byId.get(id);if(!p)continue;
    const sc=o.pyd*0.42+o.ptd*20-o.int*15+o.ryd+o.rtd*20+o.ryds+o.rectd*20+o.sack*25+o.dint*30+o.tkl*4+o.retyd*0.6+o.rettd*25+(p.team===win?15:0);
    if(sc>bs){bs=sc;best={p,o};}}
  if(!best)return '';const {p,o}=best;
  const line=o.pyd>o.ryd&&o.pyd>o.ryds?`${o.cmp}/${o.att} ${o.pyd} YDS`:o.ryd>=o.ryds&&o.car?`${o.car} CAR ${o.ryd} YDS`:o.rec?`${o.rec} REC ${o.ryds} YDS`:o.sack?`${o.tkl} TKL ${o.sack} SACKS`:o.dint?`${o.dint} INT`:`${o.retyd} RET YDS`;
  const tds=o.ptd+o.rtd+o.rectd+o.rettd;
  return `${TEAMS[p.team].abbr} ${p.pos} ${p.f[0]}. ${p.l.toUpperCase()} · ${line}${tds?` · ${tds} TD`:''}`;
}

/* ============================== SCHEDULE ============================== */
function mkGame(S,w,slot,home,away,kind,title,extra){
  return Object.assign({S,w,slot,home,away,kind,title,neutral:false,aired:false,knownAt:0,conf:false,seed:hashN('g',S,w,kind,home,away)},extra||{});
}
const gIdx=g=>g.w*SPW+g.slot;
const regularPairs=memo(S=>{
  const r=rngOf('sched',S),weeks=[...Array(REGW)].map(()=>[]);
  CONFS.forEach((c,ci)=>{
    const ids=shuffle(TEAMS.filter(t=>t.conf===ci).map(t=>t.i),r),n=ids.length,fixed=ids[0],rest=ids.slice(1);
    for(let k=0;k<9;k++){const arr=[fixed,...rest.slice(k),...rest.slice(0,k)];
      for(let i=0;i<n/2;i++){const a=arr[i],b=arr[n-1-i],h=r()<0.5;weeks[3+k].push({home:h?a:b,away:h?b:a,conf:true});}}
  });
  const met=new Set();
  for(let w=0;w<3;w++){const pool=shuffle(TEAMS.map(t=>t.i),r);
    while(pool.length){const a=pool.shift();let j=pool.findIndex(b=>TEAMS[b].conf!==TEAMS[a].conf&&!met.has(a+'-'+b));if(j<0)j=0;
      const b=pool.splice(j,1)[0];met.add(a+'-'+b);met.add(b+'-'+a);const h=r()<0.5;weeks[w].push({home:h?a:b,away:h?b:a,conf:false});}}
  return weeks;
},8);
// Regular-season week: 37 games, the best 12 are televised (best last), the rest kick off alongside them.
const regWeek=memo((S,w)=>{
  const pairs=regularPairs(S)[w],rank=poll(S,w*SPW),top=new Map(rank.slice(0,25).map((t,i)=>[t,i]));
  const q=p=>teamCtx(S,p.home).ovr+teamCtx(S,p.away).ovr+(top.has(p.home)&&top.has(p.away)?14:top.has(p.home)||top.has(p.away)?4:0)+(p.conf?2:0);
  const sorted=pairs.slice().sort((a,b)=>q(b)-q(a));
  return sorted.map((p,i)=>{const aired=i<12,slot=aired?11-i:(i-12)%12;
    return mkGame(S,w,slot,p.home,p.away,'reg',`WEEK ${w+1}`,{aired,conf:p.conf});});
},40);
function regGames(S){const out=[];for(let w=0;w<REGW;w++)out.push(...regWeek(S,w));return out;}

/* ============================== STANDINGS + POLL ============================== */
// Lists of postseason games with the first slot index they occupy; records(n) only builds lists that start before n.
const POST_LISTS=[['ccg',144],['cfp1',149],['bowls',149],['qf',156],['sf',164],['final',167]];
const records=memo((S,n)=>{
  const rec=TEAMS.map(()=>({w:0,l:0,cw:0,cl:0,pf:0,pa:0,opp:[],last:[]}));
  const add=g=>{if(gIdx(g)>=n)return;const f=finalOf(g).f,h=rec[g.home],a=rec[g.away],hw=f[0]>f[1];
    h.pf+=f[0];h.pa+=f[1];a.pf+=f[1];a.pa+=f[0];h.opp.push(g.away);a.opp.push(g.home);
    if(hw){h.w++;a.l++;}else{a.w++;h.l++;}
    if(g.conf&&g.kind==='reg'){if(hw){h.cw++;a.cl++;}else{a.cw++;h.cl++;}}
    h.last.push(hw?'W':'L');a.last.push(hw?'L':'W');};
  for(let w=0;w<REGW&&w*SPW<n;w++)regWeek(S,w).forEach(add);
  for(const [name,start] of POST_LISTS)if(n>start)postList(S,name).forEach(add);
  return rec;
},300);
const recStr=(S,n,t)=>{const r=records(S,n)[t];return `${r.w}-${r.l}`;};
const poll=memo((S,n)=>{
  const rec=records(Math.max(0,S),Math.min(n,SPS)),st=stateStart(S);
  const wp=t=>{const r=rec[t],g=r.w+r.l;return g?r.w/g:0.5;};
  const score=TEAMS.map((T,t)=>{const r=rec[t],g=r.w+r.l,c=teamCtx(S,t);
    const sos=r.opp.length?r.opp.reduce((s,o)=>s+wp(o),0)/r.opp.length:0.5;
    const resume=(r.w-r.l)*6+(g?cl((r.pf-r.pa)/g,-24,24)*0.45:0)+(sos-0.5)*22+(g?r.w*sos*3:0);
    const prior=(c.ovr-76)*2.4+(st.prestige[t]-75)*0.35;
    return resume+prior*Math.max(0.12,1-g/8);});
  return TEAMS.map(t=>t.i).sort((a,b)=>score[b]-score[a]);
},300);
function confStandings(S,n,ci){
  const rec=records(S,n),rk=poll(S,n);
  return TEAMS.filter(t=>t.conf===ci).map(t=>t.i).sort((a,b)=>(rec[b].cw-rec[b].cl)-(rec[a].cw-rec[a].cl)||(rec[b].w-rec[b].l)-(rec[a].w-rec[a].l)||rk.indexOf(a)-rk.indexOf(b));
}

/* ============================== POSTSEASON ============================== */
const QF_NAMES=['CANE SUGAR BOWL','CITRUS GROVE BOWL','DESERT SUN BOWL','PASADENA GARDEN BOWL'];
const SF_NAMES=['PEACH ORCHARD BOWL','COTTON GIN BOWL'];
const BOWL_NAMES=['RIVERBOAT BOWL','BOLT FIZZ BOWL','END ZONE PIZZA BOWL','GRIDLOCK TRUCKS BOWL','HELMETGUARD BOWL','PIXEL WINGS BOWL','NEON BOWL','BITMAP BOWL','LIGHTHOUSE BOWL','GLACIER BOWL','HARVEST BOWL','COPPER CANYON BOWL','STARLIGHT BOWL','SUNBURST BOWL','BAYOU BOWL','REDWOOD BOWL'].reverse();
const cfpField=memo(S=>{
  const rk=poll(S,IDX_CCG_END),champs=postList(S,'ccg').map(winnerOf);
  const field=rk.slice(0,12);
  for(const c of champs)if(!field.includes(c)){for(let i=field.length-1;i>=0;i--)if(!champs.includes(field[i])){field.splice(i,1);break;}field.push(c);}
  return field.sort((a,b)=>rk.indexOf(a)-rk.indexOf(b));
},8);
const postList=memo((S,name)=>{
  if(name==='ccg'){
    return CONFS.map((c,ci)=>{const s=confStandings(S,IDX_REG_END,ci);return mkGame(S,12,ci,s[0],s[1],'ccg',`${c.short} CHAMPIONSHIP`,{neutral:true,aired:true,knownAt:IDX_REG_END,conf:false});});
  }
  if(name==='cfp1'){const f=cfpField(S);
    return [[7,8],[6,9],[5,10],[4,11]].map(([a,b],i)=>mkGame(S,12,5+i,f[a],f[b],'cfp1','PLAYOFF FIRST ROUND',{aired:true,knownAt:IDX_CCG_END,seeds:[a+1,b+1]}));}
  if(name==='qf'){const f=cfpField(S),r1=postList(S,'cfp1');// r1: [8v9,7v10,6v11,5v12]
    return [[3,3],[2,2],[1,1],[0,0]].map(([s,k],i)=>{const opp=winnerOf(r1[3-i]);return mkGame(S,13,i,f[s],opp,'qf',QF_NAMES[i],{neutral:true,aired:true,knownAt:IDX_CFP1_END,seeds:[s+1,f.indexOf(opp)+1]});});}
  if(name==='sf'){const qf=postList(S,'qf'),f=cfpField(S);// qf order: seed4,3,2,1
    return [[3,0],[2,1]].map(([a,b],i)=>{const x=winnerOf(qf[a]),y=winnerOf(qf[b]),sx=f.indexOf(x),sy=f.indexOf(y),hh=sx<sy?x:y,aa=sx<sy?y:x;
      return mkGame(S,13,8+i,hh,aa,'sf',SF_NAMES[i],{neutral:true,aired:true,knownAt:IDX_QF_END,seeds:[f.indexOf(hh)+1,f.indexOf(aa)+1]});});}
  if(name==='final'){const sf=postList(S,'sf'),f=cfpField(S),x=winnerOf(sf[0]),y=winnerOf(sf[1]),hh=f.indexOf(x)<f.indexOf(y)?x:y,aa=hh===x?y:x;
    return [mkGame(S,13,11,hh,aa,'final','NATIONAL CHAMPIONSHIP',{neutral:true,aired:true,knownAt:IDX_SF_END,seeds:[f.indexOf(hh)+1,f.indexOf(aa)+1]})];}
  if(name==='bowls'){
    const rk=poll(S,IDX_CCG_END),rec=records(S,IDX_CCG_END),field=new Set(cfpField(S));
    const elig=rk.filter(t=>!field.has(t)&&rec[t].w>=6).slice(0,32);
    const pairs=[];const pool=elig.slice();
    while(pool.length>=2){const a=pool.shift();let j=pool.findIndex(b=>TEAMS[b].conf!==TEAMS[a].conf);if(j<0||j>3)j=0;pairs.push([a,pool.splice(j,1)[0]]);}
    const airSlots=[[13,10],[13,7],[13,6],[13,5],[13,4],[12,11],[12,10],[12,9]];
    const offSlots=[];for(let s=5;s<12;s++)offSlots.push([12,s]);for(let s=0;s<10;s++)offSlots.push([13,s]);
    return pairs.map(([a,b],i)=>{const aired=i<airSlots.length,[w,slot]=aired?airSlots[i]:offSlots[(i-airSlots.length)%offSlots.length];
      return mkGame(S,w,slot,a,b,'bowl',BOWL_NAMES[BOWL_NAMES.length-1-i]||'BOWL GAME',{neutral:true,aired,knownAt:IDX_CCG_END});});
  }
  return [];
},60);
function weekGames(S,w){
  if(w<REGW)return regWeek(S,w);
  if(w===12)return [...postList(S,'ccg'),...postList(S,'cfp1'),...postList(S,'bowls').filter(g=>g.w===12)];
  if(w===13)return [...postList(S,'qf'),...postList(S,'sf'),...postList(S,'final'),...postList(S,'bowls').filter(g=>g.w===13)];
  return classics(S);
}
function airedGame(S,w,slot){
  if(w===14)return classics(S)[slot];
  const g=weekGames(S,w).find(x=>x.aired&&x.slot===slot);
  return g||null;
}
function allSeasonGames(S){const out=regGames(S);for(const [name] of POST_LISTS)out.push(...postList(S,name));return out;}
const classics=memo(S=>{
  const all=allSeasonGames(S).map(g=>{const f=finalOf(g),m=Math.abs(f.f[0]-f.f[1]),big=g.kind==='final'?30:g.kind==='sf'?18:g.kind==='qf'?10:0;
    return {g,x:f.lc*3+(21-Math.min(m,21))+(f.f[0]+f.f[1])/8+(f.ot?12:0)+big+(g.aired?0:-4)+(teamCtx(S,g.home).ovr+teamCtx(S,g.away).ovr-150)*0.4};});
  return all.sort((a,b)=>b.x-a.x).slice(0,12).reverse().map((o,i)=>({...o.g,kind:'classic',origKind:o.g.kind,origW:o.g.w,origTitle:o.g.title,w:14,slot:i,aired:true,knownAt:IDX_SIGN,title:'PGN CLASSIC'}));
},6);
// Is this game's matchup decided yet, from where `cur` (a locate() result) stands?
function known(g,cur){if(g.S<cur.S)return true;if(g.S>cur.S)return g.w<REGW;return cur.n>=g.knownAt;}
function slotTitle(S,w,slot){
  if(w<REGW)return `WEEK ${w+1}`;if(w===14)return 'PGN CLASSIC';
  if(w===12)return slot<5?`${CONFS[slot].short} CHAMPIONSHIP`:slot<9?'PLAYOFF FIRST ROUND':'BOWL GAME';
  return slot<4?QF_NAMES[slot]:slot===8||slot===9?SF_NAMES[slot-8]:slot===11?'NATIONAL CHAMPIONSHIP':'BOWL GAME';
}

/* ============================== SEASON SUMMARY ============================== */
const seasonSummary=memo(S=>{
  const rec=records(S,SPS),field=cfpField(S),champ=winnerOf(postList(S,'final')[0]);
  const pw=TEAMS.map(()=>0);for(const name of ['cfp1','qf','sf','final'])for(const g of postList(S,name))pw[winnerOf(g)]++;
  const cc=new Set(postList(S,'ccg').map(winnerOf));
  return {rec,field,champ,pw,cc,finalPoll:poll(S,SPS)};
},6);

/* ============================== RECRUITING ============================== */
// Class of season S+1, recruited during season S. Commit times are slot indexes inside season S.
const recruitClass=memo(S=>{
  const r=rngOf('recruit',S),st=stateStart(S),need=[],cap=[];
  for(const T of TEAMS){const c=teamCtx(S,T.i),ret={};let n=0;
    for(const pos of POS){ret[pos]=c.by[pos].filter(p=>!(p.el>=3||p.yr>=5||(p.el>=2&&p.ovr>=86))).length;n+=ret[pos];}
    cap[T.i]=cl(MAXR-n+3,12,27);need[T.i]=Object.fromEntries(POS.map(p=>[p,Math.max(0,ROSTER_T[p]-ret[p])+1]));}
  const total=cap.reduce((a,b)=>a+b,0),N=Math.round(total*1.18);
  const pool=[];
  for(let i=0;i<N;i++){
    const stars=i<32?5:i<360?4:i<1250?3:2,[s0,s1]=[{5:0,4:32,3:360,2:1250}[stars],{5:32,4:360,3:1250,2:N}[stars]],b=STAR_BAND[stars];
    const rating=lerp(b[1],b[0],(i-s0)/Math.max(1,s1-s0))-r()*0.002;
    const p=makeProspect(r,pickW(r,POS,POS_W),stars,pickW(r,STATES,STATE_WV),Math.max(b[0],rating));
    p.rank=i+1;p.key=`R${S}-${i}`;pool.push(p);
  }
  const posCount={};for(const p of pool){posCount[p.pos]=(posCount[p.pos]||0)+1;p.posRank=posCount[p.pos];}
  const left=cap.slice(),needL=need.map(x=>({...x})),prestige=st.prestige;
  for(const p of pool){
    const reg=REGION[p.st],u=[];
    for(let t=0;t<NT;t++){
      const T=TEAMS[t];let v=prestige[t]*1.05+(T.state===p.st?13:REGION[T.state]===reg?6:0)+(needL[t][p.pos]>0?7:-14)-Math.log(-Math.log(r()+1e-9))*7;
      if(left[t]<=0)v-=1000;u.push([v,t]);
    }
    u.sort((a,b)=>b[0]-a[0]);p.finalists=u.slice(0,4).filter(x=>x[0]>-500).map(x=>x[1]);
    if(u[0][0]<-500||(p.stars===2&&r()<0.12)){p.team=null;continue;}
    const t=u[0][1];p.team=t;left[t]--;needL[t][p.pos]--;
    const k={5:0.35,4:0.6,3:0.95,2:1.3}[p.stars];
    p.commitAt=p.stars>=4&&r()<0.28?IDX_SIGN+r()*0.9:IDX_SIGN*Math.pow(r(),k);
    if(p.stars>=4&&r()<0.1&&p.finalists[1]!=null&&p.commitAt>20){p.firstTeam=p.finalists[1];p.firstAt=p.commitAt*r()*0.75;}
  }
  return {S,pool,cap};
},4);
function recruitStatus(p,idx){// at season slot index idx
  if(p.team!=null&&idx>=p.commitAt)return {state:'signed',team:p.team,flip:p.firstTeam!=null};
  if(p.firstTeam!=null&&idx>=p.firstAt)return {state:'committed',team:p.firstTeam};
  return {state:'open'};
}
function classRankings(S,idx){
  const rc=recruitClass(S),by=TEAMS.map(()=>[]);
  for(const p of rc.pool){const s=recruitStatus(p,idx);if(s.state!=='open')by[s.team].push(p);}
  const score=by.map(list=>list.slice().sort((a,b)=>b.rating-a.rating).reduce((s,p,i)=>s+(p.rating-0.7)*100*Math.pow(0.95,i),0));
  return TEAMS.map(t=>({t:t.i,n:by[t.i].length,score:score[t.i],avg:by[t.i].length?by[t.i].reduce((s,p)=>s+p.stars,0)/by[t.i].length:0,
    s5:by[t.i].filter(p=>p.stars===5).length,s4:by[t.i].filter(p=>p.stars===4).length})).sort((a,b)=>b.score-a.score);
}
function recentCommits(S,idx,n=8){
  const rc=recruitClass(S),ev=[];
  for(const p of rc.pool){if(p.team!=null&&p.commitAt<=idx)ev.push({p,at:p.commitAt,team:p.team,flip:p.firstTeam!=null});if(p.firstTeam!=null&&p.firstAt<=idx)ev.push({p,at:p.firstAt,team:p.firstTeam,first:true});}
  return ev.sort((a,b)=>b.at-a.at).slice(0,n);
}

/* ============================== DEPARTURES + PORTAL ============================== */
const departures=memo(S=>{
  const r=rngOf('depart',S),out={grad:new Set(),draft:new Set(),rsNow:new Set()};
  for(const T of TEAMS){const c=teamCtx(S,T.i);for(const pos of POS)c.by[pos].forEach((p,d)=>{
    const starter=d<STARTERS[pos];let rs=false;
    if(!p.rs&&!starter&&d>=STARTERS[pos]+1){if(p.el===0&&r()<0.7)rs=true;else if(p.el>0&&r()<0.08)rs=true;}
    if(rs)out.rsNow.add(p.id);
    const elAfter=p.el+(rs?0:1);
    if(elAfter>=4||p.yr>=5){out.grad.add(p.id);if(p.ovr>=80)out.draft.add(p.id);return;}
    if(elAfter>=3&&p.ovr>=83&&r()<(p.ovr-80)/14)out.draft.add(p.id);
  });}
  return out;
},4);
const portal=memo(S=>{
  const r=rngOf('portal',S),dep=departures(S),rc=recruitClass(S),rec=records(S,IDX_CCG_END),st=stateStart(S);
  const wp=t=>{const x=rec[t];return x.w/Math.max(1,x.w+x.l);};
  const entries=[];
  for(const T of TEAMS){const c=teamCtx(S,T.i);for(const pos of POS)c.by[pos].forEach((p,d)=>{
    if(dep.grad.has(p.id)||dep.draft.has(p.id))return;
    const starter=d<STARTERS[pos];let pr=0.03;
    if(!starter){pr+=0.05;if(d>=STARTERS[pos]+1)pr+=0.07;if(p.stars>=4&&p.el>=1)pr+=0.15;}
    if(pos==='QB'&&d===1)pr+=0.22;
    if(starter&&p.ovr>=80&&wp(T.i)<0.5)pr+=0.1;
    if(wp(T.i)<0.35)pr+=0.05;
    if(pos==='K'||pos==='P')pr*=0.5;
    if(r()<pr)entries.push({p,from:T.i,enterAt:IDX_PORTAL+r()*14});
  });}
  // projected depth after departures, portal exits and signed recruits
  const proj=TEAMS.map(()=>Object.fromEntries(POS.map(p=>[p,[]]))),cnt=TEAMS.map(()=>0),out=new Set(entries.map(e=>e.p.id));
  for(const p of st.players)if(!dep.grad.has(p.id)&&!dep.draft.has(p.id)&&!out.has(p.id)){proj[p.team][p.pos].push(p.ovr+2);cnt[p.team]++;}
  for(const p of rc.pool)if(p.team!=null){proj[p.team][p.pos].push(p.ovr);cnt[p.team]++;}
  for(const t of proj)for(const pos of POS)t[pos].sort((a,b)=>b-a);
  entries.sort((a,b)=>b.p.ovr-a.p.ovr);
  for(const e of entries){
    const p=e.p,u=r();
    if(u<0.05){e.withdrawn=true;e.commitAt=e.enterAt+0.5+r()*6;continue;}
    let best=null,bv=-1e9;
    for(let t=0;t<NT;t++){if(t===e.from||cnt[t]>=MAXR)continue;
      const arr=proj[t][p.pos],worst=arr[STARTERS[p.pos]-1]??0,gap=p.ovr+2-worst;
      if(gap<-3&&st.prestige[t]<p.ovr)continue;
      const v=st.prestige[t]*0.45+gap*1.6+(REGION[TEAMS[t].state]===REGION[p.st]?5:0)-Math.log(-Math.log(r()+1e-9))*8;
      if(v>bv){bv=v;best=t;}}
    if(best==null||u>0.88){e.to=null;continue;}
    e.to=best;e.commitAt=Math.min(SPS-0.5,e.enterAt+0.5+r()*10);
    const arr=proj[best][p.pos];arr.push(p.ovr+2);arr.sort((a,b)=>b-a);cnt[best]++;
  }
  return {entries};
},4);
function portalStatus(e,idx){
  if(idx<e.enterAt)return null;
  if(e.withdrawn)return idx>=e.commitAt?{state:'withdrawn'}:{state:'open'};
  if(e.to!=null&&idx>=e.commitAt)return {state:'committed',team:e.to};
  return {state:'open'};
}

/* ============================== SEASON TRANSITION ============================== */
function transition(S){
  const st=stateStart(S),dep=departures(S),rc=recruitClass(S),pt=portal(S),sum=seasonSummary(S),r=rngOf('advance',S);
  const ns={S:S+1,players:[],nid:st.nid,prestige:[],coach:[]};
  const moved=new Map();for(const e of pt.entries)if(!e.withdrawn)moved.set(e.p.id,e.to);
  for(const p0 of st.players){
    if(dep.grad.has(p0.id)||dep.draft.has(p0.id))continue;
    let team=p0.team,from=p0.from;
    if(moved.has(p0.id)){const to=moved.get(p0.id);if(to==null)continue;from=p0.team;team=to;}
    const p={...p0,team,from};
    if(team!==p0.team)p.num=null;
    if(dep.rsNow.has(p.id))p.rs=true;else p.el++;
    p.yr++;develop(r,p);ns.players.push(p);
  }
  for(const pr of rc.pool){if(pr.team==null)continue;
    const p={id:ns.nid++,f:pr.f,l:pr.l,pos:pr.pos,st:pr.st,city:pr.city,ht:pr.ht,wt:pr.wt,stars:pr.stars,rating:pr.rating,ovr:pr.ovr,pot:pr.pot,team:pr.team,yr:1,el:0,rs:false,from:null,num:null,rank:pr.rank};
    ns.players.push(p);}
  finalizeState(ns,r);
  TEAMS.forEach((T,i)=>{
    const rec=sum.rec[i],perf=cl(38+rec.w*4.2+(sum.cc.has(i)?6:0)+(sum.field.includes(i)?6:0)+sum.pw[i]*5+(sum.champ===i?8:0),35,100);
    ns.prestige[i]=Math.round(cl(0.6*st.prestige[i]+0.2*T.base+0.2*perf,40,99)*10)/10;
    const c=st.coach[i],hot=st.prestige[i]-perf;
    ns.coach[i]=hot>14&&c.yrs>=2&&r()<0.45?{...newCoach(r),yrs:1,fresh:true}:{name:c.name,yrs:c.yrs+1};
  });
  return ns;
}

/* ============================== SEASON STATS ============================== */
function teamGames(S,t){return allSeasonGames(S).filter(g=>g.home===t||g.away===t).sort((a,b)=>gIdx(a)-gIdx(b));}
function seasonStats(S,t,n){
  const tot=new Map();
  for(const g of teamGames(S,t)){if(gIdx(g)>=n)continue;const box=boxScore(simulate(g).plays);
    for(const [id,o] of box){let a=tot.get(id);if(!a){a={...o,gp:0};for(const k in a)a[k]=0;tot.set(id,a);}for(const k in o)a[k]+=o[k];a.gp++;}}
  return tot;
}

// quick sim sanity check, run from the console: pgnStats(1000)
function pgnStats(n=1000){
  let pts=0,pl=0,ot=0,bad=0,hw=0;const r=mulberry32(99);
  for(let i=0;i<n;i++){const h=Math.floor(r()*NT);let a=Math.floor(r()*NT);if(a===h)a=(a+1)%NT;
    const res=simulate({S:0,home:h,away:a,kind:'reg',neutral:false,seed:hashN('stat',i)});
    pts+=res.final[0]+res.final[1];pl+=res.plays.length;if(res.ot)ot++;if(res.final[0]>res.final[1])hw++;
    for(const L of res.halves){const e=L[L.length-1];if(Math.abs(e.t0+e.dur-720)>0.01)bad++;}}
  return {avgPoints:+(pts/n).toFixed(1),avgPlays:+(pl/n).toFixed(1),otRate:+(ot/n).toFixed(3),homeWin:+(hw/n).toFixed(3),halvesOffClock:bad};
}
if(typeof module!=='undefined')module.exports={};
