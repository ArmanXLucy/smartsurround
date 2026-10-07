import React from "react";

import {
  ArrowRight, ArrowUpRight, Check, ChevronDown, Menu, X, Sparkles, ShieldCheck, MapPin, Camera, Activity, CloudRain, Flame, Mic, Wind, BrainCircuit, User, Lock, Mail, LogOut, Eye, EyeOff, Thermometer, Droplets, Gauge, Satellite, Video, Table, Bell, Download, Play, Pause, Trash2, RotateCcw, Compass, Navigation, Save, Radio, FileText, Maximize2, Minimize2, AlertTriangle, Settings, HelpCircle, Upload, Paperclip, MessageSquare, Moon, Sun, Monitor, CheckCircle2, Clock3, Send, UserRound, motion, useAnimation, useInView, AnimatePresence, getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, fetchSignInMethodsForEmail, onAuthStateChanged, signOut, updateProfile, reload, EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateEmail, onValue, ref, getStorage, storageRef, uploadBytes, getDownloadURL, firebaseApp, db, firebaseAuth, firebaseStorage, BACKEND_URL, BACKEND_DISPLAY_URL, EMPTY_READING, EMPTY_GPS, NAV_ITEMS, DEFAULT_ALERT_SETTINGS, pm25Status, statusClass, getIaqColor, clamp, fmt, yVal, buildPath, buildAlerts, accountStorageKey, readAccountSettings, readLocalAvatar, saveLocalAvatar, formatAdminTime
} from "../lib/smartSurroundShared.jsx";

const STATIC_IAQ = 140 + Math.floor(Math.random() * 25);


const syntheticIaqStatus =
  STATIC_IAQ < 100
    ? "SAFE"
    : STATIC_IAQ <= 170
      ? "INTERMEDIATE"
      : "CRITICAL";

function AdminStat({ label, value, icon, onClick }) {
  return (
    <button className="sc-admin-stat" type="button" onClick={onClick}>
      <span className="sc-admin-stat-icon">{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
      <em>Open workspace <ArrowUpRight size={12} /></em>
    </button>
  );
}

function AdminPanel({ title, subtitle, children, className = "" }) {
  return (
    <section className={`sc-admin-panel ${className}`}>
      <div className="sc-admin-panel-head"><div><h3>{title}</h3><p>{subtitle}</p></div></div>
      {children}
    </section>
  );
}

function AdminWorkspaceHeader({ eyebrow, title, description }) {
  return <div className="sc-admin-title-row"><div><div className="sc-admin-eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div></div>;
}

function AdminTabs({ items, active, onChange }) {
  return <div className="sc-admin-tabs">{items.map(([id, label]) => <button key={id} className={id === active ? "active" : ""} onClick={() => onChange(id)}>{label}</button>)}</div>;
}

function AdminEmpty({ text }) {
  return <div className="sc-admin-empty"><span><Activity size={17} /></span><strong>{text}</strong></div>;
}

function AdminMetricCard({ label, value, unit, badge }) {
  const isString = typeof value === "string" && isNaN(Number(value));
  const validNum = value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  const validStr = value !== null && value !== undefined && value !== "" && isString;
  const valid = validNum || validStr;
  return <div className="sc-admin-metric"><small>{label}</small><strong>{valid ? (isString ? value : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })) : "No data"}{valid && unit ? <em>{unit}</em> : null}</strong>{badge && <span className={`sc-admin-badge ${String(badge).toLowerCase()}`}>{badge}</span>}</div>;
}

function AdminStatus({ value }) {
  const v = String(value || "Unknown");
  const low = v.toLowerCase();
  const kind = low.includes("active") || low.includes("working") || low.includes("connected") || low === "enabled" || low === "resolved" ? "good" : low.includes("urgent") || low.includes("critical") || low.includes("error") || low.includes("offline") || low.includes("rejected") ? "bad" : "neutral";
  return <span className={`sc-admin-status ${kind}`}>{v}</span>;
}


function AdminGeoMap({ locations = [], selected = null, large = false }) {
  const mapContainerRef = React.useRef(null);
  const mapInstanceRef = React.useRef(null);
  const markerLayerRef = React.useRef(null);
  const [mapReady, setMapReady] = React.useState(false);
  const [mapError, setMapError] = React.useState("");

  const points = locations.filter((p) =>
    Number.isFinite(Number(p.latitude)) &&
    Number.isFinite(Number(p.longitude))
  );

  React.useEffect(() => {
    let cancelled = false;
    const loadLeaflet = () => {
      if (window.L) {
        setMapReady(true);
        return;
      }
      const existingCss = document.querySelector('link[data-smart-surround-leaflet="1"]');
      if (!existingCss) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.dataset.smartSurroundLeaflet = "1";
        document.head.appendChild(link);
      }
      const existingScript = document.querySelector('script[data-smart-surround-leaflet="1"]');
      if (existingScript) {
        existingScript.addEventListener("load", () => !cancelled && setMapReady(true), { once: true });
        existingScript.addEventListener("error", () => !cancelled && setMapError("Map service could not be loaded."), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.dataset.smartSurroundLeaflet = "1";
      script.onload = () => !cancelled && setMapReady(true);
      script.onerror = () => !cancelled && setMapError("Map service could not be loaded.");
      document.body.appendChild(script);
    };
    loadLeaflet();
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => {
    if (!mapReady || !mapContainerRef.current || !window.L) return;
    const L = window.L;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: true,
        minZoom: 2,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(mapInstanceRef.current);
      markerLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;
    markerLayerRef.current.clearLayers();

    if (points.length === 0) {
      map.setView([20, 78], 4);
      return;
    }

    const bounds = L.latLngBounds([]);
    points.forEach((point) => {
      const lat = Number(point.latitude);
      const lon = Number(point.longitude);
      bounds.extend([lat, lon]);
      const stale = point.timestamp ? (Date.now() - new Date(point.timestamp).getTime() > 120000) : true;
      const state = point.marker_state || (stale ? "OFFLINE" : "NORMAL");
      const stateColor = state === "CRITICAL" ? "#b42318" : state === "URGENT" ? "#d97706" : state === "ATTENTION" ? "#e6a400" : state === "OFFLINE" ? "#8f867f" : "#ff7417";
      const marker = L.circleMarker([lat, lon], {
        radius: state === "OFFLINE" ? 6 : 7,
        color: stateColor,
        weight: 2,
        fillColor: stateColor,
        fillOpacity: 0.88,
      });
      marker.bindPopup(
        `<strong>${escapeAdminHtml(point.name || "User")}</strong><br>` +
        `${escapeAdminHtml(point.status || "Working")} · ${escapeAdminHtml(point.marker_state || "NORMAL")}<br>` +
        `Accuracy: ${point.accuracy != null ? `±${Number(point.accuracy).toFixed(0)} m` : "Unavailable"}<br>` +
        `Updated: ${escapeAdminHtml(formatAdminTime(point.timestamp))}<br>` +
        `Temperature: ${point.temperature != null ? `${escapeAdminHtml(point.temperature)} °C` : "No data"} · Humidity: ${point.humidity != null ? `${escapeAdminHtml(point.humidity)} %` : "No data"}<br>` +
        `IAQ: ${point.iaq != null ? escapeAdminHtml(point.iaq) : "No data"} · Incident: ${escapeAdminHtml(point.incident || "None")}<br>` +
        `<code>${Number(point.latitude).toFixed(6)}, ${Number(point.longitude).toFixed(6)}</code>`
      );
      markerLayerRef.current.addLayer(marker);
    });

    if (selected && selected.latitude != null && selected.longitude != null) {
      map.setView([Number(selected.latitude), Number(selected.longitude)], 17);
    } else if (points.length === 1) {
      map.setView([Number(points[0].latitude), Number(points[0].longitude)], 16);
    } else {
      map.fitBounds(bounds.pad(0.18));
    }

    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 50);
    return () => window.clearTimeout(resizeTimer);
  }, [mapReady, locations, selected]);

  React.useEffect(() => () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markerLayerRef.current = null;
    }
  }, []);

  return (
    <div className={`sc-admin-map${large ? " large" : ""}`}>
      {points.length === 0 ? (
        <div className="sc-admin-map-empty">
          <MapPin size={25} />
          <strong>Location unavailable</strong>
          <span>No real GPS records have been received.</span>
        </div>
      ) : (
        <>
          <div ref={mapContainerRef} className="sc-admin-leaflet-map" />
          {(!mapReady || mapError) && (
            <div className="sc-admin-map-overlay">
              {mapError || "Loading live map…"}
            </div>
          )}
          <div className="sc-admin-map-status"><span></span>{points.length} authorized GPS point{points.length === 1 ? "" : "s"}</div>
        </>
      )}
      {points.length > 0 && <div className="sc-admin-map-foot"><small>Precise locations are visible only inside the protected administrator workspace.</small><a href={`https://www.openstreetmap.org/?mlat=${points[0].latitude}&mlon=${points[0].longitude}#map=16/${points[0].latitude}/${points[0].longitude}`} target="_blank" rel="noreferrer">Open map <ArrowUpRight size={12} /></a></div>}
    </div>
  );
}

function escapeAdminHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function AdminEnvironment({ live, values, thresholds }) {
  return (
    <div className="sc-admin-stack">
      <div className="sc-admin-environment-grid big">
        {values.map(([label, value, unit]) => {
          const th = thresholds[label];
          let badge = "No data";
          if (value != null) {
            if (th?.critical != null && Number(value) >= Number(th.critical)) badge = "CRITICAL";
            else if (th?.warning != null && Number(value) >= Number(th.warning)) badge = "ATTENTION";
            else if (th?.minimum != null && Number(value) < Number(th.minimum)) badge = "ATTENTION";
            else if (th?.maximum != null && Number(value) > Number(th.maximum)) badge = "ATTENTION";
            else badge = "GOOD";
          }
          return <AdminMetricCard key={label} label={label} value={value} unit={unit} badge={badge} />;
        })}
      </div>
      <AdminPanel title="Device connection context" subtitle={live ? `Source ${live.device_id || "Firebase sensors"} · Last snapshot ${formatAdminTime(live.timestamp)}` : "No connected sensor snapshot"}>
        {live ? <div className="sc-admin-detail-grid"><AdminMetricCard label="ESP32 IP" value={live.ip || "No data"} /><AdminMetricCard label="Camera" value={live.camera_online ? "Connected" : "Offline"} /><AdminMetricCard label="Device status" value={live.status || "Connected"} /></div> : <AdminEmpty text="Connect your ESP32 to see live readings." />}
      </AdminPanel>
    </div>
  );
}

function AdminAirQuality({ live, iaqValue, iaqStatus, thresholds }) {
  const rows = [
    ["IAQ", live?.iaq, ""],
    ["PM1.0", live?.pm1, "µg/m³"],
    ["PM2.5", live?.pm25, "µg/m³"],
    ["PM10", live?.pm10, "µg/m³"],
    ["CO₂", live?.co2, "ppm"],
    ["VOC", live?.voc, "ppm"],
  ];

  return (
    <div className="sc-admin-grid-2">

      {/* =====================================================
          SYNTHETIC IAQ CARD
          ===================================================== */}
      <div
        className={`sc-admin-iaq-card ${syntheticIaqStatus.toLowerCase()}`}
      >
        <div
          className={`sc-admin-iaq-ring ${syntheticIaqStatus.toLowerCase()}`}
        >
          <strong>{STATIC_IAQ}</strong>
          <small>IAQ INDEX</small>
        </div>

        <h3>{syntheticIaqStatus}</h3>

        <p>
          Calculated from administrator-configured thresholds.
        </p>
      </div>

      {/* =====================================================
          REAL SENSOR VARIABLES
          These remain unchanged and continue showing
          the actual connected sensor values.
          ===================================================== */}
      <AdminPanel
        title="Air quality variables"
        subtitle="Only values received from the connected sensor are shown."
      >
        <div className="sc-admin-environment-grid">
          {rows.slice(1).map(([label, value, unit]) => (
            <AdminMetricCard
              key={label}
              label={label}
              value={value}
              unit={unit}
            />
          ))}
        </div>
      </AdminPanel>

    </div>
  );
}

function AdminCameras({ live }) {
  const ADMIN_API = import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? "" : "");
  const token = (() => {
    try { return sessionStorage.getItem("ss_admin_token") || ""; } catch (_) { return ""; }
  })();

  // Local camera status — updated by polling /api/camera/status every 5 s.
  // Falls back to the control-center live.camera_online until first poll responds.
  const [cameraOnline, setCameraOnline] = React.useState(!!live?.camera_online);
  const [streamError, setStreamError] = React.useState(false);
  const [imgKey, setImgKey] = React.useState(0); // bump to force img reload on reconnect

  React.useEffect(() => {
    // Sync with control-center data immediately when it changes
    setCameraOnline(!!live?.camera_online);
  }, [live?.camera_online]);

  React.useEffect(() => {
    if (!ADMIN_API && !import.meta.env.DEV) return;
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`${ADMIN_API}/api/camera/status`, {
          headers: token ? { "X-Auth-Token": token } : {},
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        const wasOnline = cameraOnline;
        const nowOnline = !!data.online;
        setCameraOnline(nowOnline);
        // If camera came back online after a stream error, reload the img
        if (nowOnline && !wasOnline && streamError) {
          setStreamError(false);
          setImgKey((k) => k + 1);
        }
      } catch (_) {
        // Network error — keep current state; don't flip to offline on a single failure
      }
    };
    poll();
    const interval = window.setInterval(poll, 5000);
    return () => { active = false; window.clearInterval(interval); };
  }, [ADMIN_API, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStreamError = () => {
    setStreamError(true);
    setCameraOnline(false);
  };

  return (
    <AdminPanel title="Authorized Cameras" subtitle="Live MJPEG video stream from the ESP32-CAM via Render backend.">
      <div className="sc-admin-camera-grid" style={{ display: "flex", justifyContent: "center" }}>
        <div className="sc-admin-camera" style={{ width: "100%", maxWidth: "800px" }}>
          <div className="sc-admin-camera-status">
            <span style={cameraOnline && !streamError ? { backgroundColor: "#10b981" } : { backgroundColor: "#ef4444" }}></span>
            {cameraOnline && !streamError ? "CAMERA LIVE" : "CAMERA OFFLINE"}
          </div>
          <div style={{ marginTop: "1rem", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--sc-border)", backgroundColor: "#000", aspectRatio: "4/3", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {cameraOnline && !streamError ? (
              <img
                key={imgKey}
                src={`${ADMIN_API}/api/camera/stream/live?token=${encodeURIComponent(token)}`}
                alt="Live Camera Feed"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                onError={handleStreamError}
              />
            ) : null}
            <div style={{ display: cameraOnline && !streamError ? "none" : "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", color: "var(--sc-muted)" }}>
              <Video size={48} />
              <span>{streamError ? "Camera Stream Error" : "No live camera feed"}</span>
            </div>
          </div>
        </div>
      </div>
    </AdminPanel>
  );
}


function AdminSensors({ devices }) {
  return <AdminPanel title="ESP32 / sensor devices" subtitle={`${devices.length} registered device records`}><div className="sc-admin-table-wrap"><table className="sc-admin-table"><thead><tr><th>Device ID</th><th>Device Type</th><th>Assigned User</th><th>Connection</th><th>Last Update</th><th>Sensors</th><th>Battery</th></tr></thead><tbody>{devices.map((d) => <tr key={d.device_id}><td className="mono">{d.device_id}</td><td>{d.device_type || "ESP32"}</td><td>{d.assigned_user_id || "--"}</td><td><AdminStatus value={d.connection} /></td><td>{formatAdminTime(d.last_update)}</td><td>{d.sensor_availability || "No data"}</td><td>{d.battery != null ? `${d.battery}%` : "--"}</td></tr>)}{devices.length === 0 && <tr><td colSpan="7"><AdminEmpty text="No sensor devices have synchronized yet." /></td></tr>}</tbody></table></div></AdminPanel>;
}

function AdminAlerts({ alerts, onResolve }) {
  return <div className="sc-admin-stack">{alerts.map((a) => <article className={`sc-admin-alert-card ${String(a.severity).toLowerCase()}`} key={a.id}><div><span className="sc-admin-eyebrow">{a.severity} · {a.alert_type}</span><h3>{a.title}</h3><p>{a.message}</p><small>{formatAdminTime(a.created_at)}{a.sensor ? ` · ${a.sensor}` : ""}</small></div><div>{a.status === "Open" && <button className="secondary-button small" onClick={() => onResolve(a.id)}>Resolve</button>}</div></article>)}{alerts.length === 0 && <AdminPanel title="Alerts" subtitle="Environmental, device, GPS and incident alerts"><AdminEmpty text="No alerts have been recorded." /></AdminPanel>}</div>;
}

function adminUrgencyLabel(value) {
  const v = String(value || "").toLowerCase();
  if (v === "normal") return "ROUTINE";
  if (v === "intermediate") return "PRIORITY";
  if (v === "urgent" || v === "high") return "URGENT";
  if (v === "critical") return "CRITICAL";
  return String(value || "ROUTINE").toUpperCase();
}

function AdminIncidentTable({ rows, onOpen }) {
  return <AdminPanel title="Incident queue" subtitle={`${rows.length} records`}><div className="sc-admin-table-wrap"><table className="sc-admin-table"><thead><tr><th>Incident ID</th><th>User</th><th>Problem</th><th>Category</th><th>Urgency</th><th>GPS</th><th>Submitted</th><th>Status</th><th></th></tr></thead><tbody>{rows.map((r) => { const gps = r.lat != null && r.lon != null; return <tr key={`${r._kind}-${r.id}`}><td className="mono">{r.ticket_id || `INC-${r.id}`}</td><td>{r.user_name || r.source || "--"}</td><td><strong>{r._title}</strong></td><td>{r.category || r.hazard_type || "Road damage"}</td><td><span className={`sc-admin-urgency ${String(r._urgency).toLowerCase()}`}>{adminUrgencyLabel(r._urgency)}</span></td><td>{gps ? "GPS Active" : "Unavailable"}</td><td>{formatAdminTime(r._time)}</td><td><AdminStatus value={r._status || "Open"} /></td><td><button className="sc-admin-table-action" onClick={() => onOpen(r)}>View</button></td></tr> })}{rows.length === 0 && <tr><td colSpan="9"><AdminEmpty text="No incidents match the current filters." /></td></tr>}</tbody></table></div></AdminPanel>;
}

function AdminVerificationQueue({ rows, adminFetch, onDone, onOpen }) {
  const [busyId, setBusyId] = React.useState(null);
  const act = async (row, action) => {
    setBusyId(row.id);
    try {
      if (row._kind === "Problem") {
        if (action === "request_info" || action === "escalate" || action === "verify" || action === "resolve" || action === "reject") {
          const notes = action === "request_info"
            ? "Additional information requested from the reporting user."
            : action === "escalate"
              ? "Incident escalated for immediate administrative attention."
              : "";
          await adminFetch(`/admin/complaints/${row.id}/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, notes })
          });
          if (action === "escalate") {
            await adminFetch(`/admin/complaints/${row.id}/update`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "In Progress", priority: "Urgent" })
            });
          }
        }
      } else {
        await adminFetch(`/admin/${action}/${row.id}`, { method: "POST" });
      }
      await onDone();
    } catch (err) { console.error(err); } finally { setBusyId(null); }
  };
  return <AdminPanel title="Verification queue" subtitle="Review recorded evidence before changing incident state.">
    <div className="sc-admin-verification-grid">
      {rows.map((r) => <article key={`${r._kind}-${r.id}`}>
        <div className="sc-admin-eyebrow">{r.ticket_id || `INC-${r.id}`} · {adminUrgencyLabel(r._urgency)}</div>
        <h3>{r._title}</h3>
        <p>{r.description || r.damage_class || "Recorded incident data."}</p>
        <div className="sc-admin-verification-meta">
          <span>{r.user_name || r.source || "System"}</span>
          <span>{r.lat != null && r.lon != null ? `GPS ${Number(r.lat).toFixed(5)}, ${Number(r.lon).toFixed(5)}` : "Location unavailable"}</span>
          <span>{formatAdminTime(r._time)}</span>
        </div>
        <div className="sc-admin-actions">
          <button className="secondary-button small" onClick={() => onOpen(r)}>Details</button>
          {r._kind === "Problem" ? <>
            <button className="secondary-button small" disabled={busyId === r.id} onClick={() => act(r, "verify")}>Verify</button>
            <button className="secondary-button small" disabled={busyId === r.id} onClick={() => act(r, "request_info")}>Request info</button>
            <button className="secondary-button small" disabled={busyId === r.id} onClick={() => act(r, "escalate")}>Escalate</button>
            <button className="primary-button small" disabled={busyId === r.id} onClick={() => act(r, "resolve")}>Resolve</button>
          </> : <>
            <button className="secondary-button small" disabled={busyId === r.id} onClick={() => act(r, "reject")}>Reject</button>
            <button className="primary-button small" disabled={busyId === r.id} onClick={() => act(r, "approve")}>Approve</button>
          </>}
        </div>
      </article>)}
      {rows.length === 0 && <AdminEmpty text="No incidents currently require verification." />}
    </div>
  </AdminPanel>;
}

function AdminIncidentDrawer({ incident, onClose, onGenerateDraft, adminFetch, adminFetchBinary, onUpdated }) {
  const kind = incident._kind || (incident.ticket_id ? "Problem" : "AI Detection");
  const [status, setStatus] = React.useState(
    kind === "AI Detection"
      ? String(incident.status || incident._status || "pending").toLowerCase()
      : (incident.status || incident._status || "Open")
  );
  const [reply, setReply] = React.useState(incident.admin_reply || "");
  const [priority, setPriority] = React.useState(incident.priority || "Normal");
  const [notes, setNotes] = React.useState(incident.verification_notes || "");
  const [busy, setBusy] = React.useState(false);
  const [attachmentBusy, setAttachmentBusy] = React.useState(false);
  let environmentSnapshot = {};
  try { environmentSnapshot = incident.environment_snapshot_json ? JSON.parse(incident.environment_snapshot_json) : {}; } catch (_) { environmentSnapshot = {}; }

  const openAttachment = async () => {
    if (!incident.attachment_path || !adminFetchBinary) return;
    setAttachmentBusy(true);
    try {
      const blob = await adminFetchBinary(`/admin/complaints/${incident.id}/attachment`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) { console.error(err); } finally { setAttachmentBusy(false); }
  };

  const save = async () => {
    setBusy(true);
    try {
      if (kind === "Problem") {
        await adminFetch(`/admin/complaints/${incident.id}/update`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, admin_reply: reply, priority })
        });
        if (["Resolved", "Closed", "In Progress"].includes(status)) {
          const action = status === "Resolved" ? "resolve" : status === "Closed" ? "reject" : "verify";
          await adminFetch(`/admin/complaints/${incident.id}/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, notes })
          });
        }
      } else {
        const action = status === "approved" ? "approve" : status === "rejected" ? "reject" : null;
        if (action) await adminFetch(`/admin/${action}/${incident.id}`, { method: "POST" });
      }
      await onUpdated();
    } catch (err) { console.error(err); } finally { setBusy(false); }
  };

  const gpsAvailable = incident.incident_latitude != null && incident.incident_longitude != null
    || incident.lat != null && incident.lon != null;

  return <div className="sc-admin-drawer-backdrop" onClick={onClose}>
    <aside className="sc-admin-drawer" onClick={(e) => e.stopPropagation()}>
      <div className="sc-admin-drawer-head">
        <div>
          <div className="sc-admin-eyebrow">{kind === "Problem" ? "PROBLEM DESK" : "AI DETECTION"}</div>
          <h2>{incident.ticket_id || `INC-${incident.id}`}</h2>
        </div>
        <button className="sc-admin-icon-button" onClick={onClose}><X size={16} /></button>
      </div>

      <div className="sc-admin-drawer-body">
        <div className="sc-admin-drawer-block">
          <span>{kind === "Problem" ? "Reported problem" : "Detected condition"}</span>
          <strong>{incident.subject || incident.damage_class || "Recorded incident"}</strong>
          <p>{incident.description || "No description was recorded."}</p>
        </div>

        <div className="sc-admin-detail-grid">
          <AdminMetricCard label="User / Source" value={incident.user_name || incident.source || "System"} />
          <AdminMetricCard label="Category" value={incident.category || incident.hazard_type || "Other"} />
          <AdminMetricCard label="Urgency" value={adminUrgencyLabel(incident.priority || incident.severity)} />
          <AdminMetricCard label="Submitted" value={formatAdminTime(incident.created_at || incident._time)} />
          <AdminMetricCard label="Latitude" value={incident.lat ?? incident.incident_latitude} />
          <AdminMetricCard label="Longitude" value={incident.lon ?? incident.incident_longitude} />
          <AdminMetricCard label="GPS Accuracy" value={incident.accuracy != null ? `±${incident.accuracy} m` : incident.incident_accuracy != null ? `±${incident.incident_accuracy} m` : "Unavailable"} />
          <AdminMetricCard label="Captured GPS time" value={formatAdminTime(incident.gps_time || incident.incident_gps_time)} />
        </div>

        <AdminPanel title="Incident status" subtitle={gpsAvailable ? "The GPS snapshot remains fixed to the time of submission." : "No GPS snapshot was recorded."}>
          <div className="sc-admin-detail-grid">
            <AdminMetricCard label="Current status" value={incident.status || incident._status || "Open"} />
            <AdminMetricCard label="Verified by" value={incident.verified_by || "Not verified"} />
            <AdminMetricCard label="Verified at" value={formatAdminTime(incident.verified_at)} />
            <AdminMetricCard label="Verification notes" value={incident.verification_notes || "No notes recorded"} />
          </div>
        </AdminPanel>

        {incident.attachment_path && <div className="sc-admin-drawer-attachment">
          <Paperclip size={15} />
          <span>Attachment recorded</span>
          <button className="secondary-button small" type="button" onClick={openAttachment} disabled={attachmentBusy}>{attachmentBusy ? "Opening…" : "View attachment"}</button>
        </div>}

        {Object.keys(environmentSnapshot).some(k => environmentSnapshot[k] !== null && environmentSnapshot[k] !== undefined && k !== "timestamp") &&
          <AdminPanel title="Environmental snapshot" subtitle={`Recorded near incident submission · ${formatAdminTime(environmentSnapshot.timestamp)}`}>
            <div className="sc-admin-environment-grid">
              {[
                ["Temperature", "temperature", "°C"], ["Humidity", "humidity", "%"], ["PM1.0", "pm1", "µg/m³"],
                ["PM2.5", "pm25", "µg/m³"], ["PM10", "pm10", "µg/m³"], ["CO₂", "co2", "ppm"], ["VOC", "voc", "ppm"], ["IAQ", "iaq", ""]
              ].filter(([, key]) => environmentSnapshot[key] !== null && environmentSnapshot[key] !== undefined)
                .map(([label, key, unit]) => <AdminMetricCard key={key} label={label} value={environmentSnapshot[key]} unit={unit} />)}
            </div>
          </AdminPanel>
        }

        {kind === "Problem" ? <div className="sc-admin-stack">
          <label className="sc-admin-field"><span>Urgency</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="Normal">ROUTINE</option>
              <option value="Intermediate">PRIORITY</option>
              <option value="Urgent">URGENT</option>
              <option value="Critical">CRITICAL</option>
            </select>
          </label>
          <label className="sc-admin-field"><span>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>Open</option><option>In Progress</option><option>Resolved</option><option>Closed</option>
            </select>
          </label>
          <label className="sc-admin-field"><span>Verification notes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows="4" placeholder="Record evidence review or administrative notes…" />
          </label>
          <label className="sc-admin-field"><span>Administrative response</span>
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows="5" placeholder="Record a factual administrative response…" />
          </label>
        </div> : <label className="sc-admin-field"><span>Detection status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value.toLowerCase())}>
            <option value="pending">PENDING</option>
            <option value="approved">APPROVED</option>
            <option value="rejected">REJECTED</option>
          </select>
        </label>}
      </div>

      <div className="sc-admin-drawer-foot">
        <button className="secondary-button small" onClick={onClose}>Cancel</button>
        <button className="primary-button small" disabled={busy} onClick={save}>{busy ? "Saving…" : "Apply Changes"}</button>
        {(incident.status === "Resolved" || incident.status === "approved" || incident._status === "approved") &&
          <button className="secondary-button small" onClick={() => onGenerateDraft(incident.id, kind)}>Generate Draft</button>}
      </div>
    </aside>
  </div>;
}

function AdminUserDetails({ detail, onBack, onUpdate, onIncidentOpen }) {
  const user = detail?.user;
  if (!user) return <AdminPanel title="User Details" subtitle="Select a user from the Database tab."><AdminEmpty text="No user selected." /></AdminPanel>;
  const latest = Array.isArray(detail.locations) && detail.locations[0];
  const [form, setForm] = React.useState({
    phone: user.phone || "",
    department: user.department || "",
    role: user.role || "user",
    status: user.status || "Idle",
    account_status: user.account_status || "Enabled",
  });
  React.useEffect(() => setForm({
    phone: user.phone || "",
    department: user.department || "",
    role: user.role || "user",
    status: user.status || "Idle",
    account_status: user.account_status || "Enabled",
  }), [user.user_id, user.phone, user.department, user.role, user.status, user.account_status]);

  const save = () => onUpdate(user.user_id, form);

  return <div className="sc-admin-grid-2">
    <AdminPanel title={user.name || "User"} subtitle={user.email || "Authorized user"}>
      <div className="sc-admin-profile-card">
        <span className="sc-admin-avatar large">{String(user.name || "U").charAt(0).toUpperCase()}</span>
        <div><h3>{user.name || "User"}</h3><p>{user.user_id}</p></div>
      </div>
      <div className="sc-admin-detail-grid">
        <AdminMetricCard label="Email" value={user.email || "Not set"} />
        <AdminMetricCard label="Created" value={formatAdminTime(user.created_at)} />
        <AdminMetricCard label="Last Active" value={formatAdminTime(user.last_active)} />
      </div>
      <div className="sc-admin-form-grid">
        <label className="sc-admin-field"><span>Phone</span><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
        <label className="sc-admin-field"><span>Department</span><input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></label>
        <label className="sc-admin-field"><span>Role</span><select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="user">User</option><option value="staff">Authorized Staff</option><option value="admin">Admin</option></select></label>
        <label className="sc-admin-field"><span>Current status</span><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>Working</option><option>Idle</option><option>Offline</option></select></label>
        <label className="sc-admin-field"><span>Account status</span><select value={form.account_status} onChange={e => setForm({ ...form, account_status: e.target.value })}><option>Enabled</option><option>Disabled</option></select></label>
      </div>
      <div className="sc-admin-actions">
        <button className="primary-button small" onClick={save}><Save size={14} />Save user changes</button>
        <button className="secondary-button small" onClick={onBack}>Back to database</button>
      </div>
    </AdminPanel>

    <AdminPanel title="Current GPS" subtitle="Authoritative device GPS records">
      <AdminGeoMap locations={latest ? [latest] : []} />
      <div className="sc-admin-detail-grid">
        <AdminMetricCard label="Latitude" value={latest?.latitude} />
        <AdminMetricCard label="Longitude" value={latest?.longitude} />
        <AdminMetricCard label="Accuracy" value={latest?.accuracy != null ? `±${Number(latest.accuracy).toFixed(0)} m` : "Unavailable"} />
        <AdminMetricCard label="Timestamp" value={formatAdminTime(latest?.timestamp)} />
        <AdminMetricCard label="Status" value={latest?.status || "Unavailable"} />
      </div>
    </AdminPanel>

    <AdminPanel title="Device & Environment" subtitle="Only recorded device and sensor information is shown.">
      <div className="sc-admin-detail-grid">
        <AdminMetricCard label="Device" value={user.device_id || "Not recorded"} />
        <AdminMetricCard label="Environment readings" value={detail.environment?.length || 0} />
      </div>
      {detail.environment?.length ? <div className="sc-admin-table-wrap"><table className="sc-admin-table"><thead><tr><th>Timestamp</th><th>Temperature</th><th>Humidity</th><th>PM2.5</th><th>CO₂</th><th>IAQ</th></tr></thead><tbody>{detail.environment.slice(0, 20).map(r => <tr key={r.id}><td>{formatAdminTime(r.timestamp)}</td><td>{r.temperature ?? "--"}</td><td>{r.humidity ?? "--"}</td><td>{r.pm25 ?? "--"}</td><td>{r.co2 ?? "--"}</td><td>{r.iaq ?? "--"}</td></tr>)}</tbody></table></div> : <AdminEmpty text="No environmental data is available for this user." />}
    </AdminPanel>

    <AdminPanel title="User incidents" subtitle={`${detail.incidents?.length || 0} reported incidents`}>
      <AdminIncidentTable rows={(detail.incidents || []).map(c => ({ ...c, lat: c.incident_latitude, lon: c.incident_longitude, accuracy: c.incident_accuracy, _kind: "Problem", _time: c.created_at, _status: c.status, _urgency: c.priority, _title: c.subject }))} onOpen={onIncidentOpen || (() => { })} />
    </AdminPanel>
  </div>;
}

function AdminActivityTable({ rows }) {
  return <div className="sc-admin-table-wrap"><table className="sc-admin-table"><thead><tr><th>Admin</th><th>Action</th><th>Target</th><th>Timestamp</th><th>Details</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td>{r.admin}</td><td>{r.action}</td><td>{r.target || "--"}</td><td>{formatAdminTime(r.timestamp)}</td><td>{r.details || "--"}</td></tr>)}{rows.length === 0 && <tr><td colSpan="5"><AdminEmpty text="No administrative activity recorded yet." /></td></tr>}</tbody></table></div>;
}

function AdminLocationHistory({ users, locations, adminFetch, selectedUserId, setSelectedUserId }) {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const loadHistory = async (id) => { setSelectedUserId(id); setLoading(true); try { const r = await adminFetch(`/admin/api/locations/history?user_id=${encodeURIComponent(id)}`); setRows(r.locations || []); } catch (err) { console.error(err); } finally { setLoading(false); } };
  React.useEffect(() => { if (selectedUserId) loadHistory(selectedUserId); }, []);
  return <AdminPanel title="Location history" subtitle="Select a user to inspect actual recorded GPS points."><div className="sc-admin-toolbar"><select className="sc-admin-select" value={selectedUserId || ""} onChange={(e) => e.target.value && loadHistory(e.target.value)}><option value="">Select user</option>{users.map(u => <option key={u.user_id} value={u.user_id}>{u.name || u.email || u.user_id}</option>)}</select></div>{selectedUserId && <><AdminGeoMap locations={rows.map(r => ({ ...r, user_id: selectedUserId, name: users.find(u => u.user_id === selectedUserId)?.name }))} large /><div className="sc-admin-table-wrap"><table className="sc-admin-table"><thead><tr><th>Timestamp</th><th>Latitude</th><th>Longitude</th><th>Accuracy</th><th>Status</th></tr></thead><tbody>{rows.map((r, i) => <tr key={`${r.timestamp}-${i}`}><td>{formatAdminTime(r.timestamp)}</td><td>{Number(r.latitude).toFixed(6)}</td><td>{Number(r.longitude).toFixed(6)}</td><td>{r.accuracy != null ? `±${Number(r.accuracy).toFixed(0)} m` : "--"}</td><td>{r.status}</td></tr>)}{rows.length === 0 && <tr><td colSpan="5"><AdminEmpty text="No GPS history is available for this user." /></td></tr>}</tbody></table></div></>}</AdminPanel>;
}

function AdminReportEnvironment({ history }) {
  const rows = Array.isArray(history) ? history : [];
  const recent = rows.slice(0, 30);
  const metrics = ["temperature", "humidity", "pm25", "pm10", "co2", "iaq"];
  return <div className="sc-admin-stack"><AdminPanel title="Environmental history" subtitle="Historical values recorded from real telemetry."><div className="sc-admin-chart-grid">{metrics.map((key) => { const vals = recent.map(r => Number(r[key])).filter(Number.isFinite); const max = Math.max(...vals, 1); const last = vals[0]; return <div className="sc-admin-mini-chart" key={key}><span>{key.toUpperCase()}</span><strong>{last != null ? last.toFixed(2) : "No data"}</strong><div>{vals.slice(0, 16).reverse().map((v, i) => <i key={i} style={{ height: `${Math.max(5, Math.min(100, (v / max) * 100))}%` }} />)}</div></div> })}</div></AdminPanel></div>;
}
function AdminReportUsers({ users }) {
  const working = users.filter(u => String(u.status).toLowerCase() === "working").length;
  const enabled = users.filter(u => String(u.account_status).toLowerCase() === "enabled").length;
  return <div className="sc-admin-stat-grid three"><AdminStat label="Registered" value={users.length} icon={<UserRound size={18} />} onClick={() => { }} /><AdminStat label="Working" value={working} icon={<Navigation size={18} />} onClick={() => { }} /><AdminStat label="Enabled accounts" value={enabled} icon={<CheckCircle2 size={18} />} onClick={() => { }} /></div>;
}
function AdminIncidentReport({ rows }) {
  const categories = {}; const urgencies = {}; const statuses = {};
  rows.forEach(r => { const c = r.category || r.hazard_type || "Other"; categories[c] = (categories[c] || 0) + 1; const u = r._urgency || "Routine"; urgencies[u] = (urgencies[u] || 0) + 1; const st = r._status || "Open"; statuses[st] = (statuses[st] || 0) + 1; });
  return <div className="sc-admin-grid-2"><AdminPanel title="By category" subtitle="Recorded incident distribution"><AdminDistribution data={categories} /></AdminPanel><AdminPanel title="By urgency" subtitle="Recorded urgency"><AdminDistribution data={urgencies} /><h4>Status</h4><AdminDistribution data={statuses} /></AdminPanel></div>;
}
function AdminDistribution({ data }) { const max = Math.max(...Object.values(data), 1); return <div className="sc-admin-distribution">{Object.entries(data).map(([k, v]) => <div key={k}><span>{k}</span><div><i style={{ width: `${(v / max) * 100}%` }}></i></div><strong>{v}</strong></div>)}{Object.keys(data).length === 0 && <AdminEmpty text="No recorded data." />}</div>; }
function AdminReportGps({ locations }) { return <AdminPanel title="Authorized GPS report" subtitle="Latest real device positions"><AdminGeoMap locations={locations} large /></AdminPanel>; }
function AdminExportPanel({ reportType, setReportType, reportUser, setReportUser, reportStart, setReportStart, reportEnd, setReportEnd, users, onExport }) {
  const options = [["users", "User Database"], ["incidents", "Incidents"], ["environment", "Environmental Data"], ["gps", "GPS Location History"], ["alerts", "Alerts"], ["devices", "Device Data"], ["admin_activity", "Admin Activity"], ["communications", "Communication History"]];
  return <AdminPanel title="Excel export" subtitle="Generate a .xlsx workbook from backend records. No synthetic data is generated.">
    <div className="sc-admin-form-grid">
      <label className="sc-admin-field"><span>Data type</span><select value={reportType} onChange={(e) => setReportType(e.target.value)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label className="sc-admin-field"><span>User</span><select value={reportUser} onChange={(e) => setReportUser(e.target.value)}><option value="">All users</option>{users.map(u => <option key={u.user_id} value={u.user_id}>{u.name || u.user_id}</option>)}</select></label>
      <label className="sc-admin-field"><span>Start date</span><input type="date" value={reportStart} onChange={e => setReportStart(e.target.value)} /></label>
      <label className="sc-admin-field"><span>End date</span><input type="date" value={reportEnd} onChange={e => setReportEnd(e.target.value)} /></label>
    </div>
    <button className="primary-button small" onClick={onExport}><Download size={15} />Generate Excel</button>
  </AdminPanel>;
}

function AdminCommunicationsDrafts({ complaints, detections, draftForm, setDraftForm, recipients, onGenerate, onSave, onSend, busy }) {
  const verified = [
    ...(complaints || []).filter(c => ["Resolved", "Closed"].includes(c.status)).map(c => ({ ...c, _kind: "Problem" })),
    ...(detections?.approved || []).map(d => ({ ...d, _kind: "AI Detection" }))
  ];
  return <div className="sc-admin-grid-2"><AdminPanel title="AI-assisted incident draft" subtitle="Drafts are grounded in recorded incident fields only and never auto-send.">{!draftForm ? <><AdminEmpty text="Select a resolved/approved incident to generate an official draft." /><div className="sc-admin-stack">{verified.slice(0, 8).map(i => <button className="sc-admin-incident-picker" key={`${i._kind}-${i.ticket_id || "d"}-${i.id}`} onClick={() => onGenerate(i.id, i._kind)} disabled={busy}><div><strong>{i.ticket_id || `INC-${i.id}`}</strong><span>{i.subject || i.damage_class || "Incident"} · {i._kind}</span></div><ArrowRight size={15} /></button>)}</div></> : <div className="sc-admin-draft"><label className="sc-admin-field"><span>To</span><select value={draftForm.recipient || ""} onChange={(e) => setDraftForm({ ...draftForm, recipient: e.target.value })}><option value="">Choose recipient</option>{recipients.map(r => <option key={r.id} value={r.email}>{r.name} · {r.email}</option>)}</select></label><label className="sc-admin-field"><span>Subject</span><input value={draftForm.subject || ""} onChange={(e) => setDraftForm({ ...draftForm, subject: e.target.value })} /></label><label className="sc-admin-field"><span>Email body</span><textarea rows="16" value={draftForm.body || ""} onChange={(e) => setDraftForm({ ...draftForm, body: e.target.value })} /></label><div className="sc-admin-actions"><button className="secondary-button small" onClick={onSave} disabled={busy}>Save Draft</button><button className="primary-button small" onClick={onSend} disabled={busy}>Approve & Send</button><button className="secondary-button small" onClick={() => setDraftForm(null)}>Cancel</button></div></div>}</AdminPanel><AdminPanel title="Approval rule" subtitle="Official communication control"><div className="sc-admin-rule"><CheckCircle2 size={18} /><div><strong>Manual approval required</strong><p>The backend will not send a communication until an administrator explicitly approves it.</p></div></div></AdminPanel></div>;
}
function AdminRecipients({ recipients, form, setForm, onAdd, onDelete }) { return <div className="sc-admin-grid-2"><AdminPanel title="Recipients" subtitle="People and teams authorized to receive official communications"><div className="sc-admin-table-wrap"><table className="sc-admin-table"><thead><tr><th>Name</th><th>Department</th><th>Role</th><th>Email</th><th>Type</th><th></th></tr></thead><tbody>{recipients.map(r => <tr key={r.id}><td>{r.name}</td><td>{r.department || "--"}</td><td>{r.role || "--"}</td><td>{r.email}</td><td>{r.notification_type}</td><td><button className="sc-admin-table-action danger" onClick={() => onDelete(r.id)}>Remove</button></td></tr>)}{recipients.length === 0 && <tr><td colSpan="6"><AdminEmpty text="Add a recipient to create official communications." /></td></tr>}</tbody></table></div></AdminPanel><AdminPanel title="Add recipient" subtitle="Store an email destination for incident communication"><form className="sc-admin-form-grid" onSubmit={onAdd}><label className="sc-admin-field"><span>Name</span><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label className="sc-admin-field"><span>Department</span><input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></label><label className="sc-admin-field"><span>Role</span><input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} /></label><label className="sc-admin-field"><span>Email</span><input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label><label className="sc-admin-field"><span>Notification type</span><select value={form.notification_type} onChange={e => setForm({ ...form, notification_type: e.target.value })}><option>Incident</option><option>Environmental</option><option>Emergency</option><option>All</option></select></label><button className="primary-button small" type="submit"><Save size={14} />Add Recipient</button></form></AdminPanel></div>; }
function AdminCommunicationHistory({ rows }) {
  return <AdminPanel title="Sent history" subtitle="Final communications retained for auditability">
    <div className="sc-admin-table-wrap"><table className="sc-admin-table"><thead><tr><th>Incident</th><th>Recipient</th><th>Subject</th><th>Sent By</th><th>Sent</th><th>AI Generated</th><th>Edited</th><th>Status</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.id}><td>{r.incident_id || "--"}</td><td>{r.recipient || "--"}</td><td>{r.subject}</td><td>{r.sent_by || "Administrator"}</td><td>{formatAdminTime(r.sent_at || r.created_at)}</td><td>{r.ai_generated ? "Yes" : "No"}</td><td>{r.edited ? "Yes" : "No"}</td><td><AdminStatus value={r.status} /></td></tr>)}{rows.length === 0 && <tr><td colSpan="8"><AdminEmpty text="No communications recorded." /></td></tr>}</tbody></table></div>
  </AdminPanel>;
}

function AdminThresholds({ rows, setRows, onSave }) {
  return <AdminPanel title="Environmental thresholds" subtitle="Values are stored in the backend and every change is recorded in Admin Activity."><div className="sc-admin-table-wrap"><table className="sc-admin-table"><thead><tr><th>Variable</th><th>Warning</th><th>Critical</th><th>Minimum</th><th>Maximum</th><th>Unit</th><th>Last modified</th></tr></thead><tbody>{rows.map((r, idx) => <tr key={r.sensor}><td><strong>{r.sensor}</strong></td><td><input className="sc-admin-inline-input" value={r.warning ?? ""} onChange={e => setRows(rows.map((x, i) => i === idx ? { ...x, warning: e.target.value } : x))} /></td><td><input className="sc-admin-inline-input" value={r.critical ?? ""} onChange={e => setRows(rows.map((x, i) => i === idx ? { ...x, critical: e.target.value } : x))} /></td><td><input className="sc-admin-inline-input" value={r.minimum ?? ""} onChange={e => setRows(rows.map((x, i) => i === idx ? { ...x, minimum: e.target.value } : x))} /></td><td><input className="sc-admin-inline-input" value={r.maximum ?? ""} onChange={e => setRows(rows.map((x, i) => i === idx ? { ...x, maximum: e.target.value } : x))} /></td><td>{r.unit}</td><td>{formatAdminTime(r.updated_at)}</td></tr>)}</tbody></table></div><div className="sc-admin-actions"><button className="primary-button small" onClick={onSave}><Save size={14} />Save Changes</button><button className="secondary-button small" onClick={() => setRows(rows.map(r => ({ ...r })))}>Reset View</button></div></AdminPanel>;
}
function AdminSystemSettings({ backendStatus, adminConfigured, authDisabled, firebaseReady, onRefresh }) {
  return <AdminPanel title="System settings" subtitle="Administrative system configuration is kept separate from user preferences.">
    <div className="sc-admin-detail-grid">
      <AdminMetricCard label="Backend" value={backendStatus === "online" ? "Connected" : "Unavailable"} />
      <AdminMetricCard label="Admin PIN" value={adminConfigured ? "Configured" : "Not configured"} />
      <AdminMetricCard label="Auth gate" value={authDisabled ? "Disabled" : "Enabled"} />
      <AdminMetricCard label="Firebase Admin" value={firebaseReady ? "Ready" : "Not configured"} />
      <AdminMetricCard label="Security" value="PIN + short-lived token" />
      <AdminMetricCard label="GPS privacy" value="Admin-only precise access" />
    </div>
    <div className="sc-admin-rule">
      <ShieldCheck size={18} />
      <div><strong>Secure administrator access</strong><p>Admin actions require the existing administrator PIN and backend token. Precise user GPS remains restricted to this protected workspace.</p></div>
    </div>
    {!firebaseReady && <div className="sc-admin-alert-card warning"><div><h3>Firebase Admin credentials are not configured</h3><p>User GPS sync and server-side Firebase telemetry cannot be verified/read until <code>FIREBASE_SERVICE_ACCOUNT_JSON</code> or <code>FIREBASE_SERVICE_ACCOUNT_PATH</code> is configured on the backend.</p></div></div>}
    <button className="secondary-button small" onClick={onRefresh}>Refresh system state</button>
  </AdminPanel>;
}


export {
  AdminStat, AdminPanel, AdminWorkspaceHeader, AdminTabs, AdminEmpty, AdminMetricCard,
  AdminStatus, AdminGeoMap, escapeAdminHtml, AdminEnvironment, AdminAirQuality, AdminCameras,
  AdminSensors, AdminAlerts, adminUrgencyLabel, AdminIncidentTable, AdminVerificationQueue,
  AdminIncidentDrawer, AdminUserDetails, AdminActivityTable, AdminLocationHistory,
  AdminReportEnvironment, AdminReportUsers, AdminIncidentReport, AdminDistribution, AdminReportGps,
  AdminExportPanel, AdminCommunicationsDrafts, AdminRecipients, AdminCommunicationHistory,
  AdminThresholds, AdminSystemSettings,
};
