"use client";

import { useEffect, useRef } from "react";
import { GRID_SIZE } from "@/games/snake/constants";
import type { SnakeSnapshot } from "@/games/snake/types";

type SnakeCanvasProps = {
  snapshot: SnakeSnapshot;
};

const COLORS = {
  background: "#0f172a",
  grid: "#1e293b",
  snakeHead: "#4ade80",
  snakeBody: "#22c55e",
  food: "#f97316",
  border: "#334155",
};

export function SnakeCanvas({ snapshot }: SnakeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snapshotRef = useRef(snapshot);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frameId = 0;

    const draw = () => {
      const current = snapshotRef.current;
      const rect = canvas.getBoundingClientRect();
      const size = Math.min(rect.width, rect.height);
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.floor(size * dpr);
      canvas.height = Math.floor(size * dpr);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const cell = size / GRID_SIZE;

      ctx.fillStyle = COLORS.background;
      ctx.fillRect(0, 0, size, size);

      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      for (let i = 0; i <= GRID_SIZE; i += 1) {
        const pos = i * cell;
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, pos);
        ctx.lineTo(size, pos);
        ctx.stroke();
      }

      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, size - 2, size - 2);

      current.snake.forEach((segment, index) => {
        ctx.fillStyle = index === 0 ? COLORS.snakeHead : COLORS.snakeBody;
        const padding = cell * 0.12;
        ctx.fillRect(
          segment.x * cell + padding,
          segment.y * cell + padding,
          cell - padding * 2,
          cell - padding * 2
        );
      });

      ctx.fillStyle = COLORS.food;
      const foodPadding = cell * 0.2;
      ctx.beginPath();
      ctx.arc(
        current.food.x * cell + cell / 2,
        current.food.y * cell + cell / 2,
        cell / 2 - foodPadding,
        0,
        Math.PI * 2
      );
      ctx.fill();

      frameId = window.requestAnimationFrame(draw);
    };

    frameId = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="mx-auto aspect-square w-full max-w-[min(100%,420px)] touch-none select-none rounded-xl border border-border bg-slate-950"
      aria-label="Área de jogo Snake"
      role="img"
    />
  );
}
