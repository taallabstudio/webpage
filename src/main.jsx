import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownToLine, ArrowLeft, Check, ChevronRight, Clock3, Copy, Download,
  Eye, File, FileAudio, FileImage, FileText, FileVideo, FolderOpen, Gauge,
  HardDrive, Link2, LockKeyhole, LogOut, Menu, MessageSquare, MoreHorizontal,
  Play, Plus, RefreshCw, Search, Settings, ShieldCheck, Trash2, UploadCloud,
  UserRound, X
} from "lucide-react";
import "./styles.css";

const DEMO = {
  id: "8Fh29KxP",
  createdAt: "October 1, 2026",
  expiresAt: "October 8, 2026",
  message: "Here are the final brand master assets and 4K renders for the presentation. Ping me if you need vector exports!",
  totalSize: "1.42 GB",
  files: [
    { id:"demo-1", name:"Final_Brand_Identity_Guide.pdf", size:"18.4 MB", type:"Portable Document", icon:"pdf", downloads:0 },
    { id:"demo-2", name:"Keynote_Presentation_Q3_Review.key", size:"240.6 MB", type:"Presentation Deck", icon:"video", downloads:0 },
    { id:"demo-3", name:"Product_Hero_Renders_4K_Pack.zip", size:"1.1 GB", type:"28 files archived", icon:"zip", downloads:0 },
    { id:"demo-4", name:"Typography_Licensing_Notes.txt", size:"14 KB", type:"Plain Text Document", icon:"text", downloads:0 }
  ]
};

const api = async (path, options={}) => {
  const res = await fetch(`/api${path}`, { credentials:"include", ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
};

function Logo() {
  return <div className="brand"><span className="brand-mark">↗</span><span>TaalLab</span></div>;
}

function IconFor({kind}) {
  if (kind === "audio") return <FileAudio />;
  if (kind === "image") return <FileImage />;
  if (kind === "video") return <FileVideo />;
  if (kind === "pdf") return <FileText />;
  return <File />;
}

function Landing() {
  return <main className="landing">
    <div className="landing-glow" />
    <Logo />
    <div className="landing-center">
      <div className="eyebrow"><span className="dot" /> TaalLab Transfer</div>
      <h1>Page in building</h1>
      <p>Thank you for working with TaalLab.</p>
    </div>
  </main>;
}

function Header({admin=false, onLogout}) {
  return <header className="topbar">
    <Logo />
    {admin ? <nav className="topnav">
      <a href="/admin">Dashboard</a><a href="/admin/upload">New Transfer</a>
      <button className="ghost-btn" onClick={onLogout}><LogOut size={16}/> Logout</button>
    </nav> : <nav className="topnav">
      <span className="status-pill"><span className="dot"/> Secure transfer</span>
      <span className="muted">TaalLab</span>
    </nav>}
  </header>;
}

function TransferPage({id}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    api(`/transfers/${id}`).then(setData).catch(e => setError(e.message));
  }, [id]);

  if (error) return <div className="transfer-shell"><Header/><div className="expired"><Clock3/><h2>Transfer Expired</h2><p>{error}</p></div></div>;
  if (!data) return <div className="loading"><RefreshCw className="spin"/> Loading transfer…</div>;

  return <div className="transfer-shell">
    <Header/>
    <div className="transfer-bg"/>
    <section className="transfer-card">
      <div className="transfer-status-row">
        <span className="success-pill"><span className="dot"/> Verified &amp; Ready to Download</span>
        <span className="expiry-pill"><Clock3 size={15}/> Expires in {data.expiresLabel}</span>
      </div>
      <div className="divider"/>
      <div className="sender-row">
        <div className="avatar">TL<span/></div>
        <div className="sender"><strong>TaalLab</strong><small>Secure studio transfer</small></div>
        <div className="summary"><strong>{data.files.length} files • {data.totalSize}</strong><small>Private TaalLab delivery</small></div>
      </div>
      {data.message && <div className="message-box"><MessageSquare size={18}/><div><p>“{data.message}”</p><small>Attached to transfer package #{data.id}</small></div></div>}
      <div className="primary-actions">
        <button className="primary-btn" onClick={async()=>{ const r=await api(`/transfers/${data.id}/download-all`); r.files.forEach((u,i)=>setTimeout(()=>{ const a=document.createElement("a"); a.href=u; a.rel="noopener"; document.body.appendChild(a); a.click(); a.remove(); }, i*450)); }}><ArrowDownToLine/> Download All ({data.totalSize})</button>
      </div>
      <div className="security-strip"><LockKeyhole size={15}/> Private transfer • Files expire automatically • Secure storage</div>
      <div className="manifest-head"><div><h3>Transfer Manifest</h3><small>Select items to preview or download</small></div></div>
      <div className="file-list">
        {data.files.map(file => <div className="file-row" key={file.id}>
          <div className={`file-icon ${file.kind}`}><IconFor kind={file.kind}/></div>
          <div className="file-info"><strong>{file.name}</strong><small>{file.size} <span>•</span> {file.type}</small></div>
          <div className="row-actions">
            {file.preview && <button className="icon-btn" title="Preview" onClick={()=>setPreview(file)}><Eye size={17}/></button>}
            <a className="download-btn" href={`/f/${file.token}`}><ArrowDownToLine size={15}/> Download</a>
          </div>
        </div>)}
      </div>
      <div className="checksum"><span># SHA-256 Checksum: <b>{data.checksum || "verified on server"}</b></span><span className="speed">↗ Private transfer</span></div>
    </section>
    {preview && <Preview file={preview} onClose={()=>setPreview(null)}/>}
  </div>;
}

function Preview({file,onClose}) {
  return <div className="modal-backdrop" onClick={onClose}>
    <div className="preview-modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-head"><strong>{file.name}</strong><button onClick={onClose}><X/></button></div>
      {file.kind === "audio" ? <audio controls autoPlay src={`/api/files/${file.token}/preview`}/> :
       file.kind === "image" ? <img src={`/api/files/${file.token}/preview`} alt="" /> :
       file.kind === "video" ? <video controls autoPlay src={`/api/files/${file.token}/preview`}/> :
       <div className="preview-placeholder"><FileText/><p>Preview this file in its native application.</p></div>}
    </div>
  </div>;
}

function Login({onLogin}) {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [setup,setSetup]=useState(false);
  const [setupSecret,setSetupSecret]=useState("");
  async function submit(e) {
    e.preventDefault(); setError("");
    try {
      const body=setup?{email,password,setup_secret:setupSecret}:{email,password};
      await api(setup?"/auth/setup":"/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      onLogin();
    } catch(e){setError(e.message)}
  }
  return <div className="login-page"><div className="login-card">
    <Logo/><div className="login-icon"><ShieldCheck/></div>
    <h1>{setup?"Create admin account":"Sign in"}</h1>
    <p>{setup?"Set up the first TaalLab administrator.":"Manage TaalLab transfers securely."}</p>
    <form onSubmit={submit}>
      <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoFocus required/></label>
      {setup&&<label>Setup secret<input type="password" value={setupSecret} onChange={e=>setSetupSecret(e.target.value)} required/></label>}
      <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} required/></label>
      {error&&<div className="error-box">{error}</div>}
      <button className="primary-btn full">{setup?"Create admin & sign in":"Sign in"}</button>
    </form>
    <button className="ghost-btn full" style={{marginTop:12}} onClick={()=>{setSetup(v=>!v);setError("")}}>
      {setup?"Back to sign in":"First-time setup"}
    </button>
  </div></div>;
}

function Admin({initialUpload=false}) {
  const [authed,setAuthed]=useState(null);
  const [user,setUser]=useState(null);
  const [page,setPage]=useState(initialUpload ? "upload" : "dashboard");
  const [stats,setStats]=useState(null);
  const [transfers,setTransfers]=useState([]);
  const [selected,setSelected]=useState(null);

  async function refresh(){
    try {
      const me=await api("/auth/me");
      if(!me.authenticated){setAuthed(false);return;}
      if(me.user.role!=="admin"){setAuthed(false);return;}
      setUser(me.user);
      const d=await api("/admin/overview");
      setStats(d.stats); setTransfers(d.transfers); setAuthed(true);
    } catch { setAuthed(false); }
  }
  useEffect(()=>{refresh()},[]);
  if(authed===null) return <div className="loading"><RefreshCw className="spin"/> Checking session…</div>;
  if(!authed) return <Login onLogin={refresh}/>;

  async function logout(){await api("/auth/logout",{method:"POST"});setAuthed(false);setUser(null)}
  return <div className="admin-layout">
    <aside className="sidebar"><Logo/><div className="side-links">
      <button className={page==="dashboard"?"active":""} onClick={()=>setPage("dashboard")}><Gauge/> Dashboard</button>
      <button className={page==="transfers"?"active":""} onClick={()=>setPage("transfers")}><FolderOpen/> Transfers</button>
      <button className={page==="upload"?"active":""} onClick={()=>setPage("upload")}><UploadCloud/> New Transfer</button>
      <button className={page==="users"?"active":""} onClick={()=>setPage("users")}><UserRound/> Users</button>
      <button className={page==="settings"?"active":""} onClick={()=>setPage("settings")}><Settings/> Account</button>
    </div><div style={{padding:"12px 14px",fontSize:12,opacity:.65}}>{user?.email}</div><button className="side-logout" onClick={logout}><LogOut/> Logout</button></aside>
    <main className="admin-main">
      <div className="admin-mobile-head"><Logo/><button><Menu/></button></div>
      {page==="dashboard"&&<Dashboard stats={stats} transfers={transfers} onOpen={setSelected}/>}
      {page==="transfers"&&<Transfers transfers={transfers} onOpen={setSelected}/>}
      {page==="upload"&&<Upload onDone={()=>{setPage("dashboard");refresh()}}/>}
      {page==="users"&&<UserManagement currentUser={user}/>}
      {page==="settings"&&<AccountSettings user={user} onPasswordChanged={refresh}/>}
      {selected&&<TransferDetail transfer={selected} onClose={()=>setSelected(null)} onChanged={refresh}/>}
    </main>
  </div>;
}

function UserManagement({currentUser}) {
  const [users,setUsers]=useState([]);
  const [loading,setLoading]=useState(true);
  const [form,setForm]=useState({email:"",password:"",role:"user"});
  const [error,setError]=useState("");
  async function load(){try{const d=await api("/admin/users");setUsers(d.users)}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[]);
  async function create(e){
    e.preventDefault();setError("");
    try{await api("/admin/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});setForm({email:"",password:"",role:"user"});load()}catch(e){setError(e.message)}
  }
  async function update(id,body){
    try{await api("/admin/users/"+id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});load()}catch(e){setError(e.message)}
  }
  return <div className="admin-content"><div className="page-head"><div><span className="eyebrow">ADMINISTRATION</span><h1>Users</h1><p>Create accounts and manage passwords, roles and access.</p></div></div>
    <section className="panel" style={{padding:24}}>
      <h2>Create user</h2>
      <form onSubmit={create} style={{display:"grid",gridTemplateColumns:"1.3fr 1fr .7fr auto",gap:12,alignItems:"end"}}>
        <label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/></label>
        <label>Temporary password<input type="password" minLength={8} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required/></label>
        <label>Role<select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="user">User</option><option value="admin">Admin</option></select></label>
        <button className="primary-btn">Create</button>
      </form>
      {error&&<div className="error-box" style={{marginTop:14}}>{error}</div>}
    </section>
    <section className="panel"><div className="panel-head"><div><h2>Accounts</h2><p>{users.length} account{users.length===1?"":"s"}</p></div></div>
      {loading?<div className="loading">Loading…</div>:<div className="table-wrap"><table><thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Password</th><th></th></tr></thead><tbody>
        {users.map(u=><tr key={u.id}><td>{u.email}</td><td><select value={u.role} disabled={u.id===currentUser?.id} onChange={e=>update(u.id,{role:e.target.value})}><option value="user">User</option><option value="admin">Admin</option></select></td><td><button className="ghost-btn" disabled={u.id===currentUser?.id} onClick={()=>update(u.id,{status:u.status==="active"?"disabled":"active"})}>{u.status}</button></td><td><button className="ghost-btn" onClick={()=>{const p=prompt("Enter a new password (minimum 8 characters):");if(p)update(u.id,{password:p})}}>Change password</button></td><td>{u.id===currentUser?.id?<span className="muted">You</span>:null}</td></tr>)}
      </tbody></table></div>}
    </section>
  </div>;
}

function AccountSettings({user,onPasswordChanged}) {
  const [currentPassword,setCurrentPassword]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  async function change(e){
    e.preventDefault();setMessage("");setError("");
    try{await api("/account/password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({current_password:currentPassword,new_password:newPassword})});setCurrentPassword("");setNewPassword("");setMessage("Password changed successfully.");onPasswordChanged()}catch(e){setError(e.message)}
  }
  return <div className="admin-content"><div className="page-head"><div><span className="eyebrow">ACCOUNT</span><h1>Account</h1><p>{user?.email} • {user?.role}</p></div></div>
    <section className="panel" style={{maxWidth:620,padding:24}}><h2>Change password</h2><form onSubmit={change}>
      <label>Current password<input type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} required/></label>
      <label>New password<input type="password" minLength={8} value={newPassword} onChange={e=>setNewPassword(e.target.value)} required/></label>
      {error&&<div className="error-box">{error}</div>}{message&&<div className="success-pill">{message}</div>}
      <button className="primary-btn">Change password</button>
    </form></section>
  </div>;
}

function Admin({initialUpload=false}) {
  const [authed,setAuthed]=useState(null);
  const [page,setPage]=useState(initialUpload ? "upload" : "dashboard");
  const [stats,setStats]=useState(null);
  const [transfers,setTransfers]=useState([]);
  const [selected,setSelected]=useState(null);

  async function refresh(){ try { const d=await api("/admin/overview"); setStats(d.stats); setTransfers(d.transfers); setAuthed(true); } catch { setAuthed(false); } }
  useEffect(()=>{refresh()},[]);
  if (authed===null) return <div className="loading"><RefreshCw className="spin"/> Checking admin session…</div>;
  if (!authed) return <Login onLogin={refresh}/>;

  async function logout(){await api("/admin/logout",{method:"POST"});setAuthed(false)}
  return <div className="admin-layout">
    <aside className="sidebar"><Logo/><div className="side-links">
      <button className={page==="dashboard"?"active":""} onClick={()=>setPage("dashboard")}><Gauge/> Dashboard</button>
      <button className={page==="transfers"?"active":""} onClick={()=>setPage("transfers")}><FolderOpen/> Transfers</button>
      <button className={page==="upload"?"active":""} onClick={()=>setPage("upload")}><UploadCloud/> New Transfer</button>
      <button><HardDrive/> Storage</button><button><Settings/> Settings</button>
    </div><button className="side-logout" onClick={logout}><LogOut/> Logout</button></aside>
    <main className="admin-main">
      <div className="admin-mobile-head"><Logo/><button><Menu/></button></div>
      {page==="dashboard" && <Dashboard stats={stats} transfers={transfers} onOpen={setSelected}/>}
      {page==="transfers" && <Transfers transfers={transfers} onOpen={setSelected}/>}
      {page==="upload" && <Upload onDone={()=>{setPage("dashboard");refresh()}}/>}
      {selected && <TransferDetail transfer={selected} onClose={()=>setSelected(null)} onChanged={refresh}/>}
    </main>
  </div>;
}

function Dashboard({stats,transfers,onOpen}) {
  const cards=[
    ["Active transfers",stats?.active_transfers||0,FolderOpen],
    ["Total files",stats?.total_files||0,File],
    ["Storage used",formatBytes(stats?.storage||0),HardDrive],
    ["Total downloads",stats?.downloads||0,Download],
    ["Expiring soon",stats?.expiring_soon||0,Clock3],
    ["Expired / cleanup",stats?.expired||0,Trash2]
  ];
  return <div className="admin-content"><div className="page-head"><div><span className="eyebrow">TAALLAB TRANSFER</span><h1>Dashboard</h1><p>Everything you need to manage client deliveries.</p></div><button className="primary-btn" onClick={()=>location.href="/admin/upload"}><Plus/> New Transfer</button></div>
    <div className="stat-grid">{cards.map(([label,value,Icon])=><div className="stat-card" key={label}><div className="stat-icon"><Icon/></div><span>{label}</span><strong>{value}</strong></div>)}</div>
    <section className="panel"><div className="panel-head"><div><h2>Recent transfers</h2><p>Client deliveries and download activity.</p></div><button className="ghost-btn" onClick={()=>location.href="/admin"}>View all <ChevronRight/></button></div><TransferTable transfers={transfers.slice(0,8)} onOpen={onOpen}/></section>
  </div>;
}

function Transfers({transfers,onOpen}) {
  return <div className="admin-content"><div className="page-head"><div><span className="eyebrow">MANAGE</span><h1>Transfers</h1><p>All active and expired client deliveries.</p></div><a className="primary-btn" href="/admin/upload"><Plus/> New Transfer</a></div><section className="panel"><TransferTable transfers={transfers} onOpen={onOpen}/></section></div>;
}

function TransferTable({transfers,onOpen}) {
  return <div className="table-wrap"><table><thead><tr><th>Transfer</th><th>Created</th><th>Expires</th><th>Files</th><th>Size</th><th>Downloads</th><th>Status</th><th></th></tr></thead><tbody>
    {transfers.map(t=><tr key={t.id}><td><button className="table-link" onClick={()=>onOpen(t)}>{t.id}</button>{t.message&&<small>{t.message.slice(0,46)}{t.message.length>46?"…":""}</small>}</td><td>{fmtDate(t.created_at)}</td><td>{fmtDate(t.expires_at)}</td><td>{t.file_count}</td><td>{formatBytes(t.total_size)}</td><td>{t.downloads}</td><td><span className={`status ${t.status}`}>{t.status}</span></td><td><button className="icon-btn"><MoreHorizontal/></button></td></tr>)}
  </tbody></table></div>;
}

function Upload({onDone}) {
  const [files,setFiles]=useState([]);
  const [clientEmail,setClientEmail]=useState("");
  const [message,setMessage]=useState("");
  const [uploading,setUploading]=useState(false);
  const [created,setCreated]=useState(null);
  const [progress,setProgress]=useState({done:0,total:0,active:""});
  const addFiles=e=>setFiles(prev=>[...prev,...Array.from(e.target.files||[])].map((f,i)=>f.id?f:Object.assign(f,{id:crypto.randomUUID()})));
  const drop=e=>{e.preventDefault();setFiles(prev=>[...prev,...Array.from(e.dataTransfer.files||[])].map(f=>Object.assign(f,{id:crypto.randomUUID()})))};
  async function upload(){
    if(!files.length)return;
    setUploading(true);
    try{
      const init=await api("/admin/transfers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({client_email:clientEmail,message,files:files.map(f=>({name:f.name,size:f.size,type:f.type}))})});
      let done=0;
      setProgress({done:0,total:init.files.length,active:"Preparing upload…"});
      for(let i=0;i<init.files.length;i++){
        const item=init.files[i];
        const file=files[i];
        setProgress({done,total:init.files.length,active:item.name});
        await new Promise((resolve,reject)=>{
          const xhr=new XMLHttpRequest();
          xhr.open("PUT",item.uploadUrl);
          xhr.setRequestHeader("Content-Type",file.type||"application/octet-stream");
          xhr.upload.onprogress=e=>{ if(e.lengthComputable) setProgress({done,total:init.files.length,active:`${item.name} — ${Math.round(e.loaded/e.total*100)}%`}); };
          xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(new Error(`Upload failed for ${item.name} (${xhr.status})`));
          xhr.onerror=()=>reject(new Error(`Upload failed for ${item.name}`));
          xhr.send(file);
        });
        done++; setProgress({done,total:init.files.length,active:item.name});
      }
      const result=await api(`/admin/transfers/${init.transferId}/complete`,{method:"POST"});
      setCreated(result);
    }catch(e){alert(e.message)}finally{setUploading(false)}
  }
  if(created) return <div className="admin-content"><div className="page-head"><div><span className="eyebrow">TRANSFER CREATED</span><h1>Ready to send</h1><p>Your TaalLab transfer is live for the configured expiration window.</p></div></div>
    <div className="created-card">{created.emailError&&<div className="error-box" style={{marginBottom:16}}>Transfer created, but the notification email could not be sent: {created.emailError}</div>}{created.emailSent&&<div className="success-pill" style={{marginBottom:16}}>Notification email sent to {created.clientEmail}.</div>}<div className="success-large"><Check/></div><h2>Transfer Created</h2><label>Transfer Link<div className="copy-row"><input readOnly value={created.transferUrl}/><button className="ghost-btn" onClick={()=>navigator.clipboard.writeText(created.transferUrl)}><Copy/> Copy Link</button></div></label>
      <h3>Files</h3>{created.files.map(f=><div className="created-file" key={f.id}><IconFor kind={f.kind}/><div><strong>{f.name}</strong><small>{formatBytes(f.size)} • Expires {fmtDate(f.expires_at)}</small></div><button className="ghost-btn" onClick={()=>navigator.clipboard.writeText(f.downloadUrl)}><Link2/> Copy link</button></div>)}
      <button className="primary-btn" onClick={onDone}>Back to dashboard</button>
    </div></div>;
  return <div className="admin-content"><div className="page-head"><div><span className="eyebrow">NEW TRANSFER</span><h1>Send files</h1><p>Upload large studio assets and create a private client link.</p></div></div>
    <div className="upload-grid"><section className="panel upload-panel"><div className="dropzone" onDragOver={e=>e.preventDefault()} onDrop={drop}><UploadCloud/><h2>Drop files here</h2><p>or choose multiple files from your computer</p><label className="primary-btn"><Plus/> Select files<input hidden type="file" multiple onChange={addFiles}/></label><small>Files go directly to private R2 storage.</small></div>
      {!!files.length&&<div className="upload-files">{files.map(f=><div className="upload-file" key={f.id}><File/><div><strong>{f.name}</strong><small>{formatBytes(f.size)}</small></div><button className="icon-btn" onClick={()=>setFiles(files.filter(x=>x.id!==f.id))}><X/></button></div>)}</div>}
    </section><section className="panel message-panel"><label>Client email <span className="muted">(optional)</span><input type="email" placeholder="client@example.com" value={clientEmail} onChange={e=>setClientEmail(e.target.value)}/></label><small className="muted">If provided, the client receives a secure download link from contact@taallab.work. The file itself is never attached.</small><label style={{marginTop:16}}>Client message<textarea rows="8" placeholder="Add a message for your client…" value={message} onChange={e=>setMessage(e.target.value)}/></label><div className="upload-summary"><span>Expiration</span><strong>7 days after upload</strong><span>Files</span><strong>{files.length}</strong><span>Total size</span><strong>{formatBytes(files.reduce((n,f)=>n+f.size,0))}</strong></div><button className="primary-btn full" disabled={uploading||!files.length} onClick={upload}>{uploading?<><RefreshCw className="spin"/> {progress.active||"Uploading…"} ({progress.done}/{progress.total})</>:<><UploadCloud/> Create transfer</>}</button></section></div>
  </div>;
}

function TransferDetail({transfer,onClose,onChanged}) {
  const [detail,setDetail]=useState(null);
  useEffect(()=>{api(`/admin/transfers/${transfer.id}`).then(setDetail)},[transfer.id]);
  if(!detail)return <div className="detail-drawer"><RefreshCw className="spin"/></div>;
  return <div className="detail-drawer"><div className="drawer-head"><div><span className="eyebrow">TRANSFER DETAILS</span><h2>{detail.id}</h2></div><button onClick={onClose}><X/></button></div>
    <div className="detail-stats"><span>Created<strong>{fmtDate(detail.created_at)}</strong></span><span>Expires<strong>{fmtDate(detail.expires_at)}</strong></span><span>Total size<strong>{formatBytes(detail.total_size)}</strong></span><span>Downloads<strong>{detail.downloads}</strong></span></div>
    {detail.client_email&&<div className="message-box"><MessageSquare size={18}/><p>Client: {detail.client_email}</p></div>}{detail.message&&<div className="message-box"><MessageSquare size={18}/><p>“{detail.message}”</p></div>}
    <div className="drawer-actions"><button className="ghost-btn" onClick={async()=>{const d=await api(`/admin/transfers/${detail.id}/extend`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({days:7})}); alert(`Extended to ${fmtDate(d.expires_at)}`); onChanged();}}><Clock3/> +7 days</button><button className="danger-btn" onClick={async()=>{if(!confirm("Delete this transfer and all of its files permanently?"))return; await api(`/admin/transfers/${detail.id}`,{method:"DELETE"}); onClose(); onChanged();}}><Trash2/> Delete transfer</button></div>
    <h3>Files</h3><div className="detail-files">{detail.files.map(f=><div className="detail-file" key={f.id}><IconFor kind={f.kind}/><div className="file-info"><strong>{f.original_name}</strong><small>{formatBytes(f.size)} • {f.download_count} downloads • {f.last_downloaded_at?fmtDate(f.last_downloaded_at):"Never downloaded"}</small></div><button className="icon-btn" title="Copy link" onClick={()=>navigator.clipboard.writeText(f.downloadUrl)}><Link2/></button><a className="icon-btn" href={`/api/files/${f.download_token}/preview`} target="_blank"><Eye/></a></div>)}</div>
  </div>;
}

function formatBytes(n){if(!n)return"0 B";const u=["B","KB","MB","GB","TB"];const i=Math.min(Math.floor(Math.log(n)/Math.log(1024)),u.length-1);return`${(n/1024**i).toFixed(i?2:0)} ${u[i]}`}
function fmtDate(v){return new Date(Number(v)*1000).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}
function getPath(){
  return location.pathname.replace(/\/+$/, "") || "/";
}

function App(){
  const path = getPath();

  if(path === "/") return <Landing/>;

  if(path.startsWith("/d/")) {
    return <TransferPage id={path.split("/")[2]}/>;
  }

  if(path === "/admin") {
    return <Admin/>;
  }

  if(path === "/admin/upload") {
    return <Admin initialUpload/>;
  }

  return <Landing/>;
}

createRoot(document.getElementById("root")).render(<App/>);
