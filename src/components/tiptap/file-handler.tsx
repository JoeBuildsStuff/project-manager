'use client'

import { Editor } from '@tiptap/react'
import { FileHandler } from '@tiptap/extension-file-handler'
import { FileNodeAttributes } from './file-node'
import { uploadFile } from './supabase-file-manager'

interface FileHandlerConfigProps {
  onFileDrop?: (files: File[]) => void
  fileUploadConfig?: {
    documentId?: string
    supabaseBucket?: string
    pathPrefix?: string
    maxFileSize?: number
    allowedMimeTypes?: string[]
  }
}

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024

export const createFileHandlerConfig = ({ onFileDrop, fileUploadConfig }: FileHandlerConfigProps = {}) => {
  const handleFiles = async (currentEditor: Editor, files: File[], pos?: number) => {
    if (onFileDrop) {
      onFileDrop(files)
    }
    
    for (const file of files) {
      try {
        if (file.type.startsWith('image/')) {
          const maxFileSize = fileUploadConfig?.maxFileSize ?? DEFAULT_MAX_FILE_SIZE

          if (file.size > maxFileSize) {
            console.error(
              `Image too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum size: ${(maxFileSize / 1024 / 1024).toFixed(1)}MB`
            )
            continue
          }

          const result = await uploadFile(file, {
            documentId: fileUploadConfig?.documentId,
            bucket: fileUploadConfig?.supabaseBucket || 'tiptap-bucket-files',
            pathPrefix: fileUploadConfig?.pathPrefix || 'notes',
            maxFileSize: fileUploadConfig?.maxFileSize,
            allowedMimeTypes: fileUploadConfig?.allowedMimeTypes,
          })

          if (!result.success || !result.filePath) {
            console.error('Image upload failed:', result.error)
            continue
          }

          const insertPos = pos ?? currentEditor.state.selection.anchor

          currentEditor
            .chain()
            .insertContentAt(insertPos, {
              type: 'image',
              attrs: {
                src: result.filePath,
              },
            })
            .focus()
            .run()

          continue
        }

        // Upload all files to Supabase using unified upload function
        const result = await uploadFile(file, {
          documentId: fileUploadConfig?.documentId,
          bucket: fileUploadConfig?.supabaseBucket || 'tiptap-bucket-files',
          pathPrefix: fileUploadConfig?.pathPrefix || 'notes',
          maxFileSize: fileUploadConfig?.maxFileSize,
          allowedMimeTypes: fileUploadConfig?.allowedMimeTypes
        })

        if (result.success && result.filePath) {
          // Determine preview type based on file type
          let previewType: FileNodeAttributes['previewType'] = 'file'

          // For non-image files, determine preview type
          if (
            file.type === 'text/plain' || 
            file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            file.type === 'application/pdf'
          ) {
            previewType = 'document'
          }

          // Insert the file node
          const insertPos = pos ?? currentEditor.state.selection.anchor
          currentEditor.chain()
            .insertContentAt(insertPos, {
              type: 'fileNode',
              attrs: {
                src: result.filePath,
                filename: file.name,
                fileSize: file.size,
                fileType: file.type,
                previewType,
                uploadStatus: 'completed'
              }
            })
            .focus()
            .run()
        } else {
          console.error('File upload failed:', result.error)
          // Optionally show error to user
        }
      } catch (error) {
        console.error('Error uploading file:', error)
      }
    }
  }

  return FileHandler.configure({
    onDrop: (currentEditor, files, pos) => {
      handleFiles(currentEditor, files, pos)
    },
    onPaste: (currentEditor, files) => {
      handleFiles(currentEditor, files)
    },
  })
}
