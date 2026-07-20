/* Training Center — onboarding layer.
   The hub keeps its own progress in localStorage; this mirrors track
   completion up to Supabase so the portal knows when to unlock the suite. */
(function(){
'use strict';
let CTX=null, banner=null;

const CSS=`
#tbBar{position:sticky;top:0;z-index:8000;background:linear-gradient(135deg,#0F1A2B,#16243A);color:#E9EEF7;padding:14px 20px;font-family:inherit;display:none}
#tbBar .h{font-size:14.5px;font-weight:800}
#tbBar .s{font-size:12.5px;color:#9FB0CA;margin-top:3px;line-height:1.6}
#tbBar .tk{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);border-radius:999px;padding:5px 12px;font-size:12px;font-weight:700;margin:9px 7px 0 0}
#tbBar .tk.ok{background:rgba(74,222,128,.14);border-color:rgba(74,222,128,.4);color:#B7F5CE}
#tbBar button{font-family:inherit;font-weight:700;font-size:12.5px;border-radius:9px;padding:8px 15px;cursor:pointer;border:none;background:#C8A44D;color:#231B06;margin-top:10px}
`;

function pctOf(tid){
  try{ if(typeof window.trackPct==='function')return window.trackPct(tid)||0; }catch(e){}
  return 0;
}
function label(tid){
  try{ if(window.TRACKS&&window.TRACKS[tid])return window.TRACKS[tid].name }catch(e){}
  return (window.RLOnboard&&window.RLOnboard.TRACK_LABEL[tid])||tid;
}

function render(){
  if(!CTX)return;
  if(!banner){
    const st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
    banner=document.createElement('div');banner.id='tbBar';
    document.body.insertBefore(banner,document.body.firstChild);
  }
  if(CTX.trainDone||!CTX.docsDone){ banner.style.display='none'; return; }
  banner.style.display='block';
  const done=CTX.tracks.filter(t=>CTX.state.tracks&&CTX.state.tracks[t]);
  banner.innerHTML=
    '<div class="h">Finish these tracks to unlock the rest of the Business Suite</div>'+
    '<div class="s">Your role requires '+CTX.tracks.length+' track'+(CTX.tracks.length>1?'s':'')+'. '+
      'Work through the modules \u2014 each one marks itself off as you pass its quiz.</div>'+
    '<div>'+CTX.tracks.map(t=>{
      const ok=done.indexOf(t)>-1, p=ok?100:pctOf(t);
      return '<span class="tk'+(ok?' ok':'')+'">'+(ok?'\u2713 ':'')+label(t)+(ok?'':' \u00b7 '+p+'%')+'</span>';
    }).join('')+'</div>'+
    (done.length===CTX.tracks.length?'<button onclick="RLTB.finish()">Everything is unlocked \u2014 back to the suite</button>':'');
}

/* every few seconds, push any newly finished track up to Supabase */
async function sweep(){
  if(!CTX||!CTX.docsDone||CTX.trainDone)return;
  let changed=false;
  for(const t of CTX.tracks){
    if(CTX.state.tracks&&CTX.state.tracks[t])continue;
    if(pctOf(t)>=100){ await window.RLOnboard.completeTrack(CTX,t); changed=true; }
  }
  if(changed){
    CTX=await window.RLOnboard.load(CTX.sb);
    render();
    try{ if(window.parent&&window.parent!==window)window.parent.postMessage({rl:'onboarding',go:'refresh'},'*') }catch(e){}
  }else render();
}

window.RLTB={
  finish(){
    try{ if(window.parent&&window.parent!==window){window.parent.postMessage({rl:'onboarding',go:'home'},'*');return} }catch(e){}
    location.href='../index.html';
  },
  ctx(){return CTX}
};

async function boot(){
  if(!window.RLOnboard)return;
  try{
    CTX=await window.RLOnboard.load();
    if(!CTX)return;
    render();
    setInterval(sweep,4000);
  }catch(e){console.error('[onboarding/training]',e)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,500));
else setTimeout(boot,500);
})();
