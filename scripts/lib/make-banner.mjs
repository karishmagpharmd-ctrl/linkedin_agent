import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';

let fontsRegistered = false;

function registerFonts() {
  if (fontsRegistered) return;

  const fontDir = path.resolve('assets/fonts');
  const requiredFonts = [
    { file: 'Poppins-Bold.ttf', name: 'PoppinsBold' },
    { file: 'Poppins-SemiBold.ttf', name: 'PoppinsSemiBold' },
    { file: 'Poppins-Regular.ttf', name: 'Poppins' }
  ];

  for (const font of requiredFonts) {
    const fontPath = path.join(fontDir, font.file);
    if (!fs.existsSync(fontPath)) {
      throw new Error(`Required font file is missing at ${fontPath}. Please run setup to download fonts.`);
    }
    GlobalFonts.registerFromPath(fontPath, font.name);
  }

  fontsRegistered = true;
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines.filter(Boolean);
}

export function makeBanner(topic, brand) {
  registerFonts();

  const width = 1200;
  const height = 627;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Background gradient
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#1e3a8a'); // deep blue
  grad.addColorStop(1, '#4338ca'); // indigo
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // 2. Translucent decoration circles
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.beginPath();
  ctx.arc(1050, 150, 250, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.beginPath();
  ctx.arc(900, 480, 180, 0, Math.PI * 2);
  ctx.fill();

  // 3. Eyebrow label and accent bar
  const leftMargin = 90;
  const topMargin = 80;

  // Accent bar
  ctx.fillStyle = '#60a5fa';
  ctx.fillRect(leftMargin, topMargin, 6, 24);

  // Eyebrow text
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '20px Poppins';
  ctx.fillText('INSIGHTS', leftMargin + 20, topMargin + 19);

  // 4. Headline fitting and word wrapping
  const maxWidth = width - 180; // 1020px
  let fontSize = 76;
  let lines = [];

  while (fontSize >= 42) {
    ctx.font = `${fontSize}px PoppinsBold`;
    lines = wrapText(ctx, topic, maxWidth);
    if (lines.length <= 3) {
      break;
    }
    fontSize -= 2;
  }

  // Handle ultimate overflow (> 3 lines) at min font size
  if (lines.length > 3) {
    ctx.font = '42px PoppinsBold';
    const words = topic.split(/\s+/);
    const line1Words = lines[0].split(/\s+/).length;
    const line2Words = lines[1].split(/\s+/).length;
    const remainingWords = words.slice(line1Words + line2Words);
    let line3 = remainingWords.join(' ');
    
    const ellipsis = '...';
    const limitWidth = maxWidth - ctx.measureText(ellipsis).width;
    while (line3.length > 0 && ctx.measureText(line3).width > limitWidth) {
      line3 = line3.slice(0, -1);
    }
    lines = [lines[0], lines[1], line3.trim() + ellipsis];
  }

  // Draw headline lines
  ctx.fillStyle = '#ffffff';
  ctx.font = `${fontSize}px PoppinsBold`;
  const startY = 190;
  const lineHeight = fontSize * 1.25;

  lines.forEach((line, idx) => {
    ctx.fillText(line, leftMargin, startY + idx * lineHeight);
  });

  // 5. Brand text and blue dot
  const bottomY = height - topMargin;
  ctx.fillStyle = '#ffffff';
  ctx.font = '24px PoppinsSemiBold';
  ctx.fillText(brand, leftMargin, bottomY);

  const brandWidth = ctx.measureText(brand).width;
  ctx.fillStyle = '#60a5fa';
  ctx.beginPath();
  ctx.arc(leftMargin + brandWidth + 12, bottomY - 8, 5, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toBuffer('image/png');
}
