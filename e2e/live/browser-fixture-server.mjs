#!/usr/bin/env node

import { createServer } from 'node:http'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Release browser tools fixture</title>
  </head>
  <body>
    <main>
      <h1>Release browser tools fixture</h1>
      <p>Search the deterministic release catalog, then download its checksum.</p>
      <form id="search-form">
        <label for="release-search">Catalog search</label>
        <input id="release-search" name="q" autocomplete="off">
        <button id="search-button" type="submit">Search</button>
      </form>
      <p id="search-result" role="status">No search has run.</p>
      <a id="download-link" href="/downloads/release-checksum.txt" download>Download release checksum</a>
    </main>
    <script>
      document.querySelector('#search-form').addEventListener('submit', async event => {
        event.preventDefault()
        const query = document.querySelector('#release-search').value
        const response = await fetch('/api/search?q=' + encodeURIComponent(query))
        const result = await response.json()
        document.querySelector('#search-result').textContent = result.result
      })
    </script>
  </body>
</html>`

export function fixtureResponse(method, requestUrl) {
  const url = new URL(requestUrl, 'http://127.0.0.1')
  if (method === 'GET' && url.pathname === '/') {
    return {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: page,
    }
  }
  if (method === 'GET' && url.pathname === '/api/search') {
    const query = url.searchParams.get('q') || ''
    const matched = query === 'release candidate'
    return {
      status: matched ? 200 : 404,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, result: matched ? 'RC browser fixture ready' : 'No matching release' }),
      log: `SEARCH query=${matched ? 'release-candidate' : 'other'} matched=${matched}`,
    }
  }
  if (method === 'GET' && url.pathname === '/downloads/release-checksum.txt') {
    return {
      status: 200,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'content-disposition': 'attachment; filename="release-checksum.txt"',
      },
      body: 'release-candidate-browser-fixture-ok\n',
      log: 'DOWNLOAD file=release-checksum.txt served=true',
    }
  }
  return {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
    body: 'not found\n',
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.argv[2])
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    process.stderr.write('usage: browser-fixture-server.mjs <port>\n')
    process.exit(2)
  }

  const server = createServer((request, response) => {
    const result = fixtureResponse(request.method || 'GET', request.url || '/')
    if (result.log) process.stdout.write(`${result.log}\n`)
    response.writeHead(result.status, result.headers)
    response.end(result.body)
  })

  server.listen(port, '127.0.0.1', () => {
    process.stdout.write(`READY port=${port}\n`)
  })

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => server.close(() => process.exit(0)))
  }
}
