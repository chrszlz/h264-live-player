import React, { useEffect, useRef, useState, useCallback } from 'react';

const VideoStream = () => {
  const canvasRef = useRef(null);
  const playerRef = useRef(null);
  const wsRef = useRef(null);
  const [status, setStatus] = useState('Not connected');
  const initializedRef = useRef(false);
  const [frameCount, setFrameCount] = useState(0);
  const [binaryDataReceived, setBinaryDataReceived] = useState(0);
  const [fps, setFps] = useState(0);
  const [streaming, setStreaming] = useState(false);
  
  // Initialize direct player with more debugging
  const initPlayer = useCallback(() => {
    if (!canvasRef.current) return;
    
    // If we already have a player, reuse it
    if (playerRef.current) {
      console.log("Player already initialized, reusing existing instance");
      return;
    }
    
    try {
      // Load the player script dynamically
      if (!window.WSAvcPlayer) {
        console.error("WSAvcPlayer not found. Make sure http-live-player.js is loaded");
        return;
      }

      // Enhance the WSAvcPlayer.prototype to monitor frame processing
      if (!window.WSAvcPlayer._debugPatched) {
        const originalDecode = window.WSAvcPlayer.prototype.decode;
        window.WSAvcPlayer.prototype.decode = function(frame) {
          console.log(`Decoding frame: ${frame.byteLength} bytes`);
          // Call original method
          return originalDecode.call(this, frame);
        };
        
        const originalCmd = window.WSAvcPlayer.prototype.cmd;
        window.WSAvcPlayer.prototype.cmd = function(cmd) {
          console.log("Received command:", cmd);
          // Call original method
          return originalCmd.call(this, cmd);
        };
        
        window.WSAvcPlayer._debugPatched = true;
      }
      
      // Create player instance directly
      console.log("Creating new WSAvcPlayer instance");
      const player = new window.WSAvcPlayer(canvasRef.current, "webgl");
      playerRef.current = player;
      
      // Add more event listeners for debugging
      player.on = player.on || function(evt, callback) {
        this.addEventListener(evt, callback);
      };
      
      player.on('canvasReady', (width, height) => {
        console.log(`Canvas ready with dimensions: ${width}x${height}`);
      });
      
      // Connect to WebSocket
      const wsUrl = "ws://localhost:8080";
      console.log("Connecting player to WebSocket:", wsUrl);
      player.connect(wsUrl);
      
      // Patch the onmessage handler to monitor frame reception
      const originalOnMessage = player.ws.onmessage;
      player.ws.onmessage = (evt) => {
        if (typeof evt.data !== "string") {
          // Log the size of the incoming frame
          console.log(`Received frame: ${evt.data.byteLength} bytes`);
          setFrameCount(prev => {
            const newCount = prev + 1;
            console.log(`Frame count updated: ${newCount}`);
            return newCount;
          });
          setBinaryDataReceived(prev => prev + evt.data.byteLength);
          console.log(`Received binary data: ${evt.data.byteLength} bytes, total frames: ${frameCount+1}`);
          
          // Check if frame is valid H264 data (should start with 0x00000001)
          if (evt.data.byteLength > 4) {
            const prefix = new Uint8Array(evt.data.slice(0, 4));
            console.log(`Frame prefix: [${prefix[0]},${prefix[1]},${prefix[2]},${prefix[3]}]`);
          }
        }
        // Call original handler
        return originalOnMessage(evt);
      };
      
      setStatus('Player initialized');
      initializedRef.current = true;
    } catch (error) {
      console.error("Failed to initialize player:", error);
      setStatus('Player initialization failed');
    }
  }, []);

  // Start streaming
  const startStream = () => {
    if (streaming) {
      console.log("Stream is already active, not starting a new one.");
      return;
    }
    if (playerRef.current) {
      console.log("Starting stream");
      playerRef.current.playStream();
      setStreaming(true);
      setStatus('Streaming...');
    }
  };

  // Stop streaming
  const stopStream = () => {
    if (playerRef.current) {
      console.log("Stopping stream");
      playerRef.current.stopStream();
      setStreaming(false);
      setStatus('Stream stopped');
    }
  };
  
  // Calculate FPS
  useEffect(() => {
    const interval = setInterval(() => {
      setFps(frameCount);
      console.log(`FPS calculated: ${frameCount}`);
      setFrameCount(0); // Reset frame count for the next interval
    }, 1000);

    return () => clearInterval(interval);
  }, [frameCount]);

  // Load WSAvcPlayer script - only once
  useEffect(() => {
    console.log("Main effect running, initializedRef:", initializedRef.current);
    
    if (initializedRef.current) {
      console.log("Component already initialized, skipping initialization");
      return;
    }
    
    if (!window.WSAvcPlayer) {
      console.log("Loading WSAvcPlayer script");
      const script = document.createElement('script');
      script.src = '/http-live-player.js'; // Non-worker version
      script.async = true;
      script.onload = () => {
        console.log("WSAvcPlayer script loaded");
        initPlayer();
      };
      document.body.appendChild(script);
      
      return () => {
        if (document.body.contains(script)) {
          document.body.removeChild(script);
        }
      };
    } else {
      console.log("WSAvcPlayer already loaded");
      initPlayer();
    }
    
    initializedRef.current = true;
  }, [initPlayer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("Component unmounting, cleaning up resources");
      
      if (playerRef.current) {
        console.log("Disconnecting player");
        playerRef.current.disconnect();
        playerRef.current = null;
      }
      
      if (wsRef.current) {
        console.log("Closing direct WebSocket");
        wsRef.current.close();
        wsRef.current = null;
      }
      
      initializedRef.current = false;
    };
  }, []);

  return (
    <div>
      <div>Status: {status} | Frames: {frameCount} | Data received: {(binaryDataReceived / 1024).toFixed(2)} KB | FPS: {fps}</div>
      <canvas 
        ref={canvasRef}
        width="960"
        height="540"
        style={{
          border: '1px solid red',
          background: '#000'
        }}
      />
      <div>
        <h3>Direct Player Controls:</h3>
        <button onClick={startStream}>
          Start Stream
        </button>
        <button onClick={stopStream}>
          Stop Stream
        </button>
      </div>
    </div>
  );
};

export default VideoStream; 