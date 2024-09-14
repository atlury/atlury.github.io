import { SpeechChunks } from './SpeechChunks.js';

let speechChunks;

function updateStatus(message) {
    document.getElementById('status').textContent = message;
}

function addAudioToList(blob) {
    const audioList = document.getElementById('audioList');
    const audio = document.createElement('audio');
    audio.src = URL.createObjectURL(blob);
    audio.controls = true;
    audioList.appendChild(audio);
}

function onSpeechStart() {
    updateStatus('Speech detected');
}

function onSpeechEnd(blob) {
    updateStatus('Speech ended');
    addAudioToList(blob);
}

async function startListening() {
    try {
        speechChunks = new SpeechChunks(onSpeechStart, onSpeechEnd);
        await speechChunks.start();
        updateStatus('Listening...');
        document.getElementById('startButton').disabled = true;
        document.getElementById('stopButton').disabled = false;
    } catch (error) {
        console.error('Error starting microphone:', error);
        updateStatus('Error: ' + error.message);
    }
}

function stopListening() {
    if (speechChunks) {
        speechChunks.stop();
        speechChunks = null;
    }
    updateStatus('Not listening');
    document.getElementById('startButton').disabled = false;
    document.getElementById('stopButton').disabled = true;
}

document.getElementById('startButton').addEventListener('click', startListening);
document.getElementById('stopButton').addEventListener('click', stopListening);
