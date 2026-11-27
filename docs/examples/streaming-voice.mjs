// Application example for one mono Deepgram Nova or Flux microphone session.
import { create, Script, z } from 'casai';
import { experimental_streamTextLowMemory } from 'ai';

// A speaker can be the only consumer of a plain text reply.
export function singleListenerAnswer(model) {
  return { run: ({ prompt, abortSignal }) => experimental_streamTextLowMemory({ model, prompt, abortSignal }) };
}

function spokenText(parts, signal) {
  return parts.pipeThrough(new TransformStream({
    transform(part, controller) {
      if (part.type === 'error') throw part.error;
      if (part.type === 'abort') throw signal.reason ?? new Error(part.reason ?? 'Reply aborted');
      if (part.type === 'text-delta') controller.enqueue(part.text);
    },
  }), { signal });
}

export async function runVoiceTurns({ listen, answer, speak, audio, signal, caption, play, stopPlayback }) {
  const shutdown = new AbortController();
  const capture = signal ? AbortSignal.any([signal, shutdown.signal]) : shutdown.signal;
  const reply = Script({
    script: 'var parts = answer.run({ prompt: utterance, abortSignal: turnSignal }).fullStream\nreturn speak.run({ text: spokenText(parts, turnSignal), abortSignal: turnSignal })',
    context: { answer, speak, spokenText },
  });
  let active;
  const replies = new Set();

  function interrupt() {
    if (active) {
      active.abort(capture.reason);
      active = undefined;
      stopPlayback();
    }
  }

  async function showCaption(text) {
    try { await caption(text, capture); }
    catch (error) { shutdown.abort(error); throw error; }
  }

  function respond(utterance) {
    if (!utterance || capture.aborted) return;
    interrupt();
    const turn = new AbortController();
    active = turn;
    const work = (async () => {
      const speech = await reply.run({ context: { utterance, turnSignal: turn.signal } });
      turn.signal.throwIfAborted();
      await play(speech, turn.signal);
    })().catch(error => {
      if (!turn.signal.aborted) shutdown.abort(error);
    }).finally(() => {
      if (active === turn) active = undefined;
      replies.delete(work);
    });
    replies.add(work);
  }

  const stable = [];
  let speaking = false;
  let lastFluxTurn = -1;
  capture.addEventListener('abort', interrupt, { once: true });
  try {
    capture.throwIfAborted();
    const result = await listen.run({ audio, abortSignal: capture });
    // Interrupt a pending transcript read even while the microphone is quiet.
    const events = result.fullStream.pipeThrough(new TransformStream(), { signal: capture });
    for await (const part of events) {
      capture.throwIfAborted();
      if (part.type === 'error') throw part.error;
      if (part.type !== 'transcript-partial' && part.type !== 'transcript-final') continue;
      const metadata = part.providerMetadata?.deepgram;
      if (metadata?.event) {
        if (metadata.turnIndex <= lastFluxTurn) continue;
        if (!speaking) interrupt();
        speaking = true;
        await showCaption(part.text);
        if (part.type === 'transcript-final' && metadata.event === 'EndOfTurn') {
          lastFluxTurn = metadata.turnIndex;
          speaking = false;
          respond(part.text.trim());
        }
      } else if (typeof metadata?.speechFinal === 'boolean') {
        if (part.text && !speaking) {
          interrupt();
          speaking = true;
        }
        if (part.type === 'transcript-final' && part.text) stable.push(part.text);
        const text = part.type === 'transcript-partial' ? [...stable, part.text] : stable;
        await showCaption(text.join(' ').trim());
        if (part.type === 'transcript-final' && metadata.speechFinal) {
          const utterance = stable.join(' ').trim();
          stable.length = 0;
          speaking = false;
          respond(utterance);
        }
      } else {
        throw new Error('This example requires a Deepgram utterance boundary.');
      }
    }
    await Promise.all(replies);
    capture.throwIfAborted();
  } finally {
    capture.removeEventListener('abort', interrupt);
    interrupt();
    shutdown.abort();
    await Promise.all(replies);
  }
}

function mp3Body(speech, signal) {
  return speech.fullStream.pipeThrough(new TransformStream({
    transform(part, controller) {
      if (part.type === 'error') throw part.error;
      if (part.type !== 'audio') return;
      if (part.audioFormat.type !== 'audio/mpeg') throw new Error('Expected MP3 speech.');
      controller.enqueue(part.audio);
    },
  }), { signal });
}

// Each signed-in conversation owns its Map of reply IDs to ongoing MP3 speech results.
export function takeMp3Reply(replies, replyId, request) {
  const method = request?.method ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  const speech = replies.get(replyId);
  if (!speech) return new Response(null, { status: 410, headers: { 'Cache-Control': 'private, no-store' } });
  const headers = { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, no-store', 'Accept-Ranges': 'none' };
  if (method === 'HEAD') return new Response(null, { headers });
  const signal = request?.signal ?? request;
  signal?.throwIfAborted();
  replies.delete(replyId);
  return new Response(mp3Body(speech, signal), { headers });
}

// save is an application-owned writer. It returns an immutable ID after committing the bytes.
export function voiceMemoTool(speak, save) {
  return create.Function.asTool({
    inputSchema: z.object({ text: z.string() }),
    async execute({ text, _toolOptions }) {
      const writer = new AbortController();
      const signal = _toolOptions.abortSignal
        ? AbortSignal.any([writer.signal, _toolOptions.abortSignal])
        : writer.signal;
      const speech = await speak.run({ text, abortSignal: signal });
      const file = { filename: 'memo.mp3', mediaType: 'audio/mpeg' };
      try {
        const assetId = await save(mp3Body(speech, signal), file, signal);
        return { assetId, ...file, caption: text };
      } catch (error) {
        writer.abort(error);
        throw error;
      }
    },
    toModelOutput: ({ output }) => ({ type: 'text', value: output.caption }),
  });
}
