import React, { useRef, useState } from 'react';

function App() {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [imageURL, setImageURL] = useState(null);
  const [status, setStatus] = useState(''); // Track process status
  const [predictions, setPredictions] = useState([]); // Store predictions for display
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Set image URL for rendering
    const localImageURL = URL.createObjectURL(file);
    setImageURL(localImageURL);
    setStatus('Converting image to base64...');

    try {
      const base64 = await toBase64(file);
      setStatus('Waiting for Roboflow response...');

      // Send image to Roboflow API
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
              value: base64.split(',')[1], // Remove "data:image/...;base64,"
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Roboflow API request failed');
      }

      const result = await response.json();
      console.log('Roboflow response:', result);
      setStatus('Processing response...');

      // Store predictions for display on the page
      const predictionsData = result.outputs[0].predictions || [];
      setPredictions(predictionsData);

      // Ensure the image is loaded before drawing
      const img = imageRef.current;
      if (img.complete) {
        calculateAndSetCanvasSize(img, result.outputs[0].predictions.image);
        drawCanvas(result);
      } else {
        img.onload = () => {
          calculateAndSetCanvasSize(img, result.outputs[0].predictions.image);
          drawCanvas(result);
        };
      }
      setStatus('Image segmented successfully!');
    } catch (error) {
      console.error('Error:', error);
      setStatus(`Error: ${error.message}`);
    }
  };

  const calculateAndSetCanvasSize = (img, imageData) => {
    const maxWidth = 800; // Maximum width for the canvas
    const maxHeight = 600; // Maximum height for the canvas
    
    let width = imageData.width;
    let height = imageData.height;
    
    // Calculate aspect ratio
    const aspectRatio = width / height;
    
    // Adjust dimensions to fit within max bounds while maintaining aspect ratio
    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspectRatio;
    }
    
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }
    
    setCanvasSize({ width, height });
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

    const imageData = data.outputs[0].predictions.image;
    const predictions = data.outputs[0].predictions.predictions || [];

    // Set canvas dimensions
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    // Clear canvas and draw the image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Scale factor for coordinates
    const scaleX = canvas.width / imageData.width;
    const scaleY = canvas.height / imageData.height;

    // Draw polygons for each prediction
    predictions.forEach((pred) => {
      const { points, class: className, confidence } = pred;

      // Draw polygon with scaled coordinates
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
      ctx.lineWidth = 3;
      ctx.stroke();

      // Add label with improved visibility
      const label = `${className} ${Math.round(confidence * 100)}%`;
      const labelX = points[0].x * scaleX;
      const labelY = points[0].y * scaleY - 15;

      // Label background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.font = 'bold 16px Arial';
      const textMetrics = ctx.measureText(label);
      ctx.fillRect(labelX, labelY - 20, textMetrics.width + 10, 25);

      // Label text
      ctx.fillStyle = 'white';
      ctx.fillText(label, labelX + 5, labelY - 2);
    });
  };

  return (
    <div style={{ 
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto',
      textAlign: 'center'
    }}>
      <h2>Upload Image for Roboflow Segmentation</h2>
      <input type="file" accept="image/*" onChange={handleUpload} />
      <br />
      <br />

      {/* Display status */}
      {status && (
        <div style={{ 
          margin: '10px auto', 
          padding: '10px', 
          backgroundColor: '#f0f0f0', 
          borderRadius: '5px',
          maxWidth: '600px' 
        }}>
          <strong>Status:</strong> {status}
        </div>
      )}

      {/* Display predictions */}
      {predictions.length > 0 && (
        <div style={{ 
          margin: '10px auto', 
          padding: '10px', 
          backgroundColor: '#e0e0e0', 
          borderRadius: '5px',
          maxWidth: '600px'
        }}>
          <strong>Predictions:</strong>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {predictions.map((pred, index) => (
              <li key={index} style={{ margin: '5px 0' }}>
                <span style={{ 
                  backgroundColor: 'rgba(255, 0, 0, 0.1)', 
                  padding: '5px 10px',
                  borderRadius: '3px',
                  border: '1px solid rgba(255, 0, 0, 0.3)'
                }}>
                  {pred.class}: {Math.round(pred.confidence * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Canvas and image container */}
      <div style={{ 
        position: 'relative',
        margin: '20px auto',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <img
          ref={imageRef}
          src={imageURL}
          alt=""
          style={{ display: 'none' }}
          crossOrigin="anonymous"
        />
        <canvas
          ref={canvasRef}
          style={{
            border: '2px solid #ddd',
            borderRadius: '8px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
          }}
        />
      </div>
    </div>
  );
}

export default App;