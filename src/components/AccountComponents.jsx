import React from "react";
import { uploadToSupabase } from "../supabaseClient";
import {
  ArrowRight, ArrowUpRight, Check, ChevronDown, Menu, X, Sparkles, ShieldCheck, MapPin, Camera, Activity, CloudRain, Flame, Mic, Wind, BrainCircuit, User, Lock, Mail, LogOut, Eye, EyeOff, Thermometer, Droplets, Gauge, Satellite, Video, Table, Bell, Download, Play, Pause, Trash2, RotateCcw, Compass, Navigation, Save, Radio, FileText, Maximize2, Minimize2, AlertTriangle, Settings, HelpCircle, Upload, Paperclip, MessageSquare, Moon, Sun, Monitor, CheckCircle2, Clock3, Send, UserRound, motion, useAnimation, useInView, AnimatePresence, getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, fetchSignInMethodsForEmail, onAuthStateChanged, signOut, updateProfile, reload, EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateEmail, onValue, ref, getStorage, storageRef, uploadBytes, getDownloadURL, firebaseApp, db, firebaseAuth, firebaseStorage, BACKEND_URL, BACKEND_DISPLAY_URL, EMPTY_READING, EMPTY_GPS, NAV_ITEMS, DEFAULT_ALERT_SETTINGS, pm25Status, statusClass, getIaqColor, clamp, fmt, yVal, buildPath, buildAlerts, accountStorageKey, readAccountSettings, readLocalAvatar, saveLocalAvatar, formatAdminTime
} from "../lib/smartSurroundShared.jsx";

function ProfileAvatar({ user, size = 44, className = "" }) {
  const [localAvatar, setLocalAvatar] = React.useState(() => readLocalAvatar(user?.id));
  React.useEffect(() => {
    setLocalAvatar(readLocalAvatar(user?.id));
  }, [user?.id, user?.photoURL]);

  const src = user?.photoURL || localAvatar;
  return (
    <span
      className={`account-avatar-button ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {src ? (
        <img src={src} alt="Profile" />
      ) : (
        <User size={Math.max(15, Math.round(size * 0.42))} />
      )}
    </span>
  );
}

function AccountMenu({ onSelect, onLogout }) {
  return (
    <motion.div
      className="account-dropdown"
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.16 }}
    >
      <div className="account-dropdown-head">
        <div className="account-dropdown-icon"><UserRound size={16} /></div>
        <div>
          <strong>Account</strong>
          <span>Manage your SmartSurround account</span>
        </div>
      </div>
      <div className="account-menu-list">
        <button type="button" onClick={() => onSelect("profile")}>
          <span className="account-menu-icon"><UserRound size={16} /></span>
          <span><strong>Update Profile</strong><small>Personal information & avatar</small></span>
          <ChevronDown size={14} className="account-menu-chevron" />
        </button>
        <button type="button" onClick={() => onSelect("help")}>
          <span className="account-menu-icon"><HelpCircle size={16} /></span>
          <span><strong>Help Desk</strong><small>Complaints & ticket status</small></span>
          <ChevronDown size={14} className="account-menu-chevron" />
        </button>
        <button type="button" onClick={() => onSelect("settings")}>
          <span className="account-menu-icon"><Settings size={16} /></span>
          <span><strong>Settings</strong><small>Appearance & preferences</small></span>
          <ChevronDown size={14} className="account-menu-chevron" />
        </button>
        <div className="account-menu-divider" />
        <button type="button" className="account-menu-danger" onClick={onLogout}>
          <span className="account-menu-icon"><LogOut size={16} /></span>
          <span><strong>Logout</strong><small>Sign out of this dashboard</small></span>
          <ChevronDown size={14} className="account-menu-chevron" />
        </button>
      </div>
    </motion.div>
  );
}

function LogoutConfirmDialog({ onCancel, onConfirm, loading = false }) {
  return (
    <div className="account-confirm-backdrop" role="presentation">
      <motion.div
        className="account-confirm-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-confirm-title"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
      >
        <div className="account-confirm-icon"><LogOut size={20} /></div>
        <h3 id="logout-confirm-title">Are you sure you want to log out?</h3>
        <p>Your active SmartSurround session will be cleared.</p>
        <div className="account-confirm-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={loading}>Cancel</button>
          <button type="button" className="primary-button account-danger-button" onClick={onConfirm} disabled={loading}>
            <LogOut size={15} /> {loading ? "Logging out..." : "Log Out"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function AccountPanel({ currentUser, section, onClose, onUserUpdated, onAppearanceChange, onLogout, embedded = false }) {
  const [activeSection, setActiveSection] = React.useState(section || "profile");
  const [settings, setSettings] = React.useState(() => readAccountSettings(currentUser?.id));
  const [form, setForm] = React.useState({
    name: currentUser?.name || "",
    email: currentUser?.email || "",
    phone: (() => {
      try { return window.localStorage.getItem(accountStorageKey("smartsurround_phone", currentUser?.id)) || ""; } catch { return ""; }
    })(),
    currentPassword: "",
    newPassword: "",
  });
  const [avatarPreview, setAvatarPreview] = React.useState(currentUser?.photoURL || readLocalAvatar(currentUser?.id));
  const [avatarFile, setAvatarFile] = React.useState(null);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [profileMessage, setProfileMessage] = React.useState({ type: "", text: "" });
  const [complaints, setComplaints] = React.useState([]);
  const [complaintForm, setComplaintForm] = React.useState({ subject: "", description: "", priority: "Normal" });
  const [attachment, setAttachment] = React.useState(null);
  const [loadingComplaints, setLoadingComplaints] = React.useState(false);
  const [submittingComplaint, setSubmittingComplaint] = React.useState(false);
  const [helpMessage, setHelpMessage] = React.useState({ type: "", text: "" });
  const [lastTicket, setLastTicket] = React.useState("");
  const [savingSettings, setSavingSettings] = React.useState(false);
  const complaintAttachmentInputRef = React.useRef(null);

  const clearComplaintAttachment = () => {
    setAttachment(null);
    if (complaintAttachmentInputRef.current) complaintAttachmentInputRef.current.value = "";
  };

  React.useEffect(() => {
    setActiveSection(section || "profile");
  }, [section]);

  React.useEffect(() => {
    if (!currentUser?.id) return;
    setSettings(readAccountSettings(currentUser.id));
    setForm((prev) => ({ ...prev, name: currentUser.name || prev.name, email: currentUser.email || prev.email }));
    setAvatarPreview(currentUser.photoURL || readLocalAvatar(currentUser.id));
  }, [currentUser?.id, currentUser?.name, currentUser?.email, currentUser?.photoURL]);

  const loadComplaints = React.useCallback(async () => {
    if (!currentUser?.id) return;
    setLoadingComplaints(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/complaints?user_id=${encodeURIComponent(currentUser.id)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || "Unable to load your complaints.");
      setComplaints(Array.isArray(data.complaints) ? data.complaints : []);
    } catch (err) {
      const networkError = err?.name === "TypeError" && /fetch/i.test(err?.message || "");
      setHelpMessage({
        type: "error",
        text: networkError
          ? `Help Desk server is unavailable. Start the SmartSurround backend at ${BACKEND_DISPLAY_URL} and try Refresh again.`
          : (err.message || "Unable to load Help Desk history."),
      });
    } finally {
      setLoadingComplaints(false);
    }
  }, [currentUser?.id]);

  React.useEffect(() => {
    if (activeSection === "help") loadComplaints();
  }, [activeSection, loadComplaints]);

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProfileMessage({ type: "error", text: "Please select an image file." });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileMessage({ type: "error", text: "Profile pictures must be 2 MB or smaller." });
      return;
    }
    setAvatarFile(file);
    setProfileMessage({ type: "", text: "" });
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    const authUser = firebaseAuth.currentUser;
    if (!authUser) {
      setProfileMessage({ type: "error", text: "Your session has expired. Please sign in again." });
      return;
    }
    const name = form.name.trim();
    const email = form.email.trim();
    if (!name) {
      setProfileMessage({ type: "error", text: "Full Name is required." });
      return;
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setProfileMessage({ type: "error", text: "Enter a valid email address." });
      return;
    }
    if (form.newPassword && form.newPassword.length < 6) {
      setProfileMessage({ type: "error", text: "New password must contain at least 6 characters." });
      return;
    }
    if ((email !== authUser.email || form.newPassword) && !form.currentPassword) {
      setProfileMessage({ type: "error", text: "Enter your current password to change email or password." });
      return;
    }

    setSavingProfile(true);
    setProfileMessage({ type: "", text: "" });
    try {
      if ((email !== authUser.email || form.newPassword) && form.currentPassword) {
        const credential = EmailAuthProvider.credential(authUser.email || form.email, form.currentPassword);
        await reauthenticateWithCredential(authUser, credential);
      }

      if (email !== authUser.email) await updateEmail(authUser, email);
      if (form.newPassword) await updatePassword(authUser, form.newPassword);

      let photoURL = authUser.photoURL || "";
      let localAvatarValue = "";
      let avatarStorageFallback = false;
      if (avatarFile) {
        try {
          photoURL = await uploadToSupabase(avatarFile);
        } catch (storageError) {
          console.warn("Supabase avatar storage unavailable; using local fallback.", storageError);
          // Keep the profile usable while Supabase Storage is being configured.
          const fallbackReader = new FileReader();
          localAvatarValue = String(await new Promise((resolve, reject) => {
            fallbackReader.onload = () => resolve(String(fallbackReader.result || ""));
            fallbackReader.onerror = reject;
            fallbackReader.readAsDataURL(avatarFile);
          }) || "");
          avatarStorageFallback = true;
        }
      }

      await updateProfile(authUser, { displayName: name, photoURL: photoURL || null });
      if (photoURL) saveLocalAvatar(authUser.uid, photoURL);
      if (localAvatarValue) saveLocalAvatar(authUser.uid, localAvatarValue);
      try { window.localStorage.setItem(accountStorageKey("smartsurround_phone", authUser.uid), form.phone.trim()); } catch {}
      await reload(authUser);

      const updatedUser = {
        id: authUser.uid,
        name: authUser.displayName || name,
        email: authUser.email || email,
        photoURL: authUser.photoURL || photoURL || localAvatarValue || readLocalAvatar(authUser.uid),
      };
      onUserUpdated(updatedUser);
      setForm((prev) => ({ ...prev, currentPassword: "", newPassword: "", email: updatedUser.email, name: updatedUser.name }));
      setAvatarFile(null);
      setProfileMessage({
        type: "success",
        text: avatarStorageFallback
          ? "Profile saved. Supabase Storage is unavailable, so the avatar is stored locally."
          : "Profile updated successfully.",
      });
    } catch (err) {
      console.error("Profile update error:", err);
      const code = err?.code || "";
      const text = code === "auth/email-already-in-use"
        ? "That email address is already in use."
        : code === "auth/invalid-credential" || code === "auth/wrong-password"
          ? "Current password is incorrect."
          : code === "auth/requires-recent-login"
            ? "Please sign in again before changing sensitive account details."
            : err?.message || "Unable to update your profile.";
      setProfileMessage({ type: "error", text });
    } finally {
      setSavingProfile(false);
    }
  };

  const submitComplaint = async (event) => {
    event.preventDefault();
    const subject = complaintForm.subject.trim();
    const description = complaintForm.description.trim();
    if (!subject || !description) {
      setHelpMessage({ type: "error", text: "Subject and detailed description are required." });
      return;
    }
    if (description.length < 10) {
      setHelpMessage({ type: "error", text: "Please provide at least 10 characters of detail." });
      return;
    }
    setSubmittingComplaint(true);
    setHelpMessage({ type: "", text: "" });
    try {
      const data = new FormData();
      data.append("user_id", currentUser.id);
      data.append("user_name", currentUser.name || "User");
      data.append("email", currentUser.email || "");
      data.append("subject", subject);
      data.append("description", description);
      data.append("priority", complaintForm.priority);
      if (attachment) data.append("attachment", attachment);

      // Capture the reporting device's current GPS at submission time.
      // This is authoritative incident location data and is never typed manually.
      if (navigator.geolocation) {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              data.append("incident_latitude", String(position.coords.latitude));
              data.append("incident_longitude", String(position.coords.longitude));
              if (position.coords.accuracy != null) data.append("incident_accuracy", String(position.coords.accuracy));
              data.append("incident_gps_time", new Date(position.timestamp || Date.now()).toISOString());
              resolve();
            },
            () => resolve(),
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
          );
        });
      }

      const response = await fetch(`${BACKEND_URL}/api/complaints`, { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Unable to submit complaint.");
      const ticket = result.complaint?.ticket_id || "";
      setLastTicket(ticket);
      setComplaintForm({ subject: "", description: "", priority: "Normal" });
      clearComplaintAttachment();
      setHelpMessage({ type: "success", text: ticket ? `Complaint submitted successfully. Ticket ${ticket} has been created.` : "Complaint submitted successfully." });
      await loadComplaints();
    } catch (err) {
      const networkError = err?.name === "TypeError" && /fetch/i.test(err?.message || "");
      setHelpMessage({
        type: "error",
        text: networkError
          ? `Unable to reach the Help Desk server at ${BACKEND_DISPLAY_URL}. Start the backend and try again.`
          : (err.message || "Unable to submit complaint."),
      });
    } finally {
      setSubmittingComplaint(false);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      window.localStorage.setItem(accountStorageKey("smartsurround_account_settings", currentUser.id), JSON.stringify(settings));
      onAppearanceChange(settings.appearance);
      setHelpMessage({ type: "success", text: "Preferences saved successfully." });
      window.setTimeout(() => setHelpMessage((m) => m.text === "Preferences saved successfully." ? { type: "", text: "" } : m), 2200);
    } catch {
      setHelpMessage({ type: "error", text: "Unable to save preferences in this browser." });
    } finally {
      setSavingSettings(false);
    }
  };

  const sectionTitle = {
    profile: "Update Profile",
    help: "Help Desk",
    settings: "Settings",
  }[activeSection];

  const sectionDescription = {
    profile: "Manage your SmartSurround account information and profile picture.",
    help: "Submit a complaint, track its status, and read administrator replies.",
    settings: "Control the appearance and general dashboard preferences.",
  }[activeSection];

  const statusTone = (status) => {
    const value = String(status || "Open").toLowerCase();
    if (value === "resolved" || value === "closed") return "success";
    if (value === "in progress") return "warning";
    return "neutral";
  };

  return (
    <div className={embedded ? "account-page" : "account-panel-backdrop"} onMouseDown={(e) => { if (!embedded && e.target === e.currentTarget) onClose(); }}>
      <motion.div
        className={embedded ? "account-panel account-panel-embedded" : "account-panel"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-panel-title"
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <div className="account-panel-header">
          <div>
            <div className="small-label">{activeSection === "help" ? "HELP DESK" : "ACCOUNT MANAGEMENT"}</div>
            <h2 id="account-panel-title">{sectionTitle}</h2>
            <p>{sectionDescription}</p>
          </div>
          <button type="button" className="account-close-button" onClick={onClose} aria-label="Close account management">
            <X size={18} />
          </button>
        </div>

        <div className={`account-panel-body${activeSection === "help" ? " account-panel-body-help" : ""}${activeSection === "settings" ? " account-panel-body-settings" : ""}`}>
          {activeSection === "profile" && (
            <aside className="account-panel-nav account-panel-nav-settings-only">
              <button className={activeSection === "settings" ? "active" : ""} onClick={() => setActiveSection("settings")} type="button">
                <Settings size={17} /> Settings
              </button>
              <div className="account-panel-nav-divider" />
              <button className="account-panel-logout-link" onClick={onLogout} type="button">
                <LogOut size={17} /> Logout
              </button>
              <div className="account-panel-nav-note">Your profile, support tickets and preferences stay connected to this account.</div>
            </aside>
          )}

          <section className="account-panel-content">
            {activeSection === "profile" && (
              <form onSubmit={saveProfile} className="account-form">
                <div className="account-profile-hero">
                  <div className="account-profile-avatar-wrap">
                    {avatarPreview ? <img src={avatarPreview} alt="Profile preview" /> : <UserRound size={34} />}
                    <label className="account-avatar-upload" htmlFor="account-avatar-input" title="Change profile picture">
                      <Upload size={14} />
                    </label>
                    <input id="account-avatar-input" type="file" accept="image/*" onChange={handleAvatarChange} hidden />
                  </div>
                  <div>
                    <strong>{form.name || "Your Name"}</strong>
                    <span>{form.email || "your@email.com"}</span>
                    <small>JPG, PNG, WEBP • Max 2 MB</small>
                  </div>
                </div>

                {profileMessage.text && <div className={`account-message ${profileMessage.type}`}>{profileMessage.text}</div>}

                <div className="account-form-grid">
                  <label><span>Full Name</span><input value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Full Name" autoComplete="name" /></label>
                  <label><span>Email</span><input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} placeholder="name@example.com" autoComplete="email" /></label>
                  <label><span>Phone Number</span><input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="Phone number" autoComplete="tel" /></label>
                  <div className="account-field-spacer" />
                  <label><span>Current Password <em>required for password/email changes</em></span><input type="password" value={form.currentPassword} onChange={(e) => updateField("currentPassword", e.target.value)} placeholder="Current password" autoComplete="current-password" /></label>
                  <label><span>New Password</span><input type="password" value={form.newPassword} onChange={(e) => updateField("newPassword", e.target.value)} placeholder="Leave blank to keep current" autoComplete="new-password" /></label>
                </div>

                <div className="account-form-footer">
                  <span>Password changes use Firebase Authentication security checks.</span>
                  <div>
                    <button type="button" className="secondary-button" onClick={onClose} disabled={savingProfile}>Cancel</button>
                    <button type="submit" className="primary-button" disabled={savingProfile}>{savingProfile ? "Saving..." : "Save Changes"}</button>
                  </div>
                </div>
              </form>
            )}

            {activeSection === "help" && (
              <div className="account-help-layout">
                <form className="account-help-form" onSubmit={submitComplaint}>
                  <div className="account-section-heading"><MessageSquare size={18} /><div><strong>Submit a complaint</strong><span>Tell the administrator what needs attention.</span></div></div>
                  {helpMessage.text && <div className={`account-message ${helpMessage.type}`}>{helpMessage.text}</div>}
                  {lastTicket && <div className="account-ticket-callout"><CheckCircle2 size={17} /><div><strong>Ticket created</strong><span>{lastTicket}</span></div></div>}
                  <label><span>Subject / Complaint Title</span><input maxLength={160} value={complaintForm.subject} onChange={(e) => setComplaintForm((f) => ({ ...f, subject: e.target.value }))} placeholder="What do you need help with?" /></label>
                  <label><span>Detailed Description</span><textarea maxLength={8000} rows={6} value={complaintForm.description} onChange={(e) => setComplaintForm((f) => ({ ...f, description: e.target.value }))} placeholder="Describe the issue clearly..." /></label>
                  <div className="account-form-grid compact">
                    <label><span>Priority</span><select value={complaintForm.priority} onChange={(e) => setComplaintForm((f) => ({ ...f, priority: e.target.value }))}><option>Normal</option><option>Intermediate</option><option>Urgent</option></select></label>
                    <div className="account-attachment-field">
                      <span className="account-attachment-label">Attachment <em>optional</em></span>
                      <div className="account-file-input">
                        <input ref={complaintAttachmentInputRef} id="account-help-attachment" className="account-file-native" type="file" accept="image/*,.pdf,.txt" onChange={(e) => setAttachment(e.target.files?.[0] || null)} />
                        <button type="button" className="account-file-name" onClick={() => complaintAttachmentInputRef.current?.click()} title={attachment?.name || "Choose File"}>
                          <Paperclip size={15} /><span>{attachment?.name || "Choose File"}</span>
                        </button>
                        {attachment && <button type="button" className="account-file-remove" onClick={clearComplaintAttachment} aria-label="Remove selected attachment" title="Remove attachment"><X size={16} /></button>}
                      </div>
                    </div>
                  </div>
                  <button type="submit" className="primary-button" disabled={submittingComplaint}><Send size={15} /> {submittingComplaint ? "Submitting..." : "Submit Complaint"}</button>
                </form>

                <div className="account-complaints-list">
                  <div className="account-section-heading"><Clock3 size={18} /><div><strong>My complaints</strong><span>Track tickets submitted from this account.</span></div><button type="button" className="icon-text-button" onClick={loadComplaints} disabled={loadingComplaints}>{loadingComplaints ? "Loading..." : "Refresh"}</button></div>
                  {loadingComplaints && complaints.length === 0 ? <div className="account-empty-state">Loading your tickets...</div> : complaints.length === 0 ? <div className="account-empty-state"><HelpCircle size={28} /><strong>No complaints yet</strong><span>Your submitted tickets will appear here.</span></div> : complaints.map((ticket) => (
                    <article key={ticket.id} className={`complaint-card priority-${String(ticket.priority || "Normal").toLowerCase()}`}>
                      <div className="complaint-card-top"><div><strong>{ticket.subject}</strong><span>{ticket.ticket_id}</span></div><span className={`complaint-priority ${String(ticket.priority || "Normal").toLowerCase()}`}>{ticket.priority}</span></div>
                      <p>{ticket.description}</p>
                      <div className="complaint-card-meta"><span className={`complaint-status ${statusTone(ticket.status)}`}>{ticket.status}</span><span>{new Date(ticket.created_at).toLocaleString()}</span></div>
                      {ticket.admin_reply && <div className="complaint-reply"><strong>Admin reply</strong><p>{ticket.admin_reply}</p></div>}
                    </article>
                  ))}
                </div>
              </div>
            )}

            {activeSection === "settings" && (
              <div className="account-settings">
                {helpMessage.text && <div className={`account-message ${helpMessage.type}`}>{helpMessage.text}</div>}
                <div className="account-setting-group">
                  <div className="account-setting-heading"><strong>Appearance</strong><span>Choose how the SmartSurround dashboard looks on this device.</span></div>
                  <div className="appearance-options">
                    {[
                      ["light", "Light Mode", Sun],
                      ["dark", "Dark Mode", Moon],
                      ["system", "System Default", Monitor],
                    ].map(([value, label, Icon]) => (
                      <button
                        type="button"
                        key={value}
                        className={settings.appearance === value ? "selected" : ""}
                        onClick={() => {
                          setSettings((s) => ({ ...s, appearance: value }));
                          try {
                            const existing = readAccountSettings(currentUser.id);
                            window.localStorage.setItem(
                              accountStorageKey("smartsurround_account_settings", currentUser.id),
                              JSON.stringify({ ...existing, appearance: value })
                            );
                          } catch {}
                          onAppearanceChange(value);
                        }}
                      >
                        <Icon size={18} /><strong>{label}</strong><span>{value === "system" ? "Follow your device" : value === "dark" ? "Use a dark interface" : "Use the current light interface"}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="account-setting-group">
                  <div className="account-setting-heading"><strong>Notifications</strong><span>Control how account and support updates are handled.</span></div>
                  <label className="setting-toggle-row"><div><strong>Dashboard notifications</strong><span>Show important SmartSurround alerts and account notices.</span></div><button type="button" className={`toggle-switch ${settings.notifications ? "on" : ""}`} onClick={() => setSettings((s) => ({ ...s, notifications: !s.notifications }))}><span /></button></label>
                  <label className="setting-toggle-row"><div><strong>Email notifications</strong><span>Allow email notifications for Help Desk updates when supported.</span></div><button type="button" className={`toggle-switch ${settings.emailNotifications ? "on" : ""}`} onClick={() => setSettings((s) => ({ ...s, emailNotifications: !s.emailNotifications }))}><span /></button></label>
                </div>
                <div className="account-setting-group">
                  <div className="account-setting-heading"><strong>Language</strong><span>Choose the dashboard language when translations are available.</span></div>
                  <select className="account-language-select" value={settings.language} onChange={(e) => setSettings((s) => ({ ...s, language: e.target.value }))}><option>English</option><option>Hindi</option><option>Bengali</option></select>
                </div>
                <div className="account-form-footer"><span>Preferences are stored for this account on this browser.</span><button type="button" className="primary-button" onClick={saveSettings} disabled={savingSettings}><Save size={15} /> {savingSettings ? "Saving..." : "Save Settings"}</button></div>
              </div>
            )}
          </section>
        </div>
      </motion.div>
    </div>
  );
}


/* =========================================================
   LIVE READING PAGE (INTERNAL, POST-LOGIN)
========================================================= */


export { ProfileAvatar, AccountMenu, LogoutConfirmDialog, AccountPanel };
