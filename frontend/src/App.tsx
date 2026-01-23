import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import type { Face, Media, MediaDetail, Person } from "./types";

const PAGE_SIZE = 48;

const seasons = ["winter", "spring", "summer", "fall"];

export default function App() {
  const [people, setPeople] = useState<Person[]>([]);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("hss_token"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [renameBusy, setRenameBusy] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState("");
  const [mergeSources, setMergeSources] = useState<string[]>([]);
  const [shareLink, setShareLink] = useState("");
  const [sharedToken, setSharedToken] = useState<string | null>(null);
  const [toastQueue, setToastQueue] = useState<{ id: number; message: string; tone: "good" | "bad" }[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [season, setSeason] = useState("");
  const [hasFaces, setHasFaces] = useState("");
  const [mediaType, setMediaType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [cameraMake, setCameraMake] = useState("");
  const [cameraModel, setCameraModel] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api.setToken(token);
    if (token) {
      localStorage.setItem("hss_token", token);
    } else {
      localStorage.removeItem("hss_token");
    }
  }, [token]);

  useEffect(() => {
    api.listPeople().then(setPeople).catch(() => setPeople([]));
  }, [token]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const share = params.get("share");
    if (share) {
      setSharedToken(share);
    }
  }, []);

  const filterKey = useMemo(
    () =>
      JSON.stringify({
        selectedPeople,
        season,
        hasFaces,
        mediaType,
        dateFrom,
        dateTo,
        cameraMake,
        cameraModel,
        search
      }),
    [selectedPeople, season, hasFaces, mediaType, dateFrom, dateTo, cameraMake, cameraModel, search]
  );

  useEffect(() => {
    setOffset(0);
    setMedia([]);
    void loadMore(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || sharedToken) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          void loadMore(false);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sharedToken, loading, offset, filterKey]);

  async function loadMore(reset = false) {
    if (loading) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {
        limit: String(PAGE_SIZE),
        offset: String(reset ? 0 : offset)
      };
      if (selectedPeople.length) params.person_ids = selectedPeople.join(",");
      if (season) params.season = season;
      if (mediaType) params.media_type = mediaType;
      if (hasFaces) params.has_faces = hasFaces;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (cameraMake) params.camera_make = cameraMake;
      if (cameraModel) params.camera_model = cameraModel;
      if (search) params.q = search;

      const items = sharedToken ? (await api.getShare(sharedToken)).items : await api.listMedia(params);
      setMedia((prev) => (reset ? items : [...prev, ...items]));
      setOffset((prev) => (reset ? PAGE_SIZE : prev + PAGE_SIZE));
    } finally {
      setLoading(false);
    }
  }

  function togglePerson(id: string) {
    setSelectedPeople((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function openDetail(item: Media) {
    const result = await api.getMedia(item.id);
    setDetail(result);
  }

  async function handleLogin() {
    setAuthError("");
    try {
      const accessToken = await api.login(email, password);
      setToken(accessToken);
      setPassword("");
    } catch (err) {
      setAuthError("Login failed");
    }
  }

  function handleLogout() {
    setToken(null);
  }

  async function handleUpload(files: FileList | null) {
    if (!files || !files.length) return;
    setUploadBusy(true);
    setUploadProgress(0);
    try {
      await api.upload(files, (value) => setUploadProgress(value));
      await api.listPeople().then(setPeople);
      await loadMore(true);
      pushToast("Upload complete", "good");
    } finally {
      setUploadBusy(false);
      setUploadProgress(0);
    }
  }

  async function handleRename(person: Person, name: string) {
    if (!name.trim()) return;
    setRenameBusy(person.id);
    try {
      const updated = await api.renamePerson(person.id, name.trim());
      setPeople((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } finally {
      setRenameBusy(null);
    }
  }

  async function handleMerge() {
    if (!mergeTarget || mergeSources.length < 1) return;
    await api.mergePeople(mergeTarget, mergeSources);
    setMergeSources([]);
    setMergeTarget("");
    api.listPeople().then(setPeople).catch(() => setPeople([]));
    pushToast("Merged people", "good");
  }

  function pushToast(message: string, tone: "good" | "bad") {
    const id = Date.now();
    setToastQueue((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToastQueue((prev) => prev.filter((item) => item.id !== id));
    }, 2800);
  }

  async function handleCreateShare() {
    const filters = {
      person_ids: selectedPeople,
      season,
      media_type: mediaType,
      has_faces: hasFaces,
      date_from: dateFrom,
      date_to: dateTo,
      camera_make: cameraMake,
      camera_model: cameraModel,
      q: search
    };
    try {
      const data = await api.createShare(filters);
      const url = `${window.location.origin}?share=${data.token}`;
      setShareLink(url);
      navigator.clipboard?.writeText(url);
      pushToast("Share link copied", "good");
    } catch (err) {
      pushToast("Share link failed", "bad");
    }
  }

  return (
    <div className="min-h-screen text-ink">
      <header className="app-header">
        <div>
          <p className="eyebrow">HomeSnapShare</p>
          <h1 className="headline">Private memories, mapped in your own orbit.</h1>
          {sharedToken && <p className="shared-banner">Shared view: read-only</p>}
        </div>
        <div className="search-wrap">
          <input
            className="search-input"
            placeholder="Search: person:Alice season:summer date:2025-07"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="button-ember" onClick={() => loadMore(true)} disabled={!!sharedToken}>
            Refresh
          </button>
        </div>
      </header>

      <main className="app-shell">
        <aside className="filters">
          <section className="panel">
            <h2>Auth</h2>
            {token ? (
              <div className="auth-row">
                <span className="muted">Logged in</span>
                <button className="button-ghost" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            ) : (
              <div className="auth-form">
                <label className="field">
                  <span>Email</span>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
                </label>
                <label className="field">
                  <span>Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="admin123"
                  />
                </label>
                {authError && <p className="error">{authError}</p>}
                <button className="button-ember" onClick={handleLogin}>
                  Login
                </button>
              </div>
            )}
          </section>

          <section className="panel">
            <h2>Upload</h2>
            <label className="upload-box">
              <input
                type="file"
                multiple
                onChange={(e) => handleUpload(e.target.files)}
                disabled={!token || uploadBusy || !!sharedToken}
              />
              <span>{token ? "Drop files or click to upload" : "Login to upload"}</span>
            </label>
            {uploadBusy && (
              <p className="muted">Uploading... {uploadProgress ? `${Math.round(uploadProgress)}%` : ""}</p>
            )}
          </section>

          <section className="panel">
            <h2>People</h2>
            <div className="chip-grid">
              {people.map((person) => (
                <button
                  key={person.id}
                  className={selectedPeople.includes(person.id) ? "chip active" : "chip"}
                  onClick={() => togglePerson(person.id)}
                >
                  {person.name || "Unknown"}
                </button>
              ))}
              {!people.length && <p className="muted">No people detected yet.</p>}
            </div>
          </section>

          <section className="panel">
            <h2>Seasons</h2>
            <div className="chip-grid">
              {seasons.map((item) => (
                <button
                  key={item}
                  className={season === item ? "chip active" : "chip"}
                  onClick={() => setSeason(season === item ? "" : item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>Manage People</h2>
            <div className="manage-people">
              {people.map((person) => (
                <div className="person-row" key={person.id}>
                  <input
                    defaultValue={person.name || ""}
                    placeholder="Unnamed"
                    onBlur={(e) => handleRename(person, e.target.value)}
                    disabled={!token || renameBusy === person.id || !!sharedToken}
                  />
                  <span className="muted">{person.face_count}</span>
                </div>
              ))}
            </div>
            <div className="merge-box">
              <label className="field">
                <span>Merge into</span>
                <select value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)} disabled={!token}>
                  <option value="">Select target</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name || "Unknown"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Sources</span>
                <select
                  multiple
                  value={mergeSources}
                  onChange={(e) =>
                    setMergeSources(Array.from(e.target.selectedOptions).map((option) => option.value))
                  }
                  disabled={!token || !!sharedToken}
                >
                  {people
                    .filter((person) => person.id !== mergeTarget)
                    .map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name || "Unknown"}
                      </option>
                    ))}
                </select>
              </label>
              <button className="button-ghost" onClick={handleMerge} disabled={!token || !!sharedToken}>
                Merge
              </button>
            </div>
          </section>

          <section className="panel">
            <h2>Share</h2>
            <button className="button-ghost" onClick={handleCreateShare} disabled={!token || !!sharedToken}>
              Create share link
            </button>
            {shareLink && <p className="muted">{shareLink}</p>}
          </section>

          <section className="panel">
            <h2>Filters</h2>
            <label className="field">
              <span>Has faces</span>
              <select value={hasFaces} onChange={(e) => setHasFaces(e.target.value)} disabled={!!sharedToken}>
                <option value="">Any</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
            <label className="field">
              <span>Media type</span>
              <select value={mediaType} onChange={(e) => setMediaType(e.target.value)} disabled={!!sharedToken}>
                <option value="">Any</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
            </label>
            <label className="field">
              <span>Date from</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                disabled={!!sharedToken}
              />
            </label>
            <label className="field">
              <span>Date to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                disabled={!!sharedToken}
              />
            </label>
            <label className="field">
              <span>Camera make</span>
              <input
                value={cameraMake}
                onChange={(e) => setCameraMake(e.target.value)}
                placeholder="Canon"
                disabled={!!sharedToken}
              />
            </label>
            <label className="field">
              <span>Camera model</span>
              <input
                value={cameraModel}
                onChange={(e) => setCameraModel(e.target.value)}
                placeholder="iPhone"
                disabled={!!sharedToken}
              />
            </label>
          </section>
        </aside>

        <section className="timeline">
          <div className="grid">
            {media.map((item) => (
              <button key={item.id} className="card" onClick={() => openDetail(item)}>
                <div className="thumb">
                  {item.thumb_path ? (
                    <img src={`${api.base}/thumbs/${item.thumb_path}`} alt={item.original_filename} />
                  ) : (
                    <div className="thumb-placeholder">{item.media_type}</div>
                  )}
                </div>
                <div className="card-meta">
                  <span className="filename">{item.original_filename}</span>
                  <span className="muted">
                    {item.captured_at ? new Date(item.captured_at).toLocaleDateString() : "No date"} •{" "}
                    {item.season || "Season?"}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="load-more">
            <button
              className="button-ghost"
              onClick={() => loadMore(false)}
              disabled={loading || !!sharedToken}
            >
              {loading ? "Loading..." : "Load more"}
            </button>
          </div>
          <div ref={sentinelRef} />
        </section>
      </main>

      {detail && (
        <DetailModal
          detail={detail}
          canDelete={!!token && !sharedToken}
          onDelete={async (id) => {
            if (!confirm("Delete this media? This cannot be undone.")) return;
            try {
              await api.deleteMedia(id);
              setMedia((prev) => prev.filter((item) => item.id !== id));
              setDetail(null);
              pushToast("Deleted media", "good");
            } catch (err) {
              pushToast("Delete failed", "bad");
            }
          }}
          onClose={() => setDetail(null)}
        />
      )}
      {toastQueue.length > 0 && (
        <div className="toast-stack">
          {toastQueue.map((toast) => (
            <div key={toast.id} className={`toast ${toast.tone}`}>
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailModal({
  detail,
  onClose,
  onDelete,
  canDelete
}: {
  detail: MediaDetail;
  onClose: () => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [boxScale, setBoxScale] = useState({ scaleX: 1, scaleY: 1 });

  useEffect(() => {
    function updateScale() {
      if (!imgRef.current) return;
      const rect = imgRef.current.getBoundingClientRect();
      const naturalWidth = detail.width || imgRef.current.naturalWidth || rect.width;
      const naturalHeight = detail.height || imgRef.current.naturalHeight || rect.height;
      setBoxScale({ scaleX: rect.width / naturalWidth, scaleY: rect.height / naturalHeight });
    }
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [detail]);

  const imageUrl = `${api.base}/media-files/${encodeURI(detail.storage_path)}`;
  const faces = detail.faces || [];

  return (
    <div className="modal">
      <div className="modal-card">
        <div className="modal-actions">
          {canDelete && (
            <button className="button-ghost danger" onClick={() => onDelete(detail.id)}>
              Delete
            </button>
          )}
          <button className="modal-close" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className="detail-image">
            <img src={imageUrl} ref={imgRef} onLoad={() => {}} alt={detail.original_filename} />
            {faces.map((face) => (
              <FaceBox key={face.id} face={face} scaleX={boxScale.scaleX} scaleY={boxScale.scaleY} />
            ))}
          </div>
          <div className="detail-meta">
            <h3>{detail.original_filename}</h3>
            <p className="muted">
              {detail.captured_at ? new Date(detail.captured_at).toLocaleString() : "No timestamp"} •{" "}
              {detail.season || "Season?"}
            </p>
            <div className="meta-grid">
              <div>
                <span className="label">Camera</span>
                <p>{detail.camera_make || "Unknown"} {detail.camera_model || ""}</p>
              </div>
              <div>
                <span className="label">GPS</span>
                <p>{detail.has_gps ? `${detail.gps_lat}, ${detail.gps_lon}` : "No GPS"}</p>
              </div>
              <div>
                <span className="label">Faces</span>
                <p>{detail.face_count || 0}</p>
              </div>
            </div>
            {!!faces.length && (
              <div className="face-list">
                {faces.map((face) => (
                  <div key={face.id} className="face-row">
                    <span>{face.person_id || "Unassigned"}</span>
                    <span className="muted">{face.confidence.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FaceBox({ face, scaleX, scaleY }: { face: Face; scaleX: number; scaleY: number }) {
  return (
    <div
      className="face-box"
      style={{
        left: face.bbox_x * scaleX,
        top: face.bbox_y * scaleY,
        width: face.bbox_w * scaleX,
        height: face.bbox_h * scaleY
      }}
    />
  );
}
