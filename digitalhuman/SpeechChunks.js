import MicrophoneAudio from './MicrophoneAudio.js';
import { VadDetector } from './VoiceActivityDetector.js';

export class SpeechChunks {
    constructor(onSpeechStart, onSpeechEnd) {
        this.SAMPLE_RATE = 16000;
        this.START_THRESHOLD = 0.6;
        this.END_THRESHOLD = 0.45;
        this.MIN_SILENCE_DURATION_MS = 600;
        this.SPEECH_PAD_MS = 500;
        this.WINDOW_SIZE_SAMPLES = 512;

        this.chunks = [];
        this.isSpeechActive = false;

        this.microphoneAudio = new MicrophoneAudio({
            sampleRate: this.SAMPLE_RATE,
            windowSizeSamples: this.WINDOW_SIZE_SAMPLES,
            onAudioData: this.processAudioData.bind(this)
        });
        
        this.onSpeechStart = onSpeechStart;
        this.onSpeechEnd = onSpeechEnd;

        this.vadDetector = new VadDetector(
            this.START_THRESHOLD,
            this.END_THRESHOLD,
            this.SAMPLE_RATE,
            this.MIN_SILENCE_DURATION_MS,
            this.SPEECH_PAD_MS
        );

        console.log('SpeechChunks initialized');
    }

    async processAudioData(audioData) {
        console.log(`Processing audio data of length ${audioData.length}`);
        try {
            const result = await this.vadDetector.apply(audioData, false);
            if (result.start !== undefined) {
                this.isSpeechActive = true;
                console.log('Speech start detected');
                this.onSpeechStart();
            } else if (result.end !== undefined) {
                this.isSpeechActive = false;
                console.log('Speech end detected');
                this.onSpeechEnd(this.getBlob());
            }
            if (this.isSpeechActive) {
                console.log('Adding chunk to speech');
                this.chunks.push(Array.from(audioData));
            }
        } catch (error) {
            console.error('Error processing audio data', error);
        }
    }

    async start() {
        console.log('Starting SpeechChunks');
        await this.microphoneAudio.start();
    }
    
    stop() {
        console.log('Stopping SpeechChunks');
        this.microphoneAudio.stop();
        this.vadDetector.reset();
        this.isSpeechActive = false;
    }

    getSpeechChunks() {
        console.log(`Returning ${this.chunks.length} speech chunks`);
        const speechChunks = this.chunks;
        this.chunks = [];
        return speechChunks;
    }

    getBlob() {
        console.log('Creating audio blob from speech chunks');
        const combinedChunks = this.chunks;
        const combinedLength = combinedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const combinedAudio = new Float32Array(combinedLength);
        let offset = 0;
        for (const chunk of combinedChunks) {
            combinedAudio.set(chunk, offset);
            offset += chunk.length;
        }

        const intData = new Int16Array(combinedAudio.length);
        for (let i = 0; i < combinedAudio.length; i++) {
            const s = Math.max(-1, Math.min(1, combinedAudio[i]));
            intData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        const header = new ArrayBuffer(44);
        const view = new DataView(header);

        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + intData.length * 2, true);
        this.writeString(view, 8, 'WAVE');

        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, this.SAMPLE_RATE, true);
        view.setUint32(28, this.SAMPLE_RATE * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);

        this.writeString(view, 36, 'data');
        view.setUint32(40, intData.length * 2, true);

        const blob = new Blob([header, intData], { type: 'audio/wav' });
        console.log(`Created blob of size ${blob.size} bytes`);
        return blob;
    }

    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    async close() {
        console.log('Closing SpeechChunks');
        this.stop();
        await this.vadDetector.close();
    }
}
