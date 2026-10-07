import React from "react";
import * as ort from "onnxruntime-web";

import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  Camera,
  CheckCircle2,
  FileText,
  Gauge,
  ShieldCheck,
  Upload,
  Video,
  X,
  BACKEND_URL,
} from "../lib/smartSurroundShared.jsx";

import StatTile from "../components/StatTile.jsx";

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MODEL_URL = "/models/best.onnx";
const MODEL_SIZE = 640;
const CONFIDENCE_THRESHOLD = 0.25;

let modelSessionPromise = null;

/* =========================================================
   LOAD ONNX MODEL
========================================================= */

const loadModel = async () => {
  if (!modelSessionPromise) {
    modelSessionPromise = ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
  }

  return modelSessionPromise;
};

/* =========================================================
   IMAGE PREPROCESSING
========================================================= */

const imageToTensor = async (file) => {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = new Image();

    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = imageUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = MODEL_SIZE;
    canvas.height = MODEL_SIZE;

    const ctx = canvas.getContext("2d", {
      willReadFrequently: true,
    });

    if (!ctx) {
      throw new Error("Unable to create image canvas.");
    }

    /*
      Letterbox resize.

      This keeps the original aspect ratio and places
      the image in the center of a 640x640 canvas.
    */

    const scale = Math.min(
      MODEL_SIZE / image.width,
      MODEL_SIZE / image.height
    );

    const newWidth = Math.round(image.width * scale);
    const newHeight = Math.round(image.height * scale);

    const offsetX = Math.floor((MODEL_SIZE - newWidth) / 2);
    const offsetY = Math.floor((MODEL_SIZE - newHeight) / 2);

    ctx.fillStyle = "rgb(114,114,114)";
    ctx.fillRect(0, 0, MODEL_SIZE, MODEL_SIZE);

    ctx.drawImage(
      image,
      0,
      0,
      image.width,
      image.height,
      offsetX,
      offsetY,
      newWidth,
      newHeight
    );

    const imageData = ctx.getImageData(
      0,
      0,
      MODEL_SIZE,
      MODEL_SIZE
    );

    const pixels = imageData.data;

    /*
      YOLO input:

      [1, 3, 640, 640]

      RGB
      normalized 0-1
    */

    const input = new Float32Array(
      1 * 3 * MODEL_SIZE * MODEL_SIZE
    );

    const channelSize = MODEL_SIZE * MODEL_SIZE;

    for (let i = 0; i < channelSize; i++) {
      const pixelIndex = i * 4;

      input[i] = pixels[pixelIndex] / 255.0;
      input[channelSize + i] =
        pixels[pixelIndex + 1] / 255.0;
      input[channelSize * 2 + i] =
        pixels[pixelIndex + 2] / 255.0;
    }

    return {
      tensor: new ort.Tensor(
        "float32",
        input,
        [1, 3, MODEL_SIZE, MODEL_SIZE]
      ),
      originalWidth: image.width,
      originalHeight: image.height,
    };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
};

/* =========================================================
   YOLO OUTPUT PARSER
========================================================= */

const parseDetectionOutput = (outputTensor) => {
  const data = outputTensor.data;
  const dims = outputTensor.dims;

  /*
    Ultralytics ONNX exports can have different output
    layouts depending on export settings.

    We support common layouts:
      [1, N, 6]
      [1, 6, N]

    With NMS enabled, detections are generally:

      x1, y1, x2, y2, confidence, class
  */

  if (!data || !dims || dims.length < 2) {
    return [];
  }

  let detections = [];

  if (dims.length === 3 && dims[2] === 6) {
    const count = dims[1];

    for (let i = 0; i < count; i++) {
      const base = i * 6;

      const x1 = data[base];
      const y1 = data[base + 1];
      const x2 = data[base + 2];
      const y2 = data[base + 3];
      const confidence = data[base + 4];
      const classId = data[base + 5];

      if (
        Number.isFinite(confidence) &&
        confidence >= CONFIDENCE_THRESHOLD
      ) {
        detections.push({
          x1,
          y1,
          x2,
          y2,
          confidence,
          classId,
        });
      }
    }
  } else if (dims.length === 3 && dims[1] === 6) {
    const count = dims[2];

    for (let i = 0; i < count; i++) {
      const x1 = data[i];
      const y1 = data[count + i];
      const x2 = data[count * 2 + i];
      const y2 = data[count * 3 + i];
      const confidence = data[count * 4 + i];
      const classId = data[count * 5 + i];

      if (
        Number.isFinite(confidence) &&
        confidence >= CONFIDENCE_THRESHOLD
      ) {
        detections.push({
          x1,
          y1,
          x2,
          y2,
          confidence,
          classId,
        });
      }
    }
  }

  return detections;
};

/* =========================================================
   CAMERA PAGE
========================================================= */

export default function CameraPage({ gps, currentUser }) {
  void gps;

  const [selectedImage, setSelectedImage] =
    React.useState(null);

  const [imagePreview, setImagePreview] =
    React.useState("");

  const [analysis, setAnalysis] =
    React.useState(null);

  const [analyzing, setAnalyzing] =
    React.useState(false);

  const [error, setError] =
    React.useState("");

  const [issueText, setIssueText] =
    React.useState("");

  // submitState: "idle" | "locating" | "submitting" | "success" | "error"
  const [submitState, setSubmitState] =
    React.useState("idle");

  const [submitError, setSubmitError] =
    React.useState("");

  const [submittedTicketId, setSubmittedTicketId] =
    React.useState(null);

  // Manual location fallback modal
  const [showManualLocation, setShowManualLocation] =
    React.useState(false);

  const [manualLat, setManualLat] =
    React.useState("");

  const [manualLng, setManualLng] =
    React.useState("");

  const [manualLocationError, setManualLocationError] =
    React.useState("");

  // Resolver ref for manual location promise
  const manualLocationResolveRef = React.useRef(null);
  const manualLocationRejectRef  = React.useRef(null);

  const [imageSource, setImageSource] =
    React.useState("");

  const [capturing, setCapturing] =
    React.useState(false);

  const [cameraPreviewOpen, setCameraPreviewOpen] =
    React.useState(false);

  const fileInputRef =
    React.useRef(null);

  const videoRef =
    React.useRef(null);

  const cameraStreamRef =
    React.useRef(null);

  const analysisRequestRef =
    React.useRef(0);

  const analysisControllerRef =
    React.useRef(null);

  /* =======================================================
     STOP CAMERA
  ======================================================= */

  const stopCamera = React.useCallback(() => {
    cameraStreamRef.current
      ?.getTracks()
      .forEach((track) => track.stop());

    cameraStreamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraPreviewOpen(false);
  }, []);

  /* =======================================================
     CLEANUP
  ======================================================= */

  React.useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }

      stopCamera();
    };
  }, [imagePreview, stopCamera]);

  /* =======================================================
     CAMERA VIDEO
  ======================================================= */

  React.useEffect(() => {
    if (
      cameraPreviewOpen &&
      videoRef.current &&
      cameraStreamRef.current
    ) {
      videoRef.current.srcObject =
        cameraStreamRef.current;
    }
  }, [cameraPreviewOpen]);

  /* =======================================================
     SELECT IMAGE
  ======================================================= */

  const selectImage = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      setError(
        "Choose a JPG, JPEG, PNG, or WEBP image."
      );

      event.target.value = "";
      return;
    }

    analysisRequestRef.current += 1;

    analysisControllerRef.current?.abort();
    analysisControllerRef.current = null;

    stopCamera();

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setAnalyzing(false);
    setImagePreview(URL.createObjectURL(file));
    setSelectedImage(file);
    setImageSource("upload");
    setAnalysis(null);
    setIssueText("");
    setSubmitState("idle");
    setSubmitError("");
    setSubmittedTicketId(null);
    setError("");

    event.target.value = "";
  };

  /* =======================================================
     ANALYZE ROAD WITH ONNX
  ======================================================= */

  const analyzeRoad = async () => {
    if (!selectedImage || analyzing) {
      return;
    }

    const requestId =
      ++analysisRequestRef.current;

    analysisControllerRef.current?.abort();

    const controller =
      new AbortController();

    analysisControllerRef.current =
      controller;

    setAnalyzing(true);
    setError("");
    setAnalysis(null);
    setIssueText("");
    setSubmitState("idle");
    setSubmitError("");
    setSubmittedTicketId(null);

    try {
      /* ---------------------------------------------------
         LOAD MODEL
      --------------------------------------------------- */

      const session =
        await loadModel();

      if (controller.signal.aborted) {
        return;
      }

      /* ---------------------------------------------------
         PREPROCESS IMAGE
      --------------------------------------------------- */

      const {
        tensor,
      } = await imageToTensor(
        selectedImage
      );

      if (controller.signal.aborted) {
        return;
      }

      /* ---------------------------------------------------
         GET INPUT NAME
      --------------------------------------------------- */

      const inputName =
        session.inputNames[0];

      if (!inputName) {
        throw new Error(
          "YOLO model input was not found."
        );
      }

      /* ---------------------------------------------------
         RUN YOLO
      --------------------------------------------------- */

      const results =
        await session.run({
          [inputName]: tensor,
        });

      if (controller.signal.aborted) {
        return;
      }

      /* ---------------------------------------------------
         GET OUTPUT
      --------------------------------------------------- */

      const outputName =
        session.outputNames[0];

      if (!outputName) {
        throw new Error(
          "YOLO model output was not found."
        );
      }

      const outputTensor =
        results[outputName];

      if (!outputTensor) {
        throw new Error(
          "Unable to read YOLO model output."
        );
      }

      /* ---------------------------------------------------
         PARSE DETECTIONS
      --------------------------------------------------- */

      const detections =
        parseDetectionOutput(
          outputTensor
        );

      /*
        Our model has one class:

        0 = pothole
      */

      const potholeDetections =
        detections.filter(
          (detection) =>
            Number(detection.classId) === 0 &&
            detection.confidence >=
              CONFIDENCE_THRESHOLD
        );

      /* ---------------------------------------------------
         FIND BEST DETECTION
      --------------------------------------------------- */

      let bestDetection = null;

      for (const detection of potholeDetections) {
        if (
          !bestDetection ||
          detection.confidence >
            bestDetection.confidence
        ) {
          bestDetection = detection;
        }
      }

      /* ---------------------------------------------------
         CREATE RESULT
      --------------------------------------------------- */

      if (bestDetection) {
        const confidence =
          Number(
            bestDetection.confidence
          );

        setAnalysis({
          road_condition: "damaged",
          damage_type: "Pothole",
          confidence,
          severity:
            confidence >= 0.75
              ? "High"
              : confidence >= 0.5
                ? "Medium"
                : "Low",

          queued_for_admin: false,
          detection_id: null,

          /*
            Local browser inference does not upload
            the image to the backend.
          */

          image: "",
        });
      } else {
        setAnalysis({
          road_condition: "normal",
          damage_type: "None",
          confidence: 0,
          severity: "None",
          queued_for_admin: false,
          detection_id: null,
          image: "",
        });
      }

      /*
        Prevent an old analysis request from updating
        the current screen.
      */

      if (
        requestId !==
        analysisRequestRef.current
      ) {
        return;
      }
    } catch (err) {
      if (
        err?.name === "AbortError" ||
        controller.signal.aborted
      ) {
        return;
      }

      console.error(
        "ONNX pothole detection error:",
        err
      );

      setError(
        err?.message ||
          "Unable to analyze this image with the AI model."
      );
    } finally {
      if (
        requestId ===
        analysisRequestRef.current
      ) {
        setAnalyzing(false);

        if (
          analysisControllerRef.current ===
          controller
        ) {
          analysisControllerRef.current =
            null;
        }
      }
    }
  };

  /* =======================================================
     OPEN CAMERA
  ======================================================= */

  const captureImage = async () => {
    if (capturing || analyzing) {
      return;
    }

    if (
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError(
        "Camera access is not supported by this browser. Use Upload Image instead."
      );

      return;
    }

    setCapturing(true);
    setError("");

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            video: {
              facingMode: {
                ideal: "environment",
              },
            },
            audio: false,
          }
        );

      cameraStreamRef.current =
        stream;

      if (videoRef.current) {
        videoRef.current.srcObject =
          stream;
      }

      setCameraPreviewOpen(true);
    } catch (err) {
      setError(
        err?.name === "NotAllowedError" ||
          err?.name === "SecurityError"
          ? "Camera permission was denied. Allow camera access in your browser and try again."
          : err?.name ===
              "NotFoundError" ||
            err?.name ===
              "DevicesNotFoundError"
            ? "No camera was found on this device. Use Upload Image instead."
            : err?.message ||
              "Unable to access this device's camera."
      );
    } finally {
      setCapturing(false);
    }
  };

  /* =======================================================
     CAPTURE CAMERA FRAME
  ======================================================= */

  const captureCameraFrame = () => {
    const video =
      videoRef.current;

    if (
      !video?.videoWidth ||
      !video?.videoHeight
    ) {
      setError(
        "The camera preview is not ready yet. Please try again in a moment."
      );

      return;
    }

    const canvas =
      document.createElement(
        "canvas"
      );

    canvas.width =
      video.videoWidth;

    canvas.height =
      video.videoHeight;

    canvas
      .getContext("2d")
      ?.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
      );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError(
            "Unable to capture an image from the camera. Please try again."
          );

          return;
        }

        const capturedImage =
          new File(
            [blob],
            `camera_capture_${Date.now()}.jpg`,
            {
              type: "image/jpeg",
            }
          );

        setImagePreview(
          URL.createObjectURL(
            capturedImage
          )
        );

        setSelectedImage(
          capturedImage
        );

        setImageSource(
          "capture"
        );

        setAnalysis(null);
        setIssueText("");
        setSubmitState("idle");
        setSubmitError("");
        setSubmittedTicketId(null);
        setError("");

        stopCamera();
      },
      "image/jpeg",
      0.92
    );
  };

  /* =======================================================
     REMOVE IMAGE
  ======================================================= */

  const removeImage = () => {
    analysisRequestRef.current += 1;

    analysisControllerRef.current?.abort();
    analysisControllerRef.current =
      null;

    stopCamera();

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setSelectedImage(null);
    setImagePreview("");
    setAnalysis(null);
    setImageSource("");
    setError("");
    setIssueText("");
    setSubmitState("idle");
    setSubmitError("");
    setSubmittedTicketId(null);
    setAnalyzing(false);
    setCapturing(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /* =======================================================
     RESULT VALUES
  ======================================================= */

  const isPothole =
    String(
      analysis?.damage_type || ""
    )
      .toLowerCase()
      .includes("pothole");

  // The submit section shows as soon as a pothole is detected and an image
  // is available. Admin Queue / Detection ID are populated AFTER submission.
  const canSubmit =
    Boolean(
      isPothole &&
        selectedImage
    );

  const analyzedImageUrl =
    analysis?.image
      ? `${BACKEND_URL}${analysis.image}`
      : "";

  /* =======================================================
     SUBMIT POTHOLE REPORT
  ======================================================= */

  const submitReport = async () => {
    if (submitState !== "idle" && submitState !== "error") return;
    if (!isPothole || !selectedImage) return;
    if (!issueText.trim()) {
      setSubmitError(
        "Please describe the issue before submitting."
      );
      return;
    }
    if (!currentUser?.id || !currentUser?.email) {
      setSubmitError(
        "User authentication is required. Please log in and try again."
      );
      return;
    }

    /* -------------------------------------------------------
       STEP 1 — get location via 3-layer fallback chain
       Layer 1: Browser GPS
       Layer 2: IP-based geolocation (ip-api.com, free)
       Layer 3: Manual user input modal
    ------------------------------------------------------- */

    setSubmitState("locating");
    setSubmitError("");

    let gpsCoords = null;

    // --- Helper: browser geolocation ---
    const getBrowserGPS = () =>
      new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("no-geolocation"));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          resolve,
          (err) => reject(err),
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      });

    // --- Helper: IP geolocation fallback ---
    const getIPLocation = async () => {
      const res = await fetch("https://ip-api.com/json/?fields=status,lat,lon,city");
      const data = await res.json();
      if (data.status !== "success") throw new Error("IP geolocation failed");
      // Wrap in a GeolocationPosition-like object so the rest of the code works unchanged
      return {
        coords: {
          latitude:  data.lat,
          longitude: data.lon,
          accuracy:  5000, // IP-based accuracy ~5 km
        },
        timestamp: Date.now(),
        _source: "ip",
      };
    };

    // --- Helper: manual location input modal ---
    const getManualLocation = () =>
      new Promise((resolve, reject) => {
        manualLocationResolveRef.current = resolve;
        manualLocationRejectRef.current  = reject;
        setManualLat("");
        setManualLng("");
        setManualLocationError("");
        setShowManualLocation(true);
      });

    try {
      // Layer 1 – browser GPS
      try {
        gpsCoords = await getBrowserGPS();
      } catch {
        // Layer 2 – IP geolocation (silent, no error shown)
        try {
          gpsCoords = await getIPLocation();
        } catch {
          // Layer 3 – manual input modal
          setSubmitState("idle"); // allow UI interaction
          gpsCoords = await getManualLocation();
          setSubmitState("locating");
        }
      }
    } catch (locationErr) {
      // User cancelled the manual modal
      setSubmitState("idle");
      setSubmitError("Location is required to submit the report.");
      return;
    }

    /* -------------------------------------------------------
       STEP 2 — submit complaint to existing backend API
    ------------------------------------------------------- */

    setSubmitState("submitting");

    try {
      const form = new FormData();
      form.append("user_id", currentUser.id);
      form.append(
        "user_name",
        currentUser.name ||
          currentUser.email?.split("@")[0] ||
          "User"
      );
      form.append("email", currentUser.email);
      form.append("subject", "Pothole Detected");
      form.append("description", issueText.trim());
      form.append("priority", "Urgent");
      form.append("category", "Road Damage");
      form.append(
        "incident_latitude",
        String(gpsCoords.coords.latitude)
      );
      form.append(
        "incident_longitude",
        String(gpsCoords.coords.longitude)
      );
      form.append(
        "incident_accuracy",
        String(gpsCoords.coords.accuracy)
      );
      form.append(
        "incident_gps_time",
        new Date(gpsCoords.timestamp).toISOString()
      );
      form.append("attachment", selectedImage, selectedImage.name);

      const response = await fetch(
        `${BACKEND_URL}/api/complaints`,
        { method: "POST", body: form }
      );

      const body = await response.json().catch(() => ({}));

      if (!response.ok || !body.ok) {
        throw new Error(
          body.message || `Server error (HTTP ${response.status}).`
        );
      }

      const ticketId =
        body.complaint?.ticket_id ||
        `INC-${body.complaint?.id}`;

      setSubmittedTicketId(ticketId);

      // Update the analysis cards to show the new state.
      setAnalysis((prev) => ({
        ...prev,
        queued_for_admin: true,
        detection_id: ticketId,
      }));

      setSubmitState("success");
    } catch (submitErr) {
      setSubmitState("error");
      setSubmitError(
        submitErr?.message ||
          "Unable to submit the report. Please check your connection and try again."
      );
    }
  };

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="page-block">

      {/* =================================================
          PAGE HEADER
      ================================================= */}

      <div className="page-heading">
        <div>
          <div className="small-label">
            AI VISION
          </div>

          <h1>
            Camera / Road Analysis
          </h1>

          <p>
            Upload a road image and analyze
            it with the SmartSurround
            pothole detection model.
          </p>
        </div>

        <div className="dashboard-live">
          <span />
          {analyzing
            ? "AI ANALYZING"
            : "IMAGE ANALYSIS"}
        </div>
      </div>

      {/* =================================================
          IMAGE PREVIEW
      ================================================= */}

      <div className="camera-card camera-upload-card">

        {cameraPreviewOpen ? (
          <video
            ref={videoRef}
            className="camera-upload-preview"
            autoPlay
            muted
            playsInline
            aria-label="Live camera preview"
          />
        ) : imagePreview ? (
          <img
            className="camera-upload-preview"
            src={imagePreview}
            alt="Selected road for analysis"
          />
        ) : (
          <div className="camera-upload-empty">
            <Upload size={38} />

            <strong>
              Upload an image to analyze
            </strong>

            <span>
              JPG, PNG, or WEBP
            </span>
          </div>
        )}

        {(analyzing || capturing) && (
          <div className="camera-analyzing">
            <span />

            {capturing
              ? "Opening camera..."
              : "Analyzing image..."}
          </div>
        )}
      </div>

      {/* =================================================
          ACTION BUTTONS
      ================================================= */}

      <div className="camera-upload-actions">

        <input
          ref={fileInputRef}
          className="camera-file-input"
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          onChange={selectImage}
          aria-label="Choose a road image"
        />

        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            fileInputRef.current?.click()
          }
          disabled={
            capturing ||
            analyzing
          }
        >
          <Upload size={16} />

          Upload Image
        </button>

        {imageSource === "upload" &&
          selectedImage && (
            <div
              className="camera-upload-filename"
              title={
                selectedImage.name
              }
            >
              <span>
                {selectedImage.name}
              </span>

              <button
                type="button"
                onClick={
                  removeImage
                }
                aria-label="Remove uploaded image"
                title="Remove image"
              >
                <X size={16} />
              </button>
            </div>
          )}

        {cameraPreviewOpen ? (
          <>
            <button
              type="button"
              className="secondary-button camera-capture-button"
              onClick={
                captureCameraFrame
              }
              disabled={analyzing}
            >
              <Camera size={16} />

              Capture Frame
            </button>

            <button
              type="button"
              className="secondary-button camera-remove-button"
              onClick={
                stopCamera
              }
              disabled={analyzing}
            >
              Cancel Camera
            </button>
          </>
        ) : imageSource ===
            "capture" &&
          selectedImage ? (
          <button
            type="button"
            className="secondary-button camera-remove-button"
            onClick={
              removeImage
            }
            disabled={
              capturing ||
              analyzing
            }
          >
            Remove Image
          </button>
        ) : (
          <button
            type="button"
            className="secondary-button camera-capture-button"
            onClick={
              captureImage
            }
            disabled={
              capturing ||
              analyzing
            }
          >
            <Camera size={16} />

            {capturing
              ? "Opening Camera..."
              : "Capture Image"}
          </button>
        )}

        <button
          type="button"
          className="primary-button"
          onClick={
            analyzeRoad
          }
          disabled={
            analyzing ||
            capturing ||
            cameraPreviewOpen ||
            !selectedImage
          }
        >
          <BrainCircuit size={16} />

          {analyzing
            ? "Analyzing..."
            : "Analyze"}
        </button>
      </div>

      {/* =================================================
          STATUS
      ================================================= */}

      <div className="tile-grid three camera-status-grid">

        <StatTile
          label="Analysis Source"
          value={
            imageSource === "capture"
              ? "Camera Capture"
              : imageSource === "upload"
                ? "Uploaded Image"
                : "Waiting"
          }
          unit=""
          icon={
            <Video size={16} />
          }
        />

        <StatTile
          label="AI Model"
          value="YOLO Pothole"
          unit=""
          icon={
            <BrainCircuit
              size={16}
            />
          }
        />

        <StatTile
          label="Image Status"
          value={
            analyzing
              ? "Analyzing"
              : capturing
                ? "Opening Camera"
                : cameraPreviewOpen
                  ? "Live Preview"
                  : analysis
                    ? "Analyzed"
                    : selectedImage
                      ? "Selected"
                      : "Waiting"
          }
          unit=""
          icon={
            <Upload size={16} />
          }
        />
      </div>

      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <div
          className="camera-error"
          role="alert"
        >
          <strong>
            Camera / Analysis Error
          </strong>

          <span>
            {error}
          </span>
        </div>
      )}

      {/* =================================================
          RESULT
      ================================================= */}

      {analysis && (
        <section
          className="wide-card camera-result-card"
          aria-labelledby="camera-result-title"
        >

          <div className="card-header">
            <div>
              <div className="card-label">
                AI ROAD ANALYSIS
              </div>

              <h3 id="camera-result-title">
                Detection Result
              </h3>
            </div>

            <BrainCircuit size={20} />
          </div>

          <div className="tile-grid three camera-result-tiles">

            <StatTile
              label="Road Condition"
              value={
                analysis.road_condition ||
                "--"
              }
              unit=""
              icon={
                <Activity size={16} />
              }
            />

            <StatTile
              label="Damage Type"
              value={
                analysis.damage_type ||
                "--"
              }
              unit=""
              icon={
                <ShieldCheck
                  size={16}
                />
              }
            />

            <StatTile
              label="Confidence"
              value={
                typeof analysis.confidence ===
                "number"
                  ? `${(
                      analysis.confidence *
                      100
                    ).toFixed(1)}%`
                  : "--"
              }
              unit=""
              icon={
                <Gauge size={16} />
              }
            />

            <StatTile
              label="Severity"
              value={
                analysis.severity ||
                "--"
              }
              unit=""
              icon={
                <AlertTriangle
                  size={16}
                />
              }
            />

            <StatTile
              label="Admin Queue"
              value={
                analysis.queued_for_admin
                  ? "Queued"
                  : "Not Queued"
              }
              unit=""
              icon={
                <ShieldCheck
                  size={16}
                />
              }
            />

            <StatTile
              label="Detection ID"
              value={
                analysis.detection_id ??
                "--"
              }
              unit=""
              icon={
                <FileText
                  size={16}
                />
              }
            />
          </div>

          {analyzedImageUrl && (
            <div className="camera-analyzed-image">
              <div className="card-label">
                ANALYZED IMAGE
              </div>

              <img
                src={analyzedImageUrl}
                alt="Image processed by road damage analysis"
              />
            </div>
          )}

          <div
            className={`camera-result-message ${
              analysis.road_condition ===
              "damaged"
                ? "is-damaged"
                : "is-normal"
            }`}
          >
            <strong>
              {analysis.road_condition ===
              "damaged"
                ? "Pothole detected"
                : "No pothole detected"}
            </strong>

            <span>
              {analysis.road_condition ===
              "damaged"
                ? `The YOLO model detected a pothole with ${(
                    analysis.confidence *
                    100
                  ).toFixed(
                    1
                  )}% confidence.`
                : "The YOLO model did not detect a pothole in this image."}
            </span>
          </div>

          {canSubmit && (
            <div className="camera-submit-area">

              {submitState === "success" ? (
                <div className="camera-submitted-message">
                  <CheckCircle2
                    size={18}
                  />

                  <span>
                    Report submitted successfully.
                    {submittedTicketId && (
                      <>
                        {" "}Incident ID:{" "}
                        <strong>
                          {submittedTicketId}
                        </strong>
                      </>
                    )}
                  </span>
                </div>
              ) : (
                <>
                  <p>
                    Pothole detected. Describe
                    the issue and submit a
                    report to the administrator.
                  </p>

                  <textarea
                    className="camera-issue-textarea"
                    rows={4}
                    placeholder="Describe the road issue (e.g. multiple large potholes making it difficult for vehicles to pass)…"
                    value={issueText}
                    onChange={(e) =>
                      setIssueText(e.target.value)
                    }
                    disabled={
                      submitState !== "idle" &&
                      submitState !== "error"
                    }
                    aria-label="Describe the road issue"
                  />

                  {submitError && (
                    <div
                      className="camera-error"
                      role="alert"
                      style={{ marginTop: 0 }}
                    >
                      <span>{submitError}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    className="primary-button"
                    onClick={submitReport}
                    disabled={
                      submitState !== "idle" &&
                      submitState !== "error"
                    }
                  >
                    <CheckCircle2
                      size={16}
                    />

                    {submitState === "locating"
                      ? "Getting location…"
                      : submitState === "submitting"
                        ? "Submitting…"
                        : "Submit"}
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* =================================================
          MANUAL LOCATION MODAL (fallback when GPS + IP fail)
      ================================================= */}

      {showManualLocation && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(6px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "var(--surface, #1e1e2e)",
              border: "1px solid var(--border, rgba(255,255,255,0.1))",
              borderRadius: "1rem",
              padding: "2rem",
              width: "100%",
              maxWidth: "420px",
              boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
            }}
          >
            <h3
              style={{
                margin: "0 0 0.5rem",
                fontSize: "1.1rem",
                fontWeight: 600,
                color: "var(--text-primary, #fff)",
              }}
            >
              📍 Enter Location Manually
            </h3>

            <p
              style={{
                margin: "0 0 1.25rem",
                fontSize: "0.85rem",
                color: "var(--text-muted, #aaa)",
                lineHeight: 1.5,
              }}
            >
              Automatic location detection failed. Open{" "}
              <a
                href="https://maps.google.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--accent, #f97316)" }}
              >
                Google Maps
              </a>
              , right-click your location and copy the coordinates, then paste
              them below.
            </p>

            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 500,
                color: "var(--text-muted, #aaa)",
                marginBottom: "0.3rem",
              }}
            >
              Latitude
            </label>
            <input
              type="number"
              step="any"
              placeholder="e.g. 28.6139"
              value={manualLat}
              onChange={(e) => setManualLat(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem 0.8rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border, rgba(255,255,255,0.15))",
                background: "var(--surface-2, rgba(255,255,255,0.05))",
                color: "var(--text-primary, #fff)",
                fontSize: "0.9rem",
                marginBottom: "0.75rem",
                boxSizing: "border-box",
              }}
            />

            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 500,
                color: "var(--text-muted, #aaa)",
                marginBottom: "0.3rem",
              }}
            >
              Longitude
            </label>
            <input
              type="number"
              step="any"
              placeholder="e.g. 77.2090"
              value={manualLng}
              onChange={(e) => setManualLng(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem 0.8rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border, rgba(255,255,255,0.15))",
                background: "var(--surface-2, rgba(255,255,255,0.05))",
                color: "var(--text-primary, #fff)",
                fontSize: "0.9rem",
                marginBottom: "0.25rem",
                boxSizing: "border-box",
              }}
            />

            {manualLocationError && (
              <p
                style={{
                  color: "#f87171",
                  fontSize: "0.8rem",
                  margin: "0.4rem 0 0.75rem",
                }}
              >
                {manualLocationError}
              </p>
            )}

            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                marginTop: "1.25rem",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  const lat = parseFloat(manualLat);
                  const lng = parseFloat(manualLng);

                  if (isNaN(lat) || lat < -90 || lat > 90) {
                    setManualLocationError(
                      "Latitude must be a number between -90 and 90."
                    );
                    return;
                  }
                  if (isNaN(lng) || lng < -180 || lng > 180) {
                    setManualLocationError(
                      "Longitude must be a number between -180 and 180."
                    );
                    return;
                  }

                  setShowManualLocation(false);
                  manualLocationResolveRef.current?.({
                    coords: {
                      latitude: lat,
                      longitude: lng,
                      accuracy: 100,
                    },
                    timestamp: Date.now(),
                    _source: "manual",
                  });
                }}
                style={{
                  flex: 1,
                  padding: "0.65rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  background: "var(--accent, #f97316)",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                Confirm Location
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowManualLocation(false);
                  manualLocationRejectRef.current?.(
                    new Error("cancelled")
                  );
                }}
                style={{
                  padding: "0.65rem 1rem",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--border, rgba(255,255,255,0.15))",
                  background: "transparent",
                  color: "var(--text-muted, #aaa)",
                  fontWeight: 500,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}