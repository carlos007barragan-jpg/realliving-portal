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
/* SECOND AXIS — the vertical addendum and whatever that vertical requires */
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
  tc:  []
};
/* THIRD AXIS — what the person's ROLE requires, whatever vertical they sit in */
const ROLE_DOCS={
  owner:   [{id:'c1', kind:'ack', t:'Manager Cover Sheet'},
            {id:'c13',kind:'ack', t:'Offboarding & Separation Checklist'}],
  manager: [{id:'c1', kind:'ack', t:'Manager Cover Sheet'},
            {id:'c13',kind:'ack', t:'Offboarding & Separation Checklist'}],
  agent:   [],
  marketing:[],
  va:      [{id:'c14',kind:'sign',t:'Virtual Assistant Addendum'}],
  referral:[{id:'a9', kind:'sign',t:'Referral Partner Agreement (ASAP)'},
            {id:'a14',kind:'sign',t:'Referral Partner NDA'},
            {id:'h17',kind:'sign',t:'Referral Partner Agreement (H2M)'}]
};
const BIZ_LABEL={asap:'ASAP Lending',h2m:'H2M — Creative Financing',rl:'RL Licensed Team',tc:'Transaction Coordination'};
const ROLE_LABEL={owner:'Ownership',manager:'Manager',agent:'Agent',marketing:'Marketing',va:'Virtual Assistant',referral:'Referral partner'};
const BIZ_TRACK={asap:'asap',h2m:'h2m',rl:'rl',tc:null,va:null};
const TRACK_LABEL={
  fundamentals:'Sales Fundamentals',
  crm:'How to Use the CRM',
  suite:'Business Suite — Getting Started',
  asap:'ASAP Lending',h2m:'H2M — Creative Financing',rl:'RL Licensed Team'
};

/* pipelines on a CRM seat → which businesses this person actually works */
function bizFromSeat(seat){
  const out=[];
  const pipes=(seat&&seat.pipes)||[];
  const role=(seat&&seat.role)||'';
  const ALL=['asap','h2m','rl','tc'];
  /* ownership sees the whole company, always */
  if(role==='owner'||role==='admin')return ALL.slice();
  /* an explicit choice in Suite → Settings → Team beats pipeline guesswork.
     'ALL' is the deliberate see-everything setting; a single code narrows to it.
     Seats with nothing assigned fall through to the pipeline logic below, so
     nobody's existing scope moves until ownership actually sets it. */
  const assigned=seat&&seat.business;
  if(assigned){
    const a=String(assigned).toUpperCase();
    if(a==='ALL')return ALL.slice();
    if(ALL.indexOf(a.toLowerCase())>-1)return [a.toLowerCase()];
  }
  /* a manager holding no pipelines yet covers everything */
  if(role==='manager'&&!pipes.length)return ALL.slice();
  if(pipes.indexOf('asap')>-1)out.push('asap');
  if(pipes.some(p=>p.indexOf('h2m')===0))out.push('h2m');
  if(pipes.indexOf('rl_buy')>-1||pipes.indexOf('rl_list')>-1)out.push('rl');
  if(pipes.indexOf('tc')>-1)out.push('tc');
  return out;
}
/* the role tier a seat sits in — drives the third axis */
function roleFromSeat(seat){
  const r=(seat&&seat.role)||'agent';
  if(seat&&seat.va===true)return 'va';
  if(seat&&seat.referralPartner===true)return 'referral';
  if(r==='admin')return 'owner';
  return ['owner','manager','agent','marketing'].indexOf(r)>-1?r:'agent';
}
/* every requirement, tagged with why it applies, so a person can see the reason */
function requirements(biz,role){
  const seen={},list=[];
  const add=(arr,why)=>((arr||[]).forEach(d=>{if(!seen[d.id]){seen[d.id]=1;list.push(Object.assign({},d,{why}))}}));
  /* a referral partner is not a team member — they don't sign the employment set,
     only the paperwork that makes a referral relationship legal */
  if(role==='referral'){
    add(COMPANY.filter(d=>['c8','c9'].indexOf(d.id)>-1),'company');
    biz.forEach(b=>add((BIZ_DOCS[b]||[]).filter(d=>d.kind==='ack'),b));
    add(ROLE_DOCS.referral,'role:referral');
    return list;
  }
  add(COMPANY,'company');
  biz.forEach(b=>add(BIZ_DOCS[b],b));
  add(ROLE_DOCS[role],'role:'+role);
  return list;
}
function docsFor(biz,role){ return requirements(biz,role||'agent'); }
/* Only tracks that actually exist in the Training Center may be required here.
   The hub currently ships: fundamentals, asap, h2m, rl.
   'crm' is now built (9 modules in training.html). 'suite' is still not built —
   requiring a track that does not exist leaves a new hire permanently stuck at the
   training stage with nothing to finish, so only list tracks that really exist. */
const LIVE_TRACKS=['fundamentals','crm','asap','h2m','rl'];
function tracksFor(biz){
  const out=['fundamentals','crm'];  /* everyone learns the system itself */
  biz.forEach(b=>{const t=BIZ_TRACK[b];if(t&&out.indexOf(t)<0)out.push(t)});
  return out.filter(t=>LIVE_TRACKS.indexOf(t)>-1);
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
  const role=roleFromSeat(seat);
  const docs=docsFor(biz,role), tracks=tracksFor(biz);
  /* a document counts as settled when it's signed OR an owner waived it as not applicable */
  const isWaived=id=>!!(st.waived&&st.waived[id]);
  const isSigned=id=>!!(st.sigs&&st.sigs[id]);
  docs.forEach(d=>{ d.waived=isWaived(d.id); d.waiver=d.waived?st.waived[d.id]:null; });
  const signed=docs.filter(d=>isSigned(d.id)||isWaived(d.id)).length;
  const waivedCount=docs.filter(d=>isWaived(d.id)&&!isSigned(d.id)).length;
  const trained=tracks.filter(t=>st.tracks&&st.tracks[t]).length;
  const docsDone=signed>=docs.length;
  const trainDone=docsDone&&trained>=tracks.length;
  return {
    sb, uid, email, session, seat, state:st,
    biz, role, roleLabel:ROLE_LABEL[role]||'Team member',
    bizLabels:biz.map(b=>BIZ_LABEL[b]).filter(Boolean),
    docs, tracks, signed, waivedCount, trained, docsDone, trainDone,
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

global.RLOnboard={load,save,sign,completeTrack,docsFor,tracksFor,bizFromSeat,roleFromSeat,requirements,
  COMPANY,BIZ_DOCS,ROLE_DOCS,BIZ_LABEL,ROLE_LABEL,TRACK_LABEL,client};
})(window);
