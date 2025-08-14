import React, { useEffect, useRef } from 'react';
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

    init(data: { sessionId: string; playerAddress: string }) {
        this.sessionId = data.sessionId;
        this.playerAddress = data.playerAddress;
    }

    preload() { }

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
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0xffffff, 1);
        g.fillCircle(12, 12, 12);
        g.generateTexture('dd-dot', 24, 24);
        this.player.setTexture('dd-dot');
        this.player.setDamping(true).setDrag(0.002).setMaxVelocity(260);

        this.cursors = this.input.keyboard!.createCursorKeys();
        this.dashKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        this.hazards = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, runChildUpdate: false });

        this.hudText = this.add.text(16, 12, 'Lives: 3  Wave: 1', { fontSize: '14px', color: '#e5e7eb' }).setScrollFactor(0).setDepth(100);

        this.time.addEvent({ delay: 1200, loop: true, callback: this.spawnHazard, callbackScope: this });
        // Join server-side shared session
        fetch(`http://localhost:8000/join_dodgedash_session?sessionId=${encodeURIComponent(this.sessionId)}&player=${encodeURIComponent(this.playerAddress)}`, { method: 'POST' }).catch(() => { });

        this.physics.add.overlap(this.player, this.hazards, this.onHit, undefined, this);
    }

    spawnHazard() {
        if (this.gameOver) return;
        const edge = Phaser.Math.Between(0, 3);
        const w = this.scale.width, h = this.scale.height;
        let x = 0, y = 0, vx = 0, vy = 0;
        const speed = 140 + Math.random() * 120;
        if (edge === 0) { x = -10; y = Math.random() * h; vx = speed; }
        else if (edge === 1) { x = w + 10; y = Math.random() * h; vx = -speed; }
        else if (edge === 2) { x = Math.random() * w; y = -10; vy = speed; }
        else { x = Math.random() * w; y = h + 10; vy = -speed; }
        const dot = this.hazards.create(x, y, 'dd-dot') as Phaser.Physics.Arcade.Image;
        dot.setTint(0xf43f5e).setScale(0.7 + Math.random() * 0.8).setCircle(12);
        dot.setVelocity(vx, vy);
        dot.setBounce(1, 1);
        dot.setCollideWorldBounds(true);
    }

    onHit = (_p: Phaser.GameObjects.GameObject, hazard: Phaser.GameObjects.GameObject) => {
        if (this.gameOver) return;
        const img = hazard as Phaser.Physics.Arcade.Image;
        img.disableBody(true, true);
        this.lives -= 1;
        this.hudText.setText(`Lives: ${this.lives}  Wave: ∞`);
        this.cameras.main.flash(100, 244, 63, 94);
        if (this.lives <= 0) {
            this.endGame(false);
        }
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

        // Dash with cooldown
        if (this.dashKey.isDown && this.dashCooldown <= 0) {
            const v = new Phaser.Math.Vector2(this.player.body.velocity.x, this.player.body.velocity.y);
            if (v.lengthSq() > 1) v.normalize().scale(400);
            else v.set(0, -400);
            this.player.setVelocity(v.x, v.y);
            this.dashCooldown = 0.8;
            this.player.setAlpha(0.6);
            this.tweens.add({ targets: this.player, alpha: 0.95, duration: 300 });
        }
        if (this.dashCooldown > 0) this.dashCooldown -= dt;

        // Send inputs to server (accelerations + dash flag)
        const netAx = (this.cursors.left?.isDown ? -600 : 0) + (this.cursors.right?.isDown ? 600 : 0);
        const netAy = (this.cursors.up?.isDown ? -600 : 0) + (this.cursors.down?.isDown ? 600 : 0);
        const wantDash = this.dashKey.isDown && this.dashCooldown <= 0;
        fetch('http://localhost:8000/dodgedash_move', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: this.sessionId, player: this.playerAddress, ax: netAx, ay: netAy, dash: wantDash })
        }).catch(() => { });
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
            physics: { default: 'arcade', arcade: { gravity: { y: 0 }, fps: 60 } },
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

