import React, { useState } from 'react'
import {
  FileText,
  Image as ImageIcon,
  FileCode,
  FileArchive,
  Download,
  Eye,
  Trash2,
  Paperclip,
  X,
} from 'lucide-react'
import type { FileAttachment } from '../../types'

interface AttachmentListProps {
  attachments: FileAttachment[]
  onDelete?: (id: string) => void
  readOnly?: boolean
}

export const AttachmentList: React.FC<AttachmentListProps> = ({
  attachments,
  onDelete,
  readOnly = false,
}) => {
  const [previewImage, setPreviewImage] = useState<FileAttachment | null>(null)

  if (!attachments || attachments.length === 0) return null

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  const getIcon = (type: string, name: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-sky-500" />
    if (name.endsWith('.log') || name.endsWith('.txt') || name.endsWith('.md'))
      return <FileText className="w-4 h-4 text-emerald-500" />
    if (name.endsWith('.json') || name.endsWith('.ts') || name.endsWith('.js'))
      return <FileCode className="w-4 h-4 text-amber-500" />
    if (name.endsWith('.zip') || name.endsWith('.tar') || name.endsWith('.gz'))
      return <FileArchive className="w-4 h-4 text-purple-500" />
    return <FileText className="w-4 h-4 text-slate-500" />
  }

  const downloadFile = (att: FileAttachment) => {
    const link = document.createElement('a')
    link.href = att.dataUrl
    link.download = att.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 pt-2">
        {attachments.map((att) => {
          const isImage = att.type.startsWith('image/')
          return (
            <div
              key={att.id}
              className="flex items-center space-x-2 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 transition-colors shadow-2xs"
            >
              <div className="flex items-center space-x-1.5">
                {getIcon(att.type, att.name)}
                <span className="font-medium max-w-[140px] truncate" title={att.name}>
                  {att.name}
                </span>
                <span className="text-[10px] text-slate-400">({formatSize(att.size)})</span>
              </div>

              <div className="flex items-center space-x-1 ml-1 border-l border-slate-300 pl-1.5">
                {isImage && (
                  <button
                    type="button"
                    onClick={() => setPreviewImage(att)}
                    className="p-0.5 hover:text-sky-600 rounded"
                    title="Preview Image"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => downloadFile(att)}
                  className="p-0.5 hover:text-sky-600 rounded"
                  title="Download File"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                {!readOnly && onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(att.id)}
                    className="p-0.5 hover:text-rose-600 rounded"
                    title="Remove Attachment"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Image Lightbox Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-700">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-800 text-slate-200 text-xs">
              <span className="font-medium truncate">{previewImage.name}</span>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center overflow-auto max-h-[80vh]">
              <img
                src={previewImage.dataUrl}
                alt={previewImage.name}
                className="max-h-[75vh] w-auto rounded object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

interface AttachmentUploaderProps {
  onFilesAdded: (attachments: FileAttachment[]) => void
  maxFiles?: number
}

export const AttachmentUploader: React.FC<AttachmentUploaderProps> = ({
  onFilesAdded,
  maxFiles = 5,
}) => {
  const [dragOver, setDragOver] = useState(false)

  const processFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return

    const files = Array.from(fileList).slice(0, maxFiles)
    const readPromises = files.map((file) => {
      return new Promise<FileAttachment>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          resolve({
            id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            dataUrl: reader.result as string,
            uploadedAt: new Date().toISOString(),
            uploadedBy: 'Current User',
          })
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    })

    Promise.all(readPromises)
      .then((newAttachments) => onFilesAdded(newAttachments))
      .catch((err) => console.error('Failed reading attachments', err))
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        processFiles(e.dataTransfer.files)
      }}
      className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer ${
        dragOver ? 'border-sky-500 bg-sky-50/50' : 'border-slate-300 hover:border-slate-400 bg-slate-50/60'
      }`}
    >
      <input
        type="file"
        id="file-upload-input"
        multiple
        className="hidden"
        onChange={(e) => processFiles(e.target.files)}
      />
      <label htmlFor="file-upload-input" className="cursor-pointer block">
        <div className="flex items-center justify-center space-x-2 text-xs text-slate-600">
          <Paperclip className="w-4 h-4 text-sky-600" />
          <span className="font-medium text-sky-700 hover:underline">Click to attach files</span>
          <span>or drag & drop (Logs, Images, Docs up to 10MB)</span>
        </div>
      </label>
    </div>
  )
}
