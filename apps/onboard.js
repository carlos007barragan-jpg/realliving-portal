/* ===================================================================
   Real Living — onboarding gate (shared by the portal, the Document
   Hub and the Training Center).

   A new person signs what their vertical requires, then trains on
   what their vertical requires, and only then does the rest of the
   Business Suite unlock.

   State lives in Supabase: records.collection='onboarding', id = auth user id.
     { email, name, seatId, sigs:{docId:{name,ts}}, tracks:{trackId:ts},
       docsDoneAt, trainingDoneAt }
=================================================================== */
(function(global){
'use strict';

const SB_URL='https://zfflgvjnkcjnbwydurlp.supabase.co';
const SB_KEY='sb_publishable_j6aQ477N29Dx1aH-mMkiKw_PBV6CCyf';

/* ---------- what each vertical requires ----------
   kind: 'sign' = typed signature required · 'ack' = read and acknowledge */
const COMPANY=[
  {id:'c2', kind:'ack',  t:'Offer & Engagement Letter'},
  {id:'c3', kind:'sign', t:'Team Member Agreement'},
  {id:'c4', kind:'sign', t:'Confidentiality & NDA'},
  {id:'c5', kind:'sign', t:'Confidentiality & Non-Disparagement Agreement'},
  {id:'c6', kind:'sign', t:'Non-Compete Agreement'},
  {id:'c7', kind:'sign', t:'Photo, Video & Media Release'},
  {id:'c8', kind:'sign', t:'IRS Form W-9'},
  {id:'c9', kind:'ack',  t:'Payment & Tax Setup'},
  {id:'c11',kind:'ack',  t:'Contractor Handbook'},
  {id:'c12',kind:'ack',  t:'New-Hire Onboarding & First-Week Ramp'},
  {id:'c10',kind:'sign', t:'Onboarding Acknowledgement'}
];
const BIZ_DOCS={
  asap:[{id:'a20',kind:'sign',t:'ASAP Lending Addendum'},
        {id:'a13',kind:'sign',t:'Agent Code of Conduct'},
        {id:'a18',kind:'ack', t:'Broker Disclosure'},
        {id:'a1', kind:'ack', t:'Agent Onboarding Guide'}],
  h2m: [{id:'h38',kind:'sign',t:'H2M Addendum'},
        {id:'h15',kind:'sign',t:'Code of Conduct'},
        {id:'h13',kind:'ack', t:'Buyer Disclosure Form'},
        {id:'h16',kind:'ack', t:'Buyer Privacy Notice'},
        {id:'h1a',kind:'ack', t:'Marketer Onboarding Guide'}],
  rl:  [],   /* RL Team paperwork runs through eXp — nothing to sign in here yet */
  tc:  [],
  va:  [{id:'c14',kind:'sign',t:'Virtual Assistant Addendum'}]
};
const BIZ_LABEL={asap:'ASAP Lending',h2m:'H2M — Creative Financing',rl:'RL Licensed Team',tc:'Transaction Coordination',va:'Virtual Assistant'};
const BIZ_TRACK={asap:'asap',h2m:'h2m',rl:'rl',tc:null,va:null};
const TRACK_LABEL={fundamentals:'Sales Fundamentals',asap:'ASAP Lending',h2m:'H2M — Creative Financing',rl:'RL Licensed Team'};

/* pipelines on a CRM seat → which businesses this person actually works */
function bizFromSeat(seat){
  const out=[];
  const pipes=(seat&&seat.pipes)||[];
  const role=(seat&&seat.role)||'';
  if(role==='owner'||role==='manager'||role==='admin')return ['asap','h2m','rl','tc'];
  if(pipes.indexOf('asap')>-1)out.push('asap');
  if(pipes.some(p=>p.indexOf('h2m')===0))out.push('h2m');
  if(pipes.indexOf('rl_buy')>-1||pipes.indexOf('rl_list')>-1)out.push('rl');
  if(pipes.indexOf('tc')>-1)out.push('tc');
  if(seat&&seat.va===true)out.push('va');
  return out;
}
function docsFor(biz){
  const seen={},list=[];
  COMPANY.concat(...biz.map(b=>BIZ_DOCS[b]||[])).forEach(d=>{if(!seen[d.id]){seen[d.id]=1;list.push(d)}});
  return list;
}
function tracksFor(biz){
  const out=['fundamentals'];
  biz.forEach(b=>{const t=BIZ_TRACK[b];if(t&&out.indexOf(t)<0)out.push(t)});
  return out;
}

/* ---------- state ---------- */
let _sb=null;
function client(){
  if(_sb)return _sb;
  if(!global.supabase)return null;
  _sb=global.supabase.createClient(SB_URL,SB_KEY);
  return _sb;
}
async function load(sb){
  sb=sb||client(); if(!sb)return null;
  const {data:{session}}=await sb.auth.getSession();
  if(!session)return null;
  const uid=session.user.id, email=(session.user.email||'').toLowerCase();
  let seat=null;
  try{
    const {data:us}=await sb.from('records').select('id,data').eq('collection','users').eq('deleted',false);
    seat=(us||[]).map(r=>r.data).filter(u=>(u.email||'').toLowerCase()===email)[0]||null;
  }catch(e){}
  let st=null;
  try{
    const {data}=await sb.from('records').select('data').eq('collection','onboarding').eq('id',uid).single();
    st=data?data.data:null;
  }catch(e){}
  if(!st)st={email,name:(session.user.user_metadata&&session.user.user_metadata.full_name)||email,seatId:seat?seat.id:null,sigs:{},tracks:{}};
  const biz=bizFromSeat(seat);
  const docs=docsFor(biz), tracks=tracksFor(biz);
  const signed=docs.filter(d=>st.sigs&&st.sigs[d.id]).length;
  const trained=tracks.filter(t=>st.tracks&&st.tracks[t]).length;
  const docsDone=signed>=docs.length;
  const trainDone=docsDone&&trained>=tracks.length;
  return {
    sb, uid, email, session, seat, state:st,
    biz, bizLabels:biz.map(b=>BIZ_LABEL[b]).filter(Boolean),
    docs, tracks, signed, trained, docsDone, trainDone,
    stage: !docsDone ? 'docs' : (!trainDone ? 'training' : 'done')
  };
}
async function save(ctx){
  const st=ctx.state;
  if(ctx.docsDone&&!st.docsDoneAt)st.docsDoneAt=new Date().toISOString();
  if(ctx.trainDone&&!st.trainingDoneAt)st.trainingDoneAt=new Date().toISOString();
  const {error}=await ctx.sb.from('records').upsert({
    collection:'onboarding', id:ctx.uid, data:st, updated_at:new Date().toISOString(), deleted:false
  },{onConflict:'collection,id'});
  return error?error.message:null;
}
/* one signature */
async function sign(ctx,docId,typedName){
  ctx.state.sigs=ctx.state.sigs||{};
  ctx.state.sigs[docId]={name:typedName,ts:new Date().toISOString()};
  return await save(ctx);
}
/* one training track finished */
async function completeTrack(ctx,trackId){
  ctx.state.tracks=ctx.state.tracks||{};
  if(!ctx.state.tracks[trackId])ctx.state.tracks[trackId]=new Date().toISOString();
  return await save(ctx);
}

global.RLOnboard={load,save,sign,completeTrack,docsFor,tracksFor,bizFromSeat,
  COMPANY,BIZ_DOCS,BIZ_LABEL,TRACK_LABEL,client};
})(window);
