import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import type { Connect, Plugin } from 'vite'

/**
 * Vite middleware for the optional CapCut Vietnamese TTS engine.
 *
 * The browser cannot call CapCut directly (native request signing + CDN CORS),
 * so the app asks the Vite dev/preview server for `/capcut/*`. This middleware
 * runs the local Python SDK through `tools/capcut_tts_cli.py` and streams the
 * resulting MP3 back. No extra server process is needed; the only requirement is
 * the Python package:
 *
 *     python3 -m pip install "git+https://github.com/K07VN/capcut-tts-api.git"
 *
 * The same-origin route also works behind Cloud Shell/Codespaces tunnels, where
 * the browser cannot reach the VM's 127.0.0.1 and HTTPS pages cannot call an
 * HTTP helper.
 */

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const CLI = join(ROOT, 'tools', 'capcut_tts_cli.py')
const DEFAULT_VOICE = 'BV421_vivn_streaming'
const MAX_BODY_BYTES = 64 * 1024
const MAX_TEXT_LENGTH = 4000
const HEALTH_CACHE_MS = 5 * 60 * 1000

interface Voice {
  voice_type: string
  display_name: string
  resource_id: string
  lang: string
}

let voiceCache: { at: number; voices: Voice[] } = { at: 0, voices: [] }

function pythonBinary(): string {
  const override = process.env.CAPCUT_PYTHON?.trim()
  if (override) return override
  const venv = join(ROOT, '.venv', 'bin', 'python')
  if (existsSync(venv)) return venv
  return process.platform === 'win32' ? 'python' : 'python3'
}

function runCli(args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBinary(), [CLI, ...args], {
      cwd: ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('CapCut TTS timed out. Try a shorter segment.'))
    }, timeoutMs)
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(
        new Error(
          `Could not start Python (${pythonBinary()}). Install capcut-tts-api or set CAPCUT_PYTHON. ${error.message}`,
        ),
      )
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) {
        resolve(stdout)
        return
      }
      const lines = `${stderr}\n${stdout}`
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
      let message = lines.at(-1) ?? `Python exited with code ${code}.`
      try {
        const parsed = JSON.parse(message) as { error?: string }
        if (parsed.error) message = parsed.error
      } catch {
        // Keep the raw line when it is not JSON.
      }
      reject(new Error(message))
    })
  })
}

async function listVoices(): Promise<Voice[]> {
  if (voiceCache.voices.length > 0 && Date.now() - voiceCache.at < HEALTH_CACHE_MS) {
    return voiceCache.voices
  }
  const output = await runCli(['--list-voices', '--json'], 60_000)
  const parsed = JSON.parse(output) as { voices?: Voice[] }
  const voices = parsed.voices ?? []
  if (voices.length === 0) throw new Error('CapCut returned no Vietnamese voices.')
  voiceCache = { at: Date.now(), voices }
  return voices
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(body)
}

function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body is too large.'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
        if (!parsed || typeof parsed !== 'object') throw new Error('Expected a JSON object.')
        resolve(parsed as Record<string, unknown>)
      } catch {
        reject(new Error('The request body is not valid JSON.'))
      }
    })
    request.on('error', reject)
  })
}

function capcutMiddleware() {
  return async (
    request: IncomingMessage,
    response: ServerResponse,
    next: Connect.NextFunction,
  ): Promise<void> => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (url.pathname !== '/capcut' && !url.pathname.startsWith('/capcut/')) {
      next()
      return
    }
    const route = url.pathname.slice('/capcut'.length) || '/'

    if (request.method === 'OPTIONS') {
      response.statusCode = 204
      response.end()
      return
    }

    try {
      if (request.method === 'GET' && route === '/health') {
        const voices = await listVoices()
        sendJson(response, 200, {
          ok: true,
          voices: voices.length,
          version: 'vite',
          mock: false,
        })
        return
      }
      if (request.method === 'GET' && route === '/voices') {
        sendJson(response, 200, { voices: await listVoices() })
        return
      }
      if (request.method === 'POST' && route === '/tts') {
        const payload = await readJson(request)
        const text = String(payload.text ?? '').trim()
        const voice = String(payload.voice ?? DEFAULT_VOICE).trim()
        const resourceId = String(payload.resource_id ?? '').trim()
        if (!text) {
          sendJson(response, 400, { error: 'There is no text to speak.' })
          return
        }
        if (text.length > MAX_TEXT_LENGTH) {
          sendJson(response, 400, {
            error: `Text is too long (maximum ${MAX_TEXT_LENGTH} characters per request).`,
          })
          return
        }

        const directory = mkdtempSync(join(tmpdir(), 'clippro-capcut-'))
        const output = join(directory, 'speech.mp3')
        try {
          const args = ['--text', text, '--voice', voice, '--out', output, '--json']
          if (resourceId) args.push('--resource-id', resourceId)
          await runCli(args, 200_000)
          const audio = readFileSync(output)
          if (audio.length < 512) {
            throw new Error('CapCut returned an empty audio file. Try another voice.')
          }
          response.statusCode = 200
          response.setHeader('Content-Type', 'audio/mpeg')
          response.setHeader('Content-Length', String(audio.length))
          response.setHeader('Cache-Control', 'no-store')
          response.end(audio)
        } finally {
          rmSync(directory, { recursive: true, force: true })
        }
        return
      }
      sendJson(response, 404, {
        error: 'Unknown endpoint. Use /capcut/health, /capcut/voices or POST /capcut/tts.',
      })
    } catch (error) {
      sendJson(response, 502, {
        error: error instanceof Error ? error.message : 'CapCut TTS failed.',
      })
    }
  }
}

export function capcutTts(): Plugin {
  return {
    name: 'clippro-capcut-tts',
    configureServer(server) {
      server.middlewares.use(capcutMiddleware())
    },
    configurePreviewServer(server) {
      server.middlewares.use(capcutMiddleware())
    },
  }
}
