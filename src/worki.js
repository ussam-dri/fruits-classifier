import React, { useRef, useState, useEffect } from 'react';
import { Upload, Zap, Eye, Download, Trash2, RefreshCw } from 'lucide-react';

function App() {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [imageURL, setImageURL] = useState(null);
  const [status, setStatus] = useState('');
  const [predictions, setPredictions] = useState([]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [showPredictions, setShowPredictions] = useState(true);
  const [processingTime, setProcessingTime] = useState(null);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const startTime = Date.now();
    setIsLoading(true);
    const localImageURL = URL.createObjectURL(file);
    setImageURL(localImageURL);
    setStatus('Converting image to base64...');

    try {
      const base64 = await toBase64(file);
      setStatus('🚀 Analyzing image with AI...');

    const response = await fetch('https://serverless.roboflow.com/infer/workflows/wisd-scixc/custom-workflow-5', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    api_key: '7kDS0qoq56Si0jbdcRHV',
    inputs: {
      image: {
        type: 'base64',
        value: base64.split(',')[1],
      },
    },
  }),
});


      if (!response.ok) {
        throw new Error('Roboflow API request failed');
      }

      const result = await response.json();
      console.log('Roboflow Response:', result); // Debug: Check the full response
      setStatus('✨ Processing results...');

      const predictionsData = result?.outputs?.[0]?.predictions?.predictions || [];
      console.log('Parsed Predictions:', predictionsData); // Debug: Check predictions
      setPredictions(predictionsData);

      const img = imageRef.current;
      const imageData = result?.outputs?.[0]?.predictions?.image || { width: 0, height: 0 };
      console.log('Image Data:', imageData); // Debug: Check image dimensions

      calculateAndSetCanvasSize(img, imageData);

      const endTime = Date.now();
      setProcessingTime(((endTime - startTime) / 1000).toFixed(2));
      setStatus('🎉 Image segmented successfully!');
    } catch (error) {
      console.error('Error:', error);
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateAndSetCanvasSize = (img, imageData) => {
    const maxWidth = 800;
    const maxHeight = 600;
    let width = imageData.width || 200; // Fallback if width is 0
    let height = imageData.height || 200; // Fallback if height is 0

    const aspectRatio = width / height;

    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspectRatio;
    }

    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }

    if (width < 200) {
      width = 200;
      height = width / aspectRatio;
    }

    setCanvasSize({ width: Math.round(width), height: Math.round(height) });
    console.log('Canvas Size Set:', { width, height }); // Debug: Check canvas size
  };

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
    });

  const drawCanvas = (data) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;

    if (!canvas || !ctx || !img || !img.complete) {
      console.log('Cannot draw canvas:', { canvas, ctx, img, imgComplete: img?.complete });
      return;
    }

    const imageData = data?.outputs?.[0]?.predictions?.image || { width: 0, height: 0 };
    const predictions = data?.outputs?.[0]?.predictions?.predictions || [];
    console.log('Drawing with:', { imageData, predictions }); // Debug: Check data

    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / (imageData.width || 1); // Avoid division by 0
    const scaleY = canvas.height / (imageData.height || 1);
    console.log('Scale Factors:', { scaleX, scaleY }); // Debug: Check scaling

    if (showPredictions && predictions.length > 0) {
      predictions.forEach((pred) => {
        const { points, class: className, confidence } = pred;
        console.log('Drawing Prediction:', { className, confidence, points }); // Debug: Check each prediction

        // Draw polygon
        ctx.beginPath();
        points.forEach((pt, i) => {
          const scaledX = pt.x * scaleX;
          const scaledY = pt.y * scaleY;
          if (i === 0) ctx.moveTo(scaledX, scaledY);
          else ctx.lineTo(scaledX, scaledY);
        });
        ctx.closePath();

        // Fill polygon with semi-transparent red
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.fill();

        // Draw border
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Add label
        const label = `${className} ${Math.round(confidence * 100)}%`;
        const labelX = points[0].x * scaleX;
        const labelY = points[0].y * scaleY - 10;

        ctx.fillStyle = 'black';
        ctx.fillRect(labelX, labelY - 14, ctx.measureText(label).width + 8, 16);

        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.fillText(label, labelX + 4, labelY - 2);
      });
    } else {
      console.log('No predictions to draw or predictions hidden');
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
    setStatus('');
    setProcessingTime(null);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const togglePredictions = () => {
    setShowPredictions(!showPredictions);
    if (canvasRef.current) {
      drawCanvas({ outputs: [{ predictions: { image: { ...canvasSize }, predictions } }] });
    }
  };

  useEffect(() => {
    if (imageURL && predictions.length > 0) {
      const img = imageRef.current;
      console.log('useEffect Triggered:', { imageURL, predictions, imgComplete: img?.complete });
      if (img?.complete) {
        drawCanvas({ outputs: [{ predictions: { image: { ...canvasSize }, predictions } }] });
      } else {
        img.onload = () => {
          console.log('Image Loaded, Drawing Canvas');
          drawCanvas({ outputs: [{ predictions: { image: { ...canvasSize }, predictions } }] });
        };
        img.onerror = () => {
          console.error('Image failed to load');
          setStatus('❌ Error: Failed to load image');
        };
      }
    }
  }, [imageURL, predictions, showPredictions, canvasSize]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-yellow-50 to-orange-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-green-500 to-orange-500 rounded-full">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-orange-500 bg-clip-text text-transparent">
              🍎 Smart Fruit Analyzer
            </h1>
          </div>
          <p className="text-gray-600 text-lg">
            Upload fruit images and get instant AI-powered identification, counting, and quality analysis
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl p-8 mb-6 border border-white/50">
          <div className="flex flex-col items-center">
            <label className="group cursor-pointer">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleUpload} 
                className="hidden"
                disabled={isLoading}
              />
              <div className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-green-500 to-orange-500 text-white rounded-xl hover:from-green-600 hover:to-orange-600 transition-all duration-300 shadow-lg hover:shadow-xl group-hover:scale-105">
                {isLoading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Upload className="w-5 h-5" />
                )}
                <span className="font-semibold">
                  {isLoading ? 'Analyzing Fruits...' : 'Upload Fruit Image'}
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Status and Predictions Display */}
        {(status || predictions.length > 0) && (
          <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-lg p-4 mb-6 border border-white/50">
            {status && (
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-gray-700 font-medium">{status}</span>
                {processingTime && (
                  <span className="ml-auto text-sm text-gray-500">
                    Processed in {processingTime}s
                  </span>
                )}
              </div>
            )}
            {predictions.length > 0 && (
              <div className="mt-4">
                <h3 className="text-lg font-semibold text-gray-800">Predictions:</h3>
                <ul className="list-disc list-inside mt-2">
                  {predictions.map((pred, index) => (
                    <li key={index} className="text-gray-700">
                      Class: {pred.class || 'Unknown'}, Confidence: {Math.round((pred.confidence || 0) * 100)}%
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        {imageURL && (
          <div className="flex flex-wrap gap-3 mb-6 justify-center">
            <button
              onClick={togglePredictions}
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 rounded-lg shadow-md transition-colors border"
            >
              <Eye className="w-4 h-4" />
              {showPredictions ? 'Hide' : 'Show'} Predictions
            </button>

            {predictions.length > 0 && (
              <button
                onClick={downloadImage}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg shadow-md transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Result
              </button>
            )}

            <button
              onClick={clearImage}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-md transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          </div>
        )}

        {/* Canvas Display */}
        {imageURL && (
          <div className="overflow-auto border border-white/50 bg-white/70 backdrop-blur-sm rounded-xl shadow-lg p-4">
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
              className="mx-auto border rounded shadow"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;