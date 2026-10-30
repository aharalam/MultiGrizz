# Local Gemma

The team requires local inference. The backend calls Ollama on the same machine; it does not call Google's hosted inference API. Supabase remains remote for shared application data, so the entire application is not offline.

Configuration in the ignored `backend/.env`:

```dotenv
OLLAMA_BASE_URL=http://127.0.0.1:11434
GEMMA_MODEL=gemma4:e2b
```

The first candidate is Gemma 4 E2B. Verify output quality, memory use, and latency on the actual demo machine before increasing model size or concurrency. Runtime and model downloads require internet; local inference after download does not require a Google API key. Do not select a `-cloud` model tag.

## Runtime setup

Install official [Ollama for Windows](https://docs.ollama.com/windows). Then download the model:

```powershell
ollama pull gemma4:e2b
ollama run gemma4:e2b "Reply with: local Gemma is ready"
```

Ollama's local chat endpoint is `POST /api/chat`. Use Node's built-in fetch rather than a Google SDK. Send the model name and messages, and set `stream: false` for the first integration. Bound input size and response length and set a request timeout.

Run one shared model with separate messages/context for each agent run. Player team is synonymous with party; no separate party entity is needed. Players in a team can access all its squads and data; other teams cannot inspect them. Each squad has its own working context. Share context explicitly through handoffs within the team.

Start with one model request at a time and a visible queue. Multiple agent roles do not require loading multiple models. Record which agent, squad, and team initiated each run; enforce authorization before assembling context and saving outputs.

Keep Ollama bound to loopback. Multiplayer browsers access the backend, not Ollama directly. A remotely hosted backend cannot reach this laptop through its own localhost address; run the backend alongside Ollama for the initial demo and choose secure backend access separately when deploying.

The configured server was started with `OLLAMA_HOST=127.0.0.1:11434` and `OLLAMA_NO_CLOUD=1`. Set these in the server process environment again when restarting; values in the backend's `.env` do not automatically configure the separate Ollama process.

No cloud fallback is permitted without an explicit team decision. If Ollama is unavailable, report the failure rather than switching providers silently.

## Verified on the development machine

Ollama 0.40.13 and gemma4:e2b returned `LOCAL_READY` through the loopback `/api/chat` endpoint. First request took 10.3 seconds including loading, with thinking disabled, 1024 context tokens, and a 16-token output cap. This short smoke test establishes local inference works, not agent quality or sustained multiplayer throughput. The machine has 16 GB RAM and Intel Iris Xe graphics; the running server selected CPU inference.

Supabase checks: publishable key accepted by Auth API and secret key accepted by Data API. Direct database endpoint has an IPv6 DNS record, but TCP connection returns ENETUNREACH from this machine. An IPv4 session-pooler URL is needed for direct SQL/schema work. Do not replace valid API keys solely because anonymous Data API root introspection returns HTTP 401.

Sources: [Google local Gemma guide](https://ai.google.dev/gemma/docs/integrations/ollama), [Ollama Gemma 4 E2B](https://ollama.com/library/gemma4:e2b).
