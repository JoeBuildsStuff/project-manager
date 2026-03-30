'use client'

import {
  deleteAttachmentBySrc,
  resolveAttachmentUrl,
  uploadNoteAttachment,
} from './note-attachments'

export interface SupabaseFileUploadOptions {
  documentId?: string
  bucket: string
  pathPrefix?: string
  maxFileSize?: number
  allowedMimeTypes?: string[]
}

export interface FileUploadResult {
  success: boolean
  url?: string
  filePath?: string
  error?: string
}

export interface FileDeleteResult {
  success: boolean
  error?: string
}

export interface FileServeResult {
  success: boolean
  url?: string
  error?: string
}

const DEFAULT_OPTIONS: Required<Omit<SupabaseFileUploadOptions, 'documentId'>> = {
  bucket: 'tiptap-bucket-files',
  pathPrefix: 'notes',
  maxFileSize: 10 * 1024 * 1024,
  allowedMimeTypes: [
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
  ],
}

export async function uploadFile(
  file: File,
  options: Partial<SupabaseFileUploadOptions> = {}
): Promise<FileUploadResult> {
  const config = { ...DEFAULT_OPTIONS, ...options }
  const result = await uploadNoteAttachment(file, {
    documentId: options.documentId,
    maxFileSize: config.maxFileSize,
    allowedMimeTypes: config.allowedMimeTypes,
  })

  return {
    success: result.success,
    url: result.filePath,
    filePath: result.filePath,
    error: result.error,
  }
}

export async function deleteFile(filePath: string): Promise<FileDeleteResult> {
  try {
    await deleteAttachmentBySrc(filePath)
    return { success: true }
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

export async function getFileUrl(filePath: string): Promise<FileServeResult> {
  try {
    const url = await resolveAttachmentUrl(filePath)
    return {
      success: true,
      url,
    }
  } catch (error) {
    console.error(`Error getting file URL for ${filePath}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

export async function deleteFiles(filePaths: string[]): Promise<void> {
  if (filePaths.length === 0) return

  const deletePromises = filePaths.map((path) => deleteFile(path))
  await Promise.allSettled(deletePromises)
}

export function createFileUploader(options: Partial<SupabaseFileUploadOptions> = {}) {
  return (file: File) => uploadFile(file, options)
}

export const uploadFileToSupabase = uploadFile
export const deleteFileFromStorage = deleteFile
export const cleanupFiles = deleteFiles
export const cleanupImages = deleteFiles
export const deleteImageFromStorage = deleteFile
