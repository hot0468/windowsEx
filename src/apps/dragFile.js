import { useState } from 'react'

// A private type so only in-game file drags are accepted — an image dragged in
// from the real desktop must not look like a droppable game file.
const FILE_MIME = 'application/x-winex-file'

export const fileDragProps = (file) => ({
  draggable: true,
  onDragStart: (e) => {
    e.dataTransfer.setData(FILE_MIME, file.id)
    e.dataTransfer.setData('text/plain', file.name)
    e.dataTransfer.effectAllowed = 'copy'
  }
})

export function useFileDrop(onFileId) {
  const [over, setOver] = useState(false)
  return {
    over,
    dropProps: {
      onDragOver: (e) => {
        if (!e.dataTransfer.types.includes(FILE_MIME)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        setOver(true)
      },
      onDragLeave: () => setOver(false),
      onDrop: (e) => {
        const id = e.dataTransfer.getData(FILE_MIME)
        setOver(false)
        if (!id) return
        e.preventDefault()
        onFileId(id)
      }
    }
  }
}
