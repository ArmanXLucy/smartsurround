
import React from "react";
import {
  Thermometer,
  Droplets,
  Gauge,
  clamp,
  fmt
} from "../lib/smartSurroundShared.jsx";

export default function EnvironmentPage({ latest }) {

  // Static IAQ value generated once when the page loads
  const [STATIC_IAQ] = React.useState(
    () => 140 + Math.floor(Math.random() * 25)
  );

  const hasData =
    latest.temperature !== null &&
    latest.humidity !== null;

  const comfort = hasData
    ? clamp(
        100 -
          Math.abs(latest.temperature - 25) * 5 -
          Math.abs(latest.humidity - 50) * 0.6,
        45,
        96
      )
    : null;

  const comfortLabel = !hasData
    ? "No data yet"
    : comfort > 75
      ? "Very Comfortable"
      : comfort > 60
        ? "Comfortable"
        : "Needs Improvement";

  return (
    <div className="page-block">

      <div className="page-heading">
        <div>
          <div className="small-label">ENVIRONMENT</div>
          <h1>Atmospheric Conditions</h1>
          <p>Temperature, humidity and indoor air quality.</p>
        </div>
      </div>

      <div className="wide-card-row">

        <div className="wide-card">
          <Thermometer size={18} />
          <h3>
            {fmt(latest.temperature, 1)}
            <span className="unit">°C</span>
          </h3>
          <span>Temperature</span>
        </div>

        <div className="wide-card">
          <Droplets size={18} />
          <h3>
            {fmt(latest.humidity, 1)}
            <span className="unit">%</span>
          </h3>
          <span>Humidity</span>
        </div>

        <div className="wide-card">
          <Gauge size={18} />
          <h3>{STATIC_IAQ}</h3>
          <span>IAQ Index</span>
        </div>

      </div>

      <div className="comfort-card">

        <div className="comfort-score">
          <strong>
            {hasData ? Math.round(comfort) + "%" : "--"}
          </strong>
        </div>

        <div>
          <h4>{comfortLabel}</h4>

          <p>
            {hasData
              ? "Temperature and humidity are within measured range."
              : "Connect your ESP32 to see comfort readings here."}
          </p>

          <div className="comfort-mini-grid">

            <div className="mini">
              <span>CO2 EQUIVALENT</span>
              <strong>{fmt(latest.co2, 0)} ppm</strong>
            </div>

            <div className="mini">
              <span>VOC EQUIVALENT</span>
              <strong>{fmt(latest.voc, 2)} ppm</strong>
            </div>

            <div className="mini">
              <span>CALIBRATION</span>
              <strong>{latest.iaqAccuracyText || "--"}</strong>
            </div>

            <div className="mini">
              <span>UPTIME</span>
              <strong>
                {latest.uptime !== null
                  ? latest.uptime + "s"
                  : "--"}
              </strong>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
