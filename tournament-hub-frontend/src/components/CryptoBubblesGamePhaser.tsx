import React, { useEffect, useRef } from 'react';
import { BACKEND_BASE_URL } from '../config/backend';
// @ts-ignore - Phaser types are resolved at build time
import Phaser from 'phaser';

type Props = {
    sessionId: string;
    playerAddress: string;
};

const DEFAULT_WORLD_WIDTH = 3000;
const DEFAULT_WORLD_HEIGHT = 2500;

class PlayScene extends Phaser.Scene {
    sessionId!: string;
    playerAddress!: string;
    declare physics: Phaser.Physics.Arcade.ArcadePhysics;
    declare cameras: Phaser.Cameras.Scene2D.CameraManager;
    declare input: Phaser.Input.InputPlugin;
    player!: Phaser.GameObjects.Arc;
    pellets: Phaser.GameObjects.Arc[] = [];
    cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    target: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
    desiredTarget: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
    lastSent = 0;
    playerCircles = new Map<string, Phaser.GameObjects.Arc>();
    nameTexts = new Map<string, Phaser.GameObjects.Text>();
    pelletPool: Phaser.GameObjects.Arc[] = [];
    minimapG!: Phaser.GameObjects.Graphics;
    hudText!: Phaser.GameObjects.Text;
    leaderboardBox!: Phaser.GameObjects.Graphics;
    leaderboardTexts: Phaser.GameObjects.Text[] = [];
    leaderboardDots: Phaser.GameObjects.Arc[] = [];
    arena = { w: DEFAULT_WORLD_WIDTH, h: DEFAULT_WORLD_HEIGHT };
    fetchTimer?: Phaser.Time.TimerEvent;
    gameOver = false;
    endText?: Phaser.GameObjects.Text;
    // Server-authoritative targets for smooth interpolation
    targetByAddr: Map<string, { x: number; y: number; size: number }> = new Map();
    // Recent samples to build a small moving average to reduce noise
    samplesByAddr: Map<string, { x: number; y: number; size: number }[]> = new Map();
    // Animated background
    starSprites: Phaser.GameObjects.Image[] = [];
    starPhases: number[] = [];

    constructor() {
        super('play');
    }

    init(data: { sessionId: string; playerAddress: string }) {
        this.sessionId = data.sessionId;
        this.playerAddress = data.playerAddress;
    }

    preload() {
        // Create a tiny circular texture for stars
        const g = this.make.graphics({ x: 0, y: 0 });
        g.fillStyle(0xffffff, 1);
        g.fillCircle(2, 2, 2);
        g.generateTexture('bg-star', 4, 4);
        g.clear();
    }

    async create() {
        this.cameras.main.setBackgroundColor('#0f172a');
        this.cameras.main.setBounds(0, 0, this.arena.w, this.arena.h);
        this.cameras.main.roundPixels = true;
        this.cameras.main.roundPixels = true;

        // Player placeholder
        this.player = this.add.circle(this.arena.w / 2, this.arena.h / 2, 16, 0x4ecdc4).setDepth(10);
        this.playerCircles.set(this.playerAddress, this.player);
        this.nameTexts.set(this.playerAddress, this.add.text(this.player.x, this.player.y - 24, 'You', { fontSize: '12px', color: '#ffffff' }).setOrigin(0.5));
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            this.desiredTarget.set(pointer.worldX, pointer.worldY);
        });

        // Decorative starfield (parallax-lite): moves with world, twinkles in update()
        const numStars = Math.min(500, Math.floor((this.arena.w * this.arena.h) / 25000));
        for (let i = 0; i < numStars; i++) {
            const sx = Math.random() * this.arena.w;
            const sy = Math.random() * this.arena.h;
            const img = this.add.image(sx, sy, 'bg-star')
                .setDepth(0)
                .setAlpha(0.4 + Math.random() * 0.4)
                .setTint(Math.random() < 0.5 ? 0xffffff : 0x94a3b8);
            const s = 0.5 + Math.random() * 1.5;
            img.setScale(s);
            this.starSprites.push(img);
            this.starPhases.push(Math.random() * Math.PI * 2);
        }

        // Minimap + HUD + Leaderboard
        this.minimapG = this.add.graphics({ x: 0, y: 0 }).setScrollFactor(0).setDepth(100);
        this.hudText = this.add.text(12, 12, '', { fontSize: '12px', color: '#9ae6b4' }).setScrollFactor(0).setDepth(101);
        this.leaderboardBox = this.add.graphics({ x: 12, y: 40 }).setScrollFactor(0).setDepth(100);

        // Join and start
        try {
            await fetch(`${BACKEND_BASE_URL}/join_cryptobubbles_session?sessionId=${this.sessionId}&player=${this.playerAddress}`, { method: 'POST' });
            await fetch(`${BACKEND_BASE_URL}/start_cryptobubbles_game`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: this.sessionId })
            });
        } catch { }

        // Poll server state
        this.fetchTimer = this.time.addEvent({ delay: 100, loop: true, callback: this.fetchAndApplyState, callbackScope: this });
    }

    private upsertPellet(x: number, y: number, size: number) {
        const cam = this.cameras.main;
        if (x < cam.worldView.x - 100 || x > cam.worldView.right + 100 || y < cam.worldView.y - 100 || y > cam.worldView.bottom + 100) {
            return;
        }
        let pellet = this.pelletPool.find(p => !p.visible);
        if (!pellet) {
            pellet = this.add.circle(x, y, size, 0xffd93d).setDepth(1);
            this.pelletPool.push(pellet);
        } else {
            pellet.setPosition(x, y).setRadius(size).setVisible(true);
        }
    }

    private fetchAndApplyState = async () => {
        try {
            const resp = await fetch(`${BACKEND_BASE_URL}/cryptobubbles_game_state?sessionId=${this.sessionId}`);
            if (!resp.ok) return;
            const data = await resp.json();

            const [aw, ah] = data.arena_size || [DEFAULT_WORLD_WIDTH, DEFAULT_WORLD_HEIGHT];
            if (aw !== this.arena.w || ah !== this.arena.h) {
                this.arena.w = aw; this.arena.h = ah;
                this.cameras.main.setBounds(0, 0, aw, ah);
            }

            const alivePlayers: string[] = [];
            Object.entries<any>(data.cells || {}).forEach(([addr, cell]) => {
                if (cell.state !== 'alive') return;
                alivePlayers.push(addr);
                let circle = this.playerCircles.get(addr);
                if (!circle) {
                    const color = addr.startsWith('Bot_') ? 0x9b59b6 : addr === this.playerAddress ? 0x4ecdc4 : 0xff6b6b;
                    circle = this.add.circle(cell.x, cell.y, Math.max(8, cell.size), color).setDepth(5).setVisible(true);
                    circle.setStrokeStyle(2, 0x222222, 1);
                    this.playerCircles.set(addr, circle);
                    const label = this.add.text(cell.x, cell.y - cell.size - 12, addr === this.playerAddress ? 'You' : (addr.startsWith('Bot_') ? addr : addr.slice(0, 6)), { fontSize: '12px', color: '#ffffff' }).setOrigin(0.5);
                    this.nameTexts.set(addr, label);
                }
                // Record latest server target and keep a few samples for averaging
                const sample = { x: cell.x, y: cell.y, size: Math.max(8, cell.size) };
                this.targetByAddr.set(addr, sample);
                const arr = this.samplesByAddr.get(addr) || [];
                arr.push(sample);
                if (arr.length > 5) arr.shift(); // keep last 5
                this.samplesByAddr.set(addr, arr);
                if (addr === this.playerAddress) {
                    this.player = circle;
                }
            });
            for (const [addr, circle] of Array.from(this.playerCircles.entries())) {
                if (!alivePlayers.includes(addr)) {
                    circle.destroy();
                    this.playerCircles.delete(addr);
                    const t = this.nameTexts.get(addr);
                    if (t) { t.destroy(); this.nameTexts.delete(addr); }
                }
            }

            this.pelletPool.forEach(p => p.setVisible(false));
            const pellets: any[] = data.pellets || [];
            const MAX_NEAR = 600;
            let drawn = 0;
            for (let i = 0; i < pellets.length && drawn < MAX_NEAR; i++) {
                const pel = pellets[i];
                this.upsertPellet(pel.x, pel.y, Math.max(4, pel.size));
                drawn++;
            }

            const humanAddrs = alivePlayers.filter(a => !a.startsWith('Bot_'));
            const humansAlive = humanAddrs.length;
            const botsAlive = alivePlayers.filter(a => a.startsWith('Bot_')).length;
            const me = data.cells?.[this.playerAddress];
            const mySize = me ? Math.round(me.size) : 0;
            this.hudText.setText(`Players alive: ${humansAlive}  |  Bots: ${botsAlive}  |  Your size: ${mySize}`);

            this.drawMinimap(data);

            this.drawLeaderboard(data);

            // Handle game over
            const computedWinner = data.winner || (humansAlive === 1 ? humanAddrs[0] : null);
            if ((data.game_over || computedWinner) && !this.gameOver) {
                this.gameOver = true;
                const youWin = (computedWinner || data.winner) === this.playerAddress;
                const msg = youWin ? 'You Win!' : `Game Over${computedWinner ? ' – Winner: ' + (computedWinner === this.playerAddress ? 'You' : (computedWinner.startsWith('Bot_') ? computedWinner : computedWinner.slice(0, 6))) : ''}`;
                // Dim background overlay fixed to screen
                this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x000000, 0.35)
                    .setScrollFactor(0)
                    .setDepth(199);
                this.endText = this.add.text(this.scale.width / 2, this.scale.height / 2, msg, {
                    fontSize: '48px', color: youWin ? '#68d391' : '#f56565'
                }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
            }
        } catch { }
    }

    private drawMinimap(data: any) {
        const mapW = 180, mapH = 150;
        const pad = 12;
        const [aw, ah] = data.arena_size || [this.arena.w, this.arena.h];
        const sx = mapW / aw, sy = mapH / ah;
        const cam = this.cameras.main;
        this.minimapG.clear();
        this.minimapG.fillStyle(0x000000, 0.6).fillRect(this.scale.width - mapW - pad, pad, mapW, mapH).lineStyle(1, 0x444444, 1).strokeRect(this.scale.width - mapW - pad, pad, mapW, mapH);
        Object.entries<any>(data.cells || {}).forEach(([addr, cell]) => {
            if (cell.state !== 'alive') return;
            const color = addr.startsWith('Bot_') ? 0x9b59b6 : addr === this.playerAddress ? 0x4ecdc4 : 0xff6b6b;
            const x = this.scale.width - mapW - pad + cell.x * sx;
            const y = pad + cell.y * sy;
            this.minimapG.fillStyle(color, 1).fillCircle(x, y, Math.max(2, Math.min(5, cell.size * sx)));
        });
        const view = cam.worldView as Phaser.Geom.Rectangle;
        const vx = this.scale.width - mapW - pad + view.x * sx;
        const vy = pad + view.y * sy;
        const vw = view.width * sx;
        const vh = view.height * sy;
        this.minimapG.lineStyle(2, 0xffffff, 1).strokeRect(vx, vy, vw, vh);
    }

    private drawLeaderboard(data: any) {
        const entries: { name: string; size: number; isBot: boolean; alive: boolean }[] = Object.entries<any>(data.cells || {})
            .map(([addr, cell]) => ({ name: addr, size: cell.size || 0, isBot: addr.startsWith('Bot_'), alive: cell.state === 'alive' }))
            .sort((a, b) => b.size - a.size)
            .slice(0, 10);
        const width = 220;
        const lineH = 18;
        const height = 12 + entries.length * lineH + 8;
        this.leaderboardBox.clear();
        // Position at upper-left of the screen
        const boxX = 12;
        const boxY = 40;
        this.leaderboardBox
            .fillStyle(0x000000, 0.6)
            .fillRect(boxX, boxY, width, height)
            .lineStyle(1, 0x444444, 1)
            .strokeRect(boxX, boxY, width, height);
        // Title (centered)
        const titleY = boxY + 8;
        this.leaderboardTexts.forEach(t => t.destroy());
        this.leaderboardTexts = [];
        const title = this.add
            .text(boxX + 12, titleY, 'Leaderboard', { fontSize: '12px', color: '#ffffff', fontFamily: 'monospace' })
            .setOrigin(0, 0)
            .setScrollFactor(0)
            .setDepth(101);
        this.leaderboardTexts.push(title);
        // Clear previous alive dots
        this.leaderboardDots.forEach(d => d.destroy());
        this.leaderboardDots = [];

        entries.forEach((e, idx) => {
            const y = titleY + 12 + (idx + 1) * lineH;
            const color = e.isBot ? '#c084fc' : (e.name === this.playerAddress ? '#4fd1c5' : (e.alive ? '#ffffff' : '#9ca3af'));
            const name = e.name === this.playerAddress ? 'You' : (e.isBot ? e.name : e.name.slice(0, 6));
            const rowText = `${String(idx + 1).padStart(2, '0')}  ${name}  ${Math.round(e.size)}`;
            const row = this.add
                .text(boxX + 12, y, rowText, { fontSize: '12px', color, fontFamily: 'monospace' })
                .setOrigin(0, 0)
                .setScrollFactor(0)
                .setDepth(101);
            // If dead, strike-through
            if (!e.alive) {
                row.setAlpha(0.6);
                const strike = this.add.rectangle(boxX + 12 + row.width / 2, y + 7, row.width, 1, 0x9ca3af).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);
                // keep linter happy
                this.leaderboardTexts.push(strike as any);
            }
            this.leaderboardTexts.push(row);
            // Alive indicator dot to the left
            const dotColor = e.alive ? 0x22c55e : 0xef4444;
            const dot = this.add.circle(boxX + 4, y + 6, 3, dotColor).setScrollFactor(0).setDepth(102);
            this.leaderboardDots.push(dot);
        });
    }

    update(time: number, delta: number) {
        const dt = Math.max(0.001, delta / 1000);

        // Twinkling starfield
        for (let i = 0; i < this.starSprites.length; i++) {
            this.starPhases[i] += dt * (0.5 + (i % 7) * 0.1);
            const a = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(this.starPhases[i]));
            this.starSprites[i].setAlpha(a);
        }

        // Smooth input: move current target towards desired target with time-based easing
        const inputAlpha = 1 - Math.exp(-12 * dt);
        this.target.x += (this.desiredTarget.x - this.target.x) * inputAlpha;
        this.target.y += (this.desiredTarget.y - this.target.y) * inputAlpha;

        // Smoothly follow mouse intent for local player (client prediction)
        const dx = this.target.x - (this.player.x as number);
        const dy = this.target.y - (this.player.y as number);
        const len2 = dx * dx + dy * dy;
        if (len2 > 25) {
            const len = Math.sqrt(len2);
            const nx = dx / len;
            const ny = dy / len;
            const stepScale = 220 * dt;
            this.player.x = (this.player.x as number) + nx * stepScale;
            this.player.y = (this.player.y as number) + ny * stepScale;
        }

        // Interpolate all circles towards averaged server targets to avoid jitter (time-based)
        const alpha = 1 - Math.exp(-10 * dt);
        this.playerCircles.forEach((circle, addr) => {
            let target = this.targetByAddr.get(addr);
            const samples = this.samplesByAddr.get(addr);
            if (samples && samples.length) {
                // Simple moving average over last samples
                let sx = 0, sy = 0, ss = 0;
                for (const s of samples) { sx += s.x; sy += s.y; ss += s.size; }
                target = { x: sx / samples.length, y: sy / samples.length, size: ss / samples.length };
            }
            if (!target) return;
            circle.x += (target.x - circle.x) * alpha;
            circle.y += (target.y - circle.y) * alpha;
            const newR = circle.radius + (target.size - circle.radius) * alpha;
            circle.setRadius(newR).setVisible(true);
            const label = this.nameTexts.get(addr);
            if (label) label.setPosition(Math.round(circle.x), Math.round(circle.y - newR - 12));
        });

        // Keep labels glued to circles every frame for smoothness
        this.nameTexts.forEach((t, addr) => {
            const c = this.playerCircles.get(addr);
            if (c) t.setPosition(c.x, c.y - c.radius - 12);
        });

        // Periodically send intent (20 Hz)
        if (!this.gameOver && time - this.lastSent > 50 && this.target) {
            this.lastSent = time;
            fetch(`${BACKEND_BASE_URL}/cryptobubbles_move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: this.sessionId, player: this.playerAddress, x: this.target.x, y: this.target.y })
            }).catch(() => { });
        }
    }
}

export const CryptoBubblesGamePhaser: React.FC<Props> = ({ sessionId, playerAddress }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const gameRef = useRef<Phaser.Game | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,
            backgroundColor: '#0f172a',
            transparent: true as any,
            scale: {
                parent: containerRef.current,
                mode: Phaser.Scale.RESIZE,
                autoCenter: Phaser.Scale.CENTER_BOTH,
                width: '100%',
                height: '100%'
            },
            physics: {
                default: 'arcade',
                arcade: {
                    fps: 60,
                    gravity: { x: 0, y: 0 },
                    debug: false
                }
            },
            scene: [PlayScene]
        };

        const game = new Phaser.Game(config);
        game.scene.start('play', { sessionId, playerAddress });
        gameRef.current = game;

        const onVisibility = () => {
            if (document.hidden) game.loop.sleep();
            else game.loop.wake();
        };
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            game.destroy(true);
            gameRef.current = null;
        };
    }, [sessionId, playerAddress]);

    return <div ref={containerRef} style={{ width: '100%', height: 800, borderRadius: 12, overflow: 'hidden' }} />;
};

export default CryptoBubblesGamePhaser;


