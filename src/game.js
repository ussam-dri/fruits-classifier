import React, { useRef, useState, useEffect } from 'react';
import { Upload, Zap, Download, Trash2, RefreshCw, Heart, X, Info } from 'lucide-react';

function App() {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [imageURL, setImageURL] = useState(null);
  const [status, setStatus] = useState('Welcome to Fruit Guess Game! Upload an image to start.');
  const [predictions, setPredictions] = useState([]);
  const [canvasSize, setCanvasSize] = useState({ width: 500, height: 0 });
  const [originalImageSize, setOriginalImageSize] = useState({ width: 0, height: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [processingTime, setProcessingTime] = useState(null);
  const [score, setScore] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [username, setUsername] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [targetFruit, setTargetFruit] = useState('');
  const [hint, setHint] = useState('');
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [fruitsList] = useState(['apple', 'banana', 'cherry', 'cucumber', 'grapes', 'kiwi', 'lemon', 'mango', 'orange', 'pinapple', 'tomato', 'water_melon']);

  const setNewTarget = () => {
    const newTarget = fruitsList[Math.floor(Math.random() * fruitsList.length)];
    setTargetFruit(newTarget);
    setHint(getHintForFruit(newTarget));
    setStatus(`Find the fruit! Upload an image to reveal it.`);
  };

  const getHintForFruit = (fruit) => {
    const hints = {
      apple: 'A crisp, round fruit that can be red or green.',
      banana: "A long, yellow fruit that's easy to peel.",
      cherry: 'A small, red fruit with a pit, often in pairs.',
      cucumber: "A green, elongated vegetable that's mostly water.",
      grapes: 'Small, juicy fruits that grow in clusters.',
      kiwi: 'A brown, fuzzy fruit with green flesh inside.',
      lemon: 'A sour, yellow citrus fruit.',
      mango: 'A juicy, tropical fruit with a large pit.',
      orange: 'A sweet, round citrus fruit with an orange peel.',
      pinapple: 'A tropical fruit with a tough, spiky skin.',
      tomato: 'A red or green fruit often used like a vegetable.',
      water_melon: 'A large, juicy fruit with a green rind and red flesh.'
    };
    return hints[fruit] || 'A delicious fruit!';
  };

  useEffect(() => {
    setNewTarget();
  }, []);

  const calculateAndSetCanvasSize = (img) => {
    const maxWidth = 500;
    const maxHeight = 400;
    let width = img.naturalWidth;
    let height = img.naturalHeight;

    console.log('Original Image Dimensions:', { width, height });
    const aspectRatio = width / height;

    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspectRatio;
    }
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }

    setCanvasSize({ width: Math.round(width), height: Math.round(height) });
    console.log('Scaled Canvas Size:', { width: Math.round(width), height: Math.round(height) });
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const startTime = Date.now();
    setIsLoading(true);
    const localImageURL = URL.createObjectURL(file);
    setImageURL(localImageURL);
    setStatus('Analyzing image...');

    try {
      const img = imageRef.current;
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = () => {
          console.error('Image failed to load');
          setStatus('❌ Error: Failed to load image');
          setIsLoading(false);
        };
      });

      // Store original image size
      setOriginalImageSize({ width: img.naturalWidth, height: img.naturalHeight });
      calculateAndSetCanvasSize(img);

      const base64 = await toBase64(file);
      const response = await fetch('https://serverless.roboflow.com/infer/workflows/wisd-scixc/custom-workflow-5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: '7kDS0qoq56Si0jbdcRHV',
          inputs: { image: { type: 'base64', value: base64.split(',')[1] } },
        }),
      });

      if (!response.ok) throw new Error('Roboflow API request failed');

      const result = await response.json();
      console.log('Roboflow Response:', result);
      const predictionsData = result?.outputs?.[0]?.predictions?.predictions || [];
      setPredictions(predictionsData.map(pred => ({
        ...pred,
        points: pred.points.map(pt => ({
          x: pt.x,
          y: pt.y
        }))
      })));

      const detectedFruits = predictionsData.map(pred => pred.class.toLowerCase());
      const isCorrect = detectedFruits.includes(targetFruit.toLowerCase());

      if (isCorrect) {
        setScore(prev => prev + 10);
        setSuccessModalOpen(true);
      } else if (predictionsData.length > 0) {
        setHearts(prev => prev - 1);
        setScore(prev => prev - 5);
        setErrorModalOpen(true);
      } else {
        setHearts(prev => prev - 1);
        setScore(prev => prev - 5);
        setErrorModalOpen(true);
      }

      if (hearts - 1 <= 0) {
        setStatus('Game Over! No hearts left. Start a new game!');
        setHearts(0);
      }

      const endTime = Date.now();
      setProcessingTime(((endTime - startTime) / 1000).toFixed(2));
    } catch (error) {
      console.error('Error:', error);
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
    });

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;

    if (!canvas || !ctx || !img || !img.complete) {
      console.log('Canvas drawing failed:', { canvas, ctx, img, imgComplete: img?.complete });
      return;
    }

    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const scaleX = canvasSize.width / originalImageSize.width;
    const scaleY = canvasSize.height / originalImageSize.height;
    console.log('Scaling Factors:', { scaleX, scaleY, originalImageSize, canvasSize });

    if (predictions.length > 0) {
      predictions.forEach((pred) => {
        const { points, class: className, confidence } = pred;
        console.log('Processing prediction:', { className, confidence, points: points.slice(0, 3) });

        ctx.beginPath();
        points.forEach((pt, i) => {
          const scaledX = pt.x * scaleX;
          const scaledY = pt.y * scaleY;
          console.log(`Point ${i}: Original (${pt.x}, ${pt.y}) -> Scaled (${scaledX}, ${scaledY})`);
          if (i === 0) ctx.moveTo(scaledX, scaledY);
          else ctx.lineTo(scaledX, scaledY);
        });
        ctx.closePath();

        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.fill();
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.stroke();

        const label = `${className} ${Math.round(confidence * 100)}%`;
        const labelX = points[0].x * scaleX + 5;
        const labelY = points[0].y * scaleY;

        ctx.fillStyle = 'black';
        ctx.fillRect(labelX, labelY - 14, ctx.measureText(label).width + 8, 16);
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.fillText(label, labelX + 4, labelY - 2);
      });
    } else {
      console.log('No predictions to draw');
    }
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `segmented-image-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const clearImage = () => {
    setImageURL(null);
    setPredictions([]);
    setStatus(`Find the fruit! Upload an image to reveal it.`);
    setProcessingTime(null);
    setOriginalImageSize({ width: 0, height: 0 });
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const restartGame = () => {
    setScore(0);
    setHearts(3);
    setImageURL(null);
    setPredictions([]);
    setProcessingTime(null);
    setOriginalImageSize({ width: 0, height: 0 });
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setNewTarget();
  };

  const tryAgain = () => {
    setErrorModalOpen(false);
    clearImage();
    setNewTarget();
  };

  useEffect(() => {
    if (imageURL && predictions.length > 0) {
      const img = imageRef.current;
      if (img?.complete) {
        drawCanvas();
      } else {
        img.onload = () => drawCanvas();
        img.onerror = () => {
          console.error('Image failed to load');
          setStatus('❌ Error: Failed to load image');
        };
      }
    }
  }, [imageURL, predictions, canvasSize]);

  const Modal = ({ isOpen, onClose, children, title }) => {
    if (!isOpen) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          {title && <h2 className="text-2xl font-bold text-gray-800 mb-4 pr-8">{title}</h2>}
          {children}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-100 via-yellow-50 to-orange-100 p-4 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="p-3 bg-gradient-to-r from-green-600 to-orange-500 rounded-full shadow-lg">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-green-700 to-orange-600 bg-clip-text text-transparent">
              🍎 Fruit Guess Challenge
            </h1>
          </div>
          <div className="flex items-center justify-center gap-6 text-xl font-semibold text-gray-800 mb-4">
            <span>{username || 'Player'}'s Score: {score}</span>
            <div className="flex gap-2">
              {Array(hearts).fill().map((_, i) => (
                <Heart key={i} className="w-6 h-6 text-red-500" />
              ))}
              {Array(3 - hearts).fill().map((_, i) => (
                <Heart key={i + hearts} className="w-6 h-6 text-gray-300" />
              ))}
            </div>
          </div>
          <button
            onClick={() => setRulesModalOpen(true)}
            className="flex items-center gap-2 mx-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-colors"
          >
            <Info className="w-4 h-4" />
            Game Rules
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-lg p-4 border border-gray-200">
              <h3 className="text-lg font-semibold text-green-700 mb-2">🔍 Hint</h3>
              <p className="text-gray-600">{hint}</p>
            </div>

            <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-lg p-4 border border-gray-200">
              <label className="group cursor-pointer block">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUpload}
                  className="hidden"
                  disabled={isLoading || hearts <= 0}
                />
                <div className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-600 to-orange-500 text-white rounded-xl hover:from-green-700 hover:to-orange-600 transition-all duration-300 shadow-md hover:shadow-lg group-hover:scale-105">
                  {isLoading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                  <span className="font-semibold">
                    {isLoading ? 'Analyzing...' : 'Upload Image'}
                  </span>
                </div>
              </label>
              
              <div className="mt-3 space-y-2">
                {hearts <= 0 && (
                  <button
                    onClick={restartGame}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors"
                  >
                    Restart Game
                  </button>
                )}
                {imageURL && (
                  <button
                    onClick={tryAgain}
                    className="w-full px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-lg shadow-md transition-colors"
                  >
                    Try Again
                  </button>
                )}
              </div>
            </div>

            {status && (
              <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-lg p-4 border border-gray-200">
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse mt-1 flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <span className="text-gray-700 font-medium text-sm block">{status}</span>
                    {processingTime && (
                      <span className="text-xs text-gray-500 mt-1 block">
                        Processed in {processingTime}s
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            {imageURL ? (
              <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-lg p-6 border border-gray-200">
                <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">Fruit Detection Results</h3>
                <div className="flex justify-center">
                  <div className="border border-gray-200 rounded-lg overflow-hidden shadow-md">
                    <img
                      ref={imageRef}
                      src={imageURL}
                      alt="Uploaded"
                      className="hidden"
                      crossOrigin="anonymous"
                    />
                    <canvas
                      ref={canvasRef}
                      width={canvasSize.width}
                      height={canvasSize.height}
                      className="block"
                    />
                  </div>
                </div>
                
                {imageURL && (
                  <div className="flex justify-center gap-4 mt-4">
                    {predictions.length > 0 && (
                      <button
                        onClick={downloadImage}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-md transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    )}
                    <button
                      onClick={clearImage}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-lg p-12 border border-gray-200 border-dashed">
                <div className="text-center text-gray-500">
                  <Upload className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Upload an image to see fruit detection results here</p>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            {predictions.length > 0 && (
              <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-lg p-4 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">🎯 Detected Fruits</h3>
                <div className="space-y-2">
                  {predictions.map((pred, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-3">
                      <div className="font-medium text-gray-800">{pred.class || 'Unknown'}</div>
                      <div className="text-sm text-gray-600">
                        Confidence: {Math.round((pred.confidence || 0) * 100)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Enter Your Name">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your Name"
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
          />
          <button
            onClick={() => {
              if (username.trim()) setIsModalOpen(false);
            }}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition-colors"
          >
            Start Game
          </button>
        </Modal>

        <Modal isOpen={rulesModalOpen} onClose={() => setRulesModalOpen(false)} title="Game Rules">
          <div className="space-y-4 text-gray-700">
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">How to Play:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Look at the hint to know which fruit to find</li>
                <li>Upload an image containing that fruit</li>
                <li>The AI will detect fruits in your image</li>
                <li>If the target fruit is found, you earn +10 points</li>
                <li>Wrong guesses cost -5 points and 1 heart</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Scoring:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Correct guess: +10 points</li>
                <li>Wrong guess: -5 points, lose 1 heart</li>
                <li>Game ends when you lose all 3 hearts</li>
              </ul>
            </div>
          </div>
        </Modal>

        <Modal isOpen={successModalOpen} onClose={() => setSuccessModalOpen(false)}>
          <div className="text-center">
            <div className="p-3 bg-green-500 rounded-full mb-4 mx-auto w-fit">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-green-700 mb-4">Congratulations!</h2>
            <p className="text-gray-600 mb-6">You found {targetFruit}! +10 points.</p>
            <button
              onClick={() => {
                setSuccessModalOpen(false);
                clearImage();
                setNewTarget();
              }}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md transition-colors"
            >
              Next Challenge
            </button>
          </div>
        </Modal>

        <Modal isOpen={errorModalOpen} onClose={() => setErrorModalOpen(false)}>
          <div className="text-center">
            <div className="p-3 bg-red-500 rounded-full mb-4 mx-auto w-fit">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-red-700 mb-4">Oops!</h2>
            <p className="text-gray-600 mb-6">The fruit was {targetFruit}. {hearts - 1} hearts left. -5 points.</p>
            <button
              onClick={tryAgain}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-md transition-colors"
            >
              Try Again
            </button>
          </div>
        </Modal>
      </div>
    </div>
  );
}

export default App;