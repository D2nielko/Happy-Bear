# Happy-Bear

An AI companion for everyone ranging from children to adults to simulate the experience of having a conversation with your personal teddy bear.

## Features

- **Conversational companion** — Chat with Happy Bear, a warm, in-character teddy bear powered by the Claude API. The bear remembers what you tell it and responds with emotion-aware replies.
- **Expressive bear** — Animated teddy bear reacts to the conversation with emotions (happy, excited, sad, sleepy, idle) and responds to pats and hugs.
- **Coaching** — Beyond casual companionship, Happy Bear offers gentle coaching: it can listen, reflect back what you share, and encourage you toward your goals and well-being in a supportive, non-judgmental way.

## Tech stack

- **Frontend:** SvelteKit + Tailwind CSS
- **Backend:** SvelteKit server routes
- **AI:** Anthropic Claude API
- **Storage:** Local session/message store for conversation memory

## Getting started

```bash
cd myapp
npm install
npm run dev
```

Set your `ANTHROPIC_API_KEY` in `myapp/.env` before running.

## Deployment

The app is deployed as a static/SSR build served through **AWS CloudFront** for fast, globally distributed delivery.

```bash
cd myapp
npm run build
```

Build output is published to an S3 origin and served via the CloudFront distribution. Configure your S3 bucket and CloudFront distribution, then upload the build artifacts and invalidate the cache on each release.
