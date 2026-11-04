import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine, ArrowLeft, Check, ChevronRight, Clock3, Copy, Download,
  Eye, File, FileAudio, FileImage, FileText, FileVideo, FolderOpen, Gauge,
  HardDrive, Link2, LockKeyhole, LogOut, Menu, MessageSquare, MoreHorizontal, Plus, RefreshCw, Search, Settings, ShieldCheck, Trash2, UploadCloud,
  UserRound, X, ChevronDown, Mail, MapPin, MessageCircle, Phone, ShoppingCart
} from "lucide-react";
import "./styles.css";
import "./styles.css";

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
    {user?.avatar_data ? <img src={user.avatar_data} alt="" /> : <UserRound size={Math.round(size*.55)} strokeWidth={1.8}/>}
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
  const avifSrc = src.replace(/\.webp$/i, ".avif");
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
  return <div className="brand" aria-label={studioOnly ? "TaalLab" : "TrackDeliver by TaalLab"}>
    <span className="brand-logo" aria-hidden="true"><img src="/logo.png" alt="" /></span>
    <span>{studioOnly ? "TaalLab" : <>TrackDeliver <small>by TaalLab</small></>}</span>
  </div>;
}


function Landing() {
  const [bookingSent, setBookingSent] = useState(false);
  const [bookingSending, setBookingSending] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingCooldown, setBookingCooldown] = useState(0);
  const [currentAccount, setCurrentAccount] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    // Authentication is useful for the account menu, but it is not needed
    // to render the public studio homepage. Wait until the browser is idle
    // so this API call cannot sit in the initial document's critical path.
    let cancelled = false;
    const loadAccount = () => {
      if (cancelled) return;
      api("/auth/me")
        .then(result => { if (!cancelled) setCurrentAccount(result.authenticated ? result.user : null); })
        .catch(() => { if (!cancelled) setCurrentAccount(null); });
    };
    const supportsIdle = typeof window.requestIdleCallback === "function";
    const taskId = supportsIdle
      ? window.requestIdleCallback(loadAccount, { timeout: 2500 })
      : window.setTimeout(loadAccount, 1500);
    return () => {
      cancelled = true;
      if (supportsIdle && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(taskId);
      else window.clearTimeout(taskId);
    };
  }, []);
  useEffect(() => { const sync=()=>{try{setCartCount(JSON.parse(localStorage.getItem("taallab.store.cart.v1")||"[]").length)}catch{setCartCount(0)}}; sync(); window.addEventListener("storage",sync); window.addEventListener("focus",sync); return ()=>{window.removeEventListener("storage",sync);window.removeEventListener("focus",sync)}; }, []);
  async function signOutFromSite() { try { await api("/auth/logout", { method: "POST" }); } catch {} setCurrentAccount(null); }

  useEffect(() => {
    const revealElements = Array.from(document.querySelectorAll(".landing .reveal"));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.target.classList.toggle("show", entry.isIntersecting));
    }, { threshold: 0.01, rootMargin: "0px 0px -5% 0px" });
    revealElements.forEach((element) => observer.observe(element));

    const stage = document.querySelector(".hero-scroll-stage");
    const heroArt = stage?.querySelector(".hero-art");
    // Keep the fixed image outside the sticky hero so its viewport position
    // survives the sticky container releasing at the end of the scroll track.
    const scrollHeadphone = document.querySelector(".landing > .scroll-headphone");
    let raf = 0;

    const updateHero = () => {
      raf = 0;
      if (!stage) return;
      const viewportHeight = window.innerHeight;
      const rect = stage.getBoundingClientRect();
      const scrollable = Math.max(stage.offsetHeight - viewportHeight, 1);
      // One continuous progress value drives the hero and the headphone.
      // The headphone stays pinned to the artwork centre while later
      // sections naturally scroll in front of it.
      const progress = Math.min(1, Math.max(0, -rect.top / scrollable));
      stage.style.setProperty("--hero-progress", progress.toFixed(4));

      if (heroArt && scrollHeadphone) {
        // While the sticky hero is active, keep the headphone aligned with
        // the artwork. Once the hero reaches its release point, freeze those
        // viewport coordinates so the next sections can scroll over it.
        // On upward scrolling the hero re-enters the sticky interval and the
        // coordinates are measured again.
        if (rect.bottom >= viewportHeight - 1) {
          const artRect = heroArt.getBoundingClientRect();
          scrollHeadphone.style.setProperty("--headphone-x", `${(artRect.left + artRect.width / 2).toFixed(2)}px`);
          scrollHeadphone.style.setProperty("--headphone-y", `${(artRect.top + artRect.height / 2).toFixed(2)}px`);
          scrollHeadphone.style.setProperty("--headphone-size", `${Math.min(artRect.width * 0.88, 620).toFixed(2)}px`);
        }
        scrollHeadphone.style.setProperty("--headphone-rotation", `${(progress * 360).toFixed(2)}deg`);
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(updateHero);
    };

    updateHero();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateHero);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateHero);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (!bookingCooldown) return;
    const timer = window.setInterval(() => {
      setBookingCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [bookingCooldown]);

  async function submitBooking(e) {
    e.preventDefault();
    if (bookingSending || bookingCooldown > 0) return;
    setBookingSending(true);
    setBookingSent(false);
    setBookingError("");

    const form = new FormData(e.currentTarget);
    try {
      await api("/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          whatsapp: form.get("whatsapp"),
          service: form.get("service"),
          date: form.get("date"),
          message: form.get("message"),
        }),
      });
      setBookingSent(true);
      e.currentTarget.reset();
      e.currentTarget.querySelector('select[name="service"]').value = "Music Production";
    } catch (error) {
      if (error.retryAfter > 0) setBookingCooldown(error.retryAfter);
      setBookingError(error.message || "Could not send your enquiry. Please try again.");
    } finally {
      setBookingSending(false);
    }
  }

  return <main className="landing" id="home">
    <div className="landing-glow" />
    <img className="scroll-headphone" src="/headphones.webp" alt="" aria-hidden="true" />
    <header className="landing-nav">
      <a className="studio-brand" href="#home" aria-label="TaalLab home"><Logo studioOnly /></a>

      <button className="mobile-nav-toggle" type="button" aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(v => !v)}><Menu size={21}/></button>
      <nav className={`studio-nav${mobileMenuOpen ? " mobile-open" : ""}`} aria-label="Main navigation" onClick={() => setMobileMenuOpen(false)}>
        <a href="#home">Home</a>
        <a href="/shop.html">Shop</a>

        <div className="nav-dropdown">
          <a href="#services">Services <ChevronDown className="nav-caret" size={13} strokeWidth={1.8} aria-hidden="true" /></a>
          <div className="nav-menu">
            <a href="#music-production">Music Production</a>
            <a href="#recording">Recording</a>
            <a href="#mixing">Mixing</a>
            <a href="#mastering">Mastering</a>
            <a href="#dubbing">Dubbing / Voice Over</a>
          </div>
        </div>

        <div className="nav-dropdown">
          <a href="#studio">Studio <ChevronDown className="nav-caret" size={13} strokeWidth={1.8} aria-hidden="true" /></a>
          <div className="nav-menu">
            <a href="#studio">The Studio</a>
            <a href="#equipment">Equipment &amp; Setup</a>
          </div>
        </div>

        <a href="#book-session">Book Session</a>

        <div className="nav-dropdown">
          <a href="#contact">Contact <ChevronDown className="nav-caret" size={13} strokeWidth={1.8} aria-hidden="true" /></a>
          <div className="nav-menu nav-menu-right">
            <a href="#contact-email">Email</a>
            <a href="#contact-instagram">Instagram</a>
            <a href="#contact-whatsapp">WhatsApp</a>
            <a href="#contact-location">Location</a>
          </div>
        </div>
      </nav>

      <div className="landing-auth">
        <a className="cart-nav-btn" href="/shop.html#cart" aria-label={`Shopping cart, ${cartCount} items`} title="Cart"><ShoppingCart size={18}/>{cartCount > 0 && <span className="cart-count">{cartCount}</span>}</a>
        {currentAccount ? <SiteAccountMenu user={currentAccount} onLogout={signOutFromSite}/> : <><a className="login-nav-btn secondary" href="/login">Sign up</a><a className="login-nav-btn" href="/login">Login</a></>}
      </div>
    </header>

    <section className="hero-scroll-stage" aria-label="TaalLab introduction">
      <div className="hero-sticky">
        <div className="hero-section">
          <div className="hero-copy">
            <div className="eyebrow"><span className="dot" /> TAAL LAB • RECORDING &amp; MUSIC PRODUCTION</div>
            <h1>Sound that feels<br/><em>like you.</em></h1>
            <p>Music production, recording, mixing and mastering for artists who care about every detail.</p>
            <div className="hero-actions">
              <a className="primary-btn" href="#book-session">Book a session <ChevronRight size={16}/></a>
            </div>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="hero-art-glow" />
            <div className="hero-art-ring ring-one" />
            <div className="hero-art-ring ring-two" />
            <span className="hero-art-caption">LISTEN<br/>FEEL<br/>CREATE</span>
          </div>

          <div className="hero-note">
            <span>TAAL LAB</span>
            <small>Music • Voice • Production</small>
          </div>
        </div>

        <div className="hero-scroll-hint"><span>SCROLL TO EXPLORE</span><i /></div>
      </div>
    </section>

    <section className="site-section services-section reveal-on-scroll" id="services">
      <div className="section-heading reveal">
        <span className="section-kicker">WHAT WE DO</span>
        <h2>Everything your<br/><em>sound</em> needs.</h2>
        <p>From the first idea to the final master, TaalLab gives your project a focused space to become what you imagined.</p>
      </div>
      <div className="service-grid reveal-stagger">
        {[
          ["01","Music Production","From arrangement and sound design to the finished production.","music-production"],
          ["02","Recording","Clean, detailed recording for vocals, instruments and voice work.","recording"],
          ["03","Mixing","A balanced, powerful mix that gives every element its place.","mixing"],
          ["04","Mastering","Final polish, translation and loudness for release-ready audio.","mastering"],
          ["05","Dubbing / Voice Over","Professional voice recording, dubbing and spoken-word production.","dubbing"]
        ].map(([num,title,desc,id]) =>
          <article className="service-card reveal" id={id} key={id}>
            <span>{num}</span>
            <h3>{title}</h3>
            <p>{desc}</p>
            <a href="#book-session">Enquire <ChevronRight size={15}/></a>
          </article>
        )}
      </div>
    </section>

    <section className="site-section studio-section-new reveal-on-scroll" id="studio">
      <div className="studio-visual studio-photo-wrap reveal" aria-label="TaalLab recording studio">
        <ProgressiveImage className="studio-photo" src="/studio.webp" previewSrc="/studio-preview.avif" alt="TaalLab recording studio" />
        <div className="studio-photo-overlay" />
        <div className="studio-visual-label"><span>TAAL LAB</span><small>RECORDING STUDIO</small></div>
      </div>
      <div className="studio-copy reveal">
        <span className="section-kicker">THE STUDIO</span>
        <h2>A focused room for<br/><em>great sound.</em></h2>
        <p>TaalLab is a dedicated recording and music-production studio built for artists, creators and projects that deserve attention to detail.</p>
        <p>Bring an idea, a finished song or simply a voice. We'll help you shape it into something you can be proud of.</p>
        <div className="equipment-list" id="equipment">
          <div className="reveal"><strong>01</strong><span>Recording &amp; vocal production</span></div>
          <div className="reveal"><strong>02</strong><span>Music production &amp; arrangement</span></div>
          <div className="reveal"><strong>03</strong><span>Mixing &amp; mastering workflow</span></div>
          <div className="reveal"><strong>04</strong><span>Voice over &amp; dubbing setup</span></div>
        </div>
      </div>
    </section>

    <section className="site-section booking-section reveal-on-scroll" id="book-session">
      <div className="booking-intro reveal">
        <span className="section-kicker">BOOK A SESSION</span>
        <h2>Let's make<br/><em>something.</em></h2>
        <p>Tell us what you're working on and what you need. We'll get back to you with the next steps.</p>
        <div className="booking-detail reveal"><span>01</span><div><strong>Choose a service</strong><small>Recording, production, mixing, mastering or voice work.</small></div></div>
        <div className="booking-detail reveal"><span>02</span><div><strong>Tell us about the project</strong><small>Give us your preferred date and a little context.</small></div></div>
      </div>
      <form className="booking-form reveal" onSubmit={submitBooking}>
        <div className="form-row">
          <label>Name<input name="name" required placeholder="Your name" /></label>
          <label>Email<input name="email" type="email" required placeholder="you@example.com" /></label>
        </div>
        <div className="form-row">
          <label>WhatsApp <span>(optional)</span><input name="whatsapp" placeholder="+91..." /></label>
          <label>Service<select name="service" defaultValue="Music Production">
            <option>Music Production</option><option>Recording</option><option>Mixing</option><option>Mastering</option><option>Dubbing / Voice Over</option>
          </select></label>
        </div>
        <label>Preferred date <span>(optional)</span><input name="date" type="date" /></label>
        <label>Message <span>(optional)</span><textarea name="message" rows="5" placeholder="Tell us about your project..." /></label>
        <button className="primary-btn booking-submit-btn" type="submit" disabled={bookingSending || bookingCooldown > 0}>
          {bookingSending ? <><RefreshCw className="spin" size={16}/> Sending…</> : bookingCooldown > 0 ? <>Try again in {Math.ceil(bookingCooldown / 60)} min</> : bookingSent ? <><Check size={16}/> Enquiry sent</> : <>Send booking enquiry <ChevronRight size={16}/></>}
        </button>
        {bookingSent && <p className="booking-note booking-success-note">Thanks! Your enquiry has been sent to TaalLab. We'll get back to you soon.</p>}
        {bookingError && <p className="booking-note booking-error-note">{bookingError}</p>}
      </form>
    </section>

    <section className="contact-section reveal-on-scroll" id="contact">
      <div className="contact-inner">
        <div>
          <span className="section-kicker">GET IN TOUCH</span>
          <h2>Come make<br/><em>some noise.</em></h2>
        </div>
        <div className="contact-grid reveal">
          <a className="reveal contact-card" id="contact-email" href="mailto:contact@taallab.work">
            <Mail className="contact-card-icon" size={22} strokeWidth={1.7} aria-hidden="true" />
            <span>Email</span><strong>contact@taallab.work</strong>
          </a>
          <a className="reveal contact-card" id="contact-instagram" href="https://www.instagram.com/taallabstudio" target="_blank" rel="noopener noreferrer">
            <MessageCircle className="contact-card-icon" size={22} strokeWidth={1.7} aria-hidden="true" />
            <span>Instagram</span><strong>@taallabstudio</strong>
          </a>
          <div className="reveal contact-card" id="contact-whatsapp">
            <MessageCircle className="contact-card-icon" size={22} strokeWidth={1.7} aria-hidden="true" />
            <span>WhatsApp</span><strong>Contact us for the studio number</strong>
          </div>
          <a className="reveal contact-card" id="contact-location" href="https://share.google/gHDTeuoEYJrjQpcFk" target="_blank" rel="noopener noreferrer">
            <MapPin className="contact-card-icon" size={22} strokeWidth={1.7} aria-hidden="true" />
            <span>Location</span><strong>Open TaalLab Studio in Maps</strong>
          </a>
        </div>
      </div>
      <footer><Logo studioOnly/><span>© 2026 TaalLab. Music, recording &amp; production.</span></footer>
    </section>
  </main>;
}

export default Landing;
