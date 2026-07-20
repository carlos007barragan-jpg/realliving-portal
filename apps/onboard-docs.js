/* Document Hub — required-paperwork layer.
   Appended after the hub's own code so it can reuse openDoc() and DOCS.
   A person with outstanding paperwork sees ONLY what they must sign;
   the full hub opens the moment the last signature lands. */
(function(){
'use strict';
let CTX=null;

const CSS=`
#obWrap{position:fixed;inset:0;background:#0B1220;color:#E9EEF7;z-index:9000;overflow:auto;font-family:inherit;display:none}
#obWrap .in{max-width:820px;margin:0 auto;padding:34px 20px 80px}
#obWrap h1{font-size:24px;font-weight:800;margin:0 0 6px}
#obWrap .sub{color:#93A4BF;font-size:14.5px;line-height:1.65;margin-bottom:22px}
#obWrap .bar{height:8px;background:#1B2739;border-radius:999px;overflow:hidden;margin:18px 0 6px}
#obWrap .bar i{display:block;height:100%;background:#C8A44D;transition:width .3s}
#obWrap .count{font-size:12.5px;color:#93A4BF;margin-bottom:22px}
#obWrap .grp{font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:#C8A44D;font-weight:800;margin:24px 0 10px}
#obWrap .gsub{display:block;font-size:11.5px;letter-spacing:0;text-transform:none;color:#7E8FA8;font-weight:500;margin-top:3px}
#obWrap .row{display:flex;gap:14px;align-items:center;background:#111C2E;border:1px solid #1F2C42;border-radius:12px;padding:14px 16px;margin-bottom:9px}
#obWrap .row.done{opacity:.62}
#obWrap .row .t{font-weight:700;font-size:14.5px}
#obWrap .row .m{font-size:12px;color:#93A4BF;margin-top:2px}
#obWrap .row .sp{flex:1}
#obWrap button{font-family:inherit;font-weight:600;font-size:13px;border-radius:9px;padding:9px 15px;cursor:pointer;border:1px solid #2A3A55;background:#18243A;color:#E9EEF7}
#obWrap button.go{background:#C8A44D;border-color:#C8A44D;color:#231B06}
#obWrap button:disabled{opacity:.45;cursor:default}
#obWrap .tick{width:22px;height:22px;border-radius:50%;border:2px solid #2A3A55;flex:none;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800}
#obWrap .tick.on{background:#1E7F4F;border-color:#1E7F4F;color:#fff}
#obWrap .done-card{background:#111C2E;border:1px solid #1F2C42;border-radius:14px;padding:26px;text-align:center;margin-top:26px}
#obSign{position:fixed;inset:0;background:rgba(3,8,18,.72);z-index:9100;display:none;overflow:auto;padding:26px 16px}
#obSign .card{max-width:560px;margin:6vh auto;background:#0F1A2B;border:1px solid #24334C;border-radius:16px;padding:24px 26px 26px}
#obSign h3{font-size:18px;font-weight:800;margin-bottom:6px}
#obSign p{color:#93A4BF;font-size:13.5px;line-height:1.7}
#obSign label{display:block;font-size:12px;font-weight:700;color:#93A4BF;margin:16px 0 6px;text-transform:uppercase;letter-spacing:.05em}
#obSign input[type=text]{width:100%;padding:13px 14px;border-radius:10px;border:1px solid #2A3A55;background:#0B1524;color:#E9EEF7;font-size:22px;font-family:'Brush Script MT','Segoe Script',cursive}
#obSign .agree{display:flex;gap:10px;align-items:flex-start;margin-top:16px;font-size:13px;color:#C7D3E6;line-height:1.6}
#obSign .agree input{margin-top:3px;flex:none;width:17px;height:17px}
#obSign .err{color:#FF8A8A;font-size:13px;min-height:18px;margin-top:10px}
#obSign .acts{display:flex;gap:10px;margin-top:14px}
#obSign button{font-family:inherit;font-weight:600;font-size:13.5px;border-radius:10px;padding:11px 18px;cursor:pointer;border:1px solid #2A3A55;background:#18243A;color:#E9EEF7}
#obSign button.go{background:#C8A44D;border-color:#C8A44D;color:#231B06}
`;

function el(id){return document.getElementById(id)}
function esc(x){return String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function title(id,fallback){
  try{const d=(window.DOCS||[]).filter(x=>x.id===id)[0];if(d)return d.t}catch(e){}
  return fallback||id;
}

function mount(){
  if(el('obWrap'))return;
  const st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
  const w=document.createElement('div');w.id='obWrap';w.innerHTML='<div class="in" id="obIn"></div>';
  document.body.appendChild(w);
  const s=document.createElement('div');s.id='obSign';s.innerHTML='<div class="card" id="obSignCard"></div>';
  document.body.appendChild(s);
  s.addEventListener('click',e=>{if(e.target===s)s.style.display='none'});
}

function render(){
  mount();
  const w=el('obWrap');
  if(!CTX||CTX.docsDone){ w.style.display='none'; return; }
  w.style.display='block';
  const pct=Math.round(CTX.signed/CTX.docs.length*100);
  const need=CTX.docs.filter(d=>!CTX.state.sigs[d.id]);
  /* group by WHY each one applies — base set, each vertical, then the role */
  const groups=[];
  const push=(key,label,sub)=>{
    const items=CTX.docs.filter(d=>d.why===key);
    if(items.length)groups.push({label,sub,items});
  };
  push('company','Everyone at Real Living','The base agreements every team member signs');
  CTX.biz.forEach(b=>push(b,(window.RLOnboard.BIZ_LABEL[b]||b),'Required because you work this side of the business'));
  push('role:'+CTX.role,'Because you\'re '+(CTX.role==='owner'?'in ownership':(CTX.roleLabel||'on the team')),'Tied to your role, not your vertical');
  const row=d=>{
    const done=!!CTX.state.sigs[d.id];
    return '<div class="row'+(done?' done':'')+'">'+
      '<div class="tick'+(done?' on':'')+'">'+(done?'\u2713':'')+'</div>'+
      '<div><div class="t">'+esc(title(d.id,d.t))+'</div>'+
      '<div class="m">'+(done
        ? 'Signed '+new Date(CTX.state.sigs[d.id].ts).toLocaleDateString()+' as '+esc(CTX.state.sigs[d.id].name)
        : (d.kind==='sign'?'Read it, then sign':'Read it, then acknowledge'))+'</div></div>'+
      '<div class="sp"></div>'+
      '<button onclick="RLOB.open(\''+d.id+'\')">Read</button>'+
      (done?'':'<button class="go" onclick="RLOB.ask(\''+d.id+'\')">'+(d.kind==='sign'?'Sign':'Acknowledge')+'</button>')+
      '</div>';
  };
  el('obIn').innerHTML=
    '<h1>Before you start — your paperwork</h1>'+
    '<div class="sub">Welcome to Real Living. Everyone signs the company agreements, plus whatever their side of the business requires. '+
      (CTX.bizLabels.length?'Yours: <b>'+esc(CTX.bizLabels.join(' · '))+'</b>. ':'')+
      'Read each one, then sign it. The rest of the Business Suite opens as soon as you\u2019re finished.</div>'+
    '<div class="bar"><i style="width:'+pct+'%"></i></div>'+
    '<div class="count">'+CTX.signed+' of '+CTX.docs.length+' complete'+(need.length?' \u00b7 '+need.length+' to go':'')+'</div>'+
    groups.map(g=>'<div class="grp">'+esc(g.label)+'<span class="gsub">'+esc(g.sub)+'</span></div>'+g.items.map(row).join('')).join('');
}

function done(){
  mount();
  el('obWrap').style.display='block';
  el('obIn').innerHTML='<h1>Paperwork complete</h1>'+
    '<div class="sub">Every document your role requires is signed and on file.</div>'+
    '<div class="done-card"><div style="font-size:40px">\u2713</div>'+
    '<div style="font-weight:800;font-size:17px;margin:10px 0 6px">Training is next</div>'+
    '<div class="sub" style="margin:0 0 18px">The Training Center is now unlocked. Finish the tracks for your role and the rest of the Business Suite opens.</div>'+
    '<button class="go" onclick="RLOB.toTraining()">Go to training \u2192</button>'+
    '<button onclick="RLOB.hide()" style="margin-left:8px">Browse the documents</button></div>';
}

const RLOB={
  open(id){
    el('obWrap').style.display='none';
    try{ if(typeof window.openDoc==='function'){window.openDoc(id);return} }catch(e){}
    alert('Open the document from the hub list — this build could not open it directly.');
    el('obWrap').style.display='block';
  },
  hide(){ el('obWrap').style.display='none' },
  show(){ CTX&&CTX.docsDone?done():render() },
  toTraining(){
    try{ if(window.parent&&window.parent!==window){window.parent.postMessage({rl:'onboarding',go:'training'},'*');return} }catch(e){}
    location.href='training.html';
  },
  ask(id){
    const d=CTX.docs.filter(x=>x.id===id)[0]; if(!d)return;
    const nm=(CTX.state.name||'').trim();
    el('obSign').style.display='block';
    el('obSignCard').innerHTML=
      '<h3>'+esc(title(id,d.t))+'</h3>'+
      '<p>'+(d.kind==='sign'
        ? 'Type your full legal name below. That typed name is your electronic signature on this document, with the same effect as signing on paper.'
        : 'Type your full legal name to confirm you have read this document and understand it.')+'</p>'+
      '<label>Full legal name</label><input type="text" id="obName" value="'+esc(nm)+'" autocomplete="name">'+
      '<div class="agree"><input type="checkbox" id="obChk"><div>'+
        (d.kind==='sign'
          ? 'I have read this document and I agree to be bound by it. I intend my typed name to be my signature.'
          : 'I have read this document and I understand it.')+
        ' Dated '+new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})+'.</div></div>'+
      '<div class="err" id="obErr"></div>'+
      '<div class="acts"><button class="go" id="obGo">'+(d.kind==='sign'?'Sign this document':'Acknowledge')+'</button>'+
      '<button onclick="document.getElementById(\'obSign\').style.display=\'none\'">Cancel</button></div>';
    el('obGo').onclick=async()=>{
      const name=(el('obName').value||'').trim();
      const err=el('obErr');
      if(name.length<3){err.textContent='Please type your full legal name.';return}
      if(!el('obChk').checked){err.textContent='Tick the box to confirm.';return}
      el('obGo').disabled=true;el('obGo').textContent='Saving…';
      const fail=await window.RLOnboard.sign(CTX,id,name);
      if(fail){err.textContent='Could not save: '+fail;el('obGo').disabled=false;el('obGo').textContent='Try again';return}
      CTX.state.name=name;
      CTX=await window.RLOnboard.load(CTX.sb);
      el('obSign').style.display='none';
      CTX.docsDone?done():render();
    };
  }
};
window.RLOB=RLOB;

async function boot(){
  if(!window.RLOnboard)return;
  try{
    CTX=await window.RLOnboard.load();
    if(!CTX)return;                     /* not signed in — the hub's own login handles it */
    if(!CTX.docsDone)render();
  }catch(e){console.error('[onboarding]',e)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,400));
else setTimeout(boot,400);
})();
