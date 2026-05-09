'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { ProjectFull, ProjectFile } from '../_types'

export default function FilesTab({
  project,
  onChange,
  canManage,
}: {
  project: ProjectFull
  onChange: () => void
  canManage: boolean
}) {
  const [files, setFiles] = useState<ProjectFile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/files`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = await res.json()
      setFiles(j.files || [])
      setError(null)
    } catch (e) { setError((e as Error).message) }
  }, [project.id])

  useEffect(() => { load() }, [load])

  /**
   * Files are stored as data URLs in this build. The metadata row keeps the
   * `blob_url` field set to a `data:<type>;base64,...` payload, which lets us
   * defer setting up a real Vercel Blob bucket. We cap the size at ~3 MB; for
   * larger files we surface a clear error so the user can downscale or wait
   * for the Blob integration.
   */
  async function uploadOne(file: File) {
    const MAX = 3 * 1024 * 1024
    if (file.size > MAX) {
      throw new Error(`"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB — file storage is capped at ${MAX / 1024 / 1024} MB until Vercel Blob is connected.`)
    }
    const dataUrl = await readAsDataUrl(file)
    const res = await fetch(`/api/projects/${project.id}/files`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: file.name,
        content_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        blob_url: dataUrl,
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `HTTP ${res.status}`)
    }
  }

  async function handleFiles(list: FileList | File[]) {
    const arr = Array.from(list)
    if (!arr.length) return
    setUploading(true); setError(null)
    try {
      for (const f of arr) await uploadOne(f)
      onChange()
      load()
    } catch (e) { setError((e as Error).message) } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this file? This cannot be undone.')) return
    await fetch(`/api/projects/${project.id}/files/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-hairline pb-3 mb-5">
        <div>
          <div className="font-mono text-[10.5px] tracking-[0.1em] uppercase text-ink-muted">
            context files
          </div>
          <h2 className="font-serif italic text-[26px] text-ink leading-tight mt-1">
            Source material on tap.
          </h2>
        </div>
        {canManage && (
          <>
            <input
              type="file"
              multiple
              ref={inputRef}
              onChange={e => e.target.files && handleFiles(e.target.files)}
              className="hidden"
            />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="font-mono text-[11px] tracking-[0.08em] uppercase bg-ink text-bg px-4 py-2 hover:bg-ink-soft disabled:opacity-50 transition-colors"
            >
              {uploading ? 'Uploading…' : 'Upload →'}
            </button>
          </>
        )}
      </div>

      {/* drop zone */}
      {canManage && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files) }}
          className="border border-dashed border-hairline px-6 py-8 mb-6 text-center text-[13px] text-ink-soft italic font-serif"
        >
          Drop files here, or use the Upload button.
          <div className="font-mono not-italic text-[10px] tracking-[0.06em] text-ink-muted mt-2">
            uploaded files become part of every chat&apos;s context for this project.
          </div>
        </div>
      )}

      {error && <div className="font-mono text-[11px] text-accent mb-4">{error}</div>}

      {files === null ? (
        <div className="font-mono text-[11px] tracking-[0.08em] uppercase text-ink-muted py-8 text-center">
          loading files…
        </div>
      ) : files.length === 0 ? (
        <div className="text-[14px] text-ink-soft italic font-serif text-center py-12 border border-hairline">
          No files yet.
        </div>
      ) : (
        <div className="border-t border-hairline">
          {files.map((f, idx) => (
            <div key={f.id} className="grid grid-cols-[40px_1fr_120px_100px_auto] gap-4 items-center px-2 py-3 border-b border-hairline group">
              <div className="font-mono text-[10px] tracking-[0.08em] text-ink-muted tabular-nums">
                {String(idx + 1).padStart(2, '0')}
              </div>
              <a
                href={f.blob_url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0"
              >
                <div className="text-[14px] text-ink truncate group-hover:text-accent transition-colors">{f.name}</div>
                <div className="font-mono text-[10px] tracking-[0.06em] text-ink-muted truncate mt-0.5">
                  {f.content_type ?? 'unknown'}
                </div>
              </a>
              <span className="font-mono text-[11px] text-ink-muted tabular-nums text-right">
                {humanSize(f.size_bytes)}
              </span>
              <span className="font-mono text-[10px] text-ink-muted">
                {new Date(f.created_at).toLocaleDateString()}
              </span>
              {canManage && (
                <button
                  onClick={() => remove(f.id)}
                  className="opacity-0 group-hover:opacity-100 font-mono text-[10px] tracking-[0.06em] text-ink-muted hover:text-accent transition-all px-2"
                >
                  delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

function humanSize(bytes: number): string {
  if (!bytes) return '—'
  const u = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`
}
