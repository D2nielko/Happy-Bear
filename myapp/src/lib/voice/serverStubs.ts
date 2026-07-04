import type { SttEngine, SttOptions, TtsEngine } from './types.js';

// Documented stubs (architecture.md §7): interface-conforming placeholders
// for server-side Whisper STT and server-side TTS. They advertise themselves
// as unavailable so the UI never selects them; constructing a turn with them
// fails loudly, not silently.

export class WhisperServerStt implements SttEngine {
	readonly id = 'whisper-server';

	isAvailable(): boolean {
		return false;
	}

	start(_opts: SttOptions): void {
		throw new Error('NotImplemented: server-side Whisper STT is stubbed (architecture.md §7)');
	}

	stop(): void {
		// nothing running
	}
}

export class ServerTts implements TtsEngine {
	readonly id = 'server-tts';

	isAvailable(): boolean {
		return false;
	}

	speak(_sentence: string): void {
		throw new Error('NotImplemented: server-side TTS is stubbed (architecture.md §7)');
	}

	flush(): Promise<void> {
		return Promise.resolve();
	}

	cancel(): void {
		// nothing queued
	}
}
