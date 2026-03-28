// Returns [top, right, bottom, left] after applying rotation (0–3 clockwise)
export function getEdges(card) {
  const r = ((card.rotation % 4) + 4) % 4
  const w = card.words // [top, right, bottom, left]
  return [0, 1, 2, 3].map(i => w[(i - r + 4) % 4])
}

// Encodes game state as a Base64url string.
// Binary layout:
//   Bytes 0–24: 20 × 10-bit word indices, bit-packed MSB-first
//     Indices 0–15: P1 snapshot edges in slot order TL/TR/BL/BR × [N,E,S,W]
//     Indices 16–19: 5th (hand) card words [N,E,S,W]
//   Bytes 25+: 4 length-prefixed UTF-8 clue strings (TOP, RIGHT, BOTTOM, LEFT)
export function encodeState(wordList, cards, p1grid, clues) {
  const snapshotIndices = ['TL', 'TR', 'BL', 'BR'].flatMap(slot => {
    const card = cards.find(c => c.id === p1grid[slot])
    return getEdges(card).map(w => wordList.indexOf(w))
  })
  const handCard = cards.find(c => !Object.values(p1grid).includes(c.id))
  const handIndices = handCard.words.map(w => wordList.indexOf(w))
  const indices = [...snapshotIndices, ...handIndices]

  const numBytes = new Uint8Array(25)
  indices.forEach((val, i) => {
    const bitPos = i * 10
    const bytePos = bitPos >> 3
    const shift = bitPos & 7
    numBytes[bytePos] |= (val >> (shift + 2)) & 0xff
    numBytes[bytePos + 1] |= (val << (6 - shift)) & 0xff
  })

  const clueBytes = ['TOP', 'RIGHT', 'BOTTOM', 'LEFT'].flatMap(k => {
    const encoded = new TextEncoder().encode(clues[k])
    return [encoded.length, ...encoded]
  })

  const all = new Uint8Array(25 + clueBytes.length)
  all.set(numBytes)
  all.set(clueBytes, 25)
  return btoa(String.fromCharCode(...all))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeState(encoded, wordList) {
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0))

    // 25 bytes for indices + at least 4 bytes for clue length prefixes
    if (buf.length < 29) return null

    const indices = Array.from({ length: 20 }, (_, i) => {
      const bitPos = i * 10
      const bytePos = bitPos >> 3
      const shift = bitPos & 7
      return ((buf[bytePos] << (shift + 2)) | (buf[bytePos + 1] >> (6 - shift))) & 0x3ff
    })

    let pos = 25
    const clues = {}
    for (const k of ['TOP', 'RIGHT', 'BOTTOM', 'LEFT']) {
      const len = buf[pos++]
      clues[k] = new TextDecoder().decode(buf.slice(pos, pos + len))
      pos += len
    }

    const slots = ['TL', 'TR', 'BL', 'BR']
    const p1snapshot = {}
    slots.forEach((slot, i) => {
      p1snapshot[slot] = indices.slice(i * 4, i * 4 + 4).map(idx => wordList[idx])
    })

    const cards = [
      ...slots.map((slot, i) => ({
        id: i + 1,
        words: indices.slice(i * 4, i * 4 + 4).map(idx => wordList[idx]),
        rotation: Math.floor(Math.random() * 4),
      })),
      {
        id: 5,
        words: indices.slice(16, 20).map(idx => wordList[idx]),
        rotation: Math.floor(Math.random() * 4),
      },
    ]

    return { cards, p1snapshot, clues }
  } catch {
    return null
  }
}
