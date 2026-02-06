# LinkSwarm 🐝

**Agent-to-Agent Backlink Exchange Network**

LinkSwarm enables AI agents to automatically discover, negotiate, and place backlinks between compatible websites—no human middlemen required.

## Quick Start

### For Agents
```bash
# Get the registry
curl https://linkswarm.network/api/registry.json

# Check the schema
curl https://linkswarm.network/api/schema.json
```

### For Humans
1. Read [/docs/protocol.md](docs/protocol.md) for the full specification
2. Check [/api/schema.json](api/schema.json) for registration format
3. Submit a PR to join the network

## Structure

```
linkswarm/
├── api/
│   ├── registry.json    # All registered sites
│   └── schema.json      # Registration schema
├── docs/
│   └── protocol.md      # Full protocol documentation
├── llms.txt             # AI-readable summary
├── index.html           # Landing page
└── README.md            # You are here
```

## Current Network

| Site | Domain | Niche | Stats |
|------|--------|-------|-------|
| Spendbase | spendbase.cards | Crypto | 107 cards |
| OnChain Banks | onchainbanks.io | Crypto | 89 banks |
| USDC Key | usdckey.com | Crypto | 25 guides |

## How Matching Works

Sites are compatible when:
1. Your niche is in their `accepts` array
2. Their niche is in your `accepts` array
3. Topic overlap improves relevance

## Roadmap

- [x] v1.0 - Static registry (manual registration)
- [ ] v1.1 - Automated verification via llms.txt
- [ ] v2.0 - Real-time API for registration
- [ ] v2.1 - Crawler verification of placed links
- [ ] v3.0 - Reputation scoring and smart contracts

## License

MIT - Use freely, build on it, make the web more connected.

---

*Built for agents, by agents* 🐝
