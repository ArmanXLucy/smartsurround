import React, { useState, useRef } from "react";
import {
  Save,
  Upload,
  X,
  MapPin,
  Trash2,
  Edit2,
  Archive,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Eye,
  Plus,
} from "lucide-react";
import {
  publishNotice,
  updateNotice,
  archiveNotice,
  deleteNoticePermanently,
} from "../lib/notificationService";

export default function AdminNoticeManager({
  notices = [],
  users = [],
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Infrastructure",
    severity: "Warning",
    locationName: "",
    latitude: "",
    longitude: "",
    audienceType: "all",
    targetUserId: "",
    targetUserIds: [],
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const fileInputRef = useRef(null);

  // Edit notice state
  const [editingNotice, setEditingNotice] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState(null);
  const [updating, setUpdating] = useState(false);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setStatusMessage({ type: "error", text: "Please select a valid image file (PNG, JPG, WEBP)." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setStatusMessage({ type: "error", text: "Image size must be less than 5 MB." });
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleClearImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    // Reset the actual file input DOM element so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleGetCurrentGps = () => {
    if (!navigator.geolocation) {
      setStatusMessage({ type: "error", text: "Geolocation is not supported by your browser." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setStatusMessage({ type: "success", text: "Acquired current GPS coordinates." });
      },
      (err) => {
        setStatusMessage({ type: "error", text: `Unable to obtain GPS: ${err.message}` });
      },
      { timeout: 10000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setStatusMessage({ type: "error", text: "Please enter a notice title." });
      return;
    }
    if (!form.description.trim()) {
      setStatusMessage({ type: "error", text: "Please enter a notice description." });
      return;
    }

    // Audience validation
    if (form.audienceType === "specific" && !form.targetUserId) {
      setStatusMessage({ type: "error", text: "Please select a user for this notice." });
      return;
    }
    if (form.audienceType === "selected" && form.targetUserIds.length === 0) {
      setStatusMessage({ type: "error", text: "Please select at least one user." });
      return;
    }

    setPublishing(true);
    setStatusMessage(null);

    try {
      const result = await publishNotice(form, imageFile);

      // Build a meaningful success message based on audience
      let successText = "\u2713 Notice published successfully.";
      if (result && typeof result === "object") {
        if (result.audienceType === "all") {
          successText += " Notifications sent to all users.";
        } else if (result.audienceType === "specific") {
          successText += " Notification sent to the selected user.";
        } else if (result.audienceType === "selected" && result.recipientCount != null) {
          successText += ` Notifications sent to ${result.recipientCount} selected user${result.recipientCount !== 1 ? "s" : ""}.`;
        }
      }

      setStatusMessage({
        type: "success",
        text: successText,
      });

      // Reset form
      setForm({
        title: "",
        description: "",
        category: "Infrastructure",
        severity: "Warning",
        locationName: "",
        latitude: "",
        longitude: "",
        audienceType: "all",
        targetUserId: "",
        targetUserIds: [],
      });
      handleClearImage();
    } catch (err) {
      console.error("Notice publishing error:", err);
      setStatusMessage({
        type: "error",
        text: `Unable to publish notice: ${err.message || "Please try again."}`,
      });
    } finally {
      setPublishing(false);
    }
  };

  // Edit handling
  const startEdit = (notice) => {
    setEditingNotice(notice);
    setEditForm({
      title: notice.title || "",
      description: notice.description || "",
      category: notice.category || "Infrastructure",
      severity: notice.severity || "Warning",
      locationName: notice.locationName || "",
      latitude: notice.latitude ?? "",
      longitude: notice.longitude ?? "",
      audienceType: notice.audienceType || "all",
      targetUserId: notice.targetUserId || "",
      targetUserIds: notice.targetUserIds || [],
    });
    setEditImagePreview(notice.imageUrl || null);
    setEditImageFile(null);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingNotice || !editForm) return;

    setUpdating(true);
    try {
      await updateNotice(editingNotice.id, editForm, editImageFile);
      setStatusMessage({ type: "success", text: "Notice updated successfully." });
      setEditingNotice(null);
      setEditForm(null);
    } catch (err) {
      console.error("Update notice error:", err);
      setStatusMessage({ type: "error", text: `Update failed: ${err.message}` });
    } finally {
      setUpdating(false);
    }
  };

  const handleArchive = async (notice) => {
    const nextArchived = !notice.archived;
    try {
      await archiveNotice(notice.id, nextArchived);
      setStatusMessage({
        type: "success",
        text: nextArchived ? "Notice archived." : "Notice restored to active status.",
      });
    } catch (err) {
      setStatusMessage({ type: "error", text: `Archive failed: ${err.message}` });
    }
  };

  const handleDeletePermanent = async (noticeId) => {
    if (!window.confirm("Permanently delete this notice record? This cannot be undone.")) return;
    try {
      await deleteNoticePermanently(noticeId);
      setStatusMessage({ type: "success", text: "Notice permanently deleted." });
    } catch (err) {
      setStatusMessage({ type: "error", text: `Delete failed: ${err.message}` });
    }
  };

  return (
    <div className="admin-notice-manager">
      {statusMessage && (
        <div
          className={`admin-feedback-banner ${statusMessage.type === "error" ? "error" : "success"}`}
        >
          {statusMessage.type === "error" ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <span>{statusMessage.text}</span>
          <button
            type="button"
            className="feedback-dismiss"
            onClick={() => setStatusMessage(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="sc-admin-grid-2">
        {/* Notice Creation Form */}
        <div className="sc-admin-panel">
          <div className="sc-admin-panel-head">
            <div>
              <h3>Publish New Notice</h3>
              <p>Create community announcements, road damage alerts, and safety warnings.</p>
            </div>
          </div>

          <form className="sc-admin-form-grid" onSubmit={handleSubmit}>
            <label className="sc-admin-field">
              <span>Notice Title *</span>
              <input
                type="text"
                required
                placeholder="e.g. Road Damage Near Main Crossing"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>

            <label className="sc-admin-field">
              <span>Description *</span>
              <textarea
                required
                rows={3}
                placeholder="Provide clear details and instructions for citizens..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>

            <div className="sc-admin-form-row-2">
              <label className="sc-admin-field">
                <span>Category</span>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  <option value="Infrastructure">Infrastructure</option>
                  <option value="Safety">Safety</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Weather">Weather</option>
                  <option value="Traffic">Traffic</option>
                  <option value="General">General</option>
                </select>
              </label>

              <label className="sc-admin-field">
                <span>Severity Level</span>
                <select
                  value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value })}
                >
                  <option value="Info">Info (Standard Announcement)</option>
                  <option value="Warning">Warning (Important Caution)</option>
                  <option value="Danger">Danger (Urgent Threat)</option>
                  <option value="Success">Success (Issue Resolved)</option>
                </select>
              </label>
            </div>

            {/* Image upload */}
            <div className="sc-admin-field" style={{ gridColumn: "1 / -1" }}>
              <span>Notice Image</span>
              <div className="admin-file-upload-box">
                {imagePreview ? (
                  <div className="admin-file-preview-wrap">
                    <img src={imagePreview} alt="Preview" className="admin-file-preview" />
                    <button
                      type="button"
                      className="admin-file-remove-btn"
                      onClick={handleClearImage}
                      title="Remove image"
                    >
                      <X size={14} /> Remove
                    </button>
                  </div>
                ) : (
                  <label className="admin-file-dropzone">
                    <Upload size={20} />
                    <span>Upload incident photo or banner (PNG, JPG, max 5MB)</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleImageSelect}
                      style={{ display: "none" }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Location & GPS */}
            <label className="sc-admin-field">
              <span>Location Name</span>
              <input
                type="text"
                placeholder="e.g. Main Road Crossing / Sector 4"
                value={form.locationName}
                onChange={(e) => setForm({ ...form, locationName: e.target.value })}
              />
            </label>

            <div className="sc-admin-form-row-2">
              <label className="sc-admin-field">
                <span>GPS Latitude</span>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 22.5726"
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                />
              </label>
              <label className="sc-admin-field">
                <span>GPS Longitude</span>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 88.3639"
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                />
              </label>
            </div>

            <button
              type="button"
              className="secondary-button small"
              onClick={handleGetCurrentGps}
              style={{ width: "fit-content", marginBottom: 8, gridColumn: "1 / -1" }}
            >
              <MapPin size={13} /> Use My Current GPS Location
            </button>

            {/* Target Audience */}
            <div className="sc-admin-field" style={{ gridColumn: "1 / -1" }}>
              <span>Target Audience</span>
              <small className="admin-audience-help">Choose who should receive this notice.</small>
              <div className="admin-radio-group">
                <label className={`admin-radio-label${form.audienceType === "all" ? " selected" : ""}`}>
                  <input
                    type="radio"
                    name="audienceType"
                    checked={form.audienceType === "all"}
                    onChange={() => setForm({ ...form, audienceType: "all", targetUserId: "", targetUserIds: [] })}
                  />
                  <span><strong>All Users (Public Notice)</strong><small>Sent to everyone</small></span>
                </label>
                <label className={`admin-radio-label${form.audienceType === "specific" ? " selected" : ""}`}>
                  <input
                    type="radio"
                    name="audienceType"
                    checked={form.audienceType === "specific"}
                    onChange={() => setForm({ ...form, audienceType: "specific", targetUserIds: [] })}
                  />
                  <span><strong>Specific User</strong><small>Send this notice to one user</small></span>
                </label>
                <label className={`admin-radio-label${form.audienceType === "selected" ? " selected" : ""}`}>
                  <input
                    type="radio"
                    name="audienceType"
                    checked={form.audienceType === "selected"}
                    onChange={() => setForm({ ...form, audienceType: "selected", targetUserId: "" })}
                  />
                  <span><strong>Selected Users</strong><small>Send to chosen users</small></span>
                </label>
              </div>

              {form.audienceType === "specific" && (
                <div style={{ marginTop: 8 }}>
                  <select
                    className="sc-admin-select"
                    value={form.targetUserId}
                    onChange={(e) => setForm({ ...form, targetUserId: e.target.value })}
                  >
                    <option value="">Select target user...</option>
                    {users.map((u) => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.name || "User"} ({u.email || u.user_id})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {form.audienceType === "selected" && (
                <div style={{ marginTop: 8 }} className="admin-user-multiselect">
                  <span>Select users:</span>
                  <div className="admin-user-checkbox-list">
                    {users.map((u) => {
                      const checked = form.targetUserIds.includes(u.user_id);
                      return (
                        <label key={u.user_id} className="admin-user-checkbox-item">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setForm({ ...form, targetUserIds: [...form.targetUserIds, u.user_id] });
                              } else {
                                setForm({ ...form, targetUserIds: form.targetUserIds.filter((id) => id !== u.user_id) });
                              }
                            }}
                          />
                          <span>{u.name || "User"} ({u.email || u.user_id})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="primary-button"
              disabled={publishing}
              style={{ marginTop: 12, gridColumn: "1 / -1" }}
            >
              <Save size={15} />
              {publishing ? "Publishing & Notifying Users..." : "Publish Notice"}
            </button>
          </form>
        </div>

        {/* Existing Notices List */}
        <div className="sc-admin-panel">
          <div className="sc-admin-panel-head">
            <div>
              <h3>Published Notices ({notices.length})</h3>
              <p>Manage community notices, edit details, or archive outdated entries.</p>
            </div>
          </div>

          <div className="sc-admin-table-wrap">
            <table className="sc-admin-table">
              <thead>
                <tr>
                  <th>Notice</th>
                  <th>Audience</th>
                  <th>Category</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {notices.map((n) => (
                  <tr key={n.id} className={n.archived ? "admin-row-archived" : ""}>
                    <td>
                      <div className="admin-notice-cell">
                        {n.imageUrl ? (
                          <img src={n.imageUrl} alt="" className="admin-notice-cell-thumb" />
                        ) : (
                          <div className="admin-notice-cell-placeholder">
                            <Radio size={14} />
                          </div>
                        )}
                        <div>
                          <strong>{n.title}</strong>
                          <small>
                            {n.locationName || (n.latitude ? `GPS: ${n.latitude}, ${n.longitude}` : "No GPS")}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="sc-admin-pill">
                        {n.audienceType === "all" ? "All Users" : n.audienceType === "specific" ? "Single User" : "Selected"}
                      </span>
                    </td>
                    <td>{n.category || "General"}</td>
                    <td>
                      <span className={`notice-badge ${String(n.severity || "").toLowerCase()}`}>
                        {n.severity}
                      </span>
                    </td>
                    <td>
                      <span className={`admin-status-tag ${n.archived ? "archived" : "active"}`}>
                        {n.archived ? "Archived" : "Published"}
                      </span>
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <button
                          type="button"
                          className="sc-admin-table-action"
                          onClick={() => startEdit(n)}
                          title="Edit notice"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          className="sc-admin-table-action"
                          onClick={() => handleArchive(n)}
                          title={n.archived ? "Restore notice" : "Archive notice"}
                        >
                          <Archive size={13} />
                        </button>
                        <button
                          type="button"
                          className="sc-admin-table-action danger"
                          onClick={() => handleDeletePermanent(n.id)}
                          title="Delete permanently"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {notices.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "28px" }}>
                      <span style={{ color: "var(--muted)", fontSize: "12px" }}>
                        No notices published yet. Use the form on the left to create one.
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Notice Modal */}
      {editingNotice && editForm && (
        <div className="account-confirm-backdrop" role="presentation" onClick={() => setEditingNotice(null)}>
          <div
            className="notice-edit-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-notice-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sc-admin-panel-head">
              <div>
                <h3 id="edit-notice-title">Edit Notice</h3>
                <p>Update title, description, or parameters for this notice.</p>
              </div>
              <button
                type="button"
                className="notice-modal-close"
                onClick={() => setEditingNotice(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form className="sc-admin-form-grid" onSubmit={handleSaveEdit}>
              <label className="sc-admin-field">
                <span>Title</span>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />
              </label>

              <label className="sc-admin-field">
                <span>Description</span>
                <textarea
                  required
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </label>

              <div className="sc-admin-form-row-2">
                <label className="sc-admin-field">
                  <span>Category</span>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  >
                    <option value="Infrastructure">Infrastructure</option>
                    <option value="Safety">Safety</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Weather">Weather</option>
                    <option value="Traffic">Traffic</option>
                    <option value="General">General</option>
                  </select>
                </label>

                <label className="sc-admin-field">
                  <span>Severity</span>
                  <select
                    value={editForm.severity}
                    onChange={(e) => setEditForm({ ...editForm, severity: e.target.value })}
                  >
                    <option value="Info">Info</option>
                    <option value="Warning">Warning</option>
                    <option value="Danger">Danger</option>
                    <option value="Success">Success</option>
                  </select>
                </label>
              </div>

              <div className="sc-admin-form-row-2">
                <label className="sc-admin-field">
                  <span>GPS Latitude</span>
                  <input
                    type="number"
                    step="any"
                    value={editForm.latitude}
                    onChange={(e) => setEditForm({ ...editForm, latitude: e.target.value })}
                  />
                </label>
                <label className="sc-admin-field">
                  <span>GPS Longitude</span>
                  <input
                    type="number"
                    step="any"
                    value={editForm.longitude}
                    onChange={(e) => setEditForm({ ...editForm, longitude: e.target.value })}
                  />
                </label>
              </div>

              <div className="account-confirm-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setEditingNotice(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={updating}
                >
                  <Save size={14} />
                  {updating ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
