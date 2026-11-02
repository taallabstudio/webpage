import React,{useCallback,useEffect,useMemo,useRef,useState} from "react";
import "./Ocean.css";
import {
  Activity,AlignLeft,Archive,ArrowDown,ArrowLeft,AudioLines,BarChart3,Bell,BookOpen,
  Bookmark,Calendar,Check,CheckSquare,ChevronDown,ChevronRight,ChevronsUpDown,
  CircleHelp,Code,Columns3,Command,Copy,Database,File,FileAudio,FileImage,FilePlus,
  FileText,Film,Folder,FolderPlus,GalleryHorizontal,Globe,Grid2X2,Hash,Heart,
  Image as ImageIcon,Inbox,Link,LogOut,Map,Menu,MessageCircle,MoreHorizontal,
  PanelLeftClose,PanelLeftOpen,Plus,Search,Settings,Share2,ShieldCheck,SlidersHorizontal,
  Smile,Table2,Text,Trash2,Upload,User,Users,Video,X
} from "lucide-react";

const api=async(path,options={})=>{
  const response=await fetch("/api"+path,{credentials:"include",...options});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(data.error||"Something went wrong");error.status=response.status;throw error;}
  return data;
};
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
const blankBlock=(type="text")=>({id:uid(),type,text:""});
const COMMANDS=[
  ["Blue highlight","highlight-blue","Formatting","🖍"],["Text","text","Basic blocks","T"],["Heading 1","heading1","Basic blocks","H1"],["Heading 2","heading2","Basic blocks","H2"],["Heading 3","heading3","Basic blocks","H3"],["Heading 4","heading4","Basic blocks","H4"],
  ["Bulleted list","bullet","Basic blocks","•"],["Numbered list","numbered","Basic blocks","1."],["To-do list","todo","Basic blocks","☑"],["Toggle list","toggle","Basic blocks","›"],["Page","page","Basic blocks","▤"],["Callout","callout","Basic blocks","▣"],["Quote","quote","Basic blocks","❝"],["Table","table","Basic blocks","▦"],["Divider","divider","Basic blocks","—"],["Link to page","pageLink","Basic blocks","↗"],
  ["Image","image","Media","▧"],["Video","video","Media","▻"],["Audio","audio","Media","♫"],["Code","code","Media","</>"],["File","file","Media","↥"],["Web bookmark","bookmark","Media","♧"],
  ["Table view","database-table","Database","▦"],["Board view","database-board","Database","▤"],["Gallery view","database-gallery","Database","▦"],["List view","database-list","Database","☷"],["Feed view","database-feed","Database","▤"],["Dashboard view","database-dashboard","Database","▥"],["Calendar view","database-calendar","Database","▦"],["Timeline view","database-timeline","Database","▥"],["Map view","database-map","Database","⌖"],["Vertical bar chart","chart-vertical","Database","▥"],["Horizontal bar chart","chart-horizontal","Database","▤"],["Line chart","chart-line","Database","⌁"],["Donut chart","chart-donut","Database","◉"],["Number chart","chart-number","Database","#"],["Form","form","Database","☷"],["Database - Inline","database-inline","Database","▦"],["Database - Full page","database-full","Database","▦"],["Linked view of data source","database-linked","Database","↗"],
  ["Table of contents","toc","Advanced blocks","☷"],["Block equation","equation","Advanced blocks","∑"],["Button","button","Advanced blocks","▣"],["Breadcrumb","breadcrumb","Advanced blocks","⌂"],["Tabs","tabs","Advanced blocks","▥"],["Synced block","synced","Advanced blocks","⧉"],["Toggle heading 1","toggle-heading1","Advanced blocks","H1›"],["Toggle heading 2","toggle-heading2","Advanced blocks","H2›"],["Toggle heading 3","toggle-heading3","Advanced blocks","H3›"],["2 columns","columns2","Advanced blocks","Ⅱ"],["3 columns","columns3","Advanced blocks","Ⅲ"],["4 columns","columns4","Advanced blocks","Ⅳ"],["5 columns","columns5","Advanced blocks","Ⅴ"],["AI Meeting Notes","meeting","Advanced blocks","✧"],["Code - Mermaid","mermaid","Advanced blocks","◇"],
  ["Mention a person","mention","Inline","@"],["Mention a page or data source","mention-page","Inline","↗"],["Date or reminder","date","Inline","◷"],["Emoji","emoji","Inline","☺"],["Inline equation","inline-equation","Inline","√"],["Embed","embed","Embeds","↗"],["HTML","html","Embeds","</>"],["Google Drive","google-drive","Embeds","▣"],["Tweet","tweet","Embeds","𝕏"],["GitHub Gist","gist","Embeds","⌘"],["Google Maps","maps","Embeds","⌖"],["Figma","figma","Embeds","◈"],["Excalidraw","excalidraw","Embeds","◇"],["PDF","pdf","Embeds","▧"],["Loom","loom","Embeds","◉"],["Typeform","typeform","Embeds","▤"],["CodePen","codepen","Embeds","◇"],["Replit","replit","Embeds","⌘"],["Deepnote","deepnote","Embeds","▧"],["Trello","trello","Embeds","▦"],["Slack","slack","Embeds","▧"],["Pitch","pitch","Embeds","▣"],["OneDrive","onedrive","Embeds","☁"],["Dropbox","dropbox","Embeds","◈"]
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
 html=html.replace(/~~(.+?)~~/g,"<s>$1</s>");
 html=html.replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,!?])/g,"$1<em>$2</em>");
 html=html.replace(/(^|\s)\/([^/\n]+)\/(?=\s|$|[.,!?])/g,"$1<em>$2</em>");
 return html;
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
 const addProperty=()=>{const name=prompt("Property name","New property");if(!name?.trim())return;saveRows(rows.map((r,i)=>i===0?[...r,name.trim()]:[...r,""]));};
 const renameProperty=i=>{const name=prompt("Rename property",headers[i]);if(name?.trim())editCell(0,i,name.trim());};
 const addView=v=>{updateBlock(block.id,{view:v});setMenu("");};
 useEffect(()=>{const close=e=>{if(root.current&&!root.current.contains(e.target))setMenu("");};document.addEventListener("pointerdown",close);return()=>document.removeEventListener("pointerdown",close);},[]);
 const menuButton=(name,label,icon)=><button className={menu===name?"active":""} onClick={()=>setMenu(menu===name?"":name)}>{icon}{label}</button>;
 const newMenu=<div className="ocean-db-popover ocean-db-new-menu"><strong>New database</strong><button onClick={addRow}><Plus size={15}/> New page</button><button onClick={()=>{addRow();setMenu("");}}><FilePlus size={15}/> New page with template</button><button onClick={()=>{const title=prompt("Database template name","Tasks tracker");if(title){saveRows([headers,...rows.slice(1),[title,"Not started",""]]);}setMenu("");}}><CheckSquare size={15}/> Tasks tracker</button></div>;
 return <div className="ocean-database-block ocean-db-notion" ref={root}>
  <div className="ocean-db-heading"><input aria-label="Database title" value={block.text||"New database"} onChange={e=>updateBlock(block.id,{text:e.target.value})}/><div className="ocean-db-view-tabs">{views.filter(v=>["table","board","gallery","list"].includes(v[1])).map(([label,key])=><button key={key} className={view===key?"active":""} onClick={()=>addView(key)}>{label}</button>)}<button onClick={()=>setMenu(menu==="views"?"":"views")}><Plus size={14}/> Add a view</button>{menu==="views"&&<div className="ocean-db-popover ocean-db-views">{views.map(([label,key])=><button key={key} onClick={()=>addView(key)}>{label}{view===key?" ✓":""}</button>)}</div>}</div></div>
  <div className="ocean-db-controls">
   <div className="ocean-db-control-left">{menuButton("filter","Filter",<SlidersHorizontal size={14}/>)}{menuButton("sort","Sort",<ChevronsUpDown size={14}/>)}{menuButton("group","Group",<Columns3 size={14}/>)}{menuButton("search","Search",<Search size={14}/>)}{menuButton("properties","Properties",<Settings size={14}/>)}{menuButton("more","•••",<MoreHorizontal size={14}/>)}</div>
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
  {["list","gallery","calendar","timeline"].includes(view)&&<div className={"ocean-db-cards "+view}>{data.map(({r,i})=><article key={i}>{visible.map(c=><label key={c}><small>{headers[c]}</small><input value={r[c]||""} onChange={e=>editCell(i+1,c,e.target.value)}/></label>)}</article>)}<button onClick={addRow}><Plus size={14}/> New page</button></div>}
  <div className="ocean-db-footer">{data.length} {data.length===1?"page":"pages"} <span>·</span> {headers.length} properties</div>
 </div>;
}

function OceanApp(){
 const [user,setUser]=useState(null),[checking,setChecking]=useState(true),[authError,setAuthError]=useState("");
 const [pages,setPages]=useState([]),[page,setPage]=useState(null),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false);
 const [collapsed,setCollapsed]=useState(false),[query,setQuery]=useState(""),[showSearch,setShowSearch]=useState(false),[showSlash,setShowSlash]=useState(false),[slashQuery,setSlashQuery]=useState(""),[slashBlock,setSlashBlock]=useState(null);
 const [showComments,setShowComments]=useState(false),[comments,setComments]=useState([]),[comment,setComment]=useState("");
 const [showAccount,setShowAccount]=useState(false),[showPageMenu,setShowPageMenu]=useState(false),[menuBlock,setMenuBlock]=useState(null),[colorMenu,setColorMenu]=useState(false);
 const [toast,setToast]=useState("");
 const editorRef=useRef(null),slashInput=useRef(null),saveTimer=useRef(null),blockRefs=useRef({});
 const [activeView,setActiveView]=useState("Table");
 const [mobileNav,setMobileNav]=useState(false);
 const [activePanel,setActivePanel]=useState("page"),[adminUsers,setAdminUsers]=useState([]),[adminLoading,setAdminLoading]=useState(false),[adminError,setAdminError]=useState("");

 const loadPages=useCallback(async()=>{const data=await api("/ocean/pages");setPages(data.pages||[]);return data.pages||[];},[]);
 const openPage=useCallback(async(id)=>{setLoading(true);setShowSlash(false);setShowPageMenu(false);try{const data=await api("/ocean/pages/"+id);const p=data.page;p.blocks=JSON.parse(p.blocks_json||"[]");setPage(p);setShowComments(false);}catch(e){setToast(e.message);}finally{setLoading(false);}},[]);
 useEffect(()=>{let alive=true;api("/auth/me").then(async d=>{if(!alive)return;if(!d.authenticated){setChecking(false);return;}setUser(d.user);if(d.user.role!=="admin"&&d.user.role!=="super_user")return;const list=await loadPages();if(alive&&list.length)await openPage(list[0].id);}).catch(e=>setAuthError(e.message)).finally(()=>{if(alive)setChecking(false);});return()=>{alive=false;};},[loadPages,openPage]);
 useEffect(()=>{if(!page)return;clearTimeout(saveTimer.current);setSaving(true);saveTimer.current=setTimeout(async()=>{try{await api("/ocean/pages/"+page.id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:page.title,icon:page.icon,cover:page.cover,blocks:page.blocks,is_favorite:!!page.is_favorite})});setPages(old=>old.map(p=>p.id===page.id?{...p,title:page.title,icon:page.icon,cover:page.cover,is_favorite:page.is_favorite,updated_at:Math.floor(Date.now()/1000)}:p));setSaving(false);}catch(e){setSaving(false);setToast("Couldn't save: "+e.message);}},650);return()=>clearTimeout(saveTimer.current);},[page]);
 useEffect(()=>{if(showSlash){slashInput.current?.focus();}},[showSlash]);
 useEffect(()=>{if(!showSlash)return;const closeOutside=e=>{const menu=document.querySelector(".ocean-slash-menu");if(menu&&!menu.contains(e.target)){setShowSlash(false);setSlashQuery("");setSlashBlock(null);}};document.addEventListener("pointerdown",closeOutside);return()=>document.removeEventListener("pointerdown",closeOutside);},[showSlash]);
 useEffect(()=>{const duplicate=e=>setPage(old=>old?{...old,blocks:[...old.blocks,e.detail]}:old);const remove=e=>setPage(old=>old?{...old,blocks:old.blocks.filter(b=>b.id!==e.detail)}:old);window.addEventListener("ocean-duplicate-block",duplicate);window.addEventListener("ocean-delete-block",remove);return()=>{window.removeEventListener("ocean-duplicate-block",duplicate);window.removeEventListener("ocean-delete-block",remove);};},[]);
 useEffect(()=>{if(activePanel==="access"&&user?.role==="admin"){setAdminLoading(true);api("/ocean/admin/users").then(d=>setAdminUsers(d.users||[])).catch(e=>setAdminError(e.message)).finally(()=>setAdminLoading(false));}},[activePanel,user?.role]);
 useEffect(()=>{const onKey=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setShowSearch(v=>!v);}if(e.key==="Escape"){setShowSearch(false);setShowPageMenu(false);setShowSlash(false);}};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);},[]);

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
  if(type.startsWith("database-")){block={...block,type:"database",view:type.replace("database-",""),text:"New database",rows:[["Name","Status","Date"],["First item","In progress",""],["Second item","Not started",""]]};}
  if(type.startsWith("chart-")){block={...block,type:"chart",view:type.replace("chart-",""),text:"New chart",rows:[["Category","Value"],["A","8"],["B","5"],["C","3"]]};}
  if(type==="table")block={...block,rows:[["","",""],["","",""],["","",""]]};
  if(type.startsWith("columns"))block={...block,type:"columns",count:Number(type.slice(-1)),text:"Add content in each column"};
  if(["image","video","audio","file","bookmark","embed","google-drive","maps","pdf","html","gist","figma","excalidraw","loom","typeform","codepen","replit","deepnote","trello","slack","pitch","onedrive","dropbox","tweet"].includes(type))block.url="";
  return block;
 };
  const insertBlock=(type,afterId=null,removeSlash=false)=>{
   const block=buildBlock(type);
   const needsFollowingParagraph=block.type==="divider"||block.type==="database"||block.type==="chart";
   const following=needsFollowingParagraph?blankBlock("text"):null;
   setPage(old=>{
    if(!old)return old;
    const arr=[...(old.blocks||[])];let idx=afterId?arr.findIndex(b=>b.id===afterId):-1;
    if(removeSlash&&idx>=0)arr[idx]={...arr[idx],text:(arr[idx].text||"").replace(new RegExp("/[^/]*$"),"")};
    arr.splice(idx+1,0,block);if(following)arr.splice(idx+2,0,following);return {...old,blocks:arr};
   });
   setShowSlash(false);setSlashQuery("");setSlashBlock(null);
   setTimeout(()=>focusContentEnd(blockRefs.current[following?.id||block.id]),80);
  };
 const chooseCommand=(type)=>{if(type==="highlight-blue"){const target=slashBlock||page.blocks.at(-1)?.id;updatePage({blocks:page.blocks.map(b=>b.id===target?{...b,text:"",html:"",background:"blue"}:b)});setShowSlash(false);setSlashQuery("");setSlashBlock(null);setTimeout(()=>focusContentEnd(blockRefs.current[target]),30);return;}insertBlock(type,slashBlock||page.blocks.at(-1)?.id,!!slashBlock);};
 const createPage=async(parentId=null)=>{try{const d=await api("/ocean/pages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:"Untitled",parent_id:parentId})});await loadPages();await openPage(d.page.id);setMobileNav(false);}catch(e){setToast(e.message);}};
 const deletePage=async()=>{if(!page||!confirm("Move this page to trash?"))return;try{await api("/ocean/pages/"+page.id,{method:"DELETE"});const list=await loadPages();setPage(null);if(list[0])openPage(list[0].id);setShowPageMenu(false);}catch(e){setToast(e.message);}};
 const addComment=async(e)=>{e.preventDefault();if(!comment.trim())return;try{await api("/ocean/pages/"+page.id+"/comments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({body:comment})});setComment("");const d=await api("/ocean/pages/"+page.id+"/comments");setComments(d.comments||[]);}catch(e){setToast(e.message);}};
 const signOut=async()=>{try{await api("/auth/logout",{method:"POST"});}catch{}setUser(null);setPage(null);setPages([]);};
 const updateTableCell=(blockId,row,col,value)=>updateBlock(blockId,{rows:page.blocks.find(b=>b.id===blockId).rows.map((r,ri)=>r.map((v,ci)=>ri===row&&ci===col?value:v))});
 const promptUrl=(id,label)=>{const url=prompt("Paste "+label+" URL");if(url)updateBlock(id,{url});};
 const uploadAsset=async(blockId,file)=>{if(!file)return;try{setToast("Uploading to Backblaze B2…");const url="/ocean/assets?page_id="+encodeURIComponent(page.id)+"&filename="+encodeURIComponent(file.name);const d=await api(url,{method:"POST",headers:{"Content-Type":file.type||"application/octet-stream"},body:file});updateBlock(blockId,{asset_id:d.asset.id,asset_url:d.asset.url,file_name:d.asset.file_name,mime_type:d.asset.mime_type,size:d.asset.size});setToast("File stored in Backblaze B2.");}catch(e){setToast(e.message);}};
 const changeOceanRole=async(id,role)=>{try{await api("/ocean/admin/users/"+id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({role})});setAdminUsers(old=>old.map(u=>u.id===id?{...u,role}:u));setToast("OCEAN access updated. The user must sign in again.");}catch(e){setAdminError(e.message);}};

 const filteredCommands=COMMANDS.filter(c=>c[0].toLowerCase().includes(slashQuery.toLowerCase())||c[1].toLowerCase().includes(slashQuery.toLowerCase()));
 const commandGroups=[...new Set(filteredCommands.map(c=>c[2]))];

 if(checking)return <div className="ocean-loading"><div className="ocean-mark">O</div><span>Opening your workspace…</span></div>;
 if(!user)return <OceanLogin onLogin={async()=>{try{const d=await api("/auth/me");setUser(d.user);if(d.user.role!=="admin"&&d.user.role!=="super_user")return;const list=await loadPages();if(list[0])await openPage(list[0].id);}catch(e){setAuthError(e.message);}}}/>;
 if(user.role!=="admin"&&user.role!=="super_user")return <div className="ocean-access-denied"><div className="ocean-auth-card"><div className="ocean-mark"><OceanWaveMark/></div><div className="ocean-wordmark">OCEAN</div><h1>Access not enabled</h1><p>Your TaalLab account is signed in, but it does not have OCEAN access. Ask an administrator to assign you the Super User role.</p><button className="ocean-primary" onClick={signOut}>Sign out</button></div></div>;

 const renderBlock=(block,index)=>{
  const isText=["text","heading1","heading2","heading3","heading4","bullet","numbered","todo","quote","callout","toggle","code","mermaid","equation","inline-equation","toc","page","pageLink","form","meeting","button","breadcrumb","tabs","synced","toggle-heading1","toggle-heading2","toggle-heading3","mention","mention-page","date","emoji"].includes(block.type);
  if(block.type==="divider")return <div className="ocean-divider" key={block.id} onMouseEnter={()=>setMenuBlock(block.id)}><div/></div>;
  if(block.type==="table")return <div className="ocean-table-wrap" key={block.id}><table className="ocean-table"><tbody>{(block.rows||[]).map((row,ri)=><tr key={ri}>{row.map((cell,ci)=><td key={ci}><input value={cell} onChange={e=>updateTableCell(block.id,ri,ci,e.target.value)} placeholder=" " /></td>)}</tr>)}</tbody></table><button className="ocean-inline-add" onClick={()=>updateBlock(block.id,{rows:[...(block.rows||[]),["","",""]]})}><Plus size={13}/> Add row</button></div>;
  if(block.type==="columns")return <div className="ocean-columns" style={{gridTemplateColumns:"repeat("+block.count+",minmax(0,1fr))"}} key={block.id}>{Array.from({length:block.count},(_,i)=><div key={i}><textarea placeholder={"Column "+(i+1)} value={(block.columns||Array(block.count).fill(""))[i]||""} onChange={e=>{const cols=[...(block.columns||Array(block.count).fill(""))];cols[i]=e.target.value;updateBlock(block.id,{columns:cols});}} /></div>)}</div>;
  if(block.type==="database"||block.type==="chart")return <OceanDatabaseBlock key={block.id} block={block} updateBlock={updateBlock}/>;
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
    <div className="ocean-block-gutter"><button title="Add block" onClick={()=>{setSlashBlock(block.id);setShowSlash(true);setSlashQuery("");}}>⠿</button></div>
    {block.type==="todo"&&<input className="ocean-check" type="checkbox" checked={!!block.checked} onChange={e=>updateBlock(block.id,{checked:e.target.checked})}/>}
    {block.type==="bullet"&&<span className="ocean-list-marker">•</span>}{block.type==="numbered"&&<span className="ocean-list-marker">{index+1}.</span>}
    {block.type==="toggle"&&<details className="ocean-toggle"><summary></summary><div className="ocean-toggle-body">{block.children||"Add details…"}</div></details>}
    {React.createElement(tag,{ref:el=>blockRefs.current[block.id]=el,contentEditable:true,suppressContentEditableWarning:true,"data-placeholder":placeholder,className:className,style:{color:block.textColor||undefined,background:block.bgColor||undefined},...(block.html?{dangerouslySetInnerHTML:{__html:block.html}}:{}),onInput:e=>{const text=e.currentTarget.innerText;const slashAt=text.lastIndexOf("/");if(slashAt>=0&&slashAt===text.length-1){setSlashBlock(block.id);setSlashQuery("");setShowSlash(true);}else if(showSlash&&slashBlock===block.id){const queryText=slashAt>=0?text.slice(slashAt+1):"";setSlashQuery(queryText);if(slashAt<0)setShowSlash(false);}},onBlur:e=>{const text=e.currentTarget.innerText;updateBlock(block.id,{text,html:formatInlineMarkdown(text)});},onKeyDown:e=>{if(e.key==="Escape"&&showSlash){setShowSlash(false);return;}if((e.key===" "||e.key==="Enter")&&!e.ctrlKey&&!e.metaKey){const raw=e.currentTarget.innerText.trim();const shortcuts={"#":"heading1","##":"heading2","###":"heading3","-":"bullet","*":"bullet","1.":"numbered","[]":"todo",">":"quote","---":"divider"};const target=shortcuts[raw];if(target){e.preventDefault();if(target==="divider"){updatePage({blocks:page.blocks.map(b=>b.id===block.id?{...b,type:"divider",text:"",html:""}:b)});insertBlock("text",block.id);return;}updatePage({blocks:page.blocks.map(b=>b.id===block.id?{...b,type:target,text:"",html:""}:b)});setTimeout(()=>focusContentEnd(blockRefs.current[block.id]),50);return;}if(raw==="/blue"){e.preventDefault();updatePage({blocks:page.blocks.map(b=>b.id===block.id?{...b,text:"",html:"",background:"blue"}:b)});setTimeout(()=>focusContentEnd(blockRefs.current[block.id]),30);return;}}if(e.key==="Enter"&&!e.shiftKey&&!showSlash){e.preventDefault();const currentText=e.currentTarget.innerText;const isList=["bullet","numbered","todo"].includes(block.type);const html=formatInlineMarkdown(currentText);if(isList&&!currentText.trim()){updatePage({blocks:page.blocks.map(b=>b.id===block.id?{...b,type:"text",text:"",html:""}:b)});setTimeout(()=>focusContentEnd(blockRefs.current[block.id]),30);}else{updatePage({blocks:page.blocks.map(b=>b.id===block.id?{...b,text:currentText,html}:b)});insertBlock(isList?block.type:"text",block.id);}}if(e.key==="Backspace"&&["bullet","numbered","todo"].includes(block.type)){const selection=window.getSelection();let beforeCaret="";if(selection&&selection.isCollapsed){const range=document.createRange();range.selectNodeContents(e.currentTarget);try{range.setEnd(selection.anchorNode,selection.anchorOffset);beforeCaret=range.toString();}catch{beforeCaret="x";}}if(selection&&selection.isCollapsed&&beforeCaret===""){e.preventDefault();const text=e.currentTarget.innerText;updatePage({blocks:page.blocks.map(b=>b.id===block.id?{...b,type:"text",text,html:formatInlineMarkdown(text)}:b)});setTimeout(()=>focusContentEnd(blockRefs.current[block.id]),30);return;}}if(e.key==="Backspace"&&!e.currentTarget.innerText&&page.blocks.length>1){e.preventDefault();const arr=page.blocks.filter(b=>b.id!==block.id);updatePage({blocks:arr});setTimeout(()=>focusContentEnd(blockRefs.current[arr[Math.max(0,index-1)]?.id]),30);}}},block.html?undefined:block.text||"")}
    {menuBlock===block.id&&<div className="ocean-block-actions"><button title="Block options" onClick={()=>setColorMenu(v=>!v)}><MoreHorizontal size={15}/></button>{colorMenu&&<div className="ocean-color-menu"><strong>Text color</strong>{COLORS.map(([name,value])=><button key={name} onClick={()=>{updateBlock(block.id,{color:value});setColorMenu(false);}}>{name}</button>)}<strong>Background color</strong>{COLORS.map(([name,value])=><button key={name} onClick={()=>{updateBlock(block.id,{background:value});setColorMenu(false);}}>{name} background</button>)}<button onClick={()=>{updatePage({blocks:page.blocks.filter(b=>b.id!==block.id)});setColorMenu(false);}}>Delete block</button></div>}</div>}
  </div>;
 };
 return <div className={"ocean-shell "+(collapsed?"sidebar-collapsed":"")}>
  <aside className={"ocean-sidebar "+(mobileNav?"mobile-open":"")}>
   <div className="ocean-sidebar-top"><a className="ocean-brand" href="/"><span className="ocean-brand-mark"><OceanWaveMark/></span><span>OCEAN</span></a><button title="Collapse sidebar" onClick={()=>setCollapsed(v=>!v)}><PanelLeftClose size={17}/></button></div>
   <button className="ocean-search" onClick={()=>setShowSearch(v=>!v)}><Search size={15}/><span>Search pages</span><kbd>Ctrl K</kbd></button>
   <nav className="ocean-nav"><button className={activePanel==="page"?"active":""} onClick={()=>setActivePanel("page")}><Inbox size={16}/> Home</button><button onClick={()=>setShowComments(true)}><MessageCircle size={16}/> Comments</button><button onClick={()=>setToast("Calendar view is coming with database views.")}><Calendar size={16}/> Calendar</button>{user.role==="admin"&&<button className={activePanel==="access"?"active":""} onClick={()=>setActivePanel("access")}><ShieldCheck size={16}/> Access management</button>}</nav>
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
   <header className="ocean-topbar"><button className="ocean-mobile-menu" onClick={()=>setMobileNav(v=>!v)}><Menu size={19}/></button><div className="ocean-crumb"><span>{activePanel==="access"?"Administration":"Private"}</span>{activePanel==="access"?<><ChevronRight size={13}/><strong>Access management</strong></>:page&&<><ChevronRight size={13}/><strong>{page.title||"Untitled"}</strong></>}</div><div className="ocean-top-actions"><span className="ocean-save-state">{saving?"Saving…":"Saved"}</span><button title="Comments" onClick={()=>setShowComments(v=>!v)}><MessageCircle size={17}/></button><button title="Favorite" onClick={()=>updatePage({is_favorite:!page?.is_favorite})}><Heart size={17} fill={page?.is_favorite?"currentColor":"none"}/></button><button title="Page menu" onClick={()=>setShowPageMenu(v=>!v)}><MoreHorizontal size={19}/></button></div></header>
   {showSearch&&<div className="ocean-search-modal"><div><Search size={17}/><input autoFocus placeholder="Search pages…" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Escape"&&setShowSearch(false)}/><button onClick={()=>{setQuery("");setShowSearch(false);}}><X size={16}/></button></div>{filteredPages.map(p=><button key={p.id} onClick={()=>{openPage(p.id);setShowSearch(false);setQuery("");}}>{p.icon||"▤"} {p.title}</button>)}</div>}
   {showPageMenu&&<div className="ocean-page-menu"><button onClick={()=>{navigator.clipboard?.writeText(location.href);setToast("Link copied");setShowPageMenu(false);}}><Copy size={14}/> Copy link</button><button onClick={()=>{updatePage({is_favorite:!page?.is_favorite});setShowPageMenu(false);}}><Heart size={14}/> {page?.is_favorite?"Remove from favorites":"Add to favorites"}</button><button onClick={deletePage}><Trash2 size={14}/> Move to trash</button></div>}
   {activePanel==="access"?<div className="ocean-admin-scroll"><section className="ocean-admin-content"><div className="ocean-admin-heading"><div><span className="ocean-admin-eyebrow">ADMINISTRATION</span><h1>Workspace access</h1><p>Choose which accounts can enter OCEAN. Only Admin and Super User roles are allowed.</p></div><span className="ocean-role-pill admin">Admin</span></div><div className="ocean-access-card"><div className="ocean-access-card-head"><div><strong>Account permissions</strong><span>Changes take effect on the next sign-in.</span></div><button onClick={()=>{setAdminLoading(true);api("/ocean/admin/users").then(d=>setAdminUsers(d.users||[])).catch(e=>setAdminError(e.message)).finally(()=>setAdminLoading(false));}}><Activity size={15}/> Refresh</button></div>{adminError&&<div className="ocean-admin-error">{adminError}</div>}{adminLoading?<div className="ocean-admin-empty">Loading accounts…</div>:<div className="ocean-user-list">{adminUsers.map(u=><div className="ocean-managed-user" key={u.id}><div className="ocean-managed-avatar">{(u.display_name||u.email||"U").slice(0,1).toUpperCase()}</div><div className="ocean-managed-info"><strong>{u.display_name||u.email}</strong><span>{u.email}</span></div><span className={"ocean-role-pill "+(u.role==="admin"?"admin":u.role==="super_user"?"super":"user")}>{u.role==="admin"?"Admin":u.role==="super_user"?"Super User":"User"}</span>{u.role==="admin"?<span className="ocean-protected-label">Protected</span>:<select aria-label={"OCEAN access for "+u.email} value={u.role==="super_user"?"super_user":"user"} onChange={e=>changeOceanRole(u.id,e.target.value)}><option value="user">User — no access</option><option value="super_user">Super User — allow access</option></select>}</div>)}</div>}</div><div className="ocean-access-note"><ShieldCheck size={18}/><div><strong>Access is enforced by the server</strong><span>Changing the role also invalidates the account's current sessions. Admin accounts are protected from changes in this panel.</span></div></div></section></div>:loading?<div className="ocean-loading">Opening page…</div>:page?<div className="ocean-page-scroll" ref={editorRef}>
    {page.cover&&<div className="ocean-cover" style={{backgroundImage:"url("+page.cover+")"}}/>}
    <article className="ocean-editor">
     <div className="ocean-page-controls"><button onClick={()=>{const icon=prompt("Paste an emoji or icon",page.icon||"🌊");if(icon!==null)updatePage({icon});}}><Smile size={14}/> Add icon</button><button onClick={()=>{const cover=prompt("Paste an image URL for the cover",page.cover||"");if(cover!==null)updatePage({cover});}}><ImageIcon size={14}/> {page.cover?"Change cover":"Add cover"}</button><button onClick={()=>setShowComments(true)}><MessageCircle size={14}/> Add comment</button></div>
     <div className="ocean-title-row">{page.icon&&<span className="ocean-title-icon">{page.icon}</span>}<input className="ocean-title" value={page.title||""} placeholder="New page" onChange={e=>updatePage({title:e.target.value})}/></div>
     <div className="ocean-blocks">{(page.blocks||[]).map(renderBlock)}
      {!(page.blocks||[]).some(b=>(b.text||"").trim())&&<div className="ocean-add-line"><button onClick={()=>{setSlashBlock(null);setSlashQuery("");setShowSlash(true);}}><Plus size={15}/> Type / for commands</button></div>}
     </div>
     {showSlash&&<div className="ocean-slash-menu"><div className="ocean-slash-search"><span>/</span><input ref={slashInput} value={slashQuery} onChange={e=>setSlashQuery(e.target.value)} placeholder="Search for a block…" onKeyDown={e=>{if(e.key==="Escape"){e.preventDefault();setShowSlash(false);setTimeout(()=>focusContentEnd(blockRefs.current[slashBlock]),30);}if(e.key==="Enter"&&filteredCommands[0]){e.preventDefault();chooseCommand(filteredCommands[0][1]);}if(e.key==="Backspace"&&!slashQuery){e.preventDefault();setShowSlash(false);setTimeout(()=>focusContentEnd(blockRefs.current[slashBlock]),30);}}}/><kbd>ESC</kbd></div><div className="ocean-slash-results">{commandGroups.map(group=><section key={group}><small>{group}</small>{filteredCommands.filter(c=>c[2]===group).map(c=><button key={c[1]} onMouseDown={e=>e.preventDefault()} onClick={()=>chooseCommand(c[1])}><span className="ocean-command-icon">{c[3]}</span><span>{c[0]}</span></button>)}</section>)}{!filteredCommands.length&&<p>No matching blocks</p>}</div></div>}
    </article>
   </div>:<div className="ocean-empty"><div className="ocean-mark">O</div><h2>Your space, your flow.</h2><p>Create a page to start writing.</p><button className="ocean-primary" onClick={()=>createPage()}>Create a page</button></div>}
  </main>
  {showComments&&<><button className="ocean-drawer-scrim" onClick={()=>setShowComments(false)} aria-label="Close comments"/><aside className="ocean-comments"><header><strong>Comments</strong><button onClick={()=>setShowComments(false)}><X size={18}/></button></header><div className="ocean-comment-list">{comments.map(c=><article key={c.id}><span className="ocean-avatar">{(c.display_name||c.email||"U").slice(0,1).toUpperCase()}</span><div><strong>{c.display_name||c.email}</strong><p>{c.body}</p><small>{new Date(c.created_at*1000).toLocaleString()}</small></div></article>)}{!comments.length&&<p className="ocean-muted">No comments yet. Start the conversation.</p>}</div><form onSubmit={addComment}><textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="Add a comment…" rows={3}/><button className="ocean-primary" disabled={!comment.trim()}>Comment</button></form></aside></>}
  {toast&&<div className="ocean-toast">{toast}</div>}
 </div>;
}
export default OceanApp;
