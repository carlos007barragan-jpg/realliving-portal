/* Document Hub — visibility filter for post-onboarding.
   Once onboarding is done, the person sees the full Document Hub but only
   the documents that pertain to their verticals and role.
*/
(function(){
'use strict';
let CTX=null, origRender=null;

async function boot(){
  if(!window.RLOnboard)return;
  try{
    CTX=await window.RLOnboard.load();
    if(!CTX||!CTX.docsDone)return;  /* gate showing, no filter needed */
    
    if(typeof window.renderDocs==='function' && !window._filterWrapped){
      origRender=window.renderDocs;
      window.renderDocs=function(){
        origRender.apply(this,arguments);
        try{ filterDocs(CTX); }catch(e){ console.error('[visibility]',e); }
      };
      window._filterWrapped=true;
      filterDocs(CTX);
    }
  }catch(e){console.error('[docs visibility]',e)}
}

function filterDocs(ctx){
  if(!ctx||!ctx.biz||!ctx.biz.length)return;
  const vizBiz=ctx.biz;
  const els=document.querySelectorAll('[data-id]');
  els.forEach(el=>{
    const id=el.getAttribute('data-id');
    let docBiz=null;
    try{
      const doc=(window.DOCS||[]).find(d=>d.id===id);
      if(!doc){ el.style.display='none'; return; }
      docBiz=doc.biz;
    }catch(e){ return; }
    const show=(docBiz==='all')||(vizBiz.indexOf(docBiz)>-1);
    el.style.display=show?'':'none';
  });
}

if(document.readyState==='loading')
  document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,1000));
else
  setTimeout(boot,1000);
})();
