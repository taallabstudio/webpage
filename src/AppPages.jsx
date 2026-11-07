import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import QRCode from "qrcode";
import {
  ArrowDownToLine, ArrowLeft, Check, ChevronRight, Clock3, Copy, Download,
  Eye, File, FileAudio, FileImage, FileText, FileVideo, FolderOpen, Gauge,
  HardDrive, Link2, LockKeyhole, LogOut, Menu, MessageSquare, MoreHorizontal, Plus, RefreshCw, Search, Settings, ShieldCheck, Trash2, UploadCloud,
  UserRound, X, ChevronDown, Mail, MapPin, MessageCircle, Phone, ShoppingCart, KeyRound, Laptop, Smartphone
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
  if (!res.ok) {
    const error = new Error(data.error || "Request failed");
    error.status = res.status;
    error.retryAfter = Number(data.retryAfter || res.headers.get("Retry-After") || 0);
    error.needsVerification = !!data.needsVerification;
    throw error;
  }
  return data;
};

function ProfileAvatar({user,size=38}) {
  const label = String(user?.display_name || user?.email || "TaalLab").trim();
  return <span className="profile-avatar" style={{width:size,height:size,minWidth:size}} aria-label={label} title={label}>
    {user?.avatar_data ? <img src={user.avatar_data} alt={"Profile picture for "+label} /> : <UserRound size={Math.round(size*.55)} strokeWidth={1.8}/>}
  </span>;
}

function SiteAccountMenu({user,onLogout}) {
  const name = user?.display_name || user?.email?.split("@")[0] || "Account";
  return <details className="site-account-menu">
    <summary><ProfileAvatar user={user} size={34}/><span className="site-account-name">{name}</span><ChevronDown size={14}/></summary>
    <div className="site-account-dropdown">
      <div className="site-account-identity"><strong>{name}</strong><small>{user?.email}</small></div>
      <a href="/account/settings">Account settings</a>
      {user?.role === "admin" && <a href="/admin">Studio dashboard</a>}
      <button type="button" onClick={onLogout}>Sign out</button>
    </div>
  </details>;
}
function ProgressiveImage({src, previewSrc, alt, className="", priority=false}) {
  const [previewReady, setPreviewReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const avifSrc = src.replace(/\\.webp$/i, ".avif");
  return <span className={`progressive-image ${className}`} aria-busy={!loaded}>
    <span className={`image-skeleton${previewReady ? " is-hidden" : ""}`} aria-hidden="true" />
    <img className="progressive-preview" src={previewSrc} alt="" aria-hidden="true"
      loading={priority ? "eager" : "lazy"} decoding="async"
      onLoad={() => setPreviewReady(true)} onError={(event) => { event.currentTarget.style.display = "none"; setPreviewReady(true); }} />
    <picture><source type="image/avif" srcSet={avifSrc} />
      <img className={`progressive-full${loaded ? " is-loaded" : ""}`} src={src} alt={alt}
        loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"}
        decoding="async" onLoad={() => { setLoaded(true); setPreviewReady(true); }} />
    </picture>
  </span>;
}

function Logo({studioOnly=false}) {
  return <div className="brand" aria-label={"TaalLab"}>
    <span className="brand-logo" aria-hidden="true"><img src="/logo.png" alt="" /></span>
    <span>{"TaalLab"}</span>
  </div>;
}

function IconFor({kind}) {
  if (kind === "audio") return <FileAudio />;
  if (kind === "image") return <FileImage />;
  if (kind === "video") return <FileVideo />;
  if (kind === "pdf") return <FileText />;
  return <File />;
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
        <button className="primary-btn" onClick={async()=>{ const r=await api(`/transfers/${data.id}/download-all`); r.files.forEach((u,i)=>setTimeout(()=>{ const a=document.createElement("a"); a.href=u; a.rel="noopener"; document.body.appendChild(a); a.click(); a.remove(); }, i*450)); }}><ArrowDownToLine/> Download All ({data.files.length})</button>
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
  const modalRef=useRef(null);
  useEffect(()=>{
    const modal=modalRef.current;
    if(!modal)return;
    const previous=document.activeElement;
    modal.focus();
    function onKeyDown(event){
      if(event.key==="Escape"){event.preventDefault();onClose();return;}
      if(event.key!=="Tab")return;
      const focusable=[...modal.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')];
      if(!focusable.length){event.preventDefault();modal.focus();return;}
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===modal)){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
    modal.addEventListener("keydown",onKeyDown);
    return ()=>{modal.removeEventListener("keydown",onKeyDown);if(previous instanceof HTMLElement)previous.focus();};
  },[onClose]);
  return <div className="modal-backdrop" onClick={onClose}>
    <div ref={modalRef} tabIndex={-1} className="preview-modal" role="dialog" aria-modal="true" aria-label={"Preview "+file.name} onClick={e=>e.stopPropagation()}>
      <div className="modal-head"><strong>{file.name}</strong><button type="button" aria-label="Close preview" onClick={onClose}><X/></button></div>
      {file.kind === "audio" ? <audio controls autoPlay src={`/api/files/${file.token}/preview`}/> :
       file.kind === "image" ? <img src={`/api/files/${file.token}/preview`} alt={file.name+" preview"} /> :
       file.kind === "video" ? <video controls autoPlay src={`/api/files/${file.token}/preview`}/> :
       <div className="preview-placeholder"><FileText/><p>Preview this file in its native application.</p></div>}
    </div>
  </div>;
}

function Login({onLogin}) {
  const loginParams = new URLSearchParams(location.search);
  const codeInputs = useRef([]);
  const codeForm = useRef(null);
  const [email,setEmail]=useState(loginParams.get("email")||"");
  const [password,setPassword]=useState("");
  const [code,setCode]=useState("");
  const [challengeId,setChallengeId]=useState(loginParams.get("challenge_id")||"");
  const [error,setError]=useState(loginParams.get("google_error")||"");
  const [notice,setNotice]=useState(loginParams.get("verified")==="1" ? "Email verified. You can sign in now." : "");
  const [signup,setSignup]=useState(false);
  const [policyAccepted,setPolicyAccepted]=useState(false);
  const [marketingAccepted,setMarketingAccepted]=useState(false);
  const [twoFactor,setTwoFactor]=useState(loginParams.get("google_2fa")==="1");
  const [twoFactorMethod,setTwoFactorMethod]=useState(loginParams.get("method")||"email");
  const [passkeyBusy,setPasskeyBusy]=useState(false);
  const [resendCooldown,setResendCooldown]=useState(0);
  const [verificationRequired,setVerificationRequired]=useState(false);
  const [emailVerificationCode,setEmailVerificationCode]=useState("");
  const [emailVerificationBusy,setEmailVerificationBusy]=useState(false);
  const [forgotMode,setForgotMode]=useState(false);
  const [resetMode,setResetMode]=useState(location.pathname === "/reset-password");
  const [resetToken,setResetToken]=useState(loginParams.get("token")||"");
  const [resetPassword,setResetPassword]=useState("");
  const [resetPasswordConfirm,setResetPasswordConfirm]=useState("");

  function afterLogin(){
    const next=new URLSearchParams(location.search).get("next")||"";
    if(next.startsWith("/checkout.html")&&!next.startsWith("//")) { location.assign(next); return; }
    api("/auth/me").then(result => location.assign(result.user?.role === "admin" ? "/admin" : location.pathname === "/account/settings" ? "/account/settings" : "/account")).catch(() => location.assign("/account"));
  }

  async function signInWithPasskey(){
    setError("");setPasskeyBusy(true);
    try{
      const start=await api("/auth/passkeys/options",{method:"POST"});
      const response=await startAuthentication({optionsJSON:start.options});
      await api("/auth/passkeys/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({challengeId:start.challengeId,response})});
      afterLogin();
    }catch(e){if(e.name!=="NotAllowedError")setError(e.message||"Passkey sign-in failed.");}
    finally{setPasskeyBusy(false);}
  }

  useEffect(()=>{
    if (!resendCooldown) return;
    const timer=window.setInterval(()=>setResendCooldown(v=>Math.max(0,v-1)),1000);
    return ()=>window.clearInterval(timer);
  },[resendCooldown]);

  useEffect(()=>{
    if (twoFactor && /^\d{6}$/.test(code)) {
      codeForm.current?.requestSubmit();
    }
  },[code,twoFactor]);

  async function submit(e) {
    e.preventDefault(); setError(""); setNotice("");
    try {
      if (forgotMode) {
        await api("/auth/password-reset/request",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({email})
        });
        setNotice("If an active account exists for that email, a password reset link will be sent shortly. The link expires in 30 minutes.");
        return;
      }

      if (resetMode) {
        if (!resetToken) {
          setError("This password reset link is invalid or has expired. Request a new link.");
          return;
        }
        if (resetPassword !== resetPasswordConfirm) {
          setError("The passwords do not match.");
          return;
        }
        await api("/auth/password-reset/confirm",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({token:resetToken,new_password:resetPassword})
        });
        setResetMode(false);
        setForgotMode(false);
        setResetPassword("");
        setResetPasswordConfirm("");
        setPassword("");
        setSignup(false);
        history.replaceState(null,"","/login");
        setNotice("Password reset successfully. Please sign in with your new password.");
        return;
      }

      if (twoFactor) {
        await api("/auth/2fa/verify",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({challenge_id:challengeId,code})
        });
        afterLogin();
        return;
      }

      if(signup&&!policyAccepted){setError("Please accept the Terms of Service and Privacy Policy to create an account.");return;}
      const result=await api(signup?"/auth/signup":"/auth/login",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({email,password,acceptPolicies:signup&&policyAccepted,marketingConsent:signup&&marketingAccepted})
      });

      if (result.requiresTwoFactor) {
        setChallengeId(result.challengeId);
        setTwoFactor(true);
        setTwoFactorMethod(result.method||"email");
        setCode("");
        setNotice(`We sent a 6-digit sign-in code to ${result.email}.`);
      } else if (result.needsVerification) {
        setVerificationRequired(true);
        setNotice("Account created. Check your email and verify your address before signing in.");
      } else {
        afterLogin();
      }
    } catch(e) {
      setError(e.message);
      if (e.needsVerification) setVerificationRequired(true);
      if (e.retryAfter) setResendCooldown(e.retryAfter);
    }
  }

  async function resendCode(){
    setError("");
    try {
      await api("/auth/2fa/resend",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({challenge_id:challengeId})
      });
      setResendCooldown(45);
      setNotice("A new sign-in code has been sent.");
    } catch(e) {
      setError(e.message);
      if(e.retryAfter) setResendCooldown(e.retryAfter);
    }
  }

  async function verifyEmailCode(value=emailVerificationCode){
    const submittedCode=String(value||"").replace(/\D/g,"").slice(0,6);
    if(submittedCode.length!==6||emailVerificationBusy)return;
    setEmailVerificationBusy(true);setError("");
    try{
      await api("/auth/verify-email-code",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,code:submittedCode})});
      setEmailVerificationCode("");location.assign("/login?verified=1");
    }catch(e){setError(e.message||"That verification code is invalid or has expired.");setEmailVerificationCode("");codeInputs.current[0]?.focus();}
    finally{setEmailVerificationBusy(false);}
  }
  useEffect(()=>{
    if(verificationRequired&&/^\d{6}$/.test(emailVerificationCode)&&!emailVerificationBusy)verifyEmailCode(emailVerificationCode);
  },[emailVerificationCode,verificationRequired]);

  async function resendVerification(){
    setError("");
    try {
      await api("/auth/resend-verification",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({email})
      });
      setResendCooldown(60);
      setEmailVerificationCode("");
      setNotice("A new verification code has been sent. Check your inbox.");
    } catch(e) {
      setError(e.message);
      if(e.retryAfter) setResendCooldown(e.retryAfter);
    }
  }

  if(twoFactor) return <div className="login-page"><div className="login-card">
    <Logo/><div className="login-icon"><ShieldCheck/></div>
    <h1>{twoFactorMethod==="authenticator"?"Authenticator verification":"Check your email"}</h1>
    <p>{twoFactorMethod==="authenticator"?"Enter the six-digit code from your authenticator app, or use one of your recovery codes.":<>Enter the six-digit code we sent to <strong>{email}</strong>.</>}</p>
    <form ref={codeForm} onSubmit={submit}>
      <label>{twoFactorMethod==="authenticator"?"Authenticator or recovery code":"Verification code"}<input value={code} onChange={e=>setCode(e.target.value.replace(twoFactorMethod==="authenticator"?/[^a-zA-Z0-9-]/g:/\D/g,"").slice(0,32))} autoComplete="one-time-code" autoFocus maxLength={32} required/></label>
      {error&&<div className="error-box">{error}</div>}
      {notice&&<div className="success-pill">{notice}</div>}
      <button className="primary-btn full" disabled={!code.trim()}>Verify &amp; sign in</button>
    </form>
    {twoFactorMethod==="email"&&<button className="ghost-btn full" style={{marginTop:12}} disabled={resendCooldown>0} onClick={resendCode}>{resendCooldown>0?`Resend code in ${resendCooldown}s`:"Resend code"}</button>}
    <button className="ghost-btn full" style={{marginTop:8}} onClick={()=>{setTwoFactor(false);setChallengeId("");setCode("");setError("");setNotice("");}}>Back to sign in</button>
  </div></div>;

  if(verificationRequired) return <div className="login-page"><div className="login-card">
    <Logo/><div className="login-icon"><ShieldCheck/></div><h1>Verify your email</h1>
    <p>Enter the six-digit code we sent to <strong>{email}</strong>.</p>
    <form onSubmit={e=>{e.preventDefault();verifyEmailCode();}}>
      <div className="email-code-boxes" role="group" aria-label="Six-digit email verification code">
        {Array.from({length:6},(_,index)=><input key={index} ref={el=>codeInputs.current[index]=el}
          className="email-code-input" aria-label={`Digit ${index+1}`} inputMode="numeric"
          autoComplete={index===0?"one-time-code":"off"} maxLength={1}
          value={emailVerificationCode[index]||""} autoFocus={index===0} disabled={emailVerificationBusy}
          onChange={e=>{const digit=e.target.value.replace(/\D/g,"").slice(-1);const next=Array.from({length:6},(_,i)=>emailVerificationCode[i]||"");next[index]=digit;setEmailVerificationCode(next.join(""));if(digit&&index<5)codeInputs.current[index+1]?.focus();}}
          onPaste={e=>{e.preventDefault();const pasted=e.clipboardData.getData("text").replace(/\D/g,"").slice(0,6);if(pasted){setEmailVerificationCode(pasted);codeInputs.current[Math.min(pasted.length,5)]?.focus();}}}
          onKeyDown={e=>{if(e.key==="Backspace"&&!emailVerificationCode[index]&&index>0)codeInputs.current[index-1]?.focus();if(e.key==="ArrowLeft"&&index>0)codeInputs.current[index-1]?.focus();if(e.key==="ArrowRight"&&index<5)codeInputs.current[index+1]?.focus();}}
        />)}
      </div>
      {error&&<div className="error-box">{error}</div>}{notice&&<div className="success-pill">{notice}</div>}
      <button type="submit" className="primary-btn full" disabled={emailVerificationCode.length!==6||emailVerificationBusy}>{emailVerificationBusy?"Verifying…":"Verify email"}</button>
    </form>
    <button type="button" className="ghost-btn full" style={{marginTop:12}} disabled={resendCooldown>0} onClick={resendVerification}>{resendCooldown>0?`Resend code in ${resendCooldown}s`:"Resend verification code"}</button>
    <button type="button" className="ghost-btn full" style={{marginTop:8}} onClick={()=>{setVerificationRequired(false);setEmailVerificationCode("");setError("");setNotice("");}}>Back to sign in</button>
  </div></div>;

  if(forgotMode) return <div className="login-page"><div className="login-card">
    <Logo/><div className="login-icon"><LockKeyhole/></div>
    <h1>Reset your password</h1>
    <p>Enter the email address associated with your TaalLab account. If an account exists, we’ll send a reset link that expires in 30 minutes.</p>
    <form onSubmit={submit}>
      <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoFocus required/></label>
      {error&&<div className="error-box">{error}</div>}
      {notice&&<div className="success-pill">{notice}</div>}
      <button className="primary-btn full">Send reset link</button>
    </form>
    <button type="button" className="ghost-btn full" style={{marginTop:12}} onClick={()=>{setForgotMode(false);setError("");setNotice("");}}>Back to sign in</button>
  </div></div>;

  if(resetMode) return <div className="login-page"><div className="login-card">
    <Logo/><div className="login-icon"><LockKeyhole/></div>
    <h1>Choose a new password</h1>
    <p>Your reset link is valid for 30 minutes and can only be used once.</p>
    {!resetToken&&<div className="error-box">This reset link is missing or invalid. Request a new one.</div>}
    <form onSubmit={submit}>
      <label>New password<input type="password" value={resetPassword} onChange={e=>setResetPassword(e.target.value)} minLength={8} maxLength={256} autoComplete="new-password" required/></label>
      <label>Confirm new password<input type="password" value={resetPasswordConfirm} onChange={e=>setResetPasswordConfirm(e.target.value)} minLength={8} maxLength={256} autoComplete="new-password" required/></label>
      {error&&<div className="error-box">{error}</div>}
      {notice&&<div className="success-pill">{notice}</div>}
      <button className="primary-btn full" disabled={!resetToken}>Reset password</button>
    </form>
    <button type="button" className="ghost-btn full" style={{marginTop:12}} onClick={()=>{history.replaceState(null,"","/login");setResetMode(false);setForgotMode(false);setError("");setNotice("");}}>Back to sign in</button>
  </div></div>;

  return <div className="login-page"><div className="login-card">
    <Logo/><div className="login-icon"><ShieldCheck/></div>
    <h1>{signup?"Create account":"Sign in"}</h1>
    <p>{signup?"Create your TaalLab account to receive files shared with you.":"Manage TaalLab transfers securely."}</p>
    {!signup&&<button type="button" className="ghost-btn full" style={{marginBottom:12}} onClick={signInWithPasskey} disabled={passkeyBusy}><ShieldCheck size={17}/>{passkeyBusy?"Waiting for passkey…":"Sign in with a passkey"}</button>}
    <button type="button" className="google-login-btn" onClick={()=>{if(signup&&!policyAccepted){setError("Please accept the Terms of Service and Privacy Policy to create an account.");return;}window.location.assign("/api/auth/google/start"+(signup?"?terms=2026-11-07.1&privacy=2026-11-07.5":""));}}>
      <svg aria-hidden="true" viewBox="0 0 48 48" width="20" height="20"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 4) scale(.92)"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.72 7.18l7.62 5.91c4.45-4.11 7.14-10.17 7.14-17.56Z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.2A23.9 23.9 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z" transform="translate(0 2) scale(1)"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.89l-7.62-5.91c-2.12 1.42-4.84 2.26-8.28 2.26-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.2C6.51 42.62 14.62 48 24 48Z" transform="translate(0 -1) scale(.98)"/></svg>
      <span>Continue with Google</span>
    </button>
    <div className="login-divider"><span>or continue with email</span></div>
    <form onSubmit={submit}>
      <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoFocus required/></label>
      <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} required/></label>
      {signup&&<label className="policy-consent"><input type="checkbox" checked={policyAccepted} onChange={e=>setPolicyAccepted(e.target.checked)} required/><span>I agree to the <a href="/terms.html" target="_blank" rel="noopener noreferrer">Terms of Service</a> and acknowledge the <a href="/privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</span></label>}
      {signup&&<label className="policy-consent"><input type="checkbox" checked={marketingAccepted} onChange={e=>setMarketingAccepted(e.target.checked)}/><span>I would like to receive occasional product news and marketing emails from TaalLab. This is optional and separate from account/service emails. You can unsubscribe at any time. <small>Google sign-up users can manage this choice later in Account Settings.</small></span></label>}
      {error&&<div className="error-box">{error}</div>}
      {notice&&<div className="success-pill">{notice}</div>}
      <button className="primary-btn full">{signup?"Sign up & verify email":"Sign in"}</button>
    </form>
    {!signup && <button type="button" className="ghost-btn full" style={{marginTop:12}} onClick={()=>{setForgotMode(true);setError("");setNotice("");setVerificationRequired(false);}}>Forgot password?</button>}
    {verificationRequired && <button className="ghost-btn full" style={{marginTop:12}} disabled={resendCooldown>0} onClick={resendVerification}>
      {resendCooldown>0?`Resend verification in ${resendCooldown}s`:"Resend verification email"}
    </button>}
    <button className="ghost-btn full" style={{marginTop:12}} onClick={()=>{setSignup(v=>!v);setPolicyAccepted(false);setMarketingAccepted(false);setError("");setNotice("");setVerificationRequired(false);}}>
      {signup?"Back to sign in":"Sign up"}
    </button>
  </div></div>;
}

function UserPortal({user}) {
  const [page,setPage]=useState("transfers");
  const [mobileNavOpen,setMobileNavOpen]=useState(false);
  const mobileNavRef=useRef(null);
  const mobileNavToggleRef=useRef(null);
  const [transfers,setTransfers]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [refreshKey,setRefreshKey]=useState(0);

  async function load(){
    setLoading(true); setError("");
    try {
      const d=await api("/user/transfers");
      setTransfers(d.transfers || []);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(()=>{load()},[refreshKey]);
  useEffect(()=>{
    if(!mobileNavOpen)return;
    const focusable=()=>[...(mobileNavRef.current?.querySelectorAll('button:not([disabled]),a[href]')||[])];
    const items=focusable();items[0]?.focus();
    const onKeyDown=event=>{
      if(event.key==="Escape"){event.preventDefault();setMobileNavOpen(false);mobileNavToggleRef.current?.focus();return;}
      if(event.key!=="Tab")return;
      const current=focusable();if(!current.length){event.preventDefault();return;}
      const first=current[0],last=current[current.length-1];
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===mobileNavRef.current)){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    document.addEventListener("keydown",onKeyDown);
    return ()=>document.removeEventListener("keydown",onKeyDown);
  },[mobileNavOpen]);

  async function logout(){
    await api("/auth/logout",{method:"POST"});
    location.href="/login";setMobileNavOpen(false);
  }

  function navigateUserPortal(next){setPage(next);if(mobileNavOpen){setMobileNavOpen(false);mobileNavToggleRef.current?.focus();}}

  const available=transfers.filter(t=>t.available).length;
  const downloaded=transfers.filter(t=>t.downloaded).length;

  return <div className="admin-layout">
    <aside id="user-sidebar" ref={mobileNavRef} className={"sidebar"+(mobileNavOpen?" mobile-open":"")}><Logo/><div className="side-links">
      <button className={page==="transfers"?"active":""} onClick={()=>navigateUserPortal("transfers")}><FolderOpen/> My Transfers</button>
      <button className={page==="settings"?"active":""} onClick={()=>navigateUserPortal("settings")}><Settings/> Account</button>
    </div>
    <div style={{padding:"12px 14px",fontSize:12,opacity:.65}}>{user?.email}</div>
    <button className="side-logout" onClick={logout}><LogOut/> Logout</button></aside>
    {mobileNavOpen&&<button type="button" className="mobile-nav-backdrop" aria-label="Close navigation" onClick={()=>{setMobileNavOpen(false);mobileNavToggleRef.current?.focus();}}/>}
    <main className="admin-main">
      <div className="admin-mobile-head"><Logo/><button ref={mobileNavToggleRef} type="button" aria-label={mobileNavOpen?"Close navigation":"Open navigation"} aria-expanded={mobileNavOpen} aria-controls="user-sidebar" onClick={()=>setMobileNavOpen(v=>!v)}>{mobileNavOpen?<X/>:<Menu/>}</button></div>
      {page==="transfers" ? <div className="admin-content">
        <div className="page-head"><div>
          <span className="eyebrow">TAAL LAB</span>
          <h1>My transfers</h1>
          <p>Your previous TaalLab deliveries and their download status.</p>
        </div></div>
        <div className="stat-grid">
          <div className="stat-card"><div className="stat-icon"><FolderOpen/></div><span>Total transfers</span><strong>{transfers.length}</strong></div>
          <div className="stat-card"><div className="stat-icon"><Check/></div><span>Available</span><strong>{available}</strong></div>
          <div className="stat-card"><div className="stat-icon"><Download/></div><span>Downloaded</span><strong>{downloaded}</strong></div>
        </div>
        <section className="panel">
          <div className="panel-head"><div><h2>Previous deliveries</h2><p>File contents are not shown here. Open an available transfer to download.</p></div><button className="ghost-btn" onClick={()=>setRefreshKey(v=>v+1)}><RefreshCw size={16}/> Refresh</button></div>
          {error&&<div className="error-box" style={{margin:16}}>{error}</div>}
          {loading ? <div className="loading">Loading transfers…</div> :
            transfers.length===0 ? <div className="empty-state"><FolderOpen/><h3>No transfers yet</h3><p>Your TaalLab deliveries will appear here when they are assigned to this account.</p></div> :
            <div className="table-wrap"><table><thead><tr><th>Transfer</th><th>Sent on</th><th>Files</th><th>Size</th><th>Downloaded</th><th>Status</th><th></th></tr></thead><tbody>
              {transfers.map(t=><tr key={t.id}>
                <td><strong>{t.id}</strong>{t.message&&<small>{t.message.slice(0,50)}{t.message.length>50?"…":""}</small>}</td>
                <td>{fmtDate(t.created_at)}</td>
                <td>{t.file_count}</td>
                <td>{formatBytes(t.total_size)}</td>
                <td><span className={t.downloaded?"status active":"status"}>{t.downloaded?"Downloaded":"Not downloaded"}</span></td>
                <td><span className={`status ${t.available?"active":"deleted"}`}>{t.available?"Available":"Expired"}</span></td>
                <td>{t.available?<a className="primary-btn" href={`/d/${t.id}`}>Open</a>:<span className="muted">Unavailable</span>}</td>
              </tr>)}
            </tbody></table></div>}
        </section>
      </div> : <AccountSettings user={user} onPasswordChanged={()=>{}}/>}
    </main>
  </div>;
}

function Admin({initialUpload=false}) {
  const [authed,setAuthed]=useState(null);
  const [user,setUser]=useState(null);
  const [page,setPage]=useState(initialUpload ? "upload" : "dashboard");
  const [mobileNavOpen,setMobileNavOpen]=useState(false);
  const mobileNavRef=useRef(null);
  const mobileNavToggleRef=useRef(null);
  const [stats,setStats]=useState(null);
  const [transfers,setTransfers]=useState([]);
  const [selected,setSelected]=useState(null);

  async function refresh(){
    try {
      const me=await api("/auth/me");
      if(!me.authenticated){setAuthed(false);return;}
      setUser(me.user);
      if(me.user.role!=="admin"){setAuthed(true);return;}
      const d=await api("/admin/overview");
      setStats(d.stats); setTransfers(d.transfers); setAuthed(true);
    } catch { setAuthed(false); }
  }
  useEffect(()=>{refresh()},[]);
  useEffect(()=>{
    if(!mobileNavOpen)return;
    const focusable=()=>[...(mobileNavRef.current?.querySelectorAll('button:not([disabled]),a[href]')||[])];
    const items=focusable();items[0]?.focus();
    const onKeyDown=(event)=>{
      if(event.key==="Escape"){event.preventDefault();setMobileNavOpen(false);mobileNavToggleRef.current?.focus();return;}
      if(event.key!=="Tab")return;
      const current=focusable();if(!current.length){event.preventDefault();return;}
      const first=current[0],last=current[current.length-1];
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===mobileNavRef.current)){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    document.addEventListener("keydown",onKeyDown);
    return ()=>document.removeEventListener("keydown",onKeyDown);
  },[mobileNavOpen]);
  if(authed===null) return <div className="loading"><RefreshCw className="spin"/> Checking session…</div>;
  if(!authed) return <Login onLogin={refresh}/>;
  if(user?.role!=="admin") { location.replace("/account"); return <div className="loading"><RefreshCw className="spin"/> Redirecting to your account…</div>; }

  function navigateAdmin(next){setPage(next);if(mobileNavOpen){setMobileNavOpen(false);mobileNavToggleRef.current?.focus();}}
  async function logout(){await api("/auth/logout",{method:"POST"});setAuthed(false);setUser(null);setMobileNavOpen(false)}
  return <div className="admin-layout">
    <aside id="admin-sidebar" ref={mobileNavRef} className={"sidebar"+(mobileNavOpen?" mobile-open":"")}><Logo/><div className="side-links">
      <button className={page==="dashboard"?"active":""} onClick={()=>navigateAdmin("dashboard")}><Gauge/> Dashboard</button>
      <button className={page==="transfers"?"active":""} onClick={()=>navigateAdmin("transfers")}><FolderOpen/> Transfers</button>
      <button className={page==="products"?"active":""} onClick={()=>navigateAdmin("products")}><HardDrive/> Store Products</button>
      <button className={page==="upload"?"active":""} onClick={()=>navigateAdmin("upload")}><UploadCloud/> New Transfer</button>
      <button className={page==="users"?"active":""} onClick={()=>navigateAdmin("users")}><UserRound/> Users</button>
      <button className={page==="settings"?"active":""} onClick={()=>navigateAdmin("settings")}><Settings/> Account</button>
    </div><div style={{padding:"12px 14px",fontSize:12,opacity:.65}}>{user?.email}</div><button className="side-logout" onClick={logout}><LogOut/> Logout</button></aside>
    {mobileNavOpen&&<button type="button" className="mobile-nav-backdrop" aria-label="Close navigation" onClick={()=>{setMobileNavOpen(false);mobileNavToggleRef.current?.focus();}}/>}
    <main className="admin-main">
      <div className="admin-mobile-head"><Logo/><button ref={mobileNavToggleRef} type="button" aria-label={mobileNavOpen?"Close navigation":"Open navigation"} aria-expanded={mobileNavOpen} aria-controls="admin-sidebar" onClick={()=>setMobileNavOpen(v=>!v)}>{mobileNavOpen?<X/>:<Menu/>}</button></div>
      {page==="dashboard"&&<Dashboard stats={stats} transfers={transfers} onOpen={setSelected}/>}
      {page==="transfers"&&<Transfers transfers={transfers} onOpen={setSelected}/>}
      {page==="products"&&<StoreProductManager/>}
      {page==="upload"&&<Upload onDone={()=>{setPage("dashboard");refresh()}}/>}
      {page==="users"&&<UserManagement currentUser={user}/>}
      {page==="settings"&&<AccountSettings user={user} onPasswordChanged={refresh} showGoogleDrive/>}
      {selected&&<TransferDetail transfer={selected} onClose={()=>setSelected(null)} onChanged={refresh}/>}
    </main>
  </div>;
}


function StoreProductManager(){
  const blank={id:"",name:"",category:"Max for Live Device",description:"",features:"",price:"199",version:"1.0",status:"draft",fileKey:"",fileName:"",coverKey:"",coverName:""};
  const [form,setForm]=useState(blank),[products,setProducts]=useState([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  async function load(){try{const d=await api("/store/admin/products");setProducts(d.products||[])}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[]);
  async function upload(file,kind){if(!file)return;setBusy(true);setError("");setNotice("Uploading "+file.name+"…");try{const r=await fetch("/api/store/admin/upload?kind="+kind+"&filename="+encodeURIComponent(file.name),{method:"POST",credentials:"include",headers:{"Content-Type":file.type||"application/octet-stream"},body:file});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Upload failed");setForm(f=>kind==="cover"?{...f,coverKey:d.key,coverName:file.name}:{...f,fileKey:d.key,fileName:d.fileName});setNotice(file.name+" uploaded to private storage.")}catch(e){setError(e.message);setNotice("")}finally{setBusy(false)}}
  async function save(e){e.preventDefault();setError("");setNotice("");setBusy(true);try{await api("/store/admin/products",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,price:Number(form.price)})});setNotice(form.status==="published"?"Product published to the shop.":"Draft saved successfully.");setForm(blank);await load()}catch(e){setError(e.message)}finally{setBusy(false)}}
  function edit(p){setForm({...blank,...p,price:String(p.price),status:p.status||"draft",fileKey:p.fileKey||"",fileName:p.fileName||"",coverKey:p.coverKey||"",coverName:p.coverKey?"Cover image uploaded":""});window.scrollTo({top:0,behavior:"smooth"})}
  return <div className="admin-content"><div className="page-head"><div><span className="eyebrow">TAALLAB STORE</span><h1>Products</h1><p>Add digital products, upload secure downloads and manage what appears in your shop.</p></div></div>
  <section className="panel" style={{padding:24,marginBottom:24}}><div className="panel-head"><div><h2>{form.id?"Edit product":"Add a product"}</h2><p>Product details, pricing, files and publishing</p></div><button type="button" className="ghost-btn" onClick={()=>setForm(blank)}>New product</button></div>
  <form onSubmit={save} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16}}>
    <label>Product type<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option>Max for Live Device</option><option>Sample Pack</option><option>Audio Plugin</option><option>Preset Pack</option><option>Sound Library</option><option>MIDI Pack</option><option>Ableton Device</option><option>Other</option></select></label>
    <label>Product name<input required maxLength="160" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. TaalLab Drum Essentials"/></label>
    <label>Price (INR ₹)<input required type="number" min="0" max="10000000" step="0.01" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></label>
    <label>Version<input value={form.version} maxLength="40" onChange={e=>setForm({...form,version:e.target.value})}/></label>
    <label style={{gridColumn:"1/-1"}}>Description<textarea rows="3" maxLength="5000" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Describe what customers get and how it helps them."/></label>
    <label style={{gridColumn:"1/-1"}}>Features / included contents<textarea rows="3" maxLength="5000" value={form.features} onChange={e=>setForm({...form,features:e.target.value})} placeholder="List features or included files, one per line."/></label>
    <div style={{border:"1px solid var(--border,#333)",borderRadius:12,padding:16}}><strong>Product download file *</strong><p className="muted">Private file stored in Backblaze B2. Maximum 100 MB per upload.</p><input type="file" onChange={e=>upload(e.target.files?.[0],"product")} disabled={busy}/>{form.fileName&&<p className="muted">Uploaded: {form.fileName}</p>}</div>
    <div style={{border:"1px solid var(--border,#333)",borderRadius:12,padding:16}}><strong>Cover image (optional)</strong><p className="muted">Upload artwork for this product.</p><input type="file" accept="image/*" onChange={e=>upload(e.target.files?.[0],"cover")} disabled={busy}/>{form.coverName&&<p className="muted">{form.coverName}</p>}</div>
    <label>Publishing status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="draft">Draft — hidden from shop</option><option value="published">Published — visible in shop</option></select></label>
    {error&&<div className="error-box" style={{gridColumn:"1/-1"}}>{error}</div>}{notice&&<div className="success-box" style={{gridColumn:"1/-1"}}>{notice}</div>}
    <div style={{gridColumn:"1/-1",display:"flex",gap:12,flexWrap:"wrap"}}><button className="primary-btn" disabled={busy}>{busy?"Please wait…":form.status==="published"?"Save & publish":"Save draft"}</button>{form.id&&<button type="button" className="ghost-btn" onClick={()=>setForm(blank)}>Cancel edit</button>}</div>
  </form></section>
  <section className="panel"><div className="panel-head"><div><h2>Product catalogue</h2><p>{products.length} product{products.length===1?"":"s"}</p></div><button className="ghost-btn" onClick={load}>Refresh</button></div>{loading?<div className="loading">Loading products…</div>:products.length===0?<p className="muted">No products yet.</p>:<div className="table-wrap"><table><thead><tr><th>Product</th><th>Type</th><th>Price</th><th>Status</th><th>File</th><th></th></tr></thead><tbody>{products.map(p=><tr key={p.id}><td><strong>{p.name}</strong><div className="muted">{p.version}</div></td><td>{p.category}</td><td>₹{Number(p.price).toLocaleString("en-IN")}</td><td>{p.status==="published"?"Published":"Draft"}</td><td>{p.fileName||"Not uploaded"}</td><td><button className="ghost-btn" onClick={()=>edit(p)}>Edit</button></td></tr>)}</tbody></table></div>}</section></div>
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

function SecurityMethods({user}) {
  const [methods,setMethods]=useState({authenticatorEnabled:false,passkeys:[],recoveryCodesRemaining:0});
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [setup,setSetup]=useState(null),[qr,setQr]=useState("");
  const [code,setCode]=useState(""),[name,setName]=useState("This device");
  const [recoveryCodes,setRecoveryCodes]=useState([]);
  const [message,setMessage]=useState(""),[error,setError]=useState("");
  async function refresh(){try{setMethods(await api("/account/security/methods"));}catch(e){setError(e.message);}finally{setLoading(false);}}
  useEffect(()=>{refresh()},[user?.id]);
  async function beginAuthenticator(){setBusy(true);setError("");setMessage("");try{const result=await api("/account/totp/setup",{method:"POST"});const image=await QRCode.toDataURL(result.otpauthUrl,{width:240,margin:2});setSetup(result);setQr(image);setCode("");}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function confirmAuthenticator(e){e.preventDefault();setBusy(true);setError("");setMessage("");try{const result=await api("/account/totp/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code})});setRecoveryCodes(result.recoveryCodes||[]);setSetup(null);setQr("");setCode("");setMessage("Authenticator app enabled. Save these recovery codes now; they will only be shown once.");await refresh();}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function addPasskey(){setBusy(true);setError("");setMessage("");try{const start=await api("/account/passkeys/register/options",{method:"POST"});const response=await startRegistration({optionsJSON:start.options});await api("/account/passkeys/register/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({challengeId:start.challengeId,response,name:name.trim()||"This device"})});setMessage("Passkey added. You can now sign in without a password.");await refresh();}catch(e){if(e.name!=="NotAllowedError")setError(e.message||"Passkey setup was cancelled.");}finally{setBusy(false);}}
  async function removePasskey(id){if(!window.confirm("Remove this passkey from your TaalLab account?"))return;setBusy(true);setError("");setMessage("");try{await api("/account/passkeys/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});setMessage("Passkey removed.");await refresh();}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function disableAuthenticator(){setBusy(true);setError("");setMessage("");try{await api("/account/totp/disable",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code})});setCode("");setMessage("Authenticator app disabled. Email verification will be used as a temporary sign-in fallback.");setRecoveryCodes([]);await refresh();}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function renewRecoveryCodes(){setBusy(true);setError("");setMessage("");try{const result=await api("/account/recovery-codes/regenerate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code})});setRecoveryCodes(result.recoveryCodes||[]);setCode("");setMessage("New recovery codes generated. Your previous codes are no longer valid.");await refresh();}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <section className="panel security-panel">
    <div className="security-panel-heading"><div><span className="eyebrow">ACCOUNT PROTECTION</span><h2>Security &amp; authentication</h2><p className="muted">Manage passkeys, authenticator verification and emergency recovery access across taallab.in and ocean.taallab.in.</p></div><span className="security-shield"><ShieldCheck size={21}/></span></div>
    {error&&<div className="error-box security-feedback">{error}</div>}{message&&<div className="success-pill security-feedback">{message}</div>}
    <div className="security-method-card"><div className="security-method-copy"><div className="security-method-title"><KeyRound size={17}/><strong>Passkeys</strong></div><p>Passwordless sign-in with Windows Hello, Touch ID, Face ID or your device PIN.</p></div><span className="security-count">{methods.passkeys.length} {methods.passkeys.length===1?"passkey":"passkeys"}</span></div>
    <div className="security-add-passkey"><label className="security-field"><span>Device name</span><input aria-label="Passkey device name" value={name} onChange={e=>setName(e.target.value)} maxLength={60} placeholder="e.g. My Windows PC"/></label><button type="button" className="primary-btn" onClick={addPasskey} disabled={busy}>{busy?"Please wait…":<><Plus size={15}/> Add passkey</>}</button></div>
    {methods.passkeys.length>0&&<div className="security-passkey-list">{methods.passkeys.map(item=><div key={item.id} className="security-passkey-item"><span className="security-device-icon"><Laptop size={18}/></span><div className="security-device-copy"><strong>{item.name}</strong><small>{item.deviceType==="multiDevice"?"Synced passkey":"Device-bound passkey"}{item.backedUp?" · Backed up":""}</small></div><button type="button" className="ghost-btn security-remove-btn" disabled={busy} onClick={()=>removePasskey(item.id)}>Remove</button></div>)}</div>}
    <div className="security-method-card security-auth-card"><div className="security-method-copy"><div className="security-method-title"><Smartphone size={17}/><strong>Authenticator app</strong></div><p>{methods.authenticatorEnabled?"Use a six-digit code from your authenticator app when signing in with your password or Google.":"Connect an authenticator app for stronger two-step verification."}</p></div><span className={methods.authenticatorEnabled?"security-state security-state-active":"security-state"}>{methods.authenticatorEnabled?"Active":"Not set up"}</span></div>
    {!methods.authenticatorEnabled&&!setup&&<button type="button" className="primary-btn security-setup-btn" onClick={beginAuthenticator} disabled={busy}>{busy?"Please wait…":<><Plus size={15}/> Set up authenticator</>}</button>}
    {setup&&<div className="security-setup-box"><div><strong>Connect your authenticator</strong><p>Scan this QR code with Google Authenticator, Microsoft Authenticator, 2FAS or another compatible app.</p></div>{qr&&<img src={qr} alt="Authenticator setup QR code" className="security-qr"/>}<label className="security-field"><span>Or enter this setup key manually</span><input readOnly value={setup.secret}/></label><form onSubmit={confirmAuthenticator} className="security-confirm-form"><label className="security-field"><span>Six-digit verification code</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="000 000" required/></label><div className="security-actions"><button className="primary-btn" disabled={busy||code.length!==6}>{busy?"Verifying…":"Verify and enable"}</button><button type="button" className="ghost-btn" onClick={()=>{setSetup(null);setQr("");setCode("");}}>Cancel</button></div></form></div>}
    {methods.authenticatorEnabled&&<div className="security-recovery-section"><div className="security-recovery-heading"><div><strong>Recovery codes</strong><p>Keep these somewhere safe. Each code can only be used once if you lose access to your authenticator.</p></div><span className="security-count">{methods.recoveryCodesRemaining} remaining</span></div><div className="security-recovery-controls"><label className="security-field"><span>Confirm your identity</span><input value={code} onChange={e=>setCode(e.target.value)} autoComplete="off" placeholder="Enter authenticator or recovery code"/></label><div className="security-actions"><button type="button" className="ghost-btn" disabled={busy||!code.trim()} onClick={renewRecoveryCodes}>Regenerate codes</button><button type="button" className="security-danger-btn" disabled={busy||!code.trim()} onClick={disableAuthenticator}>Disable authenticator</button></div></div></div>}
    {recoveryCodes.length>0&&<div className="security-recovery-output"><div><strong>Save your recovery codes</strong><p>These codes are shown only once. Copy them and store them somewhere secure.</p></div><div className="security-recovery-grid">{recoveryCodes.map(item=><code key={item}>{item}</code>)}</div><div className="security-actions"><button type="button" className="ghost-btn" onClick={()=>navigator.clipboard?.writeText(recoveryCodes.join("\n"))}><Copy size={14}/> Copy codes</button><button type="button" className="primary-btn" onClick={()=>setRecoveryCodes([])}>I've saved them</button></div></div>}
    {loading&&<p className="security-loading">Loading security methods…</p>}
  </section>;
}

function PrivacyControls({user}) {
  const [requestType,setRequestType]=useState("deletion");
  const [description,setDescription]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [requests,setRequests]=useState([]);
  async function loadRequests() {
    try { const result=await api("/account/privacy-requests");setRequests(result.requests||[]); }
    catch { /* The request form remains available if history cannot be loaded. */ }
  }
  useEffect(()=>{loadRequests();},[]);

  async function submitRequest(event) {
    event.preventDefault();
    setBusy(true);setError("");setMessage("");
    try {
      const result=await api("/account/privacy-request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:requestType,description})});
      setMessage((result.alreadyOpen?"You already have an open request. Reference: ":"Your request has been received. Reference: ")+result.requestId+". TaalLab will review it and contact you at "+user?.email+".");
      setDescription("");
      await loadRequests();
    } catch(e) { setError(e.message||"Could not submit your privacy request."); }
    finally { setBusy(false); }
  }

  return <section id="privacy-data" className="panel" style={{maxWidth:720,padding:24,marginTop:18,scrollMarginTop:24}}>
    <span className="eyebrow">YOUR DATA</span><h2>Privacy &amp; personal data</h2>
    <p className="muted" style={{marginTop:6}}>Download a copy of the account information TaalLab holds, or submit a request to correct or delete your personal data.</p>
    <div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:18}}>
      <a className="primary-btn" href="/api/account/data-export" download><Download size={15}/> Download my data</a>
    </div>
    <form onSubmit={submitRequest} style={{marginTop:22}}>
      <label>Request type
        <select value={requestType} onChange={e=>setRequestType(e.target.value)}>
          <option value="deletion">Delete my account and personal data</option>
          <option value="correction">Correct my personal data</option>
        </select>
      </label>
      <label>Additional details <span className="muted">(optional)</span>
        <textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={1000} rows={3} placeholder="Tell us what you would like us to review."/>
      </label>
      <p className="muted" style={{fontSize:12,lineHeight:1.6}}>For deletion requests, TaalLab will verify the request and review connected services, shared content and records that must be retained for legal, tax, payment or security reasons. Submitting this request does not immediately delete your account. You can also manage Google Drive and Calendar data in your Google Account.</p>
      {error&&<div className="error-box" role="alert">{error}</div>}
      {message&&<div className="success-pill" role="status">{message}</div>}
      <button className="primary-btn" type="submit" disabled={busy}>{busy?"Submitting…":"Submit privacy request"}</button>
    </form>
    {requests.length>0&&<div style={{marginTop:22}}>
      <h3 style={{fontSize:14,marginBottom:10}}>Your privacy requests</h3>
      <div style={{display:"grid",gap:8}}>{requests.map(item=><div key={item.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,padding:"11px 12px",border:"1px solid var(--line)",borderRadius:10}}>
        <span><strong style={{display:"block",fontSize:12}}>{item.id}</strong><small className="muted">{item.request_type==="deletion"?"Account deletion":"Data correction"} · {fmtDate(item.created_at)}</small></span>
        <span className={"status "+(item.status==="completed"?"active":item.status==="declined"?"deleted":"expired")}>{item.status.replace("_"," ")}</span>
      </div>)}</div>
    </div>}
    <p className="muted" style={{fontSize:12,marginTop:16}}>Privacy questions: <a href="mailto:contact@taallab.in">contact@taallab.in</a> · <a href="/privacy.html">Privacy Policy</a></p>
  </section>;
}

function PrivacyRequestAdmin() {
  const [requests,setRequests]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [busyId,setBusyId]=useState("");

  async function load() {
    setLoading(true);setError("");
    try { const data=await api("/admin/privacy-requests");setRequests(data.requests||[]); }
    catch(e) { setError(e.message||"Could not load privacy requests."); }
    finally { setLoading(false); }
  }
  useEffect(()=>{load();},[]);
  async function update(id,status) {
    setBusyId(id);setError("");
    try { await api("/admin/privacy-requests/"+encodeURIComponent(id),{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});await load(); }
    catch(e) { setError(e.message||"Could not update this request."); }
    finally { setBusyId(""); }
  }
  return <section className="panel" style={{maxWidth:900,padding:24,marginTop:18}}>
    <div className="panel-head" style={{padding:0,border:0}}><div><h2>Privacy requests</h2><p>Review account data correction and deletion requests.</p></div><button type="button" className="ghost-btn" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button></div>
    {error&&<div className="error-box" role="alert">{error}</div>}
    {loading?<p className="muted">Loading privacy requests…</p>:requests.length===0?<p className="muted">No privacy requests have been submitted.</p>:<div className="table-wrap"><table><thead><tr><th>Reference</th><th>Account</th><th>Request</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead><tbody>
      {requests.map(item=><tr key={item.id}><td><strong>{item.id}</strong>{item.description&&<small style={{whiteSpace:"normal",maxWidth:240}}>{item.description}</small>}</td><td>{item.email||"Account unavailable"}</td><td>{item.request_type==="deletion"?"Delete data":"Correct data"}</td><td>{fmtDate(item.created_at)}</td><td><span className={"status "+(item.status==="completed"?"active":item.status==="declined"?"deleted":"expired")}>{item.status.replace("_"," ")}</span></td><td>{item.status==="completed"||item.status==="declined"?<span className="muted">Closed</span>:<select aria-label={"Update status for "+item.id} value={item.status} disabled={busyId===item.id} onChange={e=>update(item.id,e.target.value)}><option value="open">Open</option><option value="in_review">In review</option><option value="completed">Completed</option><option value="declined">Declined</option></select>}</td></tr>)}
    </tbody></table></div>}
    <p className="muted" style={{fontSize:12,marginTop:12}}>Mark a request completed only after verifying identity, carrying out the appropriate changes and documenting any records retained for legal or payment obligations. <a href="https://github.com/taallabstudio/webpage/blob/main/docs/PRIVACY_REQUEST_RUNBOOK.md" target="_blank" rel="noopener noreferrer">Open the handling guide</a>.</p>
  </section>;
}

function AccountSettings({user,onPasswordChanged,showGoogleDrive=false}) {
  const [currentPassword,setCurrentPassword]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [twoFactorEnabled,setTwoFactorEnabled]=useState(Number(user?.two_factor_enabled)!==0);
  const [securityPassword,setSecurityPassword]=useState("");
  const [securityMessage,setSecurityMessage]=useState("");
  const [securityError,setSecurityError]=useState("");
  const [securitySaving,setSecuritySaving]=useState(false);
  const [marketingSubscribed,setMarketingSubscribed]=useState(false);
  const [marketingLoading,setMarketingLoading]=useState(true);
  const [marketingSaving,setMarketingSaving]=useState(false);
  const [marketingMessage,setMarketingMessage]=useState("");
  const [marketingError,setMarketingError]=useState("");
  useEffect(()=>{api("/account/marketing-preference").then(d=>setMarketingSubscribed(!!d.subscribed)).catch(e=>setMarketingError(e.message)).finally(()=>setMarketingLoading(false));},[user?.id]);
  async function changeMarketingPreference(next){
    setMarketingSaving(true);setMarketingError("");setMarketingMessage("");
    try{const result=await api("/account/marketing-preference",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({subscribed:next})});setMarketingSubscribed(!!result.subscribed);setMarketingMessage(result.message||"Email preference updated.");}
    catch(e){setMarketingError(e.message||"Could not update your email preference.");}
    finally{setMarketingSaving(false);}
  }

  async function change(e){
    e.preventDefault();setMessage("");setError("");
    try{
      await api("/account/password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({current_password:currentPassword,new_password:newPassword})});
      setCurrentPassword("");setNewPassword("");setMessage("Password changed successfully.");onPasswordChanged();
    }catch(e){setError(e.message)}
  }

  async function saveSecurity(e){
    e.preventDefault();setSecurityMessage("");setSecurityError("");setSecuritySaving(true);
    try{
      const d=await api("/account/security",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({current_password:securityPassword,two_factor_enabled:twoFactorEnabled})
      });
      setSecurityPassword("");
      setSecurityMessage(d.two_factor_enabled?"Two-step verification is now enabled.":"Two-step verification is now turned off.");
      onPasswordChanged();
    }catch(e){setSecurityError(e.message)}
    finally{setSecuritySaving(false)}
  }

  const [driveConnected,setDriveConnected]=useState(null);
  const [driveError,setDriveError]=useState("");
  useEffect(()=>{
    if(!showGoogleDrive) return;
    api("/google/status").then(d=>setDriveConnected(!!d.connected)).catch(e=>{setDriveConnected(false);setDriveError(e.message)});
  },[showGoogleDrive]);

  const [displayName,setDisplayName]=useState(user?.display_name || user?.email?.split("@")[0] || "");
  const [avatarData,setAvatarData]=useState(user?.avatar_data || "");
  const [profileSaving,setProfileSaving]=useState(false);
  const [profileError,setProfileError]=useState("");
  const [profileMessage,setProfileMessage]=useState("");
  useEffect(()=>{setDisplayName(user?.display_name || user?.email?.split("@")[0] || "");setAvatarData(user?.avatar_data || "")},[user?.id,user?.display_name,user?.avatar_data]);

  async function chooseAvatar(file) {
    setProfileError("");setProfileMessage("");
    if(!file)return;
    if(!file.type.startsWith("image/")){setProfileError("Choose an image file.");return}
    let objectUrl="";
    try {
      const image = new Image(); objectUrl = URL.createObjectURL(file);
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=objectUrl});
      const canvas=document.createElement("canvas");canvas.width=256;canvas.height=256;
      const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Could not process this image.");
      const scale=Math.max(256/image.width,256/image.height),width=image.width*scale,height=image.height*scale;
      ctx.drawImage(image,(256-width)/2,(256-height)/2,width,height);
      const encoded=canvas.toDataURL("image/webp",0.82);
      if(encoded.length>350000)throw new Error("That image is too large. Please choose a smaller image.");
      setAvatarData(encoded);
    } catch(e) { setProfileError(e.message || "Could not read this image."); }
    finally { if(objectUrl)URL.revokeObjectURL(objectUrl); }
  }

  async function saveProfile(e) {
    e.preventDefault();setProfileSaving(true);setProfileError("");setProfileMessage("");
    try {
      const result=await api("/account/profile",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({display_name:displayName,avatar_data:avatarData})});
      setDisplayName(result.user?.display_name || displayName);setAvatarData(result.user?.avatar_data || "");
      setProfileMessage("Your profile has been updated.");onPasswordChanged();
    } catch(e) { setProfileError(e.message); }
    finally { setProfileSaving(false); }
  }

  return <div className="admin-content"><div className="page-head"><div><span className="eyebrow">ACCOUNT SETTINGS</span><h1>Account settings</h1><p>Manage your profile, sign-in security and password.</p></div></div>
    <section className="panel" style={{maxWidth:720,padding:24,marginBottom:18}}>
      <h2>Public profile</h2><p className="muted" style={{marginTop:6}}>This name and picture appear in the TaalLab website navigation when you are signed in.</p>
      <form onSubmit={saveProfile}>
        <div className="profile-editor"><ProfileAvatar user={{display_name:displayName,email:user?.email,avatar_data:avatarData}} size={88}/><div className="profile-editor-actions">
          <label className="ghost-btn profile-upload-btn">Change picture<input type="file" accept="image/png,image/jpeg,image/webp,image/*" onChange={e=>{chooseAvatar(e.target.files?.[0]);e.target.value=""}} hidden/></label>
          {avatarData && <button type="button" className="ghost-btn" onClick={()=>setAvatarData("")}>Use default picture</button>}
          <small className="muted">Square crop · saved as a small WebP image · max 250 KB</small>
        </div></div>
        <label>Username / display name<input value={displayName} onChange={e=>setDisplayName(e.target.value)} minLength={2} maxLength={40} placeholder="How should we show your name?" required/></label>
        <label>Email address<input value={user?.email || ""} readOnly disabled/></label>
        {profileError&&<div className="error-box">{profileError}</div>}{profileMessage&&<div className="success-pill">{profileMessage}</div>}
        <button className="primary-btn" disabled={profileSaving}>{profileSaving?"Saving profile…":"Save profile"}</button>
      </form>
    </section>
    <section className="panel" style={{maxWidth:720,padding:24,marginTop:18}}>
      <h2>Email preferences</h2>
      <p className="muted" style={{marginTop:6}}>Choose separately whether TaalLab may send you occasional product news and marketing emails. Account verification, security and purchase emails are not affected.</p>
      <label className="policy-consent" style={{marginTop:14}}>
        <input type="checkbox" checked={marketingSubscribed} disabled={marketingLoading||marketingSaving} onChange={e=>changeMarketingPreference(e.target.checked)}/>
        <span>Send me occasional product news and marketing emails. <small>You can unsubscribe here or through the unsubscribe link in any marketing email.</small></span>
      </label>
      {marketingLoading&&<p className="muted" role="status">Loading email preferences…</p>}
      {marketingError&&<div className="error-box" role="alert">{marketingError}</div>}
      {marketingMessage&&<div className="success-pill" role="status">{marketingMessage}</div>}
    </section>
    <PrivacyControls user={user}/>
    {showGoogleDrive&&<PrivacyRequestAdmin/>}
    <SecurityMethods user={user}/>
    <section className="panel" style={{maxWidth:620,padding:24,marginTop:18}}><h2>Change password</h2><form onSubmit={change}>
      <label>Current password<input type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} required/></label>
      <label>New password<input type="password" minLength={8} value={newPassword} onChange={e=>setNewPassword(e.target.value)} required/></label>
      {error&&<div className="error-box">{error}</div>}{message&&<div className="success-pill">{message}</div>}
      <button className="primary-btn">Change password</button>
    </form></section>
    {showGoogleDrive&&<section className="panel" style={{maxWidth:620,padding:24,marginTop:18}}>
      <div className="panel-head" style={{padding:0,border:0}}>
        <div><h2>Google Drive</h2><p>Files uploaded by TaalLab are stored in the connected Google Drive.</p></div>
        {driveConnected===true&&<span className="success-pill">Connected</span>}
        {driveConnected===false&&<span className="status deleted">Not connected</span>}
      </div>
      {driveError&&<div className="error-box" style={{marginTop:14}}>{driveError}</div>}
      <div style={{marginTop:16}}>
        <a className="primary-btn" href="/api/google/login">{driveConnected?"Reconnect Google Drive":"Connect Google Drive"}</a>
      </div>
    </section>}
  </div>;
}

function TransferFilterBar({value,onChange,deletedCount,onClearDeleted}) {
  return <div className="transfer-filter-bar">
    <div className="transfer-filter-group">
      <span>Show</span>
      {[
        ["all","All"],
        ["active","Active"],
        ["deleted","Deleted"],
      ].map(([key,label])=>
        <button key={key} className={value===key?"active":""} onClick={()=>onChange(key)}>{label}</button>
      )}
    </div>
    {deletedCount>0&&<button className="danger-btn" onClick={onClearDeleted}><Trash2 size={15}/> Clear deleted list</button>}
  </div>;
}

function filterTransfers(transfers,filter){
  if(filter==="active") return transfers.filter(t=>t.status==="active");
  if(filter==="deleted") return transfers.filter(t=>t.status==="deleted");
  return transfers;
}

function Dashboard({stats,transfers,onOpen}) {
  const [filter,setFilter]=useState("all");
  const [clearing,setClearing]=useState(false);
  const visible=filterTransfers(transfers,filter);
  const deletedCount=transfers.filter(t=>t.status==="deleted").length;

  async function clearDeleted(){
    if(!deletedCount||clearing)return;
    if(!confirm("Permanently clear the deleted transfer list? This cannot be undone."))return;
    setClearing(true);
    try{await api("/admin/transfers/deleted",{method:"DELETE"});location.reload();}
    catch(e){alert(e.message);setClearing(false);}
  }

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
    <section className="panel"><div className="panel-head"><div><h2>Recent transfers</h2><p>Client deliveries and download activity.</p></div><button className="ghost-btn" onClick={()=>location.href="/admin"}>View all <ChevronRight/></button></div>
      <TransferFilterBar value={filter} onChange={setFilter} deletedCount={deletedCount} onClearDeleted={clearDeleted}/>
      <TransferTable transfers={visible.slice(0,8)} onOpen={onOpen}/>
    </section>
  </div>;
}

function Transfers({transfers,onOpen}) {
  const [filter,setFilter]=useState("all");
  const [clearing,setClearing]=useState(false);
  const visible=filterTransfers(transfers,filter);
  const deletedCount=transfers.filter(t=>t.status==="deleted").length;

  async function clearDeleted(){
    if(!deletedCount||clearing)return;
    if(!confirm("Permanently clear the deleted transfer list? This cannot be undone."))return;
    setClearing(true);
    try{await api("/admin/transfers/deleted",{method:"DELETE"});location.reload();}
    catch(e){alert(e.message);setClearing(false);}
  }

  return <div className="admin-content"><div className="page-head"><div><span className="eyebrow">MANAGE</span><h1>Transfers</h1><p>All active and deleted client deliveries.</p></div><a className="primary-btn" href="/admin/upload"><Plus/> New Transfer</a></div><section className="panel">
      <div className="panel-head"><div><h2>Transfers</h2><p>Filter active or deleted deliveries.</p></div></div>
      <TransferFilterBar value={filter} onChange={setFilter} deletedCount={deletedCount} onClearDeleted={clearDeleted}/>
      <TransferTable transfers={visible} onOpen={onOpen}/>
    </section></div>;
}

function TransferTable({transfers,onOpen}) {
  return <div className="table-wrap"><table><thead><tr><th>File / transfer</th><th>Created</th><th>Expires</th><th>Files</th><th>Size</th><th>Downloads</th><th>Status</th><th></th></tr></thead><tbody>
    {transfers.map(t=><tr key={t.id}>
      <td>
        <button className="table-link" onClick={()=>onOpen(t)}>{t.file_name||"Untitled transfer"}</button>
        {t.recipient_email&&<small>To: {t.recipient_email}</small>}
        {t.file_count>1&&<small>+ {t.file_count-1} more file{t.file_count-1===1?"":"s"}</small>}
      </td>
      <td>{fmtDate(t.created_at)}</td><td>{fmtDate(t.expires_at)}</td><td>{t.file_count}</td><td>{formatBytes(t.total_size)}</td><td>{t.downloads}</td>
      <td><span className={`status ${t.status}`}>{t.status}</span></td>
      <td><span className="icon-btn" aria-hidden="true"><MoreHorizontal/></span></td>
    </tr>)}
  </tbody></table></div>;
}
function Upload({onDone}) {
  const [files,setFiles]=useState([]);
  const [message,setMessage]=useState("");
  const [recipientId,setRecipientId]=useState("");
  const [recipientEmail,setRecipientEmail]=useState("");
  const [recipients,setRecipients]=useState([]);
  const [uploading,setUploading]=useState(false);
  useEffect(()=>{api("/admin/users").then(d=>setRecipients((d.users||[]).filter(u=>u.status==="active"))).catch(()=>{})},[]);
  const [created,setCreated]=useState(null);
  const [recipientInfo,setRecipientInfo]=useState(null);
  const [progress,setProgress]=useState({done:0,total:0,active:""});
  const [copiedLink,setCopiedLink]=useState(null);

  async function copyLink(value,key){
    try{
      await navigator.clipboard.writeText(value);
      setCopiedLink(key);
      window.setTimeout(()=>setCopiedLink(current=>current===key?null:current),1800);
    }catch(e){
      alert("Could not copy the link.");
    }
  }
  const addFiles=e=>setFiles(prev=>[...prev,...Array.from(e.target.files||[])].map((f,i)=>f.id?f:Object.assign(f,{id:crypto.randomUUID()})));
  const drop=e=>{e.preventDefault();setFiles(prev=>[...prev,...Array.from(e.dataTransfer.files||[])].map(f=>Object.assign(f,{id:crypto.randomUUID()})))};
  async function upload(){
    if(!files.length)return;
    setUploading(true);
    try{
      const init=await api("/admin/transfers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message,user_id:recipientId||null,recipient_email:recipientEmail.trim(),files:files.map(f=>({name:f.name,size:f.size,type:f.type}))})});
      setRecipientInfo(init.recipient||null);
      let done=0;
      let nextIndex=0;
      const activeUploads=new Map();
      const total=init.files.length;
      const updateProgress=()=>setProgress({
        done,
        total,
        active:activeUploads.size
          ? `Uploading ${activeUploads.size} file${activeUploads.size===1?"":"s"} in parallel: ${[...activeUploads.values()].join(", ")}`
          : (done===total?"Finishing uploads…":"Preparing parallel uploads…")
      });
      setProgress({done:0,total,active:"Preparing parallel uploads…"});
      const uploadOne=async(i)=>{
        const item=init.files[i];
        const file=files[i];
        if(item.reused){
          done++;
          updateProgress();
          return;
        }

        activeUploads.set(i,`${item.name} — 0%`);
        updateProgress();
        await new Promise((resolve,reject)=>{
          const xhr=new XMLHttpRequest();
          xhr.open("PUT",item.uploadUrl);
          xhr.setRequestHeader("Content-Type",file.type||"application/octet-stream");
          xhr.upload.onprogress=e=>{
            if(e.lengthComputable){
              activeUploads.set(i,`${item.name} — ${Math.round(e.loaded/e.total*100)}%`);
              updateProgress();
            }
          };
          xhr.onload=()=>{
            if(xhr.status>=200&&xhr.status<300) resolve();
            else reject(new Error(`Upload failed for ${item.name} (${xhr.status})`));
          };
          xhr.onerror=()=>reject(new Error(`Upload failed for ${item.name}`));
          xhr.send(file);
        });
        activeUploads.delete(i);
        done++;
        updateProgress();
      };
      // Upload up to four files at once to improve throughput without
      // overwhelming the browser or storage service.
      const worker=async()=>{
        while(true){
          const i=nextIndex++;
          if(i>=total)return;
          await uploadOne(i);
        }
      };
      const results=await Promise.allSettled(
        Array.from({length:Math.min(4,total)},()=>worker())
      );
      const failed=results.find(result=>result.status==="rejected");
      if(failed){
        setProgress({done,total,active:"Upload failed"});
        throw failed.reason;
      }
      const result=await api(`/admin/transfers/${init.transferId}/complete`,{method:"POST"});
      if (result.notification?.sent) alert("Transfer created. Notification email sent successfully.");
      else if (result.notification?.error) alert(`Transfer created, but the notification email could not be sent: ${result.notification.error}`);
      setCreated(result);
    }catch(e){alert(e.message)}finally{setUploading(false)}
  }
  if(created) return <div className="admin-content"><div className="page-head"><div><span className="eyebrow">TRANSFER CREATED</span><h1>Ready to send</h1><p>Your TaalLab transfer is live for the configured expiration window.</p></div></div>
    <div className="created-card"><div className="success-large"><Check/></div><h2>Transfer Created</h2>{recipientInfo?.userCreated&&<div className="success-pill" style={{marginBottom:16}}>Client account created for {recipientInfo.email}. Temporary password: <strong>{recipientInfo.temporaryPassword}</strong></div>}{!recipientInfo&&<div className="muted" style={{marginBottom:16}}>Link-only transfer — no client account was assigned.</div>}<label>Transfer Link<div className="copy-row"><input readOnly value={created.transferUrl}/><button className={`ghost-btn copy-link-btn${copiedLink==="transfer"?" copied":""}`} onClick={()=>copyLink(created.transferUrl,"transfer")} aria-live="polite">{copiedLink==="transfer"?<Check/>:<Copy/>}{copiedLink==="transfer"?"Copied!":"Copy Link"}</button></div></label>
      <h3>Files</h3>{created.files.map(f=><div className="created-file" key={f.id}><IconFor kind={f.kind}/><div><strong>{f.name}</strong><small>{formatBytes(f.size)} • Expires {fmtDate(f.expires_at)}</small></div><button className={`ghost-btn copy-link-btn${copiedLink===f.id?" copied":""}`} onClick={()=>copyLink(f.downloadUrl,f.id)} aria-live="polite">{copiedLink===f.id?<Check/>:<Link2/>}{copiedLink===f.id?"Copied!":"Copy link"}</button></div>)}
      <button className="primary-btn" onClick={onDone}>Back to dashboard</button>
    </div></div>;
  return <div className="admin-content"><div className="page-head"><div><span className="eyebrow">NEW TRANSFER</span><h1>Send files</h1><p>Upload large studio assets and create a private client link.</p></div></div>
    <div className="upload-grid"><section className="panel upload-panel"><div className="dropzone" onDragOver={e=>e.preventDefault()} onDrop={drop}><UploadCloud/><h2>Drop files here</h2><p>or choose multiple files from your computer</p><label className="primary-btn"><Plus/> Select files<input hidden type="file" multiple onChange={addFiles}/></label><small>Files go directly to private R2 storage.</small></div>
      {!!files.length&&<div className="upload-files">{files.map(f=><div className="upload-file" key={f.id}><File/><div><strong>{f.name}</strong><small>{formatBytes(f.size)}</small></div><button type="button" className="icon-btn" aria-label={"Remove "+f.name} onClick={()=>setFiles(files.filter(x=>x.id!==f.id))}><X/></button></div>)}</div>}
    </section><section className="panel message-panel">
      <label>Client email <span className="muted">(optional)</span><input type="email" list="client-users" value={recipientEmail} placeholder="client@example.com — leave blank for link only" onChange={e=>{setRecipientEmail(e.target.value);setRecipientId("")}}/><datalist id="client-users">{recipients.map(u=><option key={u.id} value={u.email}>{u.email}</option>)}</datalist></label>
      <label>Select existing user <span className="muted">(optional)</span><select value={recipientId} onChange={e=>{const id=e.target.value;setRecipientId(id);const match=recipients.find(u=>u.id===id);if(match)setRecipientEmail(match.email)}}><option value="">No account / enter email manually…</option>{recipients.map(u=><option key={u.id} value={u.id}>{u.email}{u.role==="admin"?" (Admin)":""}</option>)}</select></label>
      <small className="muted">Email is optional. If you enter an email, an existing account is reused (and reactivated if disabled); if it does not exist, a receive-only user account is created automatically. Leave it blank for a link-only transfer. Clients can receive files only; they cannot create transfers.</small>
      <label>Client message<textarea rows="8" placeholder="Add a message for your client…" value={message} onChange={e=>setMessage(e.target.value)}/></label><div className="upload-summary"><span>Expiration</span><strong>7 days after upload</strong><span>Files</span><strong>{files.length}</strong><span>Total size</span><strong>{formatBytes(files.reduce((n,f)=>n+f.size,0))}</strong></div>{uploading?<div className="upload-progress-card" role="status" aria-live="polite">
        <div className="upload-progress-heading"><span className="upload-progress-icon"><RefreshCw className="spin"/></span><div><strong>{progress.done>=progress.total?"Finishing transfer…":`Uploading ${Math.min(4,progress.total-progress.done)} files in parallel`}</strong><small>{progress.done} of {progress.total} files completed</small></div><span className="upload-progress-count">{progress.total?Math.round(progress.done/progress.total*100):0}%</span></div>
        <div className="upload-progress-track"><span style={{width:`${progress.total?Math.round(progress.done/progress.total*100):0}%`}}/></div>
        <p className="upload-progress-detail">{progress.active||"Preparing your files…"}</p>
      </div>:<button className="primary-btn full upload-submit-btn" disabled={!files.length} onClick={upload}><UploadCloud/> Create transfer</button>}</section></div>
  </div>;
}

function TransferDetail({transfer,onClose,onChanged}) {
  const [detail,setDetail]=useState(null);
  useEffect(()=>{api(`/admin/transfers/${transfer.id}`).then(setDetail)},[transfer.id]);
  if(!detail)return <div className="detail-drawer"><RefreshCw className="spin"/></div>;
  return <div className="detail-drawer"><div className="drawer-head"><div><span className="eyebrow">TRANSFER DETAILS</span><h2>{detail.id}</h2></div><button type="button" aria-label="Close transfer details" onClick={onClose}><X/></button></div>
    <div className="detail-stats"><span>Created<strong>{fmtDate(detail.created_at)}</strong></span><span>Expires<strong>{fmtDate(detail.expires_at)}</strong></span><span>Total size<strong>{formatBytes(detail.total_size)}</strong></span><span>Downloads<strong>{detail.downloads}</strong></span></div>
    {detail.recipient_email&&<div className="message-box"><MessageSquare size={18}/><p><strong>Client:</strong> {detail.recipient_email}</p></div>}
    {detail.message&&<div className="message-box"><MessageSquare size={18}/><p>“{detail.message}”</p></div>}
    <div className="drawer-actions"><button className="ghost-btn" onClick={async()=>{const d=await api(`/admin/transfers/${detail.id}/extend`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({days:7})}); alert(`Extended to ${fmtDate(d.expires_at)}`); onChanged();}}><Clock3/> +7 days</button><button className="danger-btn" onClick={async()=>{if(!confirm("Delete this transfer and all of its files permanently?"))return; await api(`/admin/transfers/${detail.id}`,{method:"DELETE"}); onClose(); onChanged();}}><Trash2/> Delete transfer</button></div>
    <h3>Files</h3><div className="detail-files">{detail.files.map(f=><div className="detail-file" key={f.id}><IconFor kind={f.kind}/><div className="file-info"><strong>{f.original_name}</strong><small>{formatBytes(f.size)} • {f.download_count} downloads • {f.last_downloaded_at?fmtDate(f.last_downloaded_at):"Never downloaded"}</small></div><a className="icon-btn" title="Open download page" href={`/d/${detail.id}`}><Link2/></a><a className="icon-btn" title="Preview file" href={`/api/files/${f.download_token}/preview`} target="_blank" rel="noopener noreferrer"><Eye/></a></div>)}</div>
  </div>;
}

function formatBytes(n){if(!n)return"0 B";const u=["B","KB","MB","GB","TB"];const i=Math.min(Math.floor(Math.log(n)/Math.log(1024)),u.length-1);return`${(n/1024**i).toFixed(i?2:0)} ${u[i]}`}
function fmtDate(v){return new Date(Number(v)*1000).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}
function getPath(){
  return location.pathname.replace(/\/+$/, "") || "/";
}

function PurchasedProducts() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState("");
  useEffect(() => { api("/store/purchases").then(d => setPurchases(d.purchases || [])).catch(e => setError(e.message || "Could not load purchases.")).finally(() => setLoading(false)); }, []);
  async function download(orderId) {
    setDownloading(orderId); setError("");
    try { const d = await api("/store/purchases/download", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }) }); location.href = d.downloadUrl; }
    catch (e) { setError(e.message || "Could not prepare download."); setDownloading(""); }
  }
  return <section className="panel purchased-panel" id="purchased"><div className="panel-head"><div><h2>Purchased</h2><p>Your products, sorted by purchase date. Download them again whenever you need.</p></div></div>
    {loading ? <p className="muted">Loading your purchases…</p> : error && !purchases.length ? <p className="muted">{error}</p> : !purchases.length ? <div className="purchases-empty"><h3>No purchases yet</h3><p>Products you buy from TaalLab will appear here.</p><a className="primary-btn" href="/shop.html">Browse downloads</a></div> : <div className="purchases-list">{purchases.map(p => <article className="purchase-item" key={p.orderId}><div className="purchase-main"><strong>{p.productName}</strong><small>Order ID: {p.orderId}</small><small>Purchased {new Date(p.purchasedAt * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</small></div><div className="purchase-side"><strong>{(p.amount / 100).toLocaleString("en-IN", { style: "currency", currency: p.currency || "INR" })}</strong><button className="primary-btn" disabled={!p.canDownload || downloading === p.orderId} onClick={() => download(p.orderId)}>{downloading === p.orderId ? "Preparing…" : "Download"}</button></div></article>)}</div>}
    {error && purchases.length > 0 && <p className="error-text">{error}</p>}
  </section>;
}
function AccountPage() {
  const [user,setUser]=useState(null);
  const [checking,setChecking]=useState(true);
  async function refreshUser() {
    try { const result=await api("/auth/me");setUser(result.authenticated?result.user:null); }
    catch { setUser(null); }
    finally { setChecking(false); }
  }
  useEffect(()=>{refreshUser()},[]);
  if(checking)return <div className="loading"><RefreshCw className="spin"/> Checking your account…</div>;
  if(!user)return <Login onLogin={refreshUser}/>;
  return <div className="account-page-shell">
    <header className="account-page-header"><a href="/" className="account-home-link"><Logo studioOnly/></a><SiteAccountMenu user={user} onLogout={async()=>{try{await api("/auth/logout",{method:"POST"})}catch{}setUser(null);location.href="/login"}}/></header>
    <div className="account-content-column"><AccountSettings user={user} onPasswordChanged={refreshUser}/><PurchasedProducts/></div>
  </div>;
}

function UserDashboard(){
  const [user,setUser]=useState(null);
  const [checking,setChecking]=useState(true);
  useEffect(()=>{api("/auth/me").then(d=>{if(!d.authenticated){setUser(null);return}if(d.user?.role==="admin"){location.replace("/admin");return}setUser(d.user)}).catch(()=>setUser(null)).finally(()=>setChecking(false))},[]);
  if(checking)return <div className="loading"><RefreshCw className="spin"/> Checking your account…</div>;
  if(!user)return <Login/>;
  return <UserPortal user={user}/>;
}

function App(){
  const path = getPath();

  if(path.startsWith("/d/")) {
    return <TransferPage id={path.split("/")[2]}/>;
  }

  if(path === "/login" || path === "/reset-password") return <Login/>;

  if(path === "/admin") return <Admin/>;

  if(path === "/account") return <UserDashboard/>;

  if(path === "/account/settings") return <AccountPage/>;

  if(path === "/admin/upload") {
    return <Admin initialUpload/>;
  }

  return null;
}

export default App;
