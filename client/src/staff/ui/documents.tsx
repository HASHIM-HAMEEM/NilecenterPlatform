import { useRef, useState, type ReactNode } from "react";
import { Download, Ellipsis, Trash2, Upload } from "lucide-react";
import {
  archiveNccFileRequest,
  openNccFileDownload,
  uploadNccFile,
  type NccFileDto,
  type NccFileEntityType,
  type NccFilePurpose,
} from "../../lib/backend/api";
import { useInvalidate, useNcc } from "../api";
import { copy } from "../copy";
import { formatDate } from "../i18n";
import { runAction } from "../run-action";
import { ConfirmDialog } from "./confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./kit";
import {
  ErrorState,
  LoadingRows,
  StatusBadge,
} from "./primitives";

const F = copy.documents;

function purposeLabel(purpose: string) {
  switch (purpose) {
    case "avatar":
      return F.purposeAvatar;
    case "passport":
      return F.purposePassport;
    case "national_id":
      return F.purposeNationalId;
    case "attachment":
      return F.purposeAttachment;
    default:
      return purpose;
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Private-file card: list, download, archive, and intent-based upload. */
export function DocumentsSection({
  entityType,
  entityId,
  purposes,
  canWrite,
  children,
}: {
  entityType: NccFileEntityType;
  entityId: string;
  purposes: NccFilePurpose[];
  canWrite: boolean;
  children?: ReactNode;
}) {
  const invalidate = useInvalidate();
  const files = useNcc<{ items: NccFileDto[] }>(
    entityId ? "/api/ncc/files" : null,
    { entityType, entityId }
  );
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [purpose, setPurpose] = useState<NccFilePurpose>(purposes[0]!);
  const [picked, setPicked] = useState<File | null>(null);
  const [archiving, setArchiving] = useState<NccFileDto | null>(null);
  // Once storage answers 503 the upload path stays off until the page reloads.
  const [storagePaused, setStoragePaused] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  if (files.error?.status === 403) return null;
  const items = (files.data?.items ?? []).filter(item =>
    (purposes as string[]).includes(item.purpose)
  );
  const canUpload = canWrite && !storagePaused;

  async function doUpload() {
    if (!picked || !entityId) return;
    try {
      await uploadNccFile({
        entityType,
        entityId,
        purpose,
        file: picked,
      });
      setUploadOpen(false);
      setPicked(null);
      if (fileInput.current) fileInput.current.value = "";
      void invalidate("/api/ncc/files");
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "storage_unavailable"
      ) {
        setStoragePaused(true);
        setUploadOpen(false);
        return;
      }
      throw error;
    }
  }

  return (
    <section className="staff-section" aria-label={F.title}>
      <div className="staff-section-head">
        <h2 className="staff-section-title">{F.title}</h2>
        {canWrite ? (
          <button
            type="button"
            className="staff-btn"
            data-size="sm"
            disabled={!canUpload}
            onClick={() => setUploadOpen(true)}
          >
            <Upload strokeWidth={1.75} aria-hidden />
            {F.upload}
          </button>
        ) : null}
      </div>

      {storagePaused ? (
        <p className="staff-banner" data-tone="caution" role="status">
          {F.storagePaused}
        </p>
      ) : null}

      {files.error ? (
        <ErrorState error={files.error} onRetry={() => void files.mutate()} />
      ) : files.isLoading ? (
        <LoadingRows rows={2} />
      ) : items.length === 0 ? (
        <p className="staff-muted">{F.empty}</p>
      ) : (
        <ul className="staff-document-rows">
          {items.map(item => (
            <li key={item.id} className="staff-document-row">
              <span className="staff-document-name" title={item.originalFilename}>
                {item.originalFilename}
              </span>
              <span className="staff-muted">
                {purposeLabel(item.purpose)} · {formatSize(item.sizeBytes)} ·{" "}
                {formatDate(item.createdAt)}
              </span>
              {item.status === "pending" || item.status === "failed" ? (
                <StatusBadge
                  status={item.status}
                  label={
                    item.status === "pending" ? F.statusPending : F.statusFailed
                  }
                />
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="staff-icon-btn"
                    aria-label={copy.actions.rowActions}
                  >
                    <Ellipsis strokeWidth={1.75} aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() =>
                      runAction(() => openNccFileDownload(item.id), {
                        error: copy.state.errorGeneric,
                      })
                    }
                  >
                    <Download strokeWidth={1.75} aria-hidden />
                    {F.download}
                  </DropdownMenuItem>
                  {canWrite ? (
                    <DropdownMenuItem onSelect={() => setArchiving(item)}>
                      <Trash2 strokeWidth={1.75} aria-hidden />
                      {F.archive}
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}
      {children}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{F.upload}</DialogTitle>
            <DialogDescription className="sr-only">{F.title}</DialogDescription>
          </DialogHeader>
          <div className="staff-form-grid">
            {purposes.length > 1 ? (
              <label className="flex flex-col gap-1">
                <span className="staff-muted text-sm">{F.purpose}</span>
                <Select
                  value={purpose}
                  onValueChange={next => setPurpose(next as NccFilePurpose)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {purposes.map(option => (
                      <SelectItem key={option} value={option}>
                        {purposeLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            ) : null}
            <label className="flex flex-col gap-1">
              <span className="staff-muted text-sm">{F.file}</span>
              <input
                ref={fileInput}
                type="file"
                className="staff-input"
                onChange={event => setPicked(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <DialogFooter>
            <button
              type="button"
              className="staff-btn"
              data-variant="primary"
              data-busy={uploading || undefined}
              disabled={!picked || uploading}
              onClick={() => {
                setUploading(true);
                void runAction(() => doUpload(), {
                  error: copy.state.errorGeneric,
                }).finally(() => setUploading(false));
              }}
            >
              {uploading ? F.uploading : F.upload}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={open => {
          if (!open) setArchiving(null);
        }}
        title={F.archiveTitle}
        description={F.archiveBody}
        confirmLabel={F.archive}
        onConfirm={async () => {
          if (!archiving) return;
          await archiveNccFileRequest(archiving.id);
          setArchiving(null);
          void invalidate("/api/ncc/files");
        }}
      />
    </section>
  );
}
