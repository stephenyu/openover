import { describe, it, expect } from 'vitest'
import { encodeState, decodeState, getEdges } from './gameState.js'

// 1000-word list is overkill for tests; we just need unique words at known indices.
// Use a flat array of 'word-N' strings so indices are predictable.
const WORD_LIST = Array.from({ length: 1000 }, (_, i) => `word-${i}`)

function makeCard(id, words, rotation = 0) {
  return { id, words, rotation }
}

// Builds a minimal but realistic P1 game state.
function makeGameState() {
  // 5 cards, each with 4 words at consecutive indices
  const cards = Array.from({ length: 5 }, (_, ci) =>
    makeCard(ci + 1, [
      WORD_LIST[ci * 4],
      WORD_LIST[ci * 4 + 1],
      WORD_LIST[ci * 4 + 2],
      WORD_LIST[ci * 4 + 3],
    ])
  )

  // P1 places cards 1–4 in the grid, card 5 stays in hand
  const p1grid = { TL: 1, TR: 2, BL: 3, BR: 4 }

  const clues = { TOP: 'sky', RIGHT: 'ocean', BOTTOM: 'earth', LEFT: 'flame' }

  return { cards, p1grid, clues }
}

describe('encodeState / decodeState roundtrip', () => {
  it('returns the correct shape', () => {
    const { cards, p1grid, clues } = makeGameState()
    const encoded = encodeState(WORD_LIST, cards, p1grid, clues)
    const result = decodeState(encoded, WORD_LIST)

    expect(result).not.toBeNull()
    expect(result).toHaveProperty('cards')
    expect(result).toHaveProperty('p1snapshot')
    expect(result).toHaveProperty('clues')
  })

  it('produces exactly 5 cards', () => {
    const { cards, p1grid, clues } = makeGameState()
    const encoded = encodeState(WORD_LIST, cards, p1grid, clues)
    const { cards: decoded } = decodeState(encoded, WORD_LIST)

    expect(decoded).toHaveLength(5)
    expect(decoded.map(c => c.id).sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('p1snapshot matches P1\'s rotated edges for each slot', () => {
    const { cards, p1grid, clues } = makeGameState()
    const encoded = encodeState(WORD_LIST, cards, p1grid, clues)
    const { p1snapshot } = decodeState(encoded, WORD_LIST)

    for (const slot of ['TL', 'TR', 'BL', 'BR']) {
      const card = cards.find(c => c.id === p1grid[slot])
      expect(p1snapshot[slot]).toEqual(getEdges(card))
    }
  })

  it('clues survive the roundtrip exactly', () => {
    const { cards, p1grid, clues } = makeGameState()
    const encoded = encodeState(WORD_LIST, cards, p1grid, clues)
    const { clues: decoded } = decodeState(encoded, WORD_LIST)

    expect(decoded).toEqual(clues)
  })

  it('cards 1–4 have the correct words (from P1 snapshot slots)', () => {
    const { cards, p1grid, clues } = makeGameState()
    const encoded = encodeState(WORD_LIST, cards, p1grid, clues)
    const { cards: decoded, p1snapshot } = decodeState(encoded, WORD_LIST)

    const slots = ['TL', 'TR', 'BL', 'BR']
    slots.forEach((slot, i) => {
      expect(decoded[i].words).toEqual(p1snapshot[slot])
    })
  })

  it('card 5 has the hand card\'s words', () => {
    const { cards, p1grid, clues } = makeGameState()
    const encoded = encodeState(WORD_LIST, cards, p1grid, clues)
    const { cards: decoded } = decodeState(encoded, WORD_LIST)

    const handCard = cards.find(c => !Object.values(p1grid).includes(c.id))
    const decodedCard5 = decoded.find(c => c.id === 5)
    expect(decodedCard5.words).toEqual(handCard.words)
  })

  it('works with rotated cards — snapshot reflects rotation', () => {
    const { cards, p1grid, clues } = makeGameState()
    const rotatedCards = cards.map((c, i) => ({ ...c, rotation: i % 4 }))
    const encoded = encodeState(WORD_LIST, rotatedCards, p1grid, clues)
    const { p1snapshot } = decodeState(encoded, WORD_LIST)

    for (const slot of ['TL', 'TR', 'BL', 'BR']) {
      const card = rotatedCards.find(c => c.id === p1grid[slot])
      expect(p1snapshot[slot]).toEqual(getEdges(card))
    }
  })

  it('works with word indices at the high end of the list (index 999)', () => {
    const highCards = Array.from({ length: 5 }, (_, ci) =>
      makeCard(ci + 1, [
        WORD_LIST[980 + ci * 4],
        WORD_LIST[981 + ci * 4],
        WORD_LIST[982 + ci * 4],
        WORD_LIST[983 + ci * 4],
      ])
    )
    const p1grid = { TL: 1, TR: 2, BL: 3, BR: 4 }
    const clues = { TOP: 'high', RIGHT: 'end', BOTTOM: 'word', LEFT: 'test' }

    const encoded = encodeState(WORD_LIST, highCards, p1grid, clues)
    const { p1snapshot, clues: decodedClues } = decodeState(encoded, WORD_LIST)

    for (const slot of ['TL', 'TR', 'BL', 'BR']) {
      const card = highCards.find(c => c.id === p1grid[slot])
      expect(p1snapshot[slot]).toEqual(getEdges(card))
    }
    expect(decodedClues).toEqual(clues)
  })

  it('returns null for corrupted input', () => {
    expect(decodeState('not-valid-base64!!!', WORD_LIST)).toBeNull()
    expect(decodeState('', WORD_LIST)).toBeNull()
  })
})
