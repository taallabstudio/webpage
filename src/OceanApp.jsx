import React,{useCallback,useEffect,useMemo,useRef,useState} from "react";
import "./Ocean.css";
import {
  Activity,AlignLeft,Archive,ArrowDown,ArrowLeft,AudioLines,BarChart3,Bell,BookOpen,
  Bookmark,Calendar,Check,CheckSquare,ChevronDown,ChevronRight,ChevronsUpDown,
  CircleHelp,Code,Columns3,Command,Copy,Database,File,FileAudio,FileImage,FilePlus,
  FileText,Film,Folder,FolderPlus,GalleryHorizontal,Globe,Grid2X2,Hash,Heart,
  Image as ImageIcon,Inbox,Link,LogOut,Map,Menu,MessageCircle,MoreHorizontal,
  PanelLeftClose,PanelLeftOpen,Plus,Palette,Search,Settings,Share2,ShieldCheck,SlidersHorizontal,
  Smile,Table2,Text,Trash2,Upload,User,Users,Video,X,Moon,Sun
} from "lucide-react";

const api=async(path,options={})=>{
  const response=await fetch("/api"+path,{credentials:"include",...options});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(data.error||"Something went wrong");error.status=response.status;throw error;}
  return data;
};
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
const blankBlock=(type="text")=>({id:uid(),type,text:""});
const SLASH_COLORS=[
 ["Gray","#7f8994","#f0f2f4"],["Red","#c64b4b","#fff0ef"],["Orange","#b86a28","#fff2e7"],
 ["Yellow","#9b7b1e","#fff9e6"],["Green","#287a4c","#eaf7ef"],["Blue","#0878e8","#eaf4ff"],["Purple","#7956ae","#f3effb"]
];
const OCEAN_EVENT_COLORS=[{id:"1",name:"Lavender",hex:"#7986cb"},{id:"2",name:"Sage",hex:"#33b679"},{id:"3",name:"Grape",hex:"#8e24aa"},{id:"4",name:"Flamingo",hex:"#e67c73"},{id:"5",name:"Banana",hex:"#f6bf26"},{id:"6",name:"Tangerine",hex:"#f4511e"},{id:"7",name:"Peacock",hex:"#039be5"},{id:"8",name:"Graphite",hex:"#616161"},{id:"9",name:"Blueberry",hex:"#3f51b5"},{id:"10",name:"Basil",hex:"#0b8043"},{id:"11",name:"Tomato",hex:"#d50000"}];
const COMMANDS=[
  ["Blue highlight","highlight-blue","Formatting","🖍"],
  ...SLASH_COLORS.flatMap(([name,text,bg])=>[
   ["Text · "+name,"text-color-"+name.toLowerCase(),"Formatting","A",text],
   ["Background · "+name,"background-color-"+name.toLowerCase(),"Formatting","▰",bg]
  ]),
  ["Reset text and background","color-reset","Formatting","↺"],["Text","text","Basic blocks","T"],["Heading 1","heading1","Basic blocks","H1"],["Heading 2","heading2","Basic blocks","H2"],["Heading 3","heading3","Basic blocks","H3"],["Heading 4","heading4","Basic blocks","H4"],
  ["Bulleted list","bullet","Basic blocks","•"],["Numbered list","numbered","Basic blocks","1."],["To-do list","todo","Basic blocks","☑"],["Toggle list","toggle","Basic blocks","›"],["Page","page","Basic blocks","▤"],["Callout","callout","Basic blocks","▣"],["Quote","quote","Basic blocks","❝"],["Table","table","Basic blocks","▦"],["Divider","divider","Basic blocks","—"],["Link to page","pageLink","Basic blocks","↗"],
  ["Image","image","Media","▧"],["Video","video","Media","▻"],["Audio","audio","Media","♫"],["Code","code","Media","</>"],["File","file","Media","↥"],["Web bookmark","bookmark","Media","♧"],
  ["Table view","database-table","Database","▦"],["Board view","database-board","Database","▤"],["Gallery view","database-gallery","Database","▦"],["List view","database-list","Database","☷"],["Feed view","database-feed","Database","▤"],["Dashboard view","database-dashboard","Database","▥"],["Calendar view","database-calendar","Database","▦"],["Timeline view","database-timeline","Database","▥"],["Map view","database-map","Database","⌖"],["Vertical bar chart","chart-vertical","Database","▥"],["Horizontal bar chart","chart-horizontal","Database","▤"],["Line chart","chart-line","Database","⌁"],["Donut chart","chart-donut","Database","◉"],["Number chart","chart-number","Database","#"],["Form","form","Database","☷"],["Database - Inline","database-inline","Database","▦"],["Database - Full page","database-full","Database","▦"],["Linked view of data source","database-linked","Database","↗"],
  ["Table of contents","toc","Advanced blocks","☷"],["Block equation","equation","Advanced blocks","∑"],["Button","button","Advanced blocks","▣"],["Breadcrumb","breadcrumb","Advanced blocks","⌂"],["Tabs","tabs","Advanced blocks","▥"],["Synced block","synced","Advanced blocks","⧉"],["Toggle heading 1","toggle-heading1","Advanced blocks","H1›"],["Toggle heading 2","toggle-heading2","Advanced blocks","H2›"],["Toggle heading 3","toggle-heading3","Advanced blocks","H3›"],["2 columns","columns2","Advanced blocks","Ⅱ"],["3 columns","columns3","Advanced blocks","Ⅲ"],["4 columns","columns4","Advanced blocks","Ⅳ"],["5 columns","columns5","Advanced blocks","Ⅴ"],["AI Meeting Notes","meeting","Advanced blocks","✧"],["Code - Mermaid","mermaid","Advanced blocks","◇"],
  ["Mention a person","mention","Inline","@"],["Mention a page or data source","mention-page","Inline","↗"],["Date or reminder","date","Inline","◷"],["Emoji","emoji","Inline","☺"],["Inline equation","inline-equation","Inline","√"],["Embed","embed","Embeds","↗"],["HTML","html","Embeds","</>"],["Google Drive","google-drive","Embeds","▣"],["Tweet","tweet","Embeds","𝕏"],["GitHub Gist","gist","Embeds","⌘"],["Google Maps","maps","Embeds","⌖"],["Figma","figma","Embeds","◈"],["Excalidraw","excalidraw","Embeds","◇"],["PDF","pdf","Embeds","▧"],["Loom","loom","Embeds","◉"],["Typeform","typeform","Embeds","▤"],["CodePen","codepen","Embeds","◇"],["Replit","replit","Embeds","⌘"],["Deepnote","deepnote","Embeds","▧"],["Trello","trello","Embeds","▦"],["Slack","slack","Embeds","▧"],["Pitch","pitch","Embeds","▣"],["OneDrive","onedrive","Embeds","☁"],["Dropbox","dropbox","Embeds","◈"],["Google Calendar","google-calendar","Integrations","▦"]
];
const EMOJIS=["🌊","📝","📚","🎧","🎵","🎹","🎬","💡","⭐","🔥","🎯","🧠","📌","🗂️","🪄","🌱","🚀","❤️","🎨","📷","💻","🧪","🛠️","🗓️","☕","🌙"];
const COLORS=[["Default",""],["Gray","gray"],["Brown","brown"],["Orange","orange"],["Yellow","yellow"],["Green","green"],["Blue","blue"],["Purple","purple"],["Pink","pink"],["Red","red"]];
const VIEWS=["Table","Board","Gallery","List","Feed","Calendar","Timeline","Map","Vertical bar chart","Horizontal bar chart","Line chart","Donut chart","Number chart"];
const escapeHtml=(value="")=>String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const formatInlineMarkdown=(value="")=>{
 let html=escapeHtml(value);
 html=html.replace(/`([^`]+)`/g,"<code>$1</code>");
 html=html.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>");
 html=html.replace(/_\*(.+?)\*_/g,"<u>$1</u>");
 html=html.replace(/__(.+?)__/g,"<u>$1</u>");
 html=html.replace(/~~(.+?)~~/g,"<s>$1</s>");
 html=html.replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,!?])/g,"$1<em>$2</em>");
 html=html.replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,!?])/g,"$1<u>$2</u>");
 return html;
};
const editorHtml=(element)=>{
 const raw=element.innerText;
 const formatted=formatInlineMarkdown(raw);
 const escaped=escapeHtml(raw).replace(/\n/g,"<br>");
 return formatted!==escaped?formatted:element.innerHTML;
};
const focusContentEnd=(element)=>{
 if(!element)return;
 element.focus();
 const selection=window.getSelection();
 const range=document.createRange();
 range.selectNodeContents(element);
 range.collapse(false);
 selection.removeAllRanges();
 selection.addRange(range);
};
function OceanWaveMark({className=""}){return <svg className={className} viewBox="0 0 48 32" aria-hidden="true" fill="none"><path d="M3 11.5C8 5.5 13 5.5 18 11.5S28 17.5 33 11.5 43 5.5 47 11.5" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"/><path d="M3 20C8 14 13 14 18 20s10 6 15 0 10-6 14-0" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"/><path d="M3 28C8 22 13 22 18 28s10 6 15 0 10-6 14 0" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"/></svg>}
function OceanLogin({onLogin}){
 const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [code,setCode]=useState("");const [challenge,setChallenge]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);
 async function submit(e){e.preventDefault();setError("");setBusy(true);try{
  if(challenge){await api("/auth/2fa/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({challenge_id:challenge,code})});onLogin();return;}
  const result=await api("/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});
  if(result.requiresTwoFactor){setChallenge(result.challengeId);return;}onLogin();
 }catch(err){setError(err.message);}finally{setBusy(false);}}
 return <div className="ocean-auth"><div className="ocean-auth-card"><div className="ocean-mark"><OceanWaveMark/></div><div className="ocean-wordmark">OCEAN</div><h1>{challenge?"Check your email":"Welcome back"}</h1><p>{challenge?"Enter the six-digit sign-in code sent to your email.":"Sign in with your existing TaalLab account."}</p><form onSubmit={submit}>{!challenge?<><label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></label></>:<label>6-digit code<input inputMode="numeric" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} autoFocus required/></label>}{error&&<div className="ocean-error">{error}</div>}<button className="ocean-primary" disabled={busy}>{busy?"Please wait…":challenge?"Verify and continue":"Sign in"}</button></form><small>Your OCEAN workspace is private to your account.</small></div></div>;
}

function OceanDatabaseBlock({block,updateBlock}){
 const [menu,setMenu]=useState(""),[search,setSearch]=useState(""),[filter,setFilter]=useState(""),[sort,setSort]=useState(""),[hidden,setHidden]=useState([]),[groupBy,setGroupBy]=useState(1);
 const [calendarMonth,setCalendarMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
 const [quickAddDate,setQuickAddDate]=useState("");
 const [quickAddTitle,setQuickAddTitle]=useState("");
 const [quickAddAllDay,setQuickAddAllDay]=useState(false);
 const [quickAddStart,setQuickAddStart]=useState("10:00");
 const [quickAddEnd,setQuickAddEnd]=useState("11:00");
 const [quickAddLocation,setQuickAddLocation]=useState("");
 const [quickAddDescription,setQuickAddDescription]=useState("");
 const [quickAddReminder,setQuickAddReminder]=useState(true);
 const [quickAddColorId,setQuickAddColorId]=useState("");
 const [quickAddReminderMinutes,setQuickAddReminderMinutes]=useState(10);
 const [quickAddError,setQuickAddError]=useState("");
 const [renamePageTarget,setRenamePageTarget]=useState(null);
 const [renamePageTitle,setRenamePageTitle]=useState("");
 const [syncBusy,setSyncBusy]=useState(false);
 const [syncMessage,setSyncMessage]=useState("");
 const root=useRef(null);
 const view=block.view||"table";
 const views=[["Table","table"],["Board","board"],["Gallery","gallery"],["List","list"],["Calendar","calendar"],["Timeline","timeline"]];
 const sourceRows=Array.isArray(block.rows)&&block.rows.length?block.rows:[["Name","Status","Date"],["First item","In progress",""],["Second item","Not started",""]];
 const width=Math.max(1,...sourceRows.map(r=>r.length));
 const rows=sourceRows.map(r=>Array.from({length:width},(_,i)=>r[i]??""));
 const headers=rows[0]||["Name","Status","Date"];
 const visible=headers.map((h,i)=>i).filter(i=>!hidden.includes(i));
 let data=rows.slice(1).map((r,i)=>({r,i})).filter(x=>!filter||x.r.some(v=>String(v).toLowerCase().includes(filter.toLowerCase()))).filter(x=>!search||x.r.some(v=>String(v).toLowerCase().includes(search.toLowerCase())));
 if(sort){const [col,dir]=sort.split(":");data.sort((a,b)=>String(a.r[Number(col)]||"").localeCompare(String(b.r[Number(col)]||""),undefined,{numeric:true})*(dir==="desc"?-1:1));}
 const saveRows=next=>updateBlock(block.id,{rows:next});
 const editCell=(row,col,value)=>{const next=rows.map(r=>[...r]);next[row][col]=value;saveRows(next);};
 const addRow=(groupValue="")=>{const row=Array(width).fill("");if(groupValue&&groupBy<width)row[groupBy]=groupValue;saveRows([...rows,row]);};
 const addRowOnDate=day=>{const baseRows=detectedDateCol<0?rows.map((r,i)=>i===0?[...r,"Date"]:[...r,""]):rows;const targetDateCol=detectedDateCol<0?width:dateCol;const row=Array(Math.max(width,targetDateCol+1)).fill("");row[targetDateCol]=dateKey(day);saveRows([...baseRows,row]);};
 const resetQuickAdd=()=>{setQuickAddDate("");setQuickAddTitle("");setQuickAddAllDay(false);setQuickAddStart("10:00");setQuickAddEnd("11:00");setQuickAddLocation("");setQuickAddDescription("");setQuickAddReminder(true);setQuickAddReminderMinutes(10);setQuickAddColorId("");setQuickAddError("");};
 const openQuickAdd=day=>{setQuickAddDate(dateKey(day));setQuickAddTitle("");setQuickAddAllDay(false);setQuickAddStart("10:00");setQuickAddEnd("11:00");setQuickAddError("");};
 const createQuickAdd=async()=>{
  const title=quickAddTitle.trim();if(!title||!quickAddDate)return;
  setQuickAddError("");
  try{
   const connection=await api("/ocean/calendar/connection");
   if(!connection.connected){setQuickAddError("Connect Google Calendar first to sync this item.");return;}
   const payload={summary:title,calendarId:"primary",allDay:quickAddAllDay,startDate:quickAddDate,endDate:quickAddDate,location:quickAddLocation,description:quickAddDescription,reminderEnabled:quickAddReminder,reminderMinutes:quickAddReminderMinutes,colorId:quickAddColorId};
   if(!quickAddAllDay){
    const start=new Date(quickAddDate+"T"+quickAddStart),end=new Date(quickAddDate+"T"+quickAddEnd);
    if(end<=start){setQuickAddError("The end time must be after the start time.");return;}
    payload.start=start.toISOString();payload.end=end.toISOString();
   }
   await api("/ocean/calendar/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   const baseRows=detectedDateCol<0?rows.map((r,i)=>i===0?[...r,"Date"]:[...r,""]):rows;
   const targetDateCol=detectedDateCol<0?width:dateCol;
   const row=Array(Math.max(width,targetDateCol+1)).fill("");row[0]=title;row[targetDateCol]=quickAddDate;
   saveRows([...baseRows,row]);resetQuickAdd();
  }catch(e){setQuickAddError(e.message||"Could not sync this item to Google Calendar.");}
 };
 const syncExistingRows=async()=>{
  const dated=rows.slice(1).map(r=>({title:String(r[0]||"").trim(),date:parseDate(r[dateCol])})).filter(x=>x.title&&x.date);
  if(!dated.length){setSyncMessage("There are no dated items to sync.");return;}
  setSyncBusy(true);setSyncMessage("");
  try{
   const connection=await api("/ocean/calendar/connection");
   if(!connection.connected){setSyncMessage("Connect Google Calendar before syncing.");return;}
   const dates=dated.map(x=>dateKey(x.date)).sort();
   const min=new Date(dates[0]+"T00:00:00"),max=new Date(dates[dates.length-1]+"T00:00:00");max.setDate(max.getDate()+1);
   const q=new URLSearchParams({timeMin:min.toISOString(),timeMax:max.toISOString(),calendarId:"primary"});
   const existing=await api("/ocean/calendar/events?"+q.toString());
   const keys=new Set((existing.items||[]).map(e=>String(e.summary||"").trim().toLowerCase()+"|"+(e.start?.date||e.start?.dateTime?.slice(0,10)||"")));
   let added=0;
   for(const item of dated){
    const key=item.title.toLowerCase()+"|"+dateKey(item.date);
    if(keys.has(key))continue;
    await api("/ocean/calendar/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({summary:item.title,calendarId:"primary",allDay:true,startDate:dateKey(item.date),endDate:dateKey(item.date)})});
    keys.add(key);added++;
   }
   setSyncMessage(added?added+" item"+(added===1?"":"s")+" synced to Google Calendar.":"All dated items are already in Google Calendar.");
  }catch(e){setSyncMessage(e.message||"Could not sync existing items.");}
  finally{setSyncBusy(false);}
 };
 const addProperty=()=>{const name=prompt("Property name","New property");if(!name?.trim())return;saveRows(rows.map((r,i)=>i===0?[...r,name.trim()]:[...r,""]));};
 const renameProperty=i=>{const name=prompt("Rename property",headers[i]);if(name?.trim())editCell(0,i,name.trim());};
 const addView=v=>{updateBlock(block.id,{view:v});setMenu("");};
 const detectedDateCol=headers.findIndex(h=>/date|due|start/i.test(String(h)));
 const dateCol=detectedDateCol>=0?detectedDateCol:width;
 const firstWeekday=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),1).getDay();
 const daysInMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,0).getDate();
 const weekCount=Math.ceil((firstWeekday+daysInMonth)/7);
 const calendarStart=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),1-firstWeekday);
 const calendarDays=Array.from({length:weekCount*7},(_,i)=>new Date(calendarStart.getFullYear(),calendarStart.getMonth(),calendarStart.getDate()+i));
 const dateKey=day=>[day.getFullYear(),String(day.getMonth()+1).padStart(2,"0"),String(day.getDate()).padStart(2,"0")].join("-");
 const parseDate=value=>{const raw=String(value||"").trim();if(!raw)return null;const m=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));const parsed=new Date(raw);return Number.isNaN(parsed.getTime())?null:new Date(parsed.getFullYear(),parsed.getMonth(),parsed.getDate());};
 const rowsForDay=day=>data.filter(x=>{const d=parseDate(x.r[dateCol]);return d&&dateKey(d)===dateKey(day);});
 useEffect(()=>{const close=e=>{if(root.current&&!root.current.contains(e.target))setMenu("");};document.addEventListener("pointerdown",close);return()=>document.removeEventListener("pointerdown",close);},[]);
 const menuButton=(name,label,icon)=><button className={menu===name?"active":""} onClick={()=>setMenu(menu===name?"":name)}>{icon}{label}</button>;
 const newMenu=<div className="ocean-db-popover ocean-db-new-menu"><strong>New database</strong><button onClick={()=>{addRow();setMenu("");}}><Plus size={15}/> New page</button><button onClick={()=>{addRow();setMenu("");}}><FilePlus size={15}/> New page with template</button><button onClick={()=>{const title=prompt("Database template name","Tasks tracker");if(title){saveRows([headers,...rows.slice(1),[title,"Not started",""]]);}setMenu("");}}><CheckSquare size={15}/> Tasks tracker</button></div>;
 return <div className="ocean-database-block ocean-db-notion" ref={root}>
  <div className="ocean-db-heading"><input value={block.text??""} placeholder="New database" aria-label="Database name" onChange={e=>updateBlock(block.id,{text:e.target.value})}/><div className="ocean-db-view-tabs">{views.filter(v=>["table","board","gallery","list","calendar"].includes(v[1])).map(([label,key])=><button key={key} className={view===key?"active":""} onClick={()=>addView(key)}>{label}</button>)}<button onClick={()=>setMenu(menu==="views"?"":"views")}><Plus size={14}/> Add a view</button>{menu==="views"&&<div className="ocean-db-popover ocean-db-views">{views.map(([label,key])=><button key={key} onClick={()=>addView(key)}>{label}{view===key?" ✓":""}</button>)}</div>}</div></div>
  <div className="ocean-db-controls">
   <div className="ocean-db-control-left">{menuButton("filter","Filter",<SlidersHorizontal size={14}/>)}{menuButton("sort","Sort",<ChevronsUpDown size={14}/>)}{menuButton("group","Group",<Columns3 size={14}/>)}{menuButton("search","Search",<Search size={14}/>)}{menuButton("properties","Properties",<Settings size={14}/>)}{menuButton("more","More",<MoreHorizontal size={14}/>)}</div>
   <div className="ocean-db-control-right"><button className="ocean-db-new" onClick={()=>setMenu(menu==="new"?"":"new")}>New <ChevronDown size={14}/></button></div>
   {menu==="new"&&newMenu}
   {menu==="filter"&&<div className="ocean-db-popover"><strong>Filter</strong><input autoFocus placeholder="Filter rows…" value={filter} onChange={e=>setFilter(e.target.value)}/><button onClick={()=>{setFilter("");setMenu("");}}>Clear filter</button></div>}
   {menu==="sort"&&<div className="ocean-db-popover"><strong>Sort by</strong>{headers.map((h,i)=><button key={i} onClick={()=>{setSort(i+":asc");setMenu("");}}>{h} ↑</button>)}<button onClick={()=>{setSort("");setMenu("");}}>Clear sort</button></div>}
   {menu==="group"&&<div className="ocean-db-popover"><strong>Group by</strong>{headers.map((h,i)=><button key={i} onClick={()=>{setGroupBy(i);setMenu("");}}>{h}{groupBy===i?" ✓":""}</button>)}</div>}
   {menu==="search"&&<div className="ocean-db-popover"><strong>Search database</strong><input autoFocus placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/><button onClick={()=>{setSearch("");setMenu("");}}>Done</button></div>}
   {menu==="properties"&&<div className="ocean-db-popover"><strong>Properties</strong>{headers.map((h,i)=><label key={i}><input type="checkbox" checked={!hidden.includes(i)} onChange={e=>setHidden(old=>e.target.checked?old.filter(x=>x!==i):[...old,i])}/>{h}</label>)}<button onClick={addProperty}><Plus size={14}/> Add a property</button></div>}
   {menu==="more"&&<div className="ocean-db-popover"><strong>Database options</strong><button onClick={()=>{const name=prompt("Rename database",block.text||"New database");if(name)updateBlock(block.id,{text:name});setMenu("");}}>Rename</button><button onClick={()=>{const copy={...block,id:uid(),text:(block.text||"New database")+" (copy)"};window.dispatchEvent(new CustomEvent("ocean-duplicate-block",{detail:copy}));setMenu("");}}>Duplicate database</button><button onClick={()=>{if(confirm("Delete this database block?"))window.dispatchEvent(new CustomEvent("ocean-delete-block",{detail:block.id}));setMenu("");}}>Delete database</button></div>}
  </div>
  {view==="table"&&<div className="ocean-db-table-scroll"><table className="ocean-db-table"><thead><tr>{visible.map(i=><th key={i}><button onClick={()=>renameProperty(i)}>{i===0?<Text size={13}/>:i===1?<CheckSquare size={13}/>:<Calendar size={13}/>} {headers[i]||"Property"}</button></th>)}<th><button onClick={addProperty}><Plus size={14}/> Add property</button></th></tr></thead><tbody>{data.map(({r,i})=><tr key={i}>{visible.map(c=><td key={c}><input value={r[c]||""} onChange={e=>editCell(i+1,c,e.target.value)} placeholder={c===0?"Untitled":""}/></td>)}<td/></tr>)}</tbody></table><button className="ocean-db-add-row" onClick={addRow}><Plus size={14}/> New page</button></div>}
  {view==="board"&&<div className="ocean-db-board">{[...new Set(data.map(x=>x.r[groupBy]||"No status"))].map((group,gi)=><section key={group}><header><span className={"ocean-db-status status-"+gi%4}/><strong>{group}</strong><small>{data.filter(x=>(x.r[groupBy]||"No status")===group).length}</small></header>{data.filter(x=>(x.r[groupBy]||"No status")===group).map(({r,i})=><article key={i}>{visible.filter(c=>c!==groupBy).map(c=><input key={c} value={r[c]||""} onChange={e=>editCell(i+1,c,e.target.value)} placeholder={headers[c]}/>)}</article>)}<button onClick={()=>addRow(group==="No status"?"":group)}><Plus size={14}/> New page</button></section>)}<button className="ocean-db-add-group" onClick={()=>{const name=prompt("New group name","New status");if(name)saveRows([...rows,[...Array(width).fill("").map((v,i)=>i===groupBy?name:v)]]);}}>+ New group</button></div>}
  {view==="calendar"&&<div className="ocean-db-calendar">
   <div className="ocean-db-calendar-toolbar"><div><strong>{calendarMonth.toLocaleDateString(undefined,{month:"long",year:"numeric"})}</strong><small>{data.filter(x=>parseDate(x.r[dateCol])).length} dated pages</small></div><div><button onClick={()=>setCalendarMonth(m=>new Date(m.getFullYear(),m.getMonth()-1,1))} aria-label="Previous month"><ChevronRight className="calendar-prev" size={16}/></button><button onClick={()=>setCalendarMonth(new Date(new Date().getFullYear(),new Date().getMonth(),1))}>Today</button><button onClick={()=>setCalendarMonth(m=>new Date(m.getFullYear(),m.getMonth()+1,1))} aria-label="Next month"><ChevronRight size={16}/></button><button onClick={syncExistingRows} disabled={syncBusy}>{syncBusy?"Syncing…":"Sync Google"}</button><button className="ocean-db-new" onClick={()=>addRowOnDate(new Date())}><Plus size={13}/> New page</button></div></div>
   {detectedDateCol<0&&<p className="ocean-db-calendar-hint">No Date property was found. The calendar is using column {dateCol+1} ({headers[dateCol]||"Property"}). Add or rename a Date property to make this clearer.</p>}
   <div className="ocean-db-calendar-grid" style={{"--db-calendar-weeks":weekCount}}>{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div className="ocean-db-calendar-weekday" key={d}>{d}</div>)}{calendarDays.map(day=><div key={dateKey(day)} className={"ocean-db-calendar-day "+(day.getMonth()!==calendarMonth.getMonth()?"outside":"")+(dateKey(day)===dateKey(new Date())?" today":"")}><div className="ocean-db-calendar-day-head"><button className="ocean-db-calendar-add" onClick={()=>openQuickAdd(day)} title={"Add an item on "+day.toLocaleDateString()} aria-label={"Add an item on "+dateKey(day)}><Plus size={13}/></button><button className="ocean-db-calendar-date" onClick={()=>openQuickAdd(day)} title="Add an item on this date"><span>{day.getDate()}</span></button></div><div className="ocean-db-calendar-items">{rowsForDay(day).map(({r,i})=><button key={i} title="Edit page title" onClick={()=>{setRenamePageTarget(i+1);setRenamePageTitle(r[0]||"Untitled");}}>{r[0]||"Untitled"}</button>)}</div></div>)}</div>
   <p className="ocean-db-calendar-hint">Select + on a date to add an item. New items sync to Google Calendar. Select an existing item to rename it.</p>
   {syncMessage&&<p className="ocean-db-calendar-hint">{syncMessage}</p>}
   {quickAddDate&&<div className="ocean-db-quickadd-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)resetQuickAdd();}}><form className="ocean-db-quickadd" onSubmit={e=>{e.preventDefault();createQuickAdd();}}>
    <div className="ocean-db-quickadd-head"><strong>Create calendar event</strong><button type="button" aria-label="Close" onClick={resetQuickAdd}>×</button></div>
    <label>Event title<input autoFocus required value={quickAddTitle} onChange={e=>setQuickAddTitle(e.target.value)} placeholder="Add title"/></label>
    <label>Date<input type="date" required value={quickAddDate} onChange={e=>setQuickAddDate(e.target.value)}/></label>
    <label className="ocean-db-quickadd-check"><input type="checkbox" checked={quickAddAllDay} onChange={e=>setQuickAddAllDay(e.target.checked)}/> All day</label>
    {!quickAddAllDay&&<div className="ocean-db-quickadd-time"><label>Starts<input type="time" value={quickAddStart} onChange={e=>setQuickAddStart(e.target.value)}/></label><label>Ends<input type="time" value={quickAddEnd} onChange={e=>setQuickAddEnd(e.target.value)}/></label></div>}
    <label>Location<input value={quickAddLocation} onChange={e=>setQuickAddLocation(e.target.value)} placeholder="Add location"/></label>
    <label>Description<textarea rows={3} value={quickAddDescription} onChange={e=>setQuickAddDescription(e.target.value)} placeholder="Add description"/></label>
    <div className="ocean-db-quickadd-reminder"><label className="ocean-db-quickadd-check"><input type="checkbox" checked={quickAddReminder} onChange={e=>setQuickAddReminder(e.target.checked)}/> Notification</label><small className="ocean-reminder-context">Reminder is sent before the event starts.</small><select disabled={!quickAddReminder} value={quickAddReminderMinutes} onChange={e=>setQuickAddReminderMinutes(Number(e.target.value))}><option value="0">At event time</option><option value="5">5 minutes before</option><option value="10">10 minutes before</option><option value="15">15 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option><option value="120">2 hours before</option><option value="1440">1 day before</option><option value="2880">2 days before</option><option value="10080">1 week before</option></select></div>
    <div className="ocean-google-event-color"><div><Palette size={16}/> Event colour</div><div className="ocean-google-event-swatches"><button type="button" title="Default colour" className={!quickAddColorId?"selected default":""} onClick={()=>setQuickAddColorId("")}><span/></button>{OCEAN_EVENT_COLORS.map(c=><button type="button" key={c.id} title={c.name} aria-label={c.name} className={quickAddColorId===c.id?"selected":""} style={{"--swatch":c.hex}} onClick={()=>setQuickAddColorId(c.id)}/>)}</div></div>
    {quickAddError&&<p className="ocean-db-quickadd-error">{quickAddError} {quickAddError.includes("Connect Google")&&<button type="button" onClick={()=>{window.location.href="/api/ocean/calendar/connect";}}>Connect Google Calendar</button>}</p>}
    <div className="ocean-db-quickadd-actions"><button type="button" onClick={resetQuickAdd}>Cancel</button><button type="submit" disabled={!quickAddTitle.trim()||!quickAddDate}>Create event</button></div>
   </form></div>}
   {renamePageTarget!==null&&<div className="ocean-db-quickadd-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setRenamePageTarget(null);}}><form className="ocean-db-quickadd" onSubmit={e=>{e.preventDefault();editCell(renamePageTarget,0,renamePageTitle);setRenamePageTarget(null);}}><div className="ocean-db-quickadd-head"><strong>Rename page</strong><button type="button" aria-label="Close" onClick={()=>setRenamePageTarget(null)}>×</button></div><label>Page title<input autoFocus value={renamePageTitle} onChange={e=>setRenamePageTitle(e.target.value)} placeholder="Page title"/></label><div className="ocean-db-quickadd-actions ocean-db-rename-actions"><button type="button" className="ocean-db-delete-page" onClick={()=>{if(window.confirm("Delete this page from the database? This cannot be undone.")){saveRows(rows.filter((_,rowIndex)=>rowIndex!==renamePageTarget));setRenamePageTarget(null);}}}><Trash2 size={14}/> Delete page</button><span/><button type="button" onClick={()=>setRenamePageTarget(null)}>Cancel</button><button type="submit" disabled={!renamePageTitle.trim()}>Save</button></div></form></div>}
  </div>}
  {["list","gallery","timeline"].includes(view)&&<div className={"ocean-db-cards "+view}>{data.map(({r,i})=><article key={i}>{visible.map(c=><label key={c}><small>{headers[c]}</small><input value={r[c]||""} onChange={e=>editCell(i+1,c,e.target.value)}/></label>)}</article>)}<button onClick={addRow}><Plus size={14}/> New page</button></div>}
  <div className="ocean-db-footer">{data.length} {data.length===1?"page":"pages"} <span>·</span> {headers.length} properties</div>
 </div>;
}

function OceanGoogleCalendarBlock(){
 const [connection,setConnection]=useState({connected:false,email:""});
 const [calendars,setCalendars]=useState([]);
 const [calendarId,setCalendarId]=useState("primary");
 const [events,setEvents]=useState([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
 const [editingId,setEditingId]=useState(null);
 const [draft,setDraft]=useState(null);
 const [saving,setSaving]=useState(false);
 const [eventDetails,setEventDetails]=useState(null);
 const [reminderCustom,setReminderCustom]=useState(false);
 const firstWeekday=new Date(month.getFullYear(),month.getMonth(),1).getDay();
 const daysInMonth=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
 const weekCount=Math.ceil((firstWeekday+daysInMonth)/7);
 const gridStart=new Date(month.getFullYear(),month.getMonth(),1-firstWeekday);
 const gridEnd=new Date(gridStart.getFullYear(),gridStart.getMonth(),gridStart.getDate()+weekCount*7);
 const dateKey=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
 const localInput=d=>{const value=new Date(d);return new Date(value.getTime()-value.getTimezoneOffset()*60000).toISOString().slice(0,16);};
 const eventDate=e=>e.start?.dateTime?new Date(e.start.dateTime):new Date((e.start?.date||"")+"T09:00:00");
 const eventColors=OCEAN_EVENT_COLORS;
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const c=await api("/ocean/calendar/connection");setConnection(c);
   if(c.connected){
    const list=await api("/ocean/calendar/calendars");
    setCalendars(list.items||[]);
    const q=new URLSearchParams({timeMin:gridStart.toISOString(),timeMax:gridEnd.toISOString(),calendarId});
    const data=await api("/ocean/calendar/events?"+q.toString());setEvents(data.items||[]);
   }else{setCalendars([]);setEvents([]);}
  }catch(e){setError(e.message);}
  finally{setLoading(false);}
 },[month.getFullYear(),month.getMonth(),calendarId]);
 useEffect(()=>{load();},[load]);
 const openForm=(event=null,day=new Date())=>{
  const start=event?eventDate(event):new Date(day.getFullYear(),day.getMonth(),day.getDate(),10,0);
  const end=event?.end?.dateTime?new Date(event.end.dateTime):new Date(start.getTime()+3600000);
  const allDay=event?!!event?.start?.date:false;
  const startDate=event?.start?.date||dateKey(start);
  let endDate=startDate;
  if(event?.end?.date){const d=new Date(event.end.date+"T12:00:00");d.setDate(d.getDate()-1);endDate=dateKey(d);}
  const freq=event?.recurrence?.[0]?.match(/FREQ=([^;]+)/)?.[1]||"";
  const override=event?.reminders?.overrides?.[0];
  const reminderValue=override?.minutes??10;
  setReminderCustom(![0,5,10,15,30,60,120,1440,2880,10080].includes(reminderValue));
  setEditingId(event?.id||"new");
  setDraft({
   summary:event?.summary||"",allDay,startDate,endDate,
   start:localInput(start),end:localInput(end),
   description:event?.description||"",location:event?.location||"",
   repeat:({DAILY:"daily",WEEKLY:"weekly",MONTHLY:"monthly",YEARLY:"yearly"})[freq]||"none",
   reminderEnabled:event?event.reminders?.useDefault===false?!!override:true:true,
   reminderMinutes:reminderValue,
   colorId:event?.colorId||""
  });
 };
 const save=async e=>{
  e.preventDefault();if(!draft)return;
  if(!draft.summary.trim()){setError("Add an event title.");return;}
  if(draft.allDay){
   if(!draft.startDate||!draft.endDate||draft.endDate<draft.startDate){setError("Choose a valid event date range.");return;}
  }else if(new Date(draft.end)<=new Date(draft.start)){setError("The event end must be after its start.");return;}
  setSaving(true);setError("");
  try{
   const payload={
    summary:draft.summary.trim(),calendarId,allDay:draft.allDay,
    ...(draft.allDay?{startDate:draft.startDate,endDate:draft.endDate}:{start:new Date(draft.start).toISOString(),end:new Date(draft.end).toISOString()}),
    description:draft.description,location:draft.location,
    recurrence:draft.repeat==="none"?"":"RRULE:FREQ="+({daily:"DAILY",weekly:"WEEKLY",monthly:"MONTHLY",yearly:"YEARLY"}[draft.repeat]||""),
    reminderEnabled:draft.reminderEnabled,reminderMinutes:Number(draft.reminderMinutes)||0,
    colorId:draft.colorId||""
   };
   if(editingId==="new")await api("/ocean/calendar/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   else await api("/ocean/calendar/events/"+encodeURIComponent(editingId),{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   setDraft(null);setEditingId(null);await load();
  }catch(e){setError(e.message);}
  finally{setSaving(false);}
 };
 const remove=async id=>{
  if(!confirm("Delete this event from Google Calendar?"))return;
  setError("");
  try{await api("/ocean/calendar/events/"+encodeURIComponent(id)+"?calendarId="+encodeURIComponent(calendarId),{method:"DELETE"});setDraft(null);setEditingId(null);await load();}
  catch(e){setError(e.message);}
 };
 const deleteFromDetails=async()=>{if(!eventDetails)return;await remove(eventDetails.id);setEventDetails(null);};
 const editFromDetails=()=>{if(!eventDetails)return;const event=eventDetails;setEventDetails(null);openForm(event);};
 const displayDate=e=>{const start=eventDate(e);if(e.start?.date){const end=e.end?.date?new Date(e.end.date+"T12:00:00"):start;end.setDate(end.getDate()-1);return start.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"})+(dateKey(start)!==dateKey(end)?" – "+end.toLocaleDateString(undefined,{month:"long",day:"numeric",year:"numeric"}):"");}return start.toLocaleString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"})+" – "+new Date(e.end?.dateTime||start).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"});};
 const eventColor=e=>eventColors.find(c=>c.id===e.colorId)?.hex||"";
 const days=Array.from({length:weekCount*7},(_,i)=>new Date(gridStart.getFullYear(),gridStart.getMonth(),gridStart.getDate()+i));
 const byDay=day=>events.filter(e=>dateKey(eventDate(e))===dateKey(day));
 const timeLabel=e=>e.start?.dateTime?new Date(e.start.dateTime).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"}):"All day";
 const goToday=()=>setMonth(new Date(new Date().getFullYear(),new Date().getMonth(),1));
 const selectedCalendar=calendars.find(c=>c.id===calendarId)||calendars.find(c=>c.primary);
 return <section className="ocean-note-calendar">
  <div className="ocean-calendar-titlebar"><h3>Calendar View</h3><span><span className="ocean-calendar-live-dot"/> {connection.connected?"Google Calendar connected":"Google Calendar not connected"}</span></div>
  <div className="ocean-calendar-toolbar">
   <div className="ocean-calendar-filter"><Calendar size={15}/> {selectedCalendar?.summary||"All events"}</div>
   <div className="ocean-calendar-toolbar-actions">
    <a className="ocean-calendar-manage" href="https://calendar.google.com/calendar/u/0/r/month" target="_blank" rel="noreferrer">↗ <span>Manage in Calendar</span></a>
    <div className="ocean-calendar-month-controls">
     <button onClick={()=>setMonth(m=>new Date(m.getFullYear(),m.getMonth()-1,1))} aria-label="Previous month"><ChevronRight className="calendar-prev" size={17}/></button>
     <button onClick={goToday}>Today</button>
     <button onClick={()=>setMonth(m=>new Date(m.getFullYear(),m.getMonth()+1,1))} aria-label="Next month"><ChevronRight size={17}/></button>
    </div>
    <button className="ocean-primary ocean-calendar-new" onClick={()=>openForm(null,new Date())}><Plus size={14}/> New event</button>
   </div>
  </div>
  {connection.connected&&calendars.length>0&&<div className="ocean-google-calendar-picker"><label>Calendar<select value={calendarId} onChange={e=>setCalendarId(e.target.value)}>{calendars.map(c=><option key={c.id} value={c.primary?"primary":c.id}>{c.summary}{c.primary?" (Primary)":""}</option>)}</select></label><span style={{background:selectedCalendar?.backgroundColor||"#4285f4"}}/></div>}
  <div className="ocean-calendar-month-heading"><h4>{month.toLocaleDateString(undefined,{month:"long",year:"numeric"})}</h4><span>Click a day to add an event</span></div>
  {!connection.connected&&!loading?<div className="ocean-note-calendar-connect"><p>Connect Google Calendar to add and manage events from this note.</p><button className="ocean-primary" onClick={()=>{window.location.href="/api/ocean/calendar/connect";}}>Connect Google Calendar</button></div>:null}
  {error&&<div className="ocean-admin-error">{error}</div>}
  {loading?<div className="ocean-note-calendar-loading"><span className="ocean-mini-spinner"/> Loading your calendar…</div>:connection.connected?<div className="ocean-month-grid" style={{"--calendar-week-count":weekCount}}>
   {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div className="ocean-month-weekday" key={d}>{d}</div>)}
   {days.map(day=><div key={dateKey(day)} className={"ocean-month-day "+(day.getMonth()!==month.getMonth()?"outside":"")+(dateKey(day)===dateKey(new Date())?" today":"")}>
    <button className="ocean-month-day-number" onClick={()=>openForm(null,day)} title="Add event on this day"><span>{day.getDate()}</span><Plus size={13}/></button>
    <div className="ocean-month-day-events">{byDay(day).slice(0,4).map(event=><button key={event.id} className="ocean-month-event" style={eventColor(event)?{"--event-color":eventColor(event)}:{}} title={event.summary||"Untitled event"} onClick={()=>setEventDetails(event)}><span>{timeLabel(event)}</span>{event.summary||"(No title)"}</button>)}{byDay(day).length>4&&<small>+{byDay(day).length-4} more</small>}</div>
   </div>)}
  </div>:null}
  {eventDetails&&<div className="ocean-google-event-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEventDetails(null);}}><section className="ocean-google-event-detail"><div className="ocean-google-detail-top"><span style={{background:eventColor(eventDetails)||"#4285f4"}}/><button type="button" aria-label="Close" onClick={()=>setEventDetails(null)}><X size={19}/></button></div><h3>{eventDetails.summary||"(No title)"}</h3><p className="ocean-google-detail-date"><Calendar size={17}/>{displayDate(eventDetails)}</p>{eventDetails.location&&<p><MapPin size={17}/>{eventDetails.location}</p>}{eventDetails.description&&<p className="ocean-google-detail-description"><AlignLeft size={17}/>{eventDetails.description}</p>}<p><Calendar size={17}/>{selectedCalendar?.summary||"Google Calendar"}</p><p><Bell size={17}/>{eventDetails.reminders?.useDefault===false?(eventDetails.reminders?.overrides?.length?eventDetails.reminders.overrides.map(x=>x.minutes===0?"At event time":x.minutes<60?x.minutes+" minutes before":x.minutes%1440===0?x.minutes/1440+" days before":x.minutes/60+" hours before").join(", "):"No notification"):"Default notifications"}</p><div className="ocean-google-detail-actions"><button type="button" className="danger" onClick={deleteFromDetails}><Trash2 size={15}/> Delete event</button><span/><button type="button" onClick={()=>setEventDetails(null)}>Close</button><button type="button" className="primary" onClick={editFromDetails}><Settings size={15}/> Edit event</button></div></section></div>}
  {draft&&<div className="ocean-google-event-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget){setDraft(null);setEditingId(null);}}}>
   <form className="ocean-google-event-form" onSubmit={save}>
    <div className="ocean-google-event-head"><button type="button" aria-label="Close" onClick={()=>{setDraft(null);setEditingId(null);}}><X size={21}/></button><input autoFocus required maxLength={500} placeholder="Add title" value={draft.summary} onChange={e=>setDraft(v=>({...v,summary:e.target.value}))}/></div>
    <div className="ocean-google-event-dates">
     {draft.allDay?<><label>Starts<input type="date" required value={draft.startDate} onChange={e=>setDraft(v=>({...v,startDate:e.target.value,endDate:v.endDate<e.target.value?e.target.value:v.endDate}))}/></label><span>to</span><label>Ends<input type="date" required value={draft.endDate} min={draft.startDate} onChange={e=>setDraft(v=>({...v,endDate:e.target.value}))}/></label></>:<><label>Starts<input type="datetime-local" required value={draft.start} onChange={e=>setDraft(v=>({...v,start:e.target.value}))}/></label><span>to</span><label>Ends<input type="datetime-local" required value={draft.end} onChange={e=>setDraft(v=>({...v,end:e.target.value}))}/></label></>}
    </div>
    <div className="ocean-google-event-options"><label className="ocean-google-event-check"><input type="checkbox" checked={draft.allDay} onChange={e=>setDraft(v=>({...v,allDay:e.target.checked}))}/> All day</label><label className="ocean-google-event-repeat"><select value={draft.repeat} onChange={e=>setDraft(v=>({...v,repeat:e.target.value}))}><option value="none">Does not repeat</option><option value="daily">Every day</option><option value="weekly">Every week</option><option value="monthly">Every month</option><option value="yearly">Every year</option></select></label></div>
    <div className="ocean-google-event-details">
     <div className="ocean-google-event-tab">Event details</div>
     <label className="ocean-google-event-field"><MapPin size={17}/><input placeholder="Add location" value={draft.location} onChange={e=>setDraft(v=>({...v,location:e.target.value}))}/></label>
     <div className="ocean-google-event-field ocean-google-event-reminder"><Bell size={17}/><label><input type="checkbox" checked={draft.reminderEnabled} onChange={e=>setDraft(v=>({...v,reminderEnabled:e.target.checked}))}/> Notify me</label><small className="ocean-reminder-context">Before the event starts</small><select disabled={!draft.reminderEnabled} value={reminderCustom?"custom":String(draft.reminderMinutes)} onChange={e=>{if(e.target.value==="custom"){setReminderCustom(true);setDraft(v=>({...v,reminderMinutes:v.reminderMinutes||10}));}else{setReminderCustom(false);setDraft(v=>({...v,reminderMinutes:Number(e.target.value)}));}}}><option value="0">At event time</option><option value="5">5 minutes before</option><option value="10">10 minutes before</option><option value="15">15 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option><option value="120">2 hours before</option><option value="1440">1 day before</option><option value="2880">2 days before</option><option value="10080">1 week before</option><option value="custom">Custom…</option></select>{reminderCustom&&<input aria-label="Custom reminder minutes" type="number" min="0" max="40320" disabled={!draft.reminderEnabled} value={draft.reminderMinutes} onChange={e=>setDraft(v=>({...v,reminderMinutes:e.target.value}))}/>}</div>
     <div className="ocean-google-event-color"><div><Palette size={17}/> Event colour</div><div className="ocean-google-event-swatches"><button type="button" title="Default colour" className={!draft.colorId?"selected default":""} onClick={()=>setDraft(v=>({...v,colorId:""}))}><span/></button>{eventColors.map(c=><button type="button" key={c.id} title={c.name} aria-label={c.name} className={draft.colorId===c.id?"selected":""} style={{"--swatch":c.hex}} onClick={()=>setDraft(v=>({...v,colorId:c.id}))}/>)}</div></div>
     <div className="ocean-google-event-field ocean-google-event-calendar"><Calendar size={17}/><label>{selectedCalendar?.summary||"Calendar"}</label><select value={calendarId} onChange={e=>setCalendarId(e.target.value)}>{calendars.map(c=><option key={c.id} value={c.primary?"primary":c.id}>{c.summary}</option>)}</select><span style={{background:selectedCalendar?.backgroundColor||"#4285f4"}}/></div>
     <label className="ocean-google-event-description"><AlignLeft size={17}/><textarea rows={5} placeholder="Add description" value={draft.description} onChange={e=>setDraft(v=>({...v,description:e.target.value}))}/></label>
    </div>
    <div className="ocean-google-event-actions">{editingId!=="new"&&<button type="button" className="danger" onClick={()=>remove(editingId)}><Trash2 size={15}/> Delete</button>}<span/><button type="button" onClick={()=>{setDraft(null);setEditingId(null);}}>Cancel</button><button type="submit" disabled={saving}>{saving?"Saving…":"Save"}</button></div>
   </form>
  </div>}
  {connection.connected&&<footer className="ocean-note-calendar-foot"><ShieldCheck size={14}/> Events are synced directly with {connection.email||"your Google account"}.</footer>}
 </section>;
}

function OceanApp(){
 const [user,setUser]=useState(null),[checking,setChecking]=useState(true),[authError,setAuthError]=useState("");
 const [pages,setPages]=useState([]),[page,setPage]=useState(null),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false);
 const [collapsed,setCollapsed]=useState(false),[theme,setTheme]=useState("light"),[query,setQuery]=useState(""),[showSearch,setShowSearch]=useState(false),[showSlash,setShowSlash]=useState(false),[slashQuery,setSlashQuery]=useState(""),[slashBlock,setSlashBlock]=useState(null),[slashFromTyping,setSlashFromTyping]=useState(false),[activeSlashIndex,setActiveSlashIndex]=useState(0);
 const [showComments,setShowComments]=useState(false),[comments,setComments]=useState([]),[comment,setComment]=useState("");
 const [showAccount,setShowAccount]=useState(false),[showPageMenu,setShowPageMenu]=useState(false),[menuBlock,setMenuBlock]=useState(null),[colorMenu,setColorMenu]=useState(false);
 const [toast,setToast]=useState("");
 const editorRef=useRef(null),slashInput=useRef(null),saveTimer=useRef(null),blockRefs=useRef({});
 const [activeView,setActiveView]=useState("Table");
 const [mobileNav,setMobileNav]=useState(false);
 useEffect(()=>{const saved=localStorage.getItem("ocean-theme");if(saved==="dark"||saved==="light")setTheme(saved);},[]);
 useEffect(()=>{localStorage.setItem("ocean-theme",theme);},[theme]);
 const [activePanel,setActivePanel]=useState("page"),[adminUsers,setAdminUsers]=useState([]),[adminLoading,setAdminLoading]=useState(false),[adminError,setAdminError]=useState("");
 const [calendarConnection,setCalendarConnection]=useState({connected:false,email:""});
 const [calendarEvents,setCalendarEvents]=useState([]);
 const [calendarLoading,setCalendarLoading]=useState(false);
 const [calendarError,setCalendarError]=useState("");
 const [calendarForm,setCalendarForm]=useState(null);
 const [calendarDraft,setCalendarDraft]=useState({summary:"",start:"",end:"",description:"",location:""});
 const [calendarSaving,setCalendarSaving]=useState(false);

 useEffect(()=>{
  const oldTitle=document.title;
  let icon=document.querySelector('link[rel~="icon"]');
  const madeIcon=!icon;
  if(!icon){icon=document.createElement("link");icon.rel="icon";document.head.appendChild(icon);}
  const oldHref=icon.href;
  const waveSvg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32"><g fill="none" stroke="#0878e8" stroke-width="3.2" stroke-linecap="round"><path d="M3 11.5C8 5.5 13 5.5 18 11.5S28 17.5 33 11.5 43 5.5 47 11.5"/><path d="M3 20C8 14 13 14 18 20s10 6 15 0 10-6 14 0"/><path d="M3 28C8 22 13 22 18 28s10 6 15 0 10-6 14 0"/></g></svg>';
  document.title="OCEAN — Your workspace";
  icon.href="data:image/svg+xml,"+encodeURIComponent(waveSvg);
  return()=>{document.title=oldTitle;if(madeIcon)icon.remove();else icon.href=oldHref;};
 },[]);

 const loadPages=useCallback(async()=>{const data=await api("/ocean/pages");setPages(data.pages||[]);return data.pages||[];},[]);
 const openPage=useCallback(async(id)=>{setActivePanel("page");setMobileNav(false);setLoading(true);setShowSlash(false);setShowPageMenu(false);try{const data=await api("/ocean/pages/"+id);const p=data.page;p.blocks=JSON.parse(p.blocks_json||"[]");setPage(p);setShowComments(false);}catch(e){setToast(e.message);}finally{setLoading(false);}},[]);
 useEffect(()=>{let alive=true;api("/auth/me").then(async d=>{if(!alive)return;if(!d.authenticated){setChecking(false);return;}setUser(d.user);if(d.user.role!=="admin"&&d.user.role!=="super_user")return;const list=await loadPages();if(alive&&list.length)await openPage(list[0].id);}).catch(e=>setAuthError(e.message)).finally(()=>{if(alive)setChecking(false);});return()=>{alive=false;};},[loadPages,openPage]);
 useEffect(()=>{if(!page)return;clearTimeout(saveTimer.current);setSaving(true);saveTimer.current=setTimeout(async()=>{try{await api("/ocean/pages/"+page.id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:page.title,icon:page.icon,cover:page.cover,blocks:page.blocks,is_favorite:!!page.is_favorite})});setPages(old=>old.map(p=>p.id===page.id?{...p,title:page.title,icon:page.icon,cover:page.cover,is_favorite:page.is_favorite,updated_at:Math.floor(Date.now()/1000)}:p));setSaving(false);}catch(e){setSaving(false);setToast("Couldn't save: "+e.message);}},650);return()=>clearTimeout(saveTimer.current);},[page]);
 useEffect(()=>{if(showSlash){setActiveSlashIndex(0);slashInput.current?.focus();}},[showSlash]);
  useEffect(()=>{setActiveSlashIndex(0);},[slashQuery]);
  useEffect(()=>{if(showSlash)document.querySelector(".ocean-slash-option.is-active")?.scrollIntoView({block:"nearest"});},[activeSlashIndex,showSlash]);
 useEffect(()=>{if(!showSlash)return;const closeOutside=e=>{const menu=document.querySelector(".ocean-slash-menu");if(menu&&!menu.contains(e.target)){setShowSlash(false);setSlashQuery("");setSlashBlock(null);setSlashFromTyping(false);}};document.addEventListener("pointerdown",closeOutside);return()=>document.removeEventListener("pointerdown",closeOutside);},[showSlash]);
 useEffect(()=>{const duplicate=e=>setPage(old=>old?{...old,blocks:[...old.blocks,e.detail]}:old);const remove=e=>setPage(old=>old?{...old,blocks:old.blocks.filter(b=>b.id!==e.detail)}:old);window.addEventListener("ocean-duplicate-block",duplicate);window.addEventListener("ocean-delete-block",remove);return()=>{window.removeEventListener("ocean-duplicate-block",duplicate);window.removeEventListener("ocean-delete-block",remove);};},[]);
 useEffect(()=>{if(activePanel==="access"&&user?.role==="admin"){setAdminLoading(true);api("/ocean/admin/users").then(d=>setAdminUsers(d.users||[])).catch(e=>setAdminError(e.message)).finally(()=>setAdminLoading(false));}},[activePanel,user?.role]);
 useEffect(()=>{
  if(activePanel!=="calendar")return;
  let alive=true;
  setCalendarLoading(true);setCalendarError("");
  api("/ocean/calendar/connection").then(async connection=>{
   if(!alive)return;setCalendarConnection(connection);
   if(connection.connected){const events=await api("/ocean/calendar/events");if(alive)setCalendarEvents(events.items||[]);}
   else if(alive)setCalendarEvents([]);
  }).catch(e=>{if(alive)setCalendarError(e.message);}).finally(()=>{if(alive)setCalendarLoading(false);});
  return()=>{alive=false;};
 },[activePanel]);
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  const status=params.get("calendar");
  if(status){setActivePanel("calendar");if(status==="connected")setToast("Google Calendar connected successfully.");else if(status==="error")setCalendarError(params.get("calendar_error")||"Google Calendar connection failed.");window.history.replaceState({},document.title,window.location.pathname);}
 },[]);

 useEffect(()=>{const onKey=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setShowSearch(v=>!v);}if(e.key==="Escape"){setShowSearch(false);setShowPageMenu(false);setShowSlash(false);setSlashFromTyping(false);}};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);},[]);

 useEffect(()=>{if(showComments&&page)api("/ocean/pages/"+page.id+"/comments").then(d=>setComments(d.comments||[])).catch(()=>{});},[showComments,page?.id]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(""),2800);return()=>clearTimeout(t);},[toast]);
 const filteredPages=useMemo(()=>pages.filter(p=>!query||p.title.toLowerCase().includes(query.toLowerCase())),[pages,query]);
 const favoritePages=filteredPages.filter(p=>p.is_favorite);
 const regularPages=filteredPages.filter(p=>!p.is_favorite);
 const renderSidebarPages=(parentId=null,depth=0)=>regularPages.filter(p=>(p.parent_id||null)===parentId).map(p=><React.Fragment key={p.id}>
  <div className="ocean-page-row">
   <button className={"ocean-page-link "+(page?.id===p.id?"selected":"")} style={{paddingLeft:8+depth*15}} onClick={()=>{openPage(p.id);setMobileNav(false);}}><span>{p.icon||"▤"}</span><span>{p.title}</span></button>
   <button className="ocean-page-add" title="Create subpage" onClick={()=>createPage(p.id)}>+</button>
  </div>
  {renderSidebarPages(p.id,depth+1)}
 </React.Fragment>);

 const updatePage=(patch)=>setPage(old=>old?{...old,...patch}:old);
 const updateBlock=(id,patch)=>setPage(old=>old?{...old,blocks:(old.blocks||[]).map(b=>b.id===id?{...b,...patch}:b)}:old);
 const buildBlock=(type)=>{
  let block=blankBlock(type);
  if(type.startsWith("database-")){block={...block,type:"database",view:type.replace("database-",""),text:"New database",rows:[["Name","Status","Date"],["First item","In progress",""],["Second item","Not started",""]]};}if(type==="google-calendar"){block={...block,type:"google-calendar",text:"Google Calendar"};}
  if(type.startsWith("chart-")){block={...block,type:"chart",view:type.replace("chart-",""),text:"New chart",rows:[["Category","Value"],["A","8"],["B","5"],["C","3"]]};}
  if(type==="table")block={...block,rows:[["","",""],["","",""],["","",""]]};
  if(type.startsWith("columns"))block={...block,type:"columns",count:Number(type.slice(-1)),text:"Add content in each column"};
  if(["image","video","audio","file","bookmark","embed","google-drive","maps","pdf","html","gist","figma","excalidraw","loom","typeform","codepen","replit","deepnote","trello","slack","pitch","onedrive","dropbox","tweet"].includes(type))block.url="";
  return block;
 };
  const insertBlock=(type,afterId=null,removeSlash=false)=>{
   const block=buildBlock(type);
   const needsFollowingParagraph=block.type==="divider"||block.type==="database"||block.type==="chart"||block.type==="google-calendar";
   const following=needsFollowingParagraph?blankBlock("text"):null;
   setPage(old=>{
    if(!old)return old;
    const arr=[...(old.blocks||[])];let idx=afterId?arr.findIndex(b=>b.id===afterId):-1;
    if(removeSlash&&idx>=0){const liveText=blockRefs.current[afterId]?.innerText??arr[idx].text??"";const slashAt=liveText.lastIndexOf("/");const cleaned=slashAt>=0?liveText.slice(0,slashAt):liveText;arr[idx]={...arr[idx],text:cleaned,html:""};}
    arr.splice(idx+1,0,block);if(following)arr.splice(idx+2,0,following);return {...old,blocks:arr};
   });
   setShowSlash(false);setSlashQuery("");setSlashBlock(null);setSlashFromTyping(false);setActiveSlashIndex(0);
   setTimeout(()=>focusContentEnd(blockRefs.current[following?.id||block.id]),80);
  };
 const chooseCommand=(type)=>{
   const target=slashBlock||page.blocks.at(-1)?.id;
   let field="",value="";
   if(type==="highlight-blue"){field="bgColor";value="#eaf4ff";}
   else if(type==="color-reset"){field="reset";value="";}
   else if(type.startsWith("custom-text-color-")){field="textColor";value=type.slice("custom-text-color-".length);}
   else if(type.startsWith("custom-background-color-")){field="bgColor";value=type.slice("custom-background-color-".length);}
   else if(type.startsWith("text-color-")){field="textColor";value=SLASH_COLORS.find(c=>c[0].toLowerCase()===type.slice(11))?.[1]||"";}
   else if(type.startsWith("background-color-")){field="bgColor";value=SLASH_COLORS.find(c=>c[0].toLowerCase()===type.slice(17))?.[2]||"";}
   if(field){
    const liveText=target?(blockRefs.current[target]?.innerText??page.blocks.find(b=>b.id===target)?.text??""):"";
    const cleaned=slashFromTyping&&liveText.endsWith("/")?liveText.slice(0,-1):liveText;
    if(target)updatePage({blocks:page.blocks.map(b=>b.id===target?{...b,text:cleaned,html:formatInlineMarkdown(cleaned),...(field==="reset"?{textColor:"",bgColor:""}:{[field]:value})}:b)});
    else{const block={...blankBlock("text"),...(field==="reset"?{textColor:"",bgColor:""}:{[field]:value})};setPage(old=>old?{...old,blocks:[...(old.blocks||[]),block]}:old);}
    setShowSlash(false);setSlashQuery("");setSlashBlock(null);setSlashFromTyping(false);setActiveSlashIndex(0);
    setTimeout(()=>focusContentEnd(blockRefs.current[target]||null),50);return;
   }
   insertBlock(type,target,!!slashBlock);
  };
 const createPage=async(parentId=null)=>{try{const d=await api("/ocean/pages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:"Untitled",parent_id:parentId})});await loadPages();await openPage(d.page.id);setMobileNav(false);}catch(e){setToast(e.message);}};
 const deletePage=async()=>{if(!page||!confirm("Move this page to trash?"))return;try{await api("/ocean/pages/"+page.id,{method:"DELETE"});const list=await loadPages();setPage(null);if(list[0])openPage(list[0].id);setShowPageMenu(false);}catch(e){setToast(e.message);}};
 const addComment=async(e)=>{e.preventDefault();if(!comment.trim())return;try{await api("/ocean/pages/"+page.id+"/comments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({body:comment})});setComment("");const d=await api("/ocean/pages/"+page.id+"/comments");setComments(d.comments||[]);}catch(e){setToast(e.message);}};
 const signOut=async()=>{try{await api("/auth/logout",{method:"POST"});}catch{}setUser(null);setPage(null);setPages([]);};
 const updateTableCell=(blockId,row,col,value)=>updateBlock(blockId,{rows:page.blocks.find(b=>b.id===blockId).rows.map((r,ri)=>r.map((v,ci)=>ri===row&&ci===col?value:v))});
 const promptUrl=(id,label)=>{const url=prompt("Paste "+label+" URL");if(url)updateBlock(id,{url});};
 const uploadAsset=async(blockId,file)=>{if(!file)return;try{setToast("Uploading to Backblaze B2…");const url="/ocean/assets?page_id="+encodeURIComponent(page.id)+"&filename="+encodeURIComponent(file.name);const d=await api(url,{method:"POST",headers:{"Content-Type":file.type||"application/octet-stream"},body:file});updateBlock(blockId,{asset_id:d.asset.id,asset_url:d.asset.url,file_name:d.asset.file_name,mime_type:d.asset.mime_type,size:d.asset.size});setToast("File stored in Backblaze B2.");}catch(e){setToast(e.message);}};
 const changeOceanRole=async(id,role)=>{try{await api("/ocean/admin/users/"+id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({role})});setAdminUsers(old=>old.map(u=>u.id===id?{...u,role}:u));setToast("OCEAN access updated. The user must sign in again.");}catch(e){setAdminError(e.message);}};
 const refreshCalendar=async()=>{setCalendarLoading(true);setCalendarError("");try{const connection=await api("/ocean/calendar/connection");setCalendarConnection(connection);if(connection.connected){const events=await api("/ocean/calendar/events");setCalendarEvents(events.items||[]);}else setCalendarEvents([]);}catch(e){setCalendarError(e.message);}finally{setCalendarLoading(false);}};
 const connectCalendar=()=>{window.location.href="/api/ocean/calendar/connect";};
 const disconnectCalendar=async()=>{if(!confirm("Disconnect Google Calendar from this OCEAN account?"))return;try{await api("/ocean/calendar/connection",{method:"DELETE"});setCalendarConnection({connected:false,email:""});setCalendarEvents([]);setCalendarForm(null);setToast("Google Calendar disconnected.");}catch(e){setCalendarError(e.message);}};
 const openCalendarForm=(event=null)=>{
  const toLocal=value=>{const d=value?new Date(value):new Date(Date.now()+3600000);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
  setCalendarForm(event?.id||"new");
  setCalendarDraft({summary:event?.summary||"",start:toLocal(event?.start?.dateTime),end:toLocal(event?.end?.dateTime||new Date(Date.now()+7200000)),description:event?.description||"",location:event?.location||""});
 };
 const saveCalendarEvent=async(e)=>{e.preventDefault();setCalendarSaving(true);setCalendarError("");try{
  const payload={...calendarDraft,start:new Date(calendarDraft.start).toISOString(),end:new Date(calendarDraft.end).toISOString()};
  if(calendarForm==="new")await api("/ocean/calendar/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  else await api("/ocean/calendar/events/"+encodeURIComponent(calendarForm),{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  setCalendarForm(null);await refreshCalendar();setToast(calendarForm==="new"?"Calendar event created.":"Calendar event updated.");
 }catch(err){setCalendarError(err.message);}finally{setCalendarSaving(false);}};
 const deleteCalendarEvent=async(id)=>{if(!confirm("Delete this event from Google Calendar?"))return;try{await api("/ocean/calendar/events/"+encodeURIComponent(id),{method:"DELETE"});await refreshCalendar();setToast("Calendar event deleted.");}catch(e){setCalendarError(e.message);}};


 const normalizedSlashQuery=slashQuery.trim().toLowerCase();
  const validHexColor=/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(slashQuery.trim())?slashQuery.trim().toLowerCase():"";
  const customColorCommands=validHexColor?[
   ["Text color · "+validHexColor,"custom-text-color-"+validHexColor,"Custom color","A",validHexColor],
   ["Background · "+validHexColor,"custom-background-color-"+validHexColor,"Custom color","▰",validHexColor]
  ]:[];
  const filteredCommands=[...COMMANDS,...customColorCommands].filter(c=>c[0].toLowerCase().includes(normalizedSlashQuery)||c[1].toLowerCase().includes(normalizedSlashQuery));
  const commandGroups=[...new Set(filteredCommands.map(c=>c[2]))];

 if(checking)return <div className="ocean-loading" role="status"><div className="ocean-loader-orbit"><div className="ocean-loader-mark"><OceanWaveMark/></div><i/><i/><i/></div><strong>OCEAN</strong><span>Opening your workspace</span><small>Getting your pages ready</small></div>;
 if(!user)return <OceanLogin onLogin={async()=>{try{const d=await api("/auth/me");setUser(d.user);if(d.user.role!=="admin"&&d.user.role!=="super_user")return;const list=await loadPages();if(list[0])await openPage(list[0].id);}catch(e){setAuthError(e.message);}}}/>;
 if(user.role!=="admin"&&user.role!=="super_user")return <div className="ocean-access-denied"><div className="ocean-auth-card"><div className="ocean-mark"><OceanWaveMark/></div><div className="ocean-wordmark">OCEAN</div><h1>Access not enabled</h1><p>Your TaalLab account is signed in, but it does not have OCEAN access. Ask an administrator to assign you the Super User role.</p><button className="ocean-primary" onClick={signOut}>Sign out</button></div></div>;

 const renderBlock=(block,index)=>{
  const isText=["text","heading1","heading2","heading3","heading4","bullet","numbered","todo","quote","callout","toggle","code","mermaid","equation","inline-equation","toc","page","pageLink","form","meeting","button","breadcrumb","tabs","synced","toggle-heading1","toggle-heading2","toggle-heading3","mention","mention-page","date","emoji"].includes(block.type);
  if(block.type==="divider")return <div className="ocean-divider" key={block.id} onMouseEnter={()=>setMenuBlock(block.id)}><div/></div>;
  if(block.type==="table")return <div className="ocean-table-wrap ocean-simple-table-wrap" key={block.id}><div className="ocean-simple-table-actions"><button onClick={()=>{const rows=block.rows||[];const cols=Math.max(1,...rows.map(r=>r.length));updateBlock(block.id,{rows:[...rows,Array(cols).fill("")]});}}><Plus size={13}/> Add row</button><button onClick={()=>{const rows=block.rows||[];if(rows.length<=1){alert("A table must have at least one row.");return;}updateBlock(block.id,{rows:rows.slice(0,-1)});}}>− Remove row</button><button onClick={()=>{const rows=block.rows||[];updateBlock(block.id,{rows:rows.map(r=>[...r,""])});}}><Plus size={13}/> Add column</button><button onClick={()=>{const rows=block.rows||[];if(Math.max(1,...rows.map(r=>r.length))<=1){alert("A table must have at least one column.");return;}updateBlock(block.id,{rows:rows.map(r=>r.slice(0,-1))});}}>− Remove column</button><button className="ocean-table-delete" onClick={()=>{if(confirm("Delete this entire table?"))window.dispatchEvent(new CustomEvent("ocean-delete-block",{detail:block.id}));}}><Trash2 size={13}/> Delete table</button></div><table className="ocean-table"><tbody>{(block.rows||[]).map((row,ri)=><tr key={ri}>{row.map((cell,ci)=><td key={ci}><input value={cell} onChange={e=>updateTableCell(block.id,ri,ci,e.target.value)} placeholder=" " /></td>)}</tr>)}</tbody></table></div>;
  if(block.type==="columns")return <div className="ocean-columns" style={{gridTemplateColumns:"repeat("+block.count+",minmax(0,1fr))"}} key={block.id}>{Array.from({length:block.count},(_,i)=><div key={i}><textarea placeholder={"Column "+(i+1)} value={(block.columns||Array(block.count).fill(""))[i]||""} onChange={e=>{const cols=[...(block.columns||Array(block.count).fill(""))];cols[i]=e.target.value;updateBlock(block.id,{columns:cols});}} /></div>)}</div>;
  if(block.type==="database"||block.type==="chart")return <OceanDatabaseBlock key={block.id} block={block} updateBlock={updateBlock}/>;if(block.type==="google-calendar")return <OceanGoogleCalendarBlock key={block.id}/>;
  if(["image","video","audio","file"].includes(block.type))return <div className="ocean-asset-block" key={block.id}>
   {block.asset_url?<div className="ocean-asset-preview">{block.mime_type?.startsWith("image/")?<img src={block.asset_url} alt={block.file_name}/>:block.mime_type?.startsWith("video/")?<video controls src={block.asset_url}/>:block.mime_type?.startsWith("audio/")?<audio controls src={block.asset_url}/>:<a href={block.asset_url} target="_blank" rel="noreferrer"><FileText size={18}/>{block.file_name}</a>}</div>:<div className="ocean-asset-empty"><div className="ocean-embed-icon">{block.type==="image"?<ImageIcon/>:block.type==="video"?<Video/>:block.type==="audio"?<AudioLines/>:<File/>}</div><div className="ocean-embed-content"><strong>{block.type[0].toUpperCase()+block.type.slice(1)}</strong><span>Upload a file to private Backblaze B2 storage.</span></div></div>}
   <label className="ocean-upload-button"><Upload size={14}/>{block.asset_url?"Replace file":"Upload file"}<input type="file" accept={block.type==="image"?"image/*":block.type==="video"?"video/*":block.type==="audio"?"audio/*":undefined} onChange={e=>uploadAsset(block.id,e.target.files?.[0])}/></label>
  </div>;
  if(["bookmark","embed","google-drive","maps","pdf","html","gist","figma","excalidraw","loom","typeform","codepen","replit","deepnote","trello","slack","pitch","onedrive","dropbox","tweet"].includes(block.type))return <div className="ocean-embed-block" key={block.id}><div className="ocean-embed-icon"><Link/></div><div className="ocean-embed-content"><strong>{block.type==="bookmark"?"Web bookmark":block.type[0].toUpperCase()+block.type.slice(1).replaceAll("-"," ")}</strong>{block.url?<a href={block.url} target="_blank" rel="noreferrer">{block.url}</a>:<span>Paste a link to add this content.</span>}</div><button onClick={()=>promptUrl(block.id,block.type)}>{block.url?"Change":"Add link"}</button></div>;
  if(!isText)return null;
  const tag=block.type.startsWith("heading")?"h"+block.type.slice(-1):block.type==="quote"?"blockquote":"div";
  const placeholder=({text:"",heading1:"Heading 1",heading2:"Heading 2",heading3:"Heading 3",heading4:"Heading 4",bullet:"List item",numbered:"List item",todo:"To-do",quote:"Write a quote",callout:"Write something helpful",toggle:"Toggle heading",code:"Write or paste code",mermaid:"Mermaid diagram code",equation:"Enter an equation",page:"Untitled page",pageLink:"Search for a page",toc:"Table of contents",meeting:"Meeting notes",date:"Add a date or reminder"})[block.type]||"";
  const className="ocean-block-text "+block.type+(block.color?" color-"+block.color:"")+(block.background?" bg-"+block.background:"");
  return <div className={"ocean-block-row "+(menuBlock===block.id?"is-hovered":"")} key={block.id} onMouseEnter={()=>setMenuBlock(block.id)} onMouseLeave={()=>{setMenuBlock(null);setColorMenu(false);}}>
    <div className="ocean-block-gutter"><button title="Add block" onClick={()=>{setSlashBlock(block.id);setSlashFromTyping(false);setShowSlash(true);setSlashQuery("");}}>⠿</button></div>
    {block.type==="todo"&&<input className="ocean-check" type="checkbox" checked={!!block.checked} onChange={e=>updateBlock(block.id,{checked:e.target.checked})}/>}
    {block.type==="bullet"&&<span className="ocean-list-marker">•</span>}{block.type==="numbered"&&<span className="ocean-list-marker">{index+1}.</span>}
    {block.type==="toggle"&&<details className="ocean-toggle"><summary></summary><div className="ocean-toggle-body">{block.children||"Add details…"}</div></details>}
    {React.createElement(tag,{ref:el=>blockRefs.current[block.id]=el,contentEditable:true,suppressContentEditableWarning:true,"data-placeholder":placeholder,className:className,style:{color:block.textColor||undefined,"--ocean-block-highlight":block.bgColor||undefined},"data-highlight":block.bgColor?"true":undefined,...(block.html?{dangerouslySetInnerHTML:{__html:block.html}}:{}),onInput:e=>{const text=e.currentTarget.innerText;const slashAt=text.lastIndexOf("/");if(slashAt>=0&&slashAt===text.length-1){setSlashBlock(block.id);setSlashFromTyping(true);setSlashQuery("");setShowSlash(true);}else if(showSlash&&slashBlock===block.id){const queryText=slashAt>=0?text.slice(slashAt+1):"";setSlashQuery(queryText);if(slashAt<0)setShowSlash(false);}},onBlur:e=>{const text=e.currentTarget.innerText;updateBlock(block.id,{text,html:editorHtml(e.currentTarget)});},onKeyDown:e=>{if(e.key==="Escape"&&showSlash){setShowSlash(false);setSlashFromTyping(false);return;}if((e.key===" "||e.key==="Enter")&&!e.ctrlKey&&!e.metaKey){const raw=e.currentTarget.innerText.trim();const shortcuts={"#":"heading1","##":"heading2","###":"heading3","-":"bullet","*":"bullet","1.":"numbered","[]":"todo",">":"quote","---":"divider"};const target=shortcuts[raw];if(!target&&e.key===" "){const current=e.currentTarget.innerText;const formatted=formatInlineMarkdown(current);const plain=escapeHtml(current).replace(/\n/g,"<br>");if(formatted!==plain){e.preventDefault();updateBlock(block.id,{text:current,html:formatted});setTimeout(()=>focusContentEnd(blockRefs.current[block.id]),30);return;}}if(target){e.preventDefault();if(target==="divider"){updatePage({blocks:page.blocks.map(b=>b.id===block.id?{...b,type:"divider",text:"",html:""}:b)});insertBlock("text",block.id);return;}updatePage({blocks:page.blocks.map(b=>b.id===block.id?{...b,type:target,text:"",html:""}:b)});setTimeout(()=>focusContentEnd(blockRefs.current[block.id]),50);return;}if(raw==="/blue"){e.preventDefault();updatePage({blocks:page.blocks.map(b=>b.id===block.id?{...b,text:"",html:"",background:"blue"}:b)});setTimeout(()=>focusContentEnd(blockRefs.current[block.id]),30);return;}}if(e.key==="Enter"&&!e.shiftKey&&!showSlash){e.preventDefault();const currentText=e.currentTarget.innerText;const isList=["bullet","numbered","todo"].includes(block.type);const html=editorHtml(e.currentTarget);if(isList&&!currentText.trim()){updatePage({blocks:page.blocks.map(b=>b.id===block.id?{...b,type:"text",text:"",html:""}:b)});setTimeout(()=>focusContentEnd(blockRefs.current[block.id]),30);}else{updatePage({blocks:page.blocks.map(b=>b.id===block.id?{...b,text:currentText,html}:b)});insertBlock(isList?block.type:"text",block.id);}}if(e.key==="Backspace"&&["bullet","numbered","todo"].includes(block.type)){const selection=window.getSelection();let beforeCaret="";if(selection&&selection.isCollapsed){const range=document.createRange();range.selectNodeContents(e.currentTarget);try{range.setEnd(selection.anchorNode,selection.anchorOffset);beforeCaret=range.toString();}catch{beforeCaret="x";}}if(selection&&selection.isCollapsed&&beforeCaret===""){e.preventDefault();const text=e.currentTarget.innerText;updatePage({blocks:page.blocks.map(b=>b.id===block.id?{...b,type:"text",text,html:formatInlineMarkdown(text)}:b)});setTimeout(()=>focusContentEnd(blockRefs.current[block.id]),30);return;}}if(e.key==="Backspace"&&!e.currentTarget.innerText&&page.blocks.length>1){e.preventDefault();const arr=page.blocks.filter(b=>b.id!==block.id);updatePage({blocks:arr});setTimeout(()=>focusContentEnd(blockRefs.current[arr[Math.max(0,index-1)]?.id]),30);}}},block.html?undefined:block.text||"")}
    {menuBlock===block.id&&<div className="ocean-block-actions"><button title="Block options" onClick={()=>setColorMenu(v=>!v)}><MoreHorizontal size={15}/></button>{colorMenu&&<div className="ocean-color-menu"><strong>Text color</strong>{COLORS.map(([name,value])=><button key={name} onClick={()=>{updateBlock(block.id,{color:value});setColorMenu(false);}}>{name}</button>)}<strong>Background color</strong>{COLORS.map(([name,value])=><button key={name} onClick={()=>{updateBlock(block.id,{background:value});setColorMenu(false);}}>{name} background</button>)}<button onClick={()=>{updatePage({blocks:page.blocks.filter(b=>b.id!==block.id)});setColorMenu(false);}}>Delete block</button></div>}</div>}
  </div>;
 };
 return <div className={"ocean-shell "+(collapsed?"sidebar-collapsed":"")} data-theme={theme}>
  <aside className={"ocean-sidebar "+(mobileNav?"mobile-open":"")}>
   <div className="ocean-sidebar-top"><a className="ocean-brand" href="/"><span className="ocean-brand-mark"><OceanWaveMark/></span><span>OCEAN</span></a><button title="Collapse sidebar" onClick={()=>setCollapsed(v=>!v)}><PanelLeftClose size={17}/></button></div>
   <button className="ocean-search" onClick={()=>setShowSearch(v=>!v)}><Search size={15}/><span>Search pages</span><kbd>Ctrl K</kbd></button>
   <nav className="ocean-nav"><button className={activePanel==="page"?"active":""} onClick={()=>setActivePanel("page")}><Inbox size={16}/> Home</button><button onClick={()=>setShowComments(true)}><MessageCircle size={16}/> Comments</button><button className={activePanel==="calendar"?"active":""} onClick={()=>{setActivePanel("calendar");setMobileNav(false);}}><Calendar size={16}/> Google Calendar</button>{user.role==="admin"&&<button className={activePanel==="access"?"active":""} onClick={()=>setActivePanel("access")}><ShieldCheck size={16}/> Access management</button>}</nav>
   <div className="ocean-side-scroll">
    <div className="ocean-side-label">Favorites <button onClick={()=>createPage()} title="New page"><Plus size={15}/></button></div>
    {favoritePages.map(p=><button key={p.id} className={"ocean-page-link "+(page?.id===p.id?"selected":"")} onClick={()=>{openPage(p.id);setMobileNav(false);}}><span>{p.icon||"▤"}</span><span>{p.title}</span></button>)}
    <div className="ocean-side-label">Private <button onClick={()=>createPage()} title="New page"><Plus size={15}/></button></div>
    {renderSidebarPages()}
    <button className="ocean-new-page" onClick={()=>createPage()}><Plus size={15}/> New page</button>
   </div>
   <div className="ocean-user"><button onClick={()=>setShowAccount(v=>!v)}><span className="ocean-avatar">{(user.display_name||user.email||"U").slice(0,1).toUpperCase()}</span><span className="ocean-user-name">{user.display_name||user.email}<small>{user.role==="admin"?"Admin":"Super User"}</small></span><MoreHorizontal size={16}/></button>{showAccount&&<div className="ocean-account-pop"><strong>{user.email}</strong><button onClick={signOut}><LogOut size={14}/> Sign out</button></div>}</div>
  </aside>
  <main className="ocean-main">
   <header className="ocean-topbar"><button className={"ocean-sidebar-reopen "+(collapsed?"visible":"")} title="Open sidebar" aria-label="Open sidebar" onClick={()=>setCollapsed(false)}><PanelLeftOpen size={17}/></button><button className="ocean-mobile-menu" onClick={()=>setMobileNav(v=>!v)}><Menu size={19}/></button><div className="ocean-crumb"><span>{activePanel==="access"?"Administration":"Private"}</span>{activePanel==="access"?<><ChevronRight size={13}/><strong>Access management</strong></>:page&&<><ChevronRight size={13}/><strong>{page.title||"Untitled"}</strong></>}</div><div className="ocean-top-actions"><button className="ocean-theme-toggle" title={theme==="light"?"Switch to dark theme":"Switch to light theme"} aria-label={theme==="light"?"Switch to dark theme":"Switch to light theme"} onClick={()=>setTheme(v=>v==="light"?"dark":"light")}>{theme==="light"?<Moon size={16}/>:<Sun size={16}/>}</button><span className="ocean-save-state">{saving?"Saving…":"Saved"}</span><button title="Comments" onClick={()=>setShowComments(v=>!v)}><MessageCircle size={17}/></button><button title="Favorite" onClick={()=>updatePage({is_favorite:!page?.is_favorite})}><Heart size={17} fill={page?.is_favorite?"currentColor":"none"}/></button><button title="Page menu" onClick={()=>setShowPageMenu(v=>!v)}><MoreHorizontal size={19}/></button></div></header>
   {showSearch&&<div className="ocean-search-modal"><div><Search size={17}/><input autoFocus placeholder="Search pages…" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Escape"&&setShowSearch(false)}/><button onClick={()=>{setQuery("");setShowSearch(false);}}><X size={16}/></button></div>{filteredPages.map(p=><button key={p.id} onClick={()=>{openPage(p.id);setShowSearch(false);setQuery("");}}>{p.icon||"▤"} {p.title}</button>)}</div>}
   {showPageMenu&&<div className="ocean-page-menu"><button onClick={()=>{navigator.clipboard?.writeText(location.href);setToast("Link copied");setShowPageMenu(false);}}><Copy size={14}/> Copy link</button><button onClick={()=>{updatePage({is_favorite:!page?.is_favorite});setShowPageMenu(false);}}><Heart size={14}/> {page?.is_favorite?"Remove from favorites":"Add to favorites"}</button><button onClick={deletePage}><Trash2 size={14}/> Move to trash</button></div>}
   {activePanel==="calendar"?<div className="ocean-admin-scroll"><section className="ocean-admin-content ocean-calendar-content">
 <div className="ocean-admin-heading"><div><span className="ocean-admin-eyebrow">INTEGRATIONS</span><h1>Google Calendar</h1><p>Connect your Google account to manage calendar events directly from OCEAN.</p></div><span className="ocean-role-pill super">Full access</span></div>
 <div className="ocean-access-card ocean-calendar-connection">
  <div className="ocean-access-card-head"><div><strong>{calendarConnection.connected?"Google account connected":"Connect your Google account"}</strong><span>{calendarConnection.connected?calendarConnection.email:"Authorize OCEAN to view and manage events on your primary Google Calendar."}</span></div><span className={calendarConnection.connected?"ocean-role-pill super":"ocean-role-pill user"}>{calendarConnection.connected?"Connected":"Not connected"}</span></div>
  <div className="ocean-calendar-actions">{calendarConnection.connected?<><button onClick={refreshCalendar}><Activity size={15}/> Refresh events</button><button className="ocean-calendar-danger" onClick={disconnectCalendar}><X size={15}/> Disconnect</button></>:<button className="ocean-primary" onClick={connectCalendar}> <Calendar size={16}/> Connect Google Calendar</button>}</div>
 </div>
 {calendarError&&<div className="ocean-admin-error">{calendarError}</div>}
 {calendarLoading?<div className="ocean-admin-empty">Loading calendar…</div>:calendarConnection.connected&&<>
  <div className="ocean-calendar-events-head"><div><h2>Upcoming events</h2><p>Events from the last 30 days through the next 90 days.</p></div><button className="ocean-primary" onClick={()=>openCalendarForm()}><Plus size={15}/> New event</button></div>
  {calendarForm&&<form className="ocean-access-card ocean-calendar-form" onSubmit={saveCalendarEvent}>
   <div className="ocean-access-card-head"><div><strong>{calendarForm==="new"?"Create event":"Edit event"}</strong><span>Changes sync directly with Google Calendar.</span></div><button type="button" onClick={()=>setCalendarForm(null)}><X size={16}/></button></div>
   <label>Event title<input required maxLength={500} value={calendarDraft.summary} onChange={e=>setCalendarDraft(v=>({...v,summary:e.target.value}))}/></label>
   <div className="ocean-calendar-form-grid"><label>Starts<input type="datetime-local" required value={calendarDraft.start} onChange={e=>setCalendarDraft(v=>({...v,start:e.target.value}))}/></label><label>Ends<input type="datetime-local" required value={calendarDraft.end} onChange={e=>setCalendarDraft(v=>({...v,end:e.target.value}))}/></label></div>
   <label>Location<input value={calendarDraft.location} onChange={e=>setCalendarDraft(v=>({...v,location:e.target.value}))}/></label>
   <label>Description<textarea rows={3} value={calendarDraft.description} onChange={e=>setCalendarDraft(v=>({...v,description:e.target.value}))}/></label>
   <div className="ocean-calendar-actions"><button className="ocean-primary" disabled={calendarSaving}>{calendarSaving?"Saving…":"Save event"}</button><button type="button" onClick={()=>setCalendarForm(null)}>Cancel</button></div>
  </form>}
  <div className="ocean-calendar-event-list">{calendarEvents.map(event=><article className="ocean-calendar-event" key={event.id}><div className="ocean-calendar-event-time"><strong>{event.start?.dateTime?new Date(event.start.dateTime).toLocaleDateString(undefined,{month:"short",day:"numeric"}):event.start?.date||"All day"}</strong><span>{event.start?.dateTime?new Date(event.start.dateTime).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"}):"All day"}</span></div><div className="ocean-calendar-event-info"><strong>{event.summary||"(No title)"}</strong><span>{event.location||event.description||"No additional details"}</span></div><div className="ocean-calendar-event-actions"><button title="Edit event" onClick={()=>openCalendarForm(event)}><Settings size={15}/></button><button title="Delete event" onClick={()=>deleteCalendarEvent(event.id)}><Trash2 size={15}/></button></div></article>)}{!calendarEvents.length&&<div className="ocean-admin-empty">No events found in this date range.</div>}</div>
 </>}
 {calendarConnection.connected&&<div className="ocean-access-note"><ShieldCheck size={18}/><div><strong>Secure, account-specific connection</strong><span>Your refresh token is encrypted and stored against your OCEAN user account. Other OCEAN users cannot access this calendar connection.</span></div></div>}
</section></div>:activePanel==="access"?<div className="ocean-admin-scroll"><section className="ocean-admin-content"><div className="ocean-admin-heading"><div><span className="ocean-admin-eyebrow">ADMINISTRATION</span><h1>Workspace access</h1><p>Choose which accounts can enter OCEAN. Only Admin and Super User roles are allowed.</p></div><span className="ocean-role-pill admin">Admin</span></div><div className="ocean-access-card"><div className="ocean-access-card-head"><div><strong>Account permissions</strong><span>Changes take effect on the next sign-in.</span></div><button onClick={()=>{setAdminLoading(true);api("/ocean/admin/users").then(d=>setAdminUsers(d.users||[])).catch(e=>setAdminError(e.message)).finally(()=>setAdminLoading(false));}}><Activity size={15}/> Refresh</button></div>{adminError&&<div className="ocean-admin-error">{adminError}</div>}{adminLoading?<div className="ocean-admin-empty">Loading accounts…</div>:<div className="ocean-user-list">{adminUsers.map(u=><div className="ocean-managed-user" key={u.id}><div className="ocean-managed-avatar">{(u.display_name||u.email||"U").slice(0,1).toUpperCase()}</div><div className="ocean-managed-info"><strong>{u.display_name||u.email}</strong><span>{u.email}</span></div><span className={"ocean-role-pill "+(u.role==="admin"?"admin":u.role==="super_user"?"super":"user")}>{u.role==="admin"?"Admin":u.role==="super_user"?"Super User":"User"}</span>{u.role==="admin"?<span className="ocean-protected-label">Protected</span>:<select aria-label={"OCEAN access for "+u.email} value={u.role==="super_user"?"super_user":"user"} onChange={e=>changeOceanRole(u.id,e.target.value)}><option value="user">User — no access</option><option value="super_user">Super User — allow access</option></select>}</div>)}</div>}</div><div className="ocean-access-note"><ShieldCheck size={18}/><div><strong>Access is enforced by the server</strong><span>Changing the role also invalidates the account's current sessions. Admin accounts are protected from changes in this panel.</span></div></div></section></div>:loading?<div className="ocean-loading">Opening page…</div>:page?<div className="ocean-page-scroll" ref={editorRef}>
    {page.cover&&<div className="ocean-cover" style={{backgroundImage:"url("+page.cover+")"}}/>}
    <article className="ocean-editor">
     <div className="ocean-page-controls"><button onClick={()=>{const icon=prompt("Paste an emoji or icon",page.icon||"🌊");if(icon!==null)updatePage({icon});}}><Smile size={14}/> Add icon</button><button onClick={()=>{const cover=prompt("Paste an image URL for the cover",page.cover||"");if(cover!==null)updatePage({cover});}}><ImageIcon size={14}/> {page.cover?"Change cover":"Add cover"}</button><button onClick={()=>setShowComments(true)}><MessageCircle size={14}/> Add comment</button></div>
     <div className="ocean-title-row">{page.icon&&<span className="ocean-title-icon">{page.icon}</span>}<input className="ocean-title" value={page.title||""} placeholder="New page" onChange={e=>updatePage({title:e.target.value})}/></div>
     <div className="ocean-blocks">{(page.blocks||[]).map(renderBlock)}
      
      {(page.blocks||[]).length>0&&!["text","heading1","heading2","heading3","heading4","bullet","numbered","todo","quote","callout","toggle","code","mermaid","equation"].includes(page.blocks[page.blocks.length-1]?.type)&&<div className="ocean-add-line ocean-add-after-database"><button onClick={()=>{const next=blankBlock("text");setPage(old=>old?{...old,blocks:[...(old.blocks||[]),next]}:old);setTimeout(()=>focusContentEnd(blockRefs.current[next.id]),80);}}><Plus size={15}/> Add content below</button></div>}
     </div>
     {showSlash&&<div className="ocean-slash-menu"><div className="ocean-slash-search"><span>/</span><input ref={slashInput} value={slashQuery} onChange={e=>{setSlashQuery(e.target.value);setActiveSlashIndex(0);}} placeholder="Search blocks or enter a hex color (#4169E1)" onKeyDown={e=>{if(e.key==="ArrowDown"&&filteredCommands.length){e.preventDefault();setActiveSlashIndex(i=>(i+1)%filteredCommands.length);}else if(e.key==="ArrowUp"&&filteredCommands.length){e.preventDefault();setActiveSlashIndex(i=>(i-1+filteredCommands.length)%filteredCommands.length);}else if(e.key==="Home"&&filteredCommands.length){e.preventDefault();setActiveSlashIndex(0);}else if(e.key==="End"&&filteredCommands.length){e.preventDefault();setActiveSlashIndex(filteredCommands.length-1);}else if(e.key==="Escape"){e.preventDefault();setShowSlash(false);setSlashFromTyping(false);setTimeout(()=>focusContentEnd(blockRefs.current[slashBlock]),30);}else if(e.key==="Enter"&&filteredCommands[activeSlashIndex]){e.preventDefault();chooseCommand(filteredCommands[activeSlashIndex][1]);}else if(e.key==="Backspace"&&!slashQuery){e.preventDefault();setShowSlash(false);setSlashFromTyping(false);setTimeout(()=>focusContentEnd(blockRefs.current[slashBlock]),30);}}}/><kbd>ESC</kbd></div><div className="ocean-slash-results">{commandGroups.map(group=><section key={group}><small>{group}</small>{filteredCommands.filter(c=>c[2]===group).map(c=><button key={c[1]} className={"ocean-slash-option "+(filteredCommands.findIndex(x=>x[1]===c[1])===activeSlashIndex?"is-active":"")} aria-selected={filteredCommands.findIndex(x=>x[1]===c[1])===activeSlashIndex} onMouseDown={e=>e.preventDefault()} onMouseEnter={()=>setActiveSlashIndex(filteredCommands.findIndex(x=>x[1]===c[1]))} onClick={()=>chooseCommand(c[1])}><span className="ocean-command-icon" style={c[4]?{background:c[4],borderColor:c[4],color:"#fff"}:undefined}>{c[3]}</span><span>{c[0]}</span></button>)}</section>)}{!filteredCommands.length&&<p>No matching blocks</p>}</div></div>}
    </article>
   </div>:<div className="ocean-empty"><div className="ocean-mark">O</div><h2>Your space, your flow.</h2><p>Create a page to start writing.</p><button className="ocean-primary" onClick={()=>createPage()}>Create a page</button></div>}
  </main>
  {showComments&&<><button className="ocean-drawer-scrim" onClick={()=>setShowComments(false)} aria-label="Close comments"/><aside className="ocean-comments"><header><strong>Comments</strong><button onClick={()=>setShowComments(false)}><X size={18}/></button></header><div className="ocean-comment-list">{comments.map(c=><article key={c.id}><span className="ocean-avatar">{(c.display_name||c.email||"U").slice(0,1).toUpperCase()}</span><div><strong>{c.display_name||c.email}</strong><p>{c.body}</p><small>{new Date(c.created_at*1000).toLocaleString()}</small></div></article>)}{!comments.length&&<p className="ocean-muted">No comments yet. Start the conversation.</p>}</div><form onSubmit={addComment}><textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="Add a comment…" rows={3}/><button className="ocean-primary" disabled={!comment.trim()}>Comment</button></form></aside></>}
  {toast&&<div className="ocean-toast">{toast}</div>}
 </div>;
}
export default OceanApp;
