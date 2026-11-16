import { useMemo, useState } from 'react'
import { Sticker as StickerIcon } from 'lucide-react'
import { TabHeader } from './common'
import { STICKERS } from '../../lib/constants'
import { useEditor } from '../../store/editor'
import { useUI } from '../../store/ui'
import { SearchInput } from '../ui'

const GROUPS = [
  { id: 'all', label: 'All' },
  { id: 'popular', label: 'Popular', keys: ['Heart', 'Star', 'Sparkle', 'Fire', 'Smiley'] },
  { id: 'shapes', label: 'Shapes', keys: ['Ring', 'Burst', 'Diamond', 'Swoosh', 'Arrow'] },
  { id: 'nature', label: 'Nature', keys: ['Sun', 'Cloud', 'Flower', 'Leaf', 'Fire'] },
  { id: 'life', label: 'Life', keys: ['Camera', 'Music', 'Play button', 'Speech bubble', 'Idea'] },
]

export function StickersTab() {
  const addSticker = useEditor((state) => state.addSticker)
  const toast = useUI((state) => state.toast)
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState('all')

  const list = useMemo(() => {
    const query = search.trim().toLowerCase()
    const selected = GROUPS.find((item) => item.id === group)
    return STICKERS.filter((sticker) => {
      const matchesQuery =
        !query ||
        sticker.label.toLowerCase().includes(query) ||
        sticker.keywords?.toLowerCase().includes(query)
      const matchesGroup = !selected?.keys || selected.keys.includes(sticker.label)
      return matchesQuery && matchesGroup
    })
  }, [search, group])

  return (
    <>
      <TabHeader title="Stickers" count={STICKERS.length} />
      <SearchInput value={search} onChange={setSearch} placeholder="Search stickers" />
      <div className="chip-row">
        {GROUPS.map((item) => (
          <button
            key={item.id}
            className="chip-tiny"
            data-active={group === item.id}
            onClick={() => setGroup(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="library-empty">
          <div className="circle">
            <StickerIcon size={18} />
          </div>
          <h4>No sticker match</h4>
          <p>Try a different word or category.</p>
        </div>
      ) : (
        <div className="sticker-grid">
          {list.map((sticker) => (
            <button
              key={sticker.src}
              className="sticker-card"
              title={`Add ${sticker.label}`}
              onClick={() => {
                const id = addSticker(sticker)
                if (id) toast(`${sticker.label} sticker added`, 'success')
              }}
            >
              <img src={sticker.src} alt={sticker.label} loading="lazy" />
            </button>
          ))}
        </div>
      )}

      <div className="hint">
        24 original vector stickers. Resize, rotate and animate them from the inspector, or drag
        the clip on the timeline to retime it.
      </div>
    </>
  )
}
