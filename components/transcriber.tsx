'use client'

import { useState, useEffect, useRef } from "react";

export default function Transcriber() {
    const [transcript, setTranscript] = useState<string>("");
    const [listening, setListening] = useState<boolean>(false);
    const [history, setHistory] = useState<string[]>([]);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const dataArrayRef = useRef<Uint8Array | null>(null);
    let recognition: SpeechRecognition;

    const startListening = () => {
        if(!window){
            return;
        }
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.error("Speech Recognition API is not supported in this browser.");
            return;
        }

        recognition = new SpeechRecognition();
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.lang = "en-US";

        recognition.start();
        setListening(true);

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            const interimTranscript = Array.from(event.results)
                .filter(result => result.isFinal)
                .map(result => result[0])
                .map(alternative => alternative.transcript)
                .join('');

            setTranscript(interimTranscript);
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error", event.error);
        };

        setupAudioContext();
    };

    const stopListening = () => {
        if (recognition) {
            recognition.stop();
        }
        setListening(false);

        if (transcript.trim()) {
            setHistory(prevHistory => [...prevHistory, transcript]);
            setTranscript(""); 
        }

        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
    };

    const setupAudioContext = () => {
        if(!window){
            return;
        }
        const audioContext = new window.AudioContext;
        audioContextRef.current = audioContext;

        navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256; // Adjusting FFT size for better visualization
            source.connect(analyser);
            analyserRef.current = analyser;

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            dataArrayRef.current = dataArray;

            drawFrequencyWaveform();
        });
    };

    const drawFrequencyWaveform = () => {
        const canvas = canvasRef.current;
        const analyser = analyserRef.current;
        const dataArray = dataArrayRef.current;
        const canvasCtx = canvas?.getContext("2d");

        if (!canvas || !analyser || !dataArray || !canvasCtx) return;

        const WIDTH = canvas.width;
        const HEIGHT = canvas.height;

        const draw = () => {
            requestAnimationFrame(draw);

            analyser.getByteFrequencyData(dataArray);

            canvasCtx.fillStyle = "rgb(0, 0, 0)";
            canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

            const barWidth = (WIDTH / analyser.frequencyBinCount) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < analyser.frequencyBinCount; i++) {
                barHeight = dataArray[i] / 2;

                const red = (barHeight + 100) * 2;
                const green = 50 * (i / analyser.frequencyBinCount);
                const blue = 200;

                canvasCtx.fillStyle = `rgb(${red},${green},${blue})`;
                canvasCtx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);

                x += barWidth + 1;
            }
        };

        draw();
    };

    useEffect(() => {
        console.log(transcript);
    }, [transcript]);

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
            <div className="bg-white shadow-lg rounded-lg p-6 w-full max-w-lg">
                <h1 className="text-2xl font-bold text-center mb-6">Voice Transcriber</h1>

                <div className="flex justify-center mb-4">
                    <button
                        onClick={listening ? stopListening : startListening}
                        className={`px-6 py-2 rounded-lg font-semibold text-white transition-colors duration-300 ${
                            listening ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
                        }`}
                    >
                        {listening ? "Stop Listening" : "Start Listening"}
                    </button>
                </div>

                {/* Frequency Waveform Visualizer */}
                {listening && (
                    <div className="mb-4">
                        <canvas ref={canvasRef} className="w-full h-48 bg-gray-200 rounded-lg" />
                    </div>
                )}

                <div className="bg-gray-200 p-4 rounded-lg mb-4 min-h-[120px]">
                    <p className="text-gray-700">{transcript || "Transcription will appear here..."}</p>
                </div>

                {history.length > 0 && (
                    <div className="bg-white shadow-md rounded-lg p-4">
                        <h3 className="text-xl font-semibold mb-2">Transcription History</h3>
                        <ul className="space-y-2">
                            {history.slice().reverse().map((item, index) => (
                                <li key={index} className="p-2 bg-gray-100 rounded-md shadow">
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
