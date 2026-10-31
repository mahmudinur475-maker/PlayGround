import { clamp } from './util.js';

function shade(hex, amount) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const num = parseInt(full, 16);
  const r = clamp(((num >> 16) & 255) + amount, 0, 255);
  const g = clamp(((num >> 8) & 255) + amount, 0, 255);
  const b = clamp((num & 255) + amount, 0, 255);
  return `rgb(${r},${g},${b})`;
}

function rounded(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function limb(ctx, points, width, color, outline) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (outline) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      const previous = points[i - 1];
      const point = points[i];
      const cx = (previous[0] + point[0]) / 2;
      const cy = (previous[1] + point[1]) / 2;
      ctx.quadraticCurveTo(previous[0], previous[1], cx, cy);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last[0], last[1]);
    ctx.lineWidth = width + 2.2;
    ctx.strokeStyle = outline;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const point = points[i];
    const cx = (previous[0] + point[0]) / 2;
    const cy = (previous[1] + point[1]) / 2;
    ctx.quadraticCurveTo(previous[0], previous[1], cx, cy);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last[0], last[1]);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

export function drawRunner(ctx, x, yFeet, height, options = {}) {
  const {
    jersey = '#d8ff57',
    accent = '#8dbb18',
    skin = '#c88457',
    hair = '#21140f',
    shorts = '#111d35',
    shoe = '#f7f1e3',
    phase = 0,
    lean = 0,
    sliding = 0,
    jumping = 0,
    alpha = 1,
    detail = true,
    isPlayer = false,
    style = 'short',
    bib = '',
  } = options;

  if (height < 2 || alpha <= 0) return;
  const scale = height / 100;
  const squash = sliding > 0 ? 0.58 : 1;
  const outline = 'rgba(4, 9, 18, 0.62)';
  const skinShade = shade(skin, -24);
  const isSmall = height < 44;
  const swing = Math.sin(phase);
  const swingB = Math.sin(phase + Math.PI);
  const tuck = clamp(jumping, 0, 1);

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, yFeet);
  ctx.rotate(lean * 0.34);
  ctx.scale(scale, scale * squash);
  if (sliding > 0) ctx.translate(0, -2);

  // legs -------------------------------------------------------------
  const leftHip = [-5.1, -45];
  const rightHip = [5.1, -45];
  const leftSwing = swingB;
  const rightSwing = swing;
  const leftLift = Math.max(0, leftSwing) * (10 + tuck * 10) + tuck * 5;
  const rightLift = Math.max(0, rightSwing) * (10 + tuck * 10) + tuck * 5;

  const leftKnee = [-5.2 + leftSwing * 3.1, -25 - leftLift * 0.42];
  const leftFoot = [-5.2 + leftSwing * 7.6, -4.5 - leftLift];
  const rightKnee = [5.2 + rightSwing * 3.1, -25 - rightLift * 0.42];
  const rightFoot = [5.2 + rightSwing * 7.6, -4.5 - rightLift];

  if (!isSmall) {
    limb(ctx, [leftHip, leftKnee, leftFoot], 7, skinShade, outline);
  } else {
    limb(ctx, [leftHip, leftKnee, leftFoot], 7.4, skinShade, null);
  }

  // shoes
  ctx.save();
  ctx.translate(leftFoot[0], leftFoot[1]);
  ctx.rotate(leftSwing * 0.07);
  rounded(ctx, -6.2, -2.3, 12.4, 4.8, 2.2);
  ctx.fillStyle = shade(shoe, -74);
  ctx.fill();
  rounded(ctx, -5.6, -2.6, 11.2, 4.3, 2);
  ctx.fillStyle = shoe;
  ctx.fill();
  ctx.restore();

  limb(ctx, [rightHip, rightKnee, rightFoot], 7.4, skin, isSmall ? null : outline);

  ctx.save();
  ctx.translate(rightFoot[0], rightFoot[1]);
  ctx.rotate(rightSwing * 0.07 + 0.03);
  rounded(ctx, -6.2, -2.3, 12.4, 4.8, 2.2);
  ctx.fillStyle = shade(shoe, -74);
  ctx.fill();
  rounded(ctx, -5.6, -2.6, 11.2, 4.3, 2);
  ctx.fillStyle = shoe;
  ctx.fill();
  ctx.restore();

  // shorts
  rounded(ctx, -11.4, -53, 22.8, 14.5, 4.4);
  ctx.fillStyle = shorts;
  ctx.fill();
  if (!isSmall) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.globalAlpha *= 0.9;
    rounded(ctx, -11.4, -52.2, 3.3, 12.6, 1.6);
    ctx.fill();
    rounded(ctx, 8.1, -52.2, 3.3, 12.6, 1.6);
    ctx.fill();
    ctx.globalAlpha /= 0.9;
  }

  // back arm
  const backSide = -1;
  const backSwing = swing * 0.9;
  const backElbow = [backSide * 16.5 + backSwing * 1.8, -59 + backSwing * 2.4];
  const backHand = [backSide * 14 + backSwing * 6.4, -47 + backSwing * 6.4];
  limb(ctx, [[backSide * 12.4, -75], backElbow, backHand], 5.4, skinShade, isSmall ? null : outline);

  // torso
  ctx.beginPath();
  ctx.moveTo(-14.6, -78);
  ctx.quadraticCurveTo(-14.8, -57, -11.2, -50.2);
  ctx.quadraticCurveTo(0, -47.2, 11.2, -50.2);
  ctx.quadraticCurveTo(14.8, -57, 14.6, -78);
  ctx.quadraticCurveTo(0, -83.5, -14.6, -78);
  ctx.closePath();
  ctx.fillStyle = jersey;
  ctx.fill();
  if (!isSmall) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // light from the sunset
    ctx.save();
    ctx.clip();
    const glow = ctx.createLinearGradient(-15, 0, 15, 0);
    glow.addColorStop(0, 'rgba(255,255,255,0.18)');
    glow.addColorStop(0.45, 'rgba(255,255,255,0.03)');
    glow.addColorStop(1, 'rgba(0,0,0,0.14)');
    ctx.fillStyle = glow;
    ctx.fillRect(-18, -86, 36, 40);
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(7, -79);
    ctx.quadraticCurveTo(4, -62, 8, -48);
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = accent;
    ctx.globalAlpha *= 0.8;
    ctx.stroke();
    ctx.globalAlpha /= 0.8;
  }

  // sleeves
  ctx.beginPath();
  ctx.ellipse(-13.6, -76.5, 4.6, 4.2, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = jersey;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(13.6, -76.5, 4.6, 4.2, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = jersey;
  ctx.fill();

  // front arm
  const frontSide = 1;
  const frontSwing = swingB * 0.9;
  const frontElbow = [frontSide * 16.5 + frontSwing * 1.8, -59 + frontSwing * 2.4];
  const frontHand = [frontSide * 14 + frontSwing * 6.4, -47 + frontSwing * 6.4];
  limb(ctx, [[frontSide * 12.4, -75], frontElbow, frontHand], 5.6, skin, isSmall ? null : outline);

  // neck + head
  rounded(ctx, -2.8, -83.5, 5.6, 7.2, 2.2);
  ctx.fillStyle = skinShade;
  ctx.fill();

  if (style === 'ponytail') {
    ctx.beginPath();
    ctx.moveTo(0, -94);
    ctx.quadraticCurveTo(-4, -82, 1.4, -76);
    ctx.quadraticCurveTo(4.4, -80, 3.2, -93);
    ctx.fillStyle = hair;
    ctx.fill();
  }
  if (style === 'bun') {
    ctx.beginPath();
    ctx.arc(0, -99.4, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = hair;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(0, -90.2, 9.2, 0, Math.PI * 2);
  ctx.fillStyle = skin;
  ctx.fill();
  if (!isSmall) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  // ears
  ctx.beginPath();
  ctx.arc(-8.7, -88.3, 2.1, 0, Math.PI * 2);
  ctx.arc(8.7, -88.3, 2.1, 0, Math.PI * 2);
  ctx.fillStyle = skinShade;
  ctx.fill();

  // hair — back of head
  ctx.beginPath();
  ctx.ellipse(0, -93.4, 9.6, 7.4, 0, Math.PI, 0);
  ctx.lineTo(9.6, -88.8);
  ctx.quadraticCurveTo(0, -85.2, -9.6, -88.8);
  ctx.closePath();
  ctx.fillStyle = hair;
  ctx.fill();
  if (!isSmall) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }

  if (style === 'short') {
    ctx.beginPath();
    ctx.ellipse(0, -95.6, 8.4, 4.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = shade(hair, 18);
    ctx.fill();
  }

  // headband for the player
  if (isPlayer) {
    ctx.save();
    ctx.shadowColor = 'rgba(216,255,87,0.8)';
    ctx.shadowBlur = 5;
    ctx.fillStyle = '#d8ff57';
    rounded(ctx, -9.3, -92.4, 18.6, 2.6, 1.3);
    ctx.fill();
    ctx.restore();
  }

  // bib number
  if (detail && bib) {
    rounded(ctx, -7.4, -71.8, 14.8, 13.4, 2);
    ctx.fillStyle = 'rgba(247, 243, 232, 0.92)';
    ctx.fill();
    ctx.fillStyle = '#0a1428';
    ctx.font = '900 10.5px Lato, "DejaVu Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(bib), 0, -64.9);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  // player chevron
  if (isPlayer && detail) {
    ctx.save();
    ctx.shadowColor = 'rgba(216,255,87,0.9)';
    ctx.shadowBlur = 7;
    ctx.beginPath();
    ctx.moveTo(0, -113);
    ctx.lineTo(5.2, -105.4);
    ctx.lineTo(2.2, -105.4);
    ctx.lineTo(2.2, -101.6);
    ctx.lineTo(-2.2, -101.6);
    ctx.lineTo(-2.2, -105.4);
    ctx.lineTo(-5.2, -105.4);
    ctx.closePath();
    ctx.fillStyle = '#d8ff57';
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

export function drawRunnerShadow(ctx, x, y, width, alpha = 0.3) {
  if (width < 1) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, width);
  gradient.addColorStop(0, 'rgba(2, 6, 14, 0.72)');
  gradient.addColorStop(0.55, 'rgba(2, 6, 14, 0.35)');
  gradient.addColorStop(1, 'rgba(2, 6, 14, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(x, y, width, width * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawRunnerTag(ctx, x, y, label, color) {
  ctx.save();
  ctx.font = '900 8px Lato, "DejaVu Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const width = ctx.measureText(label).width + 12;
  rounded(ctx, x - width / 2, y - 7, width, 13, 6.5);
  ctx.fillStyle = 'rgba(5, 12, 26, 0.66)';
  ctx.fill();
  ctx.strokeStyle = `${color}66`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillText(label, x, y + 0.5);
  ctx.restore();
}
