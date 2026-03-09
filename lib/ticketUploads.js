const DEFAULT_BUCKET = "ticket-pdfs";
const PENDING_EVENT_SEGMENT = "pending";

function cleanSegment(value, fallback) {
  const normalized = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 80);

  return normalized || fallback;
}

export function getTicketUploadBucket(upload) {
  return upload?.storage_bucket || DEFAULT_BUCKET;
}

export function getTicketUploadShortHash(input) {
  const source = String(input || "").replace(/[^a-zA-Z0-9]/g, "");
  return (source || "upload").slice(0, 12);
}

export function buildTicketUploadStagingPath({ eventId, userId, uploadId, sha256 }) {
  const eventSegment = cleanSegment(eventId, PENDING_EVENT_SEGMENT);
  const userSegment = cleanSegment(userId, "unknown");
  const uploadSegment = cleanSegment(uploadId, "upload");
  const shortHash = getTicketUploadShortHash(sha256 || uploadId);

  return `uploads/staging/events/${eventSegment}/users/${userSegment}/${uploadSegment}-${shortHash}.pdf`;
}

export function buildTicketUploadFinalPath({ eventId, userId, ticketId, uploadId, sha256 }) {
  const eventSegment = cleanSegment(eventId, PENDING_EVENT_SEGMENT);
  const userSegment = cleanSegment(userId, "unknown");
  const ticketSegment = cleanSegment(ticketId, "ticket");
  const uploadSegment = cleanSegment(uploadId, "upload");
  const shortHash = getTicketUploadShortHash(sha256 || uploadId);

  return `uploads/events/${eventSegment}/users/${userSegment}/tickets/${ticketSegment}/${uploadSegment}-${shortHash}.pdf`;
}

export function getTicketUploadEffectivePath(upload) {
  return (
    upload?.storage_path_final ||
    upload?.storage_path ||
    upload?.storage_path_staging ||
    upload?.file_path ||
    null
  );
}

export function getTicketUploadOwnerId(upload) {
  return upload?.user_id || upload?.seller_id || null;
}

export function shouldMoveUploadsOnPublish() {
  const raw = String(process.env.MOVE_UPLOADS_ON_PUBLISH || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export async function createTicketUploadSignedUrl(supabase, upload, expiresIn = 60 * 30) {
  const path = getTicketUploadEffectivePath(upload);
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(getTicketUploadBucket(upload))
    .createSignedUrl(path, expiresIn);

  if (error) {
    console.error("[ticketUploads] createSignedUrl error:", error);
    return null;
  }

  return data?.signedUrl || null;
}

export async function finalizeTicketUpload({
  supabase,
  upload,
  ticketId,
  eventId,
  userId,
}) {
  const bucket = getTicketUploadBucket(upload);
  const ownerId = userId || getTicketUploadOwnerId(upload);
  const sourcePath = getTicketUploadEffectivePath(upload);
  const finalPath = buildTicketUploadFinalPath({
    eventId,
    userId: ownerId,
    ticketId,
    uploadId: upload.id,
    sha256: upload?.sha256 || upload?.file_hash || upload?.id,
  });

  let effectivePath = sourcePath;
  let moved = false;
  let moveError = null;

  if (shouldMoveUploadsOnPublish() && sourcePath && sourcePath !== finalPath) {
    const { error: copyErr } = await supabase.storage.from(bucket).copy(sourcePath, finalPath);

    if (copyErr) {
      moveError = copyErr.message || "copy_failed";
      console.error("[ticketUploads] copy to final failed:", {
        uploadId: upload.id,
        sourcePath,
        finalPath,
        error: moveError,
      });
    } else {
      const { error: removeErr } = await supabase.storage.from(bucket).remove([sourcePath]);
      if (removeErr) {
        console.error("[ticketUploads] remove staging after copy failed:", {
          uploadId: upload.id,
          sourcePath,
          error: removeErr.message || removeErr,
        });
      }

      moved = true;
      effectivePath = finalPath;
    }
  }

  const updatePayload = {
    user_id: ownerId,
    seller_id: ownerId,
    event_id: eventId || upload?.event_id || null,
    ticket_id: ticketId,
    status: "finalized",
    storage_bucket: bucket,
    storage_path: effectivePath,
    storage_path_staging: upload?.storage_path_staging || sourcePath || null,
    storage_path_final:
      moved || sourcePath === finalPath
        ? finalPath
        : upload?.storage_path_final || null,
  };

  const { data: updatedUpload, error: updateErr } = await supabase
    .from("ticket_uploads")
    .update(updatePayload)
    .eq("id", upload.id)
    .select(
      "id,user_id,seller_id,event_id,ticket_id,status,storage_bucket,storage_path,storage_path_staging,storage_path_final"
    )
    .maybeSingle();

  return {
    moved,
    moveError,
    finalPath,
    effectivePath,
    updatedUpload,
    updateError: updateErr,
  };
}
