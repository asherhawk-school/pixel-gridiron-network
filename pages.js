'use strict';
/* Pixel Gridiron Network: the league desk under the TV (standings, teams, rosters, recruiting, portal). */
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const starsHtml=n=>`<span class="stars" aria-label="${n} star">${'★'.repeat(n)}<i>${'★'.repeat(5-n)}</i></span>`;
const chipHtml=t=>`<span class="chip" style="--c1:${TEAMS[t].c1};--c2:${TEAMS[t].c2}"></span>`;
const teamLink=(t,full)=>`<a class="tlink" href="#team-${TEAMS[t].abbr.toLowerCase()}">${chipHtml(t)}${esc(full?TEAMS[t].full:TEAMS[t].name)}</a>`;
const whenIdx=(S,idx)=>{const ms=idxMs(S,idx);return `${fmtDay(ms)} ${fmtTime(ms)}`;};
const inHrs=ms=>{const d=Math.max(0,ms-nowMs()),h=Math.floor(d/3600000),m=Math.floor(d/60000)%60;return h?`${h}h ${m}m`:`${m}m`;};
const ui={view:'league',teamTab:'roster',posF:'ALL',starF:'0',statF:'all',show:200,pPos:'ALL',pStat:'all'};

function phaseLine(L){
  const S=L.S,y=seasonYear(S);
  if(L.w<REGW)return `${y} season · Week ${L.w+1} of 12. Championship week starts ${whenIdx(S,IDX_REG_END)}.`;
  if(L.w===12)return `${y} season · Championship week. The playoff field is set after the title games (${whenIdx(S,IDX_CCG_END)}).`;
  if(L.w===13)return `${y} season · Bowls and the playoff. The transfer portal is open. Signing day is ${whenIdx(S,IDX_SIGN)}.`;
  return `${y} offseason · Signing day is done and the portal closes when ${y+1} kicks off (${whenIdx(S+1,0)}).`;
}

/* ---------------- LEAGUE ---------------- */
function viewLeague(L){
  const S=L.S,n=Math.min(L.n,SPS),rk=poll(S,n),rec=records(S,n);
  const nextGame=t=>{const g=teamGames(S,t).find(g=>gIdx(g)>=L.n&&known(g,L));if(!g)return '';const opp=g.home===t?g.away:g.home;return `${g.home===t?(g.neutral?'vs':'vs'):'at'} ${TEAMS[opp].abbr}`;};
  let h=`<p class="lede">${esc(phaseLine(L))}</p><div class="cols"><section><h3>PGN Top 25 <small>${n===0?'preseason':n>=IDX_CCG_END?'final regular season':`after ${Math.floor(n/12)} weeks`}</small></h3>
  <div class="tbl"><table><thead><tr><th class="n">#</th><th>Team</th><th class="n">W-L</th><th class="n">Diff</th><th>Next</th></tr></thead><tbody>`;
  rk.slice(0,25).forEach((t,i)=>{const r=rec[t],d=r.pf-r.pa;h+=`<tr><td class="n">${i+1}</td><td>${teamLink(t)}</td><td class="n">${r.w}-${r.l}</td><td class="n ${d>=0?'up':'down'}">${d>0?'+':''}${d}</td><td class="dim">${nextGame(t)}</td></tr>`;});
  h+=`</tbody></table></div></section><section><h3>Conference standings</h3><div class="conf-grid">`;
  CONFS.forEach((c,ci)=>{const order=confStandings(S,Math.min(n,IDX_REG_END),ci),rr=records(S,Math.min(n,IDX_REG_END));
    h+=`<div class="tbl"><table><thead><tr><th>${esc(c.name)}</th><th class="n">Conf</th><th class="n">All</th></tr></thead><tbody>`;
    order.forEach(t=>{const k=rk.indexOf(t);h+=`<tr><td>${k<25?`<b class="rk">${k+1}</b> `:''}${teamLink(t)}</td><td class="n">${rr[t].cw}-${rr[t].cl}</td><td class="n dim">${rr[t].w}-${rr[t].l}</td></tr>`;});
    h+=`</tbody></table></div>`;});
  h+=`</div></section></div>`;
  if(L.n>=IDX_CCG_END){const f=cfpField(S);h+=`<section><h3>The playoff</h3><div class="bracket">`;
    for(const [lab,name] of [['First round','cfp1'],['Quarterfinals','qf'],['Semifinals','sf'],['National Championship','final']]){
      h+=`<div><h4>${lab}</h4>`;for(const g of postList(S,name)){if(!known(g,L)){h+=`<div class="bg dim">To be decided</div>`;continue;}
        const done=gIdx(g)<L.n,fz=done?finalOf(g).f:null;
        h+=`<div class="bg"><div class="bt">${esc(g.title.toLowerCase())}</div>${[[g.away,1],[g.home,0]].map(([t,s])=>`<div class="${done&&fz[s]>fz[1-s]?'win':''}"><span class="seed">${f.indexOf(t)+1}</span>${teamLink(t)}<span class="sc">${done?fz[s]:''}</span></div>`).join('')}<div class="bt">${done?'Final':whenIdx(S,gIdx(g))}</div></div>`;}
      h+=`</div>`;}
    h+=`</div></section>`;}
  return h;
}

/* ---------------- TEAMS ---------------- */
function viewTeams(L){
  const n=Math.min(L.n,SPS);
  return `<p class="lede">${NT} schools in ${CONFS.length} conferences. Pick one to see its roster, schedule, recruiting class and portal moves.</p>`+
    CONFS.map((c,ci)=>`<section><h3>${esc(c.name)}</h3><div class="team-grid">${TEAMS.filter(t=>t.conf===ci).map(t=>`<a class="team-card" href="#team-${t.abbr.toLowerCase()}" style="--c1:${t.c1};--c2:${t.c2}"><b>${esc(t.name)}</b><span>${esc(t.mascot)} · ${recStr(L.S,n,t.i)}</span></a>`).join('')}</div></section>`).join('');
}
function statLine(p,o){
  if(!o)return '';
  if(p.pos==='QB'&&o.att)return `${o.cmp}/${o.att}, ${fmtNum(o.pyd)} yds, ${o.ptd} TD, ${o.int} INT${o.car?` · ${o.ryd} rush`:''}`;
  if(o.car&&o.car>=o.rec)return `${o.car} car, ${fmtNum(o.ryd)} yds, ${o.rtd} TD`;
  if(o.rec)return `${o.rec} rec, ${fmtNum(o.ryds)} yds, ${o.rectd} TD`;
  if(o.fga||o.xpa)return `${o.fgm}/${o.fga} FG, ${o.xpm}/${o.xpa} XP`;
  if(o.punts)return `${o.punts} punts, ${(o.puyd/o.punts).toFixed(1)} avg`;
  if(o.tkl||o.sack||o.dint)return `${o.tkl} tkl${o.sack?`, ${o.sack} sk`:''}${o.dint?`, ${o.dint} INT`:''}`;
  if(o.ret)return `${o.ret} ret, ${o.retyd} yds`;
  return '';
}
function viewTeam(L,t){
  const S=L.S,n=Math.min(L.n,SPS),T=TEAMS[t],c=teamCtx(S,t),r=records(S,n)[t],rk=poll(S,n).indexOf(t);
  const pr=c.prestige,prStars=Math.max(1,Math.min(5,Math.round((pr-50)/9)));
  let h=`<header class="team-head" style="--c1:${T.c1};--c2:${T.c2}"><div><h2>${rk<25?`<span class="rk">#${rk+1}</span> `:''}${esc(T.full)}</h2>
  <p>${esc(CONFS[T.conf].name)} · ${r.w}-${r.l} (${r.cw}-${r.cl} conf) · Coach ${esc(c.coach.name)}, year ${c.coach.yrs}${c.coach.fresh?' (new hire)':''}</p></div>
  <dl><div><dt>Program</dt><dd>${starsHtml(prStars)}</dd></div><div><dt>Offense</dt><dd>${c.off.toFixed(0)}</dd></div><div><dt>Defense</dt><dd>${c.def.toFixed(0)}</dd></div><div><dt>Overall</dt><dd>${c.ovr.toFixed(0)}</dd></div></dl></header>
  <div class="subtabs" role="tablist">${[['roster','Roster'],['schedule','Schedule'],['recruits',`Class of ${seasonYear(S+1)}`],['portal','Portal']].map(([k,lab])=>`<button type="button" class="st${ui.teamTab===k?' on':''}" data-tt="${k}" aria-pressed="${ui.teamTab===k}">${lab}</button>`).join('')}</div>`;
  if(ui.teamTab==='roster'){
    const ss=seasonStats(S,t,L.n),pos=['ALL',...POS];
    h+=`<div class="filters"><label>Position <select id="fPos">${pos.map(p=>`<option${p===ui.posF?' selected':''}>${p}</option>`).join('')}</select></label><span class="dim">${c.ros.length} players · starters in bold · season stats ${n?`through ${(()=>{const g=teamGames(S,t).filter(x=>gIdx(x)<L.n).length;return `${g} game${g===1?'':'s'}`;})()}`:'start at kickoff'}</span></div>
    <div class="tbl"><table><thead><tr><th class="n">#</th><th>Name</th><th>Pos</th><th>Class</th><th class="n">Ht</th><th class="n">Wt</th><th>Hometown</th><th>Recruit</th><th class="n">OVR</th><th>Season</th></tr></thead><tbody>`;
    for(const p of c.ros){if(ui.posF!=='ALL'&&p.pos!==ui.posF)continue;const starter=c.depth[p.id]<STARTERS[p.pos];
      h+=`<tr class="${starter?'starter':''}"><td class="n">${p.num}</td><td>${esc(p.f)} ${esc(p.l)}${p.from!=null?` <span class="tag" title="Transfer from ${esc(TEAMS[p.from].full)}">from ${TEAMS[p.from].abbr}</span>`:''}</td><td>${p.pos}</td><td>${classLabel(p)}</td><td class="n">${htStr(p.ht)}</td><td class="n">${p.wt}</td><td class="dim">${esc(p.city)}, ${p.st}</td><td>${starsHtml(p.stars)}</td><td class="n ovr">${p.ovr}</td><td class="dim">${esc(statLine(p,ss.get(p.id)))}</td></tr>`;}
    h+=`</tbody></table></div>`;
  } else if(ui.teamTab==='schedule'){
    h+=`<div class="tbl"><table><thead><tr><th>When</th><th>Game</th><th>Opponent</th><th>Result</th></tr></thead><tbody>`;
    for(const g of teamGames(S,t)){if(!known(g,L))continue;const home=g.home===t,opp=home?g.away:g.home,i=gIdx(g),done=i<L.n,ok=rk;void ok;
      let res='';if(done){const f=finalOf(g),my=home?f.f[0]:f.f[1],th=home?f.f[1]:f.f[0];res=`<b class="${my>th?'up':'down'}">${my>th?'W':'L'}</b> ${my}-${th}${f.ot?' OT':''}`;}
      else if(i===L.inS)res='<b class="live">On now</b>';else res=whenIdx(S,i);
      const ork=poll(S,n).indexOf(opp);
      h+=`<tr><td class="dim">${g.w<REGW?`Week ${g.w+1}`:esc(g.title.toLowerCase())}</td><td>${g.aired?'<span class="tag on">PGN</span>':'<span class="dim">Off air</span>'}</td><td>${g.neutral?'vs':home?'vs':'at'} ${ork<25?`<b class="rk">${ork+1}</b> `:''}${teamLink(opp)}</td><td>${res}</td></tr>`;}
    h+=`</tbody></table></div>`;
  } else if(ui.teamTab==='recruits'){
    const rc=recruitClass(S),idx=L.fIdx,cr=classRankings(S,idx),ci=cr.findIndex(x=>x.t===t),mine=[],targets=[];
    for(const p of rc.pool){const s=recruitStatus(p,idx);if(s.state!=='open'&&s.team===t)mine.push({p,s});else if(s.state==='open'&&p.finalists&&p.finalists.slice(0,3).includes(t)&&targets.length<15)targets.push(p);}
    mine.sort((a,b)=>b.p.rating-a.p.rating);
    h+=`<p class="lede">${mine.length?`No. ${ci+1} class in the country with ${mine.length} commits (${cr[ci].s5} five-star, ${cr[ci].s4} four-star).`:'No commits yet.'} ${idx<IDX_SIGN?`Signing day is ${whenIdx(S,IDX_SIGN)}.`:'Signing day is done.'}</p>
    <div class="tbl"><table><thead><tr><th class="n">Nat'l</th><th>Recruit</th><th>Pos</th><th>Hometown</th><th class="n">Ht/Wt</th><th>Rating</th><th>Status</th></tr></thead><tbody>`;
    for(const {p,s} of mine)h+=`<tr><td class="n">${p.rank}</td><td>${esc(p.f)} ${esc(p.l)}</td><td>${p.pos}</td><td class="dim">${esc(p.city)}, ${p.st}</td><td class="n">${htStr(p.ht)} / ${p.wt}</td><td>${starsHtml(p.stars)} <span class="dim">${p.rating.toFixed(4)}</span></td><td>${s.state==='signed'?(idx>=IDX_SIGN&&p.commitAt>=IDX_SIGN?'Signed':'Committed')+(s.flip?' (flipped)':''):'Committed'}</td></tr>`;
    h+=`</tbody></table></div>`;
    if(targets.length)h+=`<h3>Top uncommitted targets</h3><div class="tbl"><table><thead><tr><th class="n">Nat'l</th><th>Recruit</th><th>Pos</th><th>Hometown</th><th>Rating</th><th>Top schools</th></tr></thead><tbody>${targets.map(p=>`<tr><td class="n">${p.rank}</td><td>${esc(p.f)} ${esc(p.l)}</td><td>${p.pos}</td><td class="dim">${esc(p.city)}, ${p.st}</td><td>${starsHtml(p.stars)}</td><td>${p.finalists.slice(0,3).map(x=>TEAMS[x].abbr).join(', ')}</td></tr>`).join('')}</tbody></table></div>`;
  } else {
    if(L.fIdx<IDX_PORTAL){
      const xin=c.ros.filter(p=>p.from!=null).sort((a,b)=>b.ovr-a.ovr);
      h+=`<p class="lede">The portal opens with bowl season, ${whenIdx(S,IDX_PORTAL)} (in ${inHrs(idxMs(S,IDX_PORTAL))}).</p>`;
      h+=xin.length?`<h3>Transfers on this roster</h3><div class="tbl"><table><thead><tr><th>Player</th><th>Pos</th><th>Class</th><th class="n">OVR</th><th>From</th></tr></thead><tbody>${xin.map(p=>`<tr><td>${esc(p.f)} ${esc(p.l)}</td><td>${p.pos}</td><td>${classLabel(p)}</td><td class="n ovr">${p.ovr}</td><td>${teamLink(p.from)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="dim">No transfers on the roster.</p>';
    } else {
      const ent=portal(S).entries,outs=[],ins=[];
      for(const e of ent){const s=portalStatus(e,L.fIdx);if(!s)continue;if(e.from===t)outs.push({e,s});if(s.state==='committed'&&s.team===t)ins.push({e,s});}
      const row=({e,s},dir)=>`<tr><td>${esc(e.p.f)} ${esc(e.p.l)}</td><td>${e.p.pos}</td><td>${classLabel(e.p)}</td><td class="n ovr">${e.p.ovr}</td><td>${dir==='in'?teamLink(e.from):s.state==='committed'?teamLink(s.team):s.state==='withdrawn'?'Withdrew, staying':'Uncommitted'}</td></tr>`;
      h+=`<h3>Leaving (${outs.length})</h3><div class="tbl"><table><thead><tr><th>Player</th><th>Pos</th><th>Class</th><th class="n">OVR</th><th>Status</th></tr></thead><tbody>${outs.map(o=>row(o,'out')).join('')||'<tr><td colspan="5" class="dim">Nobody yet.</td></tr>'}</tbody></table></div>`;
      h+=`<h3>Incoming (${ins.length})</h3><div class="tbl"><table><thead><tr><th>Player</th><th>Pos</th><th>Class</th><th class="n">OVR</th><th>From</th></tr></thead><tbody>${ins.map(o=>row(o,'in')).join('')||'<tr><td colspan="5" class="dim">Nobody yet.</td></tr>'}</tbody></table></div>`;
    }
  }
  return h;
}

/* ---------------- RECRUITING ---------------- */
function viewRecruiting(L){
  const S=L.S,idx=L.fIdx,rc=recruitClass(S),cr=classRankings(S,idx);
  let h=`<p class="lede">Class of ${seasonYear(S+1)}. ${idx<IDX_SIGN?`Signing day is ${whenIdx(S,IDX_SIGN)} (in ${inHrs(idxMs(S,IDX_SIGN))}). Prospects commit as the season goes on; some flip.`:'Signing day is done. These players join their teams next season.'}</p>
  <div class="stack"><section><h3>Team class rankings</h3><div class="tbl"><table><thead><tr><th class="n">#</th><th>Team</th><th class="n">Commits</th><th class="n">5★</th><th class="n">4★</th><th class="n">Avg</th><th class="n">Points</th></tr></thead><tbody>`;
  cr.slice(0,25).forEach((c,i)=>{h+=`<tr><td class="n">${i+1}</td><td>${teamLink(c.t)}</td><td class="n">${c.n}</td><td class="n">${c.s5}</td><td class="n">${c.s4}</td><td class="n">${c.avg.toFixed(2)}</td><td class="n">${c.score.toFixed(1)}</td></tr>`;});
  h+=`</tbody></table></div></section><section><h3>Prospect board</h3><div class="filters">
    <label>Position <select id="rPos">${['ALL',...POS].map(p=>`<option${p===ui.posF?' selected':''}>${p}</option>`).join('')}</select></label>
    <label>Stars <select id="rStar">${[['0','Any'],['5','5★'],['4','4★+'],['3','3★+']].map(([v,l])=>`<option value="${v}"${v===ui.starF?' selected':''}>${l}</option>`).join('')}</select></label>
    <label>Status <select id="rStat">${[['all','All'],['open','Uncommitted'],['done','Committed']].map(([v,l])=>`<option value="${v}"${v===ui.statF?' selected':''}>${l}</option>`).join('')}</select></label></div>
    <div class="tbl"><table><thead><tr><th class="n">#</th><th>Recruit</th><th>Pos</th><th>Hometown</th><th class="n">Ht/Wt</th><th>Rating</th><th>Status</th></tr></thead><tbody>`;
  let shown=0,total=0;
  for(const p of rc.pool){
    if(ui.posF!=='ALL'&&p.pos!==ui.posF)continue;if(+ui.starF&&p.stars<+ui.starF)continue;
    const s=recruitStatus(p,idx);if(ui.statF==='open'&&s.state!=='open')continue;if(ui.statF==='done'&&s.state==='open')continue;
    total++;if(shown>=ui.show)continue;shown++;
    const st=s.state==='open'?`<span class="dim">Top: ${(p.finalists||[]).slice(0,3).map(x=>TEAMS[x].abbr).join(', ')||'none'}</span>`:`${teamLink(s.team)}${s.flip?' <span class="tag">flipped</span>':''}`;
    h+=`<tr><td class="n">${p.rank}</td><td>${esc(p.f)} ${esc(p.l)}</td><td>${p.pos}<span class="dim"> #${p.posRank}</span></td><td class="dim">${esc(p.city)}, ${p.st}</td><td class="n">${htStr(p.ht)} / ${p.wt}</td><td>${starsHtml(p.stars)}</td><td>${st}</td></tr>`;
  }
  h+=`</tbody></table></div>${total>shown?`<button type="button" class="more" id="rMore">Show more (${total-shown} left)</button>`:''}</section></div>`;
  return h;
}

/* ---------------- PORTAL ---------------- */
function viewPortal(L){
  const S=L.S;
  if(L.fIdx<IDX_PORTAL){
    const moves=[];for(const t of TEAMS)for(const p of teamCtx(S,t.i).ros)if(p.from!=null)moves.push(p);
    moves.sort((a,b)=>b.ovr-a.ovr);
    return `<p class="lede">The transfer portal opens with bowl season, ${whenIdx(S,IDX_PORTAL)} (in ${inHrs(idxMs(S,IDX_PORTAL))}). Players who aren't starting, or who want a bigger stage, can enter and pick a new school before next season.</p>
    <h3>Transfers playing this season</h3><div class="tbl"><table><thead><tr><th>Player</th><th>Pos</th><th>Class</th><th class="n">OVR</th><th>From</th><th>Now</th></tr></thead><tbody>${moves.slice(0,60).map(p=>`<tr><td>${esc(p.f)} ${esc(p.l)}</td><td>${p.pos}</td><td>${classLabel(p)}</td><td class="n ovr">${p.ovr}</td><td>${teamLink(p.from)}</td><td>${teamLink(p.team)}</td></tr>`).join('')||'<tr><td colspan="6" class="dim">This is a brand-new league, so nobody has transferred yet.</td></tr>'}</tbody></table></div>`;
  }
  const all=portal(S).entries.map(e=>({e,s:portalStatus(e,L.fIdx)})).filter(o=>o.s);
  const cnt={open:0,committed:0,withdrawn:0};for(const o of all)cnt[o.s.state]++;
  let h=`<p class="lede">The portal is open. ${all.length} players have entered: ${cnt.committed} have picked new schools, ${cnt.open} are still looking${cnt.withdrawn?`, ${cnt.withdrawn} withdrew`:''}. It closes when the ${seasonYear(S+1)} season kicks off.</p>
  <div class="filters"><label>Position <select id="pPos">${['ALL',...POS].map(p=>`<option${p===ui.pPos?' selected':''}>${p}</option>`).join('')}</select></label>
  <label>Status <select id="pStat">${[['all','All'],['open','Uncommitted'],['committed','Committed'],['withdrawn','Withdrew']].map(([v,l])=>`<option value="${v}"${v===ui.pStat?' selected':''}>${l}</option>`).join('')}</select></label></div>
  <div class="tbl"><table><thead><tr><th>Player</th><th>Pos</th><th>Class</th><th class="n">OVR</th><th>Recruit</th><th>From</th><th>Status</th><th>Entered</th></tr></thead><tbody>`;
  all.sort((a,b)=>b.e.p.ovr-a.e.p.ovr);
  for(const {e,s} of all){if(ui.pPos!=='ALL'&&e.p.pos!==ui.pPos)continue;if(ui.pStat!=='all'&&s.state!==ui.pStat)continue;
    h+=`<tr><td>${esc(e.p.f)} ${esc(e.p.l)}</td><td>${e.p.pos}</td><td>${classLabel(e.p)}</td><td class="n ovr">${e.p.ovr}</td><td>${starsHtml(e.p.stars)}</td><td>${teamLink(e.from)}</td><td>${s.state==='committed'?teamLink(s.team):s.state==='withdrawn'?'<span class="dim">Withdrew</span>':'<span class="dim">Uncommitted</span>'}</td><td class="dim">${whenIdx(S,e.enterAt)}</td></tr>`;}
  return h+`</tbody></table></div>`;
}

/* ---------------- ROUTER ---------------- */
function route(){
  const hsh=(location.hash||'').slice(1).toLowerCase();
  if(hsh.startsWith('team-')&&byAbbr[hsh.slice(5).toUpperCase()])return {view:'team',t:byAbbr[hsh.slice(5).toUpperCase()].i};
  if(['league','teams','recruiting','portal'].includes(hsh))return {view:hsh};
  return {view:'league'};
}
let lastRenderN=-1,lastRoute='';
function renderDesk(force){
  if(!tvReady)return;
  const L=locate(nowMs()),rt=route(),key=JSON.stringify(rt);
  if(!force&&key===lastRoute&&L.n===lastRenderN)return;
  const keepScroll=key===lastRoute?window.scrollY:null;lastRoute=key;lastRenderN=L.n;
  document.querySelectorAll('.tabs a').forEach(a=>a.setAttribute('aria-current',a.dataset.v===(rt.view==='team'?'teams':rt.view)?'page':'false'));
  const desk=$('desk');
  desk.innerHTML=rt.view==='team'?viewTeam(L,rt.t):rt.view==='teams'?viewTeams(L):rt.view==='recruiting'?viewRecruiting(L):rt.view==='portal'?viewPortal(L):viewLeague(L);
  if(keepScroll!=null)window.scrollTo(0,keepScroll);
}
$('desk').addEventListener('change',e=>{
  const id=e.target.id,v=e.target.value;
  if(id==='fPos'||id==='rPos'){ui.posF=v;ui.show=200;}else if(id==='rStar'){ui.starF=v;ui.show=200;}else if(id==='rStat'){ui.statF=v;ui.show=200;}
  else if(id==='pPos')ui.pPos=v;else if(id==='pStat')ui.pStat=v;else return;
  renderDesk(true);
});
$('desk').addEventListener('click',e=>{
  const b=e.target.closest('[data-tt]');if(b){ui.teamTab=b.dataset.tt;ui.posF='ALL';renderDesk(true);return;}
  if(e.target.id==='rMore'){ui.show+=200;renderDesk(true);}
});
addEventListener('hashchange',()=>{ui.posF='ALL';renderDesk(true);const d=$('deskTop');if(d&&location.hash)d.scrollIntoView({block:'start'});});

/* ---------------- NOW LINE + GUIDE ---------------- */
function progTitle(slotG,cur){
  const S=Math.floor(slotG/SPS),inS=slotG-S*SPS,w=Math.floor(inS/12),slot=inS%12;
  const g=w===14?classics(S)[slot]:null;
  if(w!==14){const gg=airedGame(S,w,slot);if(!gg||!known(gg,cur))return {lab:slotTitle(S,w,slot).toLowerCase(),m:'Teams to be decided'};
    return {lab:gg.kind==='reg'?`Week ${w+1}`:gg.title.toLowerCase(),m:`${TEAMS[gg.away].name} ${gg.neutral?'vs':'at'} ${TEAMS[gg.home].name}`};}
  return {lab:'PGN Classic',m:`${TEAMS[g.away].name} ${g.neutral?'vs':'at'} ${TEAMS[g.home].name}`};
}
function renderGuide(){
  const L=locate(nowMs());let html='';
  for(let k=0;k<12;k++){const sg=L.slotG+k,p=progTitle(sg,L);html+=`<div class="t${k===0?' now':''}">${fmtTime(slotStart(sg))}</div><div${k===0?' class="now"':''}>${esc(p.lab)} · ${esc(p.m)}</div><div class="s${k===0?' now':''}">${k===0?'ON NOW':''}</div>`;}
  $('guideGrid').innerHTML=html;$('guideClock').textContent=fmtTime(nowMs());
}
window.onTvTick=(B,seg,L)=>{
  const g=B.g,A=TEAMS[g.away],Hm=TEAMS[g.home],v=g.neutral?'vs':'at',cs=currentScoreOf(g,L.s);let st;
  if(L.s<120)st=`<b>PREGAME</b> · ${esc(A.name)} ${v} ${esc(Hm.name)} · kickoff in ${fmtClock(120-L.s)}`;
  else if(L.s>=1680)st=`<b>FINAL</b> · ${esc(A.name)} ${cs.sc[1]}, ${esc(Hm.name)} ${cs.sc[0]}`;
  else st=`<b>${L.s>=840&&L.s<960?'HALFTIME':g.kind==='classic'?'CLASSIC':'LIVE'}</b> · ${esc(A.name)} ${cs.sc[1]}, ${esc(Hm.name)} ${cs.sc[0]}${L.s>=840&&L.s<960?'':` · ${cs.lab.replace('Q','Q')}`}`;
  $('nowline').innerHTML=st;
  const nx=progTitle(L.slotG+1,L);
  $('nextline').textContent=`${g.kind==='classic'?`PGN Classics · ${seasonYear(g.S)} ${g.origTitle.toLowerCase()}`:g.kind==='reg'?`${seasonYear(g.S)} · week ${g.w+1}, game ${g.slot+1} of 12`:g.title.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase())}. Up next at ${fmtTime(slotStart(L.slotG+1))}: ${nx.m}.`;
  if(!$('guide').hidden)renderGuide();
  renderDesk(false);
};
function toggleGuide(){const gd=$('guide');gd.hidden=!gd.hidden;$('bGuide').setAttribute('aria-pressed',String(!gd.hidden));if(!gd.hidden)renderGuide();}
function toggleSound(){initAudio();if(!AC)return;if(AC.state==='suspended')AC.resume();soundOn=!soundOn;$('bSound').setAttribute('aria-pressed',String(soundOn));if(soundOn)sfx('sting');}
function toggleFull(){const el=$('screen');try{if(document.fullscreenElement)document.exitFullscreen();else el.requestFullscreen?.().catch(()=>{});}catch(e){}}
$('bGuide').onclick=toggleGuide;$('bSound').onclick=toggleSound;$('bFull').onclick=toggleFull;
addEventListener('keydown',e=>{if(e.metaKey||e.ctrlKey||e.altKey)return;if(/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName))return;const k=e.key.toLowerCase();
  if(k==='g')toggleGuide();else if(k==='m')toggleSound();else if(k==='f')toggleFull();else if(k==='escape'&&!$('guide').hidden)toggleGuide();});

// test hooks: ?t=ISO, or pgnSetTime('2026-11-14T17:58:30Z') from the console
window.pgnSetTime=iso=>{tvSetTime(iso);renderDesk(true);};
try{const q=new URLSearchParams(location.search).get('t');if(q)tvSetTime(q);}catch(e){}

// Build the league after the first frame so "tuning in" shows while the history computes.
setTimeout(()=>{
  const t0=performance.now();const L=locate(nowMs());stateStart(L.S);broadcast(L.slotG);
  tvReady=true;renderDesk(true);console.info(`PGN league ready in ${Math.round(performance.now()-t0)} ms`);
},60);
