const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const { test } = require('node:test');

test('real server returns readable CORS errors for oversized imports', async () => {
  const reservation = net.createServer();
  await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const origin = 'http://localhost:5173';
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), NODE_ENV: 'test', EDUFLOW_DEMO_MODE: 'false', AUTH_ALLOWED_ORIGINS: origin },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (data) => { output += data; });
  child.stderr.on('data', (data) => { output += data; });
  try {
    const deadline = Date.now() + 10000;
    while (!output.includes('EduFlow backend listening')) {
      if (child.exitCode !== null) throw new Error('Backend failed to start.');
      if (Date.now() > deadline) throw new Error('Backend startup timed out.');
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const response = await fetch(`http://127.0.0.1:${port}/api/saved-items/import`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ items: ['a'.repeat(1024 * 1024)] }),
    });
    assert.equal(response.status, 413);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.deepEqual(await response.json(), {
      success: false,
      message: 'Request body vượt quá 1 MiB; không có mục nào được nhập.',
    });
  } finally {
    child.kill();
    if (child.exitCode === null && child.signalCode === null) {
      await new Promise((resolve) => child.once('exit', resolve));
    }
  }
});
