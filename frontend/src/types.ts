export type Media = {
  id: string;
  original_filename: string;
  storage_path: string;
  thumb_path: string | null;
  mime_type: string | null;
  media_type: string;
  size_bytes: number;
  width?: number | null;
  height?: number | null;
  captured_at: string | null;
  imported_at: string;
  season?: string | null;
  has_gps?: boolean;
  camera_make?: string | null;
  camera_model?: string | null;
  face_count?: number;
};

export type Face = {
  id: string;
  person_id: string | null;
  bbox_x: number;
  bbox_y: number;
  bbox_w: number;
  bbox_h: number;
  confidence: number;
};

export type MediaDetail = Media & {
  gps_lat?: number | null;
  gps_lon?: number | null;
  gps_altitude?: number | null;
  orientation?: number | null;
  location_text?: string | null;
  faces?: Face[];
};

export type Person = {
  id: string;
  name: string | null;
  is_named: boolean;
  face_count: number;
};

export type ShareResponse = {
  filters: Record<string, unknown>;
  items: Media[];
};
