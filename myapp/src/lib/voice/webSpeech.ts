import type { SttEngine, SttOptions, TtsEngine } from './types.js';

// Browser-default engines: Web Speech API for STT (Chrome), speechSynthesis
// for TTS (architecture.md §2 voice flow). Minimal ambient typings — the Web
// Speech API is not in lib.dom for all targets.

interface SpeechRecognitionLike {
	lang: string;
	interimResults: boolean;
	continuous: boolean;
	onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
	onerror: ((ev: { error: string }) => void) | null;
	start(): void;
	stop(): void;
	abort(): void;
}
interface SpeechRecognitionEventLike {
	resultIndex: number;
	results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

function recognitionCtor(): (new () => SpeechRecognitionLike) | null {
	if (typeof window === 'undefined') return null;
	const w = window as unknown as Record<string, unknown>;
	return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
		| (new () => SpeechRecognitionLike)
		| null;
}

export class WebSpeechStt implements SttEngine {
	readonly id = 'web-speech';
	private recognition: SpeechRecognitionLike | null = null;

	isAvailable(): boolean {
		return recognitionCtor() !== null;
	}

	start(opts: SttOptions): void {
		const Ctor = recognitionCtor();
		if (!Ctor) {
			opts.onError(new Error('Web Speech API not available in this browser'));
			return;
		}
		this.stop();
		const rec = new Ctor();
		rec.lang = opts.lang;
		rec.interimResults = true;
		rec.continuous = true;
		rec.onresult = (ev) => {
			let interim = '';
			let final = '';
			for (let i = ev.resultIndex; i < ev.results.length; i++) {
				const r = ev.results[i];
				if (r.isFinal) final += r[0].transcript;
				else interim += r[0].transcript;
			}
			if (interim) opts.onPartial(interim);
			if (final) opts.onFinal(final.trim());
		};
		rec.onerror = (ev) => {
			if (ev.error !== 'aborted' && ev.error !== 'no-speech') {
				opts.onError(new Error(`speech recognition error: ${ev.error}`));
			}
		};
		rec.start();
		this.recognition = rec;
	}

	stop(): void {
		this.recognition?.stop();
		this.recognition = null;
	}
}

export class SpeechSynthesisTts implements TtsEngine {
	readonly id = 'speech-synthesis';
	private pending = 0;
	private waiters: Array<() => void> = [];

	isAvailable(): boolean {
		return typeof window !== 'undefined' && 'speechSynthesis' in window;
	}

	speak(sentence: string): void {
		const text = sentence.trim();
		if (!text || !this.isAvailable()) return;
		const utterance = new SpeechSynthesisUtterance(text);
		utterance.rate = 0.95;
		utterance.pitch = 1.15; // small bear, slightly squeaky
		this.pending++;
		const settle = () => {
			this.pending--;
			if (this.pending <= 0) {
				this.waiters.forEach((w) => w());
				this.waiters = [];
			}
		};
		utterance.onend = settle;
		utterance.onerror = settle;
		window.speechSynthesis.speak(utterance);
	}

	flush(): Promise<void> {
		if (this.pending <= 0) return Promise.resolve();
		return new Promise((resolve) => this.waiters.push(resolve));
	}

	cancel(): void {
		if (this.isAvailable()) window.speechSynthesis.cancel();
		this.pending = 0;
		this.waiters.forEach((w) => w());
		this.waiters = [];
	}
}
