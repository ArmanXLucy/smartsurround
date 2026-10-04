import React from "react";
import {
  ArrowRight, ArrowUpRight, Check, ChevronDown, Menu, X, Sparkles, ShieldCheck, MapPin, Camera, Activity, CloudRain, Flame, Mic, Wind, BrainCircuit, User, Lock, Mail, LogOut, Eye, EyeOff, Thermometer, Droplets, Gauge, Satellite, Video, Table, Bell, Download, Play, Pause, Trash2, RotateCcw, Compass, Navigation, Save, Radio, FileText, Maximize2, Minimize2, AlertTriangle, Settings, HelpCircle, Upload, Paperclip, MessageSquare, Moon, Sun, Monitor, CheckCircle2, Clock3, Send, UserRound, motion, useAnimation, useInView, AnimatePresence, getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, fetchSignInMethodsForEmail, onAuthStateChanged, signOut, updateProfile, reload, EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateEmail, onValue, ref, getStorage, storageRef, uploadBytes, getDownloadURL, firebaseApp, db, firebaseAuth, firebaseStorage, BACKEND_URL, BACKEND_DISPLAY_URL, EMPTY_READING, EMPTY_GPS, NAV_ITEMS, DEFAULT_ALERT_SETTINGS, pm25Status, statusClass, getIaqColor, clamp, fmt, yVal, buildPath, buildAlerts, accountStorageKey, readAccountSettings, readLocalAvatar, saveLocalAvatar, formatAdminTime
} from "../lib/smartSurroundShared.jsx";

import { useLocation, useNavigate } from "../router.jsx";
import {
  AdminStat, AdminPanel, AdminWorkspaceHeader, AdminTabs, AdminEmpty, AdminMetricCard,
  AdminStatus, AdminGeoMap, AdminEnvironment, AdminAirQuality, AdminCameras, AdminSensors,
  adminUrgencyLabel,
  AdminAlerts, AdminIncidentTable, AdminVerificationQueue, AdminIncidentDrawer, AdminUserDetails,
  AdminActivityTable, AdminLocationHistory, AdminReportEnvironment, AdminReportUsers,
  AdminIncidentReport, AdminReportGps, AdminExportPanel, AdminCommunicationsDrafts,
  AdminRecipients, AdminCommunicationHistory, AdminThresholds, AdminSystemSettings,
} from "../components/AdminComponents.jsx";
import NotificationDropdown from "../components/NotificationDropdown.jsx";
import AdminNoticeManager from "../components/AdminNoticeManager.jsx";
import {
  subscribeToNotifications,
  subscribeToNotices,
  createNotification,
} from "../lib/notificationService.js";

export default function AdminPage({ onBackToSite, onBackToLogin, onLogout }) {
  const ADMIN_API = import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? "" : "");
  const [pin] = React.useState(() => {
    try { return localStorage.getItem("ss_admin_pin") || ""; } catch (_) { return ""; }
  });
  const [authenticated, setAuthenticated] = React.useState(false);
  const [backendStatus, setBackendStatus] = React.useState("checking");
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState("");
  const [toast, setToast] = React.useState("");
  const [data, setData] = React.useState(null);

  const { pathname } = useLocation();
  const navigate = useNavigate();
  const adminWorkspaceByPath = {
    "/admin": "overview",
    "/admin/overview": "overview",
    "/admin/operations": "operations",
    "/admin/users": "users",
    "/admin/monitoring": "monitoring",
    "/admin/problems": "problems",
    "/admin/reports": "reports",
    "/admin/communications": "communications",
    "/admin/system": "system",
  };
  const workspace = adminWorkspaceByPath[pathname] || "overview";

  const [tabs, setTabs] = React.useState({
    operations: "map",
    users: "database",
    monitoring: "environment",
    problems: "inbox",
    reports: "environment",
    communications: "drafts",
    system: "thresholds",
  });
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  const [selectedUserId, setSelectedUserId] = React.useState(null);
  const [userDetail, setUserDetail] = React.useState(null);
  const [selectedIncident, setSelectedIncident] = React.useState(null);
  const [notificationOpen, setNotificationOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [realtimeNotifications, setRealtimeNotifications] = React.useState([]);
  const [notices, setNotices] = React.useState([]);
  const prevCameraOnlineRef = React.useRef(null);
  const prevDeviceConnectedRef = React.useRef(null);
  const lastAdminAlertSentRef = React.useRef({});

  // Subscribe to real-time notifications & notices for Admin
  React.useEffect(() => {
    const unsubNotifs = subscribeToNotifications({
      userId: "admin",
      isAdmin: true,
      onUpdate: setRealtimeNotifications,
    });
    const unsubNotices = subscribeToNotices({
      userId: "admin",
      isAdmin: true,
      onUpdate: setNotices,
    });
    return () => {
      unsubNotifs();
      unsubNotices();
    };
  }, []);

  // Monitor camera online state transitions (ONLINE -> OFFLINE)
  React.useEffect(() => {
    if (!data?.live) return;
    const now = Date.now();
    const cameraOnline = Boolean(data.live.camera_online);
    if (prevCameraOnlineRef.current === true && !cameraOnline) {
      const lastSent = lastAdminAlertSentRef.current["cam_offline"] || 0;
      if (now - lastSent > 120000) {
        lastAdminAlertSentRef.current["cam_offline"] = now;
        createNotification({
          type: "camera",
          title: "Camera Offline",
          message: "ESP32-CAM video stream disconnected or frame reception timed out.",
          severity: "warning",
          recipientType: "admin",
          createdAt: now,
          soundType: "warning",
        });
      }
    }
    prevCameraOnlineRef.current = cameraOnline;
  }, [data?.live?.camera_online]);

  // Monitor ESP32 device online state transitions (ONLINE -> OFFLINE)
  React.useEffect(() => {
    if (!data?.devices) return;
    const now = Date.now();
    const esp32Device = data.devices.find((d) => d.device_type === "ESP32" || d.device_id?.includes("esp32") || d.device_id === "firebase-sensors");
    const isConnected = esp32Device ? String(esp32Device.connection).toUpperCase() === "CONNECTED" : false;

    if (prevDeviceConnectedRef.current === true && !isConnected) {
      const lastSent = lastAdminAlertSentRef.current["esp_offline"] || 0;
      if (now - lastSent > 120000) {
        lastAdminAlertSentRef.current["esp_offline"] = now;
        createNotification({
          type: "device",
          title: "ESP32 Device Offline",
          message: "Sensor device is no longer communicating with the control center.",
          severity: "warning",
          recipientType: "admin",
          createdAt: now,
          soundType: "warning",
        });
      }
    }
    prevDeviceConnectedRef.current = isConnected;
  }, [data?.devices]);
  const [userSearch, setUserSearch] = React.useState("");
  const [incidentFilter, setIncidentFilter] = React.useState("all");
  const [reportType, setReportType] = React.useState("incidents");
  const [reportUser, setReportUser] = React.useState("");
  const [reportStart, setReportStart] = React.useState("");
  const [reportEnd, setReportEnd] = React.useState("");

  const [thresholdDraft, setThresholdDraft] = React.useState([]);
  const [recipientForm, setRecipientForm] = React.useState({
    name: "", department: "", role: "", email: "", notification_type: "Incident"
  });
  const [draftForm, setDraftForm] = React.useState(null);
  const [draftSaving, setDraftSaving] = React.useState(false);

  const adminFetch = React.useCallback(async (path, options = {}, retry = true) => {
    const adminPin = (() => {
      try { return localStorage.getItem("ss_admin_pin") || pin || ""; } catch (_) { return pin || ""; }
    })();
    if (!adminPin.trim()) throw new Error("Admin session not found. Please use Admin Login.");

    const token = (() => {
      try { return sessionStorage.getItem("ss_admin_token") || ""; } catch (_) { return ""; }
    })();

    let response;
    try {
      response = await fetch(`${ADMIN_API}${path}`, {
        credentials: "include",
        cache: "no-store",
        ...options,
        headers: {
          ...(options.headers || {}),
          "X-Admin-Pin": adminPin.trim(),
          ...(token ? { "X-Auth-Token": token } : {}),
        },
      });
    } catch (err) {
      setBackendStatus("offline");
      throw new Error(
        `Unable to connect to SmartSurround backend${ADMIN_API ? ` at ${ADMIN_API}` : ""}.`
      );
    }

    const type = response.headers.get("content-type") || "";
    const body = type.includes("application/json")
      ? await response.json()
      : await response.text();

    if (response.status === 401 && retry) {
      await loginWithPin(adminPin);
      return adminFetch(path, options, false);
    }

    if (!response.ok || (body && body.ok === false)) {
      const message = body?.message || body || `Admin request failed (HTTP ${response.status}).`;
      throw new Error(message);
    }

    return body;
  }, [ADMIN_API, pin]);

  const adminFetchBinary = async (path, options = {}, retry = true) => {
    const adminPin = (() => {
      try { return localStorage.getItem("ss_admin_pin") || pin || ""; } catch (_) { return pin || ""; }
    })();
    if (!adminPin.trim()) throw new Error("Admin session not found. Please use Admin Login.");
    const token = (() => {
      try { return sessionStorage.getItem("ss_admin_token") || ""; } catch (_) { return ""; }
    })();
    let response;
    try {
      response = await fetch(`${ADMIN_API}${path}`, {
        credentials: "include",
        cache: "no-store",
        ...options,
        headers: {
          ...(options.headers || {}),
          "X-Admin-Pin": adminPin.trim(),
          ...(token ? { "X-Auth-Token": token } : {}),
        },
      });
    } catch (_) {
      throw new Error("Unable to connect to SmartSurround backend.");
    }
    if (response.status === 401 && retry) {
      await loginWithPin(adminPin);
      return adminFetchBinary(path, options, false);
    }
    if (!response.ok) {
      const type = response.headers.get("content-type") || "";
      const body = type.includes("application/json") ? await response.json() : await response.text();
      throw new Error(body?.message || body || `Request failed (HTTP ${response.status}).`);
    }
    return response.blob();
  };

  const loginWithPin = async (adminPin) => {
    const form = new URLSearchParams();
    form.append("pin", adminPin.trim());
    let response;
    try {
      response = await fetch(`${ADMIN_API}/login/creds`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
        cache: "no-store",
      });
    } catch (_) {
      setBackendStatus("offline");
      throw new Error("Unable to connect to the SmartSurround backend.");
    }
    const type = response.headers.get("content-type") || "";
    const body = type.includes("application/json") ? await response.json() : {};
    if (!response.ok || !body?.ok) throw new Error(body?.message || "Administrator authentication failed.");
    try {
      localStorage.setItem("ss_admin_pin", adminPin.trim());
      const token = response.headers.get("X-Set-Auth-Token");
      if (token) sessionStorage.setItem("ss_admin_token", token);
    } catch (_) {}
    setAuthenticated(true);
    setBackendStatus("online");
  };

  const load = React.useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError("");
    try {
      if (!pin) throw new Error("Admin session not found. Please use Admin Login.");
      await loginWithPin(pin);
      const result = await adminFetch("/admin/api/control-center");
      setData(result);
      setThresholdDraft(Array.isArray(result.thresholds) ? result.thresholds : []);
      setAuthenticated(true);
      setBackendStatus("online");
    } catch (err) {
      console.error("Admin control center load failed:", err);
      setAuthenticated(false);
      setError(err?.message || "Unable to load administrator control center.");
    } finally {
      if (showSpinner) setLoading(false);
      setRefreshing(false);
    }
  }, [pin, adminFetch]);

  React.useEffect(() => {
    load(true);
    const interval = window.setInterval(() => load(false), 15000);
    return () => window.clearInterval(interval);
  }, [load]);

  React.useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const setWorkspaceAndClose = (id) => {
    navigate(id === "overview" ? "/admin" : `/admin/${id}`);
    setMobileNavOpen(false);
    setNotificationOpen(false);
    setProfileOpen(false);
  };

  const refresh = async () => {
    setRefreshing(true);
    await load(false);
  };

  const resolveAlert = async (id) => {
    try {
      await adminFetch(`/admin/api/alerts/${id}/resolve`, { method: "POST" });
      setToast("Alert resolved.");
      await load(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const updateUserAccount = async (userId, payload) => {
    try {
      await adminFetch(`/admin/api/users/${encodeURIComponent(userId)}/account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setToast("User account updated.");
      const detail = await adminFetch(`/admin/api/users/${encodeURIComponent(userId)}`);
      setUserDetail(detail);
      await load(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const saveThresholds = async () => {
    try {
      const parseThreshold = (value, sensor, field) => {
        if (value === "" || value === null || value === undefined) return null;
        const number = Number(value);
        if (!Number.isFinite(number)) throw new Error(`${sensor} ${field} must be numeric or blank.`);
        return number;
      };
      const payload = thresholdDraft.map((row) => ({
        sensor: row.sensor,
        warning: parseThreshold(row.warning, row.sensor, "warning"),
        critical: parseThreshold(row.critical, row.sensor, "critical"),
        minimum: parseThreshold(row.minimum, row.sensor, "minimum"),
        maximum: parseThreshold(row.maximum, row.sensor, "maximum"),
        unit: row.unit || "",
      }));
      const result = await adminFetch("/admin/api/thresholds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thresholds: payload }),
      });
      setThresholdDraft(result.thresholds || []);
      setToast("Thresholds saved and recorded in Admin Activity.");
      await load(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const addRecipient = async (e) => {
    e.preventDefault();
    try {
      const result = await adminFetch("/admin/api/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recipientForm),
      });
      setToast("Recipient added.");
      setRecipientForm({ name: "", department: "", role: "", email: "", notification_type: "Incident" });
      setData((prev) => prev ? { ...prev, recipients: [result.recipient, ...(prev.recipients || [])] } : prev);
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteRecipient = async (id) => {
    try {
      await adminFetch(`/admin/api/recipients/${id}`, { method: "DELETE" });
      setToast("Recipient removed.");
      await load(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const generateDraft = async (incidentId, incidentKind = "") => {
    try {
      setDraftSaving(true);
      const result = await adminFetch("/admin/api/communications/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incident_id: incidentId, kind: incidentKind }),
      });
      setDraftForm(result.draft);
      setWorkspaceAndClose("communications");
      setTabs((t) => ({ ...t, communications: "drafts" }));
      setToast("Official draft generated from recorded incident data. Review before sending.");
      await load(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setDraftSaving(false);
    }
  };

  const saveDraft = async () => {
    if (!draftForm?.id) return;
    try {
      setDraftSaving(true);
      const result = await adminFetch(`/admin/api/communications/${draftForm.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: draftForm.subject,
          body: draftForm.body,
          recipient: draftForm.recipient || "",
        }),
      });
      setDraftForm(result.communication || draftForm);
      setToast("Draft saved.");
      await load(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setDraftSaving(false);
    }
  };

  const sendDraft = async () => {
    if (!draftForm?.id) return;
    if (!draftForm.recipient) {
      setError("Select a recipient before approving and sending.");
      return;
    }
    try {
      setDraftSaving(true);
      const result = await adminFetch(`/admin/api/communications/${draftForm.id}/send`, {
        method: "POST",
      });
      setToast(result?.message || "Email sent.");
      setDraftForm(null);
      await load(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setDraftSaving(false);
    }
  };

  const downloadReport = () => {
    const pinValue = (() => {
      try { return localStorage.getItem("ss_admin_pin") || pin || ""; } catch (_) { return pin || ""; }
    })();
    const token = (() => {
      try { return sessionStorage.getItem("ss_admin_token") || ""; } catch (_) { return ""; }
    })();
    const params = new URLSearchParams({ data: reportType });
    if (reportUser) params.set("user_id", reportUser);
    if (reportStart) params.set("start", reportStart);
    if (reportEnd) params.set("end", `${reportEnd}T23:59:59`);
    const url = `${ADMIN_API}/admin/api/report/export?${params.toString()}`;
    // Use fetch so the protected endpoint can send the existing auth headers.
    fetch(url, {
      credentials: "include",
      headers: {
        "X-Admin-Pin": pinValue,
        ...(token ? { "X-Auth-Token": token } : {}),
      },
    }).then(async (response) => {
      if (!response.ok) throw new Error(await response.text() || "Export failed.");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `smartsurround_${reportType}_report.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      setToast("Excel report generated.");
      void load(false);
    }).catch((err) => setError(err.message || "Excel export failed."));
  };

  const selectUser = async (userId) => {
    setSelectedUserId(userId);
    setWorkspaceAndClose("users");
    setTabs((t) => ({ ...t, users: "details" }));
    try {
      const result = await adminFetch(`/admin/api/users/${encodeURIComponent(userId)}`);
      setUserDetail(result);
    } catch (err) {
      setError(err.message);
    }
  };

  const notifications = React.useMemo(() => {
    if (!data) return [];
    const items = [];
    (data.alerts || []).filter((a) => a.status === "Open").slice(0, 8).forEach((a) => {
      items.push({
        id: `a-${a.id}`,
        type: "alert",
        title: String(a.severity || "ALERT"),
        text: a.title,
        action: () => { setWorkspaceAndClose("monitoring"); setTabs((t) => ({ ...t, monitoring: "alerts" })); },
      });
    });
    (data.complaints || []).filter((c) => ["Urgent", "Intermediate"].includes(c.priority) && ["Open","In Progress"].includes(c.status)).slice(0, 6).forEach((c) => {
      items.push({
        id: `c-${c.id}`,
        type: "incident",
        title: "NEW INCIDENT",
        text: `${c.ticket_id} · ${c.subject}`,
        action: () => { setSelectedIncident(c); setWorkspaceAndClose("problems"); },
      });
    });
    (data.devices || []).filter((d) => String(d.connection).toUpperCase() !== "CONNECTED").slice(0, 5).forEach((d) => {
      items.push({
        id: `d-${d.device_id}`,
        type: "device",
        title: "DEVICE OFFLINE",
        text: d.device_id,
        action: () => { setWorkspaceAndClose("monitoring"); setTabs((t) => ({ ...t, monitoring: "sensors" })); },
      });
    });
    (data.locations || []).filter((l) => l.timestamp && (Date.now() - new Date(l.timestamp).getTime() > 120000)).slice(0, 5).forEach((l) => {
      items.push({
        id: `g-${l.user_id}`,
        type: "gps",
        title: "GPS UPDATE LOST",
        text: l.name || l.user_id,
        action: () => { setWorkspaceAndClose("operations"); setTabs((t) => ({ ...t, operations: "users" })); },
      });
    });
    (data.communications || []).filter((c) => String(c.status).toLowerCase() === "draft").slice(0, 3).forEach((c) => {
      items.push({
        id: `m-${c.id}`,
        type: "email",
        title: "EMAIL PENDING APPROVAL",
        text: c.subject,
        action: () => { setWorkspaceAndClose("communications"); setTabs((t) => ({ ...t, communications: "drafts" })); },
      });
    });
    return items.slice(0, 12);
  }, [data]);

  if (loading && !data) {
    return (
      <div className="sc-admin-loading">
        <div className="sc-admin-loading-mark"><Activity size={22} /></div>
        <div>
          <strong>Loading SmartSurround Control Center</strong>
          <span>Authenticating administrator and loading live system data…</span>
        </div>
      </div>
    );
  }

  if (!authenticated || !data) {
    return (
      <div className="sc-admin-gate">
        <div className="sc-admin-gate-card">
          <div className="sc-admin-gate-icon"><ShieldCheck size={24} /></div>
          <div className="sc-admin-eyebrow">ADMINISTRATION</div>
          <h1>Administrator access required</h1>
          <p>{error || "The administrator session is not active."}</p>
          <div className="sc-admin-gate-status">
            <span className={backendStatus === "online" ? "online" : ""}></span>
            Backend {backendStatus === "online" ? "connected" : backendStatus === "offline" ? "offline" : "checking"}
          </div>
          <button className="primary-button" type="button" onClick={onBackToLogin || onBackToSite}>
            Return to Admin Login <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  const summary = data.summary || {};
  const locations = data.locations || [];
  const users = data.users || [];
  const complaints = data.complaints || [];
  const alerts = data.alerts || [];
  const devices = data.devices || [];
  const detections = data.detections || { pending: [], approved: [], rejected: [] };
  const incidentRows = [
    ...complaints.map((c) => ({
      ...c,
      lat: c.incident_latitude,
      lon: c.incident_longitude,
      accuracy: c.incident_accuracy,
      gps_time: c.incident_gps_time,
      verified_at: c.verified_at,
      verified_by: c.verified_by,
      verification_notes: c.verification_notes,
      _kind: "Problem",
      _time: c.created_at,
      _status: c.status,
      _urgency: c.priority,
      _title: c.subject
    })),
    ...(detections.pending || []).map((d) => ({ ...d, _kind: "AI Detection", _time: d.created_at, _status: d.status, _urgency: d.severity, _title: d.damage_class || "Road damage" })),
    ...(detections.approved || []).slice(0, 50).map((d) => ({ ...d, _kind: "AI Detection", _time: d.created_at, _status: d.status, _urgency: d.severity, _title: d.damage_class || "Road damage" })),
  ].sort((a, b) => new Date(b._time || 0) - new Date(a._time || 0));

  const filteredUsers = users.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return [u.name, u.email, u.user_id, u.department, u.device_id].some((v) => String(v || "").toLowerCase().includes(q));
  });

  const filteredIncidents = incidentRows.filter((r) => {
    if (incidentFilter === "all") return true;
    if (incidentFilter === "urgent") return ["Urgent", "CRITICAL", "Critical"].includes(String(r._urgency));
    if (incidentFilter === "active") return ["Open", "In Progress", "pending"].includes(String(r._status));
    if (incidentFilter === "history") return ["Resolved", "Closed", "rejected"].includes(String(r._status));
    return true;
  });

  const live = data.live || null;
  const environmentValues = live ? [
    ["Temperature", live.temperature, "°C"],
    ["Humidity", live.humidity, "%"],
    ["Atmospheric Pressure", live.pressure, "hPa"],
    ["PM1.0", live.pm1, "µg/m³"],
    ["PM2.5", live.pm25, "µg/m³"],
    ["PM10", live.pm10, "µg/m³"],
    ["CO₂", live.co2, "ppm"],
    ["VOC", live.voc, "ppm"],
  ] : [];
  const thresholds = Object.fromEntries((data.thresholds || []).map((t) => [t.sensor, t]));
  const iaqValue = live?.iaq;
  const iaqThreshold = thresholds.IAQ;
  const iaqStatus = iaqValue == null ? "No data" : iaqThreshold?.critical != null && iaqValue >= iaqThreshold.critical ? "CRITICAL" : iaqThreshold?.warning != null && iaqValue >= iaqThreshold.warning ? "ATTENTION" : "GOOD";

  const mapLocations = locations
    .filter((l) => Number.isFinite(Number(l.latitude)) && Number.isFinite(Number(l.longitude)))
    .map((l) => {
      const user = users.find((u) => u.user_id === l.user_id);
      const env = (data.environment_history || []).find((r) => r.user_id === l.user_id);
      const incident = complaints.find((c) => c.user_id === l.user_id && ["Open","In Progress"].includes(c.status));
      const stale = l.timestamp ? (Date.now() - new Date(l.timestamp).getTime() > 120000) : true;
      const incidentPriority = incident?.priority || "";
      const marker_state = stale ? "OFFLINE"
        : incidentPriority === "Critical" ? "CRITICAL"
        : incidentPriority === "Urgent" ? "URGENT"
        : incidentPriority === "Intermediate" ? "ATTENTION"
        : "NORMAL";
      return {
        ...l,
        name: user?.name || l.name,
        email: user?.email,
        temperature: env?.temperature,
        humidity: env?.humidity,
        iaq: env?.iaq,
        incident: incident?.subject || null,
        marker_state,
      };
    });

  return (
    <div className="sc-admin-shell">
      {mobileNavOpen && <button className="sc-admin-mobile-backdrop" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />}

      <aside className={`sc-admin-sidebar${mobileNavOpen ? " open" : ""}`}>
        <div className="sc-admin-brand">
          <div className="sc-admin-brand-mark"><img src="/favicon.svg" alt="SmartSurround logo" /></div>
          <div><strong>Smart<span>Surround</span></strong><small>ADMIN CONTROL CENTER</small></div>
        </div>

        <nav className="sc-admin-nav">
          <div className="sc-admin-nav-group">
            <button className={workspace === "overview" ? "active" : ""} onClick={() => setWorkspaceAndClose("overview")}><Activity size={16} />Dashboard</button>
          </div>
          <div className="sc-admin-nav-group">
            <button className={workspace === "operations" ? "active" : ""} onClick={() => setWorkspaceAndClose("operations")}><Navigation size={16} />Live Operations</button>
          </div>
          <div className="sc-admin-nav-group">
            <button className={workspace === "users" ? "active" : ""} onClick={() => setWorkspaceAndClose("users")}><UserRound size={16} />Users</button>
          </div>
          <div className="sc-admin-nav-group">
            <button className={workspace === "monitoring" ? "active" : ""} onClick={() => setWorkspaceAndClose("monitoring")}><Wind size={16} />Monitoring</button>
          </div>
          <div className="sc-admin-nav-group">
            <button className={workspace === "problems" ? "active" : ""} onClick={() => setWorkspaceAndClose("problems")}><AlertTriangle size={16} />Problem Desk</button>
          </div>
          <div className="sc-admin-nav-group">
            <button className={workspace === "reports" ? "active" : ""} onClick={() => setWorkspaceAndClose("reports")}><FileText size={16} />Reports</button>
          </div>
          <div className="sc-admin-nav-group">
            <button className={workspace === "communications" ? "active" : ""} onClick={() => setWorkspaceAndClose("communications")}><Mail size={16} />Communications</button>
          </div>
          <div className="sc-admin-nav-group">
            <span>SYSTEM</span>
            <button className={workspace === "system" ? "active" : ""} onClick={() => setWorkspaceAndClose("system")}><Settings size={16} />System</button>
          </div>
        </nav>

        <div className="sc-admin-sidebar-footer">
          <div>
            <span>ADMINISTRATOR</span>
            <strong>Secure Control</strong>
          </div>
          <button type="button" onClick={onLogout}><LogOut size={15} />Logout</button>
          <p>SmartSurround operations, environment and incident control.</p>
        </div>
      </aside>

      <main className="sc-admin-main">
        <header className="sc-admin-header">
          <div className="sc-admin-header-left">
            <button className="sc-admin-mobile-menu" onClick={() => setMobileNavOpen(true)}><Menu size={19} /></button>
            <div>
              <div className="sc-admin-breadcrumb">SmartSurround / Admin / {workspace === "overview" ? "Dashboard" : workspace.replace("problems","Problem Desk").replace("operations","Live Operations")}</div>
              <h2>{workspace === "overview" ? "Operations dashboard" : workspace === "problems" ? "Problem Desk" : workspace === "operations" ? "Live Operations" : workspace[0].toUpperCase() + workspace.slice(1)}</h2>
            </div>
          </div>
          <div className="sc-admin-header-right">
            <div className="sc-admin-connection"><span className={backendStatus === "online" ? "on" : ""}></span>{backendStatus === "online" ? "CONNECTED" : "CONNECTING"}</div>

            <NotificationDropdown
              notifications={realtimeNotifications}
              userId="admin"
              isAdmin={true}
              onNavigate={(ws) => {
                setWorkspaceAndClose(ws);
              }}
              onOpenNotice={() => {
                setWorkspaceAndClose("communications");
                setTabs((t) => ({ ...t, communications: "notices" }));
              }}
            />

            <div className="sc-admin-header-menu">
              <button className="sc-admin-profile-button" onClick={() => { setProfileOpen((v) => !v); setNotificationOpen(false); }}>
                <span className="sc-admin-avatar">A</span>
                <span><strong>Admin</strong><small>Administrator</small></span>
                <ChevronDown size={14} />
              </button>
              {profileOpen && (
                <div className="sc-admin-dropdown sc-admin-profile-dropdown">
                  <div className="sc-admin-profile-summary"><span className="sc-admin-avatar large">A</span><div><strong>Administrator</strong><small>SmartSurround Control Center</small></div></div>
                  <button onClick={() => setWorkspaceAndClose("overview")}><UserRound size={15} />Admin Profile</button>
                  <button onClick={() => setWorkspaceAndClose("system")}><Settings size={15} />Account / Security</button>
                  <button onClick={onLogout}><LogOut size={15} />Logout</button>
                </div>
              )}
            </div>

            <button className="secondary-button small" type="button" onClick={onBackToSite}>Back to Site</button>
            <button className="sc-admin-refresh" type="button" onClick={refresh} disabled={refreshing} title="Refresh">
              <RotateCcw size={15} className={refreshing ? "sc-admin-spin" : ""} />
            </button>
          </div>
        </header>

        <div className="sc-admin-content">
          {(error || toast) && (
            <div className={`sc-admin-banner ${error ? "error" : "success"}`}>
              <span>{error || toast}</span>
              <button onClick={() => { setError(""); setToast(""); }}><X size={14} /></button>
            </div>
          )}

          {workspace === "overview" && (
            <div className="sc-admin-workspace">
              <div className="sc-admin-title-row">
                <div><div className="sc-admin-eyebrow">OVERVIEW</div><h1>Command center</h1><p>Live system visibility across users, devices, environment and reported incidents.</p></div>
                <div className="sc-admin-live-badge"><span></span>LIVE OPERATIONS</div>
              </div>

              <div className="sc-admin-stat-grid">
                <AdminStat label="Total Users" value={summary.total_users ?? 0} icon={<UserRound size={18} />} onClick={() => setWorkspaceAndClose("users")} />
                <AdminStat label="Active Users" value={summary.active_users ?? 0} icon={<Activity size={18} />} onClick={() => setWorkspaceAndClose("users")} />
                <AdminStat label="Currently Working" value={summary.working_users ?? 0} icon={<Navigation size={18} />} onClick={() => { setWorkspaceAndClose("operations"); setTabs((t) => ({ ...t, operations: "users" })); }} />
                <AdminStat label="Active Incidents" value={summary.active_incidents ?? 0} icon={<AlertTriangle size={18} />} onClick={() => setWorkspaceAndClose("problems")} />
                <AdminStat label="Critical Incidents" value={summary.critical_incidents ?? 0} icon={<AlertTriangle size={18} />} onClick={() => { setWorkspaceAndClose("problems"); setIncidentFilter("urgent"); }} />
                <AdminStat label="Connected Devices" value={summary.connected_devices ?? 0} icon={<Radio size={18} />} onClick={() => { setWorkspaceAndClose("monitoring"); setTabs((t) => ({ ...t, monitoring: "sensors" })); }} />
                <AdminStat label="Offline Devices" value={summary.offline_devices ?? 0} icon={<CloudRain size={18} />} onClick={() => { setWorkspaceAndClose("monitoring"); setTabs((t) => ({ ...t, monitoring: "sensors" })); }} />
                <AdminStat label="Environmental Alerts" value={summary.environmental_alerts ?? 0} icon={<Bell size={18} />} onClick={() => { setWorkspaceAndClose("monitoring"); setTabs((t) => ({ ...t, monitoring: "alerts" })); }} />
              </div>

              <div className="sc-admin-grid-2">
                <AdminPanel title="Live GPS Map" subtitle="Authorized users · device-reported coordinates">
                  <AdminGeoMap locations={mapLocations} selected={selectedIncident?.latitude && selectedIncident?.longitude ? selectedIncident : null} />
                </AdminPanel>
                <AdminPanel title="Recent Incidents" subtitle="User reports and AI detections">
                  <div className="sc-admin-list">
                    {incidentRows.slice(0, 7).map((row) => (
                      <button key={`${row._kind}-${row.id}`} className="sc-admin-list-row" onClick={() => { setSelectedIncident(row); setWorkspaceAndClose("problems"); }}>
                        <span className={`sc-admin-severity ${String(row._urgency || "").toLowerCase().replace(/\s+/g,"-")}`}>{adminUrgencyLabel(row._urgency)}</span>
                        <div><strong>{row._title}</strong><small>{row.ticket_id || `INC-${row.id}`} · {row.user_name || row.source || "System"}</small></div>
                        <span className="sc-admin-row-time">{formatAdminTime(row._time)}</span>
                      </button>
                    ))}
                    {incidentRows.length === 0 && <AdminEmpty text="No incidents have been recorded." />}
                  </div>
                </AdminPanel>
              </div>

              <div className="sc-admin-grid-2">
                <AdminPanel title="Environmental Snapshot" subtitle={live ? "Current Firebase / sensor telemetry" : "No current telemetry available"}>
                  <div className="sc-admin-environment-grid">
                    {environmentValues.map(([label, value, unit]) => <AdminMetricCard key={label} label={label} value={value} unit={unit} />)}
                    <AdminMetricCard label="IAQ" value={live?.iaq} unit="" badge={iaqStatus} />
                  </div>
                </AdminPanel>
                <AdminPanel title="Recent Alerts" subtitle="Open environmental, device and system alerts">
                  <div className="sc-admin-list">
                    {alerts.filter((a) => a.status === "Open").slice(0, 7).map((a) => (
                      <button key={a.id} className="sc-admin-list-row alert" onClick={() => { setWorkspaceAndClose("monitoring"); setTabs((t) => ({ ...t, monitoring: "alerts" })); }}>
                        <span className={`sc-admin-alert-marker ${String(a.severity).toLowerCase()}`}></span>
                        <div><strong>{a.title}</strong><small>{a.message}</small></div>
                        <span className="sc-admin-row-time">{formatAdminTime(a.created_at)}</span>
                      </button>
                    ))}
                    {alerts.filter((a) => a.status === "Open").length === 0 && <AdminEmpty text="No active alerts." />}
                  </div>
                </AdminPanel>
              </div>
            </div>
          )}

          {workspace === "operations" && (
            <div className="sc-admin-workspace">
              <AdminWorkspaceHeader eyebrow="OPERATIONS" title="Live Operations" description="Real-time user movement, device context and historical GPS evidence." />
              <AdminTabs items={[["map","LIVE MAP"],["users","LIVE USERS"],["history","LOCATION HISTORY"]]} active={tabs.operations} onChange={(v) => setTabs((t) => ({ ...t, operations: v }))} />
              {tabs.operations === "map" && <AdminPanel title="Live GPS Map" subtitle="Positions are recorded from authorized users' device GPS. No coordinates are invented."><AdminGeoMap locations={mapLocations} large /></AdminPanel>}
              {tabs.operations === "users" && <AdminPanel title="Live users" subtitle="Latest authorized device status and GPS synchronization">
                <div className="sc-admin-table-wrap"><table className="sc-admin-table"><thead><tr><th>Name</th><th>Status</th><th>GPS</th><th>Accuracy</th><th>Last update</th><th>Location</th><th>Incident</th></tr></thead><tbody>
                  {locations.map((u) => <tr key={u.user_id}>
                    <td><button className="sc-admin-table-link" onClick={() => selectUser(u.user_id)}><strong>{u.name || "User"}</strong><small>{u.email}</small></button></td>
                    <td><AdminStatus value={u.status || "Idle"} /></td>
                    <td><AdminStatus value={u.latitude != null && u.longitude != null ? ((u.timestamp && Date.now()-new Date(u.timestamp).getTime()>120000) ? "GPS Stale" : "GPS Active") : "Unavailable"} /></td>
                    <td>{u.accuracy != null ? `±${Number(u.accuracy).toFixed(0)} m` : "--"}</td>
                    <td>{formatAdminTime(u.timestamp)}</td>
                    <td>{u.latitude != null ? `${Number(u.latitude).toFixed(6)}, ${Number(u.longitude).toFixed(6)}` : "Location unavailable"}</td>
                    <td>{complaints.some((c) => c.user_id === u.user_id && ["Open","In Progress"].includes(c.status)) ? "Active" : "None"}</td>
                  </tr>)}
                  {locations.length === 0 && <tr><td colSpan="7"><AdminEmpty text="No live user GPS records are available yet." /></td></tr>}
                </tbody></table></div>
              </AdminPanel>}
              {tabs.operations === "history" && <AdminLocationHistory users={users} locations={mapLocations} adminFetch={adminFetch} selectedUserId={selectedUserId} setSelectedUserId={setSelectedUserId} />}
            </div>
          )}

          {workspace === "users" && (
            <div className="sc-admin-workspace">
              <AdminWorkspaceHeader eyebrow="USERS" title="User management" description="Authorized-user database, device context, GPS history and activity." />
              <AdminTabs items={[["database","DATABASE"],["details","USER DETAILS"],["activity","ACTIVITY"]]} active={tabs.users} onChange={(v) => setTabs((t) => ({ ...t, users: v }))} />
              {tabs.users === "database" && (
                <AdminPanel title="User Database" subtitle={`${filteredUsers.length} synchronized users`}>
                  <div className="sc-admin-toolbar"><div className="sc-admin-search"><Activity size={15} /><input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search by name, email, user ID or device" /></div><button className="secondary-button small" onClick={downloadReport}>Export</button></div>
                  <div className="sc-admin-table-wrap"><table className="sc-admin-table"><thead><tr><th>Profile</th><th>User ID</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th><th>GPS</th><th>Last Active</th><th>Device</th><th>Account</th><th>Actions</th></tr></thead><tbody>
                    {filteredUsers.map((u) => {
                      const loc = locations.find((l) => l.user_id === u.user_id);
                      return <tr key={u.user_id}><td><div className="sc-admin-user-cell"><span className="sc-admin-avatar">{String(u.name || "U").trim().charAt(0).toUpperCase()}</span><strong>{u.name || "User"}</strong></div></td><td className="mono">{u.user_id}</td><td>{u.email || "--"}</td><td>{u.role || "user"}</td><td>{u.department || "--"}</td><td><AdminStatus value={u.status || "Idle"} /></td><td><AdminStatus value={loc?.latitude != null ? "Active" : "Unavailable"} /></td><td>{formatAdminTime(u.last_active)}</td><td>{u.device_id || "--"}</td><td><AdminStatus value={u.account_status || "Enabled"} /></td><td><button className="sc-admin-table-action" onClick={() => selectUser(u.user_id)}>View</button></td></tr>;
                    })}
                    {filteredUsers.length === 0 && <tr><td colSpan="11"><AdminEmpty text="No synchronized users. A verified Firebase user will appear after opening the dashboard and granting location access." /></td></tr>}
                  </tbody></table></div>
                </AdminPanel>
              )}
              {tabs.users === "details" && (
                <AdminUserDetails detail={userDetail} onBack={() => setTabs((t) => ({ ...t, users: "database" }))} onUpdate={updateUserAccount} onIncidentOpen={(row)=>setSelectedIncident(row)} />
              )}
              {tabs.users === "activity" && <AdminPanel title="User and system activity" subtitle="Administrative activity is recorded by the backend."><AdminActivityTable rows={data.activity || []} /></AdminPanel>}
            </div>
          )}

          {workspace === "monitoring" && (
            <div className="sc-admin-workspace">
              <AdminWorkspaceHeader eyebrow="MONITORING" title="Environmental & device monitoring" description="Live sensor values, air quality, cameras, connected ESP32 devices and alerts." />
              <AdminTabs items={[["environment","ENVIRONMENT"],["air","AIR QUALITY"],["cameras","CAMERAS"],["sensors","SENSORS"],["alerts","ALERTS"]]} active={tabs.monitoring} onChange={(v) => setTabs((t) => ({ ...t, monitoring: v }))} />
              {tabs.monitoring === "environment" && <AdminEnvironment live={live} values={environmentValues} thresholds={thresholds} />}
              {tabs.monitoring === "air" && <AdminAirQuality live={live} iaqValue={iaqValue} iaqStatus={iaqStatus} thresholds={thresholds} />}
              {tabs.monitoring === "cameras" && <AdminCameras live={live} />}
              {tabs.monitoring === "sensors" && <AdminSensors devices={devices} />}
              {tabs.monitoring === "alerts" && <AdminAlerts alerts={alerts} onResolve={resolveAlert} />}
            </div>
          )}

          {workspace === "problems" && (
            <div className="sc-admin-workspace">
              <AdminWorkspaceHeader eyebrow="INCIDENTS" title="Problem Desk" description="Incoming reports, verification, active incidents and verified history." />
              <AdminTabs items={[["inbox","INBOX"],["verification","VERIFICATION"],["active","ACTIVE"],["history","HISTORY"]]} active={tabs.problems} onChange={(v) => setTabs((t) => ({ ...t, problems: v }))} />
              <div className="sc-admin-toolbar sc-admin-problem-toolbar">
                <div className="sc-admin-filter-row">
                  {["all","urgent","active","history"].map((key) => <button key={key} className={incidentFilter === key ? "active" : ""} onClick={() => setIncidentFilter(key)}>{key === "all" ? "All" : key[0].toUpperCase()+key.slice(1)}</button>)}
                </div>
              </div>
              {(tabs.problems === "inbox" || tabs.problems === "active" || tabs.problems === "history") && (
                <AdminIncidentTable rows={filteredIncidents.filter((r) => tabs.problems === "active" ? ["Open","In Progress","pending"].includes(String(r._status)) : tabs.problems === "history" ? ["Resolved","Closed","rejected","approved"].includes(String(r._status)) : true)} onOpen={(row) => setSelectedIncident(row)} />
              )}
              {tabs.problems === "verification" && (
                <AdminVerificationQueue
                  rows={filteredIncidents.filter((r) => ["Open","In Progress","pending"].includes(String(r._status)))}
                  adminFetch={adminFetch}
                  onDone={async () => { await load(false); }}
                  onOpen={(row) => setSelectedIncident(row)}
                />
              )}
            </div>
          )}

          {workspace === "reports" && (
            <div className="sc-admin-workspace">
              <AdminWorkspaceHeader eyebrow="REPORTS" title="Reports & exports" description="Historical environmental, user, incident, GPS, device and administrative reporting." />
              <AdminTabs items={[["environment","ENVIRONMENT"],["users","USERS"],["incidents","INCIDENTS"],["gps","GPS"],["devices","DEVICES"],["exports","EXPORTS"]]} active={tabs.reports} onChange={(v) => setTabs((t) => ({ ...t, reports: v }))} />
              {tabs.reports === "environment" && <AdminReportEnvironment history={data.environment_history || []} />}
              {tabs.reports === "users" && <AdminReportUsers users={users} />}
              {tabs.reports === "incidents" && <AdminIncidentReport rows={incidentRows} />}
              {tabs.reports === "gps" && <AdminReportGps locations={mapLocations} />}
              {tabs.reports === "devices" && <AdminSensors devices={devices} />}
              {tabs.reports === "exports" && <AdminExportPanel reportType={reportType} setReportType={setReportType} reportUser={reportUser} setReportUser={setReportUser} reportStart={reportStart} setReportStart={setReportStart} reportEnd={reportEnd} setReportEnd={setReportEnd} users={users} onExport={downloadReport} />}
            </div>
          )}

          {workspace === "communications" && (
            <div className="sc-admin-workspace">
              <AdminWorkspaceHeader eyebrow="COMMUNICATIONS" title="Official communications & notices" description="Create grounded drafts, notice board announcements, and maintain sent history." />
              <AdminTabs items={[
                ["notices", "NOTICE BOARD"],
                ["drafts", "AI DRAFTS"],
                ["recipients", "RECIPIENTS"],
                ["history", "SENT HISTORY"]
              ]} active={tabs.communications} onChange={(v) => setTabs((t) => ({ ...t, communications: v }))} />
              {tabs.communications === "notices" && (
                <AdminNoticeManager notices={notices} users={data.users || []} />
              )}
              {tabs.communications === "drafts" && <AdminCommunicationsDrafts complaints={complaints} detections={detections} draftForm={draftForm} setDraftForm={setDraftForm} recipients={data.recipients || []} onGenerate={generateDraft} onSave={saveDraft} onSend={sendDraft} busy={draftSaving} />}
              {tabs.communications === "recipients" && <AdminRecipients recipients={data.recipients || []} form={recipientForm} setForm={setRecipientForm} onAdd={addRecipient} onDelete={deleteRecipient} />}
              {tabs.communications === "history" && <AdminCommunicationHistory rows={data.communications || []} />}
            </div>
          )}

          {workspace === "system" && (
            <div className="sc-admin-workspace">
              <AdminWorkspaceHeader eyebrow="SYSTEM" title="System administration" description="Threshold configuration, automatic alert logic, audit trail and system settings." />
              <AdminTabs items={[["thresholds","THRESHOLDS"],["activity","ADMIN ACTIVITY"],["settings","SETTINGS"]]} active={tabs.system} onChange={(v) => setTabs((t) => ({ ...t, system: v }))} />
              {tabs.system === "thresholds" && <AdminThresholds rows={thresholdDraft} setRows={setThresholdDraft} onSave={saveThresholds} />}
              {tabs.system === "activity" && <AdminPanel title="Admin Activity" subtitle="Sensitive administrator actions are recorded with time and target."><AdminActivityTable rows={data.activity || []} /></AdminPanel>}
              {tabs.system === "settings" && <AdminSystemSettings backendStatus={backendStatus} adminConfigured={data.system?.admin_configured} authDisabled={data.system?.auth_disabled} firebaseReady={data.system?.firebase_admin_ready} onRefresh={refresh} />}
            </div>
          )}
        </div>
      </main>

      {selectedIncident && (
        <AdminIncidentDrawer
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onGenerateDraft={generateDraft}
          adminFetch={adminFetch}
          adminFetchBinary={adminFetchBinary}
          onUpdated={async () => { setSelectedIncident(null); await load(false); }}
        />
      )}
    </div>
  );
}
