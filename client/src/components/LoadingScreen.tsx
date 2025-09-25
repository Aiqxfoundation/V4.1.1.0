import { useEffect, useState, useMemo } from "react";

export default function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [binaryStream, setBinaryStream] = useState<string[]>([]);
  const [binaryMatrix, setBinaryMatrix] = useState<string[]>([]);
  
  const phases = [
    "[BOOT] Initializing B2B Mining OS...",
    "[NETWORK] Connecting to blockchain nodes...",
    "[SYNC] Synchronizing with mining pool...",
    "[HASH] Loading ASIC processors...",
    "[AUTH] Verifying security protocols...",
    "[READY] System operational!"
  ];

  useEffect(() => {
    // Generate hash-like strings with all digits 0-9
    const generateHashLikeString = () => {
      const chars = '0123456789';
      let result = '';
      for (let i = 0; i < 80; i++) {
        // Create blocks that look like hash segments
        result += chars[Math.floor(Math.random() * chars.length)];
      }
      return result;
    };

    // Initialize matrix with numeric hash-like values
    setBinaryMatrix(Array.from({ length: 40 }, () => generateHashLikeString()));

    // Generate stream with rapid updates using all digits
    const binaryInterval = setInterval(() => {
      setBinaryStream(prev => {
        const newDigits = Array.from({length: 10}, () => 
          Math.floor(Math.random() * 10).toString()
        ).join('');
        return [...prev.slice(-20), newDigits];
      });
      
      // Update matrix to simulate hash calculations with all digits
      setBinaryMatrix(prev => prev.map((line, index) => {
        // Each column updates at different rates for realistic effect
        const updateChance = 0.5 + (Math.sin(Date.now() / 500 + index) * 0.4);
        
        if (Math.random() < updateChance) {
          // Simulate hash-like progressive changes
          const newLine = line.split('');
          const updateCount = Math.floor(Math.random() * 40) + 20;
          
          for (let i = 0; i < updateCount; i++) {
            const pos = Math.floor(Math.random() * newLine.length);
            // Replace with random digit 0-9
            newLine[pos] = Math.floor(Math.random() * 10).toString();
          }
          
          // Sometimes replace entire segments (like new hash blocks)
          if (Math.random() < 0.2) {
            const blockStart = Math.floor(Math.random() * 60);
            const blockSize = 8 + Math.floor(Math.random() * 8);
            const newBlock = Array.from({length: blockSize}, () => 
              Math.floor(Math.random() * 10).toString()
            ).join('');
            newLine.splice(blockStart, blockSize, ...newBlock.split(''));
          }
          
          return newLine.join('');
        }
        return line;
      }));
    }, 30); // Much faster updates for intense effect

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          clearInterval(binaryInterval);
          setTimeout(onComplete, 800); // Quick fade out
          return 100;
        }
        // Fast progress (100% in ~4.2 seconds)
        const increment = prev < 30 ? 3.5 : prev < 70 ? 2.8 : prev < 90 ? 2.0 : 1.5;
        return Math.min(100, prev + increment);
      });
    }, 100); // Update every 100ms

    const phaseInterval = setInterval(() => {
      setCurrentPhase(prev => {
        if (prev >= phases.length - 1) {
          clearInterval(phaseInterval);
          return phases.length - 1;
        }
        return prev + 1;
      });
    }, 700); // Each phase shows for 0.7 seconds (6 phases in ~4.2 seconds)

    return () => {
      clearInterval(progressInterval);
      clearInterval(phaseInterval);
      clearInterval(binaryInterval);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center transition-all duration-1500 ease-out" style={{ opacity: progress >= 100 ? 0 : 1, backgroundColor: 'rgba(0,0,0,0.95)' }}>
      {/* Matrix-style Background with dim overlay */}
      <div className="absolute inset-0 overflow-hidden bg-black">
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70"></div>
        <div className="absolute inset-0 bitcoin-grid opacity-10 animate-pulse"></div>
        
        {/* Binary rain effect - hash-like dynamic updates */}
        <div className="absolute inset-0">
          {binaryMatrix.map((binary, i) => (
            <div
              key={i}
              className="absolute font-mono text-xs overflow-hidden whitespace-pre tracking-wider"
              style={{
                left: `${i * 2.5}%`,
                color: `hsl(142, ${70 + (i * 3) % 30 + 70}%, ${45 + (i * 2) % 25}%)`,
                animation: `matrix-fall ${3 + (i % 4)}s linear infinite`,
                animationDelay: `${(i * 0.1) % 3}s`,
                opacity: 0.4 + (i % 3) * 0.2,
                textShadow: '0 0 10px rgba(0, 255, 0, 0.6), 0 0 20px rgba(0, 255, 0, 0.3)',
                filter: i % 2 === 0 ? 'blur(0.2px)' : 'blur(0.4px)',
                willChange: 'transform, opacity',
                fontWeight: i % 3 === 0 ? '600' : '400'
              }}
            >
              {binary}
            </div>
          ))}
        </div>
        
        {/* Dynamic binary overlay for depth */}
        <div className="absolute inset-0 opacity-20">
          {[...Array(20)].map((_, i) => (
            <div
              key={`overlay-${i}`}
              className="absolute font-mono text-lg font-bold"
              style={{
                left: `${Math.random() * 100}%`,
                color: '#00ff00',
                animation: `matrix-fall ${2 + Math.random() * 2}s linear infinite`,
                animationDelay: `${Math.random() * 2}s`,
                opacity: Math.random() * 0.3,
                textShadow: '0 0 20px rgba(0, 255, 0, 0.8)',
                transform: 'scaleY(1.5)'
              }}
            >
              {Array.from({length: 60}, () => Math.round(Math.random())).join('')}
            </div>
          ))}
        </div>

      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-lg w-full px-8">
        {/* Animated Logo */}
        <div className="mb-8 text-center">
          <div className="w-32 h-32 mx-auto mb-6 relative">
            {/* Rotating rings */}
            <div className="absolute inset-0 border-2 border-primary/30 rounded-full animate-spin" style={{ animationDuration: '3s' }}></div>
            <div className="absolute inset-2 border-2 border-accent/30 rounded-full animate-spin" style={{ animationDuration: '4s', animationDirection: 'reverse' }}></div>
            <div className="absolute inset-4 border-2 border-chart-4/30 rounded-full animate-spin" style={{ animationDuration: '5s' }}></div>
            
            {/* Central logo */}
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-pulse"></div>
            <div className="relative w-full h-full bg-gradient-to-br from-primary via-accent to-chart-4 rounded-full flex items-center justify-center animate-pulse">
              <div className="w-28 h-28 bg-black rounded-full flex items-center justify-center border-2 border-primary/50">
                <span className="text-5xl font-bold bg-gradient-to-r from-primary via-accent to-chart-4 text-transparent bg-clip-text animate-pulse">₿</span>
              </div>
            </div>
          </div>
          
          <h1 className="text-4xl font-heading font-black mb-2">
            <span className="bg-gradient-to-r from-primary via-accent to-chart-4 text-transparent bg-clip-text animate-gradient">
              B2B MINING
            </span>
          </h1>
          <p className="text-sm text-green-400 font-mono animate-pulse">
            &lt;Professional Mining Network/&gt;
          </p>
        </div>

        {/* Terminal-style Loading */}
        <div className="mb-6 bg-black/50 border border-primary/30 rounded-lg p-4 backdrop-blur">
          <div className="flex items-center justify-between mb-3">
            <div className="flex space-x-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <span className="text-xs text-green-400 font-mono">B2B_BOOT_v2.1.0</span>
          </div>
          
          {/* Progress bar */}
          <div className="h-3 bg-black rounded-full overflow-hidden border border-primary/20 mb-3">
            <div 
              className="h-full bg-gradient-to-r from-green-500 via-primary to-accent transition-all duration-500 ease-out relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
            </div>
          </div>
          
          {/* Terminal output */}
          <div className="font-mono text-xs space-y-1">
            <div className="text-green-400">{phases[currentPhase]}</div>
            <div className="text-primary/60">
              {binaryStream.slice(-3).map((binary, i) => (
                <div key={i} className="opacity-${100 - i * 30}">
                  &gt; {binary}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-accent transition-all duration-300 font-bold">Progress: {Math.floor(progress)}%</span>
              <span className="text-chart-4 transition-all duration-300 font-bold">ETA: {Math.max(0, Math.ceil((100 - progress) / 20))}s</span>
            </div>
          </div>
        </div>

        {/* Mining Cores Animation */}
        <div className="flex justify-center space-x-3">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="relative">
              <div
                className="w-3 h-12 bg-gradient-to-t from-primary to-accent rounded-full"
                style={{
                  animation: `pulse-scale 1.5s ease-in-out infinite`,
                  animationDelay: `${i * 0.1}s`,
                  opacity: progress > i * 14 ? 1 : 0.3
                }}
              ></div>
              <div 
                className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full"
                style={{
                  animation: `blink 0.5s ease-in-out infinite`,
                  animationDelay: `${i * 0.2}s`
                }}
              ></div>
            </div>
          ))}
        </div>
        
      </div>

    </div>
  );
}