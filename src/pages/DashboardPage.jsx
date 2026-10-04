import React from "react";
import {
  ArrowRight, ArrowUpRight, Check, ChevronDown, Menu, X, Sparkles, ShieldCheck, MapPin, Camera, Activity, CloudRain, Flame, Mic, Wind, BrainCircuit, User, Lock, Mail, LogOut, Eye, EyeOff, Thermometer, Droplets, Gauge, Satellite, Video, Table, Bell, Download, Play, Pause, Trash2, RotateCcw, Compass, Navigation, Save, Radio, FileText, Maximize2, Minimize2, AlertTriangle, Settings, HelpCircle, Upload, Paperclip, MessageSquare, Moon, Sun, Monitor, CheckCircle2, Clock3, Send, UserRound, motion, useAnimation, useInView, AnimatePresence, getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, fetchSignInMethodsForEmail, onAuthStateChanged, signOut, updateProfile, reload, EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateEmail, onValue, ref, getStorage, storageRef, uploadBytes, getDownloadURL, firebaseApp, db, firebaseAuth, firebaseStorage, BACKEND_URL, BACKEND_DISPLAY_URL, EMPTY_READING, EMPTY_GPS, NAV_ITEMS, DEFAULT_ALERT_SETTINGS, hasSensorReadings, pm25Status, statusClass, getIaqColor, clamp, fmt, yVal, buildPath, buildAlerts, accountStorageKey, readAccountSettings, readLocalAvatar, saveLocalAvatar, formatAdminTime
} from "../lib/smartSurroundShared.jsx";

import { useLocation, useNavigate } from "../router.jsx";
import { ProfileAvatar, AccountMenu, LogoutConfirmDialog, AccountPanel } from "../components/AccountComponents.jsx";
import StatTile from "../components/StatTile.jsx";
import OverviewPage from "./OverviewPage.jsx";
import AirQualityPage from "./AirQualityPage.jsx";
import EnvironmentPage from "./EnvironmentPage.jsx";
import CameraPage from "./CameraPage.jsx";
import LocationPage from "./LocationPage.jsx";
import AlertsPage from "./AlertsPage.jsx";
import NotificationDropdown from "../components/NotificationDropdown.jsx";
import {
  subscribeToNotifications,
  subscribeToNotices,
  createNotification,
  getClearedAlertsState,
  saveClearedAlertsState,
} from "../lib/notificationService.js";

export default function LiveReadingPage({ currentUser, onLogout, onBackToSite, onUserUpdated }) {

  const { pathname } = useLocation();
  const navigate = useNavigate();
  const dashboardPageByPath = {
    "/dashboard": "overview",
    "/dashboard/overview": "overview",
    "/dashboard/air-quality": "airquality",
    "/dashboard/environment": "environment",
    "/dashboard/camera": "camera",
    "/dashboard/location": "location",
    "/dashboard/alerts": "alerts",
    "/profile": "account-profile",
    "/help": "account-help",
    "/settings": "account-settings",
  };
  const activePage = dashboardPageByPath[pathname] || "overview";

  React.useEffect(() => {
    if (pathname === "/dashboard/data-log") navigate("/help", { replace: true });
    if (pathname === "/dashboard/safety") navigate("/dashboard/overview", { replace: true });
  }, [navigate, pathname]);

  const dashboardPathFor = (page) => {
    if (page === "overview") return "/dashboard/overview";
    if (page === "airquality") return "/dashboard/air-quality";
    if (page === "environment") return "/dashboard/environment";
    if (page === "camera") return "/dashboard/camera";
    if (page === "location") return "/dashboard/location";
    if (page === "alerts") return "/dashboard/alerts";
    if (page === "account-profile") return "/profile";
    if (page === "account-help") return "/help";
    if (page === "account-settings") return "/settings";
    return "/dashboard/overview";
  };

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = React.useState(false);
  const [accountPanelSection, setAccountPanelSection] = React.useState("profile");
  const [accountPanelOpen, setAccountPanelOpen] = React.useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [appearance, setAppearance] = React.useState(() => readAccountSettings(currentUser?.id).appearance);
  const [systemDark, setSystemDark] = React.useState(() => (
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false
  ));
  const accountAreaRef = React.useRef(null);

  React.useEffect(() => {
    setAppearance(readAccountSettings(currentUser?.id).appearance);
  }, [currentUser?.id]);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = (event) => setSystemDark(event.matches);
    setSystemDark(mediaQuery.matches);
    mediaQuery.addEventListener?.("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener?.("change", handleSystemThemeChange);
  }, []);

  React.useEffect(() => {
    const handleOutside = (event) => {
      if (accountAreaRef.current && !accountAreaRef.current.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const isDarkTheme = appearance === "dark" || (appearance === "system" && systemDark);
  const isAccountPage = activePage.startsWith("account-");
  const accountSectionFromRoute = isAccountPage ? activePage.replace("account-", "") : accountPanelSection;

  const openAccountSection = (section) => {
    setAccountMenuOpen(false);
    setAccountPanelSection(section);
    setAccountPanelOpen(true);
    navigate(dashboardPathFor(`account-${section}`));
    setMenuOpen(false);
  };

  const confirmLogout = async () => {
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
      setLogoutConfirmOpen(false);
    }
  };

  // ESP32 connection: enter the board's local IP (e.g. 192.168.1.42) to pull
  // real sensor data instead of the simulated demo values.
  const [esp32Ip, setEsp32Ip] = React.useState(
    () => (typeof window !== "undefined" && window.localStorage.getItem("esp32Ip")) || ""
  );
  const [esp32Input, setEsp32Input] = React.useState(esp32Ip);
  const [connectionStatus, setConnectionStatus] = React.useState("disconnected");
  // "disconnected" | "connecting" | "connected" | "error"

  const lastTelemetryTimeRef = React.useRef(0);
  const lastHeartbeatValueRef = React.useRef(null);
  const isInitialFirebaseSnapshotRef = React.useRef(true);

  const [latest, setLatest] = React.useState(EMPTY_READING);
  const [gps, setGps] = React.useState(EMPTY_GPS);
  const [cameraOnline, setCameraOnline] = React.useState(false);
  const [camIp, setCamIp] = React.useState(null);
  const [pmHistory, setPmHistory] = React.useState([]);

  const [logRows, setLogRows] = React.useState([]);
  const [loggerRunning, setLoggerRunning] = React.useState(false);
  const [loggerInterval, setLoggerInterval] = React.useState(5000);
  const [exportName, setExportName] = React.useState("air_quality_log");

  // Admin System -> Thresholds is the single source of truth for alerts
  const [alertSettings, setAlertSettings] = React.useState(DEFAULT_ALERT_SETTINGS);

  // Sync configured thresholds from backend
  React.useEffect(() => {
    if (!currentUser?.id) return;
    let cancelled = false;

    const fetchThresholds = async () => {
      const authUser = firebaseAuth.currentUser;
      if (!authUser) return;
      try {
        const token = await authUser.getIdToken();
        const res = await fetch(`${BACKEND_URL}/api/user/thresholds`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.ok && Array.isArray(data.thresholds)) {
            setAlertSettings(data.thresholds);
          }
        }
      } catch (err) {
        console.debug("Thresholds sync unavailable:", err);
      }
    };

    fetchThresholds();
    const interval = window.setInterval(fetchThresholds, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [currentUser?.id]);

  const latestRef = React.useRef(latest);
  React.useEffect(() => {
    latestRef.current = latest;
  }, [latest]);

  const [notifications, setNotifications] = React.useState([]);
  const [notices, setNotices] = React.useState([]);
  const [clearedAlerts, setClearedAlerts] = React.useState(false);
  const lastAlertsSentRef = React.useRef({});
  const prevConnectionStatusRef = React.useRef(connectionStatus);

  // Subscribe to real-time notifications for current user
  React.useEffect(() => {
    if (!currentUser?.id) return;
    const unsub = subscribeToNotifications({
      userId: currentUser.id,
      isAdmin: false,
      onUpdate: setNotifications,
    });
    return () => unsub();
  }, [currentUser?.id]);

  // Subscribe to real-time notices for current user
  React.useEffect(() => {
    if (!currentUser?.id) return;
    const unsub = subscribeToNotices({
      userId: currentUser.id,
      isAdmin: false,
      onUpdate: setNotices,
    });
    return () => unsub();
  }, [currentUser?.id]);

  // Handle Clearing alerts from overview
  const handleClearAlerts = () => {
    const titles = alerts.map((a) => a.title);
    saveClearedAlertsState(currentUser?.id, titles);
    setClearedAlerts(true);
  };

  // Share the real device GPS with the admin control center. This uses the
  // existing Firebase Auth identity and never asks the user to type a location.
  React.useEffect(() => {
    if (!currentUser?.id || typeof navigator === "undefined" || !navigator.geolocation) return;

    let stopped = false;

    const api = (path) => `${BACKEND_URL}${path}`;

    const getUserToken = async () => {
      const authUser = firebaseAuth.currentUser;
      if (!authUser) return null;
      try {
        return await authUser.getIdToken();
      } catch (err) {
        console.error("Unable to obtain Firebase ID token for location sync:", err);
        return null;
      }
    };

    const syncUser = async () => {
      const token = await getUserToken();
      if (!token || stopped) return;
      try {
        await fetch(api("/api/user/sync"), {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            user_id: currentUser.id,
            name: currentUser.name || "",
            email: currentUser.email || "",
            status: "Working",
          }),
          cache: "no-store",
        });
      } catch (err) {
        console.debug("User sync unavailable:", err);
      }
    };

    const sendLocation = async (position) => {
      if (stopped) return;
      const token = await getUserToken();
      if (!token || stopped) return;
      try {
        const response = await fetch(api("/api/user/location"), {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            user_id: currentUser.id,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date(position.timestamp || Date.now()).toISOString(),
            status: "working",
          }),
          cache: "no-store",
        });
        if (!response.ok) {
          console.debug("GPS sync rejected:", response.status);
        }
      } catch (err) {
        console.debug("GPS sync unavailable:", err);
      }
    };

    syncUser();

    const watchId = navigator.geolocation.watchPosition(
      sendLocation,
      (error) => {
        if (error?.code === 1) {
          console.info("Location permission denied; SmartSurround will not track browser GPS.");
        } else {
          console.debug("Location update unavailable:", error?.message);
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      }
    );

    const heartbeat = window.setInterval(() => {
      syncUser();
    }, 60000);

    return () => {
      stopped = true;
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(heartbeat);
    };
  }, [currentUser?.id, currentUser?.name, currentUser?.email]);

  // Persist real sensor readings for the admin reports workspace. Only submitted
  // when ESP32 is actively connected with fresh telemetry.
  React.useEffect(() => {
    if (!currentUser?.id || typeof window === "undefined") return;
    const interval = window.setInterval(async () => {
      if (connectionStatus !== "connected") return;
      const reading = latestRef.current;
      if (!reading || !hasSensorReadings(reading)) return;
      const authUser = firebaseAuth.currentUser;
      if (!authUser) return;
      try {
        const token = await authUser.getIdToken();
        await fetch(`${BACKEND_URL}/api/user/environment`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...reading,
            is_connected: true,
            device_id: reading.ip || "firebase-sensors",
            timestamp: new Date().toISOString(),
          }),
          cache: "no-store",
        });
      } catch (err) {
        console.debug("Environment sync unavailable:", err);
      }
    }, 15000);
    return () => window.clearInterval(interval);
  }, [currentUser?.id, connectionStatus]);

  function handleConnect(e) {
    e.preventDefault();

    const trimmed = esp32Input.trim();

    setEsp32Ip(trimmed);

    if (typeof window !== "undefined") {
      if (trimmed) {
        window.localStorage.setItem("esp32Ip", trimmed);
      } else {
        window.localStorage.removeItem("esp32Ip");
      }
    }
  }

  function handleDisconnect() {
    setEsp32Ip("");
    setEsp32Input("");

    if (typeof window !== "undefined") {
      window.localStorage.removeItem("esp32Ip");
    }
  }

  // =========================================================
  // FIREBASE REALTIME SENSOR DATA
  // ESP32 → Firebase Realtime Database → React dashboard
  // Heartbeat tracking: Initial snapshot on load/refresh does
  // NOT mark connected. Only a CHANGED/FRESH heartbeat marks connected.
  // =========================================================
  React.useEffect(() => {
    const databaseRef = ref(db);

    const unsubscribe = onValue(
      databaseRef,
      (snapshot) => {
        const root = snapshot.val();

        if (!root || typeof root !== "object") {
          setLatest(EMPTY_READING);
          setGps(EMPTY_GPS);
          setCameraOnline(false);
          setCamIp(null);
          setConnectionStatus("disconnected");
          return;
        }

        const source =
          root.sensors && typeof root.sensors === "object"
            ? root.sensors
            : root;

        // Some ESP32 payloads do not include updatedAt/timestamp. Use the
        // sensor payload as a fallback heartbeat so threshold notifications
        // still work with those devices.
        const heartbeat = source.updatedAt ?? source.timestamp ?? root.updatedAt ?? JSON.stringify({
          pm1: source.pm1,
          pm25: source.pm25,
          pm10: source.pm10,
          temperature: source.temperature,
          humidity: source.humidity,
          co2: source.co2 ?? source.co2Equivalent,
          voc: source.voc ?? source.vocEquivalent,
          iaq: source.iaq ?? source.iaqScore ?? source.airQualityIndex ?? source.IAQ,
        });

        // Process the first real Firebase snapshot immediately. This lets the
        // user section evaluate thresholds as soon as it opens.
        const isInitialSnapshot = isInitialFirebaseSnapshotRef.current;
        isInitialFirebaseSnapshotRef.current = false;
        if (!isInitialSnapshot && heartbeat === lastHeartbeatValueRef.current) return;

        lastHeartbeatValueRef.current = heartbeat;
        lastTelemetryTimeRef.current = Date.now();

        const toNumberOrNull = (value) => {
          if (value === null || value === undefined || value === "") return null;
          const number = Number(value);
          return Number.isFinite(number) ? number : null;
        };

        const nextReading = {
          ...EMPTY_READING,

          pm1: toNumberOrNull(source.pm1),
          pm25: toNumberOrNull(source.pm25),
          pm10: toNumberOrNull(source.pm10),

          temperature: toNumberOrNull(source.temperature),
          humidity: toNumberOrNull(source.humidity),

          co2: toNumberOrNull(source.co2 ?? source.co2Equivalent),
          voc: toNumberOrNull(source.voc ?? source.vocEquivalent),
          // IAQ is a sensor value. Never derive or randomize it in the UI.
          iaq: toNumberOrNull(source.iaq ?? source.iaqScore ?? source.airQualityIndex ?? source.IAQ),

          calibrating:
            source.calibrating !== undefined
              ? Boolean(source.calibrating)
              : false,

          iaqAccuracyText:
            source.iaqAccuracyText ?? source.iaqAccuracy ?? null,

          ip: source.ip ?? root.ip ?? null,
          uptime: toNumberOrNull(source.uptime),
          status: source.status ?? null,
        };

        setLatest(nextReading);
        setConnectionStatus("connected");

        // ---------------------------------------------------
        // GPS
        // ---------------------------------------------------
        const gpsSource =
          (source.gps && typeof source.gps === "object" && source.gps) ||
          (root.gps && typeof root.gps === "object" && root.gps) ||
          null;

        if (gpsSource) {
          setGps({
            lat: toNumberOrNull(gpsSource.latitude ?? gpsSource.lat),
            lng: toNumberOrNull(gpsSource.longitude ?? gpsSource.lng ?? gpsSource.lon),
            alt: toNumberOrNull(gpsSource.altitude ?? gpsSource.alt),
            speed: toNumberOrNull(gpsSource.speed),
            course: toNumberOrNull(gpsSource.course),
            sats: toNumberOrNull(gpsSource.satellites ?? gpsSource.sats),
            hdop: toNumberOrNull(gpsSource.hdop),
            fix: gpsSource.fix ?? null,
            time: gpsSource.time ?? null,
          });
        } else if (source.latitude !== undefined || source.longitude !== undefined) {
          setGps({
            lat: toNumberOrNull(source.latitude),
            lng: toNumberOrNull(source.longitude),
            alt: toNumberOrNull(source.altitude),
            speed: toNumberOrNull(source.speed),
            course: toNumberOrNull(source.course),
            sats: toNumberOrNull(source.satellites),
            hdop: toNumberOrNull(source.hdop),
            fix:
              source.gpsValid === true
                ? "Valid"
                : source.gpsValid === false
                  ? "No Fix"
                  : null,
            time: source.gpsTime ?? null,
          });
        } else {
          setGps(EMPTY_GPS);
        }

        // ---------------------------------------------------
        // Camera status
        // ---------------------------------------------------
        const cameraSource =
          source.camera && typeof source.camera === "object"
            ? source.camera
            : root.camera && typeof root.camera === "object"
              ? root.camera
              : null;

        const firebaseCamIp =
          source.camIp ??
          source.cameraIp ??
          cameraSource?.ip ??
          cameraSource?.camIp ??
          root.camIp ??
          null;

        const firebaseCameraOnline =
          source.cameraOnline ??
          cameraSource?.online ??
          root.cameraOnline;

        if (firebaseCamIp) setCamIp(String(firebaseCamIp));
        if (firebaseCameraOnline !== undefined) {
          setCameraOnline(Boolean(firebaseCameraOnline));
        }

        setConnectionStatus("connected");
      },
      (error) => {
        console.error("Firebase Realtime Database error:", error);
        setConnectionStatus("error");
      }
    );

    return () => unsubscribe();
  }, []);

  // Direct ESP32 IP polling when configured
  React.useEffect(() => {
    if (!esp32Ip) return undefined;

    const baseUrl = /^https?:\/\//i.test(esp32Ip)
      ? esp32Ip.replace(/\/+$/, "")
      : `http://${esp32Ip.replace(/\/+$/, "")}`;
    let stopped = false;

    const toNumberOrNull = (value) => {
      if (value === null || value === undefined || value === "") return null;
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    };

    const poll = async () => {
      try {
        const readingsResponse = await fetch(`${baseUrl}/api/readings`, { cache: "no-store" });
        if (!readingsResponse.ok) throw new Error(`readings returned ${readingsResponse.status}`);
        const readings = await readingsResponse.json();
        if (stopped) return;

        const nextReading = {
          ...EMPTY_READING,
          pm1: toNumberOrNull(readings.pm1),
          pm25: toNumberOrNull(readings.pm25),
          pm10: toNumberOrNull(readings.pm10),
          temperature: toNumberOrNull(readings.temperature),
          humidity: toNumberOrNull(readings.humidity),
          co2: toNumberOrNull(readings.co2 ?? readings.co2Equivalent),
          voc: toNumberOrNull(readings.voc ?? readings.vocEquivalent),
          // Direct ESP32 polling uses the same raw IAQ value as Firebase.
          iaq: toNumberOrNull(readings.iaq ?? readings.iaqScore ?? readings.airQualityIndex ?? readings.IAQ),
          calibrating: Boolean(readings.calibrating),
          iaqAccuracyText: readings.iaqAccuracyText ?? readings.iaqAccuracy ?? null,
          ip: readings.ip ?? esp32Ip,
          uptime: toNumberOrNull(readings.uptime),
          status: readings.status ?? null,
        };

        setLatest(nextReading);

        if (readings.camIp) setCamIp(String(readings.camIp));
        if (readings.cameraOnline !== undefined) setCameraOnline(Boolean(readings.cameraOnline));

        try {
          const gpsResponse = await fetch(`${baseUrl}/api/gps`, { cache: "no-store" });
          if (gpsResponse.ok) {
            const gpsReading = await gpsResponse.json();
            if (!stopped) {
              setGps({
                lat: toNumberOrNull(gpsReading.latitude ?? gpsReading.lat),
                lng: toNumberOrNull(gpsReading.longitude ?? gpsReading.lng ?? gpsReading.lon),
                alt: toNumberOrNull(gpsReading.altitude ?? gpsReading.alt),
                speed: toNumberOrNull(gpsReading.speed),
                course: toNumberOrNull(gpsReading.course),
                sats: toNumberOrNull(gpsReading.satellites ?? gpsReading.sats),
                hdop: toNumberOrNull(gpsReading.hdop),
                fix: gpsReading.fix ?? null,
                time: gpsReading.time ?? null,
              });
            }
          }
        } catch (gpsError) {
          console.debug("ESP32 GPS unavailable:", gpsError);
        }

        lastTelemetryTimeRef.current = Date.now();
        setConnectionStatus("connected");
      } catch (error) {
        if (!stopped) {
          console.debug("ESP32 readings unavailable:", error);
          if (Date.now() - lastTelemetryTimeRef.current > 15000) {
            setConnectionStatus("error");
            setLatest(EMPTY_READING);
            setGps(EMPTY_GPS);
            setCameraOnline(false);
            setCamIp(null);
          }
        }
      }
    };

    setConnectionStatus("connecting");
    poll();
    const interval = window.setInterval(poll, 5000);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [esp32Ip]);

  // =========================================================
  // ESP32 CONNECTION TIMEOUT WATCHDOG
  // 15 seconds without fresh telemetry -> mark disconnected
  // and clear stale sensor readings from live dashboard.
  // =========================================================
  React.useEffect(() => {
    const checkConnection = setInterval(() => {
      const lastTelemetry = lastTelemetryTimeRef.current;

      if (lastTelemetry === 0) {
        // No fresh telemetry has arrived yet since page load
        if (connectionStatus === "connected") {
          setConnectionStatus("disconnected");
          setLatest(EMPTY_READING);
          setGps(EMPTY_GPS);
          setCameraOnline(false);
          setCamIp(null);
        }
        return;
      }

      const elapsed = Date.now() - lastTelemetry;

      if (elapsed > 15000) {
        if (connectionStatus !== "disconnected") {
          setConnectionStatus("disconnected");
          setLatest(EMPTY_READING);
          setGps(EMPTY_GPS);
          setCameraOnline(false);
          setCamIp(null);
        }
      }
    }, 1500);

    return () => clearInterval(checkConnection);
  }, [connectionStatus]);

  // Roll a PM history buffer for the Air Quality chart — only once real
  // readings start arriving.
  React.useEffect(() => {
    if (latest.pm1 === null && latest.pm25 === null && latest.pm10 === null) return;

    setPmHistory((prev) => {
      const next = [
        ...prev,
        {
          label: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          pm1: Number(latest.pm1) || 0,
          pm25: Number(latest.pm25) || 0,
          pm10: Number(latest.pm10) || 0,
        },
      ];

      return next.slice(-30);
    });
  }, [latest]);

  // Data logger — only logs real readings, and only while connected.
  React.useEffect(() => {

    if (!loggerRunning || connectionStatus !== "connected") return;

    const interval = setInterval(() => {
      setLogRows((prev) => [
        {
          id: Date.now(),
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
          ...latest,
        },
        ...prev,
      ]);
    }, loggerInterval);

    return () => clearInterval(interval);

  }, [loggerRunning, loggerInterval, latest, connectionStatus]);

  const alerts = React.useMemo(() => buildAlerts(latest, alertSettings), [latest, alertSettings]);

  // Environmental threshold notifications are created by the backend from
  // fresh RTDB telemetry and broadcast once to all applicable users. The
  // client keeps only the existing local safety/device notifications here.
  React.useEffect(() => {
    if (!currentUser?.id) return;
    const now = Date.now();
    const activeAlerts = alerts.filter((a) => ["warning", "danger"].includes(String(a.level).toLowerCase()));

    // Reset cleared status if a new alert condition arises
    if (clearedAlerts && activeAlerts.length > 0) {
      const clearedState = getClearedAlertsState(currentUser.id);
      const hasUnseenAlert = activeAlerts.some((a) => !clearedState.clearedTitles?.includes(a.title));
      if (hasUnseenAlert) {
        setClearedAlerts(false);
      }
    }

    // Fire detection if reported by live reading
    if (latest.fire || latest.flame) {
      const fireKey = "fire_detected";
      const lastFire = lastAlertsSentRef.current[fireKey] || 0;
      if (now - lastFire > 300000) {
        lastAlertsSentRef.current[fireKey] = now;
        createNotification({
          type: "safety",
          title: "🔥 Fire Detected",
          message: "Fire sensor has detected a possible fire condition in the monitored environment.",
          severity: "danger",
          recipientType: "user",
          recipientId: currentUser.id,
          createdAt: now,
          soundType: "danger",
        });
      }
    }
  }, [alerts, latest.fire, latest.flame, currentUser?.id, clearedAlerts]);

  // Connection state transition notification (ONLINE -> OFFLINE)
  React.useEffect(() => {
    if (!currentUser?.id) return;
    const prev = prevConnectionStatusRef.current;
    prevConnectionStatusRef.current = connectionStatus;

    if (prev === "connected" && (connectionStatus === "disconnected" || connectionStatus === "error")) {
      const now = Date.now();
      const lastSent = lastAlertsSentRef.current["device_offline"] || 0;
      if (now - lastSent > 120000) {
        lastAlertsSentRef.current["device_offline"] = now;
        createNotification({
          type: "device",
          title: "ESP32 Device Offline",
          message: "The main ESP32 device stopped transmitting sensor telemetry.",
          severity: "warning",
          recipientType: "user",
          recipientId: currentUser.id,
          createdAt: now,
          soundType: "warning",
        });
      }
    }
  }, [connectionStatus, currentUser?.id]);

  function exportLogExcel() {

    let html =
      "<html><head><meta charset='UTF-8'></head><body><table border='1'><tr><th colspan='9'>SmartSurround Air Quality Log</th></tr>";

    html +=
      "<tr><th>Time</th><th>PM1</th><th>PM2.5</th><th>PM10</th><th>Temp</th><th>Humidity</th><th>IAQ</th><th>CO2</th><th>VOC</th></tr>";

    logRows.forEach((r) => {
      html += `<tr><td>${r.time}</td><td>${r.pm1}</td><td>${r.pm25}</td><td>${r.pm10}</td><td>${Number(r.temperature).toFixed(1)}</td><td>${Number(r.humidity).toFixed(1)}</td><td>${Number(r.iaq).toFixed(0)}</td><td>${Number(r.co2).toFixed(0)}</td><td>${Number(r.voc).toFixed(2)}</td></tr>`;
    });

    html += "</table></body></html>";

    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const name = (exportName || "air_quality_log").replace(/[^a-z0-9_-]/gi, "_");

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name + ".xls";
    a.click();
  }

  const statusLabel =
    connectionStatus === "connected"
      ? "ESP32 LIVE"
      : connectionStatus === "connecting"
        ? "CONNECTING..."
        : connectionStatus === "error"
          ? "ESP32 UNREACHABLE"
          : "NOT CONNECTED";

  return (
    <div className={`live-shell${isDarkTheme ? " theme-dark" : ""}`}>

      <aside className={"live-sidebar" + (menuOpen ? " open" : "")}>

        {menuOpen && (
          <button
            type="button"
            className="live-sidebar-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={22} />
          </button>
        )}

        <div className="side-logo">
          <div className="mini-logo">
            <Activity size={14} />
          </div>
          <span>SmartSurround</span>
        </div>

        <div className="sidebar-title">MONITORING</div>

        {NAV_ITEMS.map((item) => (
          <button
            type="button"
            key={item.id}
            className={"side-link" + (activePage === item.id ? " active" : "")}
            onClick={() => {
              setAccountPanelOpen(false);
              navigate(dashboardPathFor(item.id));
              setMenuOpen(false);
            }}
          >
            {item.icon}
            {item.label}
          </button>
        ))}

        <div className="sidebar-title second-title">SYSTEM</div>
        <button
          type="button"
          className={"side-link" + (activePage === "account-settings" ? " active" : "")}
          onClick={() => {
            setAccountPanelOpen(false);
            navigate(dashboardPathFor("account-settings"));
            setMenuOpen(false);
          }}
        >
          <Settings size={15} />
          Settings
        </button>

        <button type="button" className="sidebar-footer-logout" onClick={() => setLogoutConfirmOpen(true)}>
          <LogOut size={16} />
          <span>Logout</span>
        </button>

      </aside>

      <div className="live-main-area">

        <div className="live-topbar">

          <button
            type="button"
            className="live-menu-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <Menu size={18} />
          </button>

          <div className="dashboard-url">
            smartsurround / {activePage}
          </div>

          <div className="live-topbar-right">

            <div className={`dashboard-status live-status-${connectionStatus}`}>
              <span></span>
              {statusLabel}
            </div>

            <NotificationDropdown
              notifications={notifications}
              userId={currentUser?.id}
              isAdmin={false}
              onNavigate={(page) => navigate(dashboardPathFor(page))}
            />

            <div className="live-account-wrap" ref={accountAreaRef}>
              <button
                type="button"
                className="live-user profile-trigger"
                onClick={() => setAccountMenuOpen((open) => !open)}
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
              >
                <ProfileAvatar user={currentUser} size={30} className="live-profile-avatar" />
                <span>{currentUser?.name || "Account"}</span>
                <ChevronDown size={14} className={accountMenuOpen ? "account-trigger-chevron open" : "account-trigger-chevron"} />
              </button>

              <AnimatePresence>
                {accountMenuOpen && (
                  <AccountMenu
                    onSelect={openAccountSection}
                    onLogout={() => { setAccountMenuOpen(false); setLogoutConfirmOpen(true); }}
                  />
                )}
              </AnimatePresence>
            </div>

            <button type="button" className="secondary-button live-back-to-site" onClick={onBackToSite}>
              <ArrowUpRight className="live-back-to-site-icon" size={15} aria-hidden="true" />
              <span>Back to Site</span>
            </button>

            <button
              type="button"
              className="nav-logout-button"
              onClick={() => setLogoutConfirmOpen(true)}
              aria-label="Log out"
            >
              <LogOut size={15} />
            </button>

          </div>

        </div>

        <div className={`live-page-content${isAccountPage ? " live-page-content-account" : ""}`}>

          {isAccountPage && (
            <AccountPanel
              currentUser={currentUser}
              section={accountSectionFromRoute}
              embedded
              onAppearanceChange={(nextAppearance) => {
                setAppearance(nextAppearance);
                try {
                  const existing = readAccountSettings(currentUser?.id);
                  window.localStorage.setItem(accountStorageKey("smartsurround_account_settings", currentUser?.id), JSON.stringify({ ...existing, appearance: nextAppearance }));
                } catch {}
              }}
              onUserUpdated={onUserUpdated}
              onLogout={() => setLogoutConfirmOpen(true)}
              onClose={() => {
                setAccountPanelOpen(false);
                navigate(dashboardPathFor("overview"));
              }}
            />
          )}

          {!isAccountPage && activePage === "overview" && (
            <OverviewPage
              latest={latest}
              alerts={alerts}
              connectionStatus={connectionStatus}
              notices={notices}
              onClearAlerts={handleClearAlerts}
              clearedAlerts={clearedAlerts}
            />
          )}

          {!isAccountPage && activePage === "airquality" && (
            <AirQualityPage latest={latest} pmHistory={pmHistory} />
          )}

          {!isAccountPage && activePage === "environment" && <EnvironmentPage latest={latest} />}

          {!isAccountPage && activePage === "camera" && <CameraPage gps={gps} camIp={camIp} />}

          {!isAccountPage && activePage === "location" && <LocationPage gps={gps} />}

          {!isAccountPage && activePage === "datalog" && (
            <DataLogPage
              logRows={logRows}
              loggerRunning={loggerRunning}
              loggerInterval={loggerInterval}
              setLoggerInterval={setLoggerInterval}
              exportName={exportName}
              setExportName={setExportName}
              isConnected={connectionStatus === "connected"}
              onStart={() => setLoggerRunning(true)}
              onStop={() => setLoggerRunning(false)}
              onClear={() => setLogRows([])}
              onExport={exportLogExcel}
              onAddNow={() =>
                setLogRows((prev) => [
                  {
                    id: Date.now(),
                    time: new Date().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    }),
                    ...latest,
                  },
                  ...prev,
                ])
              }
            />
          )}

          {!isAccountPage && activePage === "alerts" && (
            <AlertsPage
              alerts={alerts}
            />
          )}

        </div>

      </div>

      <AnimatePresence>
        {logoutConfirmOpen && (
          <LogoutConfirmDialog
            loading={loggingOut}
            onCancel={() => setLogoutConfirmOpen(false)}
            onConfirm={confirmLogout}
          />
        )}
      </AnimatePresence>

    </div>
  );
}


/* =========================================================
   LIVE DASHBOARD — PAGE COMPONENTS
========================================================= */
