import { useState, useEffect, useCallback } from 'react'
import './App.css'
import wordData from '../words.txt?raw'
import { getEdges, encodeState, decodeState } from './gameState.js'

// ─── helpers ─────────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pick(arr, n) {
  return shuffle(arr).slice(0, n)
}

function makeCard(id, words) {
  return { id, words, rotation: 0 }
}

// ─── Card visual component ────────────────────────────────────────────────────

function CardFace({ card, size = 120, selected, onClick, onRotate, showRotate = true }) {
  const [top, right, bottom, left] = getEdges(card)
  const fontSize = size < 100 ? 9 : size < 130 ? 10 : 11

  return (
    <div
      className={`card-face${selected ? ' selected' : ''}`}
      style={{ width: size, height: size }}
      onClick={onClick}
    >
      <span className="edge-word edge-top" style={{ fontSize }}>{top}</span>
      <span className="edge-word edge-right" style={{ fontSize }}>{right}</span>
      <span className="edge-word edge-bottom" style={{ fontSize }}>{bottom}</span>
      <span className="edge-word edge-left" style={{ fontSize }}>{left}</span>
      <span className="card-center">♣</span>
      {showRotate && (
        <button
          className="rotate-btn"
          onClick={e => { e.stopPropagation(); onRotate && onRotate() }}
          aria-label="Rotate clockwise"
        >↻</button>
      )}
    </div>
  )
}

// ─── Grid Slot ────────────────────────────────────────────────────────────────

function GridSlot({ card, slotKey, selected, onClickSlot, onRotate }) {
  return (
    <div
      className={`grid-slot${card ? ' filled' : ' empty'}${selected ? ' slot-selected' : ''}`}
      onClick={() => onClickSlot(slotKey)}
    >
      {card
        ? <CardFace
            card={card}
            size={130}
            selected={selected}
            showRotate={true}
            onRotate={() => onRotate(slotKey)}
          />
        : <span className="slot-placeholder">+</span>
      }
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

const SLOTS = ['TL', 'TR', 'BL', 'BR']

const SIDE_DEF = {
  TOP:    { slots: ['TL', 'TR'], edgeIdx: [0, 0] },
  RIGHT:  { slots: ['TR', 'BR'], edgeIdx: [1, 1] },
  BOTTOM: { slots: ['BL', 'BR'], edgeIdx: [2, 2] },
  LEFT:   { slots: ['TL', 'BL'], edgeIdx: [3, 3] },
}

export default function App() {
  const [words, setWords] = useState([])
  const [phase, setPhase] = useState('loading')
  const [cards, setCards] = useState([])
  const [p1grid, setP1grid] = useState({ TL: null, TR: null, BL: null, BR: null })
  const [p1hand, setP1hand] = useState([])
  const [clues, setClues] = useState({ TOP: '', RIGHT: '', BOTTOM: '', LEFT: '' })
  const [p2hand, setP2hand] = useState([])
  const [p2grid, setP2grid] = useState({ TL: null, TR: null, BL: null, BR: null })
  const [selectedCard, setSelectedCard] = useState(null)
  const [p1snapshot, setP1snapshot] = useState(null)

  const getCard = useCallback(id => cards.find(c => c.id === id), [cards])

  const startGame = useCallback((wordList) => {
    const chosen = pick(wordList, 20)
    const newCards = Array.from({ length: 5 }, (_, i) =>
      makeCard(i + 1, [chosen[i * 4], chosen[i * 4 + 1], chosen[i * 4 + 2], chosen[i * 4 + 3]])
    )
    setCards(newCards)
    setP1hand(newCards.map(c => c.id))
    setP1grid({ TL: null, TR: null, BL: null, BR: null })
    setClues({ TOP: '', RIGHT: '', BOTTOM: '', LEFT: '' })
    setP2hand([])
    setP2grid({ TL: null, TR: null, BL: null, BR: null })
    setSelectedCard(null)
    setP1snapshot(null)
    setPhase('p1setup')
  }, [])

  useEffect(() => {
    const w = wordData.split('\n').map(s => s.trim()).filter(Boolean)
    setWords(w)
    const stateParam = new URLSearchParams(window.location.search).get('state')
    if (stateParam) {
      const decoded = decodeState(stateParam, w)
      if (decoded) {
        setCards(decoded.cards)
        setP1snapshot(decoded.p1snapshot)
        setClues(decoded.clues)
        setP2hand(shuffle(decoded.cards.map(c => c.id)))
        setP2grid({ TL: null, TR: null, BL: null, BR: null })
        setPhase('p2guess')
        return
      }
    }
    startGame(w)
  }, [])

  const rotateCard = (cardId) => {
    setCards(prev => prev.map(c =>
      c.id === cardId ? { ...c, rotation: (c.rotation + 1) % 4 } : c
    ))
  }

  // ── Phase 1 ───────────────────────────────────────────────────────────────

  const p1ClickHandCard = (id) => {
    setSelectedCard(sel => sel?.id === id ? null : { source: 'hand', id })
  }

  const p1ClickSlot = (slotKey) => {
    const existing = p1grid[slotKey]

    if (!selectedCard) {
      // select card in slot
      if (existing) setSelectedCard({ source: 'grid', id: existing, slotKey })
      return
    }

    if (selectedCard.source === 'hand') {
      const incoming = selectedCard.id
      if (existing) {
        setP1hand(prev => [...prev.filter(c => c !== incoming), existing])
        setP1grid(prev => ({ ...prev, [slotKey]: incoming }))
      } else {
        setP1hand(prev => prev.filter(c => c !== incoming))
        setP1grid(prev => ({ ...prev, [slotKey]: incoming }))
      }
      setSelectedCard(null)
    } else if (selectedCard.source === 'grid') {
      const fromSlot = selectedCard.slotKey
      if (fromSlot === slotKey) { setSelectedCard(null); return }
      const a = p1grid[fromSlot], b = existing
      if (b) {
        setP1grid(prev => ({ ...prev, [fromSlot]: b, [slotKey]: a }))
      } else {
        setP1grid(prev => ({ ...prev, [slotKey]: a, [fromSlot]: null }))
      }
      setSelectedCard(null)
    }
  }

  const gridFull = SLOTS.every(s => p1grid[s] !== null)
  const allCluesFilled = Object.values(clues).every(c => c.trim().length > 0)

  const handleSaveHandover = () => {
    const encoded = encodeState(words, cards, p1grid, clues)
    const url = window.location.origin + window.location.pathname + '?state=' + encoded
    window.location.href = url
  }

  // ── Phase 2 ───────────────────────────────────────────────────────────────

  const p2ClickHandCard = (id) => {
    setSelectedCard(sel => sel?.id === id ? null : { source: 'hand', id })
  }

  const p2ClickSlot = (slotKey) => {
    const existing = p2grid[slotKey]

    if (!selectedCard) {
      if (existing) setSelectedCard({ source: 'grid', id: existing, slotKey })
      return
    }

    if (selectedCard.source === 'hand') {
      const incoming = selectedCard.id
      if (existing) {
        setP2hand(prev => [...prev.filter(c => c !== incoming), existing])
        setP2grid(prev => ({ ...prev, [slotKey]: incoming }))
      } else {
        setP2hand(prev => prev.filter(c => c !== incoming))
        setP2grid(prev => ({ ...prev, [slotKey]: incoming }))
      }
      setSelectedCard(null)
    } else if (selectedCard.source === 'grid') {
      const fromSlot = selectedCard.slotKey
      if (fromSlot === slotKey) { setSelectedCard(null); return }
      const a = p2grid[fromSlot], b = existing
      if (b) {
        setP2grid(prev => ({ ...prev, [fromSlot]: b, [slotKey]: a }))
      } else {
        setP2grid(prev => ({ ...prev, [slotKey]: a, [fromSlot]: null }))
      }
      setSelectedCard(null)
    }
  }

  const p2GridFull = SLOTS.every(s => p2grid[s] !== null)

  // ── Scoring ───────────────────────────────────────────────────────────────

  const computeResults = () => {
    return Object.entries(SIDE_DEF).map(([side, def]) => {
      const p1Words = def.slots.map((s, i) => p1snapshot[s][def.edgeIdx[i]])
      const p2Words = def.slots.map((s, i) => getEdges(getCard(p2grid[s]))[def.edgeIdx[i]])
      const match = p1Words[0] === p2Words[0] && p1Words[1] === p2Words[1]
      return { side, clue: clues[side], p1Words, p2Words, match }
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="screen loading-screen">
        <div className="clover-spin">♣</div>
        <p className="loading-text">Gathering words…</p>
      </div>
    )
  }

  // ── PHASE 1 ───────────────────────────────────────────────────────────────
  if (phase === 'p1setup') {
    return (
      <div className="screen p1-screen">
        <header className="game-header">
          <span className="game-logo">♣ Clover</span>
          <span className="phase-pill">Player 1</span>
        </header>

        <p className="instructions">
          Drag 4 cards into the grid · rotate · write a clue for each side
        </p>

        <div className="grid-area">
          {/* TOP clue */}
          <div className="clue-row clue-top">
            {gridFull
              ? <input className="clue-input" placeholder="TOP clue…"
                  value={clues.TOP} onChange={e => setClues(c => ({ ...c, TOP: e.target.value }))} />
              : <span className="clue-hint">← fill grid first</span>
            }
          </div>

          <div className="grid-middle-row">
            <div className="clue-side clue-left">
              {gridFull && (
                <div className="clue-vert-wrap">
                  <input className="clue-input clue-input-v" placeholder="LEFT…"
                    value={clues.LEFT} onChange={e => setClues(c => ({ ...c, LEFT: e.target.value }))} />
                </div>
              )}
            </div>

            <div className="grid-2x2">
              {SLOTS.map(slotKey => (
                <GridSlot
                  key={slotKey}
                  slotKey={slotKey}
                  card={p1grid[slotKey] ? getCard(p1grid[slotKey]) : null}
                  selected={selectedCard?.slotKey === slotKey}
                  onClickSlot={p1ClickSlot}
                  onRotate={sk => rotateCard(p1grid[sk])}
                />
              ))}
            </div>

            <div className="clue-side clue-right">
              {gridFull && (
                <div className="clue-vert-wrap">
                  <input className="clue-input clue-input-v" placeholder="RIGHT…"
                    value={clues.RIGHT} onChange={e => setClues(c => ({ ...c, RIGHT: e.target.value }))} />
                </div>
              )}
            </div>
          </div>

          {/* BOTTOM clue */}
          <div className="clue-row clue-bottom">
            {gridFull && (
              <input className="clue-input" placeholder="BOTTOM clue…"
                value={clues.BOTTOM} onChange={e => setClues(c => ({ ...c, BOTTOM: e.target.value }))} />
            )}
          </div>
        </div>

        <div className="hand-section">
          <div className="hand-label">Hand ({p1hand.length} card{p1hand.length !== 1 ? 's' : ''} remaining)</div>
          <div className="hand-cards">
            {p1hand.map(id => (
              <CardFace key={id} card={getCard(id)} size={112}
                selected={selectedCard?.id === id}
                onClick={() => p1ClickHandCard(id)}
                onRotate={() => rotateCard(id)} />
            ))}
            {p1hand.length === 0 && <span className="hand-empty">All placed ✓</span>}
          </div>
        </div>

        {gridFull && (
          <div className="action-row">
            <button className="action-btn" disabled={!allCluesFilled} onClick={handleSaveHandover}>
              Save &amp; Hand Over →
            </button>
            {!allCluesFilled && <span className="action-hint">Fill all 4 clues first</span>}
          </div>
        )}
      </div>
    )
  }

  // ── PHASE 2 ───────────────────────────────────────────────────────────────
  if (phase === 'p2guess') {
    return (
      <div className="screen p2-screen">
        <header className="game-header">
          <span className="game-logo">♣ Clover</span>
          <span className="phase-pill p2">Player 2</span>
        </header>

        <p className="instructions">
          Use the clues to place &amp; rotate cards · click a card then click a slot
        </p>

        <div className="grid-area">
          <div className="clue-row clue-top">
            <div className="clue-badge">
              <span className="cb-dir">TOP</span>
              <span className="cb-text">{clues.TOP}</span>
            </div>
          </div>

          <div className="grid-middle-row">
            <div className="clue-side clue-left">
              <div className="clue-badge vertical">
                <span className="cb-dir">LEFT</span>
                <span className="cb-text">{clues.LEFT}</span>
              </div>
            </div>

            <div className="grid-2x2">
              {SLOTS.map(slotKey => (
                <GridSlot
                  key={slotKey}
                  slotKey={slotKey}
                  card={p2grid[slotKey] ? getCard(p2grid[slotKey]) : null}
                  selected={selectedCard?.slotKey === slotKey}
                  onClickSlot={p2ClickSlot}
                  onRotate={sk => rotateCard(p2grid[sk])}
                />
              ))}
            </div>

            <div className="clue-side clue-right">
              <div className="clue-badge vertical">
                <span className="cb-dir">RIGHT</span>
                <span className="cb-text">{clues.RIGHT}</span>
              </div>
            </div>
          </div>

          <div className="clue-row clue-bottom">
            <div className="clue-badge">
              <span className="cb-dir">BOTTOM</span>
              <span className="cb-text">{clues.BOTTOM}</span>
            </div>
          </div>
        </div>

        <div className="hand-section">
          <div className="hand-label">Available cards ({p2hand.length} remaining)</div>
          <div className="hand-cards">
            {p2hand.map(id => (
              <CardFace key={id} card={getCard(id)} size={112}
                selected={selectedCard?.id === id}
                onClick={() => p2ClickHandCard(id)}
                onRotate={() => rotateCard(id)} />
            ))}
            {p2hand.length === 0 && <span className="hand-empty">All placed ✓</span>}
          </div>
        </div>

        {p2GridFull && (
          <div className="action-row">
            <button className="action-btn" onClick={() => setPhase('results')}>
              Submit Answer →
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── RESULTS ───────────────────────────────────────────────────────────────
  if (phase === 'results') {
    const results = computeResults()
    const score = results.filter(r => r.match).length
    const emoji = score === 4 ? '🌟' : score === 3 ? '🎉' : score === 2 ? '👍' : '😅'
    const verdict = score === 4 ? 'Perfect score!' : score === 3 ? 'Almost there!' : score === 2 ? 'Half way!' : 'Keep practicing!'

    return (
      <div className="screen results-screen">
        <header className="game-header">
          <span className="game-logo">♣ Clover</span>
        </header>

        <div className="score-hero">
          <div className="score-ring">
            <span className="score-num">{score}</span>
            <span className="score-slash">/4</span>
          </div>
          <div className="score-verdict">{emoji} {verdict}</div>
        </div>

        <div className="results-list">
          {results.map(r => (
            <div key={r.side} className={`result-card ${r.match ? 'is-match' : 'is-miss'}`}>
              <div className="rc-icon">{r.match ? '✅' : '❌'}</div>
              <div className="rc-body">
                <div className="rc-side">{r.side} — <em>"{r.clue}"</em></div>
                <div className="rc-row">
                  <span className="rc-label">P1:</span>
                  <span className="word-tag">{r.p1Words[0]}</span>
                  <span className="word-tag">{r.p1Words[1]}</span>
                </div>
                <div className="rc-row">
                  <span className="rc-label">P2:</span>
                  <span className={`word-tag ${r.p1Words[0] === r.p2Words[0] ? 'ok' : 'bad'}`}>{r.p2Words[0]}</span>
                  <span className={`word-tag ${r.p1Words[1] === r.p2Words[1] ? 'ok' : 'bad'}`}>{r.p2Words[1]}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="action-row">
          <button className="action-btn" onClick={() => startGame(words)}>
            New Game ♣
          </button>
        </div>
      </div>
    )
  }

  return null
}
