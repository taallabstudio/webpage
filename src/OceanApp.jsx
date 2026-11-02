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
  ["Text","text","Basic blocks","T"],["Heading 1","heading1","Basic blocks","H1"],["Heading 2","heading2","Basic blocks","H2"],["Heading 3","heading3","Basic blocks","H3"],["Heading 4","heading4","Basic blocks","H4"],
  ["Bulleted list","bullet","Basic blocks","•"],["Numbered list","numbered","Basic blocks","1."],["To-do list","todo","Basic blocks","☑"],["Toggle list","toggle","Basic blocks","›"],["Page","page","Basic blocks","▤"],["Callout","callout","Basic blocks","▣"],["Quote","quote","Basic blocks","❝"],["Table","table","Basic blocks","▦"],["Divider","divider","Basic blocks","—"],["Link to page","pageLink","Basic blocks","↗"],
  ["Image","image","Media","▧"],["Video","video","Media","▻"],["Audio","audio","Media","♫"],["Code","code","Media","</>"],["File","file","Media","↥"],["Web bookmark","bookmark","Media","♧"],
  ["Table view","database-table","Database","▦"],["Board view","database-board","Database","▤"],["Gallery view","database-gallery","Database","▦"],["List view","database-list","Database","☷"],["Feed view","database-feed","Database","▤"],["Dashboard view","database-dashboard","Database","▥"],["Calendar view","database-calendar","Database","▦"],["Timeline view","database-timeline","Database","▥"],["Map view","database-map","Database","⌖"],["Vertical bar chart","chart-vertical","Database","▥"],["Horizontal bar chart","chart-horizontal","Database","▤"],["Line chart","chart-line","Database","⌁"],["Donut chart","chart-donut","Database","◉"],["Number chart","chart-number","Database","#"],["Form","form","Database","☷"],["Database - Inline","database-inline","Database","▦"],["Database - Full page","database-full","Database","▦"],["Linked view of data source","database-linked","Database","↗"],
  ["Table of contents","toc","Advanced blocks","☷"],["Block equation","equation","Advanced blocks","∑"],["Button","button","Advanced blocks","▣"],["Breadcrumb","breadcrumb","Advanced blocks","⌂"],["Tabs","tabs","Advanced blocks","▥"],["Synced block","synced","Advanced blocks","⧉"],["Toggle heading 1","toggle-heading1","Advanced blocks","H1›"],["Toggle heading 2","toggle-heading2","Advanced blocks","H2›"],["Toggle heading 3","toggle-heading3","Advanced blocks","H3›"],["2 columns","columns2","Advanced blocks","Ⅱ"],["3 columns","columns3","Advanced blocks","Ⅲ"],["4 columns","columns4","Advanced blocks","Ⅳ"],["5 columns","columns5","Advanced blocks","Ⅴ"],["AI Meeting Notes","meeting","Advanced blocks","✧"],["Code - Mermaid","mermaid","Advanced blocks","◇"],
  ["Mention a person","mention","Inline","@"],["Mention a page or data source","mention-page","Inline","↗"],["Date or reminder","date","Inline","◷"],["Emoji","emoji","Inline","☺"],["Inline equation","inline-equation","Inline","√"],["Embed","embed","Embeds","↗"],["HTML","html","Embeds","</>"],["Google Drive","google-drive","Embeds","▣"],["Tweet","tweet","Embeds","𝕏"],["GitHub Gist","gist","Embeds","⌘"],["Google Maps","maps","Embeds","⌖"],["Figma","figma","Embeds","◈"],["Excalidraw","excalidraw","Embeds","◇"],["PDF","pdf","Embeds","▧"],["Loom","loom","Embeds","◉"],["Typeform","typeform","Embeds","▤"],["CodePen","codepen","Embeds","◇"],["Replit","replit","Embeds","⌘"],["Deepnote","deepnote","Embeds","▧"],["Trello","trello","Embeds","▦"],["Slack","slack","Embeds","▧"],["Pitch","pitch","Embeds","▣"],["OneDrive","onedrive","Embeds","☁"],["Dropbox","dropbox","Embeds","◈"]
];
const EMOJIS=["🌊","📝","📚","🎧","🎵","🎹","🎬","💡","⭐","🔥","🎯","🧠","📌","🗂️","🪄","🌱","🚀","❤️","🎨","📷","💻","🧪","🛠️","🗓️","☕","🌙"];
const COLORS=[["Default",""],["Gray","gray"],["Brown","brown"],["Orange","orange"],["Yellow","yellow"],["Green","green"],["Blue","blue"],["Purple","purple"],["Pink","pink"],["Red","red"]];
const VIEWS=["Table","Board","Gallery","List","Feed","Calendar","Timeline","Map","Vertical bar chart","Horizontal bar chart","Line chart","Donut chart","Number chart"];
function OceanLogin({onLogin}){
 const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [code,setCode]=useState("");const [challenge,setChallenge]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);
 async function submit(e){e.preventDefault();setError("");setBusy(true);try{
  if(challenge){await api("/auth/2fa/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({challenge_id:challenge,code})});onLogin();return;}
  const result=await api("/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});
  if(result.requiresTwoFactor){setChallenge(result.challengeId);return;}onLogin();
 }catch(err){setError(err.message);}finally{setBusy(false);}}
 return <div className="ocean-auth"><div className="ocean-auth-card"><div className="ocean-mark">O</div><div className="ocean-wordmark">OCEAN</div><h1>{challenge?"Check your email":"Welcome back"}</h1><p>{challenge?"Enter the six-digit sign-in code sent to your email.":"Sign in with your existing TaalLab account."}</p><form onSubmit={submit}>{!challenge?<><label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></label></>:<label>6-digit code<input inputMode="numeric" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} autoFocus required/></label>}{error&&<div className="ocean-error">{error}</div>}<button className="ocean-primary" disabled={busy}>{busy?"Please wait…":challenge?"Verify and continue":"Sign in"}</button></form><small>Your OCEAN workspace is private to your account.</small></div></div>;
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

 const loadPages=useCallback(async()=>{const data=await api("/ocean/pages");setPages(data.pages||[]);return data.pages||[];},[]);
 const openPage=useCallback(async(id)=>{setLoading(true);setShowSlash(false);setShowPageMenu(false);try{const data=await api("/ocean/pages/"+id);const p=data.page;p.blocks=JSON.parse(p.blocks_json||"[]");setPage(p);setShowComments(false);}catch(e){setToast(e.message);}finally{setLoading(false);}},[]);
 useEffect(()=>{let alive=true;api("/auth/me").then(async d=>{if(!alive)return;if(!d.authenticated){setChecking(false);return;}setUser(d.user);const list=await loadPages();if(alive&&list.length)await openPage(list[0].id);}).catch(e=>setAuthError(e.message)).finally(()=>{if(alive)setChecking(false);});return()=>{alive=false;};},[loadPages,openPage]);
 useEffect(()=>{if(!page)return;clearTimeout(saveTimer.current);setSaving(true);saveTimer.current=setTimeout(async()=>{try{await api("/ocean/pages/"+page.id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:page.title,icon:page.icon,cover:page.cover,blocks:page.blocks,is_favorite:!!page.is_favorite})});setPages(old=>old.map(p=>p.id===page.id?{...p,title:page.title,icon:page.icon,cover:page.cover,is_favorite:page.is_favorite,updated_at:Math.floor(Date.now()/1000)}:p));setSaving(false);}catch(e){setSaving(false);setToast("Couldn't save: "+e.message);}},650);return()=>clearTimeout(saveTimer.current);},[page]);
 useEffect(()=>{if(showSlash){slashInput.current?.focus();}},[showSlash]);
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
 const updateBlock=(id,patch)=>updatePage({blocks:page.blocks.map(b=>b.id===id?{...b,...patch}:b)});
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
  setPage(old=>{
   if(!old)return old;
   const arr=[...(old.blocks||[])];let idx=afterId?arr.findIndex(b=>b.id===afterId):-1;
   if(removeSlash&&idx>=0)arr[idx]={...arr[idx],text:(arr[idx].text||"").replace(new RegExp("/[^/]*$"),"")};
   arr.splice(idx+1,0,block);return {...old,blocks:arr};
  });
  setShowSlash(false);setSlashQuery("");setSlashBlock(null);
  setTimeout(()=>blockRefs.current[block.id]?.focus(),40);
 };
 const chooseCommand=(type)=>insertBlock(type,slashBlock||page.blocks.at(-1)?.id,!!slashBlock);
 const createPage=async(parentId=null)=>{try{const d=await api("/ocean/pages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:"Untitled",parent_id:parentId})});await loadPages();await openPage(d.page.id);setMobileNav(false);}catch(e){setToast(e.message);}};
 const deletePage=async()=>{if(!page||!confirm("Move this page to trash?"))return;try{await api("/ocean/pages/"+page.id,{method:"DELETE"});const list=await loadPages();setPage(null);if(list[0])openPage(list[0].id);setShowPageMenu(false);}catch(e){setToast(e.message);}};
 const addComment=async(e)=>{e.preventDefault();if(!comment.trim())return;try{await api("/ocean/pages/"+page.id+"/comments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({body:comment})});setComment("");const d=await api("/ocean/pages/"+page.id+"/comments");setComments(d.comments||[]);}catch(e){setToast(e.message);}};
 const signOut=async()=>{try{await api("/auth/logout",{method:"POST"});}catch{}setUser(null);setPage(null);setPages([]);};
 const updateTableCell=(blockId,row,col,value)=>updateBlock(blockId,{rows:page.blocks.find(b=>b.id===blockId).rows.map((r,ri)=>r.map((v,ci)=>ri===row&&ci===col?value:v))});
 const promptUrl=(id,label)=>{const url=prompt("Paste "+label+" URL");if(url)updateBlock(id,{url});};
 const filteredCommands=COMMANDS.filter(c=>c[0].toLowerCase().includes(slashQuery.toLowerCase())||c[1].toLowerCase().includes(slashQuery.toLowerCase()));
 const commandGroups=[...new Set(filteredCommands.map(c=>c[2]))];

 if(checking)return <div className="ocean-loading"><div className="ocean-mark">O</div><span>Opening your workspace…</span></div>;
 if(!user)return <OceanLogin onLogin={async()=>{try{const d=await api("/auth/me");setUser(d.user);const list=await loadPages();if(list[0])await openPage(list[0].id);}catch(e){setAuthError(e.message);}}}/>;

 const renderBlock=(block,index)=>{
  const isText=["text","heading1","heading2","heading3","heading4","bullet","numbered","todo","quote","callout","toggle","code","mermaid","equation","inline-equation","toc","page","pageLink","form","meeting","button","breadcrumb","tabs","synced","toggle-heading1","toggle-heading2","toggle-heading3","mention","mention-page","date","emoji"].includes(block.type);
  if(block.type==="divider")return <div className="ocean-divider" key={block.id} onMouseEnter={()=>setMenuBlock(block.id)}><div/></div>;
  if(block.type==="table")return <div className="ocean-table-wrap" key={block.id}><table className="ocean-table"><tbody>{(block.rows||[]).map((row,ri)=><tr key={ri}>{row.map((cell,ci)=><td key={ci}><input value={cell} onChange={e=>updateTableCell(block.id,ri,ci,e.target.value)} placeholder=" " /></td>)}</tr>)}</tbody></table><button className="ocean-inline-add" onClick={()=>updateBlock(block.id,{rows:[...(block.rows||[]),["","",""]]})}><Plus size={13}/> Add row</button></div>;
  if(block.type==="columns")return <div className="ocean-columns" style={{gridTemplateColumns:"repeat("+block.count+",minmax(0,1fr))"}} key={block.id}>{Array.from({length:block.count},(_,i)=><div key={i}><textarea placeholder={"Column "+(i+1)} value={(block.columns||Array(block.count).fill(""))[i]||""} onChange={e=>{const cols=[...(block.columns||Array(block.count).fill(""))];cols[i]=e.target.value;updateBlock(block.id,{columns:cols});}} /></div>)}</div>;
  if(block.type==="database"||block.type==="chart")return <div className="ocean-database-block" key={block.id}><div className="ocean-db-title"><Database size={17}/><input value={block.text||"Untitled database"} onChange={e=>updateBlock(block.id,{text:e.target.value})}/><select value={block.view||"table"} onChange={e=>updateBlock(block.id,{view:e.target.value})}>{VIEWS.map(v=><option key={v} value={v.toLowerCase().replaceAll(" ","-")}>{v}</option>)}</select></div><div className="ocean-db-toolbar"><span>{block.type==="chart"?"Chart preview":"Data source"}</span><button onClick={()=>updateBlock(block.id,{rows:[...(block.rows||[]),["New item","Not started",""]]})}><Plus size={13}/> New</button></div>{block.view==="table"||block.type==="database"?<table className="ocean-table"><tbody>{(block.rows||[]).map((row,ri)=><tr key={ri}>{row.map((cell,ci)=><td key={ci}><input value={cell} onChange={e=>updateTableCell(block.id,ri,ci,e.target.value)}/></td>)}</tr>)}</tbody></table>:<div className="ocean-view-placeholder"><Grid2X2 size={24}/><strong>{VIEWS.find(v=>v.toLowerCase().replaceAll(" ","-")===block.view)||block.view} view</strong><span>Change the view selector to explore this database layout.</span>{(block.rows||[]).slice(1).map((r,i)=><div className="ocean-view-row" key={i}>{r[0]} <span>{r[1]}</span></div>)}</div>}</div>;
  if(["image","video","audio","file","bookmark","embed","google-drive","maps","pdf","html","gist","figma","excalidraw","loom","typeform","codepen","replit","deepnote","trello","slack","pitch","onedrive","dropbox","tweet"].includes(block.type))return <div className="ocean-embed-block" key={block.id}><div className="ocean-embed-icon">{block.type==="image"?<ImageIcon/>:block.type==="video"?<Video/>:block.type==="audio"?<AudioLines/>:<Link/>}</div><div className="ocean-embed-content"><strong>{block.type==="bookmark"?"Web bookmark":block.type[0].toUpperCase()+block.type.slice(1).replaceAll("-"," ")}</strong>{block.url?<a href={block.url} target="_blank" rel="noreferrer">{block.url}</a>:<span>Paste a link to add this content.</span>}</div><button onClick={()=>promptUrl(block.id,block.type)}>{block.url?"Change":"Add link"}</button></div>;
  if(!isText)return null;
  const tag=block.type.startsWith("heading")?"h"+block.type.slice(-1):block.type==="quote"?"blockquote":"div";
  const placeholder=({text:"Type '/' for commands",heading1:"Heading 1",heading2:"Heading 2",heading3:"Heading 3",heading4:"Heading 4",bullet:"List item",numbered:"List item",todo:"To-do",quote:"Write a quote",callout:"Write something helpful",toggle:"Toggle heading",code:"Write or paste code",mermaid:"Mermaid diagram code",equation:"Enter an equation",page:"Untitled page",pageLink:"Search for a page",toc:"Table of contents",meeting:"Meeting notes",date:"Add a date or reminder"})[block.type]||"";
  const className="ocean-block-text "+block.type+(block.color?" color-"+block.color:"")+(block.background?" bg-"+block.background:"");
  return <div className={"ocean-block-row "+(menuBlock===block.id?"is-hovered":"")} key={block.id} onMouseEnter={()=>setMenuBlock(block.id)} onMouseLeave={()=>{setMenuBlock(null);setColorMenu(false);}}>
    <div className="ocean-block-gutter"><button title="Add block" onClick={()=>{setSlashBlock(block.id);setShowSlash(true);setSlashQuery("");}}>⠿</button></div>
    {block.type==="todo"&&<input className="ocean-check" type="checkbox" checked={!!block.checked} onChange={e=>updateBlock(block.id,{checked:e.target.checked})}/>}
    {block.type==="bullet"&&<span className="ocean-list-marker">•</span>}{block.type==="numbered"&&<span className="ocean-list-marker">{index+1}.</span>}
    {block.type==="toggle"&&<details className="ocean-toggle"><summary></summary><div className="ocean-toggle-body">{block.children||"Add details…"}</div></details>}
    {React.createElement(tag,{ref:el=>blockRefs.current[block.id]=el,contentEditable:true,suppressContentEditableWarning:true,"data-placeholder":placeholder,className:className,style:{color:block.textColor||undefined,background:block.bgColor||undefined},onInput:e=>{const text=e.currentTarget.innerText;updateBlock(block.id,{text});if(text.endsWith("/")){setSlashBlock(block.id);setSlashQuery("");setShowSlash(true);}else if(showSlash&&slashBlock===block.id){setSlashQuery(text.split("/").at(-1)||"");}},onKeyDown:e=>{if(e.key==="Escape"&&showSlash){setShowSlash(false);return;}if(e.key==="Enter"&&!e.shiftKey&&!showSlash){e.preventDefault();insertBlock("text",block.id);}if(e.key==="Backspace"&&!e.currentTarget.innerText&&page.blocks.length>1){e.preventDefault();const arr=page.blocks.filter(b=>b.id!==block.id);updatePage({blocks:arr});setTimeout(()=>blockRefs.current[arr[Math.max(0,index-1)]?.id]?.focus(),20);}}},block.text||"")}
    {menuBlock===block.id&&<div className="ocean-block-actions"><button title="Block options" onClick={()=>setColorMenu(v=>!v)}><MoreHorizontal size={15}/></button>{colorMenu&&<div className="ocean-color-menu"><strong>Text color</strong>{COLORS.map(([name,value])=><button key={name} onClick={()=>{updateBlock(block.id,{color:value});setColorMenu(false);}}>{name}</button>)}<strong>Background color</strong>{COLORS.map(([name,value])=><button key={name} onClick={()=>{updateBlock(block.id,{background:value});setColorMenu(false);}}>{name} background</button>)}<button onClick={()=>{updatePage({blocks:page.blocks.filter(b=>b.id!==block.id)});setColorMenu(false);}}>Delete block</button></div>}</div>}
  </div>;
 };
 return <div className={"ocean-shell "+(collapsed?"sidebar-collapsed":"")}>
  <aside className={"ocean-sidebar "+(mobileNav?"mobile-open":"")}>
   <div className="ocean-sidebar-top"><a className="ocean-brand" href="/"><span className="ocean-brand-mark">O</span><span>OCEAN</span></a><button title="Collapse sidebar" onClick={()=>setCollapsed(v=>!v)}><PanelLeftClose size={17}/></button></div>
   <button className="ocean-search" onClick={()=>setShowSearch(v=>!v)}><Search size={15}/><span>Search pages</span><kbd>Ctrl K</kbd></button>
   <nav className="ocean-nav"><button className="active"><Inbox size={16}/> Home</button><button onClick={()=>setShowComments(true)}><MessageCircle size={16}/> Comments</button><button onClick={()=>setToast("Calendar view is coming with database views.")}><Calendar size={16}/> Calendar</button></nav>
   <div className="ocean-side-scroll">
    <div className="ocean-side-label">Favorites <button onClick={()=>createPage()} title="New page"><Plus size={15}/></button></div>
    {favoritePages.map(p=><button key={p.id} className={"ocean-page-link "+(page?.id===p.id?"selected":"")} onClick={()=>{openPage(p.id);setMobileNav(false);}}><span>{p.icon||"▤"}</span><span>{p.title}</span></button>)}
    <div className="ocean-side-label">Private <button onClick={()=>createPage()} title="New page"><Plus size={15}/></button></div>
    {renderSidebarPages()}
    <button className="ocean-new-page" onClick={()=>createPage()}><Plus size={15}/> New page</button>
   </div>
   <div className="ocean-user"><button onClick={()=>setShowAccount(v=>!v)}><span className="ocean-avatar">{(user.display_name||user.email||"U").slice(0,1).toUpperCase()}</span><span className="ocean-user-name">{user.display_name||user.email}</span><MoreHorizontal size={16}/></button>{showAccount&&<div className="ocean-account-pop"><strong>{user.email}</strong><button onClick={signOut}><LogOut size={14}/> Sign out</button></div>}</div>
  </aside>
  <main className="ocean-main">
   <header className="ocean-topbar"><button className="ocean-mobile-menu" onClick={()=>setMobileNav(v=>!v)}><Menu size={19}/></button><div className="ocean-crumb"><span>Private</span>{page&&<><ChevronRight size={13}/><strong>{page.title||"Untitled"}</strong></>}</div><div className="ocean-top-actions"><span className="ocean-save-state">{saving?"Saving…":"Saved"}</span><button title="Comments" onClick={()=>setShowComments(v=>!v)}><MessageCircle size={17}/></button><button title="Favorite" onClick={()=>updatePage({is_favorite:!page?.is_favorite})}><Heart size={17} fill={page?.is_favorite?"currentColor":"none"}/></button><button title="Page menu" onClick={()=>setShowPageMenu(v=>!v)}><MoreHorizontal size={19}/></button></div></header>
   {showSearch&&<div className="ocean-search-modal"><div><Search size={17}/><input autoFocus placeholder="Search pages…" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Escape"&&setShowSearch(false)}/><button onClick={()=>{setQuery("");setShowSearch(false);}}><X size={16}/></button></div>{filteredPages.map(p=><button key={p.id} onClick={()=>{openPage(p.id);setShowSearch(false);setQuery("");}}>{p.icon||"▤"} {p.title}</button>)}</div>}
   {showPageMenu&&<div className="ocean-page-menu"><button onClick={()=>{navigator.clipboard?.writeText(location.href);setToast("Link copied");setShowPageMenu(false);}}><Copy size={14}/> Copy link</button><button onClick={()=>{updatePage({is_favorite:!page?.is_favorite});setShowPageMenu(false);}}><Heart size={14}/> {page?.is_favorite?"Remove from favorites":"Add to favorites"}</button><button onClick={deletePage}><Trash2 size={14}/> Move to trash</button></div>}
   {loading?<div className="ocean-loading">Opening page…</div>:page?<div className="ocean-page-scroll" ref={editorRef}>
    {page.cover&&<div className="ocean-cover" style={{backgroundImage:"url("+page.cover+")"}}/>}
    <article className="ocean-editor">
     <div className="ocean-page-controls"><button onClick={()=>{const icon=prompt("Paste an emoji or icon",page.icon||"🌊");if(icon!==null)updatePage({icon});}}><Smile size={14}/> Add icon</button><button onClick={()=>{const cover=prompt("Paste an image URL for the cover",page.cover||"");if(cover!==null)updatePage({cover});}}><ImageIcon size={14}/> {page.cover?"Change cover":"Add cover"}</button><button onClick={()=>setShowComments(true)}><MessageCircle size={14}/> Add comment</button></div>
     <div className="ocean-title-row"><span className="ocean-title-icon">{page.icon}</span><input className="ocean-title" value={page.title||""} placeholder="New page" onChange={e=>updatePage({title:e.target.value})}/></div>
     <div className="ocean-blocks">{(page.blocks||[]).map(renderBlock)}
      <div className="ocean-add-line"><button onClick={()=>{setSlashBlock(null);setSlashQuery("");setShowSlash(true);}}><Plus size={15}/> Type / for commands</button></div>
     </div>
     {showSlash&&<div className="ocean-slash-menu"><div className="ocean-slash-search"><span>/</span><input ref={slashInput} value={slashQuery} onChange={e=>setSlashQuery(e.target.value)} placeholder="Search for a block…" onKeyDown={e=>{if(e.key==="Escape")setShowSlash(false);if(e.key==="Enter"&&filteredCommands[0])chooseCommand(filteredCommands[0][1]);}}/><kbd>ESC</kbd></div><div className="ocean-slash-results">{commandGroups.map(group=><section key={group}><small>{group}</small>{filteredCommands.filter(c=>c[2]===group).map(c=><button key={c[1]} onClick={()=>chooseCommand(c[1])}><span className="ocean-command-icon">{c[3]}</span><span>{c[0]}</span></button>)}</section>)}{!filteredCommands.length&&<p>No matching blocks</p>}</div></div>}
    </article>
   </div>:<div className="ocean-empty"><div className="ocean-mark">O</div><h2>Your space, your flow.</h2><p>Create a page to start writing.</p><button className="ocean-primary" onClick={()=>createPage()}>Create a page</button></div>}
  </main>
  {showComments&&<><button className="ocean-drawer-scrim" onClick={()=>setShowComments(false)} aria-label="Close comments"/><aside className="ocean-comments"><header><strong>Comments</strong><button onClick={()=>setShowComments(false)}><X size={18}/></button></header><div className="ocean-comment-list">{comments.map(c=><article key={c.id}><span className="ocean-avatar">{(c.display_name||c.email||"U").slice(0,1).toUpperCase()}</span><div><strong>{c.display_name||c.email}</strong><p>{c.body}</p><small>{new Date(c.created_at*1000).toLocaleString()}</small></div></article>)}{!comments.length&&<p className="ocean-muted">No comments yet. Start the conversation.</p>}</div><form onSubmit={addComment}><textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="Add a comment…" rows={3}/><button className="ocean-primary" disabled={!comment.trim()}>Comment</button></form></aside></>}
  {toast&&<div className="ocean-toast">{toast}</div>}
 </div>;
}
export default OceanApp;
