#!/usr/bin/env bash
# capture.sh — open CAPTURE_URL in a browser, wait for rendered content, capture
# desktop (final-desktop.png) and mobile (final-mobile.png) into CAPTURE_DIR,
# then close the browser and leave the app running.
set -euo pipefail

: "${CAPTURE_URL:?CAPTURE_URL is required}"
: "${CAPTURE_DIR:?CAPTURE_DIR is required}"

echo "[capture] URL=$CAPTURE_URL DIR=$CAPTURE_DIR"
/usr/bin/time -p mkdir -p "$CAPTURE_DIR"

PLAYWRIGHT_ROOT="$HOME/.local/share/omgithub-playwright"
export DISPLAY=":$(cat "$PLAYWRIGHT_ROOT/display")"
export NODE_PATH="$PLAYWRIGHT_ROOT/node_modules${NODE_PATH:+:$NODE_PATH}"

# Playwright-driven capture (desktop + mobile viewports).
/usr/bin/time -p node --input-type=commonjs - "$CAPTURE_URL" "$CAPTURE_DIR" <<'NODE'
const { chromium } = require('playwright');
const { mkdirSync } = require('fs');
const { join } = require('path');

(async () => {
  const [url, output] = process.argv.slice(2);
  mkdirSync(output, { recursive: true });

  let browser;
  let exitCode = 0;

  try {
    browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    for (const [name, width, height] of [
      ['desktop', 1440, 900],
      ['mobile', 390, 844],
    ]) {
      const page = await browser.newPage({ viewport: { width, height } });
      page.setDefaultTimeout(30000);
      let response;
      try {
        response = await page.goto(url, { waitUntil: 'load', timeout: 45000 });
      } catch (error) {
        console.error(`Navigation error (${name}):`, error.message);
        exitCode = 75;
        await page.close().catch(() => {});
        break;
      }
      if (!response?.ok()) {
        const isTransient = [408, 429, 500, 502, 503, 504].includes(response.status());
        exitCode = isTransient ? 75 : 1;
        console.error(`HTTP ${response.status()} loading preview`);
        await page.close().catch(() => {});
        break;
      }
      try {
        await page.locator('body').waitFor({ state: 'visible' });
        await page.waitForFunction(() => document.fonts.status === 'loaded').catch(() => {});
        await page.waitForTimeout(1000);
        await page.screenshot({ path: join(output, `final-${name}.png`), timeout: 30000 });
        console.log(`[capture] wrote final-${name}.png`);
      } catch (error) {
        console.error(`Render/screenshot error (${name}):`, error.message);
        exitCode = error.name === 'TimeoutError' ? 75 : 1;
      }
      await page.close();
    }
  } catch (error) {
    console.error('Capture infrastructure error:', error.message);
    exitCode = 75;
  } finally {
    await browser?.close().catch(() => {});
  }

  process.exit(exitCode);
})();
NODE
