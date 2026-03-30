'use client'

import { invoke } from '@tauri-apps/api/core'

export const ATTACHMENT_PREFIX = 'attachment:'

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024

const DEFAULT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/json',
  'text/csv',
  'text/html',
  'text/css',
]

type SaveNoteAttachmentResponse = {
  id: string
}

type NoteAttachmentPayload = {
  id: string
  mime: string
  filename?: string | null
  bytes: number[]
}

type UploadAttachmentOptions = {
  documentId?: string
  maxFileSize?: number
  allowedMimeTypes?: string[]
}

const attachmentUrlCache = new Map<string, Promise<string>>()

export function isAttachmentRef(src: string): boolean {
  return src.startsWith(ATTACHMENT_PREFIX)
}

export function attachmentRef(attachmentId: string): string {
  return `${ATTACHMENT_PREFIX}${attachmentId}`
}

export function extractAttachmentId(src: string): string | null {
  if (!isAttachmentRef(src)) {
    return null
  }

  const attachmentId = src.slice(ATTACHMENT_PREFIX.length).trim()
  return attachmentId.length > 0 ? attachmentId : null
}

export async function uploadNoteAttachment(
  file: File,
  options: UploadAttachmentOptions = {}
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  const maxFileSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE
  const allowedMimeTypes = options.allowedMimeTypes ?? DEFAULT_ALLOWED_MIME_TYPES

  if (!options.documentId) {
    return {
      success: false,
      error: 'A document id is required for note attachments.',
    }
  }

  if (file.size > maxFileSize) {
    return {
      success: false,
      error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum size: ${(maxFileSize / 1024 / 1024).toFixed(1)}MB`,
    }
  }

  if (file.type && !allowedMimeTypes.includes(file.type)) {
    return {
      success: false,
      error: `Unsupported file type: ${file.type}.`,
    }
  }

  try {
    const bytes = Array.from(new Uint8Array(await file.arrayBuffer()))
    const result = await invoke<SaveNoteAttachmentResponse>('save_note_attachment', {
      documentId: options.documentId,
      bytes,
      mime: file.type || 'application/octet-stream',
      filename: file.name || null,
    })

    return {
      success: true,
      filePath: attachmentRef(result.id),
    }
  } catch (error) {
    console.error('Unexpected error in note attachment upload:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

async function createObjectUrlForAttachment(attachmentId: string): Promise<string> {
  const payload = await invoke<NoteAttachmentPayload>('get_note_attachment', {
    attachmentId,
  })

  const blob = new Blob([new Uint8Array(payload.bytes)], {
    type: payload.mime || 'application/octet-stream',
  })

  return URL.createObjectURL(blob)
}

export async function resolveAttachmentUrl(src: string): Promise<string> {
  const attachmentId = extractAttachmentId(src)
  if (!attachmentId) {
    if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('blob:')) {
      return src
    }

    const response = await fetch(`/api/files/serve?path=${encodeURIComponent(src)}`)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Failed to fetch file: ${response.status} - ${errorData.error || 'Unknown error'}`)
    }

    const data = await response.json()
    const fileUrl = data.fileUrl || data.url
    if (!fileUrl) {
      throw new Error('Invalid response from file API')
    }

    return fileUrl
  }

  let pendingUrl = attachmentUrlCache.get(attachmentId)
  if (!pendingUrl) {
    pendingUrl = createObjectUrlForAttachment(attachmentId)
    attachmentUrlCache.set(attachmentId, pendingUrl)
  }

  try {
    return await pendingUrl
  } catch (error) {
    attachmentUrlCache.delete(attachmentId)
    throw error
  }
}

export async function deleteAttachmentBySrc(src: string): Promise<void> {
  const attachmentId = extractAttachmentId(src)
  if (!attachmentId) {
    return
  }

  const cachedUrl = attachmentUrlCache.get(attachmentId)
  attachmentUrlCache.delete(attachmentId)

  if (cachedUrl) {
    cachedUrl.then((url) => URL.revokeObjectURL(url)).catch(() => {})
  }

  await invoke('delete_note_attachment', { attachmentId })
}
