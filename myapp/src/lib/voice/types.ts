// Voice boundaries (architecture.md §3). Browser engines are the defaults;
// server-side implementations exist as interface-conforming stubs so swapping
// is a construction-site change, not a refactor.

export interface SttOptions {
	lang: string;
	onPartial(text: string): void;
	onFinal(text: string): void;
	onError(e: Error): void;
}

export interface SttEngine {
	readonly id: string;
	isAvailable(): boolean;
	start(opts: SttOptions): void;
	stop(): void;
}

export interface TtsEngine {
	readonly id: string;
	isAvailable(): boolean;
	speak(sentence: string): void; // called incrementally, sentence by sentence
	flush(): Promise<void>; // resolves when everything queued has been spoken
	cancel(): void;
}
