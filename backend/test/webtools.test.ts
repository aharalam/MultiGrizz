import test from 'node:test';
import assert from 'node:assert/strict';
import { htmlToText, isPrivateAddress, readPage, venueTools } from '../src/webtools.js';

test('private, loopback, and link-local addresses are blocked', () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) {
    assert.equal(isPrivateAddress(address), true, address);
  }
  assert.equal(isPrivateAddress('93.184.216.34'), false);
});

test('read_page refuses non-HTTPS, credentialed, and local targets before fetching', async () => {
  let fetched = false;
  const fetcher: typeof fetch = async () => { fetched = true; return new Response('x'); };
  for (const url of ['http://example.com', 'https://user:pw@example.com', 'https://localhost/', 'https://127.0.0.1/', 'https://[::1]/', 'https://example.com:8443/', 'file:///etc/passwd']) {
    await assert.rejects(readPage(url, fetcher), undefined, url);
  }
  assert.equal(fetched, false);
});

test('page text drops scripts, styles, and markup', () => {
  assert.equal(htmlToText('<style>a{}</style><p>Hall &amp; Rooms</p><script>steal()</script> seats  120'), 'Hall & Rooms seats 120');
});

test('venue tools ignore names they do not own', async () => {
  assert.equal(await venueTools.invoke('share_finding', {}), undefined);
});
