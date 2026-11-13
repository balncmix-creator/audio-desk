const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const html = fs.readFileSync(path.join(__dirname, '../app/build/generated/playAssets/index.html'), 'utf8');
  assert.doesNotMatch(html, /torrent|warez|audioz|rutracker|1337x|keygen|crack/i);
  const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport: {width: 393, height: 852}});
    const errors = [];
    const requests = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => {
      const url = route.request().url();
      requests.push(decodeURIComponent(url));
      if (url === 'https://appassets.androidplatform.net/assets/index.html') return route.fulfill({contentType: 'text/html', body: html});
      if (url.includes('api.rss2json.com')) return route.fulfill({json: {status: 'ok', items: [{title: 'Audio news', link: 'https://example.com/story', description: 'Publisher news'}]}});
      if (url.includes('api.github.com')) return route.fulfill({json: {items: []}});
      return route.abort();
    });
    await page.goto('https://appassets.androidplatform.net/assets/index.html');
    await page.waitForFunction(() => !document.getElementById('refresh').disabled);
    assert.equal(await page.locator('#stories .story').count(), 1);
    await page.locator('[data-save]').click();
    await page.locator('[data-filter="Saved"]').click();
    assert.match(await page.locator('#stories').textContent(), /Audio news/);
    await page.locator('[data-view="samples"]').click();
    assert.ok(await page.locator('#resourceList .resource-card').count() > 0);
    await page.locator('#search').fill('Freesound');
    assert.equal(await page.locator('#resourceList .resource-card').count(), 1);
    await page.locator('[data-filter="All"]').click();
    await page.locator('#search').fill('');
    await page.locator('#webSearch').click();
    await page.waitForFunction(() => !document.getElementById('webSearch').disabled);
    assert.doesNotMatch(requests.join('\n'), /torrent|warez|audioz|rutracker|1337x|keygen|crack/i);
    assert.deepEqual(errors, [], 'Play edition should run without removed-feature references');
    console.log('PASS: Play edition excludes restricted discovery code, controls and feed queries; news, bookmarks, samples and search work');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
