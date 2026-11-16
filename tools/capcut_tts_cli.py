#!/usr/bin/env python3
"""Generate Vietnamese speech with CapCut, without running a web server.

This is a server-free alternative to the Vite `/capcut` bridge: it uses the
MIT-licensed `K07VN/capcut-tts-api` package directly and writes an MP3 file.
Use it when you do not want to keep a helper process running; import the
generated file into ClipPro like any other audio asset.

Install once:

    python3 -m pip install "git+https://github.com/K07VN/capcut-tts-api.git"

Examples:

    # List every Vietnamese voice
    python3 tools/capcut_tts_cli.py --list-voices

    # Generate one file
    python3 tools/capcut_tts_cli.py \
        --text "Xin chào, đây là giọng đọc tiếng Việt." \
        --voice BV421_vivn_streaming \
        --out voice.mp3

    # Generate one file per blank-line-separated paragraph
    python3 tools/capcut_tts_cli.py --text-file script.txt --out-dir voices/

The old sample code that reads `response["data"]["audio_content"]` and passes
`rate=` does not match the current SDK. CapCut returns a task with a signed CDN
URL, so this tool calls `CapCutClient.download_tts_audio()` as intended.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

try:
    from capcut_tts_api import CapCutClient
except ImportError:  # pragma: no cover - exercised only without the package
    CapCutClient = None  # type: ignore[assignment]


VI_LANG = "vi-VN"
DEFAULT_VOICE = "BV421_vivn_streaming"


def voice_to_dict(voice: Any) -> dict[str, str]:
    return {
        "voice_type": str(getattr(voice, "voice_type", "")),
        "display_name": str(getattr(voice, "display_name", "")),
        "resource_id": str(getattr(voice, "resource_id", "")),
        "lang": str(getattr(voice, "lang", VI_LANG)),
    }


def split_script(text: str) -> list[str]:
    """Split on blank lines, keeping each paragraph as one synthesis request."""
    return [block.strip() for block in text.replace("\r\n", "\n").split("\n\n") if block.strip()]


def synthesize(
    client: Any,
    text: str,
    voice: str,
    resource_id: str | None,
    output: Path,
    timeout: float,
) -> dict[str, Any]:
    clean = text.strip()
    if not clean:
        raise ValueError("There is no text to speak.")
    if len(clean) > 4000:
        raise ValueError("Text is too long (maximum 4000 characters per request).")

    output.parent.mkdir(parents=True, exist_ok=True)
    kwargs: dict[str, Any] = {
        "voice": voice,
        "wait": True,
        "timeout": timeout,
    }
    if resource_id:
        kwargs["resource_id"] = resource_id
    response = client.generate_speech(clean, **kwargs)
    client.download_tts_audio(response, output)

    size = output.stat().st_size if output.exists() else 0
    if size < 512:
        raise RuntimeError("CapCut returned an empty audio file. Try another voice.")
    return {"ok": True, "out": str(output), "bytes": size, "voice": voice}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate Vietnamese speech with CapCut (no web server)."
    )
    parser.add_argument("--list-voices", action="store_true", help="Print the vi-VN voice catalogue.")
    parser.add_argument("--text", help="Text to synthesize.")
    parser.add_argument("--text-file", help="Read text from a file (blank line = separate file).")
    parser.add_argument("--voice", default=DEFAULT_VOICE, help=f"CapCut voice_type (default: {DEFAULT_VOICE}).")
    parser.add_argument("--resource-id", help="Optional CapCut resource_id for the voice.")
    parser.add_argument("--out", help="Output MP3 path for --text.")
    parser.add_argument("--out-dir", help="Output directory for --text-file (Voice 01.mp3, ...).")
    parser.add_argument("--timeout", type=float, default=180.0, help="Task timeout in seconds.")
    parser.add_argument("--json", action="store_true", help="Machine-readable JSON output.")
    args = parser.parse_args()

    if CapCutClient is None:
        message = (
            "capcut-tts-api is not installed. Run: "
            'python3 -m pip install "git+https://github.com/K07VN/capcut-tts-api.git"'
        )
        if args.json:
            print(json.dumps({"ok": False, "error": message}), file=sys.stderr)
        else:
            print(message, file=sys.stderr)
        return 1

    client = CapCutClient(timeout=max(10.0, args.timeout))

    try:
        if args.list_voices:
            voices = [voice_to_dict(voice) for voice in client.list_voices(lang=VI_LANG)]
            if args.json:
                print(json.dumps({"ok": True, "voices": voices}, ensure_ascii=False))
            else:
                print(f"{len(voices)} Vietnamese voices:")
                for voice in voices:
                    print(f"  {voice['display_name']:<24} {voice['voice_type']}")
            return 0

        if args.text_file:
            source = Path(args.text_file)
            blocks = split_script(source.read_text(encoding="utf-8"))
            if not blocks:
                raise ValueError(f"{source} contains no text.")
            out_dir = Path(args.out_dir or source.with_suffix("").name + "-voices")
            results = []
            for index, block in enumerate(blocks, start=1):
                output = out_dir / f"Voice {index:02d}.mp3"
                result = synthesize(
                    client, block, args.voice, args.resource_id, output, args.timeout
                )
                results.append(result)
                if not args.json:
                    print(f"[{index}/{len(blocks)}] {output} ({result['bytes']} bytes)")
            if args.json:
                print(json.dumps({"ok": True, "files": results}, ensure_ascii=False))
            return 0

        if not args.text:
            parser.error("Provide --text, --text-file or --list-voices.")
        if not args.out:
            parser.error("--out is required with --text.")
        result = synthesize(
            client, args.text, args.voice, args.resource_id, Path(args.out), args.timeout
        )
        if args.json:
            print(json.dumps(result, ensure_ascii=False))
        else:
            print(f"[✓] Wrote {result['out']} ({result['bytes']} bytes)")
        return 0
    except Exception as exc:  # surface the service/SDK error to the caller
        if args.json:
            print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        else:
            print(f"[X] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
