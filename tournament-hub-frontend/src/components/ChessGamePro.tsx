import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BACKEND_BASE_URL } from '../config/backend';
import { Chessground } from 'chessground';
// Use root css path for Vite compatibility
import '/node_modules/chessground/assets/chessground.base.css';
import '/node_modules/chessground/assets/chessground.brown.css';
import '/node_modules/chessground/assets/chessground.cburnett.css';
import { Box, HStack, Text, VStack, Badge, Button, useToast, Spinner, Input } from '@chakra-ui/react';
import { Chess } from 'chess.js';

type ServerPiece = { type: string; color: string; has_moved: boolean };
type BoardMap = Record<string, ServerPiece>;

type Props = { sessionId: string; playerAddress: string };

function boardToFen(board: BoardMap, currentTurn: 'white' | 'black'): string {
    const grid: string[][] = Array.from({ length: 8 }, () => Array(8).fill(''));
    const toChar: Record<string, string> = {
        pawn: 'p', rook: 'r', knight: 'n', bishop: 'b', queen: 'q', king: 'k'
    };
    Object.entries(board).forEach(([key, piece]) => {
        const [xStr, yStr] = key.split(',');
        const x = Number(xStr); const y = Number(yStr);
        const rank = 7 - y; // server y=0 bottom (white), FEN rank 8 at top
        const file = x;
        if (file >= 0 && file < 8 && rank >= 0 && rank < 8) {
            let ch = toChar[piece.type] || '';
            if (piece.color === 'white') ch = ch.toUpperCase();
            grid[rank][file] = ch;
        }
    });
    // Compose piece placement
    const ranks = grid.map(row => {
        let s = ''; let empties = 0;
        for (let i = 0; i < 8; i++) {
            const c = row[i];
            if (!c) empties++;
            else { if (empties) { s += String(empties); empties = 0; } s += c; }
        }
        if (empties) s += String(empties);
        return s;
    }).join('/');

    // Castling rights by has_moved flags
    const whiteKing = board['4,0'];
    const whiteRookA = board['0,0'];
    const whiteRookH = board['7,0'];
    const blackKing = board['4,7'];
    const blackRookA = board['0,7'];
    const blackRookH = board['7,7'];
    let castling = '';
    if (whiteKing && whiteKing.type === 'king' && !whiteKing.has_moved) {
        if (whiteRookH && whiteRookH.type === 'rook' && !whiteRookH.has_moved) castling += 'K';
        if (whiteRookA && whiteRookA.type === 'rook' && !whiteRookA.has_moved) castling += 'Q';
    }
    if (blackKing && blackKing.type === 'king' && !blackKing.has_moved) {
        if (blackRookH && blackRookH.type === 'rook' && !blackRookH.has_moved) castling += 'k';
        if (blackRookA && blackRookA.type === 'rook' && !blackRookA.has_moved) castling += 'q';
    }
    if (!castling) castling = '-';

    // En passant not provided by server, halfmove/fullmove unknown
    const turn = currentTurn === 'white' ? 'w' : 'b';
    const fen = `${ranks} ${turn} ${castling} - 0 1`;
    return fen;
}

function mapToDests(chess: Chess): Map<string, string[]> {
    const dests = new Map<string, string[]>();
    const allFiles = 'abcdefgh';
    const allRanks = '12345678';
    for (const f of allFiles) for (const r of allRanks) {
        const s = `${f}${r}`;
        const moves = chess.moves({ square: s as any, verbose: true }) as any[];
        if (moves.length) dests.set(s, moves.map(m => m.to as string));
    }
    return dests;
}

export const ChessGamePro: React.FC<Props> = ({ sessionId, playerAddress }) => {
    const boardRef = useRef<HTMLDivElement>(null);
    const cgRef = useRef<any>(null);
    const feedRef = useRef<HTMLDivElement>(null);
    const [state, setState] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [youAreWhite, setYouAreWhite] = useState<boolean>(true);
    const [isSpectator, setIsSpectator] = useState<boolean>(false);
    const [emoji, setEmoji] = useState('');
    const toast = useToast();

    async function joinGame() {
        try {
            const res = await fetch(`${BACKEND_BASE_URL}/join_chess_session?sessionId=${sessionId}&player=${playerAddress}`, {
                method: 'POST'
            });
            if (res.ok) {
                const data = await res.json();
                setState(data.game_state);
                const youWhite = data.game_state.white_player === playerAddress;
                const youBlack = data.game_state.black_player === playerAddress;
                setYouAreWhite(youWhite);
                setIsSpectator(!youWhite && !youBlack);
            }
        } catch (e) {
            console.error('Error joining chess game:', e);
        }
    }

    async function fetchState() {
        try {
            const res = await fetch(`${BACKEND_BASE_URL}/chess_game_state?sessionId=${sessionId}`);
            const data = await res.json();
            setState(data);
            const youWhite = data.white_player === playerAddress;
            const youBlack = data.black_player === playerAddress;
            setYouAreWhite(youWhite);
            setIsSpectator(!youWhite && !youBlack);

            // If player is not assigned to any side, try to join
            if (!youWhite && !youBlack) {
                await joinGame();
            }
        } catch (e) {
            // ignore
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { fetchState(); const id = setInterval(fetchState, 1000); return () => clearInterval(id); }, []);

    const fen = useMemo(() => state ? boardToFen(state.board || {}, state.current_turn) : undefined, [state]);
    const feed = useMemo(() => (state?.emojis || []).slice(-20), [state?.emojis]);

    useEffect(() => {
        const el = feedRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [feed?.length]);

    useEffect(() => {
        if (!boardRef.current || !state || !fen) return;
        // Build chess.js from FEN
        let chess: Chess;
        try { chess = new Chess(fen); } catch { chess = new Chess(); }
        const dests = mapToDests(chess);

        const pieces: Record<string, any> = {};
        Object.entries(state.board || {}).forEach(([key, p]: [string, any]) => {
            const [xStr, yStr] = key.split(',');
            const file = 'abcdefgh'[Number(xStr)];
            const rank = (Number(yStr) + 1).toString(); // CG expects a1 bottom-left; server y=0 bottom
            const square = `${file}${rank}`;
            pieces[square] = { role: p.type, color: p.color };
        });

        const isMyTurn = !isSpectator && ((state.current_turn === 'white') === youAreWhite);
        const config: any = {
            orientation: isSpectator ? 'white' : (youAreWhite ? 'white' : 'black'),
            fen,
            turnColor: state.current_turn,
            draggable: { enabled: !state.game_over && isMyTurn },
            movable: {
                free: false,
                color: isMyTurn ? state.current_turn : undefined,
                dests,
                events: {
                    after: async (orig: string, dest: string) => {
                        if (!isMyTurn) return;
                        try {
                            // Detect promotion
                            let promotion: 'q' | 'r' | 'b' | 'n' | undefined;
                            const fromFile = orig[0]; const toRank = Number(dest[1]);
                            const isPawn = (pieces[orig]?.role === 'pawn');
                            const willPromote = isPawn && ((youAreWhite && toRank === 8) || (!youAreWhite && toRank === 1));
                            if (willPromote) {
                                promotion = await promptPromotion();
                            }

                            const resp = await fetch(`${BACKEND_BASE_URL}/chess_move`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ sessionId, player: playerAddress, from_pos: toServerCoord(orig), to_pos: toServerCoord(dest), promotion })
                            });
                            if (!resp.ok) {
                                let desc = 'Server rejected move';
                                try { const err = await resp.json(); desc = err.detail || desc; } catch { }
                                toast({ title: 'Invalid move', description: desc, status: 'error', duration: 2500 });
                                fetchState();
                                return;
                            }
                            fetchState();
                        } catch {
                            toast({ title: 'Network error', status: 'error', duration: 2000 });
                            fetchState();
                        }
                    }
                }
            },
            highlight: { lastMove: true, check: true },
            drawable: { enabled: false },
        };

        if (!cgRef.current) {
            cgRef.current = Chessground(boardRef.current!, config as any);
            // Workaround: chessground expects arrays for dests; ensure we pass arrays
            if (config.movable && config.movable.dests) {
                const d: Map<string, string[]> = config.movable.dests;
                cgRef.current.set({ movable: { dests: d } });
            }
        } else {
            cgRef.current.set(config);
        }

        // Enhanced "check" UX: pulse and mark king square
        const inCheck = chess.inCheck();
        const boardEl = (boardRef.current as HTMLElement).querySelector('.cg-board');
        if (inCheck && boardEl) {
            boardEl.classList.add('in-check');
            setTimeout(() => boardEl.classList.remove('in-check'), 600);
        }
        if (inCheck) {
            const kingSq = findKingSquare(chess, state.current_turn);
            if (kingSq && cgRef.current) {
                cgRef.current.set({ drawable: { enabled: true, shapes: [{ orig: kingSq, brush: 'red' }] } });
            }
        } else if (cgRef.current) {
            cgRef.current.set({ drawable: { shapes: [] } });
        }
    }, [boardRef, fen, state, youAreWhite]);

    if (loading || !state) {
        return (
            <Box textAlign="center" py={8}><Spinner size="xl" color="blue.400" /><Text mt={4}>Loading chess…</Text></Box>
        );
    }

    function shortAddr(addr?: string) {
        if (!addr) return 'Unknown';
        return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
    }

    const preset = ['😀', '😅', '😮', '😢', '😡', '👏', '👍', '🤝', '🧠', '🏆'];
    async function sendEmojiBtn() {
        if (!emoji) return;
        await sendEmoji(emoji);
        setEmoji('');
    }
    async function sendEmoji(e: string) {
        async function postTo(path: string) {
            return fetch(`${BACKEND_BASE_URL}${path}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, player: playerAddress, emoji: e })
            });
        }
        try {
            let resp = await postTo('/chess_emoji');
            if (!resp.ok) {
                // Fallback aliases if server not reloaded
                resp = await postTo('/emoji');
                if (!resp.ok) resp = await postTo('/chess-emoji');
            }
            if (!resp.ok) {
                const errTxt = await resp.text().catch(() => '');
                toast({ title: 'Emoji failed', description: errTxt || `${resp.status}`, status: 'error', duration: 2000 });
            }
            fetchState();
        } catch {
            toast({ title: 'Network error', status: 'error', duration: 1500 });
        }
    }

    return (
        <VStack spacing={4} align="stretch">
            <HStack justify="space-between" align="center">
                <HStack>
                    <Badge colorScheme={state.current_turn === 'white' ? 'blue' : 'gray'}>{state.current_turn === 'white' ? 'White' : 'Black'} to move</Badge>
                    {isKingInCheck(fen) && (
                        <Badge colorScheme="red">Check!</Badge>
                    )}
                    {isSpectator && (
                        <Badge colorScheme="purple">Spectator</Badge>
                    )}
                    {!isSpectator && (
                        <Badge colorScheme={youAreWhite ? 'blue' : 'gray'}>You are {youAreWhite ? 'White' : 'Black'}</Badge>
                    )}
                </HStack>
                <HStack>
                    {state.game_over && <Badge colorScheme="red">Game Over {state.winner ? `– Winner: ${state.winner.slice(0, 8)}…` : ''}</Badge>}
                    <Button
                        size="sm"
                        colorScheme="red"
                        onClick={() => (window.location.href = '/tournaments')}
                        leftIcon={<span>←</span>}
                    >
                        Exit Game
                    </Button>
                </HStack>
            </HStack>
            <Box ref={boardRef} sx={{ '.cg-board': { borderRadius: '12px' } }} style={{ width: '480px', height: '480px', margin: '0 auto' }} />
            <HStack justify="center" spacing={8}>
                <Text fontSize="sm">White: {shortAddr(state.white_player)} ⏱ {state.white_time_left ?? 300}s</Text>
                <Text fontSize="sm">Black: {shortAddr(state.black_player)} ⏱ {state.black_time_left ?? 300}s</Text>
            </HStack>
            {/* Captured pieces */}
            <HStack justify="center" spacing={10} align="center">
                <HStack>
                    <Text fontSize="sm" color="gray.400">Captured by White:</Text>
                    <HStack spacing={2} minW="180px" justify="flex-start">{(state.captured_by_white || []).map((p: any, i: number) => (
                        <Box
                            key={`cw-${i}`}
                            bg="gray.700"
                            color="white"
                            px={2}
                            py={1}
                            borderRadius="md"
                            fontSize="2xl"
                            lineHeight="1"
                            minW="32px"
                            textAlign="center"
                            boxShadow="sm"
                        >
                            {pieceChar(p.color, p.type)}
                        </Box>
                    ))}</HStack>
                </HStack>
                <HStack>
                    <Text fontSize="sm" color="gray.400">Captured by Black:</Text>
                    <HStack spacing={2} minW="180px" justify="flex-start">{(state.captured_by_black || []).map((p: any, i: number) => (
                        <Box
                            key={`cb-${i}`}
                            bg="gray.700"
                            color="white"
                            px={2}
                            py={1}
                            borderRadius="md"
                            fontSize="2xl"
                            lineHeight="1"
                            minW="32px"
                            textAlign="center"
                            boxShadow="sm"
                        >
                            {pieceChar(p.color, p.type)}
                        </Box>
                    ))}</HStack>
                </HStack>
            </HStack>
            {/* Messages / Emojis feed with chat bubbles */}
            <VStack spacing={2} align="stretch" px={2}>
                <Box ref={feedRef} maxH="160px" overflowY="auto" bg="gray.800" borderRadius="md" px={3} py={2}>
                    <VStack align="stretch" spacing={1}>
                        {feed.map((e: any, i: number) => {
                            const isWhite = e.player === state.white_player;
                            const isBlack = e.player === state.black_player;
                            const justify = isWhite ? 'flex-start' : isBlack ? 'flex-end' : 'center';
                            const bubble = isWhite ? 'blue.600' : isBlack ? 'gray.600' : 'purple.600';
                            const label = isWhite ? 'White' : isBlack ? 'Black' : 'Spectator';
                            return (
                                <HStack key={`msg-${i}`} justify={justify}>
                                    <Box bg={bubble} color="white" px={3} py={1} borderRadius="md" maxW="80%" whiteSpace="pre-wrap" wordBreak="break-word">
                                        <Text fontSize="xs" opacity={0.8}>{label}</Text>
                                        <Text fontSize="sm">{e.emoji}</Text>
                                    </Box>
                                </HStack>
                            );
                        })}
                    </VStack>
                </Box>
                {!isSpectator && (
                    <HStack justify="center" spacing={1} wrap="wrap">
                        {preset.map(e => (
                            <Button key={`p-${e}`} size="xs" onClick={() => sendEmoji(e)}>{e}</Button>
                        ))}
                        <Input
                            value={emoji}
                            onChange={e => setEmoji(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendEmojiBtn(); } }}
                            placeholder="custom"
                            maxW="240px"
                            size="xs"
                            ml={2}
                        />
                    </HStack>
                )}
            </VStack>
        </VStack>
    );
};

function toServerCoord(cgSquare: string): string {
    const file = cgSquare[0]; const rank = Number(cgSquare[1]);
    const x = 'abcdefgh'.indexOf(file);
    const y = rank - 1; // server y bottom
    return `${x},${y}`;
}

export default ChessGamePro;

function pieceChar(color: 'white' | 'black', type: string) {
    const white: any = { pawn: '♙', rook: '♖', knight: '♘', bishop: '♗', queen: '♕', king: '♔' };
    const black: any = { pawn: '♟', rook: '♜', knight: '♞', bishop: '♝', queen: '♛', king: '♚' };
    return color === 'white' ? white[type] : black[type];
}

async function promptPromotion(): Promise<'q' | 'r' | 'b' | 'n'> {
    const pick = window.prompt('Promote to (q,r,b,n)?', 'q') || 'q';
    const allowed = ['q', 'r', 'b', 'n'] as const;
    return (allowed.includes(pick as any) ? (pick as any) : 'q');
}

function isKingInCheck(fen?: string, _color?: 'white' | 'black') {
    try {
        if (!fen) return false;
        const c = new Chess(fen);
        // chess.js exposes inCheck() method
        return c.inCheck();
    } catch {
        return false;
    }
}

function findKingSquare(c: Chess, turn: string): string | null {
    const board: any = (c as any).board ? (c as any).board() : null;
    if (!board) return null;
    for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
            const p = board[r][f];
            if (p && p.type === 'k' && ((turn === 'white' && p.color === 'w') || (turn === 'black' && p.color === 'b'))) {
                return 'abcdefgh'[f] + (8 - r);
            }
        }
    }
    return null;
}


