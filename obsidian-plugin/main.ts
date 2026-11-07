import { App, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile, TFolder, requestUrl } from "obsidian";

interface ObsidianSyncSettings {
  workspaceUrl: string;
  token: string;
  autoSync: boolean;
}
const DEFAULT_SETTINGS: ObsidianSyncSettings = {
  workspaceUrl: "https://ocean.taallab.in",
  token: "",
  autoSync: true
};
type ManifestItem = { externalId: string; contentHash?: string; updatedAt?: number };
type Manifest = { notes: ManifestItem[]; attachments: ManifestItem[]; folders: ManifestItem[] };

export default class TaalLabObsidianSync extends Plugin {
  settings: ObsidianSyncSettings;
  private debounceHandle: number | null = null;
  private running = false;
  private rerun = false;
  private statusBar: HTMLElement;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new ObsidianSyncSettingTab(this.app, this));
    this.addRibbonIcon("refresh-cw", "Sync vault to OCEAN", () => void this.syncNow());
    this.addCommand({ id: "sync-vault-now", name: "Sync entire vault to OCEAN", callback: () => void this.syncNow() });
    this.registerEvent(this.app.vault.on("create", file => this.queueSync(file)));
    this.registerEvent(this.app.vault.on("modify", file => this.queueSync(file)));
    this.registerEvent(this.app.vault.on("delete", file => this.queueSync(file)));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => this.queueSync(file, oldPath)));
    this.statusBar = this.addStatusBarItem();
    this.statusBar.setText("OCEAN sync ready");
  }

  onunload() { if (this.debounceHandle !== null) window.clearTimeout(this.debounceHandle); }
  async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
  async saveSettings() { await this.saveData(this.settings); }

  private queueSync(_file?: TAbstractFile, _oldPath?: string) {
    if (!this.settings.autoSync) return;
    if (this.debounceHandle !== null) window.clearTimeout(this.debounceHandle);
    this.debounceHandle = window.setTimeout(() => { this.debounceHandle = null; void this.syncNow(true); }, 2500);
  }

  private endpoint(path: string) {
    const base = this.settings.workspaceUrl.trim().replace(/\/+$/, "");
    return base + path;
  }
  private async api(path: string, options: { method?: string; body?: string | ArrayBuffer; contentType?: string } = {}) {
    if (!this.settings.token.trim()) throw new Error("Add your OCEAN integration token in plugin settings.");
    const headers: Record<string, string> = { Authorization: "Bearer " + this.settings.token };
    if (options.contentType) headers["Content-Type"] = options.contentType;
    const response = await requestUrl({ url: this.endpoint(path), method: options.method || "GET", headers, body: options.body, throw: false });
    if (response.status < 200 || response.status >= 300) {
      let message = "OCEAN request failed (" + response.status + ").";
      try { message = response.json?.error || message; } catch {}
      throw new Error(message);
    }
    return response.json;
  }
  private async hash(value: string | ArrayBuffer) {
    const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map(v => v.toString(16).padStart(2, "0")).join("");
  }
  private included(path: string) {
    const normalized = path.replace(/\\/g, "/").replace(/^\\/+|\\/+$/g, "");
    // Obsidian exposes its vault root as "/" on some platforms.
    // It is not a vault-relative item and must never be sent to OCEAN.
    if (!normalized) return false;
    return !normalized.split("/").some(part => part === ".obsidian");
  }
  private async uploadAttachment(file: TFile, remote?: ManifestItem) {
    const bytes = await this.app.vault.readBinary(file);
    const hash = await this.hash(bytes);
    if (remote?.contentHash === hash) return;
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    await this.api("/api/integrations/obsidian/attachments?externalId=" + encodeURIComponent(file.path), {
      method: "PUT", body, contentType: this.mimeType(file.extension)
    });
  }
  private mimeType(ext: string) {
    const map: Record<string, string> = {
      png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",webp:"image/webp",svg:"image/svg+xml",
      pdf:"application/pdf",mp3:"audio/mpeg",wav:"audio/wav",m4a:"audio/mp4",ogg:"audio/ogg",mp4:"video/mp4",
      mov:"video/quicktime",txt:"text/plain",csv:"text/csv",json:"application/json",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",zip:"application/zip"
    };
    return map[ext.toLowerCase()] || "application/octet-stream";
  }

  async syncNow(silent = false) {
    if (this.running) { this.rerun = true; return; }
    if (!this.settings.token.trim()) { new Notice("Open OCEAN Sync settings and add your integration token."); return; }
    this.running = true;
    const status = this.statusBar;
    status.setText("OCEAN: syncing…");
    if (!silent) new Notice("Starting full-vault sync to OCEAN…");
    try {
      do {
        this.rerun = false;
        const manifest = await this.api("/api/integrations/obsidian/manifest") as Manifest;
        const remoteNotes = new Map((manifest.notes || []).map(item => [item.externalId, item]));
        const remoteAttachments = new Map((manifest.attachments || []).map(item => [item.externalId, item]));
        const remoteFolders = new Set((manifest.folders || []).map(item => item.externalId.replace(/^@folder\/Obsidian\//, "")));

        const all = this.app.vault.getAllLoadedFiles().filter(file => this.included(file.path));
        const folders = all.filter((file): file is TFolder => file instanceof TFolder && !!file.path);
        const files = this.app.vault.getFiles().filter(file => this.included(file.path));
        const notes = files.filter(file => file.extension.toLowerCase() === "md");
        const attachments = files.filter(file => file.extension.toLowerCase() !== "md");
        const localFolderPaths = new Set(folders.map(folder => folder.path));

        for (const folder of folders) {
          await this.api("/api/integrations/obsidian/folders", {
            method: "PUT", contentType: "application/json",
            body: JSON.stringify({ externalId: folder.path })
          });
        }

        let uploaded = 0, changedNotes = 0;
        const skipped: string[] = [];
        for (const file of attachments) {
          if (file.stat.size > 100 * 1024 * 1024) { skipped.push(file.path + " (over 100 MB)"); continue; }
          await this.uploadAttachment(file, remoteAttachments.get(file.path));
          uploaded++;
        }

        for (const file of notes) {
          const content = await this.app.vault.cachedRead(file);
          if (content.length > 350000) { skipped.push(file.path + " (over 350 KB)"); continue; }
          const contentHash = await this.hash(content);
          if (remoteNotes.get(file.path)?.contentHash === contentHash) continue;
          const frontmatter = { ...(this.app.metadataCache.getFileCache(file)?.frontmatter || {}) };
          delete (frontmatter as any).position;
          await this.api("/api/integrations/obsidian/notes", {
            method: "PUT", contentType: "application/json",
            body: JSON.stringify({
              externalId: file.path,
              title: file.basename,
              content,
              contentHash,
              modifiedAt: Math.floor(file.stat.mtime / 1000),
              frontmatter
            })
          });
          changedNotes++;
        }

        const localNotePaths = new Set(notes.map(file => file.path));
        for (const path of remoteNotes.keys()) {
          if (!localNotePaths.has(path)) await this.api("/api/integrations/obsidian/notes?externalId=" + encodeURIComponent(path), { method: "DELETE" });
        }
        const localAttachmentPaths = new Set(attachments.map(file => file.path));
        for (const path of remoteAttachments.keys()) {
          if (!localAttachmentPaths.has(path)) await this.api("/api/integrations/obsidian/attachments?externalId=" + encodeURIComponent(path), { method: "DELETE" });
        }
        for (const path of remoteFolders) {
          if (!localFolderPaths.has(path)) await this.api("/api/integrations/obsidian/folders?externalId=" + encodeURIComponent(path), { method: "DELETE" });
        }
        status.setText(skipped.length ? "OCEAN: synced with skips" : "OCEAN: synced");
        if (!silent) new Notice("OCEAN sync complete. " + changedNotes + " notes updated; " + uploaded + " attachments checked." + (skipped.length ? " " + skipped.length + " oversized files skipped: " + skipped.slice(0, 3).join(", ") : ""), 10000);
      } while (this.rerun);
    } catch (error) {
      status.setText("OCEAN: sync error");
      new Notice("OCEAN sync failed: " + (error instanceof Error ? error.message : String(error)), 10000);
    } finally {
      this.running = false;
    }
  }
}

class ObsidianSyncSettingTab extends PluginSettingTab {
  plugin: TaalLabObsidianSync;
  constructor(app: App, plugin: TaalLabObsidianSync) { super(app, plugin); this.plugin = plugin; }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "TaalLab OCEAN Sync" });
    containerEl.createEl("p", { text: "Sync your entire vault to the Obsidian folder in OCEAN. The sync is one-way; Obsidian remains the source of truth." });
    new Setting(containerEl).setName("OCEAN workspace URL").setDesc("Your OCEAN workspace address.").addText(text => text.setPlaceholder("https://ocean.taallab.in").setValue(this.plugin.settings.workspaceUrl).onChange(async value => { this.plugin.settings.workspaceUrl = value.trim(); await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("Integration token").setDesc("Generate this in OCEAN → Obsidian Sync. Keep it private.").addText(text => text.setPlaceholder("ocean_obs_…").setValue(this.plugin.settings.token).onChange(async value => { this.plugin.settings.token = value.trim(); await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("Automatic sync").setDesc("Sync after vault files are created, edited, renamed or deleted.").addToggle(toggle => toggle.setValue(this.plugin.settings.autoSync).onChange(async value => { this.plugin.settings.autoSync = value; await this.plugin.saveSettings(); }));
    new Setting(containerEl).addButton(button => button.setButtonText("Sync entire vault now").setCta().onClick(() => void this.plugin.syncNow()));
    containerEl.createEl("p", { text: "The .obsidian application settings folder is intentionally excluded so plugin credentials and workspace configuration are never uploaded." });
  }
}
