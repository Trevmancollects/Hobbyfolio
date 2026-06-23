'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const PLATFORMS=["eBay","Whatnot","COMC","Facebook","Instagram","Discord","Show/LCS","Cash","Other"];
const PLATFORM_FEES={eBay:12.9,Whatnot:8,COMC:10,Facebook:5,Instagram:5,Discord:0,"Show/LCS":0,Cash:0,Other:0};
const GRADES=["PSA 10","PSA 9","PSA 8","PSA 7","PSA 6","PSA 5","BGS 10","BGS 9.5","BGS 9","BGS 8.5","BGS 8","SGC 10","SGC 9.5","SGC 9","SGC 8","Raw"];
const GRADING_FEES={"PSA Economy":20,"PSA Regular":50,"PSA Express":150,"PSA Super Express":300,"BGS Economy":22,"BGS Regular":75,"BGS Express":150,"SGC Regular":30};
const CONDITIONS=["Raw","Graded"];
const ACTIVE_STATUSES=["For Sale","PC","Trade Bait","At Consignment","Submitted for Grading"];
const ALL_STATUSES=[...ACTIVE_STATUSES,"Sold","Archived"];
const DEDUCTION_CATEGORIES=["Shipping","Supplies","Show Entry Fee","Home Office","Grading Fees","Platform Fees","Printing/Labels","Storage","Other"];
const OFFER_STATUSES=["Pending","Accepted","Declined","Expired","Countered"];
const JOURNAL_TAGS=["General","Show Notes","Market Obs","Weekly Review","Deal Analysis","Grading Notes"];
const IRS_MILEAGE_RATE=0.70;
const SE_TAX_RATE=0.9235*0.153;
const COLLECTIBLES_LT_RATE=0.28;
const NAV_ITEMS=[
  {id:"dashboard",label:"Dashboard",icon:"▦"},{id:"portfolio",label:"Portfolio",icon:"◉"},{id:"inventory",label:"Inventory",icon:"⊞"},
  {id:"transactions",label:"Transactions",icon:"⇄"},{id:"pnl",label:"P&L",icon:"∿"},
  {id:"tax",label:"Tax Center",icon:"%"},{id:"tools",label:"Tools",icon:"⚙"},
  {id:"journal",label:"Journal",icon:"✎"},
];
const ACCENT="#3B82F6",GREEN="#10B981",RED="#EF4444",AMBER="#F59E0B",PURPLE="#8B5CF6";
const COLORS=[ACCENT,PURPLE,GREEN,AMBER,RED,"#EC4899","#14B8A6"];
const CL_MAP={
  "player name":"player","player":"player","name":"player",
  "year":"year","set":"set","set name":"set",
  "card number":"cardNum","card #":"cardNum","#":"cardNum",
  "parallel":"parallel","variant":"parallel",
  "grade":"grade","graded":"grade","psa grade":"grade","bgs grade":"grade","sgc grade":"grade","card grade":"grade","grading":"grade","slab grade":"grade","certification grade":"grade",
  "certification":"certNum","cert":"certNum","cert #":"certNum","cert number":"certNum","cert no":"certNum",
  "certification number":"certNum","serial":"certNum","serial number":"certNum","slab #":"certNum",
  "psa #":"certNum","bgs #":"certNum","sgc #":"certNum",
  "purchase price":"buyPrice","cost":"buyPrice","buy price":"buyPrice","paid":"buyPrice","investment":"buyPrice",
  "purchase date":"buyDate","buy date":"buyDate","date purchased":"buyDate","date bought":"buyDate","acquisition date":"buyDate","date acquired":"buyDate","bought date":"buyDate","date":"buyDate","purchase":"buyDate",
  "purchase platform":"buyPlatform","platform":"buyPlatform","bought from":"buyPlatform",
  "current value":"marketValue","market value":"marketValue","value":"marketValue",
  "condition":"condition","notes":"notes","location":"location","status":"status",
  "sold":"sold","sale date":"saleDate","date sold":"saleDate",
  "sale price":"salePrice","sold price":"salePrice","sale fees":"saleFees","fees":"saleFees",
};
const IMPORT_FIELDS=[
  ["player","Player Name","Required",true,false],
  ["year","Year","Card year",false,false],
  ["set","Set","e.g. Topps Chrome",false,false],
  ["cardNum","Card #","Card number",false,false],
  ["parallel","Parallel / Variant","Refractor, /99, etc.",false,false],
  ["grade","Grade","PSA 10, BGS 9.5, etc.",false,false],
  ["certNum","Cert / Serial Number","REQUIRED for graded cards — used for dedup",false,true],
  ["buyPrice","Cost / Buy Price","What you paid",false,false],
  ["marketValue","Market Value","Current value",false,false],
  ["buyDate","Purchase Date","YYYY-MM-DD",false,false],
  ["buyPlatform","Purchase Platform","Where you bought it",false,false],
  ["status","Status","For Sale, PC, etc.",false,false],
  ["location","Storage Location","Binder, box, etc.",false,false],
  ["notes","Notes","Any notes",false,false],
  ["sold","Sold Flag","TRUE/FALSE — creates sale transactions",false,false],
  ["saleDate","Sale Date","When the card sold",false,false],
  ["salePrice","Sale Price","Gross sale amount",false,false],
  ["saleFees","Sale Fees","Platform fees on the sale",false,false],
];

// ═══════════════════════════════════════════════════════════════════════════════
// STORAGE & UTILS
// ═══════════════════════════════════════════════════════════════════════════════
let _userId = null;
const store={
  async get(k){
    if(!_userId)return null;
    try{
      const{data}=await supabase.from('user_data').select('value').eq('user_id',_userId).eq('key',k).single();
      return data?data.value:null;
    }catch{return null;}
  },
  async set(k,v){
    if(!_userId)return;
    try{
      await supabase.from('user_data').upsert({user_id:_userId,key:k,value:v,updated_at:new Date().toISOString()},{onConflict:'user_id,key'});
    }catch(e){console.error('save error',k,e);}
  }
};
const fmt$=(n,d=2)=>n==null||isNaN(n)?"$0.00":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
const fmtPct=n=>`${n>=0?"+":""}${(n||0).toFixed(1)}%`;
const uid=()=>Math.random().toString(36).slice(2,10);
const today=()=>new Date().toISOString().slice(0,10);
const monthKey=d=>(d||today()).slice(0,7);
const daysBetween=(a,b)=>Math.floor((new Date(b)-new Date(a))/(864e5));
const clx=(...a)=>a.filter(Boolean).join(" ");
const isLT=(bd,sd)=>bd&&sd&&daysBetween(bd,sd)>=365;
const isActive=s=>s!=="Sold"&&s!=="Archived";
const normalizeDate=d=>{if(!d)return"";d=String(d).trim();if(/^\d{4}-\d{2}-\d{2}/.test(d))return d.slice(0,10);const mdy=d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(mdy)return`${mdy[3]}-${mdy[1].padStart(2,"0")}-${mdy[2].padStart(2,"0")}`;try{const dt=new Date(d);if(!isNaN(dt.getTime()))return dt.toISOString().slice(0,10);}catch{}return d;};
const monthOf=d=>{const n=normalizeDate(d);return n?n.slice(0,7):""};
const yearOf=d=>{const n=normalizeDate(d);return n?n.slice(0,4):""};

// ═══════════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════════
function usePersist(key,init){
  const[val,setVal]=useState(init);const[loaded,setLoaded]=useState(false);
  useEffect(()=>{store.get(key).then(v=>{if(v!=null)setVal(v);setLoaded(true);});},[key]);
  const persist=useCallback(u=>{setVal(prev=>{const next=typeof u==="function"?u(prev):u;store.set(key,next);return next;});},[key]);
  return[val,persist,loaded];
}

// ═══════════════════════════════════════════════════════════════════════════════
// BASE UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
const Card=({children,className=""})=><div className={clx("bg-slate-800 rounded-xl border border-slate-700/60 shadow-xl",className)}>{children}</div>;
const Badge=({children,color="blue"})=>{
  const c={blue:"bg-blue-500/20 text-blue-300 border-blue-500/30",green:"bg-emerald-500/20 text-emerald-300 border-emerald-500/30",red:"bg-red-500/20 text-red-300 border-red-500/30",amber:"bg-amber-500/20 text-amber-300 border-amber-500/30",purple:"bg-purple-500/20 text-purple-300 border-purple-500/30",gray:"bg-slate-600/40 text-slate-300 border-slate-600/50",orange:"bg-orange-500/20 text-orange-300 border-orange-500/30"};
  return <span className={clx("text-xs px-2 py-0.5 rounded-full border font-medium",c[color]||c.gray)}>{children}</span>;
};
const Btn=({children,onClick,variant="primary",size="md",className="",disabled=false})=>{
  const v={primary:"bg-blue-600 hover:bg-blue-500 text-white border-blue-500",secondary:"bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600",ghost:"bg-transparent hover:bg-slate-700 text-slate-300 border-slate-700",danger:"bg-red-600/20 hover:bg-red-600/40 text-red-300 border-red-500/50",success:"bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500",amber:"bg-amber-600 hover:bg-amber-500 text-white border-amber-500"};
  const s={sm:"px-2.5 py-1 text-xs",md:"px-4 py-2 text-sm",lg:"px-5 py-2.5 text-base"};
  return <button onClick={onClick} disabled={disabled} className={clx("rounded-lg border font-medium transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",v[variant]||v.primary,s[size]||s.md,className)}>{children}</button>;
};
function Input({label,value,onChange,type="text",placeholder="",className="",options,required,hint}){
  const base="bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-blue-500 transition-colors";
  if(options)return(<label className="flex flex-col gap-1">{label&&<span className="text-xs text-slate-400 font-medium">{label}{required&&<span className="text-red-400 ml-1">*</span>}</span>}<select value={value} onChange={e=>onChange(e.target.value)} className={clx(base,className)}><option value="">-- Select --</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select>{hint&&<span className="text-xs text-slate-500">{hint}</span>}</label>);
  return(<label className="flex flex-col gap-1">{label&&<span className="text-xs text-slate-400 font-medium">{label}{required&&<span className="text-red-400 ml-1">*</span>}</span>}<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className={clx(base,className)}/>{hint&&<span className="text-xs text-slate-500">{hint}</span>}</label>);
}
function Textarea({label,value,onChange,placeholder="",rows=3}){
  return(<label className="flex flex-col gap-1">{label&&<span className="text-xs text-slate-400 font-medium">{label}</span>}<textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows} className="bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-blue-500 transition-colors resize-none"/></label>);
}
const KPI=({label,value,sub,color,icon,alert})=>{
  const c={green:"text-emerald-400",red:"text-red-400",blue:"text-blue-400",amber:"text-amber-400",white:"text-slate-100"};
  return(<Card className={clx("p-4 flex flex-col gap-1 min-w-0",alert&&"border-amber-500/50")}><div className="flex items-center justify-between"><span className="text-xs text-slate-400 font-medium uppercase tracking-wider truncate">{label}</span>{icon&&<span className="text-lg opacity-60">{icon}</span>}</div><div className={clx("text-2xl font-bold font-mono tracking-tight",c[color]||c.white)}>{value}</div>{sub&&<div className="text-xs text-slate-500">{sub}</div>}{alert&&<div className="text-xs text-amber-400 mt-1">{alert}</div>}</Card>);
};
function Modal({title,onClose,children,wide}){
  return(<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={e=>e.target===e.currentTarget&&onClose()}><Card className={clx("w-full max-h-[92vh] overflow-y-auto",wide?"max-w-3xl":"max-w-2xl")}><div className="flex items-center justify-between p-5 border-b border-slate-700 sticky top-0 bg-slate-800 z-10"><h2 className="text-lg font-bold text-slate-100">{title}</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-2xl leading-none cursor-pointer">×</button></div><div className="p-5">{children}</div></Card></div>);
}
const StatusBadge=({status})=>{const m={"For Sale":"green",PC:"blue","Trade Bait":"amber","At Consignment":"purple","Submitted for Grading":"gray",Sold:"red",Archived:"gray"};return <Badge color={m[status]||"gray"}>{status}</Badge>;};
function HoloBorder({children,className="",dimmed=false}){
  if(dimmed)return <div className={clx("rounded-xl border border-slate-700/40 bg-slate-800/30 opacity-50",className)}>{children}</div>;
  return(<div className={clx("relative rounded-xl p-[1px] overflow-hidden",className)} style={{background:"linear-gradient(135deg,#3B82F6 0%,#8B5CF6 25%,#EC4899 50%,#F59E0B 75%,#10B981 100%)"}}><div className="rounded-xl bg-slate-800">{children}</div></div>);
}
// Inline confirm — replaces window.confirm which is blocked in artifacts
function InlineConfirm({message,onConfirm,onCancel,danger=true}){
  return(<Card className={clx("p-4",danger?"border-red-500/50 bg-red-500/10":"border-blue-500/50 bg-blue-500/10")}><div className="text-sm text-slate-200 mb-3">{message}</div><div className="flex gap-3"><Btn variant={danger?"danger":"primary"} size="sm" onClick={onConfirm}>Yes, do it</Btn><Btn variant="secondary" size="sm" onClick={onCancel}>Cancel</Btn></div></Card>);
}

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL SEARCH
// ═══════════════════════════════════════════════════════════════════════════════
function GlobalSearch({inventory,transactions,onNavigate}){
  const[q,setQ]=useState("");const[open,setOpen]=useState(false);const ref=useRef(null);
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const results=useMemo(()=>{if(!q.trim())return[];const lq=q.toLowerCase();
    const cards=inventory.filter(c=>[c.player,c.set,c.year,c.parallel,c.grade,c.certNum,c.notes].join(" ").toLowerCase().includes(lq)).slice(0,5).map(c=>({type:"card",label:`${c.player} ${c.year||""} ${c.grade||"Raw"}`,sub:`${c.set||""} · ${fmt$(c.marketValue||c.buyPrice)} · Cert: ${c.certNum||"—"}`,id:c.id}));
    const txs=transactions.filter(t=>[t.player,t.platform,t.notes].join(" ").toLowerCase().includes(lq)).slice(0,3).map(t=>({type:"tx",label:`${t.type}: ${t.player||""}`,sub:`${t.date} · ${fmt$(t.salePrice||t.purchasePrice||t.gradingFee||0)}`,id:t.id}));
    return[...cards,...txs];},[q,inventory,transactions]);
  return(<div ref={ref} className="relative flex-1 max-w-xs lg:max-w-sm"><input value={q} onChange={e=>{setQ(e.target.value);setOpen(true);}} onFocus={()=>setOpen(true)} placeholder="Search cards, transactions..." className="bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:border-blue-500 pl-7"/><span className="absolute left-2 top-2 text-slate-500 text-xs">🔍</span>
    {open&&results.length>0&&(<div className="absolute top-full mt-1 left-0 right-0 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">{results.map(r=>(<button key={r.id} onClick={()=>{onNavigate(r.type==="card"?"inventory":"transactions");setQ("");setOpen(false);}} className="w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0 cursor-pointer"><div className="flex items-center gap-2"><Badge color={r.type==="card"?"blue":"green"}>{r.type==="card"?"Card":"TX"}</Badge><div><div className="text-sm text-slate-200">{r.label}</div><div className="text-xs text-slate-400">{r.sub}</div></div></div></button>))}</div>)}</div>);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARD SCANNER (Claude Vision API)
// ═══════════════════════════════════════════════════════════════════════════════
function CardScanner({onResult,compact=false}){
  const[scanning,setScanning]=useState(false);const[result,setResult]=useState(null);const[msg,setMsg]=useState("");const ref=useRef(null);
  const PROMPT='Analyze this sports card or graded slab photo. Extract all visible info from the label or card front. Return ONLY valid JSON: {"player":"","year":"","set":"","cardNum":"","parallel":"","grade":"","certNum":"","condition":"Raw or Graded","notes":""}';
  const scan=async e=>{const file=e.target.files[0];if(!file)return;e.target.value="";setScanning(true);setResult(null);setMsg("");
    try{const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=ev=>res(ev.target.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(file);});const mime=file.type||"image/jpeg";
      const resp=await fetch("/api/scan-card",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:b64,mimeType:mime,prompt:PROMPT})});
      if(!resp.ok){const e=await resp.json().catch(()=>({}));throw new Error(e.error||"Scan failed");}
      const data=await resp.json();const text=data.text||"";const parsed=JSON.parse(text.replace(/```json|```/g,"").trim());
      parsed.photo=`data:${mime};base64,${b64}`;setResult("ok");setMsg(`Found: ${parsed.player||"Unknown"}${parsed.grade?" · "+parsed.grade:""}${parsed.certNum?" · Cert: "+parsed.certNum:""}`);onResult(parsed);
    }catch(e){setResult("err");const msg=e?.message||"Unknown error";setMsg(msg.includes("not configured")?"Scanner not configured — add ANTHROPIC_API_KEY in Vercel":msg.includes("503")||msg.includes("not configured")?"API key missing in Vercel settings":"Could not read card — try better lighting or a closer shot. Error: "+msg);}finally{setScanning(false);}};
  const libRef=useRef(null);
  const box=clx("flex items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-all cursor-pointer",scanning?"border-blue-500/50 bg-blue-500/10":"border-slate-600 hover:border-blue-500/50 hover:bg-blue-500/5");
  return(<div className="space-y-2">{scanning?<div className={clx(box,compact?"px-4 py-3":"p-4 sm:col-span-2")}><div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"/><span className="text-sm text-blue-400">Scanning...</span></div>:<div className={clx(compact?"flex gap-2":"grid grid-cols-2 gap-2",compact?"":"sm:col-span-2")}><div onClick={()=>ref.current?.click()} className={clx(box,"px-4 py-3")}><span className="text-xl">📷</span><div><div className="text-sm text-slate-200 font-medium">Take Photo</div><div className="text-xs text-slate-500">Use camera</div></div></div><div onClick={()=>libRef.current?.click()} className={clx(box,"px-4 py-3")}><span className="text-xl">🖼</span><div><div className="text-sm text-slate-200 font-medium">Photo Library</div><div className="text-xs text-slate-500">Choose existing</div></div></div></div>}<input ref={ref} type="file" accept="image/*" capture="environment" onChange={scan} className="hidden"/><input ref={libRef} type="file" accept="image/*" onChange={scan} className="hidden"/>
    {result&&<div className={clx("text-xs px-3 py-2 rounded-lg",result==="ok"?"bg-emerald-500/10 text-emerald-400 border border-emerald-500/30":"bg-red-500/10 text-red-400 border border-red-500/30")}>{msg}</div>}</div>);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SELL CARD MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function SellCardModal({card,onSave,onClose}){
  const[f,setF]=useState({salePrice:"",platform:"eBay",platformFeePct:String(PLATFORM_FEES.eBay),shippingOut:"",date:today(),notes:""});
  const up=(k,v)=>setF(p=>({...p,[k]:v}));
  const fee=(+f.salePrice)*((+f.platformFeePct)/100);const net=(+f.salePrice||0)-fee-(+f.shippingOut||0);const gl=net-(+card.buyPrice||0);
  const dh=card.buyDate?daysBetween(card.buyDate,today()):null;
  return(<div className="space-y-4">
    <div className="p-3 bg-slate-900 rounded-lg"><div className="font-bold text-slate-100">{card.player} {card.year}</div><div className="text-xs text-slate-400">{card.set} · Cost: {fmt$(card.buyPrice)} · Cert: {card.certNum||"—"}</div>{dh!=null&&<div className={clx("text-xs mt-1",dh>=365?"text-emerald-400":"text-amber-400")}>{dh>=365?`Long-term hold (${dh}d)`:`Short-term (${dh}d — ${365-dh} to LT)`}</div>}</div>
    <div className="grid grid-cols-2 gap-4">
      <Input label="Sale Price ($)" value={f.salePrice} onChange={v=>up("salePrice",v)} type="number" required/>
      <Input label="Platform" value={f.platform} onChange={v=>{up("platform",v);up("platformFeePct",String(PLATFORM_FEES[v]||0));}} options={PLATFORMS}/>
      <Input label="Platform Fee (%)" value={f.platformFeePct} onChange={v=>up("platformFeePct",v)} type="number"/>
      <Input label="Shipping Out ($)" value={f.shippingOut} onChange={v=>up("shippingOut",v)} type="number"/>
      <Input label="Sale Date" value={f.date} onChange={v=>up("date",v)} type="date"/>
      <div className="col-span-2"><Input label="Notes" value={f.notes} onChange={v=>up("notes",v)}/></div>
    </div>
    {+f.salePrice>0&&(<div className="grid grid-cols-3 gap-3">
      <Card className="p-3 text-center"><div className="text-xs text-slate-400">Fees</div><div className="font-mono font-bold text-amber-400">{fmt$(fee)}</div></Card>
      <Card className="p-3 text-center"><div className="text-xs text-slate-400">Net Proceeds</div><div className="font-mono font-bold text-blue-400">{fmt$(net)}</div></Card>
      <Card className="p-3 text-center"><div className="text-xs text-slate-400">Realized G/L</div><div className={clx("font-mono font-bold",gl>=0?"text-emerald-400":"text-red-400")}>{fmt$(gl)}</div></Card>
    </div>)}
    <div className="flex gap-3 justify-end"><Btn variant="secondary" onClick={onClose}>Cancel</Btn><Btn variant="success" disabled={!f.salePrice} onClick={()=>onSave({...f,net,gl,fee,salePrice:+f.salePrice,platformFeePct:+f.platformFeePct,shippingOut:+f.shippingOut||0})}>Record Sale</Btn></div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRADING RETURN MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function GradingReturnModal({card,onSave,onClose}){
  const[grade,setGrade]=useState("");const[cert,setCert]=useState("");const[notes,setNotes]=useState("");
  return(<div className="space-y-4">
    <div className="p-3 bg-slate-900 rounded-lg"><div className="font-bold text-slate-100">{card.player} {card.year}</div><div className="text-xs text-slate-400">Update grade and set status to For Sale</div></div>
    <Input label="Return Grade" value={grade} onChange={setGrade} options={GRADES} required/>
    <Input label="Cert Number" value={cert} onChange={setCert} placeholder="PSA/BGS cert #"/>
    <Input label="Notes" value={notes} onChange={setNotes} placeholder="Surface, centering notes..."/>
    <div className="flex gap-3 justify-end"><Btn variant="secondary" onClick={onClose}>Cancel</Btn><Btn disabled={!grade} onClick={()=>onSave(grade,cert,notes)}>Mark Returned</Btn></div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY FORM
// ═══════════════════════════════════════════════════════════════════════════════
function InventoryForm({initial,onSave,onClose}){
  const blank={id:"",player:"",year:"",set:"",cardNum:"",parallel:"",condition:"Raw",grade:"",certNum:"",population:"",location:"",buyPrice:"",buyDate:today(),buyPlatform:"",marketValue:"",status:"For Sale",notes:"",photo:""};
  const[f,setF]=useState({...blank,...initial});const up=(k,v)=>setF(p=>({...p,[k]:v}));
  const valid=f.player&&f.buyPrice;const dh=f.buyDate?daysBetween(f.buyDate,today()):0;const lt=dh>=365;
  const handleScan=p=>{setF(prev=>({...prev,player:p.player||prev.player,year:p.year||prev.year,set:p.set||prev.set,cardNum:p.cardNum||prev.cardNum,parallel:p.parallel||prev.parallel,grade:p.grade||prev.grade,certNum:p.certNum||prev.certNum,condition:p.condition||prev.condition,notes:p.notes?`${prev.notes?prev.notes+" | ":""}${p.notes}`:prev.notes,photo:p.photo||prev.photo}));};
  const handlePhoto=e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=ev=>up("photo",ev.target.result);r.readAsDataURL(file);};
  return(<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    {!initial?.id&&<div className="sm:col-span-2"><CardScanner onResult={handleScan}/></div>}
    <Input label="Player Name" value={f.player} onChange={v=>up("player",v)} required/>
    <Input label="Year" value={f.year} onChange={v=>up("year",v)} placeholder="2023"/>
    <Input label="Set" value={f.set} onChange={v=>up("set",v)} placeholder="Topps Chrome"/>
    <Input label="Card #" value={f.cardNum} onChange={v=>up("cardNum",v)}/>
    <Input label="Parallel / Variant" value={f.parallel} onChange={v=>up("parallel",v)} placeholder="Refractor /99"/>
    <Input label="Condition" value={f.condition} onChange={v=>up("condition",v)} options={CONDITIONS}/>
    {f.condition==="Graded"&&<Input label="Grade" value={f.grade} onChange={v=>up("grade",v)} options={GRADES}/>}
    {f.condition==="Graded"&&<Input label="Cert Number" value={f.certNum} onChange={v=>up("certNum",v)} placeholder="PSA/BGS cert #"/>}
    <Input label="Pop Report" value={f.population} onChange={v=>up("population",v)} placeholder="Pop 12"/>
    <Input label="Storage Location" value={f.location} onChange={v=>up("location",v)} placeholder="Binder A, Slot 3"/>
    <Input label="Purchase Price ($)" value={f.buyPrice} onChange={v=>up("buyPrice",v)} type="number" required/>
    <div><Input label="Purchase Date" value={f.buyDate} onChange={v=>up("buyDate",v)} type="date"/>{f.buyDate&&<div className={clx("text-xs mt-1",lt?"text-emerald-400":"text-slate-500")}>{lt?`LT hold (${dh}d)`:`${dh}d held — ${365-dh}d to LT`}</div>}</div>
    <Input label="Purchase Platform" value={f.buyPlatform} onChange={v=>up("buyPlatform",v)} options={PLATFORMS}/>
    <Input label="Market Value ($)" value={f.marketValue} onChange={v=>up("marketValue",v)} type="number"/>
    <Input label="Sport" value={f.sport||""} onChange={v=>up("sport",v)} options={["Basketball","Baseball","Football","Soccer","Hockey","Golf","Tennis","Other"]}/>
    <Input label="Status" value={f.status} onChange={v=>up("status",v)} options={ACTIVE_STATUSES}/>
    <div className="sm:col-span-2"><Input label="Notes" value={f.notes} onChange={v=>up("notes",v)} placeholder="Centering, surface, comps..."/></div>
    <div className="sm:col-span-2"><label className="flex flex-col gap-1"><span className="text-xs text-slate-400 font-medium">Card Photo</span><input type="file" accept="image/*" onChange={handlePhoto} className="text-sm text-slate-300 file:mr-3 file:px-3 file:py-1 file:rounded file:border-0 file:bg-blue-600 file:text-white file:text-xs cursor-pointer"/>{f.photo&&<img src={f.photo} alt="card" className="mt-2 h-32 rounded-lg object-contain border border-slate-600"/>}</label></div>
    <div className="sm:col-span-2 flex gap-3 justify-end mt-2"><Btn variant="secondary" onClick={onClose}>Cancel</Btn><Btn disabled={!valid} onClick={()=>valid&&onSave({...f,id:f.id||uid(),buyPrice:+f.buyPrice,marketValue:+f.marketValue||+f.buyPrice})}>{f.id?"Save Changes":"Add Card"}</Btn></div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHOW MODE
// ═══════════════════════════════════════════════════════════════════════════════
function ShowMode({onSave,onClose}){
  const[f,setF]=useState({player:"",year:"",set:"",cardNum:"",parallel:"",buyPrice:"",buyPlatform:"Show/LCS",condition:"Raw",grade:"",certNum:"",status:"For Sale",photo:""});
  const up=(k,v)=>setF(p=>({...p,[k]:v}));const[saved,setSaved]=useState([]);
  const handleScan=p=>{setF(prev=>({...prev,player:p.player||prev.player,year:p.year||prev.year,set:p.set||prev.set,cardNum:p.cardNum||prev.cardNum,parallel:p.parallel||prev.parallel,grade:p.grade||prev.grade,certNum:p.certNum||prev.certNum,condition:p.condition||prev.condition,photo:p.photo||prev.photo}));};
  const save=()=>{if(!f.player||!f.buyPrice)return;const card={...f,id:uid(),buyDate:today(),marketValue:+f.buyPrice,buyPrice:+f.buyPrice};onSave(card);setSaved(p=>[card,...p]);setF({player:"",year:"",set:"",cardNum:"",parallel:"",buyPrice:"",buyPlatform:"Show/LCS",condition:"Raw",grade:"",certNum:"",status:"For Sale",photo:""});};
  return(<div className="space-y-4">
    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-300">Show Mode — Scan or type, enter price, done.</div>
    <CardScanner onResult={handleScan} compact/>
    {f.player&&<div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg"><div className="text-sm text-slate-200 font-medium">{f.player} {f.year} {f.grade||"Raw"}</div>{f.certNum&&<div className="text-xs text-slate-500">Cert: {f.certNum}</div>}</div>}
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2"><Input label="Player Name" value={f.player} onChange={v=>up("player",v)} required/></div>
      <Input label="Year" value={f.year} onChange={v=>up("year",v)} placeholder="2023"/>
      <Input label="Set" value={f.set} onChange={v=>up("set",v)} placeholder="Topps Chrome"/>
      <Input label="Condition" value={f.condition} onChange={v=>up("condition",v)} options={CONDITIONS}/>
      {f.condition==="Graded"&&<Input label="Grade" value={f.grade} onChange={v=>up("grade",v)} options={GRADES}/>}
      {f.condition==="Graded"&&<Input label="Cert #" value={f.certNum} onChange={v=>up("certNum",v)}/>}
      <Input label="Buy Price ($)" value={f.buyPrice} onChange={v=>up("buyPrice",v)} type="number" required/>
      <Input label="Status" value={f.status} onChange={v=>up("status",v)} options={ACTIVE_STATUSES}/>
    </div>
    <Btn size="lg" className="w-full" onClick={save} disabled={!f.player||!f.buyPrice}>Add Card</Btn>
    {saved.length>0&&<div className="space-y-1"><div className="text-xs text-slate-400 font-medium">{saved.length} added this session:</div>{saved.slice(0,5).map(c=><div key={c.id} className="flex justify-between text-xs text-slate-300 py-1 border-b border-slate-700/50"><span>{c.player} {c.year} {c.grade||"Raw"}{c.certNum&&` · ${c.certNum}`}</span><span className="font-mono text-emerald-400">{fmt$(c.buyPrice)}</span></div>)}{saved.length>5&&<div className="text-xs text-slate-500">+{saved.length-5} more</div>}</div>}
    <div className="flex justify-end"><Btn variant="secondary" onClick={onClose}>Done</Btn></div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRADING ROI CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════════
function GradingROICalc(){
  const[f,setF]=useState({rawValue:"",tier:"PSA Regular",gemRate:"15",psa9Rate:"60",psa10Mult:"2.1",psa9Mult:"0.9"});const up=(k,v)=>setF(p=>({...p,[k]:v}));
  const fee=GRADING_FEES[f.tier]||50;const totalCost=(+f.rawValue||0)+fee;const p10=(+f.rawValue||0)*(+f.psa10Mult||2.1);const p9=(+f.rawValue||0)*(+f.psa9Mult||0.9);
  const gR=(+f.gemRate||0)/100;const nR=(+f.psa9Rate||0)/100;const oR=Math.max(0,1-gR-nR);
  const ev=p10*gR+p9*nR+(+f.rawValue||0)*0.7*oR;const egl=ev-totalCost;const verdict=egl>0?"SUBMIT":"PASS";
  return(<div className="space-y-5">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Input label="Raw Card Value ($)" value={f.rawValue} onChange={v=>up("rawValue",v)} type="number" required/>
      <Input label="Grading Tier" value={f.tier} onChange={v=>up("tier",v)} options={Object.keys(GRADING_FEES)} hint={`Fee: ${fmt$(fee)}`}/>
      <Input label="PSA 10 Odds (%)" value={f.gemRate} onChange={v=>up("gemRate",v)} type="number" hint="Chance of a 10"/>
      <Input label="PSA 9 Odds (%)" value={f.psa9Rate} onChange={v=>up("psa9Rate",v)} type="number"/>
      <Input label="PSA 10 Multiplier" value={f.psa10Mult} onChange={v=>up("psa10Mult",v)} type="number" hint="Typically 2.0-2.2x"/>
      <Input label="PSA 9 Multiplier" value={f.psa9Mult} onChange={v=>up("psa9Mult",v)} type="number" hint="Typically 0.8-1.0x"/>
    </div>
    {+f.rawValue>0&&<>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 text-center"><div className="text-xs text-slate-400">Total Cost</div><div className="font-mono font-bold text-slate-200">{fmt$(totalCost)}</div></Card>
        <Card className="p-3 text-center"><div className="text-xs text-slate-400">PSA 10 Value</div><div className="font-mono font-bold text-blue-400">{fmt$(p10)}</div></Card>
        <Card className="p-3 text-center"><div className="text-xs text-slate-400">PSA 9 Value</div><div className="font-mono font-bold text-slate-300">{fmt$(p9)}</div></Card>
        <Card className="p-3 text-center"><div className="text-xs text-slate-400">Expected Value</div><div className="font-mono font-bold text-purple-400">{fmt$(ev)}</div></Card>
      </div>
      <Card className={clx("p-5 text-center border-2",verdict==="SUBMIT"?"border-emerald-500/50 bg-emerald-500/10":"border-red-500/50 bg-red-500/10")}>
        <div className={clx("text-3xl font-black tracking-wider mb-2",verdict==="SUBMIT"?"text-emerald-400":"text-red-400")}>{verdict==="SUBMIT"?"SUBMIT":"PASS"}</div>
        <div className={clx("text-lg font-mono font-bold",egl>=0?"text-emerald-400":"text-red-400")}>Expected G/L: {fmt$(egl)}</div>
        <div className="text-xs text-slate-400 mt-1">{f.gemRate}% gem · {f.psa9Rate}% PSA 9 · {Math.round(oR*100)}% other</div>
      </Card>
    </>}
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY TAB
// ═══════════════════════════════════════════════════════════════════════════════
function InventoryTab({inventory,setInventory,setTransactions}){
  const[modal,setModal]=useState(null);const[sellModal,setSellModal]=useState(null);const[gradingModal,setGradingModal]=useState(null);
  const[showModeOpen,setShowModeOpen]=useState(false);const[search,setSearch]=useState("");const[filterStatus,setFilterStatus]=useState("");
  const[sortBy,setSortBy]=useState("buyDate");const[sortDir,setSortDir]=useState(-1);const[selected,setSelected]=useState(new Set());
  const[bulkAction,setBulkAction]=useState("");const[confirmAction,setConfirmAction]=useState(null);

  const activeInv=inventory.filter(c=>isActive(c.status));
  const statusPriority=(s)=>s==="For Sale"?0:s==="Trade Bait"?1:s==="PC"?2:s==="At Consignment"?3:s==="Submitted for Grading"?4:s==="Sold"?5:6;
  const filtered=useMemo(()=>{
    let r=[...inventory];
    if(search)r=r.filter(c=>[c.player,c.set,c.year,c.parallel,c.grade,c.certNum,c.notes].join(" ").toLowerCase().includes(search.toLowerCase()));
    if(filterStatus)r=r.filter(c=>c.status===filterStatus);
    r.sort((a,b)=>{
      if(!filterStatus){const sp=statusPriority(a.status)-statusPriority(b.status);if(sp!==0)return sp;}
      const av=a[sortBy]||"",bv=b[sortBy]||"";
      return typeof av==="number"?(av-bv)*sortDir:String(av).localeCompare(String(bv))*sortDir;
    });
    return r;
  },[inventory,search,filterStatus,sortBy,sortDir]);
  const totalCost=activeInv.reduce((s,c)=>s+(+c.buyPrice),0);const totalMV=activeInv.reduce((s,c)=>s+(+c.marketValue||+c.buyPrice),0);
  const aging90=activeInv.filter(c=>c.status==="For Sale"&&c.buyDate&&daysBetween(c.buyDate,today())>90);
  const underwater=activeInv.filter(c=>(+c.marketValue||+c.buyPrice)<+c.buyPrice);

  const save=card=>{setInventory(prev=>prev.find(c=>c.id===card.id)?prev.map(c=>c.id===card.id?card:c):[...prev,card]);setModal(null);};
  const handleSell=(card,d)=>{setInventory(p=>p.map(c=>c.id===card.id?{...c,status:"Sold",soldDate:d.date,soldPrice:d.salePrice}:c));
    setTransactions(p=>[...p,{id:uid(),type:"sale",cardId:card.id,player:card.player,date:d.date,platform:d.platform,salePrice:d.salePrice,platformFeePct:d.platformFeePct,shippingOut:d.shippingOut,shippingIn:0,notes:d.notes,netProceeds:d.net,gl:d.gl,purchasePrice:0,gradingFee:0,tradeValueOut:0,tradeValueIn:0}]);setSellModal(null);};
  const handleGradingReturn=(card,grade,cert,notes)=>{setInventory(p=>p.map(c=>c.id===card.id?{...c,grade,certNum:cert||c.certNum,condition:"Graded",status:"For Sale",notes:notes?`${c.notes||""} | Return: ${notes}`:c.notes}:c));setGradingModal(null);};
  const applyBulk=()=>{if(!bulkAction||selected.size===0)return;if(bulkAction==="delete")setConfirmAction({msg:`Delete ${selected.size} cards permanently?`,fn:()=>{setInventory(p=>p.filter(c=>!selected.has(c.id)));setSelected(new Set());setBulkAction("");}});else{setInventory(p=>p.map(c=>selected.has(c.id)?{...c,status:bulkAction}:c));setSelected(new Set());setBulkAction("");}};
  const toggleSel=id=>setSelected(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});
  const selectAll=()=>setSelected(filtered.length===selected.size&&filtered.length>0?new Set():new Set(filtered.map(c=>c.id)));

  return(<div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold text-slate-100">Inventory</h1>
      <div className="flex gap-2 flex-wrap"><Btn variant="amber" size="sm" onClick={()=>setShowModeOpen(true)}>Show Mode</Btn><Btn onClick={()=>setModal({})}>+ Add Card</Btn></div>
    </div>
    {(aging90.length>0||underwater.length>0)&&<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {aging90.length>0&&<Card className="p-3 border-amber-500/50 bg-amber-500/5"><div className="text-xs text-amber-400 font-semibold">⏰ {aging90.length} cards 90d+ unsold</div><div className="text-xs text-slate-400 mt-1">{aging90.slice(0,3).map(c=>c.player).join(", ")}</div></Card>}
      {underwater.length>0&&<Card className="p-3 border-red-500/50 bg-red-500/5"><div className="text-xs text-red-400 font-semibold">📉 {underwater.length} underwater</div><div className="text-xs text-slate-400 mt-1">{underwater.slice(0,3).map(c=>c.player).join(", ")}</div></Card>}
    </div>}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <KPI label="Active Cards" value={activeInv.length} icon="🃏"/><KPI label="Cost Basis" value={fmt$(totalCost)} color="white"/><KPI label="Market Value" value={fmt$(totalMV)} color="blue"/><KPI label="Unrealized G/L" value={fmt$(totalMV-totalCost)} color={(totalMV-totalCost)>=0?"green":"red"}/>
    </div>
    {confirmAction&&<InlineConfirm message={confirmAction.msg} onConfirm={()=>{confirmAction.fn();setConfirmAction(null);}} onCancel={()=>setConfirmAction(null)}/>}
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap gap-3">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search player, set, grade, cert#..." className="bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-40 focus:outline-none focus:border-blue-500"/>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm">{<option value="">All Statuses</option>}{ALL_STATUSES.map(s=><option key={s}>{s}</option>)}</select>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm"><option value="buyDate">Purchase Date</option><option value="player">Player</option><option value="marketValue">Market Value</option><option value="buyPrice">Cost</option><option value="grade">Grade</option><option value="buyPlatform">Platform</option></select>
        <button onClick={()=>setSortDir(d=>d*-1)} className="bg-slate-700 border border-slate-600 text-slate-300 rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-slate-600">{sortDir>0?"↑":"↓"}</button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={selectAll} className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer">{selected.size===filtered.length&&filtered.length>0?"Deselect All":`Select All (${filtered.length})`}</button>
        {selected.size>0&&<><Badge color="blue">{selected.size} selected</Badge><select value={bulkAction} onChange={e=>setBulkAction(e.target.value)} className="bg-slate-900 border border-slate-600 text-slate-200 rounded px-2 py-1 text-xs"><option value="">Bulk Action...</option>{ACTIVE_STATUSES.map(s=><option key={s} value={s}>Set: {s}</option>)}<option value="delete">Delete Selected</option></select>{bulkAction&&<Btn size="sm" variant={bulkAction==="delete"?"danger":"primary"} onClick={applyBulk}>Apply</Btn>}</>}
      </div>
    </Card>
    <Card><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
      <th className="px-3 py-3 w-6"><input type="checkbox" onChange={selectAll} checked={selected.size===filtered.length&&filtered.length>0} className="cursor-pointer"/></th>
      <th className="text-left px-3 py-3 min-w-32">Player</th>
      <th className="text-left px-3 py-3 min-w-24">Year / Set</th>
      <th className="text-left px-3 py-3 whitespace-nowrap">Grade</th>
      <th className="text-left px-3 py-3 whitespace-nowrap">Cert #</th>
      <th className="text-left px-3 py-3 whitespace-nowrap">Purchased</th>
      <th className="text-left px-3 py-3 whitespace-nowrap">Status</th>
      <th className="text-right px-3 py-3 whitespace-nowrap">Cost</th>
      <th className="text-right px-3 py-3 whitespace-nowrap">Market / Sale</th>
      <th className="text-right px-3 py-3 whitespace-nowrap">G/L</th>
      <th className="px-3 py-3 w-28"></th>
    </tr></thead><tbody>
      {filtered.length===0&&<tr><td colSpan={11} className="text-center py-12 text-slate-500">No cards found</td></tr>}
      {filtered.map(card=>{const saleVal=card.status==="Sold"?(+card.soldPrice||+card.marketValue||+card.buyPrice):(+card.marketValue||+card.buyPrice);const gl=saleVal-(+card.buyPrice);const dh=card.buyDate?daysBetween(card.buyDate,today()):0;return(
        <tr key={card.id} className={clx("border-b border-slate-700/50 hover:bg-slate-700/30",selected.has(card.id)&&"bg-blue-500/10",card.status==="Sold"&&"opacity-70",card.status==="Archived"&&"opacity-50")}>
          <td className="px-3 py-2"><input type="checkbox" checked={selected.has(card.id)} onChange={()=>toggleSel(card.id)} className="cursor-pointer"/></td>
          <td className="px-3 py-2"><div className="font-medium text-slate-200">{card.player}</div><div className="text-xs text-slate-500">{card.parallel}</div>{dh>=365&&<span className="text-xs text-emerald-500">LT</span>}</td>
          <td className="px-3 py-2 text-slate-400 text-xs">{card.year}<br/>{card.set}</td>
          <td className="px-3 py-2 whitespace-nowrap">{card.grade?<Badge color="purple">{card.grade}</Badge>:card.certNum?<Badge color="gray">Graded</Badge>:<span className="text-xs text-slate-500">Raw</span>}</td>
          <td className="px-3 py-2 font-mono text-xs text-slate-400 whitespace-nowrap">{card.certNum||"—"}</td>
          <td className="px-3 py-2 font-mono text-xs text-slate-400 whitespace-nowrap">{card.buyDate||"—"}</td>
          <td className="px-3 py-2"><StatusBadge status={card.status}/></td>
          <td className="px-3 py-2 text-right font-mono text-slate-300">{fmt$(card.buyPrice)}</td>
          <td className="px-3 py-2 text-right font-mono text-blue-400">{card.status==="Sold"?fmt$(card.soldPrice||card.marketValue||card.buyPrice):fmt$(card.marketValue||card.buyPrice)}</td>
          <td className={clx("px-3 py-2 text-right font-mono text-xs font-semibold",gl>=0?"text-emerald-400":"text-red-400")}>{gl>=0?"+":""}{fmt$(gl)}</td>
          <td className="px-3 py-2 whitespace-nowrap"><div className="flex gap-1 justify-end">
            {card.status==="Submitted for Grading"&&<Btn size="sm" variant="success" onClick={()=>setGradingModal(card)}>Return</Btn>}
            {isActive(card.status)&&card.status!=="Submitted for Grading"&&<Btn size="sm" variant="success" onClick={()=>setSellModal(card)}>Sell</Btn>}
            <Btn size="sm" variant="secondary" onClick={()=>setModal(card)}>Edit</Btn>
            <Btn size="sm" variant="danger" onClick={()=>setConfirmAction({msg:`Remove ${card.player}?`,fn:()=>setInventory(p=>p.filter(c=>c.id!==card.id))})}>×</Btn>
          </div></td>
        </tr>);})}
    </tbody></table></div></Card>
    {modal!==null&&<Modal title={modal.id?"Edit Card":"Add Card"} onClose={()=>setModal(null)} wide><InventoryForm initial={modal} onSave={save} onClose={()=>setModal(null)}/></Modal>}
    {sellModal&&<Modal title={`Sell: ${sellModal.player}`} onClose={()=>setSellModal(null)}><SellCardModal card={sellModal} onSave={d=>handleSell(sellModal,d)} onClose={()=>setSellModal(null)}/></Modal>}
    {gradingModal&&<Modal title="Grading Return" onClose={()=>setGradingModal(null)}><GradingReturnModal card={gradingModal} onSave={(g,c,n)=>handleGradingReturn(gradingModal,g,c,n)} onClose={()=>setGradingModal(null)}/></Modal>}
    {showModeOpen&&<Modal title="Show Mode" onClose={()=>setShowModeOpen(false)}><ShowMode onSave={card=>setInventory(p=>[...p,card])} onClose={()=>setShowModeOpen(false)}/></Modal>}
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSACTION FORM + TAB
// ═══════════════════════════════════════════════════════════════════════════════
function TransactionForm({initial,inventory,onSave,onClose}){
  const blank={id:"",type:"sale",cardId:"",player:"",date:today(),platform:"",salePrice:"",purchasePrice:"",platformFeePct:"",shippingIn:"",shippingOut:"",notes:"",gradingTier:"PSA Regular",gradingFee:"",returnGrade:"",tradeCardOut:"",tradeCardIn:"",tradeValueOut:"",tradeValueIn:""};
  const[f,setF]=useState({...blank,...initial});const up=(k,v)=>setF(p=>({...p,[k]:v}));const[cardSearch,setCardSearch]=useState("");
  const filteredCards=useMemo(()=>{if(!cardSearch)return inventory.slice(0,20);return inventory.filter(c=>[c.player,c.set,c.year].join(" ").toLowerCase().includes(cardSearch.toLowerCase())).slice(0,20);},[inventory,cardSearch]);
  useEffect(()=>{if(f.platform&&!initial?.platformFeePct)up("platformFeePct",String(PLATFORM_FEES[f.platform]||0));},[f.platform]);
  useEffect(()=>{if(f.gradingTier&&!initial?.gradingFee)up("gradingFee",String(GRADING_FEES[f.gradingTier]||50));},[f.gradingTier]);
  const netProceeds=useMemo(()=>{if(f.type==="sale"){return(+f.salePrice||0)-(+f.salePrice||0)*((+f.platformFeePct||0)/100)-(+f.shippingOut||0);}return 0;},[f]);
  const selectedCard=inventory.find(c=>c.id===f.cardId);const gl=f.type==="sale"&&selectedCard?netProceeds-(+selectedCard.buyPrice):0;
  return(<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div className="sm:col-span-2"><label className="flex flex-col gap-1"><span className="text-xs text-slate-400 font-medium">Type</span><div className="flex gap-2 flex-wrap">{["sale","purchase","expense","grading","trade"].map(t=><button key={t} onClick={()=>up("type",t)} className={clx("px-3 py-1.5 rounded-lg text-sm font-medium border cursor-pointer",f.type===t?"bg-blue-600 border-blue-500 text-white":"bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600")}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>)}</div></label></div>
    <Input label="Date" value={f.date} onChange={v=>up("date",v)} type="date"/><Input label="Platform" value={f.platform} onChange={v=>up("platform",v)} options={PLATFORMS}/>
    {(f.type==="sale"||f.type==="purchase")&&<div className="sm:col-span-2 space-y-2"><Input label="Search Card" value={cardSearch} onChange={setCardSearch} placeholder="Type player name..."/><select value={f.cardId} onChange={e=>up("cardId",e.target.value)} className="bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-blue-500"><option value="">-- Select card --</option>{filteredCards.map(c=><option key={c.id} value={c.id}>{c.player} {c.year} {c.grade||"Raw"} — {fmt$(c.buyPrice)}</option>)}</select></div>}
    {!f.cardId&&<div className="sm:col-span-2"><Input label="Player / Description" value={f.player} onChange={v=>up("player",v)}/></div>}
    {f.type==="sale"&&<><Input label="Sale Price ($)" value={f.salePrice} onChange={v=>up("salePrice",v)} type="number"/><Input label="Platform Fee (%)" value={f.platformFeePct} onChange={v=>up("platformFeePct",v)} type="number"/><Input label="Shipping Out ($)" value={f.shippingOut} onChange={v=>up("shippingOut",v)} type="number"/><div/>{netProceeds>0&&<div className="sm:col-span-2 grid grid-cols-2 gap-3"><Card className="p-3 text-center"><div className="text-xs text-slate-400">Net Proceeds</div><div className="text-lg font-mono font-bold text-blue-400">{fmt$(netProceeds)}</div></Card><Card className="p-3 text-center"><div className="text-xs text-slate-400">Realized G/L</div><div className={clx("text-lg font-mono font-bold",gl>=0?"text-emerald-400":"text-red-400")}>{fmt$(gl)}</div></Card></div>}</>}
    {f.type==="purchase"&&<><Input label="Purchase Price ($)" value={f.purchasePrice} onChange={v=>up("purchasePrice",v)} type="number"/><Input label="Shipping In ($)" value={f.shippingIn} onChange={v=>up("shippingIn",v)} type="number"/></>}
    {f.type==="grading"&&<><Input label="Card / Player" value={f.player} onChange={v=>up("player",v)}/><Input label="Grading Tier" value={f.gradingTier} onChange={v=>up("gradingTier",v)} options={Object.keys(GRADING_FEES)} hint={`Fee: ${fmt$(GRADING_FEES[f.gradingTier]||0)}`}/><Input label="Grading Fee ($)" value={f.gradingFee} onChange={v=>up("gradingFee",v)} type="number"/><Input label="Return Grade" value={f.returnGrade} onChange={v=>up("returnGrade",v)} options={GRADES}/></>}
    {f.type==="trade"&&<><Input label="Card Sent" value={f.tradeCardOut} onChange={v=>up("tradeCardOut",v)}/><Input label="Value Sent ($)" value={f.tradeValueOut} onChange={v=>up("tradeValueOut",v)} type="number"/><Input label="Card Received" value={f.tradeCardIn} onChange={v=>up("tradeCardIn",v)}/><Input label="Value Received ($)" value={f.tradeValueIn} onChange={v=>up("tradeValueIn",v)} type="number"/></>}
    {f.type==="expense"&&<><Input label="Amount ($)" value={f.purchasePrice} onChange={v=>up("purchasePrice",v)} type="number" required/><Input label="Category" value={f.expenseCategory||""} onChange={v=>up("expenseCategory",v)} options={["Show Entry Fee","Shipping","Supplies","Grading Fees","Platform Fees","Storage","Printing/Labels","Home Office","Other"]}/><Input label="Show / Event Name" value={f.showName||""} onChange={v=>up("showName",v)} placeholder="e.g. Northeast Card Show"/></>}
    <div className="sm:col-span-2"><Input label="Notes" value={f.notes} onChange={v=>up("notes",v)}/></div>
    <div className="sm:col-span-2 flex gap-3 justify-end mt-2"><Btn variant="secondary" onClick={onClose}>Cancel</Btn><Btn onClick={()=>onSave({...f,id:f.id||uid(),netProceeds,gl,salePrice:+f.salePrice||0,purchasePrice:+f.purchasePrice||0,platformFeePct:+f.platformFeePct||0,shippingIn:+f.shippingIn||0,shippingOut:+f.shippingOut||0,gradingFee:+f.gradingFee||0,tradeValueOut:+f.tradeValueOut||0,tradeValueIn:+f.tradeValueIn||0})}>{f.id?"Update":"Log Transaction"}</Btn></div>
  </div>);
}
function TransactionsTab({transactions,setTransactions,inventory,setExpenses}){
  const[modal,setModal]=useState(null);const[filterType,setFilterType]=useState("");const[filterPlatform,setFilterPlatform]=useState("");const[search,setSearch]=useState("");const[confirmDel,setConfirmDel]=useState(null);
  const normTx=t=>({...t,cardId:t.cardId||t.card_id||null,salePrice:+(t.salePrice||t.sale_price||0),purchasePrice:+(t.purchasePrice||t.purchase_price||0),platformFeePct:+(t.platformFeePct||t.platform_fee_pct||0),gradingFee:+(t.gradingFee||t.grading_fee||0),gl:+(t.gl||0),date:normalizeDate(t.date)||t.date||""});
  const allNormTx=useMemo(()=>transactions.map(normTx),[transactions]);
  const sales=allNormTx.filter(t=>t.type==="sale");
  const purchases=allNormTx.filter(t=>t.type==="purchase");
  const totalRev=sales.reduce((s,t)=>s+t.salePrice,0);
  const totalGL=sales.reduce((s,t)=>s+t.gl,0);
  const totalBought=purchases.reduce((s,t)=>s+t.purchasePrice,0);
  const filtered=useMemo(()=>{let r=[...allNormTx];if(filterType)r=r.filter(t=>t.type===filterType);if(filterPlatform)r=r.filter(t=>t.platform===filterPlatform);if(search){const lq=search.toLowerCase();r=r.filter(t=>{const card=inventory.find(c=>c.id===t.cardId||c.id===t.card_id);return[card?.player,t.player,t.platform,t.notes].join(" ").toLowerCase().includes(lq);});}return r.sort((a,b)=>(b.date||"")>(a.date||"")?1:-1);},[allNormTx,filterType,filterPlatform,search,inventory]);
  const save=tx=>{
    const saved={...tx,id:tx.id||uid()};
    setTransactions(prev=>prev.find(t=>t.id===saved.id)?prev.map(t=>t.id===saved.id?saved:t):[...prev,saved]);
    // Also sync to expenses if it's an expense type
    if(saved.type==="expense"&&setExpenses){
      const exp={id:saved.id,date:saved.date,category:saved.expenseCategory||"Other",amount:+(saved.purchasePrice||0),notes:saved.notes||"",showName:saved.showName||""};
      setExpenses(prev=>prev.find(e=>e.id===exp.id)?prev.map(e=>e.id===exp.id?exp:e):[...prev,exp]);
    }
    setModal(null);
  };
  const tc={sale:"green",purchase:"blue",grading:"amber",trade:"purple",expense:"red"};
  return(<div className="space-y-5">
    <div className="flex items-center justify-between flex-wrap gap-3"><h1 className="text-2xl font-bold text-slate-100">Transactions</h1><Btn onClick={()=>setModal({})}>+ Log Transaction</Btn></div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3"><KPI label="Revenue" value={fmt$(totalRev)} color="blue" sub={`${sales.length} sales`}/><KPI label="Total Bought" value={fmt$(totalBought)} color="white" sub={`${purchases.length} purchases`}/><KPI label="Realized G/L" value={fmt$(totalGL)} color={totalGL>=0?"green":"red"}/><KPI label="All Transactions" value={allNormTx.length}/></div>
    {confirmDel&&<InlineConfirm message="Delete this transaction?" onConfirm={()=>{setTransactions(p=>p.filter(t=>t.id!==confirmDel));setConfirmDel(null);}} onCancel={()=>setConfirmDel(null)}/>}
    <Card className="p-4"><div className="flex flex-wrap gap-3"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-40 focus:outline-none focus:border-blue-500"/><select value={filterType} onChange={e=>setFilterType(e.target.value)} className="bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm"><option value="">All Types</option>{["sale","purchase","expense","grading","trade"].map(t=><option key={t}>{t}</option>)}</select><select value={filterPlatform} onChange={e=>setFilterPlatform(e.target.value)} className="bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm"><option value="">All Platforms</option>{PLATFORMS.map(p=><option key={p}>{p}</option>)}</select></div></Card>
    <Card><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-700 text-slate-400 text-xs uppercase"><th className="text-left px-4 py-3">Date</th><th className="text-left px-4 py-3">Type</th><th className="text-left px-4 py-3">Card</th><th className="text-left px-4 py-3">Platform</th><th className="text-right px-4 py-3">Amount</th><th className="text-right px-4 py-3">G/L</th><th className="px-4 py-3"></th></tr></thead><tbody>
      {filtered.length===0&&<tr><td colSpan={7} className="text-center py-12 text-slate-500">No transactions</td></tr>}
      {filtered.map(tx=>{const card=inventory.find(c=>c.id===tx.cardId||c.id===tx.card_id);const rawAmt=tx.type==="sale"?tx.salePrice:tx.type==="purchase"||tx.type==="expense"?tx.purchasePrice:tx.type==="grading"?tx.gradingFee:tx.tradeValueOut||0;const desc=card?`${card.player} ${card.year||""} ${card.grade||"Raw"}`:tx.player||"—";const gl=+(tx.gl||0);return(
        <tr key={tx.id} className="border-b border-slate-700/50 hover:bg-slate-700/30"><td className="px-4 py-3 font-mono text-xs text-slate-300">{tx.date}</td><td className="px-4 py-3"><Badge color={tc[tx.type]||"gray"}>{tx.type}</Badge></td><td className="px-4 py-3 text-slate-200 max-w-xs truncate">{desc}</td><td className="px-4 py-3 text-slate-400">{tx.platform||"—"}</td><td className="px-4 py-3 text-right font-mono text-slate-200">{fmt$(rawAmt)}</td><td className="px-4 py-3 text-right font-mono">{tx.type==="sale"?<span className={gl>=0?"text-emerald-400":"text-red-400"}>{fmt$(gl)}</span>:"—"}</td>
        <td className="px-4 py-3 text-right"><button onClick={()=>setModal(tx)} className="text-slate-400 hover:text-slate-200 text-xs cursor-pointer mr-2">Edit</button><button onClick={()=>setConfirmDel(tx.id)} className="text-red-400 hover:text-red-300 text-xs cursor-pointer">×</button></td></tr>);})}
    </tbody></table></div></Card>
    {modal!==null&&<Modal title={modal.id?"Edit Transaction":"Log Transaction"} onClose={()=>setModal(null)} wide><TransactionForm initial={modal} inventory={inventory} onSave={save} onClose={()=>setModal(null)}/></Modal>}
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════════
// P&L TAB
// ═══════════════════════════════════════════════════════════════════════════════
function PnLTab({transactions,inventory,expenses,snapshots,setSnapshots}){
  const[pnlYear,setPnlYear]=useState("all");const[view,setView]=useState("overview");
  const curMonth=today().slice(0,7);

  // ── Normalize field names (handles Supabase snake_case + in-memory camelCase) ──
  const norm=t=>({
    ...t,
    id:t.id,type:t.type,player:t.player,date:t.date,platform:t.platform,notes:t.notes,
    cardId:t.cardId||t.card_id||null,
    salePrice:+(t.salePrice||t.sale_price||0),
    purchasePrice:+(t.purchasePrice||t.purchase_price||0),
    platformFeePct:+(t.platformFeePct||t.platform_fee_pct||0),
    shippingOut:+(t.shippingOut||t.shipping_out||0),
    shippingIn:+(t.shippingIn||t.shipping_in||0),
    gradingFee:+(t.gradingFee||t.grading_fee||0),
    netProceeds:+(t.netProceeds||t.net_proceeds||0),
    gl:+(t.gl||0),
  });
  const normCard=c=>({
    ...c,
    id:c.id,player:c.player,year:c.year,status:c.status,grade:c.grade,
    set:c.set||c.set_name||"",
    buyPrice:+(c.buyPrice||c.buy_price||0),
    marketValue:+(c.marketValue||c.market_value||0),
    buyDate:c.buyDate||c.buy_date||"",
    certNum:c.certNum||c.cert_num||"",
  });

  const allTx=transactions.map(norm);
  const allInv=inventory.map(normCard);
  const sales=allTx.filter(t=>t.type==="sale");
  const purchases=allTx.filter(t=>t.type==="purchase");
  const gradingTx=allTx.filter(t=>t.type==="grading");
  const activeInv=allInv.filter(c=>isActive(c.status)&&c.status!=="PC");
  const years=[...new Set(sales.map(t=>yearOf(t.date)).filter(y=>y&&y.length===4))].sort().reverse();

  const filterByPeriod=arr=>pnlYear==="all"?arr:arr.filter(t=>yearOf(t.date)===pnlYear);
  const fSales=filterByPeriod(sales);
  const fPurchases=filterByPeriod(purchases);
  const fGrading=filterByPeriod(gradingTx);
  const fExpenses=filterByPeriod(expenses||[]);
  const mtdSales=sales.filter(t=>monthOf(t.date)===curMonth);

  // ── Core financials ──
  const rev=fSales.reduce((s,t)=>s+t.salePrice,0);
  const cogs=fSales.reduce((s,t)=>{const c=allInv.find(x=>x.id===t.cardId);return s+(c?c.buyPrice:0);},0);
  const gross=rev-cogs;
  const grossMargin=rev>0?(gross/rev*100):0;
  const fees=fSales.reduce((s,t)=>s+(t.salePrice*(t.platformFeePct/100)),0);
  const shippingOut=fSales.reduce((s,t)=>s+t.shippingOut,0);
  const shippingIn=fPurchases.reduce((s,t)=>s+t.shippingIn,0);
  const gradingFees=fGrading.reduce((s,t)=>s+t.gradingFee,0);
  const opex=fExpenses.reduce((s,e)=>s+(+(e.amount||0)),0);
  const totalExpenses=fees+shippingOut+shippingIn+gradingFees+opex;
  const net=gross-totalExpenses;
  const netMargin=rev>0?(net/rev*100):0;

  // ── Business metrics ──
  const winCount=fSales.filter(t=>t.gl>0).length;
  const winRate=fSales.length?Math.round(winCount/fSales.length*100):0;
  const avgROI=cogs>0?((gross/cogs)*100):0;
  const avgSalePrice=fSales.length?rev/fSales.length:0;
  const avgCost=fSales.length?cogs/fSales.length:0;
  const avgProfit=fSales.length?gross/fSales.length:0;
  const totalBought=filterByPeriod(purchases).reduce((s,t)=>s+t.purchasePrice,0);
  const cardsBought=fPurchases.length;
  const cardsSold=fSales.length;

  // ── Inventory ──
  const invValue=activeInv.reduce((s,c)=>s+(c.marketValue||c.buyPrice),0);
  const invCost=activeInv.reduce((s,c)=>s+c.buyPrice,0);
  const unreal=invValue-invCost;

  // ── Monthly data ──
  const monthlyMap={};
  sales.forEach(t=>{
    const m=monthOf(t.date);if(!m||m.length<7)return;
    if(!monthlyMap[m])monthlyMap[m]={month:m,revenue:0,cogs:0,gross:0,fees:0,net:0,count:0,wins:0};
    const c=allInv.find(x=>x.id===t.cardId);
    const cost=c?c.buyPrice:0;
    const fee=t.salePrice*(t.platformFeePct/100);
    monthlyMap[m].revenue+=t.salePrice;monthlyMap[m].cogs+=cost;
    monthlyMap[m].fees+=fee;monthlyMap[m].count++;
    if(t.gl>0)monthlyMap[m].wins++;
  });
  Object.values(monthlyMap).forEach(m=>{m.gross=m.revenue-m.cogs;m.net=m.gross-m.fees;});
  const monthly=Object.values(monthlyMap).sort((a,b)=>a.month>b.month?1:-1);
  const chartMonthly=(pnlYear==="all"?monthly:monthly.filter(m=>m.month.startsWith(pnlYear))).slice(-12);

  // ── Yearly comparison ──
  const yearlyMap={};
  sales.forEach(t=>{
    const y=yearOf(t.date);if(!y||y.length<4)return;
    if(!yearlyMap[y])yearlyMap[y]={year:y,revenue:0,cogs:0,gross:0,fees:0,net:0,count:0};
    const c=allInv.find(x=>x.id===t.cardId);
    const cost=c?c.buyPrice:0;const fee=t.salePrice*(t.platformFeePct/100);
    yearlyMap[y].revenue+=t.salePrice;yearlyMap[y].cogs+=cost;yearlyMap[y].fees+=fee;yearlyMap[y].count++;
  });
  Object.values(yearlyMap).forEach(y=>{y.gross=y.revenue-y.cogs;y.net=y.gross-y.fees;});
  const yearlyData=Object.values(yearlyMap).sort((a,b)=>a.year>b.year?1:-1);

  // ── Platform ──
  const pm={};
  fSales.forEach(t=>{
    const p=t.platform||"Other";if(!pm[p])pm[p]={platform:p,revenue:0,cogs:0,profit:0,fees:0,count:0,wins:0};
    const c=allInv.find(x=>x.id===t.cardId);
    pm[p].revenue+=t.salePrice;pm[p].cogs+=c?c.buyPrice:0;
    pm[p].fees+=t.salePrice*(t.platformFeePct/100);pm[p].profit+=t.gl;pm[p].count++;
    if(t.gl>0)pm[p].wins++;
  });
  const platData=Object.values(pm).sort((a,b)=>b.revenue-a.revenue);

  const top10=[...fSales].sort((a,b)=>b.gl-a.gl).slice(0,10);
  const worst5=[...fSales].sort((a,b)=>a.gl-b.gl).slice(0,5);

  const takeSnap=()=>{const s={id:uid(),date:today(),month:curMonth,mv:invValue,cost:invCost,realized:gross,unrealized:unreal,cards:activeInv.length};setSnapshots(p=>{const i=p.findIndex(x=>x.month===curMonth);if(i>=0){const n=[...p];n[i]=s;return n;}return[...p,s];});};
  const snapTrend=snapshots.slice(-12).map(s=>({label:s.month,mv:+(s.mv||0),realized:+(s.realized||0)}));

  const VIEWS=[["overview","Overview"],["monthly","Monthly"],["yearly","Yearly"],["platform","By Platform"],["portfolio","Portfolio"]];

  return(<div className="space-y-5">
    {/* Header */}
    <div className="flex items-center justify-between flex-wrap gap-3">
      <h1 className="text-2xl font-bold text-slate-100">Profit & Loss</h1>
      <div className="flex gap-2 items-center flex-wrap">
        <select value={pnlYear} onChange={e=>setPnlYear(e.target.value)} className="bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm">
          <option value="all">All Time</option>{years.map(y=><option key={y} value={y}>{y}</option>)}
        </select>
        <Btn variant="secondary" size="sm" onClick={takeSnap}>📸 Snapshot</Btn>
      </div>
    </div>

    {/* View tabs */}
    <div className="flex flex-wrap gap-2">{VIEWS.map(([id,label])=><button key={id} onClick={()=>setView(id)} className={clx("px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer",view===id?"bg-blue-600 border-blue-500 text-white":"bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600")}>{label}</button>)}</div>

    {/* ── OVERVIEW ── */}
    {view==="overview"&&<div className="space-y-5">
      {/* Top KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label="Revenue" value={fmt$(rev,0)} color="blue" sub={`${cardsSold} sales`}/>
        <KPI label="Gross Profit" value={fmt$(gross,0)} color={gross>=0?"green":"red"} sub={`${grossMargin.toFixed(0)}% margin`}/>
        <KPI label="Total Expenses" value={fmt$(totalExpenses,0)} color="white" sub="fees + shipping + opex"/>
        <KPI label="Net Profit" value={fmt$(net,0)} color={net>=0?"green":"red"} sub={`${netMargin.toFixed(0)}% net margin`}/>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label="Win Rate" value={`${winRate}%`} color={winRate>=60?"green":winRate>=40?"amber":"red"} sub={`${winCount} of ${cardsSold} profitable`}/>
        <KPI label="Avg ROI" value={`${avgROI.toFixed(0)}%`} color={avgROI>=0?"green":"red"} sub="return on cost"/>
        <KPI label="Avg Sale Price" value={fmt$(avgSalePrice,0)} sub={`avg cost ${fmt$(avgCost,0)}`}/>
        <KPI label="Avg Profit / Card" value={fmt$(avgProfit,0)} color={avgProfit>=0?"green":"red"}/>
      </div>
      {/* Income Statement */}
      <Card className="p-5">
        <h2 className="text-base font-bold text-slate-200 mb-4">Income Statement — {pnlYear==="all"?"All Time":pnlYear}</h2>
        <div className="space-y-0 text-sm">
          <div className="flex justify-between items-center py-2 border-b border-slate-700/50"><span className="text-slate-300 font-semibold">Gross Revenue</span><span className="font-mono font-bold text-blue-400">{fmt$(rev)}</span></div>
          <div className="flex justify-between items-center py-2 pl-4 border-b border-slate-700/30"><span className="text-slate-400">Cost of Goods Sold (COGS)</span><span className="font-mono text-red-400">({fmt$(cogs)})</span></div>
          <div className="flex justify-between items-center py-2.5 border-b border-slate-600 font-semibold bg-slate-900/30 px-2 rounded"><span className="text-slate-200">Gross Profit</span><div className="text-right"><div className={clx("font-mono",gross>=0?"text-emerald-400":"text-red-400")}>{fmt$(gross)}</div><div className="text-xs text-slate-500">{grossMargin.toFixed(1)}% margin</div></div></div>
          <div className="flex justify-between items-center py-2 pl-4 border-b border-slate-700/30"><span className="text-slate-400">Platform Fees</span><span className="font-mono text-red-400">({fmt$(fees)})</span></div>
          <div className="flex justify-between items-center py-2 pl-4 border-b border-slate-700/30"><span className="text-slate-400">Shipping (in + out)</span><span className="font-mono text-red-400">({fmt$(shippingOut+shippingIn)})</span></div>
          {gradingFees>0&&<div className="flex justify-between items-center py-2 pl-4 border-b border-slate-700/30"><span className="text-slate-400">Grading Fees</span><span className="font-mono text-red-400">({fmt$(gradingFees)})</span></div>}
          {opex>0&&<div className="flex justify-between items-center py-2 pl-4 border-b border-slate-700/30"><span className="text-slate-400">Operating Expenses</span><span className="font-mono text-red-400">({fmt$(opex)})</span></div>}
          <div className="flex justify-between items-center py-3 font-bold text-base bg-slate-900/50 px-2 rounded mt-1"><span className="text-slate-100">Net Profit</span><div className="text-right"><div className={clx("font-mono text-lg",net>=0?"text-emerald-400":"text-red-400")}>{fmt$(net)}</div><div className="text-xs text-slate-500">{netMargin.toFixed(1)}% net margin</div></div></div>
        </div>
      </Card>
      {/* Activity summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Card className="p-4"><h3 className="text-sm font-bold text-slate-300 mb-3">Activity Summary</h3><div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-400">Cards Sold</span><span className="font-mono text-slate-200">{cardsSold}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Cards Bought</span><span className="font-mono text-slate-200">{cardsBought}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Capital Deployed</span><span className="font-mono text-slate-200">{fmt$(totalBought)}</span></div>
          <div className="flex justify-between border-t border-slate-700 pt-2"><span className="text-slate-400">Revenue / Card Bought</span><span className="font-mono text-blue-400">{fmt$(cardsBought>0?rev/cardsBought:0)}</span></div>
        </div></Card>
        <Card className="p-4"><h3 className="text-sm font-bold text-slate-300 mb-3">Best & Worst</h3>
          {top10[0]&&<div className="mb-3"><div className="text-xs text-emerald-400 font-semibold mb-1">Best Sale</div><div className="text-sm text-slate-200">{(()=>{const c=allInv.find(x=>x.id===top10[0].cardId);return c?`${c.player} ${c.year}`:top10[0].player||"—";})()}</div><div className="text-xs text-slate-400">{top10[0].date} · {fmt$(top10[0].salePrice)} · <span className="text-emerald-400">+{fmt$(top10[0].gl)}</span></div></div>}
          {worst5[0]&&worst5[0].gl<0&&<div><div className="text-xs text-red-400 font-semibold mb-1">Biggest Loss</div><div className="text-sm text-slate-200">{(()=>{const c=allInv.find(x=>x.id===worst5[0].cardId);return c?`${c.player} ${c.year}`:worst5[0].player||"—";})()}</div><div className="text-xs text-slate-400">{worst5[0].date} · {fmt$(worst5[0].salePrice)} · <span className="text-red-400">{fmt$(worst5[0].gl)}</span></div></div>}
        </Card>
      </div>
      {/* Chart */}
      {chartMonthly.length>0&&<Card className="p-5"><h2 className="text-sm font-bold text-slate-300 mb-4">Revenue vs Profit Trend</h2><ResponsiveContainer width="100%" height={220}><BarChart data={chartMonthly}><CartesianGrid strokeDasharray="3 3" stroke="#1E293B"/><XAxis dataKey="month" tick={{fill:"#94A3B8",fontSize:10}}/><YAxis tick={{fill:"#94A3B8",fontSize:10}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/><Tooltip contentStyle={{background:"#1E293B",border:"1px solid #334155",borderRadius:"8px"}} formatter={v=>[fmt$(v)]}/><Legend/><ReferenceLine y={0} stroke="#475569"/><Bar dataKey="revenue" name="Revenue" fill={ACCENT} radius={[3,3,0,0]}/><Bar dataKey="cogs" name="COGS" fill={RED} radius={[3,3,0,0]}/><Bar dataKey="gross" name="Gross Profit" fill={GREEN} radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></Card>}
    </div>}

    {/* ── MONTHLY BREAKDOWN ── */}
    {view==="monthly"&&<div className="space-y-5">
      <Card><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
        <th className="text-left px-4 py-3">Month</th><th className="text-right px-4 py-3">Sales</th><th className="text-right px-4 py-3">Revenue</th><th className="text-right px-4 py-3">COGS</th><th className="text-right px-4 py-3">Gross Profit</th><th className="text-right px-4 py-3">Fees</th><th className="text-right px-4 py-3">Net Profit</th><th className="text-right px-4 py-3">Win%</th>
      </tr></thead><tbody>
        {monthly.length===0&&<tr><td colSpan={8} className="text-center py-10 text-slate-500">No sales data yet</td></tr>}
        {monthly.filter(m=>pnlYear==="all"||m.month.startsWith(pnlYear)).map(m=>(
          <tr key={m.month} className={clx("border-b border-slate-700/50 hover:bg-slate-700/20",m.month===curMonth&&"bg-blue-500/5")}>
            <td className="px-4 py-3 font-mono text-slate-300">{m.month}{m.month===curMonth&&<span className="ml-2 text-xs text-blue-400">current</span>}</td>
            <td className="px-4 py-3 text-right text-slate-400">{m.count}</td>
            <td className="px-4 py-3 text-right font-mono text-blue-400">{fmt$(m.revenue)}</td>
            <td className="px-4 py-3 text-right font-mono text-slate-400">{fmt$(m.cogs)}</td>
            <td className={clx("px-4 py-3 text-right font-mono font-semibold",m.gross>=0?"text-emerald-400":"text-red-400")}>{fmt$(m.gross)}</td>
            <td className="px-4 py-3 text-right font-mono text-slate-500">{fmt$(m.fees)}</td>
            <td className={clx("px-4 py-3 text-right font-mono font-bold",m.net>=0?"text-emerald-400":"text-red-400")}>{fmt$(m.net)}</td>
            <td className={clx("px-4 py-3 text-right text-xs",m.count>0&&Math.round(m.wins/m.count*100)>=50?"text-emerald-400":"text-red-400")}>{m.count>0?`${Math.round(m.wins/m.count*100)}%`:"—"}</td>
          </tr>
        ))}
        {monthly.filter(m=>pnlYear==="all"||m.month.startsWith(pnlYear)).length>0&&(()=>{const rows=monthly.filter(m=>pnlYear==="all"||m.month.startsWith(pnlYear));const totals=rows.reduce((acc,m)=>({revenue:acc.revenue+m.revenue,cogs:acc.cogs+m.cogs,gross:acc.gross+m.gross,fees:acc.fees+m.fees,net:acc.net+m.net,count:acc.count+m.count}),{revenue:0,cogs:0,gross:0,fees:0,net:0,count:0});return<tr className="border-t-2 border-slate-600 font-bold bg-slate-800/50"><td className="px-4 py-3 text-slate-200">Total</td><td className="px-4 py-3 text-right text-slate-300">{totals.count}</td><td className="px-4 py-3 text-right font-mono text-blue-400">{fmt$(totals.revenue)}</td><td className="px-4 py-3 text-right font-mono text-slate-300">{fmt$(totals.cogs)}</td><td className={clx("px-4 py-3 text-right font-mono",totals.gross>=0?"text-emerald-400":"text-red-400")}>{fmt$(totals.gross)}</td><td className="px-4 py-3 text-right font-mono text-slate-400">{fmt$(totals.fees)}</td><td className={clx("px-4 py-3 text-right font-mono",totals.net>=0?"text-emerald-400":"text-red-400")}>{fmt$(totals.net)}</td><td className="px-4 py-3 text-right"></td></tr>;})()}
      </tbody></table></div></Card>
      {chartMonthly.length>1&&<Card className="p-5"><ResponsiveContainer width="100%" height={240}><LineChart data={chartMonthly}><CartesianGrid strokeDasharray="3 3" stroke="#1E293B"/><XAxis dataKey="month" tick={{fill:"#94A3B8",fontSize:10}}/><YAxis tick={{fill:"#94A3B8",fontSize:10}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/><Tooltip contentStyle={{background:"#1E293B",border:"1px solid #334155",borderRadius:"8px"}} formatter={v=>[fmt$(v)]}/><Legend/><ReferenceLine y={0} stroke="#475569"/><Line type="monotone" dataKey="revenue" name="Revenue" stroke={ACCENT} strokeWidth={2} dot={false}/><Line type="monotone" dataKey="gross" name="Gross Profit" stroke={GREEN} strokeWidth={2} dot={false}/><Line type="monotone" dataKey="net" name="Net Profit" stroke={PURPLE} strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer></Card>}
    </div>}

    {/* ── YEARLY COMPARISON ── */}
    {view==="yearly"&&<div className="space-y-5">
      {yearlyData.length===0&&<Card className="p-8 text-center text-slate-500">No yearly data yet</Card>}
      {yearlyData.length>0&&<><Card><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
        <th className="text-left px-4 py-3">Year</th><th className="text-right px-4 py-3">Sales</th><th className="text-right px-4 py-3">Revenue</th><th className="text-right px-4 py-3">COGS</th><th className="text-right px-4 py-3">Gross Profit</th><th className="text-right px-4 py-3">Margin</th><th className="text-right px-4 py-3">Fees</th><th className="text-right px-4 py-3">Net Profit</th>
      </tr></thead><tbody>
        {yearlyData.map(y=>(
          <tr key={y.year} className={clx("border-b border-slate-700/50 hover:bg-slate-700/20",y.year===String(new Date().getFullYear())&&"bg-blue-500/5")}>
            <td className="px-4 py-3 font-bold text-slate-200">{y.year}{y.year===String(new Date().getFullYear())&&<span className="ml-2 text-xs text-blue-400">current</span>}</td>
            <td className="px-4 py-3 text-right text-slate-400">{y.count}</td>
            <td className="px-4 py-3 text-right font-mono text-blue-400">{fmt$(y.revenue)}</td>
            <td className="px-4 py-3 text-right font-mono text-slate-400">{fmt$(y.cogs)}</td>
            <td className={clx("px-4 py-3 text-right font-mono font-semibold",y.gross>=0?"text-emerald-400":"text-red-400")}>{fmt$(y.gross)}</td>
            <td className="px-4 py-3 text-right text-slate-400">{y.revenue>0?`${(y.gross/y.revenue*100).toFixed(0)}%`:"—"}</td>
            <td className="px-4 py-3 text-right font-mono text-slate-500">{fmt$(y.fees)}</td>
            <td className={clx("px-4 py-3 text-right font-mono font-bold",y.net>=0?"text-emerald-400":"text-red-400")}>{fmt$(y.net)}</td>
          </tr>
        ))}
      </tbody></table></div></Card>
      {yearlyData.length>1&&<Card className="p-5"><h2 className="text-sm font-bold text-slate-300 mb-4">Year over Year</h2><ResponsiveContainer width="100%" height={240}><BarChart data={yearlyData}><CartesianGrid strokeDasharray="3 3" stroke="#1E293B"/><XAxis dataKey="year" tick={{fill:"#94A3B8",fontSize:11}}/><YAxis tick={{fill:"#94A3B8",fontSize:11}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/><Tooltip contentStyle={{background:"#1E293B",border:"1px solid #334155",borderRadius:"8px"}} formatter={v=>[fmt$(v)]}/><Legend/><Bar dataKey="revenue" name="Revenue" fill={ACCENT} radius={[3,3,0,0]}/><Bar dataKey="gross" name="Gross Profit" fill={GREEN} radius={[3,3,0,0]}/><Bar dataKey="net" name="Net Profit" fill={PURPLE} radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></Card>}</>}
    </div>}

    {/* ── BY PLATFORM ── */}
    {view==="platform"&&<div className="space-y-5">
      {platData.length===0&&<Card className="p-8 text-center text-slate-500">No sales data yet</Card>}
      {platData.length>0&&<><Card><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
        <th className="text-left px-4 py-3">Platform</th><th className="text-right px-4 py-3">Sales</th><th className="text-right px-4 py-3">Revenue</th><th className="text-right px-4 py-3">COGS</th><th className="text-right px-4 py-3">Gross Profit</th><th className="text-right px-4 py-3">Fees</th><th className="text-right px-4 py-3">Net</th><th className="text-right px-4 py-3">Win%</th>
      </tr></thead><tbody>
        {platData.map(p=>(
          <tr key={p.platform} className="border-b border-slate-700/50 hover:bg-slate-700/20">
            <td className="px-4 py-3 font-semibold text-slate-200">{p.platform}</td>
            <td className="px-4 py-3 text-right text-slate-400">{p.count}</td>
            <td className="px-4 py-3 text-right font-mono text-blue-400">{fmt$(p.revenue)}</td>
            <td className="px-4 py-3 text-right font-mono text-slate-400">{fmt$(p.cogs)}</td>
            <td className={clx("px-4 py-3 text-right font-mono",(p.revenue-p.cogs)>=0?"text-emerald-400":"text-red-400")}>{fmt$(p.revenue-p.cogs)}</td>
            <td className="px-4 py-3 text-right font-mono text-slate-500">{fmt$(p.fees)}</td>
            <td className={clx("px-4 py-3 text-right font-mono font-bold",p.profit>=0?"text-emerald-400":"text-red-400")}>{fmt$(p.profit)}</td>
            <td className={clx("px-4 py-3 text-right text-xs",p.count>0&&Math.round(p.wins/p.count*100)>=50?"text-emerald-400":"text-red-400")}>{p.count>0?`${Math.round(p.wins/p.count*100)}%`:"—"}</td>
          </tr>
        ))}
      </tbody></table></div></Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {platData.length>0&&<Card className="p-5"><h2 className="text-sm font-bold text-slate-300 mb-4">Revenue by Platform</h2><ResponsiveContainer width="100%" height={200}><PieChart><Pie data={platData} dataKey="revenue" nameKey="platform" cx="50%" cy="50%" outerRadius={80} label={({platform,percent})=>`${platform} ${(percent*100).toFixed(0)}%`} labelLine={false}>{platData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip formatter={v=>[fmt$(v),"Revenue"]} contentStyle={{background:"#1E293B",border:"1px solid #334155",borderRadius:"8px"}}/></PieChart></ResponsiveContainer></Card>}
        <Card className="p-5"><h2 className="text-sm font-bold text-slate-300 mb-4">Top 10 Sales</h2><div className="space-y-2 max-h-48 overflow-y-auto">{top10.map((t,i)=>{const c=allInv.find(x=>x.id===t.cardId);return(<div key={t.id} className="flex items-center gap-2"><span className="text-slate-500 text-xs w-4 font-mono">{i+1}</span><div className="flex-1 min-w-0"><div className="text-xs text-slate-200 truncate">{c?`${c.player} ${c.year||""}`:t.player||"—"}</div><div className="text-xs text-slate-500">{t.date} · {t.platform}</div></div><div className="text-right flex-shrink-0"><div className="font-mono text-xs text-blue-400">{fmt$(t.salePrice)}</div><div className={clx("font-mono text-xs font-bold",t.gl>=0?"text-emerald-400":"text-red-400")}>{t.gl>=0?"+":""}{fmt$(t.gl)}</div></div></div>);})} </div></Card>
      </div></>}
    </div>}

    {/* ── PORTFOLIO ── */}
    {view==="portfolio"&&<div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label="Inventory Value" value={fmt$(invValue,0)} color="blue" sub={`${activeInv.length} cards`}/>
        <KPI label="Cost Basis" value={fmt$(invCost,0)} color="white"/>
        <KPI label="Unrealized G/L" value={fmt$(unreal,0)} color={unreal>=0?"green":"red"} sub={invCost>0?`${(unreal/invCost*100).toFixed(0)}% unrealized ROI`:""}/>
        <KPI label="Total Net Worth" value={fmt$(net+unreal,0)} color={(net+unreal)>=0?"green":"red"} sub="realized + unrealized"/>
      </div>
      {snapTrend.length>1?<Card className="p-5"><h2 className="text-sm font-bold text-slate-300 mb-4">Portfolio Value Over Time</h2><ResponsiveContainer width="100%" height={220}><LineChart data={snapTrend}><CartesianGrid strokeDasharray="3 3" stroke="#1E293B"/><XAxis dataKey="label" tick={{fill:"#94A3B8",fontSize:10}}/><YAxis tick={{fill:"#94A3B8",fontSize:10}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/><Tooltip contentStyle={{background:"#1E293B",border:"1px solid #334155",borderRadius:"8px"}} formatter={v=>[fmt$(v)]}/><Legend/><Line type="monotone" dataKey="mv" name="Portfolio Value" stroke={ACCENT} strokeWidth={2} dot={false}/><Line type="monotone" dataKey="realized" name="Realized Profit" stroke={GREEN} strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer><div className="text-xs text-slate-500 mt-2">Click 📸 Snapshot monthly to build this chart</div></Card>:<Card className="p-8 text-center"><div className="text-3xl mb-3">📸</div><div className="text-slate-300 font-medium mb-1">No snapshots yet</div><div className="text-sm text-slate-500 mb-4">Click the Snapshot button each month to track portfolio growth over time</div><Btn onClick={takeSnap}>Take First Snapshot</Btn></Card>}
      <Card className="p-5"><h2 className="text-sm font-bold text-slate-300 mb-4">Top Holdings by Unrealized Gain</h2><div className="space-y-2">{[...activeInv].sort((a,b)=>((+b.marketValue||+b.buyPrice)-(+b.buyPrice))-((+a.marketValue||+a.buyPrice)-(+a.buyPrice))).slice(0,10).map(c=>{const mv=c.marketValue||c.buyPrice;const gl=mv-c.buyPrice;return<div key={c.id} className="flex items-center gap-3"><div className="flex-1 min-w-0"><div className="text-sm text-slate-200 truncate">{c.player} {c.year}</div><div className="text-xs text-slate-400">{c.grade||"Raw"} {c.certNum?`· ${c.certNum}`:""}</div></div><div className="text-right flex-shrink-0"><div className="font-mono text-sm text-blue-400">{fmt$(mv)}</div><div className={clx("font-mono text-xs font-bold",gl>=0?"text-emerald-400":"text-red-400")}>{gl>=0?"+":""}{fmt$(gl)}</div></div></div>;})}
      </div></Card>
    </div>}
  </div>);
}


// ═══════════════════════════════════════════════════════════════════════════════
// TAX TAB
// ═══════════════════════════════════════════════════════════════════════════════
function TaxTab({transactions,inventory,expenses,setExpenses}){
  const[taxYear,setTaxYear]=useState(new Date().getFullYear());const[section,setSection]=useState("overview");
  const[platform1099,setPlatform1099]=useState({});const[excludedPlatforms,setExcludedPlatforms]=useState(["Cash"]);
  const[expModal,setExpModal]=useState(false);const[mileModal,setMileModal]=useState(false);
  const[ef,setEf]=useState({id:"",date:today(),category:"Shipping",amount:"",notes:"",showName:""});
  const[mf,setMf]=useState({id:"",date:today(),description:"",destination:"",miles:"",roundTrip:true});
  const toggleExclude=p=>setExcludedPlatforms(prev=>prev.includes(p)?prev.filter(x=>x!==p):[...prev,p]);

  const allSales=transactions.filter(t=>t.type==="sale"&&yearOf(t.date)===String(taxYear));
  const sales=allSales.filter(t=>!excludedPlatforms.includes(t.platform));
  const excludedSales=allSales.filter(t=>excludedPlatforms.includes(t.platform));
  const stSales=sales.filter(t=>{const c=inventory.find(x=>x.id===t.cardId);return!isLT(c?.buyDate,t.date);});
  const ltSales=sales.filter(t=>{const c=inventory.find(x=>x.id===t.cardId);return isLT(c?.buyDate,t.date);});
  const stGL=stSales.reduce((s,t)=>s+(t.gl||0),0);const ltGL=ltSales.reduce((s,t)=>s+(t.gl||0),0);
  const yearExp=expenses.filter(e=>yearOf(e.date)===String(taxYear));const mileExp=yearExp.filter(e=>e.category==="Mileage");const otherExp=yearExp.filter(e=>e.category!=="Mileage");
  const mileDeduct=mileExp.reduce((s,e)=>s+(+e.miles||0)*IRS_MILEAGE_RATE,0);const totalMiles=mileExp.reduce((s,e)=>s+(+e.miles||0),0);
  const gradingFees=transactions.filter(t=>t.type==="grading"&&yearOf(t.date)===String(taxYear)).reduce((s,t)=>s+(t.gradingFee||0),0);
  const otherDeduct=otherExp.reduce((s,e)=>s+(+e.amount||0),0);const totalDeduct=otherDeduct+mileDeduct+gradingFees;
  const netIncome=(stGL+ltGL)-totalDeduct;
  const stTax=Math.max(0,stGL)*0.22;const ltTax=Math.max(0,ltGL)*COLLECTIBLES_LT_RATE;const seTax=Math.max(0,netIncome)*SE_TAX_RATE;
  const totalTax=stTax+ltTax+seTax-totalDeduct*0.22;const qtrEst=Math.max(0,totalTax)/4;
  const nearLT=inventory.filter(c=>isActive(c.status)&&c.buyDate).map(c=>({...c,remaining:365-daysBetween(c.buyDate,today())})).filter(c=>c.remaining>0&&c.remaining<=60).sort((a,b)=>a.remaining-b.remaining);
  const showNames=[...new Set(yearExp.filter(e=>e.showName).map(e=>e.showName))];
  const showPnL=showNames.map(name=>{const exp=yearExp.filter(e=>e.showName===name).reduce((s,e)=>s+(+e.amount||0),0);const rev=sales.filter(t=>t.notes?.includes(name)).reduce((s,t)=>s+(t.salePrice||0),0);const profit=sales.filter(t=>t.notes?.includes(name)).reduce((s,t)=>s+(t.gl||0),0)-exp;return{name,expenses:exp,revenue:rev,profit,sales:sales.filter(t=>t.notes?.includes(name)).length};});
  const saveExp=()=>{const e={...ef,id:ef.id||uid(),amount:+ef.amount};setExpenses(p=>p.find(x=>x.id===e.id)?p.map(x=>x.id===e.id?e:x):[...p,e]);setExpModal(false);setEf({id:"",date:today(),category:"Shipping",amount:"",notes:"",showName:""});};
  const saveMile=()=>{const miles=+mf.miles*(mf.roundTrip?2:1);const e={id:mf.id||uid(),date:mf.date,category:"Mileage",miles,amount:miles*IRS_MILEAGE_RATE,notes:`${mf.description}${mf.destination?" > "+mf.destination:""}${mf.roundTrip?" (RT)":""}`,showName:mf.description};setExpenses(p=>p.find(x=>x.id===e.id)?p.map(x=>x.id===e.id?e:x):[...p,e]);setMileModal(false);setMf({id:"",date:today(),description:"",destination:"",miles:"",roundTrip:true});};
  const exportSC=()=>{const lines=[`SCHEDULE C SUMMARY — ${taxYear}`,`Generated: ${today()}`,"",`REVENUE: ${fmt$(sales.reduce((s,t)=>s+(t.salePrice||0),0))}`,`COGS: ${fmt$(sales.reduce((s,t)=>{const c=inventory.find(x=>x.id===t.cardId);return s+(c?+c.buyPrice:0);},0))}`,`GROSS PROFIT: ${fmt$(stGL+ltGL)}`,`  Short-Term: ${fmt$(stGL)}`,`  Long-Term: ${fmt$(ltGL)}`,"",`DEDUCTIONS: ${fmt$(totalDeduct)}`,`  Mileage (${totalMiles} mi x $${IRS_MILEAGE_RATE}): ${fmt$(mileDeduct)}`,`  Grading Fees: ${fmt$(gradingFees)}`,`  Other: ${fmt$(otherDeduct)}`,"",`NET INCOME: ${fmt$(netIncome)}`,"",`EST TAX: ${fmt$(Math.max(0,totalTax))}`,`  ST (22%): ${fmt$(stTax)}`,`  LT (28%): ${fmt$(ltTax)}`,`  SE: ${fmt$(seTax)}`,`  Quarterly: ${fmt$(qtrEst)}`,excludedSales.length>0?`\nEXCLUDED: ${fmt$(excludedSales.reduce((s,t)=>s+(t.salePrice||0),0))} (${excludedSales.length} sales)`:""," ","NOTE: Estimates only. Consult a CPA."];const b=new Blob([lines.join("\n")],{type:"text/plain"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`HobbyFolio_ScheduleC_${taxYear}.txt`;a.click();URL.revokeObjectURL(u);};
  const TABS=[["overview","Overview"],["basis","Cost Basis"],["mileage","Mileage"],["shows","Show P&L"],["expenses","Expenses"],["recon","1099-K"]];
  return(<div className="space-y-5">
    <div className="flex items-center justify-between flex-wrap gap-3"><h1 className="text-2xl font-bold text-slate-100">Tax Center</h1><div className="flex gap-2 flex-wrap items-center"><select value={taxYear} onChange={e=>setTaxYear(+e.target.value)} className="bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm">{[2024,2025,2026].map(y=><option key={y}>{y}</option>)}</select><Btn variant="secondary" size="sm" onClick={exportSC}>Export</Btn><Btn size="sm" onClick={()=>setExpModal(true)}>+ Expense</Btn><Btn variant="secondary" size="sm" onClick={()=>setMileModal(true)}>+ Mileage</Btn></div></div>
    <div className="flex flex-wrap gap-2">{TABS.map(([id,label])=><button key={id} onClick={()=>setSection(id)} className={clx("px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer",section===id?"bg-blue-600 border-blue-500 text-white":"bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600")}>{label}</button>)}</div>
    {/* Exclusion banner */}
    <Card className="p-4"><div className="text-sm font-semibold text-slate-200 mb-2">Platform Exclusions</div><div className="text-xs text-slate-400 mb-3">Excluded platforms are removed from all tax calculations and the Schedule C export.</div><div className="flex flex-wrap gap-2">{PLATFORMS.map(p=>{const ex=excludedPlatforms.includes(p);const cnt=allSales.filter(t=>t.platform===p).length;if(!cnt&&!ex)return null;return <button key={p} onClick={()=>toggleExclude(p)} className={clx("px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer",ex?"bg-red-500/20 border-red-500/40 text-red-300":"bg-emerald-500/20 border-emerald-500/40 text-emerald-300")}>{ex?"Excluded":"Included"} · {p}{cnt>0&&` (${cnt})`}</button>;})}</div>{excludedSales.length>0&&<div className="text-xs text-red-400 mt-2">{excludedSales.length} sales ({fmt$(excludedSales.reduce((s,t)=>s+(t.salePrice||0),0))}) excluded from tax calcs</div>}</Card>

    {section==="overview"&&<div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3"><KPI label="Short-Term G/L" value={fmt$(stGL)} color={stGL>=0?"green":"red"} sub="ordinary rate"/><KPI label="Long-Term G/L" value={fmt$(ltGL)} color={ltGL>=0?"green":"red"} sub="28% collectibles"/><KPI label="Total Deductions" value={fmt$(totalDeduct)} color="amber"/><KPI label="Net Income" value={fmt$(netIncome)} color={netIncome>=0?"red":"green"}/></div>
      {nearLT.length>0&&<Card className="p-4 border-emerald-500/40 bg-emerald-500/5"><h3 className="text-sm font-bold text-emerald-400 mb-2">{nearLT.length} cards near LT threshold</h3><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">{nearLT.slice(0,6).map(c=><div key={c.id} className="flex justify-between text-xs p-2 bg-slate-900 rounded"><span className="text-slate-300 truncate">{c.player} {c.year}</span><span className="text-emerald-400 font-mono ml-2">{c.remaining}d</span></div>)}</div></Card>}
      <Card className="p-5"><h2 className="text-base font-bold text-slate-200 mb-3">Estimated Tax</h2><div className="space-y-2 text-sm">
        <div className="flex justify-between py-1"><span className="text-slate-400">ST gains (22%)</span><span className="font-mono text-red-400">{fmt$(stTax)}</span></div>
        <div className="flex justify-between py-1"><span className="text-slate-400">LT collectibles (28%)</span><span className="font-mono text-red-400">{fmt$(ltTax)}</span></div>
        <div className="flex justify-between py-1"><span className="text-slate-400">Self-employment</span><span className="font-mono text-red-400">{fmt$(seTax)}</span></div>
        <div className="flex justify-between py-1"><span className="text-slate-400">Deduction savings</span><span className="font-mono text-emerald-400">-{fmt$(totalDeduct*0.22)}</span></div>
        <div className="flex justify-between pt-2 border-t border-slate-700 font-bold"><span className="text-slate-200">Total</span><span className="font-mono text-red-400">{fmt$(Math.max(0,totalTax))}</span></div>
        <div className="p-3 bg-slate-900 rounded-lg mt-2"><div className="text-xs text-slate-400">Quarterly payment</div><div className="text-2xl font-bold font-mono text-amber-400">{fmt$(qtrEst)}</div></div>
      </div></Card>
    </div>}
    {section==="basis"&&<div className="space-y-4"><Card><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-slate-700 text-slate-400 uppercase"><th className="text-left px-3 py-2">Card</th><th className="text-left px-3 py-2">Sold</th><th className="text-right px-3 py-2">Buy</th><th className="text-right px-3 py-2">Net</th><th className="text-right px-3 py-2">G/L</th><th className="text-center px-3 py-2">ST/LT</th></tr></thead><tbody>
      {sales.length===0&&<tr><td colSpan={6} className="text-center py-8 text-slate-500">No sales for {taxYear}</td></tr>}
      {sales.map(t=>{const c=inventory.find(x=>x.id===t.cardId);return <tr key={t.id} className="border-b border-slate-700/50"><td className="px-3 py-2 text-slate-200 truncate max-w-32">{c?`${c.player} ${c.year||""}`:t.player}</td><td className="px-3 py-2 font-mono text-slate-400">{t.date}</td><td className="px-3 py-2 text-right font-mono text-slate-300">{fmt$(c?.buyPrice)}</td><td className="px-3 py-2 text-right font-mono text-blue-400">{fmt$(t.netProceeds)}</td><td className={clx("px-3 py-2 text-right font-mono",(t.gl||0)>=0?"text-emerald-400":"text-red-400")}>{fmt$(t.gl)}</td><td className="px-3 py-2 text-center"><Badge color={isLT(c?.buyDate,t.date)?"green":"amber"}>{isLT(c?.buyDate,t.date)?"LT":"ST"}</Badge></td></tr>;})}
    </tbody></table></div></Card></div>}
    {section==="mileage"&&<div className="space-y-4"><div className="grid grid-cols-2 sm:grid-cols-4 gap-3"><KPI label="Total Miles" value={totalMiles.toFixed(0)}/><KPI label="IRS Rate" value={`$${IRS_MILEAGE_RATE}/mi`}/><KPI label="Deduction" value={fmt$(mileDeduct)} color="green"/><KPI label="Tax Savings" value={fmt$(mileDeduct*0.22)} color="green" sub="est at 22%"/></div>
      <Card><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-700 text-slate-400 text-xs uppercase"><th className="text-left px-3 py-3">Date</th><th className="text-left px-3 py-3">Trip</th><th className="text-right px-3 py-3">Miles</th><th className="text-right px-3 py-3">Deduction</th><th className="px-3 py-3"></th></tr></thead><tbody>
        {mileExp.length===0&&<tr><td colSpan={5} className="text-center py-8 text-slate-500">No mileage logged</td></tr>}
        {mileExp.sort((a,b)=>b.date>a.date?1:-1).map(e=><tr key={e.id} className="border-b border-slate-700/50"><td className="px-3 py-2 font-mono text-xs text-slate-300">{e.date}</td><td className="px-3 py-2 text-slate-200">{e.notes}</td><td className="px-3 py-2 text-right font-mono text-slate-300">{(+e.miles||0).toFixed(0)}</td><td className="px-3 py-2 text-right font-mono text-emerald-400">{fmt$((+e.miles||0)*IRS_MILEAGE_RATE)}</td><td className="px-3 py-2 text-right"><button onClick={()=>setExpenses(p=>p.filter(x=>x.id!==e.id))} className="text-red-400 text-xs cursor-pointer">×</button></td></tr>)}
      </tbody></table></div></Card></div>}
    {section==="shows"&&<div className="space-y-4">{showPnL.length===0&&<div className="text-center py-12 text-slate-500">No show data — tag expenses with show names</div>}{showPnL.map(s=><Card key={s.name} className={clx("p-4",s.profit>=0?"border-emerald-500/30":"border-red-500/30")}><div className="font-bold text-slate-100 mb-3">{s.name}</div><div className="grid grid-cols-3 gap-3 text-center"><div><div className="text-xs text-slate-500">Revenue</div><div className="font-mono font-bold text-blue-400">{fmt$(s.revenue)}</div></div><div><div className="text-xs text-slate-500">Expenses</div><div className="font-mono font-bold text-red-400">{fmt$(s.expenses)}</div></div><div><div className="text-xs text-slate-500">Profit</div><div className={clx("font-mono font-bold",s.profit>=0?"text-emerald-400":"text-red-400")}>{fmt$(s.profit)}</div></div></div></Card>)}</div>}
    {section==="expenses"&&<div className="space-y-4"><Card><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-700 text-slate-400 text-xs uppercase"><th className="text-left px-3 py-2">Date</th><th className="text-left px-3 py-2">Category</th><th className="text-left px-3 py-2">Notes</th><th className="text-left px-3 py-2">Show</th><th className="text-right px-3 py-2">Amount</th><th className="px-3 py-2"></th></tr></thead><tbody>
      {otherExp.length===0&&<tr><td colSpan={6} className="text-center py-8 text-slate-500">No expenses logged</td></tr>}
      {otherExp.sort((a,b)=>b.date>a.date?1:-1).map(e=><tr key={e.id} className="border-b border-slate-700/50"><td className="px-3 py-2 font-mono text-xs text-slate-300">{e.date}</td><td className="px-3 py-2"><Badge color="gray">{e.category}</Badge></td><td className="px-3 py-2 text-slate-400">{e.notes}</td><td className="px-3 py-2 text-slate-500 text-xs">{e.showName||"—"}</td><td className="px-3 py-2 text-right font-mono text-amber-400">{fmt$(e.amount)}</td><td className="px-3 py-2 text-right"><button onClick={()=>setExpenses(p=>p.filter(x=>x.id!==e.id))} className="text-red-400 text-xs cursor-pointer">×</button></td></tr>)}
    </tbody></table></div></Card></div>}
    {section==="recon"&&<div className="space-y-4"><Card className="p-5 space-y-3">{PLATFORMS.map(p=>{const mine=sales.filter(t=>t.platform===p).reduce((s,t)=>s+(t.salePrice||0),0);const rep=+platform1099[p]||0;const match=rep===0||Math.abs(rep-mine)<1;return <div key={p} className={clx("p-3 rounded-lg",!match&&rep>0?"bg-red-500/10 border border-red-500/30":"bg-slate-900/40")}><div className="flex items-center gap-3 flex-wrap"><span className="text-slate-300 font-medium w-24 flex-shrink-0">{p}</span><input type="number" placeholder="1099-K $" value={platform1099[p]||""} onChange={e=>setPlatform1099(prev=>({...prev,[p]:e.target.value}))} className="bg-slate-900 border border-slate-600 text-slate-200 rounded px-2 py-1 text-xs flex-1"/><div className="text-right flex-shrink-0"><div className="font-mono text-sm text-blue-400">{fmt$(mine)}</div></div>{rep>0&&<div className={clx("font-mono text-xs",match?"text-emerald-400":"text-red-400")}>{match?"Match":fmt$(rep-mine)+" diff"}</div>}</div></div>;})}</Card></div>}
    {/* Modals */}
    {expModal&&<Modal title="Log Expense" onClose={()=>setExpModal(false)}><div className="grid grid-cols-1 gap-4"><div className="grid grid-cols-2 gap-3"><Input label="Date" value={ef.date} onChange={v=>setEf(p=>({...p,date:v}))} type="date"/><Input label="Category" value={ef.category} onChange={v=>setEf(p=>({...p,category:v}))} options={DEDUCTION_CATEGORIES}/><Input label="Amount ($)" value={ef.amount} onChange={v=>setEf(p=>({...p,amount:v}))} type="number"/><Input label="Show Name" value={ef.showName} onChange={v=>setEf(p=>({...p,showName:v}))} placeholder="Optional"/></div><Input label="Notes" value={ef.notes} onChange={v=>setEf(p=>({...p,notes:v}))}/><div className="flex gap-3 justify-end"><Btn variant="secondary" onClick={()=>setExpModal(false)}>Cancel</Btn><Btn disabled={!ef.amount} onClick={saveExp}>Save</Btn></div></div></Modal>}
    {mileModal&&<Modal title="Log Mileage" onClose={()=>setMileModal(false)}><div className="grid grid-cols-1 gap-4"><div className="p-3 bg-slate-900/50 rounded-lg text-xs text-slate-400">IRS rate: <span className="text-blue-300 font-semibold">${IRS_MILEAGE_RATE}/mi</span></div><div className="grid grid-cols-2 gap-3"><Input label="Date" value={mf.date} onChange={v=>setMf(p=>({...p,date:v}))} type="date"/><Input label="Purpose" value={mf.description} onChange={v=>setMf(p=>({...p,description:v}))} placeholder="Card Show..."/><Input label="Destination" value={mf.destination} onChange={v=>setMf(p=>({...p,destination:v}))}/><Input label="One-Way Miles" value={mf.miles} onChange={v=>setMf(p=>({...p,miles:v}))} type="number" hint={mf.miles&&`Total: ${(+mf.miles*(mf.roundTrip?2:1)).toFixed(0)} mi = ${fmt$((+mf.miles*(mf.roundTrip?2:1))*IRS_MILEAGE_RATE)}`}/></div><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={mf.roundTrip} onChange={e=>setMf(p=>({...p,roundTrip:e.target.checked}))}/><span className="text-sm text-slate-300">Round trip</span></label><div className="flex gap-3 justify-end"><Btn variant="secondary" onClick={()=>setMileModal(false)}>Cancel</Btn><Btn disabled={!mf.miles||!mf.description} onClick={saveMile}>Save</Btn></div></div></Modal>}
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA MANAGEMENT (inline confirm, no window.confirm)
// ═══════════════════════════════════════════════════════════════════════════════
function DataMgmt({setInventory,setTransactions,setExpenses,setSnapshots,setJournal,setOffers,setWatchlist,setSets,setConsignment,counts}){
  const[pending,setPending]=useState(null);const[done,setDone]=useState(null);const[backfillResult,setBackfillResult]=useState("");
  const exec=(key,label,setter)=>{store.set(key,[]);setter([]);setPending(null);setDone(label);setTimeout(()=>setDone(null),2500);};
  const execAll=()=>{[["cv_inventory",setInventory],["cv_transactions",setTransactions],["cv_expenses",setExpenses],["cv_snapshots",setSnapshots],["cv_journal",setJournal],["cv_offers",setOffers],["cv_watchlist",setWatchlist],["cv_sets",setSets],["cv_consignment",setConsignment]].forEach(([k,s])=>{store.set(k,[]);s([]);});setPending(null);setDone("ALL DATA");setTimeout(()=>setDone(null),3000);};
  // Deduplicate existing inventory
  const[dedupResult,setDedupResult]=useState(null);
  const runDedup=()=>{
    const seen=new Map();const dupes=[];const keep=[];
    // Get current inventory from the setter's current value
    const inv=[];// We need to read it from props — passed as counts.allInv
    (counts.allInv||[]).forEach(card=>{
      const cert=String(card.certNum||"").trim();
      const key=cert||`${(card.player||"").trim().toLowerCase()}|${(card.year||"").trim()}|${(+card.buyPrice||0).toFixed(0)}`;
      if(seen.has(key)){
        // Keep the one with more data (more filled fields)
        const existing=seen.get(key);
        const existingScore=[existing.grade,existing.certNum,existing.set,existing.marketValue,existing.notes].filter(Boolean).length;
        const newScore=[card.grade,card.certNum,card.set,card.marketValue,card.notes].filter(Boolean).length;
        if(newScore>existingScore){
          // Replace: keep new one, mark old as dupe
          dupes.push(existing);
          seen.set(key,{...card,grade:card.grade||existing.grade,certNum:card.certNum||existing.certNum,condition:(card.grade||card.certNum||existing.grade||existing.certNum)?"Graded":card.condition,buyDate:existing.buyDate||card.buyDate,buyPrice:+existing.buyPrice||+card.buyPrice,notes:[existing.notes,card.notes].filter(Boolean).join(" | ")});
        }else{
          dupes.push(card);
          seen.set(key,{...existing,grade:existing.grade||card.grade,certNum:existing.certNum||card.certNum,condition:(existing.grade||existing.certNum||card.grade||card.certNum)?"Graded":existing.condition,marketValue:Math.max(+existing.marketValue||0,+card.marketValue||0),notes:[existing.notes,card.notes].filter(Boolean).join(" | ")});
        }
      }else{seen.set(key,card);}
    });
    const merged=[...seen.values()];
    setDedupResult({removed:dupes.length,kept:merged.length});
    setInventory(merged);
  };

  const rows=[["cv_inventory","Inventory","All cards",setInventory,counts.inv],["cv_transactions","Transactions","All sales/purchases/trades",setTransactions,counts.tx],["cv_expenses","Expenses","All deductions + mileage",setExpenses,counts.exp],["cv_snapshots","Snapshots","Monthly P&L snapshots",setSnapshots],["cv_journal","Journal","Journal entries",setJournal],["cv_offers","Offers","Offer tracker",setOffers],["cv_watchlist","Watch List","Watch list",setWatchlist]];
  return(<div className="space-y-5">
    {done&&<div className="p-3 bg-emerald-500/10 border border-emerald-500/40 rounded-xl text-sm text-emerald-400 text-center font-medium">{done} cleared</div>}
    {pending&&<Card className="p-5 border-red-500/50 bg-red-500/10"><div className="text-sm font-bold text-red-300 mb-2">Clear {pending.label}?</div><div className="text-xs text-slate-400 mb-4">This is permanent.</div><div className="flex gap-3"><Btn variant="danger" onClick={()=>{if(pending.key==="ALL")execAll();else exec(pending.key,pending.label,pending.setter);}}>Yes, Delete</Btn><Btn variant="secondary" onClick={()=>setPending(null)}>Cancel</Btn></div></Card>}
    <Card className="p-5"><div className="text-sm font-bold text-slate-200 mb-4">Clear by Type</div>{rows.map(([key,label,desc,setter,count])=><div key={key} className="flex items-center justify-between gap-3 py-3 border-b border-slate-700/40 last:border-0"><div><div className="flex items-center gap-2"><span className="text-sm text-slate-200">{label}</span>{count!=null&&<span className="text-xs text-slate-500 font-mono">({count})</span>}</div><div className="text-xs text-slate-500">{desc}</div></div><Btn variant="danger" size="sm" onClick={()=>setPending({key,label,setter})}>Clear</Btn></div>)}</Card>
    {/* Deduplicate tool */}
    <Card className="p-5 border-blue-500/40 bg-blue-500/5"><div className="text-base font-bold text-blue-300 mb-1">Deduplicate Inventory</div><div className="text-xs text-slate-400 mb-4">Finds cards with matching cert # or same Player+Year+Cost and merges them into one entry, keeping the best data from both. Safe to run multiple times.</div>
      <Btn variant="primary" onClick={runDedup}>Run Dedup</Btn>
      {dedupResult&&<div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/40 rounded-lg text-sm text-emerald-400">{dedupResult.removed} duplicates removed. {dedupResult.kept} unique cards kept.</div>}
    </Card>

    {/* Backfill purchases */}
    <Card className="p-5 border-blue-500/30 bg-blue-500/5">
      <div className="text-base font-bold text-blue-300 mb-1">Backfill Purchase Transactions</div>
      <div className="text-xs text-slate-400 mb-4">Auto-creates a purchase transaction for every card in your inventory that does not already have one. Run this once after your initial import to populate your full buying history in the Transactions tab.</div>
      {backfillResult&&<div className="text-sm text-emerald-400 mb-3">{backfillResult}</div>}
      <Btn onClick={()=>{
        const existingPurchaseCardIds=new Set((counts.allTx||[]).filter(t=>t.type==="purchase").map(t=>t.cardId||t.card_id).filter(Boolean));
        const missing=(counts.allInv||[]).filter(c=>!existingPurchaseCardIds.has(c.id));
        if(missing.length===0){setBackfillResult("All cards already have purchase transactions.");setTimeout(()=>setBackfillResult(""),3000);return;}
        const newTxs=missing.map(c=>({id:uid(),type:"purchase",cardId:c.id,player:c.player,date:normalizeDate(c.buyDate||c.buy_date)||today(),platform:c.buyPlatform||c.buy_platform||"Other",salePrice:0,platformFeePct:0,shippingOut:0,shippingIn:0,notes:"Backfilled purchase",netProceeds:0,gl:0,purchasePrice:+(c.buyPrice||c.buy_price||0),gradingFee:0,tradeValueOut:0,tradeValueIn:0}));
        setTransactions(p=>[...p,...newTxs]);
        setBackfillResult(`Created ${newTxs.length} purchase transactions from your inventory.`);
        setTimeout(()=>setBackfillResult(""),4000);
      }}>Generate Missing Purchase Transactions</Btn>
    </Card>
    <Card className="p-5 border-red-500/40 bg-red-500/5"><div className="text-base font-bold text-red-300 mb-1">Clear Everything</div><div className="text-xs text-slate-400 mb-4">Wipes all data. Two clicks required.</div><Btn variant="danger" onClick={()=>setPending({key:"ALL",label:"ALL DATA"})}>Clear All Data</Btn></Card>
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOLS TAB (Import Wizard, Watchlist, Offers, ROI, Sets, Consignment, Insurance, Data)
// ═══════════════════════════════════════════════════════════════════════════════
function ToolsTab({inventory,setInventory,transactions,setTransactions,expenses,setExpenses,setSnapshots,journal,setJournal}){
  const[activeTool,setActiveTool]=useState("import");
  const[watchlist,setWatchlist]=usePersist("cv_watchlist",[]);const[sets,setSets]=usePersist("cv_sets",[]);const[consignment,setConsignment]=usePersist("cv_consignment",[]);const[offers,setOffers]=usePersist("cv_offers",[]);
  const[importWizard,setImportWizard]=useState(null);const[importType,setImportType]=useState("");const[refreshPreview,setRefreshPreview]=useState(null);
  const[wf,setWf]=useState({player:"",set:"",targetPrice:"",notes:""});const[sf,setSf]=useState({name:"",totalCards:""});const[cf,setCf]=useState({cardId:"",location:"",splitPct:"",consignor:""});
  const[of,setOf]=useState({player:"",platform:"eBay",offerPrice:"",askingPrice:"",date:today(),expiry:"",notes:"",status:"Pending"});

  // ── CSV Parser ──
  const parseCSV=text=>{const lines=text.split(/\r?\n/).filter(l=>l.trim());if(!lines.length)return null;const parseRow=line=>{const vals=[];let cur="",inQ=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"')inQ=!inQ;else if(c===','&&!inQ){vals.push(cur.trim());cur="";}else cur+=c;}vals.push(cur.trim());return vals;};const rawHeaders=parseRow(lines[0]).map(h=>h.replace(/^"|"$/g,"").trim());const rows=lines.slice(1).map(l=>parseRow(l).map(v=>v.replace(/^"|"$/g,"").trim())).filter(r=>r.some(v=>v));return{rawHeaders,rows};};
  const autoDetect=rawHeaders=>{const mapping={player:"",year:"",set:"",cardNum:"",parallel:"",grade:"",certNum:"",buyPrice:"",marketValue:"",buyDate:"",buyPlatform:"",status:"",condition:"",notes:"",location:"",sold:"",saleDate:"",salePrice:"",saleFees:""};rawHeaders.forEach(h=>{const lh=h.toLowerCase().trim();const target=CL_MAP[lh];if(target&&!mapping[target])mapping[target]=h;});return mapping;};

  // ── File import handler ──
  const handleFile=e=>{const file=e.target.files[0];if(!file)return;e.target.value="";const effType=importType||"auto";const reader=new FileReader();reader.onload=ev=>{const parsed=parseCSV(ev.target.result);if(!parsed)return;
    if(effType==="refresh"){
      // Refresh: show a quick column verify step (just cert# + player + value)
      const mapping=autoDetect(parsed.rawHeaders);
      setImportWizard({
        step:"refresh-map",
        rawHeaders:parsed.rawHeaders,
        rows:parsed.rows,
        mapping,
        importType:"refresh"
      });
    }else{
      setImportWizard({step:"map",rawHeaders:parsed.rawHeaders,rows:parsed.rows,mapping:autoDetect(parsed.rawHeaders),mergeMode:"smart",importType:effType});
    }
  };reader.readAsText(file);};

  const processRefresh=(incomingCards)=>{
    const matched=[];const missing=[];const newCards=[];const matchedExistingIds=new Set();
    const activeInv=inventory.filter(c=>isActive(c.status));

    incomingCards.forEach(inc=>{
      // Normalize incoming values — CL might use different field names
      const incCert=String(inc.certNum||inc.cert_num||"").trim().replace(/[^a-zA-Z0-9]/g,"");
      const incPlayer=(inc.player||"").trim().toLowerCase();
      const incYear=String(inc.year||"").trim();
      const incSet=(inc.set||inc.set_name||"").trim().toLowerCase();

      const match=activeInv.find(ex=>{
        if(matchedExistingIds.has(ex.id))return false;
        // Normalize existing values (handles both Supabase snake_case and camelCase)
        const exCert=String(ex.certNum||ex.cert_num||"").trim().replace(/[^a-zA-Z0-9]/g,"");
        const exPlayer=(ex.player||"").trim().toLowerCase();
        const exYear=String(ex.year||"").trim();
        const exSet=(ex.set||ex.set_name||"").trim().toLowerCase();

        // Rule 1: Both have certs and they match → same card
        if(incCert&&exCert&&incCert===exCert)return true;
        // Rule 2: Both have certs and they differ → different card
        if(incCert&&exCert&&incCert!==exCert)return false;
        // Rule 3: Player + Year match (no cost required — CL may not have buy price)
        if(incPlayer&&exPlayer&&incPlayer===exPlayer&&incYear&&exYear&&incYear===exYear){
          // If we have set info on both, use it to disambiguate
          if(incSet&&exSet)return incSet===exSet;
          return true;
        }
        return false;
      });

      if(match){
        matched.push({existing:match,incoming:inc});
        matchedExistingIds.add(match.id);
      } else {
        // Only flag as new if it has a player name
        if(inc.player)newCards.push(inc);
      }
    });

    // Find active cards not in CL export — exclude already-sold in transactions
    activeInv.forEach(ex=>{
      if(!matchedExistingIds.has(ex.id)){
        const alreadySold=transactions.some(t=>
          t.type==="sale"&&(t.cardId===ex.id||t.card_id===ex.id)
        );
        if(!alreadySold)missing.push(ex);
      }
    });

    // Apply market value updates silently — only update if CL has a value
    if(matched.length>0){
      setInventory(p=>p.map(ex=>{
        const m=matched.find(x=>x.existing.id===ex.id);
        if(!m)return ex;
        const newMV=+m.incoming.marketValue||+m.incoming.market_value||0;
        if(!newMV)return ex; // Don't update if CL has no value
        return{...ex,marketValue:newMV,market_value:newMV};
      }));
    }

    setImportWizard({
      step:"refresh-review",
      matched:matched.length,
      newCards,
      missing,
      mode:"refresh",
      debugInfo:{incoming:incomingCards.length,active:activeInv.length}
    });
  };

  // ── Build cards from wizard ──
  const buildCards=wiz=>{const{rows,mapping}=wiz;const getVal=(row,field)=>{const col=mapping[field];if(!col)return"";const idx=wiz.rawHeaders.indexOf(col);return idx>=0?(row[idx]||""):"";};
    return rows.map(row=>{const player=getVal(row,"player");if(!player)return null;const rawGrade=getVal(row,"grade");
      // Try to detect grade from other columns if grade col is blank
      const gradeFromSet=rawGrade||getVal(row,"parallel")||"";
      const grade=rawGrade;
      const certNum=getVal(row,"certNum").replace(/[^a-zA-Z0-9]/g,"");
      const buyPriceRaw=getVal(row,"buyPrice").replace(/[$,]/g,"");const mvRaw=getVal(row,"marketValue").replace(/[$,]/g,"");
      const soldRaw=getVal(row,"sold").toLowerCase();const salePriceRaw=getVal(row,"salePrice").replace(/[$,]/g,"");const saleDateRaw=getVal(row,"saleDate");
      const isSold=soldRaw==="true"||soldRaw==="yes"||soldRaw==="sold"||soldRaw==="1"||(+salePriceRaw>0)||(saleDateRaw!=="");
      const saleFeesRaw=getVal(row,"saleFees").replace(/[$,]/g,"");const statusRaw=getVal(row,"status");
      const effType=wiz.importType||"auto";const defaultStatus=effType==="history"?(isSold?"Sold":"Archived"):(statusRaw||"For Sale");
      const card={id:uid(),player,year:getVal(row,"year"),set:getVal(row,"set"),cardNum:getVal(row,"cardNum"),parallel:getVal(row,"parallel"),condition:(grade||certNum)?"Graded":"Raw",grade,certNum,buyPrice:+buyPriceRaw||0,marketValue:+mvRaw||+buyPriceRaw||0,buyDate:normalizeDate(getVal(row,"buyDate"))||today(),buyPlatform:getVal(row,"buyPlatform"),status:defaultStatus,notes:getVal(row,"notes"),location:getVal(row,"location"),photo:""};
      if(isSold&&+salePriceRaw>0){card._sale={date:normalizeDate(saleDateRaw)||today(),price:+salePriceRaw,fees:+saleFeesRaw||0};card.soldDate=card._sale.date;card.soldPrice=card._sale.price;}
      return card;}).filter(Boolean);};

  // ── Analyze import for dedup ──
  const previewRefreshMatches=(incomingCards)=>{
    const activeInv=inventory.filter(c=>isActive(c.status));
    const certMatched=[];const nameMatched=[];const unmatched=[];const matchedIds=new Set();
    incomingCards.forEach(inc=>{
      const incCert=String(inc.certNum||inc.cert_num||"").trim().replace(/[^a-zA-Z0-9]/g,"");
      const incPlayer=(inc.player||"").trim().toLowerCase();
      const incYear=String(inc.year||"").trim();
      const incSet=(inc.set||inc.set_name||"").trim().toLowerCase();
      const incMV=+inc.marketValue||+inc.market_value||0;
      // Try cert # first
      if(incCert){
        const m=activeInv.find(ex=>{if(matchedIds.has(ex.id))return false;const ec=String(ex.certNum||ex.cert_num||"").trim().replace(/[^a-zA-Z0-9]/g,"");return ec===incCert;});
        if(m){certMatched.push({inc,ex:m,mv:incMV});matchedIds.add(m.id);return;}
      }
      // Fallback: player+year (raw cards)
      const m=activeInv.find(ex=>{if(matchedIds.has(ex.id))return false;const sp=(ex.player||"").trim().toLowerCase()===incPlayer;const sy=String(ex.year||"").trim()===incYear;const ss=incSet&&(ex.set||ex.set_name||"").trim().toLowerCase()===incSet;return sp&&sy&&(incSet?ss:true);});
      if(m){nameMatched.push({inc,ex:m,mv:incMV});matchedIds.add(m.id);}
      else if(inc.player)unmatched.push(inc);
    });
    setRefreshPreview({certMatched,nameMatched,unmatched,total:incomingCards.length});
  };

  const analyzeImport=(cards,type)=>{const effType=type==="refresh"?"inventory":type==="auto"?(cards.some(c=>c._sale)?"history":"inventory"):type;const actions=new Map(),matches=new Map(),matchedIds=new Set(),duplicates=[];
    cards.forEach(card=>{const incCert=String(card.certNum||"").trim();let matchReason="";
      const match=inventory.find(ex=>{if(matchedIds.has(ex.id))return false;const exCert=String(ex.certNum||"").trim();
        // Rule 1: Both have cert and they differ → definitely different cards
        if(incCert&&exCert&&incCert!==exCert)return false;
        // Rule 2: Both have cert and they match → same card
        if(incCert&&exCert&&incCert===exCert){matchReason="Cert #"+incCert;return true;}
        // Rule 3: Skip sold cards for name matching
        if(ex.status==="Sold"&&!exCert)return false;
        // Rule 4: Name match — works when one or both sides lack cert
        const sp=(ex.player||"").trim().toLowerCase()===(card.player||"").trim().toLowerCase();
        const sy=String(ex.year||"").trim()===String(card.year||"").trim();
        const sc=Math.abs((+ex.buyPrice||0)-(+card.buyPrice||0))<=1;
        const setMatch=(ex.set||"").trim().toLowerCase()===(card.set||"").trim().toLowerCase();
        if(sp&&sy&&sc){matchReason=incCert?"Cert+Name":"Player+Year+Cost";return true;}
        if(sp&&sy&&setMatch){matchReason="Player+Year+Set";return true;}
        return false;});
      if(!match){actions.set(card.id,"new");return;}
      matches.set(card.id,match.id);matchedIds.add(match.id);
      duplicates.push({incoming:card,existing:match,reason:matchReason});
      actions.set(card.id,effType==="inventory"?"update":"skip");});
    const toArchive=effType==="inventory"?inventory.filter(ex=>!matchedIds.has(ex.id)&&isActive(ex.status)):[];
    const counts={added:0,updated:0,skipped:0,archived:toArchive.length};
    actions.forEach(a=>{if(a==="new")counts.added++;else if(a==="update")counts.updated++;else counts.skipped++;});
    return{actions,matches,counts,effType,toArchive,matchedIds,duplicates};};
  const[dupResolutions,setDupResolutions]=useState({});
  const resolveDup=(id,choice)=>setDupResolutions(p=>({...p,[id]:choice}));
  const resolveAllDups=choice=>{const r={};(previewAnalysis?.duplicates||[]).forEach(d=>{r[d.incoming.id]=choice;});setDupResolutions(p=>({...p,...r}));};
  const previewAnalysis=importWizard?.step==="preview"&&importWizard.mergeMode==="smart"?analyzeImport(importWizard.preview||[],importWizard.importType||"auto"):null;
  const makeSaleTx=c=>{const net=c._sale.price-c._sale.fees;return{id:uid(),type:"sale",cardId:c.id,player:c.player,date:c._sale.date,platform:c.buyPlatform||"Other",salePrice:c._sale.price,platformFeePct:c._sale.price>0?+((c._sale.fees/c._sale.price)*100).toFixed(2):0,shippingOut:0,shippingIn:0,notes:"Imported sale",netProceeds:net,gl:net-(+c.buyPrice||0),purchasePrice:0,gradingFee:0,tradeValueOut:0,tradeValueIn:0};};
  const makePurchaseTx=c=>{if(!c.buyDate&&!c.buyPrice)return null;return{id:uid(),type:"purchase",cardId:c.id,player:c.player,date:c.buyDate||today(),platform:c.buyPlatform||c.buy_platform||"Other",salePrice:0,platformFeePct:0,shippingOut:0,shippingIn:0,notes:"Imported purchase",netProceeds:0,gl:0,purchasePrice:+(c.buyPrice||c.buy_price||0),gradingFee:0,tradeValueOut:0,tradeValueIn:0};};
  const makeTx=c=>makeSaleTx(c);

  const TOOLS=[["import","📥 Import"],["watchlist","👁 Watch"],["offers","🤝 Offers"],["roi","📊 ROI"],["sets","📋 Sets"],["consignment","📦 Consign"],["insurance","🔒 Insurance"],["data","🗑 Data"]];
  return(<div className="space-y-5">
    <h1 className="text-2xl font-bold text-slate-100">Tools</h1>
    <div className="flex flex-wrap gap-2">{TOOLS.map(([id,label])=><button key={id} onClick={()=>setActiveTool(id)} className={clx("px-3 py-2 rounded-lg text-sm font-medium border cursor-pointer",activeTool===id?"bg-blue-600 border-blue-500 text-white":"bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600")}>{label}</button>)}</div>

    {/* ════ IMPORT WIZARD ════ */}
    {activeTool==="import"&&<div className="space-y-5">
      {!importWizard&&<Card className="p-6 space-y-6">
        <div className="text-center space-y-2"><div className="text-5xl">📥</div><h2 className="text-xl font-bold text-slate-200">Import Your Collection</h2><p className="text-sm text-slate-400">Upload a CSV from your tracker, Card Ladder, or any spreadsheet.</p></div>

        {/* Step 1: Select type */}
        <div><div className="text-sm font-semibold text-slate-200 mb-3">Step 1 — What are you importing?</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button onClick={()=>setImportType("history")} className={clx("p-5 rounded-xl border-2 text-left transition-all cursor-pointer",importType==="history"?"border-blue-500 bg-blue-500/10":"border-slate-600 hover:border-slate-500 bg-slate-900/50")}>
              <div className="text-lg mb-1">📜</div>
              <div className={clx("text-sm font-bold mb-1",importType==="history"?"text-blue-300":"text-slate-200")}>Transaction History</div>
              <div className="text-xs text-slate-400">Your tracker with past buys and sales. One-time setup.</div>
            </button>
            <button onClick={()=>setImportType("inventory")} className={clx("p-5 rounded-xl border-2 text-left transition-all cursor-pointer",importType==="inventory"?"border-blue-500 bg-blue-500/10":"border-slate-600 hover:border-slate-500 bg-slate-900/50")}>
              <div className="text-lg mb-1">🃏</div>
              <div className={clx("text-sm font-bold mb-1",importType==="inventory"?"text-blue-300":"text-slate-200")}>Active Inventory</div>
              <div className="text-xs text-slate-400">Card Ladder export. Sets your current holdings. One-time after history.</div>
            </button>
            <button onClick={()=>setImportType("refresh")} className={clx("p-5 rounded-xl border-2 text-left transition-all cursor-pointer",importType==="refresh"?"border-emerald-500 bg-emerald-500/10":"border-slate-600 hover:border-slate-500 bg-slate-900/50")}>
              <div className="text-lg mb-1">🔄</div>
              <div className={clx("text-sm font-bold mb-1",importType==="refresh"?"text-emerald-300":"text-slate-200")}>Update Market Values</div>
              <div className="text-xs text-slate-400">Fresh CL export — updates values, adds new cards, flags missing as possibly sold.</div>
            </button>
          </div>
        </div>

        {/* Step 2: Upload file — always visible */}
        <div><div className="text-sm font-semibold text-slate-200 mb-3">Step 2 — Upload your file</div>
          <label className="flex flex-col items-center gap-4 p-8 border-2 border-dashed border-slate-600 hover:border-blue-500 rounded-xl cursor-pointer transition-all hover:bg-blue-500/5">
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden"/>
            <div className="text-4xl">📂</div>
            <div className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-base transition-colors shadow-lg shadow-blue-500/20">Choose CSV File</div>
            <span className="text-xs text-slate-500">.csv files supported — export from Google Sheets, Card Ladder, or Excel</span>
          </label>
          {!importType&&<div className="text-xs text-amber-400 mt-2 text-center">Tip: Select an import type above for best results. Otherwise auto-detect will be used.</div>}
        </div>

        <Card className="p-4 bg-emerald-500/5 border-emerald-500/30"><div className="text-xs font-bold text-emerald-400 mb-2">First time? Recommended order:</div><div className="space-y-1 text-xs text-slate-300">
          <div>1. Upload your tracker sheet as <strong>Transaction History</strong> — records all past buys and sales</div>
          <div>2. Upload Card Ladder export as <strong>Active Inventory</strong> — sets your current holdings</div>
          <div>3. Future CL uploads refresh market values and flag sold cards</div>
        </div></Card>
      </Card>}

      {/* MAP STEP */}
      {/* ══ REFRESH REVIEW ══ */}
      {/* ══ REFRESH COLUMN VERIFY ══ */}
      {importWizard?.step==="refresh-map"&&<div className="space-y-5">
        <div>
          <h2 className="text-lg font-bold text-slate-200">Verify Column Mapping</h2>
          <p className="text-sm text-slate-400">{importWizard.rows?.length} cards in this export · Confirm the right columns are selected before updating</p>
        </div>

        {/* Show raw headers so user can see what CL exported */}
        <Card className="p-4 bg-slate-900/50">
          <div className="text-xs font-semibold text-slate-300 mb-2">Columns detected in your CL export:</div>
          <div className="flex flex-wrap gap-1">{importWizard.rawHeaders?.map(h=><span key={h} className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-mono">{h}</span>)}</div>
        </Card>

        {/* Just the 4 fields that matter for refresh */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            ["player","Player Name","Required for matching"],
            ["certNum","Cert / Serial Number","Key — used for exact matching"],
            ["year","Year","Used as fallback matching"],
            ["marketValue","Market Value / Current Value","The value being updated"],
            ["grade","Grade","PSA 10, BGS 9.5 etc. — needed for new cards"],
            ["buyDate","Purchase Date","Buy date — needed for new cards"],
          ].map(([field,label,hint])=>{
            const mapped=importWizard.mapping[field];
            const auto=mapped&&autoDetect(importWizard.rawHeaders)[field]===mapped;
            const isKey=field==="certNum";const isNew=field==="grade"||field==="buyDate";
            return <div key={field} className={clx("p-3 rounded-lg border",mapped?"border-slate-600 bg-slate-900/40":isKey?"border-red-500/40 bg-red-500/5":"border-amber-500/40 bg-amber-500/5")}>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={clx("text-xs font-semibold",mapped?"text-slate-200":isKey?"text-red-300":"text-amber-300")}>{label}</span>
                {auto&&<Badge color="green">auto</Badge>}
                {!mapped&&<Badge color={isKey?"red":"amber"}>not detected</Badge>}
                {isKey&&<Badge color="red">key</Badge>}
                {isNew&&!mapped&&<Badge color="amber">new cards only</Badge>}
              </div>
              <select value={mapped||""} onChange={e=>setImportWizard(w=>({...w,mapping:{...w.mapping,[field]:e.target.value||""}}))}
                className="bg-slate-900 border border-slate-600 text-slate-200 rounded px-2 py-1.5 text-xs w-full focus:outline-none focus:border-blue-500">
                <option value="">-- Not in this export --</option>
                {importWizard.rawHeaders?.map(h=><option key={h} value={h}>{h}</option>)}
              </select>
              <div className="text-xs text-slate-600 mt-1">{hint}</div>
            </div>;
          })}
        </div>

        {/* Row preview */}
        {importWizard.mapping.player&&<Card className="p-4">
          <div className="text-xs font-semibold text-slate-300 mb-2">First 5 rows — confirm cert # and value look correct:</div>
          <div className="overflow-x-auto"><table className="w-full text-xs">
            <thead><tr className="border-b border-slate-700 text-slate-400 uppercase">
              <th className="text-left px-2 py-1">Player</th><th className="text-left px-2 py-1">Year</th>
              <th className="text-left px-2 py-1">Cert #</th><th className="text-left px-2 py-1">Grade</th>
              <th className="text-left px-2 py-1">Buy Date</th><th className="text-right px-2 py-1">Market Value</th>
            </tr></thead>
            <tbody>{(importWizard.rows||[]).slice(0,5).map((row,i)=>{
              const get=(field)=>{const col=importWizard.mapping[field];if(!col)return"";const idx=importWizard.rawHeaders.indexOf(col);return idx>=0?(row[idx]||""):"";};
              return <tr key={i} className="border-b border-slate-700/40">
                <td className="px-2 py-1.5 text-slate-200">{get("player")||<span className="text-red-400">—</span>}</td>
                <td className="px-2 py-1.5 text-slate-400">{get("year")||"—"}</td>
                <td className={clx("px-2 py-1.5 font-mono",get("certNum")?"text-emerald-400":"text-amber-400 font-bold")}>{get("certNum")||"⚠ blank"}</td>
                <td className={clx("px-2 py-1.5",get("grade")?"text-purple-400":"text-slate-600")}>{get("grade")||"—"}</td>
                <td className={clx("px-2 py-1.5 font-mono",get("buyDate")?"text-slate-300":"text-amber-400")}>{get("buyDate")||"⚠ blank"}</td>
                <td className="px-2 py-1.5 text-right font-mono text-blue-400">{get("marketValue")||"—"}</td>
              </tr>;})}
            </tbody>
          </table></div>
          {!importWizard.mapping.certNum&&<div className="text-xs text-amber-400 mt-2">⚠️ Cert # not mapped — will match by Player+Year only</div>}
        </Card>}

        {/* Preview Matches button */}
        {importWizard.mapping.player&&importWizard.mapping.marketValue&&<div>
          <Btn variant="secondary" onClick={()=>{setRefreshPreview(null);const cards=buildCards(importWizard);previewRefreshMatches(cards);}}>🔍 Preview Matches</Btn>
        </div>}

        {/* Match preview results */}
        {refreshPreview&&<div className="space-y-4">
          <div className="flex gap-3 flex-wrap text-xs">
            <span className="text-emerald-400 font-semibold">{refreshPreview.certMatched.length} cert # matches</span>
            <span className="text-amber-400 font-semibold">{refreshPreview.nameMatched.length} name matches (raw/no cert)</span>
            {refreshPreview.unmatched.length>0&&<span className="text-red-400 font-semibold">{refreshPreview.unmatched.length} not found in inventory</span>}
          </div>

          {/* Cert # matched cards */}
          {refreshPreview.certMatched.length>0&&<Card className="p-4">
            <div className="text-xs font-semibold text-emerald-400 mb-2">Cert # Matches — {refreshPreview.certMatched.length} cards</div>
            <div className="overflow-x-auto max-h-52 overflow-y-auto"><table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-800"><tr className="border-b border-slate-700 text-slate-400 uppercase">
                <th className="text-left px-2 py-1">Cert #</th><th className="text-left px-2 py-1">CL: Player</th><th className="text-left px-2 py-1">Inventory: Player</th><th className="text-right px-2 py-1">New Value</th>
              </tr></thead>
              <tbody>{refreshPreview.certMatched.map((m,i)=><tr key={i} className="border-b border-slate-700/40">
                <td className="px-2 py-1.5 font-mono text-emerald-400">{m.inc.certNum||"—"}</td>
                <td className="px-2 py-1.5 text-slate-200">{m.inc.player} {m.inc.year}</td>
                <td className="px-2 py-1.5 text-slate-400">{m.ex.player} {m.ex.year}</td>
                <td className="px-2 py-1.5 text-right font-mono text-blue-400">{fmt$(m.mv)}</td>
              </tr>)}</tbody>
            </table></div>
          </Card>}

          {/* Raw / name matched — needs quick verify */}
          {refreshPreview.nameMatched.length>0&&<Card className="p-4 border-amber-500/40 bg-amber-500/5">
            <div className="text-xs font-semibold text-amber-400 mb-1">Raw Cards — Verify These Matches</div>
            <div className="text-xs text-slate-400 mb-3">No cert # available — matched by Player+Year. Confirm each is the right card.</div>
            <div className="space-y-2 max-h-52 overflow-y-auto">{refreshPreview.nameMatched.map((m,i)=>{
              const confirmed=dupResolutions["raw_"+i]!=="skip";
              return <div key={i} className={clx("p-3 rounded-lg border",confirmed?"border-slate-700 bg-slate-900":"border-red-500/30 bg-red-500/5")}>
                <div className="grid grid-cols-2 gap-3 text-xs mb-2">
                  <div><div className="text-slate-500 mb-1">From CL export:</div><div className="text-slate-200 font-medium">{m.inc.player} {m.inc.year}</div><div className="text-slate-400">{m.inc.set||m.inc.set_name}</div><div className="text-blue-400 font-mono">{fmt$(m.mv)}</div></div>
                  <div><div className="text-slate-500 mb-1">In your inventory:</div><div className="text-slate-200 font-medium">{m.ex.player} {m.ex.year}</div><div className="text-slate-400">{m.ex.set||m.ex.set_name}</div><div className="text-slate-400 font-mono">{fmt$(m.ex.marketValue||m.ex.market_value||m.ex.buyPrice||m.ex.buy_price)}</div></div>
                </div>
                <div className="flex gap-2">
                  <Btn size="sm" variant={confirmed?"success":"secondary"} onClick={()=>setDupResolutions(p=>({...p,["raw_"+i]:"confirm"}))}>✓ Same Card</Btn>
                  <Btn size="sm" variant={!confirmed?"danger":"ghost"} onClick={()=>setDupResolutions(p=>({...p,["raw_"+i]:"skip"}))}>✗ Different Card</Btn>
                </div>
              </div>;})}
            </div>
          </Card>}

          {/* Unmatched — in CL but not in inventory */}
          {refreshPreview.unmatched.length>0&&<Card className="p-3 border-slate-600">
            <div className="text-xs font-semibold text-slate-400 mb-2">{refreshPreview.unmatched.length} cards in CL not found in inventory — will be added as new</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">{refreshPreview.unmatched.map((c,i)=><div key={i} className="text-xs text-slate-400">{c.player} {c.year} {c.certNum?`· Cert: ${c.certNum}`:""}</div>)}</div>
          </Card>}
        </div>}

        <div className="flex gap-3 justify-end">
          <Btn variant="secondary" onClick={()=>{setImportWizard(null);setRefreshPreview(null);}}>Cancel</Btn>
          <Btn disabled={!importWizard.mapping.player||!importWizard.mapping.marketValue||!refreshPreview} onClick={()=>{
            // Build final card list respecting raw verify choices
            const cards=buildCards(importWizard);
            // Skip raw cards marked as "different"
            const skippedRawIdxs=new Set(refreshPreview.nameMatched.map((_,i)=>dupResolutions["raw_"+i]==="skip"?i:-1).filter(i=>i>=0));
            const confirmedNameMatched=refreshPreview.nameMatched.filter((_,i)=>!skippedRawIdxs.has(i));
            // Rebuild filtered cards for processRefresh
            const filteredCards=cards.filter(c=>{
              const incCert=String(c.certNum||"").trim().replace(/[^a-zA-Z0-9]/g,"");
              if(incCert)return true;// cert cards always included
              const nm=confirmedNameMatched.find(m=>(m.inc.player||"").trim().toLowerCase()===(c.player||"").trim().toLowerCase()&&String(m.inc.year||"").trim()===String(c.year||"").trim());
              return!!nm;
            });
            setRefreshPreview(null);
            processRefresh(filteredCards);
          }}>Run Update</Btn>
        </div>
      </div>}

      {importWizard?.step==="refresh-review"&&<div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div><h2 className="text-lg font-bold text-slate-200">Market Values Updated</h2>
          <p className="text-sm text-slate-400">{importWizard.matched} of {importWizard.debugInfo?.active||"?"} cards refreshed · {importWizard.debugInfo?.incoming||"?"} in CL export</p>
        </div>
          <Badge color="green">{importWizard.matched} updated</Badge>
        </div>

        {/* Missing cards — not in CL export, not yet sold */}
        {importWizard.missing?.length>0&&<Card className="p-4 border-amber-500/40 bg-amber-500/5">
          <div className="text-sm font-bold text-amber-400 mb-1">{importWizard.missing.length} cards not in this CL export</div>
          <div className="text-xs text-slate-400 mb-3">These were active in your inventory but did not appear in the upload. Mark any you have sold — or keep active if you still have them.</div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {importWizard.missing.map(c=>{
              const res=dupResolutions["miss_"+c.id]||"keep";
              return <div key={c.id} className="flex items-center justify-between gap-3 p-3 bg-slate-900 rounded-lg">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-200 font-medium truncate">{c.player} {c.year} {c.grade||c.grade||"Raw"}</div>
                  <div className="text-xs text-slate-500">{c.set||c.set_name} · Cert: {c.certNum||c.cert_num||"—"} · Cost: {fmt$(c.buyPrice||c.buy_price)}</div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Btn size="sm" variant={res==="sold"?"amber":"ghost"} onClick={()=>setDupResolutions(p=>({...p,["miss_"+c.id]:"sold"}))}>Sold</Btn>
                  <Btn size="sm" variant={res==="keep"?"primary":"ghost"} onClick={()=>setDupResolutions(p=>({...p,["miss_"+c.id]:"keep"}))}>Still Have</Btn>
                </div>
              </div>;
            })}
          </div>
          <div className="flex gap-4 mt-3 text-xs">
            <button onClick={()=>{const u={};importWizard.missing.forEach(c=>{u["miss_"+c.id]="sold";});setDupResolutions(p=>({...p,...u}));}} className="text-amber-400 hover:text-amber-300 cursor-pointer">Mark all as Sold</button>
            <button onClick={()=>{const u={};importWizard.missing.forEach(c=>{u["miss_"+c.id]="keep";});setDupResolutions(p=>({...p,...u}));}} className="text-slate-400 hover:text-slate-300 cursor-pointer">Keep all active</button>
          </div>
        </Card>}

        {/* New cards — in CL but not in inventory */}
        {importWizard.newCards?.length>0&&<Card className="p-4 border-blue-500/40 bg-blue-500/5">
          <div className="text-sm font-bold text-blue-300 mb-1">{importWizard.newCards.length} new cards in CL not in your inventory</div>
          <div className="text-xs text-slate-400 mb-3">These appear in your CL export but are not in your inventory. Review and confirm to add them.</div>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-800"><tr className="border-b border-slate-700 text-slate-400 uppercase">
                <th className="text-left px-2 py-2">Player</th><th className="text-left px-2 py-2">Year</th><th className="text-left px-2 py-2">Grade</th><th className="text-left px-2 py-2">Cert #</th><th className="text-right px-2 py-2">Value</th>
              </tr></thead>
              <tbody>{importWizard.newCards.map((c,i)=><tr key={i} className="border-b border-slate-700/50">
                <td className="px-2 py-2 text-slate-200 font-medium">{c.player}</td>
                <td className="px-2 py-2 text-slate-400">{c.year}</td>
                <td className="px-2 py-2">{c.grade?<Badge color="purple">{c.grade}</Badge>:<span className="text-slate-600">Raw</span>}</td>
                <td className="px-2 py-2 font-mono text-slate-400">{c.certNum||"—"}</td>
                <td className="px-2 py-2 text-right font-mono text-blue-400">{fmt$(c.marketValue||c.buyPrice)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </Card>}

        {importWizard.missing?.length===0&&importWizard.newCards?.length===0&&<Card className="p-4 border-emerald-500/40 bg-emerald-500/5 text-center"><div className="text-sm text-emerald-400 font-semibold">All clear — inventory matches CL export perfectly</div></Card>}

        <div className="flex gap-3 justify-end">
          <Btn variant="secondary" onClick={()=>setImportWizard(null)}>Cancel</Btn>
          <Btn variant="success" onClick={()=>{
            // Apply sold flags
            const soldIds=importWizard.missing?.filter(c=>dupResolutions["miss_"+c.id]==="sold").map(c=>c.id)||[];
            if(soldIds.length>0)setInventory(p=>p.map(c=>soldIds.includes(c.id)?{...c,status:"Sold",notes:(c.notes?c.notes+" | ":"")+"Marked sold from CL refresh"}:c));
            // Add new cards
            if(importWizard.newCards?.length>0){
              const toAdd=importWizard.newCards.map(c=>{const{_sale,...cl}=c;return cl;});
              setInventory(p=>[...p,...toAdd]);
              const purchaseTxs=toAdd.map(makePurchaseTx).filter(Boolean);
              if(purchaseTxs.length)setTransactions(p=>[...p,...purchaseTxs]);
            }
            setImportWizard({step:"done",count:importWizard.newCards?.length||0,updated:importWizard.matched,soldPending:soldIds.length,txCount:0,mode:"refresh"});
          }}>Confirm & Finish</Btn>
        </div>
      </div>}

      {importWizard?.step==="map"&&<div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap"><div><h2 className="text-lg font-bold text-slate-200">Map Columns</h2><p className="text-sm text-slate-400">{importWizard.rows.length} rows · {importWizard.rawHeaders.length} columns</p></div><Btn variant="secondary" size="sm" onClick={()=>setImportWizard(null)}>Back</Btn></div>
        {Object.values(importWizard.mapping).filter(Boolean).length>0&&<Card className="p-3 border-emerald-500/40 bg-emerald-500/5"><div className="text-xs text-emerald-400 font-semibold">{Object.values(importWizard.mapping).filter(Boolean).length} columns auto-detected</div></Card>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{IMPORT_FIELDS.map(([field,label,hint,req,important])=>{
          const mapped=importWizard.mapping[field];const auto=autoDetect(importWizard.rawHeaders)[field]===mapped&&mapped;
          return <div key={field} className={clx("p-3 rounded-lg border",mapped?"border-slate-600 bg-slate-900/40":"border-slate-700/50 bg-slate-900/20")}>
            <div className="flex items-center gap-2 mb-2"><span className={clx("text-xs font-semibold",mapped?"text-slate-200":"text-slate-500")}>{label}</span>{auto&&<Badge color="green">auto</Badge>}{req&&<Badge color="red">required</Badge>}{important&&<Badge color="amber">important</Badge>}</div>
            <select value={mapped||""} onChange={e=>setImportWizard(w=>({...w,mapping:{...w.mapping,[field]:e.target.value||""}}))} className="bg-slate-900 border border-slate-600 text-slate-200 rounded px-2 py-1.5 text-xs w-full focus:outline-none focus:border-blue-500"><option value="">-- Not in sheet --</option>{importWizard.rawHeaders.map(h=><option key={h} value={h}>{h}</option>)}</select>
            <div className="text-xs text-slate-600 mt-1">{hint}</div>
          </div>;})}
        </div>
        <Card className="p-4 space-y-3"><div className="text-sm font-semibold text-slate-200">Merge Mode</div><div className="flex gap-3 flex-wrap">{[["smart","Smart Merge","Updates matches, skips dupes, adds new (recommended)"],["append","Add All","Every row becomes a new card"],["replace","Replace All","Clears inventory first"]].map(([mode,label,sub])=><button key={mode} onClick={()=>setImportWizard(w=>({...w,mergeMode:mode}))} className={clx("flex-1 p-3 rounded-lg border text-left cursor-pointer min-w-40",importWizard.mergeMode===mode?"border-blue-500/50 bg-blue-500/10":"border-slate-700 hover:border-slate-600")}><div className={clx("text-sm font-medium",importWizard.mergeMode===mode?"text-blue-300":"text-slate-300")}>{label}</div><div className="text-xs text-slate-500 mt-0.5">{sub}</div></button>)}</div></Card>
        <div className="flex gap-3 justify-end"><Btn variant="secondary" onClick={()=>setImportWizard(null)}>Cancel</Btn><Btn disabled={!importWizard.mapping.player} onClick={()=>{const cards=buildCards(importWizard);setImportWizard(w=>({...w,step:"preview",preview:cards}));setDupResolutions({});}}>Preview</Btn></div>
      </div>}

      {/* PREVIEW STEP */}
      {importWizard?.step==="preview"&&<div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap"><div><h2 className="text-lg font-bold text-slate-200">Preview Import</h2><p className="text-sm text-slate-400">{importWizard.preview?.length} cards ready</p></div><Btn variant="secondary" size="sm" onClick={()=>setImportWizard(w=>({...w,step:"map"}))}>Edit Mapping</Btn></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3 text-center"><div className="text-xs text-slate-400">Cards</div><div className="text-2xl font-bold text-blue-400">{importWizard.preview?.length}</div></Card>
          <Card className="p-3 text-center"><div className="text-xs text-slate-400">With Cert #</div><div className="text-2xl font-bold text-emerald-400">{importWizard.preview?.filter(c=>c.certNum).length}</div></Card>
          <Card className="p-3 text-center"><div className="text-xs text-slate-400">Sold</div><div className="text-2xl font-bold text-purple-400">{importWizard.preview?.filter(c=>c._sale).length}</div></Card>
          <Card className="p-3 text-center"><div className="text-xs text-slate-400">Total Cost</div><div className="text-lg font-bold text-white font-mono">{fmt$(importWizard.preview?.reduce((s,c)=>s+c.buyPrice,0))}</div></Card>
        </div>
        {/* Smart merge analysis */}
        {previewAnalysis&&<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3 text-center border-emerald-500/40"><div className="text-2xl font-bold text-emerald-400">{previewAnalysis.counts.added}</div><div className="text-xs text-slate-400">New</div></Card>
          <Card className="p-3 text-center border-blue-500/40"><div className="text-2xl font-bold text-blue-400">{previewAnalysis.counts.updated}</div><div className="text-xs text-slate-400">Update</div></Card>
          <Card className="p-3 text-center"><div className="text-2xl font-bold text-slate-400">{previewAnalysis.counts.skipped}</div><div className="text-xs text-slate-400">Skip</div></Card>
          {previewAnalysis.counts.archived>0&&<Card className="p-3 text-center border-amber-500/40"><div className="text-2xl font-bold text-amber-400">{previewAnalysis.counts.archived}</div><div className="text-xs text-slate-400">Missing</div></Card>}
        </div>}
        {/* Missing cards — possibly sold */}
        {previewAnalysis&&previewAnalysis.toArchive.length>0&&<Card className="p-4 border-amber-500/40 bg-amber-500/5">
          <div className="text-sm font-bold text-amber-400 mb-2">{previewAnalysis.toArchive.length} cards no longer in inventory</div>
          <div className="text-xs text-slate-400 mb-3">May have been sold. Mark each one below.</div>
          <div className="space-y-2 max-h-64 overflow-y-auto">{previewAnalysis.toArchive.map(c=>{const res=dupResolutions["ar_"+c.id]||"sold";return <div key={c.id} className="flex items-center justify-between gap-3 p-2 bg-slate-900 rounded-lg"><div className="flex-1 min-w-0"><div className="text-sm text-slate-200 truncate">{c.player} {c.year} {c.grade||"Raw"}</div><div className="text-xs text-slate-500">Cert: {c.certNum||"—"} · Cost: {fmt$(c.buyPrice)}</div></div><div className="flex gap-1 flex-shrink-0"><Btn size="sm" variant={res==="sold"?"amber":"ghost"} onClick={()=>setDupResolutions(p=>({...p,["ar_"+c.id]:"sold"}))}>Sold</Btn><Btn size="sm" variant={res==="archive"?"secondary":"ghost"} onClick={()=>setDupResolutions(p=>({...p,["ar_"+c.id]:"archive"}))}>Archive</Btn><Btn size="sm" variant={res==="keep"?"primary":"ghost"} onClick={()=>setDupResolutions(p=>({...p,["ar_"+c.id]:"keep"}))}>Still Have</Btn></div></div>;})}</div>
          <div className="flex gap-3 mt-3 text-xs"><button onClick={()=>{const u={};previewAnalysis.toArchive.forEach(c=>{u["ar_"+c.id]="sold";});setDupResolutions(p=>({...p,...u}));}} className="text-amber-400 cursor-pointer">All Sold</button><button onClick={()=>{const u={};previewAnalysis.toArchive.forEach(c=>{u["ar_"+c.id]="archive";});setDupResolutions(p=>({...p,...u}));}} className="text-slate-400 cursor-pointer">All Archive</button><button onClick={()=>{const u={};previewAnalysis.toArchive.forEach(c=>{u["ar_"+c.id]="keep";});setDupResolutions(p=>({...p,...u}));}} className="text-blue-400 cursor-pointer">All Keep</button></div>
        </Card>}
        {/* Duplicate resolution */}
        {previewAnalysis&&previewAnalysis.duplicates.length>0&&<div className="space-y-3">
          <Card className="p-4 border-blue-500/40 bg-blue-500/5"><div className="flex items-center justify-between mb-2 flex-wrap gap-2"><div><div className="text-sm font-bold text-blue-300">{previewAnalysis.duplicates.length} Potential Duplicates</div><div className="text-xs text-slate-400">Cert # is used first. Same cert = same card. Different cert = different card.</div></div><div className="flex gap-2 flex-wrap"><Btn size="sm" variant="secondary" onClick={()=>resolveAllDups("existing")}>Keep Existing</Btn><Btn size="sm" variant="primary" onClick={()=>resolveAllDups("incoming")}>Use Incoming</Btn><Btn size="sm" variant="success" onClick={()=>resolveAllDups("merge")}>Merge</Btn><Btn size="sm" variant="amber" onClick={()=>resolveAllDups("both")}>All Different</Btn></div></div></Card>
          {previewAnalysis.duplicates.map(d=>{const res=dupResolutions[d.incoming.id]||"";const ex=d.existing;const inc=d.incoming;return <Card key={d.incoming.id} className={clx("p-4",res==="both"?"border-orange-500/40":res==="existing"?"border-slate-600":res==="incoming"?"border-blue-500/40":res==="merge"?"border-emerald-500/40":"border-amber-500/40")}>
            <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><span className="font-bold text-slate-100">{ex.player}</span><Badge color="purple">{d.reason}</Badge></div>{res&&<Badge color={res==="both"?"orange":res==="existing"?"gray":res==="incoming"?"blue":"green"}>{res==="both"?"keep both":res}</Badge>}</div>
            {ex.certNum!==inc.certNum&&ex.certNum&&inc.certNum&&<div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-300 mb-2">Different cert numbers ({ex.certNum} vs {inc.certNum}) — likely separate cards</div>}
            <div className="grid grid-cols-2 gap-3 text-xs mb-3">
              <div className={clx("p-3 rounded-lg border",res==="existing"?"border-emerald-500/40 bg-emerald-500/5":"border-slate-700 bg-slate-900/50")}><div className="font-semibold text-slate-300 mb-2">Existing</div><div className="space-y-1">{[["Player",ex.player],["Year",ex.year],["Set",ex.set],["Grade",ex.grade||"Raw"],["Cert #",ex.certNum||"—"],["Cost",fmt$(ex.buyPrice)],["Market",fmt$(ex.marketValue)],["Status",ex.status]].map(([k,v])=><div key={k} className="flex justify-between"><span className="text-slate-500">{k}</span><span className="text-slate-200">{v}</span></div>)}</div></div>
              <div className={clx("p-3 rounded-lg border",res==="incoming"?"border-blue-500/40 bg-blue-500/5":"border-slate-700 bg-slate-900/50")}><div className="font-semibold text-slate-300 mb-2">Incoming</div><div className="space-y-1">{[["Player",inc.player],["Year",inc.year],["Set",inc.set],["Grade",inc.grade||"Raw"],["Cert #",inc.certNum||"—"],["Cost",fmt$(inc.buyPrice)],["Market",fmt$(inc.marketValue)],["Status",inc.status]].map(([k,v])=><div key={k} className="flex justify-between"><span className="text-slate-500">{k}</span><span className="text-slate-200">{v}</span></div>)}</div></div>
            </div>
            <div className="flex gap-2 flex-wrap"><Btn size="sm" variant={res==="both"?"amber":"secondary"} onClick={()=>resolveDup(inc.id,"both")}>Both Different</Btn><Btn size="sm" variant={res==="existing"?"primary":"secondary"} onClick={()=>resolveDup(inc.id,"existing")}>Keep Existing</Btn><Btn size="sm" variant={res==="incoming"?"primary":"secondary"} onClick={()=>resolveDup(inc.id,"incoming")}>Use Incoming</Btn><Btn size="sm" variant={res==="merge"?"success":"secondary"} onClick={()=>resolveDup(inc.id,"merge")}>Merge</Btn></div>
          </Card>;})}
        </div>}
        {/* Warnings */}
        {importWizard.preview?.filter(c=>c.grade&&!c.certNum).length>0&&<Card className="p-3 border-amber-500/40 bg-amber-500/5"><div className="text-xs text-amber-400 font-semibold">{importWizard.preview.filter(c=>c.grade&&!c.certNum).length} graded cards missing cert # — go back and check mapping</div></Card>}
        {importWizard.preview?.filter(c=>!c.buyPrice).length>0&&<Card className="p-3 border-amber-500/40 bg-amber-500/5"><div className="text-xs text-amber-400 font-semibold">{importWizard.preview.filter(c=>!c.buyPrice).length} cards missing cost — will import with $0 basis</div></Card>}
        {/* Preview table */}
        <Card><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-slate-700 text-slate-400 uppercase"><th className="text-left px-3 py-2">#</th><th className="text-left px-3 py-2">Player</th><th className="text-left px-3 py-2">Year</th><th className="text-left px-3 py-2">Grade</th><th className="text-left px-3 py-2">Cert #</th><th className="text-right px-3 py-2">Cost</th><th className="text-right px-3 py-2">Value</th><th className="text-left px-3 py-2">Status</th></tr></thead><tbody>
          {(importWizard.preview||[]).slice(0,25).map((c,i)=><tr key={i} className="border-b border-slate-700/50"><td className="px-3 py-2 text-slate-500 font-mono">{i+1}</td><td className="px-3 py-2 text-slate-200 font-medium max-w-40 truncate"><span>{c.player}</span>{previewAnalysis&&<span className="ml-1"><Badge color={({new:"green",update:"blue",skip:"gray"})[previewAnalysis.actions.get(c.id)]||"gray"}>{previewAnalysis.actions.get(c.id)||"—"}</Badge></span>}</td><td className="px-3 py-2 text-slate-400">{c.year}</td><td className="px-3 py-2">{c.grade?<Badge color="purple">{c.grade}</Badge>:<span className="text-slate-600">Raw</span>}</td><td className="px-3 py-2 font-mono text-slate-400">{c.certNum||"—"}</td><td className={clx("px-3 py-2 text-right font-mono",c.buyPrice>0?"text-slate-200":"text-red-400/60")}>{c.buyPrice>0?fmt$(c.buyPrice):"—"}</td><td className="px-3 py-2 text-right font-mono text-blue-400">{fmt$(c.marketValue||c.buyPrice)}</td><td className="px-3 py-2"><StatusBadge status={c.status}/></td></tr>)}
          {(importWizard.preview?.length||0)>25&&<tr><td colSpan={8} className="px-3 py-2 text-center text-slate-500">+{importWizard.preview.length-25} more</td></tr>}
        </tbody></table></div></Card>
        {/* Commit */}
        <div className="flex gap-3 justify-end"><Btn variant="secondary" onClick={()=>setImportWizard(null)}>Cancel</Btn>
          <Btn variant="success" onClick={()=>{
            const preview=importWizard.preview||[];
            if(importWizard.mergeMode==="smart"){
              const a=analyzeImport(preview,importWizard.importType||"auto");
              const bothIds=new Set(a.duplicates.filter(d=>dupResolutions[d.incoming.id]==="both").map(d=>d.incoming.id));
              const newCards=[...preview.filter(c=>a.actions.get(c.id)==="new"),...preview.filter(c=>bothIds.has(c.id))];
              // Sale txs: ALL cards with sale data (regardless of dedup result)
              const saleTxs=preview.filter(c=>c._sale).map(makeSaleTx);
              // Purchase txs for history import: ALL cards get a purchase record
              // For inventory import: only new cards
              const effImpType=importWizard.importType||"auto";
              const purchaseSources=effImpType==="history"?preview:newCards;
              const purchaseTxs=purchaseSources.map(makePurchaseTx).filter(Boolean);
              // Avoid duplicate purchase txs — check if one already exists for this card
              const existingPurchaseDates=new Set(transactions.filter(t=>t.type==="purchase").map(t=>t.player+"_"+t.date));
              const dedupedPurchaseTxs=purchaseTxs.filter(t=>!existingPurchaseDates.has(t.player+"_"+t.date));
              const txs=[...saleTxs,...dedupedPurchaseTxs];
              setInventory(p=>{const merged=p.map(ex=>{
                const archiveMatch=a.toArchive.find(ar=>ar.id===ex.id);
                if(archiveMatch){const r=dupResolutions["ar_"+ex.id]||"sold";if(r==="keep")return ex;if(r==="archive")return{...ex,status:"Archived"};return{...ex,status:"Sold",notes:(ex.notes?ex.notes+" | ":"")+"Marked sold from import"};}
                const dup=a.duplicates.find(d=>d.existing.id===ex.id);
                if(dup){const r=dupResolutions[dup.incoming.id]||"existing";const inc=dup.incoming;
                  if(r==="both"||r==="existing")return ex;
                  if(r==="incoming")return{...ex,player:inc.player,year:inc.year||ex.year,set:inc.set||ex.set,grade:inc.grade||ex.grade,certNum:inc.certNum||ex.certNum,condition:(inc.grade||inc.certNum||ex.grade||ex.certNum)?"Graded":ex.condition,buyPrice:+inc.buyPrice||ex.buyPrice,marketValue:+inc.marketValue||ex.marketValue,status:inc.status==="Archived"?ex.status:inc.status,notes:inc.notes||ex.notes};
                  if(r==="merge")return{...ex,player:inc.player||ex.player,set:inc.set||ex.set,grade:inc.grade||ex.grade,certNum:inc.certNum||ex.certNum,condition:(inc.grade||inc.certNum||ex.grade||ex.certNum)?"Graded":ex.condition,marketValue:Math.max(+inc.marketValue||0,+ex.marketValue||0),buyDate:ex.buyDate||inc.buyDate,buyPlatform:ex.buyPlatform||inc.buyPlatform,status:ex.status==="Archived"?(inc.status||"For Sale"):ex.status,notes:[ex.notes,inc.notes].filter(Boolean).join(" | ")};
                }return ex;});return[...merged,...newCards.map(c=>{const{_sale,...cl}=c;return cl;})];});
              if(txs.length)setTransactions(p=>[...p,...txs]);
              const soldPending=a.toArchive.filter(c=>(dupResolutions["ar_"+c.id]||"sold")==="sold").length;
              setImportWizard({step:"done",count:newCards.length,updated:a.counts.updated,skipped:a.counts.skipped,archived:a.counts.archived,txCount:txs.length,soldPending,mode:"smart"});
            }else{const cards=preview.map(c=>{const{_sale,...cl}=c;return cl;});const saleTxs=preview.filter(c=>c._sale).map(makeSaleTx);const purchaseTxs=cards.map(makePurchaseTx).filter(Boolean);const txs=[...saleTxs,...purchaseTxs];
              if(importWizard.mergeMode==="replace"){setInventory(cards);if(txs.length)setTransactions(txs);}
              else{setInventory(p=>[...p,...cards]);if(txs.length)setTransactions(p=>[...p,...txs]);}
              setImportWizard({step:"done",count:cards.length,txCount:txs.length,mode:importWizard.mergeMode});
            }
          }}>Import {importWizard.preview?.length} Cards</Btn>
        </div>
      </div>}

      {/* DONE */}
      {importWizard?.step==="done"&&<Card className="p-10 text-center space-y-4">
        <div className="text-6xl">🎉</div><h2 className="text-2xl font-bold text-slate-100">Import Complete</h2>
        <p className="text-slate-400">{importWizard.count} new cards added.{importWizard.updated>0&&` ${importWizard.updated} refreshed.`}{importWizard.skipped>0&&` ${importWizard.skipped} dupes skipped.`}{importWizard.archived>0&&` ${importWizard.archived} archived/sold.`}{importWizard.txCount>0&&` ${importWizard.txCount} sale transactions created.`}</p>
        {importWizard.soldPending>0&&<div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300">{importWizard.soldPending} cards marked sold — go to Inventory to enter sale details.</div>}
        <div className="flex gap-3 justify-center"><Btn onClick={()=>setImportWizard(null)}>Import Another</Btn><Btn variant="secondary" onClick={()=>setActiveTool("watchlist")}>Done</Btn></div>
      </Card>}
    </div>}

    {/* ════ WATCHLIST ════ */}
    {activeTool==="watchlist"&&<div className="space-y-4">
      <Card className="p-4"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Input label="Player" value={wf.player} onChange={v=>setWf(p=>({...p,player:v}))}/><Input label="Set" value={wf.set} onChange={v=>setWf(p=>({...p,set:v}))}/><Input label="Target ($)" value={wf.targetPrice} onChange={v=>setWf(p=>({...p,targetPrice:v}))} type="number"/><Input label="Notes" value={wf.notes} onChange={v=>setWf(p=>({...p,notes:v}))}/></div><Btn className="mt-3" onClick={()=>{if(!wf.player)return;setWatchlist(p=>[...p,{...wf,id:uid(),added:today()}]);setWf({player:"",set:"",targetPrice:"",notes:""});}}>+ Add</Btn></Card>
      {watchlist.length===0&&<div className="text-slate-500 text-sm text-center py-6">Watch list empty</div>}
      {watchlist.map(w=><Card key={w.id} className="p-3 flex items-center justify-between gap-3"><div><div className="font-medium text-slate-200">{w.player}</div><div className="text-xs text-slate-400">{w.set}{w.notes&&` · ${w.notes}`}</div></div><div className="flex items-center gap-3">{w.targetPrice&&<span className="font-mono text-emerald-400">{fmt$(w.targetPrice)}</span>}<button onClick={()=>setWatchlist(p=>p.filter(x=>x.id!==w.id))} className="text-red-400 text-sm cursor-pointer">×</button></div></Card>)}
    </div>}

    {/* ════ OFFERS ════ */}
    {activeTool==="offers"&&<div className="space-y-4">
      <Card className="p-4"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Input label="Player" value={of.player} onChange={v=>setOf(p=>({...p,player:v}))}/><Input label="Platform" value={of.platform} onChange={v=>setOf(p=>({...p,platform:v}))} options={PLATFORMS}/><Input label="Asking ($)" value={of.askingPrice} onChange={v=>setOf(p=>({...p,askingPrice:v}))} type="number"/><Input label="Your Offer ($)" value={of.offerPrice} onChange={v=>setOf(p=>({...p,offerPrice:v}))} type="number"/><Input label="Date" value={of.date} onChange={v=>setOf(p=>({...p,date:v}))} type="date"/><Input label="Expiry" value={of.expiry} onChange={v=>setOf(p=>({...p,expiry:v}))} type="date"/><Input label="Status" value={of.status} onChange={v=>setOf(p=>({...p,status:v}))} options={OFFER_STATUSES}/><Input label="Notes" value={of.notes} onChange={v=>setOf(p=>({...p,notes:v}))}/></div><Btn className="mt-3" onClick={()=>{if(!of.player||!of.offerPrice)return;setOffers(p=>[...p,{...of,id:uid(),askingPrice:+of.askingPrice,offerPrice:+of.offerPrice}]);setOf({player:"",platform:"eBay",offerPrice:"",askingPrice:"",date:today(),expiry:"",notes:"",status:"Pending"});}}>+ Log Offer</Btn></Card>
      {offers.sort((a,b)=>b.date>a.date?1:-1).map(o=>{const pct=o.askingPrice?((o.askingPrice-o.offerPrice)/o.askingPrice*100):0;return <Card key={o.id} className="p-3"><div className="flex items-start justify-between gap-3"><div className="flex-1"><div className="flex items-center gap-2 flex-wrap"><span className="font-medium text-slate-200">{o.player}</span><Badge color={{Pending:"amber",Accepted:"green",Declined:"red",Expired:"gray",Countered:"purple"}[o.status]||"gray"}>{o.status}</Badge></div><div className="text-xs text-slate-400 mt-1">{o.date}{o.expiry&&` · Exp ${o.expiry}`}</div></div><div className="text-right"><div className="font-mono font-bold text-blue-400">{fmt$(o.offerPrice)}</div>{pct>0&&<div className="text-xs text-emerald-400">{pct.toFixed(0)}% below</div>}</div></div><div className="flex gap-2 mt-2 flex-wrap">{OFFER_STATUSES.filter(s=>s!==o.status).map(s=><button key={s} onClick={()=>setOffers(p=>p.map(x=>x.id===o.id?{...x,status:s}:x))} className="text-xs px-2 py-1 rounded border border-slate-600 text-slate-400 hover:bg-slate-700 cursor-pointer">{s}</button>)}<button onClick={()=>setOffers(p=>p.filter(x=>x.id!==o.id))} className="text-xs px-2 py-1 text-slate-500 hover:text-red-400 cursor-pointer ml-auto">×</button></div></Card>;})}
    </div>}

    {activeTool==="roi"&&<Card className="p-5"><h2 className="text-base font-bold text-slate-200 mb-5">Grading ROI Calculator</h2><GradingROICalc/></Card>}

    {activeTool==="sets"&&<div className="space-y-4">
      <Card className="p-4"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Input label="Set Name" value={sf.name} onChange={v=>setSf(p=>({...p,name:v}))}/><Input label="Total Cards" value={sf.totalCards} onChange={v=>setSf(p=>({...p,totalCards:v}))} type="number"/></div><Btn className="mt-3" onClick={()=>{if(!sf.name||!sf.totalCards)return;setSets(p=>[...p,{...sf,id:uid(),owned:[]}]);setSf({name:"",totalCards:""});}}>Create Set</Btn></Card>
      {sets.map(set=>{const pct=Math.round((set.owned?.length||0)/+set.totalCards*100);return <Card key={set.id} className="p-4"><div className="flex items-center justify-between mb-2"><span className="font-medium text-slate-200">{set.name}</span><Badge color={pct===100?"green":"blue"}>{set.owned?.length||0}/{set.totalCards}</Badge></div><div className="w-full bg-slate-700 rounded-full h-2 mb-3"><div className="bg-blue-500 h-2 rounded-full" style={{width:`${pct}%`}}/></div><div className="flex gap-2"><Btn size="sm" variant="success" onClick={()=>setSets(p=>p.map(s=>s.id===set.id?{...s,owned:[...(s.owned||[]),uid()]}:s))}>+1</Btn><Btn size="sm" variant="secondary" onClick={()=>setSets(p=>p.map(s=>s.id===set.id?{...s,owned:(s.owned||[]).slice(0,-1)}:s))}>-1</Btn><Btn size="sm" variant="danger" onClick={()=>setSets(p=>p.filter(x=>x.id!==set.id))}>Remove</Btn></div></Card>;})}
    </div>}

    {activeTool==="consignment"&&<div className="space-y-4">
      <Card className="p-4"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div className="sm:col-span-2"><label className="flex flex-col gap-1"><span className="text-xs text-slate-400">Card</span><select value={cf.cardId} onChange={e=>setCf(p=>({...p,cardId:e.target.value}))} className="bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm"><option value="">-- Select --</option>{inventory.filter(c=>isActive(c.status)).map(c=><option key={c.id} value={c.id}>{c.player} {c.year} {c.grade||"Raw"}</option>)}</select></label></div><Input label="Location" value={cf.location} onChange={v=>setCf(p=>({...p,location:v}))}/><Input label="Your Split (%)" value={cf.splitPct} onChange={v=>setCf(p=>({...p,splitPct:v}))} type="number"/></div><Btn className="mt-3" onClick={()=>{if(!cf.location)return;setConsignment(p=>[...p,{...cf,id:uid(),date:today()}]);setCf({cardId:"",location:"",splitPct:"",consignor:""});}}>Add</Btn></Card>
      {consignment.map(c=>{const card=inventory.find(x=>x.id===c.cardId);return <Card key={c.id} className="p-3 flex items-center justify-between"><div><div className="font-medium text-slate-200">{card?`${card.player} ${card.year}`:c.location}</div><div className="text-xs text-slate-400">{c.location} · {c.splitPct}% cut</div></div><button onClick={()=>setConsignment(p=>p.filter(x=>x.id!==c.id))} className="text-red-400 text-sm cursor-pointer">×</button></Card>;})}
    </div>}

    {activeTool==="insurance"&&<Card className="p-5"><h2 className="text-base font-bold text-slate-200 mb-2">Insurance Summary</h2><p className="text-sm text-slate-400 mb-4">Generated {today()}</p><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-700 text-slate-400 text-xs"><th className="text-left px-3 py-2">#</th><th className="text-left px-3 py-2">Player</th><th className="text-left px-3 py-2">Year/Set</th><th className="text-left px-3 py-2">Grade</th><th className="text-left px-3 py-2">Cert #</th><th className="text-right px-3 py-2">Value</th></tr></thead><tbody>{inventory.filter(c=>isActive(c.status)).map((c,i)=><tr key={c.id} className="border-b border-slate-700/50"><td className="px-3 py-2 text-slate-500 font-mono text-xs">{i+1}</td><td className="px-3 py-2 text-slate-200">{c.player}</td><td className="px-3 py-2 text-slate-400 text-xs">{c.year} {c.set}</td><td className="px-3 py-2"><Badge color="gray">{c.grade||"Raw"}</Badge></td><td className="px-3 py-2 font-mono text-xs text-slate-400">{c.certNum||"—"}</td><td className="px-3 py-2 text-right font-mono text-blue-400">{fmt$(c.marketValue||c.buyPrice)}</td></tr>)}</tbody><tfoot><tr className="border-t border-slate-600"><td colSpan={5} className="px-3 py-3 font-bold text-slate-200">Total</td><td className="px-3 py-3 text-right font-mono font-bold text-blue-400">{fmt$(inventory.filter(c=>isActive(c.status)).reduce((s,c)=>s+(+c.marketValue||+c.buyPrice),0))}</td></tr></tfoot></table></div></Card>}

    {activeTool==="data"&&<DataMgmt setInventory={setInventory} setTransactions={setTransactions} setExpenses={setExpenses} setSnapshots={setSnapshots} setJournal={setJournal} setOffers={setOffers} setWatchlist={setWatchlist} setSets={setSets} setConsignment={setConsignment} counts={{inv:inventory.length,tx:transactions.length,exp:expenses.length,allInv:inventory,allTx:transactions}}/>}
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOURNAL TAB
// ═══════════════════════════════════════════════════════════════════════════════
function JournalTab({journal,setJournal}){
  const[modal,setModal]=useState(null);const[search,setSearch]=useState("");const[filterTag,setFilterTag]=useState("");
  const[jf,setJf]=useState({title:"",body:"",tag:"General",date:today()});
  const tagColors={"General":"gray","Show Notes":"amber","Market Obs":"blue","Weekly Review":"green","Deal Analysis":"purple","Grading Notes":"orange"};
  const filtered=useMemo(()=>{let r=[...journal];if(search)r=r.filter(e=>[e.title,e.body].join(" ").toLowerCase().includes(search.toLowerCase()));if(filterTag)r=r.filter(e=>e.tag===filterTag);return r.sort((a,b)=>b.date>a.date?1:-1);},[journal,search,filterTag]);
  const save=()=>{if(!jf.title.trim())return;const entry={...jf,id:jf.id||uid()};setJournal(prev=>prev.find(e=>e.id===entry.id)?prev.map(e=>e.id===entry.id?entry:e):[...prev,entry]);setModal(null);setJf({title:"",body:"",tag:"General",date:today()});};
  return(<div className="space-y-5">
    <div className="flex items-center justify-between flex-wrap gap-3"><h1 className="text-2xl font-bold text-slate-100">Journal</h1><Btn onClick={()=>{setJf({title:"",body:"",tag:"General",date:today()});setModal(true);}}>+ New Entry</Btn></div>
    <Card className="p-4"><div className="flex flex-wrap gap-3"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-40 focus:outline-none focus:border-blue-500"/><select value={filterTag} onChange={e=>setFilterTag(e.target.value)} className="bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm"><option value="">All Tags</option>{JOURNAL_TAGS.map(t=><option key={t}>{t}</option>)}</select></div></Card>
    {filtered.length===0&&<div className="text-center py-16 text-slate-500"><div className="text-5xl mb-3">✎</div><div className="text-lg font-medium text-slate-300">No entries</div><div className="text-sm mt-1">Log show notes, market observations, weekly reviews</div></div>}
    {filtered.map(e=><Card key={e.id} className="p-4 hover:border-slate-600 transition-colors"><div className="flex items-start justify-between gap-3"><div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-1 flex-wrap"><span className="font-semibold text-slate-100">{e.title}</span><Badge color={tagColors[e.tag]||"gray"}>{e.tag}</Badge><span className="text-xs text-slate-500 font-mono">{e.date}</span></div><div className="text-sm text-slate-400 whitespace-pre-wrap leading-relaxed line-clamp-4">{e.body}</div></div><div className="flex gap-2 flex-shrink-0"><button onClick={()=>{setJf({...e});setModal(true);}} className="text-slate-400 hover:text-slate-200 text-xs cursor-pointer">Edit</button><button onClick={()=>setJournal(p=>p.filter(x=>x.id!==e.id))} className="text-red-400 text-xs cursor-pointer">×</button></div></div></Card>)}
    {modal&&<Modal title={jf.id?"Edit Entry":"New Entry"} onClose={()=>setModal(null)}><div className="space-y-4"><div className="grid grid-cols-2 gap-3"><div className="col-span-2"><Input label="Title" value={jf.title} onChange={v=>setJf(p=>({...p,title:v}))} required/></div><Input label="Date" value={jf.date} onChange={v=>setJf(p=>({...p,date:v}))} type="date"/><Input label="Tag" value={jf.tag} onChange={v=>setJf(p=>({...p,tag:v}))} options={JOURNAL_TAGS}/><div className="col-span-2"><Textarea label="Notes" value={jf.body} onChange={v=>setJf(p=>({...p,body:v}))} rows={10} placeholder="Show notes, market observations..."/></div></div><div className="flex gap-3 justify-end"><Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn><Btn disabled={!jf.title} onClick={save}>Save</Btn></div></div></Modal>}
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD TAB
// ═══════════════════════════════════════════════════════════════════════════════

// ─── SPORT DETECTION ─────────────────────────────────────────────────────────
const SPORT_KEYWORDS={
  Basketball:["wembanyama","banchero","cunningham","gilgeous-alexander","sga","lebron","james","curry","giannis","tatum","doncic","green","clark","caminero","jalen","basketball","nba","wnba","hoops","prizm basketball","select basketball","mosaic basketball","chronicles basketball","obsidian"],
  Baseball:["judge","ohtani","harper","trout","skenes","witt","yamamoto","varitek","ortiz","musial","luciano","bazzana","wells","walker","topps","bowman","finest","heritage","pristine","stadium club","baseball","mlb"],
  Football:["jackson","lamar","barkley","kelce","lamb","maye","darnold","pitts","cook","hutchinson","willis","williams","caleb","taylor","football","nfl","contenders football","donruss football","prizm football","mosaic football"],
  Soccer:["foden","alli","de vries","fifa","soccer","premier league","la liga","champions league","bundesliga"],
};
function detectSport(card){
  const text=[card.player||"",card.set||card.set_name||"",card.notes||""].join(" ").toLowerCase();
  for(const[sport,kws]of Object.entries(SPORT_KEYWORDS)){if(kws.some(k=>text.includes(k)))return sport;}
  return "Other";
}
const SPORT_COLORS={Basketball:"#3B82F6",Baseball:"#10B981",Football:"#F59E0B",Soccer:"#8B5CF6",Other:"#64748B"};

// ─── PORTFOLIO TAB ────────────────────────────────────────────────────────────
function PortfolioTab({inventory,transactions,snapshots,setSnapshots}){
  const normC=c=>({...c,buyPrice:+(c.buyPrice||c.buy_price||0),marketValue:+(c.marketValue||c.market_value||0),set:c.set||c.set_name||"",certNum:c.certNum||c.cert_num||"",sport:c.sport||detectSport(c)});
  const[includePC,setIncludePC]=useState(false);
  const curMonth=today().slice(0,7);

  const businessCards=inventory.filter(c=>isActive(c.status)&&c.status!=="PC").map(normC);
  const pcCards=inventory.filter(c=>c.status==="PC").map(normC);
  const cards=includePC?[...businessCards,...pcCards]:businessCards;

  const totalValue=cards.reduce((s,c)=>s+(c.marketValue||c.buyPrice),0);
  const totalCost=cards.reduce((s,c)=>s+c.buyPrice,0);
  const totalProfit=totalValue-totalCost;
  const roi=totalCost>0?(totalProfit/totalCost*100):0;
  const cardCount=cards.length;

  const sortedSnaps=[...snapshots].sort((a,b)=>a.month>b.month?1:-1);
  const startVal=sortedSnaps.length>0?+(sortedSnaps[0].mv||0):totalCost;
  const rateOfGrowth=startVal>0?((totalValue-startVal)/startVal*100):0;
  const realDollarChange=totalValue-startVal;
  const chartData=sortedSnaps.map(s=>({month:s.month,value:+(s.mv||0),investment:+(s.cost||0)}));
  if(!chartData.find(d=>d.month===curMonth))chartData.push({month:curMonth,value:totalValue,investment:totalCost});

  const takeSnap=()=>{const s={id:uid(),date:today(),month:curMonth,mv:totalValue,cost:totalCost,realized:0,unrealized:totalProfit,cards:cardCount};setSnapshots(p=>{const i=p.findIndex(x=>x.month===curMonth);if(i>=0){const n=[...p];n[i]=s;return n;}return[...p,s];});};

  const playerMap={};
  cards.forEach(c=>{if(!c.player)return;if(!playerMap[c.player])playerMap[c.player]={player:c.player,count:0,cost:0,value:0,sport:c.sport};playerMap[c.player].count++;playerMap[c.player].cost+=c.buyPrice;playerMap[c.player].value+=(c.marketValue||c.buyPrice);});
  const players=Object.values(playerMap).sort((a,b)=>b.value-a.value);
  const top10P=players.slice(0,10);const otherV=players.slice(10).reduce((s,p)=>s+p.value,0);
  const playerPieData=[...top10P.map(p=>({name:p.player,value:p.value})),otherV>0?{name:"Other",value:otherV}:null].filter(Boolean);

  const sportMap={};
  cards.forEach(c=>{const sp=c.sport;if(!sportMap[sp])sportMap[sp]={sport:sp,count:0,cost:0,value:0};sportMap[sp].count++;sportMap[sp].cost+=c.buyPrice;sportMap[sp].value+=(c.marketValue||c.buyPrice);});
  const sports=Object.values(sportMap).sort((a,b)=>b.value-a.value);

  const pcValue=pcCards.reduce((s,c)=>s+(c.marketValue||c.buyPrice),0);
  const pcCost=pcCards.reduce((s,c)=>s+c.buyPrice,0);
  const pcGL=pcValue-pcCost;const pcROI=pcCost>0?(pcGL/pcCost*100):0;
  const pcPlayerMap={};pcCards.forEach(c=>{if(!pcPlayerMap[c.player])pcPlayerMap[c.player]={player:c.player,count:0,cost:0,value:0};pcPlayerMap[c.player].count++;pcPlayerMap[c.player].cost+=c.buyPrice;pcPlayerMap[c.player].value+=(c.marketValue||c.buyPrice);});
  const pcPlayers=Object.values(pcPlayerMap).sort((a,b)=>b.value-a.value);

  const PC=[...Array(11).keys()].map((_,i)=>["#10B981","#3B82F6","#8B5CF6","#F59E0B","#EF4444","#EC4899","#14B8A6","#F97316","#6366F1","#84CC16","#64748B"][i]);
  const[showAll,setShowAll]=useState(false);
  const dispPlayers=showAll?players:players.slice(0,15);

  return(<div className="space-y-6">
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div><h1 className="text-2xl font-bold text-slate-100">Portfolio Overview</h1><p className="text-sm text-slate-400">{cardCount} cards · {includePC?"includes PC":"business only"}</p></div>
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={()=>setIncludePC(v=>!v)} className={clx("flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium cursor-pointer transition-all",includePC?"bg-blue-500/20 border-blue-500/50 text-blue-300":"bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-200")}>
          <div className={clx("w-4 h-4 rounded border-2 flex items-center justify-center",includePC?"border-blue-400 bg-blue-400":"border-slate-500")}>{includePC&&<span className="text-white text-xs font-bold">✓</span>}</div>Include PC Cards
        </button>
        <Btn variant="secondary" size="sm" onClick={takeSnap}>📸 Snapshot</Btn>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <Card className="p-5"><div className="space-y-3">
        {[["Collection Value",fmt$(totalValue),"text-emerald-400"],["Total Investment",fmt$(totalCost),"text-blue-400"],["# of Cards Owned",String(cardCount),"text-slate-200"],["Potential Profit",`${totalProfit>=0?"+":""}${fmt$(totalProfit)}`,(totalProfit>=0?"text-emerald-400":"text-red-400")],["Potential ROI",`${roi>=0?"+":""}${roi.toFixed(2)}%`,(roi>=0?"text-emerald-400":"text-red-400")],["Rate of Growth",`${rateOfGrowth>=0?"+":""}${rateOfGrowth.toFixed(2)}%`,(rateOfGrowth>=0?"text-emerald-400":"text-red-400")],["Real $ Change",`${realDollarChange>=0?"+":""}${fmt$(realDollarChange,0)}`,(realDollarChange>=0?"text-emerald-400":"text-red-400")]].map(([label,val,color])=>(
          <div key={label} className="flex justify-between items-center border-b border-slate-700/40 pb-2 last:border-0 last:pb-0"><span className="text-xs text-slate-400">{label}</span><span className={clx("text-sm font-bold font-mono",color)}>{val}</span></div>
        ))}
      </div></Card>
      <Card className="p-5 lg:col-span-2">
        <div className="text-sm font-bold text-slate-300 mb-4">Value vs Investment Over Time</div>
        {chartData.length>1?(<ResponsiveContainer width="100%" height={220}><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#1E293B"/><XAxis dataKey="month" tick={{fill:"#94A3B8",fontSize:10}}/><YAxis tick={{fill:"#94A3B8",fontSize:10}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/><Tooltip contentStyle={{background:"#1E293B",border:"1px solid #334155",borderRadius:"8px"}} formatter={v=>[fmt$(v)]}/><Legend/><Line type="monotone" dataKey="value" name="Value" stroke="#10B981" strokeWidth={2.5} dot={false}/><Line type="monotone" dataKey="investment" name="Investment" stroke="#3B82F6" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer>)
        :(<div className="flex flex-col items-center justify-center h-48 text-center"><div className="text-3xl mb-3">📸</div><div className="text-slate-300 font-medium mb-1">No history yet</div><div className="text-sm text-slate-500 mb-3">Take a snapshot each month to build this chart</div><Btn size="sm" onClick={takeSnap}>Take First Snapshot</Btn></div>)}
      </Card>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Card className="p-5">
        <h2 className="text-base font-bold text-slate-200 mb-3">Player Breakdown</h2>
        {playerPieData.length>0&&<ResponsiveContainer width="100%" height={180}><PieChart><Pie data={playerPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>{playerPieData.map((_,i)=><Cell key={i} fill={PC[i%PC.length]}/>)}</Pie><Tooltip formatter={v=>[fmt$(v),"Value"]} contentStyle={{background:"#1E293B",border:"1px solid #334155",borderRadius:"8px"}}/></PieChart></ResponsiveContainer>}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 mb-3">{playerPieData.map((p,i)=><div key={p.name} className="flex items-center gap-1 text-xs text-slate-400"><div className="w-2 h-2 rounded-full" style={{background:PC[i%PC.length]}}/>{p.name}</div>)}</div>
        <div className="border-t border-slate-700 pt-3 overflow-x-auto"><table className="w-full text-xs">
          <thead><tr className="text-slate-500 uppercase border-b border-slate-700/50"><th className="text-left py-1">Player</th><th className="text-left py-1">Sport</th><th className="text-center py-1">Cards</th><th className="text-right py-1">Invested</th><th className="text-right py-1">Value</th><th className="text-right py-1">+/-</th></tr></thead>
          <tbody>{dispPlayers.map(p=>{const gl=p.value-p.cost;return(<tr key={p.player} className="border-b border-slate-700/30 hover:bg-slate-700/20">
            <td className="py-1.5 text-slate-200 font-medium">{p.player}</td>
            <td className="py-1.5"><span className="px-1.5 py-0.5 rounded text-xs" style={{background:(SPORT_COLORS[p.sport]||"#64748B")+"25",color:SPORT_COLORS[p.sport]||"#94A3B8"}}>{p.sport}</span></td>
            <td className="py-1.5 text-center text-slate-400">{p.count}</td>
            <td className="py-1.5 text-right font-mono text-slate-300">{fmt$(p.cost)}</td>
            <td className="py-1.5 text-right font-mono text-blue-400">{fmt$(p.value)}</td>
            <td className={clx("py-1.5 text-right font-mono font-semibold",gl>=0?"text-emerald-400":"text-red-400")}>{gl>=0?"+":""}{fmt$(gl)}</td>
          </tr>);})}</tbody>
          {players.length>15&&<tr><td colSpan={6} className="py-2 text-center"><button onClick={()=>setShowAll(v=>!v)} className="text-xs text-blue-400 cursor-pointer">{showAll?"Show less":`Show all ${players.length} players`}</button></td></tr>}
          <tfoot><tr className="border-t border-slate-600 font-bold bg-slate-800/40"><td className="py-1.5 text-slate-200">Total</td><td/><td className="py-1.5 text-center text-slate-300">{cardCount}</td><td className="py-1.5 text-right font-mono text-slate-300">{fmt$(totalCost)}</td><td className="py-1.5 text-right font-mono text-blue-400">{fmt$(totalValue)}</td><td className={clx("py-1.5 text-right font-mono",totalProfit>=0?"text-emerald-400":"text-red-400")}>{totalProfit>=0?"+":""}{fmt$(totalProfit)}</td></tr></tfoot>
        </table></div>
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-bold text-slate-200 mb-3">Category Breakdown</h2>
        {sports.length>0&&<ResponsiveContainer width="100%" height={180}><PieChart><Pie data={sports} dataKey="value" nameKey="sport" cx="50%" cy="50%" outerRadius={80} label={({sport,percent})=>`${sport} ${(percent*100).toFixed(0)}%`} labelLine={false}>{sports.map(s=><Cell key={s.sport} fill={SPORT_COLORS[s.sport]||"#64748B"}/>)}</Pie><Tooltip formatter={v=>[fmt$(v),"Value"]} contentStyle={{background:"#1E293B",border:"1px solid #334155",borderRadius:"8px"}}/></PieChart></ResponsiveContainer>}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 mb-3">{sports.map(s=><div key={s.sport} className="flex items-center gap-1 text-xs text-slate-400"><div className="w-2 h-2 rounded-full" style={{background:SPORT_COLORS[s.sport]||"#64748B"}}/>{s.sport}</div>)}</div>
        <div className="border-t border-slate-700 pt-3 overflow-x-auto"><table className="w-full text-xs">
          <thead><tr className="text-slate-500 uppercase border-b border-slate-700/50"><th className="text-left py-1">Sport</th><th className="text-center py-1">Cards</th><th className="text-right py-1">Invested</th><th className="text-right py-1">Value</th><th className="text-right py-1">+/-</th><th className="text-right py-1">Share</th></tr></thead>
          <tbody>{sports.map(s=>{const gl=s.value-s.cost;const pct=totalValue>0?(s.value/totalValue*100):0;return(<tr key={s.sport} className="border-b border-slate-700/30 hover:bg-slate-700/20">
            <td className="py-1.5"><div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{background:SPORT_COLORS[s.sport]||"#64748B"}}/><span className="text-slate-200 font-medium">{s.sport}</span></div></td>
            <td className="py-1.5 text-center text-slate-400">{s.count}</td>
            <td className="py-1.5 text-right font-mono text-slate-300">{fmt$(s.cost)}</td>
            <td className="py-1.5 text-right font-mono text-blue-400">{fmt$(s.value)}</td>
            <td className={clx("py-1.5 text-right font-mono font-semibold",gl>=0?"text-emerald-400":"text-red-400")}>{gl>=0?"+":""}{fmt$(gl)}</td>
            <td className="py-1.5 text-right"><div className="flex items-center justify-end gap-1.5"><div className="w-12 bg-slate-700 rounded-full h-1.5"><div className="h-1.5 rounded-full" style={{width:`${pct}%`,background:SPORT_COLORS[s.sport]||"#64748B"}}/></div><span className="text-slate-400 w-7 text-right">{pct.toFixed(0)}%</span></div></td>
          </tr>);})}</tbody>
          <tfoot><tr className="border-t border-slate-600 font-bold bg-slate-800/40"><td className="py-1.5 text-slate-200">Total</td><td className="py-1.5 text-center text-slate-300">{cardCount}</td><td className="py-1.5 text-right font-mono text-slate-300">{fmt$(totalCost)}</td><td className="py-1.5 text-right font-mono text-blue-400">{fmt$(totalValue)}</td><td className={clx("py-1.5 text-right font-mono",totalProfit>=0?"text-emerald-400":"text-red-400")}>{totalProfit>=0?"+":""}{fmt$(totalProfit)}</td><td className="py-1.5 text-right text-slate-400">100%</td></tr></tfoot>
        </table></div>
      </Card>
    </div>

    {/* PC Section */}
    {pcCards.length>0&&<div className="space-y-4">
      <div className="flex items-center gap-3"><h2 className="text-lg font-bold text-slate-200">Personal Collection (PC)</h2><Badge color="blue">{pcCards.length} cards</Badge></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label="PC Value" value={fmt$(pcValue,0)} color="blue"/>
        <KPI label="Total Invested" value={fmt$(pcCost,0)} color="white"/>
        <KPI label="Appreciation" value={`${pcGL>=0?"+":""}${fmt$(pcGL,0)}`} color={pcGL>=0?"green":"red"}/>
        <KPI label="PC ROI" value={`${pcROI>=0?"+":""}${pcROI.toFixed(1)}%`} color={pcROI>=0?"green":"red"}/>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-4">
          <div className="text-xs font-bold text-slate-400 mb-3 uppercase">PC By Player</div>
          {pcPlayers.length>0&&<ResponsiveContainer width="100%" height={150}><PieChart><Pie data={pcPlayers.map(p=>({name:p.player,value:p.value}))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65}>{pcPlayers.map((_,i)=><Cell key={i} fill={PC[i%PC.length]}/>)}</Pie><Tooltip formatter={v=>[fmt$(v)]} contentStyle={{background:"#1E293B",border:"1px solid #334155",borderRadius:"8px"}}/></PieChart></ResponsiveContainer>}
          <div className="flex flex-wrap gap-x-2 gap-y-1 mt-2">{pcPlayers.map((p,i)=><div key={p.player} className="flex items-center gap-1 text-xs text-slate-400"><div className="w-1.5 h-1.5 rounded-full" style={{background:PC[i%PC.length]}}/>{p.player}</div>)}</div>
        </Card>
        <Card className="p-4 lg:col-span-2">
          <div className="text-xs font-bold text-slate-400 mb-3 uppercase">PC Card Details</div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto"><table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-800"><tr className="text-slate-500 uppercase border-b border-slate-700"><th className="text-left py-1.5">Player</th><th className="text-left py-1.5">Grade</th><th className="text-left py-1.5">Cert #</th><th className="text-right py-1.5">Cost</th><th className="text-right py-1.5">Value</th><th className="text-right py-1.5">+/-</th></tr></thead>
            <tbody>{[...pcCards].sort((a,b)=>(b.marketValue||b.buyPrice)-(a.marketValue||a.buyPrice)).map(c=>{const mv=c.marketValue||c.buyPrice;const gl=mv-c.buyPrice;return(<tr key={c.id} className="border-b border-slate-700/40 hover:bg-slate-700/20">
              <td className="py-1.5"><div className="text-slate-200 font-medium">{c.player}</div><div className="text-slate-500">{c.year} {c.set}</div></td>
              <td className="py-1.5">{c.grade?<Badge color="purple">{c.grade}</Badge>:<span className="text-slate-600">Raw</span>}</td>
              <td className="py-1.5 font-mono text-slate-400">{c.certNum||"—"}</td>
              <td className="py-1.5 text-right font-mono text-slate-300">{fmt$(c.buyPrice)}</td>
              <td className="py-1.5 text-right font-mono text-blue-400">{fmt$(mv)}</td>
              <td className={clx("py-1.5 text-right font-mono font-semibold",gl>=0?"text-emerald-400":"text-red-400")}>{gl>=0?"+":""}{fmt$(gl)}</td>
            </tr>);})}</tbody>
            <tfoot><tr className="border-t border-slate-600 font-bold bg-slate-800/40"><td colSpan={3} className="py-2 text-slate-200">Total</td><td className="py-2 text-right font-mono text-slate-300">{fmt$(pcCost)}</td><td className="py-2 text-right font-mono text-blue-400">{fmt$(pcValue)}</td><td className={clx("py-2 text-right font-mono",pcGL>=0?"text-emerald-400":"text-red-400")}>{pcGL>=0?"+":""}{fmt$(pcGL)}</td></tr></tfoot>
          </table></div>
        </Card>
      </div>
    </div>}
  </div>);
}


function DashboardTab({inventory,transactions,expenses,snapshots,onNavigate}){
  const normD=t=>({...t,cardId:t.cardId||t.card_id||null,salePrice:+(t.salePrice||t.sale_price||0),purchasePrice:+(t.purchasePrice||t.purchase_price||0),platformFeePct:+(t.platformFeePct||t.platform_fee_pct||0),shippingOut:+(t.shippingOut||t.shipping_out||0),gl:+(t.gl||0)});
  const normDC=c=>({...c,buyPrice:+(c.buyPrice||c.buy_price||0),marketValue:+(c.marketValue||c.market_value||0),certNum:c.certNum||c.cert_num||"",set:c.set||c.set_name||""});
  const allTx=transactions.map(normD);const allInv=inventory.map(normDC);
  const sales=allTx.filter(t=>t.type==="sale");const curMonth=today().slice(0,7);const curYear=String(new Date().getFullYear());
  const[dashYear,setDashYear]=useState("all");
  const years=[...new Set(sales.map(t=>yearOf(t.date)).filter(y=>y&&y.length===4))].sort().reverse();
  const ytd=dashYear==="all"?sales:sales.filter(t=>yearOf(t.date)===dashYear);
  const mtd=sales.filter(t=>monthOf(t.date)===curMonth);
  const active=allInv.filter(c=>isActive(c.status));
  const rev=ytd.reduce((s,t)=>s+(t.salePrice||0),0);const cogs=ytd.reduce((s,t)=>{const c=inventory.find(x=>x.id===t.cardId);return s+(c?+c.buyPrice:0);},0);
  const gross=rev-cogs;const fees=ytd.reduce((s,t)=>s+((t.salePrice||0)*((t.platformFeePct||0)/100)),0);
  const opex=(dashYear==="all"?expenses:expenses.filter(e=>yearOf(e.date)===dashYear)).reduce((s,e)=>s+(+e.amount||0),0);const net=gross-fees-opex;
  const businessActive=active.filter(c=>c.status!=="PC");
  const invValue=businessActive.reduce((s,c)=>s+(+c.marketValue||+c.buyPrice),0);const invCost=businessActive.reduce((s,c)=>s+(+c.buyPrice),0);const unreal=invValue-invCost;
  const pcCards=inventory.filter(c=>c.status==="PC");
  const pcValue=pcCards.reduce((s,c)=>s+(+c.marketValue||+c.buyPrice),0);
  const pcCost=pcCards.reduce((s,c)=>s+(+c.buyPrice),0);const pcGL=pcValue-pcCost;
  const mtdRev=mtd.reduce((s,t)=>s+(t.salePrice||0),0);const mtdProfit=mtd.reduce((s,t)=>s+(t.gl||0),0);
  const aging90=active.filter(c=>c.status==="For Sale"&&c.buyDate&&daysBetween(c.buyDate,today())>90);
  const underwater=active.filter(c=>(+c.marketValue||+c.buyPrice)<+c.buyPrice);
  const nearLT=inventory.filter(c=>isActive(c.status)&&c.buyDate).map(c=>({...c,remaining:365-daysBetween(c.buyDate,today())})).filter(c=>c.remaining>0&&c.remaining<=30);
  const grading=allInv.filter(c=>c.status==="Submitted for Grading");
  const recent=[...allTx].sort((a,b)=>b.date>a.date?1:-1).slice(0,8);
  const monthlyTrend=useMemo(()=>{const m={};sales.forEach(t=>{const k=monthOf(t.date);if(!k||k.length<7)return;if(!m[k])m[k]={m:k,rev:0,profit:0};m[k].rev+=t.salePrice||0;m[k].profit+=(t.gl||0);});return Object.values(m).sort((a,b)=>a.m>b.m?1:-1).slice(-6);},[transactions]);
  return(<div className="space-y-5">
    <div className="flex items-center justify-between flex-wrap gap-3"><div><h1 className="text-2xl font-bold text-slate-100">Dashboard</h1><p className="text-sm text-slate-400">{new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p></div><select value={dashYear} onChange={e=>setDashYear(e.target.value)} className="bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm"><option value="all">All Time</option>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></div>
    {(aging90.length>0||underwater.length>0||nearLT.length>0)&&<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {aging90.length>0&&<button onClick={()=>onNavigate("inventory")} className="text-left cursor-pointer group"><Card className="p-3 border-amber-500/40 bg-amber-500/5 group-hover:border-amber-500/70"><div className="text-xs text-amber-400 font-bold">⏰ {aging90.length} cards 90d+ unsold</div><div className="text-xs text-slate-400 mt-1 truncate">{aging90.slice(0,2).map(c=>c.player).join(", ")}</div></Card></button>}
      {underwater.length>0&&<button onClick={()=>onNavigate("inventory")} className="text-left cursor-pointer group"><Card className="p-3 border-red-500/40 bg-red-500/5 group-hover:border-red-500/70"><div className="text-xs text-red-400 font-bold">📉 {underwater.length} underwater</div><div className="text-xs text-slate-400 mt-1 truncate">{underwater.slice(0,2).map(c=>c.player).join(", ")}</div></Card></button>}
      {nearLT.length>0&&<button onClick={()=>onNavigate("tax")} className="text-left cursor-pointer group"><Card className="p-3 border-emerald-500/40 bg-emerald-500/5 group-hover:border-emerald-500/70"><div className="text-xs text-emerald-400 font-bold">🕐 {nearLT.length} near LT</div><div className="text-xs text-slate-400 mt-1 truncate">{nearLT.slice(0,2).map(c=>`${c.player} (${c.remaining}d)`).join(", ")}</div></Card></button>}
    </div>}
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <KPI label={dashYear==="all"?"Revenue":"Revenue "+dashYear} value={fmt$(rev,0)} color="blue" icon="💵" sub={`${ytd.length} sales`}/>
      <KPI label="Gross Profit" value={fmt$(gross,0)} color={gross>=0?"green":"red"} icon={gross>=0?"📈":"📉"} sub={cogs>0?`${(gross/cogs*100).toFixed(0)}% ROI`:""}/>
      <KPI label="Net Profit" value={fmt$(net,0)} color={net>=0?"green":"red"} icon="🏆" sub="after fees + expenses"/>
      <KPI label="PC Value" value={fmt$(pcValue,0)} color="blue" icon="🎖" sub={`${pcCards.length} cards`}/>
      <KPI label="Portfolio" value={fmt$(invValue,0)} color="blue" icon="💎" sub={`${businessActive.length} active cards`}/>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <KPI label="Revenue MTD" value={fmt$(mtdRev,0)} sub={`${mtd.length} sales`}/>
      <KPI label="Profit MTD" value={fmt$(mtdProfit,0)} color={mtdProfit>=0?"green":"red"}/>
      <KPI label="Unrealized G/L" value={fmt$(unreal,0)} color={unreal>=0?"green":"red"} sub={`${fmt$(invCost,0)} cost`}/>
      <KPI label="At Grading" value={grading.length}/>
    </div>
    {pcCards.length>0&&<Card className="p-5 border-blue-500/30 bg-blue-500/5">
      {/* PC Header */}
      <div className="flex items-center justify-between mb-4">
        <div><div className="text-base font-bold text-blue-300">Personal Collection</div><div className="text-xs text-slate-400">{pcCards.length} cards — not for sale</div></div>
        <Badge color="blue">PC</Badge>
      </div>
      {/* PC Summary Tiles */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-900/60 rounded-lg p-3 text-center"><div className="text-xs text-slate-500 mb-1">Total Cost</div><div className="font-mono font-bold text-slate-200">{fmt$(pcCost,0)}</div></div>
        <div className="bg-slate-900/60 rounded-lg p-3 text-center"><div className="text-xs text-slate-500 mb-1">Current Value</div><div className="font-mono font-bold text-blue-400">{fmt$(pcValue,0)}</div></div>
        <div className={clx("bg-slate-900/60 rounded-lg p-3 text-center",pcGL>=0?"border border-emerald-500/20":"border border-red-500/20")}><div className="text-xs text-slate-500 mb-1">Appreciation</div><div className={clx("font-mono font-bold",pcGL>=0?"text-emerald-400":"text-red-400")}>{pcGL>=0?"+":""}{fmt$(pcGL,0)}</div></div>
      </div>
      {/* PC Card List — scrollable */}
      <div className="overflow-y-auto" style={{maxHeight:"320px"}}>
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-800 z-10">
            <tr className="border-b border-slate-700 text-slate-400 uppercase">
              <th className="text-left pb-2 pr-3">Card</th>
              <th className="text-left pb-2 pr-3">Grade</th>
              <th className="text-left pb-2 pr-3">Cert #</th>
              <th className="text-right pb-2 pr-3">Cost</th>
              <th className="text-right pb-2 pr-3">Value</th>
              <th className="text-right pb-2">+/-</th>
            </tr>
          </thead>
          <tbody>
            {[...pcCards].sort((a,b)=>(+b.marketValue||+b.buyPrice)-(+a.marketValue||+a.buyPrice)).map(c=>{
              const mv=+c.marketValue||+c.buyPrice;const cost=+c.buyPrice||0;const gl=mv-cost;
              const fullName=[c.player,c.year,c.set||c.set_name,c.parallel].filter(Boolean).join(" ");
              return <tr key={c.id} className="border-b border-slate-700/40 hover:bg-slate-700/20 transition-colors">
                <td className="py-2 pr-3"><div className="font-medium text-slate-200 leading-tight">{c.player}</div><div className="text-slate-500 leading-tight">{[c.year,c.set||c.set_name,c.parallel].filter(Boolean).join(" · ")}</div></td>
                <td className="py-2 pr-3">{c.grade?<Badge color="purple">{c.grade}</Badge>:<span className="text-slate-600">Raw</span>}</td>
                <td className="py-2 pr-3 font-mono text-slate-400">{c.certNum||c.cert_num||"—"}</td>
                <td className="py-2 pr-3 text-right font-mono text-slate-300">{fmt$(cost)}</td>
                <td className="py-2 pr-3 text-right font-mono text-blue-400">{fmt$(mv)}</td>
                <td className={clx("py-2 text-right font-mono font-semibold",gl>=0?"text-emerald-400":"text-red-400")}>{gl>=0?"+":""}{fmt$(gl,0)}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </Card>}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {monthlyTrend.length>0&&<Card className="p-5"><h2 className="text-sm font-bold text-slate-300 mb-4">Monthly Revenue & Profit</h2><ResponsiveContainer width="100%" height={180}><BarChart data={monthlyTrend}><CartesianGrid strokeDasharray="3 3" stroke="#1E293B"/><XAxis dataKey="m" tick={{fill:"#94A3B8",fontSize:10}}/><YAxis tick={{fill:"#94A3B8",fontSize:10}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/><Tooltip contentStyle={{background:"#1E293B",border:"1px solid #334155",borderRadius:"8px"}} formatter={v=>[fmt$(v)]}/><Legend/><ReferenceLine y={0} stroke="#475569"/><Bar dataKey="rev" name="Revenue" fill={ACCENT} radius={[3,3,0,0]}/><Bar dataKey="profit" name="Profit" fill={GREEN} radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></Card>}
      <Card className="p-5"><h2 className="text-sm font-bold text-slate-300 mb-4">Recent Activity</h2><div className="space-y-3">
        {recent.length===0&&<div className="text-slate-500 text-sm text-center py-4">No transactions yet</div>}
        {recent.map(t=>{const c=inventory.find(x=>x.id===t.cardId);const desc=c?`${c.player} ${c.year||""}`:t.player||"Transaction";const amt=t.type==="sale"?t.salePrice:t.type==="purchase"?t.purchasePrice:t.gradingFee;
          return <div key={t.id} className="flex items-center gap-3"><div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:{sale:GREEN,purchase:ACCENT,grading:AMBER,trade:PURPLE}[t.type]||"#64748B"}}/><div className="flex-1 min-w-0"><div className="text-sm text-slate-200 truncate">{desc}</div><div className="text-xs text-slate-400">{t.date} · {t.type}{t.type==="sale"&&t.gl!=null&&<span className={clx("ml-1",t.gl>=0?"text-emerald-400":"text-red-400")}>({fmt$(t.gl)})</span>}</div></div><div className="font-mono text-sm text-slate-300 flex-shrink-0">{fmt$(amt)}</div></div>;})}
      </div></Card>
    </div>
    {grading.length>0&&<Card className="p-5"><h2 className="text-sm font-bold text-slate-300 mb-3">Grading Pipeline ({grading.length})</h2><div className="space-y-2">{grading.map(c=><div key={c.id} className="flex items-center justify-between p-2 bg-slate-900 rounded-lg"><span className="text-sm text-slate-200">{c.player} {c.year}</span><Badge color="gray">At Grader</Badge></div>)}</div></Card>}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Card className="p-5"><h2 className="text-sm font-bold text-slate-300 mb-3">Status Breakdown</h2><div className="space-y-2">{ACTIVE_STATUSES.map(s=>{const cnt=active.filter(c=>c.status===s).length;const pct=active.length?(cnt/active.length)*100:0;return <div key={s} className="space-y-1"><div className="flex justify-between text-xs text-slate-400"><span>{s}</span><span>{cnt}</span></div><div className="w-full bg-slate-700 rounded-full h-1.5"><div className="h-1.5 rounded-full bg-blue-500" style={{width:`${pct}%`}}/></div></div>;})}</div></Card>
      <Card className="p-5"><h2 className="text-sm font-bold text-slate-300 mb-3">Top Holdings</h2><div className="space-y-2">{active.length===0&&<div className="text-slate-500 text-sm text-center py-4">Add cards to inventory</div>}{[...active].sort((a,b)=>(+b.marketValue||+b.buyPrice)-(+a.marketValue||+a.buyPrice)).slice(0,5).map(c=><div key={c.id} className="flex items-center justify-between gap-2"><div className="min-w-0 flex-1"><div className="text-sm text-slate-200 truncate">{c.player}</div><div className="text-xs text-slate-400">{c.year} {c.grade||"Raw"}{c.certNum&&` · ${c.certNum}`}</div></div><div className="font-mono text-sm text-blue-400 flex-shrink-0">{fmt$(c.marketValue||c.buyPrice)}</div></div>)}</div></Card>
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP ROOT
// ═══════════════════════════════════════════════════════════════════════════════
export default function HobbyFolio(){
  const[authReady,setAuthReady]=useState(false);
  const[authUser,setAuthUser]=useState(null);
  useEffect(()=>{
    supabase.auth.getUser().then(({data:{user}})=>{
      if(user){_userId=user.id;setAuthUser(user);}
      setAuthReady(true);
    });
  },[]);
  if(!authReady)return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="text-4xl animate-pulse">🃏</div></div>;
  if(!authUser)return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="text-center space-y-4"><div className="text-4xl">🃏</div><div className="text-slate-300 font-medium">HobbyFolio</div><a href="/auth/login" className="text-blue-400 hover:text-blue-300 text-sm">Sign in to continue</a></div></div>;
  return <HobbyFolioApp authUser={authUser}/>;
}

function HobbyFolioApp({authUser}){
  const[tab,setTab]=useState("dashboard");const[sidebarOpen,setSidebarOpen]=useState(false);
  const[inventory,setInventory,invL]=usePersist("cv_inventory",[]);
  const[transactions,setTransactions,txL]=usePersist("cv_transactions",[]);
  const[expenses,setExpenses,expL]=usePersist("cv_expenses",[]);
  const[snapshots,setSnapshots,snapL]=usePersist("cv_snapshots",[]);
  const[journal,setJournal,jL]=usePersist("cv_journal",[]);
  const loaded=invL&&txL&&expL&&snapL&&jL;
  if(!loaded)return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="text-center space-y-3"><div className="text-4xl animate-pulse">🃏</div><div className="text-slate-300 font-medium">Loading HobbyFolio...</div></div></div>;
  return(<div className="min-h-screen bg-slate-900 text-slate-200" style={{fontFamily:"'Inter',system-ui,sans-serif"}}>
    <style>{`*{box-sizing:border-box;} ::-webkit-scrollbar{width:5px;height:5px;} ::-webkit-scrollbar-track{background:#0F172A;} ::-webkit-scrollbar-thumb{background:#334155;border-radius:3px;} .holo-shimmer{background:linear-gradient(135deg,#3B82F6 0%,#8B5CF6 25%,#EC4899 50%,#F59E0B 75%,#10B981 100%);background-size:200% 200%;animation:holo 4s ease infinite;} @keyframes holo{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}`}</style>
    <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 sticky top-0 z-40 gap-2">
      <div className="flex items-center gap-2 flex-shrink-0"><div className="holo-shimmer w-7 h-7 rounded-lg p-0.5"><div className="bg-slate-800 rounded-md w-full h-full flex items-center justify-center text-sm">🃏</div></div><span className="font-bold text-slate-100">HobbyFolio</span></div>
      <GlobalSearch inventory={inventory} transactions={transactions} onNavigate={t=>{setTab(t);setSidebarOpen(false);}}/>
      <button onClick={()=>setSidebarOpen(o=>!o)} className="text-slate-300 text-xl cursor-pointer flex-shrink-0">☰</button>
    </div>
    <div className="flex">
      <aside className={clx("fixed lg:sticky top-0 h-screen z-30 flex flex-col bg-slate-800 border-r border-slate-700 transition-all duration-200 lg:translate-x-0 lg:w-56",sidebarOpen?"translate-x-0 w-56":"-translate-x-full w-56")}>
        <div className="p-4 flex items-center gap-3 border-b border-slate-700"><div className="holo-shimmer w-9 h-9 rounded-xl p-0.5 flex-shrink-0"><div className="bg-slate-800 rounded-lg w-full h-full flex items-center justify-center text-lg">🃏</div></div><div><div className="font-bold text-slate-100 text-sm">HobbyFolio</div><div className="text-xs text-slate-400">Business Manager</div></div></div>
        <div className="hidden lg:block p-2 border-b border-slate-700"><GlobalSearch inventory={inventory} transactions={transactions} onNavigate={t=>setTab(t)}/></div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">{NAV_ITEMS.map(n=><button key={n.id} onClick={()=>{setTab(n.id);setSidebarOpen(false);}} className={clx("w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer",tab===n.id?"bg-blue-600/20 text-blue-300 border border-blue-500/30":"text-slate-400 hover:bg-slate-700 hover:text-slate-200")}><span className="text-base">{n.icon}</span>{n.label}</button>)}</nav>
        <div className="p-3 border-t border-slate-700"><button onClick={async()=>{await supabase.auth.signOut();window.location.href="/";}} className="w-full text-left text-xs text-slate-500 hover:text-slate-300 cursor-pointer mb-2">Sign out</button><div className="text-xs text-slate-500 text-center">{inventory.filter(c=>isActive(c.status)).length} active · {inventory.filter(c=>c.status==="Sold").length} sold · {transactions.length} tx</div></div>
      </aside>
      {sidebarOpen&&<div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={()=>setSidebarOpen(false)}/>}
      <main className="flex-1 min-w-0 overflow-x-hidden"><div className="max-w-6xl mx-auto px-4 py-6 lg:px-6">
        {tab==="portfolio"&&<PortfolioTab inventory={inventory} transactions={transactions} snapshots={snapshots} setSnapshots={setSnapshots}/>}
        {tab==="dashboard"&&<DashboardTab inventory={inventory} transactions={transactions} expenses={expenses} snapshots={snapshots} onNavigate={t=>setTab(t)}/>}
        {tab==="inventory"&&<InventoryTab inventory={inventory} setInventory={setInventory} setTransactions={setTransactions}/>}
        {tab==="transactions"&&<TransactionsTab transactions={transactions} setTransactions={setTransactions} inventory={inventory} setExpenses={setExpenses}/>}
        {tab==="pnl"&&<PnLTab transactions={transactions} inventory={inventory} expenses={expenses} snapshots={snapshots} setSnapshots={setSnapshots}/>}
        {tab==="tax"&&<TaxTab transactions={transactions} inventory={inventory} expenses={expenses} setExpenses={setExpenses}/>}
        {tab==="tools"&&<ToolsTab inventory={inventory} setInventory={setInventory} transactions={transactions} setTransactions={setTransactions} expenses={expenses} setExpenses={setExpenses} setSnapshots={setSnapshots} journal={journal} setJournal={setJournal}/>}
        {tab==="journal"&&<JournalTab journal={journal} setJournal={setJournal}/>}
      </div></main>
    </div>
  </div>);
}
