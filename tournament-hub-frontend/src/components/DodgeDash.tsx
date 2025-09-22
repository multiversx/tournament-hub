import React, { useEffect, useRef } from 'react';
import { BACKEND_BASE_URL } from '../config/backend';
// @ts-ignore
import Phaser from 'phaser';

type Props = { sessionId: string; playerAddress: string };

class DDScene extends Phaser.Scene {
    sessionId!: string;
    playerAddress!: string;
    declare physics: Phaser.Physics.Arcade.ArcadePhysics;
    player!: Phaser.Physics.Arcade.Image;
    cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    dashKey!: Phaser.Input.Keyboard.Key;
    hazards!: Phaser.Physics.Arcade.Group;
    hudText!: Phaser.GameObjects.Text;
    lives: number = 3;
    dashCooldown = 0;
    gameOver = false;
    endText?: Phaser.GameObjects.Text;
    gameStartTime: number = 0;
    wave: number = 1;
    gameState: any = null;
    stateUpdateTimer: number = 0;
    lastInputTime: number = 0;
    inputThrottle: number = 50; // Send input every 50ms (20 FPS)
    lastSentInput: { ax: number; ay: number; dash: boolean } = { ax: 0, ay: 0, dash: false };

    init(data: { sessionId: string; playerAddress: string }) {
        this.sessionId = data.sessionId;
        this.playerAddress = data.playerAddress;
    }

    preload() { }

    async fetchGameState() {
        try {
            const response = await fetch(`${BACKEND_BASE_URL}/dodgedash_game_state?sessionId=${encodeURIComponent(this.sessionId)}`);
            if (response.ok) {
                this.gameState = await response.json();
                this.syncWithGameState();
            }
        } catch (error) {
            console.error('Error fetching game state:', error);
        }
    }

    syncWithGameState() {
        if (!this.gameState) return;

        // Update player lives from server state
        const playerData = this.gameState.players[this.playerAddress];
        if (playerData) {
            this.lives = playerData.lives;
            this.gameOver = !playerData.alive;
        }

        // Update wave from server state (authoritative)
        if (this.gameState.wave) {
            this.wave = this.gameState.wave;
        }

        // Sync hazards from server
        this.syncHazards();

        // Update HUD
        this.hudText.setText(`Lives: ${this.lives}  Wave: ${this.wave}`);

        // Check for game over
        if (this.gameState.game_over && !this.gameOver) {
            this.endGame(this.gameState.winner === this.playerAddress);
        }
    }

    syncHazards() {
        if (!this.gameState?.hazards) return;

        // Clear existing hazards
        this.hazards.clear(true, true);

        // Add hazards from server state
        this.gameState.hazards.forEach((hazard: any) => {
            if (hazard.x > -500 && hazard.y > -500) { // Only show hazards that are on screen
                const dot = this.hazards.create(hazard.x, hazard.y, 'dd-dot') as Phaser.Physics.Arcade.Image;
                dot.setTint(0xf43f5e).setScale(0.7 + (hazard.r / 18) * 0.8).setCircle(12);
                dot.setVelocity(hazard.vx, hazard.vy);
                dot.setBounce(1, 1);
                dot.setCollideWorldBounds(true);
            }
        });
    }

    create() {
        this.cameras.main.setBackgroundColor('#0b1220');

        const w = this.scale.width;
        const h = this.scale.height;
        this.player = this.physics.add.image(w / 2, h / 2, undefined as any)
            .setCircle(12)
            .setTint(0x38bdf8)
            .setAlpha(0.95)
            .setDepth(10);
        // draw circle texture dynamically
        const g = this.make.graphics({ x: 0, y: 0 });
        g.fillStyle(0xffffff, 1);
        g.fillCircle(12, 12, 12);
        g.generateTexture('dd-dot', 24, 24);
        this.player.setTexture('dd-dot');
        this.player.setDamping(true).setDrag(0.002).setMaxVelocity(260);

        // Set world bounds to prevent player from exiting the game area
        this.player.setCollideWorldBounds(true);
        this.physics.world.setBounds(0, 0, w, h);

        this.cursors = this.input.keyboard!.createCursorKeys();
        this.dashKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        this.hazards = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, runChildUpdate: false });

        this.gameStartTime = this.time.now;
        this.hudText = this.add.text(16, 12, 'Lives: 3  Wave: 1', { fontSize: '14px', color: '#e5e7eb' }).setScrollFactor(0).setDepth(100);

        // Join server-side shared session and fetch initial state
        fetch(`${BACKEND_BASE_URL}/join_dodgedash_session?sessionId=${encodeURIComponent(this.sessionId)}&player=${encodeURIComponent(this.playerAddress)}`, { method: 'POST' })
            .then(() => this.fetchGameState())
            .catch(() => { });

        // Set up periodic game state updates (every 200ms for smooth sync)
        this.time.addEvent({ delay: 200, loop: true, callback: this.fetchGameState, callbackScope: this });

        this.physics.add.overlap(this.player, this.hazards, this.onHit, undefined, this);
    }

    // Hazard spawning is now handled server-side only

    onHit = (_p: any, hazard: any) => {
        if (this.gameOver) return;
        const img = hazard as Phaser.Physics.Arcade.Image;
        img.disableBody(true, true);
        // Lives and game over are now handled by server state synchronization
        // Just show visual feedback
        this.cameras.main.flash(100, 244, 63, 94);
    };

    endGame(win: boolean) {
        this.gameOver = true;
        this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x000000, 0.4)
            .setScrollFactor(0).setDepth(199);
        this.endText = this.add.text(this.scale.width / 2, this.scale.height / 2, win ? 'You Survived!' : 'Game Over', {
            fontSize: '44px', color: win ? '#10b981' : '#f87171'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
    }

    update(_: number, delta: number) {
        if (this.gameOver) return;
        const dt = delta / 1000;
        const accel = 600;
        let ax = 0, ay = 0;
        if (this.cursors.left?.isDown) ax -= accel;
        if (this.cursors.right?.isDown) ax += accel;
        if (this.cursors.up?.isDown) ay -= accel;
        if (this.cursors.down?.isDown) ay += accel;
        this.player.setAcceleration(ax, ay);

        // Wave and lives are now updated from server state in syncWithGameState()
        // Only update HUD if we don't have server state yet
        if (!this.gameState) {
            this.hudText.setText(`Lives: ${this.lives}  Wave: ${this.wave}`);
        }

        // Dash with cooldown
        if (this.dashKey.isDown && this.dashCooldown <= 0) {
            const v = new Phaser.Math.Vector2(this.player.body?.velocity.x || 0, this.player.body?.velocity.y || 0);
            if (v.lengthSq() > 1) v.normalize().scale(400);
            else v.set(0, -400);
            this.player.setVelocity(v.x, v.y);
            this.dashCooldown = 0.8;
            this.player.setAlpha(0.6);
            this.tweens.add({ targets: this.player, alpha: 0.95, duration: 300 });
        }
        if (this.dashCooldown > 0) this.dashCooldown -= dt;

        // Send inputs to server (accelerations + dash flag) - throttled to 20 FPS
        const now = this.time.now;
        if (now - this.lastInputTime >= this.inputThrottle) {
            const netAx = (this.cursors.left?.isDown ? -600 : 0) + (this.cursors.right?.isDown ? 600 : 0);
            const netAy = (this.cursors.up?.isDown ? -600 : 0) + (this.cursors.down?.isDown ? 600 : 0);
            const wantDash = this.dashKey.isDown && this.dashCooldown <= 0;

            // Only send if input has changed or there's a dash
            const currentInput = { ax: netAx, ay: netAy, dash: wantDash };
            const inputChanged = currentInput.ax !== this.lastSentInput.ax ||
                currentInput.ay !== this.lastSentInput.ay ||
                currentInput.dash !== this.lastSentInput.dash;

            if (inputChanged) {
                fetch(`${BACKEND_BASE_URL}/dodgedash_move`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId: this.sessionId, player: this.playerAddress, ax: netAx, ay: netAy, dash: wantDash })
                }).catch(() => { });
                this.lastSentInput = currentInput;
                this.lastInputTime = now;
            }
        }
    }
}

const DodgeDash: React.FC<Props> = ({ sessionId, playerAddress }) => {
    const ref = useRef<HTMLDivElement>(null);
    const gameRef = useRef<Phaser.Game | null>(null);

    useEffect(() => {
        if (!ref.current) return;
        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,
            backgroundColor: '#0b1220',
            scale: { parent: ref.current, mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH, width: '100%', height: 600 },
            physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, fps: 60 } },
            scene: [DDScene]
        };
        const game = new Phaser.Game(config);
        game.scene.start('default', { sessionId, playerAddress });
        gameRef.current = game;
        return () => { game.destroy(true); gameRef.current = null; };
    }, [sessionId, playerAddress]);

    return <div ref={ref} style={{ width: '100%', height: 600, borderRadius: 12, overflow: 'hidden' }} />;
};

export default DodgeDash;

