import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Download, Bitcoin, Activity, Zap, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState, useCallback } from "react";
import { Slider } from "@/components/ui/slider";

// Interactive Network Flow Diagram Component
function NetworkFlowDiagram() {
  const [minerCount, setMinerCount] = useState([20]);
  const [blocksMined, setBlocksMined] = useState(0);
  const [isAutoMining, setIsAutoMining] = useState(true);
  const [showRewardPulse, setShowRewardPulse] = useState(false);
  const [totalHashrate, setTotalHashrate] = useState(2847.32);
  
  // Generate miner positions in a circular layout
  const generateMinerPositions = (count: number) => {
    const positions = [];
    const centerX = 200;
    const centerY = 200;
    const radius = 140;
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      const hashrate = Math.floor(Math.random() * 50) + 10;
      positions.push({ x, y, hashrate, id: i });
    }
    return positions;
  };
  
  const [miners, setMiners] = useState(() => generateMinerPositions(20));
  
  // Update miners when count changes
  useEffect(() => {
    setMiners(generateMinerPositions(minerCount[0]));
    setTotalHashrate(minerCount[0] * (Math.random() * 50 + 100));
  }, [minerCount]);
  
  // Mine block function
  const mineBlock = useCallback(() => {
    setBlocksMined(prev => prev + 1);
    setShowRewardPulse(true);
    setTimeout(() => setShowRewardPulse(false), 2000);
  }, []);
  
  // Auto mining timer
  useEffect(() => {
    if (!isAutoMining) return;
    const timer = setInterval(mineBlock, 5000); // Mine every 5 seconds for demo
    return () => clearInterval(timer);
  }, [isAutoMining, mineBlock]);
  
  return (
    <div className="bg-[#111316] border border-[#16181D] rounded-lg p-6 mb-6">
      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <label className="text-sm text-[#6B7280] block mb-2">
            Network Miners: {minerCount[0]}
          </label>
          <Slider
            value={minerCount}
            onValueChange={setMinerCount}
            min={5}
            max={50}
            step={1}
            className="w-full"
          />
        </div>
        
        <div className="flex gap-2 items-end">
          <Button
            size="sm"
            onClick={() => setIsAutoMining(!isAutoMining)}
            variant={isAutoMining ? "secondary" : "outline"}
            className="text-xs"
          >
            {isAutoMining ? "Auto Mining" : "Manual"}
          </Button>
          
          {!isAutoMining && (
            <Button
              size="sm"
              onClick={mineBlock}
              className="bg-[#F7931A] text-black hover:bg-[#F7931A]/90 text-xs"
            >
              Mine Block
            </Button>
          )}
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6 text-center">
        <div>
          <div className="text-[#F7931A] text-lg font-semibold">{totalHashrate.toFixed(2)}</div>
          <div className="text-[#6B7280] text-xs">Total Hashrate</div>
        </div>
        <div>
          <div className="text-[#F7931A] text-lg font-semibold">{blocksMined}</div>
          <div className="text-[#6B7280] text-xs">Blocks Mined</div>
        </div>
        <div>
          <div className="text-[#F7931A] text-lg font-semibold">{(100 / minerCount[0]).toFixed(1)}%</div>
          <div className="text-[#6B7280] text-xs">Avg Share</div>
        </div>
      </div>
      
      {/* Network Visualization */}
      <div className="relative bg-[#0B0E11] rounded-lg p-4">
        <svg viewBox="0 0 400 400" className="w-full h-auto max-w-[500px] mx-auto">
          {/* Connection lines between miners */}
          {miners.map((miner, i) => {
            // Connect to 3 nearest neighbors
            const connections = miners
              .slice(i + 1, Math.min(i + 4, miners.length))
              .concat(i + 4 >= miners.length ? miners.slice(0, Math.max(0, 3 - (miners.length - i - 1))) : []);
            
            return connections.map((target, j) => (
              <motion.line
                key={`${miner.id}-${target.id}`}
                x1={miner.x}
                y1={miner.y}
                x2={target.x}
                y2={target.y}
                stroke="#16181D"
                strokeWidth="1"
                strokeDasharray="5 5"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              />
            ));
          })}
          
          {/* Central node */}
          <motion.circle
            cx="200"
            cy="200"
            r="20"
            fill="#111316"
            stroke="#F7931A"
            strokeWidth="2"
            animate={showRewardPulse ? {
              r: [20, 40, 20],
              opacity: [1, 0.5, 1]
            } : {}}
            transition={{ duration: 1 }}
          />
          <text x="200" y="205" textAnchor="middle" fill="#F7931A" fontSize="14" fontWeight="bold">
            B2B
          </text>
          
          {/* Miner nodes */}
          <AnimatePresence>
            {miners.map((miner) => (
              <motion.g key={miner.id}>
                {/* Hashrate ring */}
                <motion.circle
                  cx={miner.x}
                  cy={miner.y}
                  r="12"
                  fill="none"
                  stroke="#F7931A"
                  strokeWidth={(miner.hashrate / 60) * 3}
                  opacity="0.3"
                  animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.3, 0.5, 0.3]
                  }}
                  transition={{ duration: 3, repeat: Infinity, delay: miner.id * 0.1 }}
                />
                
                {/* Miner node */}
                <motion.circle
                  cx={miner.x}
                  cy={miner.y}
                  r="8"
                  fill="#111316"
                  stroke="#6B7280"
                  strokeWidth="1"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  whileHover={{ scale: 1.2 }}
                />
                
                {/* Reward pulse on block mine */}
                {showRewardPulse && (
                  <motion.circle
                    cx={miner.x}
                    cy={miner.y}
                    r="8"
                    fill="none"
                    stroke="#F7931A"
                    strokeWidth="2"
                    initial={{ r: 8, opacity: 1 }}
                    animate={{ r: 20, opacity: 0 }}
                    transition={{ duration: 1 }}
                  />
                )}
              </motion.g>
            ))}
          </AnimatePresence>
          
          {/* Reward flow lines during mining */}
          {showRewardPulse && miners.map((miner) => (
            <motion.line
              key={`reward-${miner.id}`}
              x1="200"
              y1="200"
              x2={miner.x}
              y2={miner.y}
              stroke="#F7931A"
              strokeWidth="2"
              opacity="0"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: [0, 1, 0] }}
              transition={{ duration: 1 }}
            />
          ))}
        </svg>
        
        {/* Legend */}
        <div className="flex justify-center gap-6 mt-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#F7931A]"></div>
            <span className="text-[#6B7280]">Active Miner</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#111316] border border-[#6B7280]"></div>
            <span className="text-[#6B7280]">Node</span>
          </div>
          <div className="flex items-center gap-2">
            <motion.div 
              className="w-8 h-px bg-[#F7931A]"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-[#6B7280]">Hashrate Flow</span>
          </div>
        </div>
      </div>
      
      <p className="text-xs text-[#6B7280] mt-4 text-center">
        Interactive visualization showing network participants, hashrate distribution, and reward propagation
      </p>
    </div>
  );
}

export default function Whitepaper() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Subtle animated background grid
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    resize();
    window.addEventListener('resize', resize);

    let frame = 0;
    const animate = () => {
      frame += 0.005;
      
      ctx.fillStyle = '#0B0E11';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Subtle grid
      ctx.strokeStyle = 'rgba(247, 147, 26, 0.02)';
      ctx.lineWidth = 1;
      
      const gridSize = 100;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      
      // Subtle floating particles
      ctx.fillStyle = 'rgba(247, 147, 26, 0.1)';
      for (let i = 0; i < 20; i++) {
        const x = (Math.sin(frame + i) * canvas.width/2) + canvas.width/2;
        const y = (Math.cos(frame * 0.5 + i) * canvas.height/2) + canvas.height/2;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      
      requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);

  const downloadWhitepaper = () => {
    const content = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>B2B Mining Platform - Technical Whitepaper v2.0</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0B0E11;
            color: #9AA3AF;
            line-height: 1.6;
            font-size: 16px;
        }
        
        .container {
            max-width: 760px;
            margin: 0 auto;
            padding: 60px 20px;
        }
        
        h1 {
            font-size: 28px;
            font-weight: 700;
            color: #FFFFFF;
            margin-bottom: 8px;
            letter-spacing: -0.02em;
        }
        
        h2 {
            font-size: 22px;
            font-weight: 600;
            color: #FFFFFF;
            margin-top: 48px;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 1px solid #16181D;
        }
        
        h3 {
            font-size: 18px;
            font-weight: 600;
            color: #E5E7EB;
            margin-top: 32px;
            margin-bottom: 16px;
        }
        
        p {
            margin-bottom: 16px;
            max-width: 65ch;
            line-height: 1.7;
        }
        
        .abstract {
            background: #111316;
            border: 1px solid #16181D;
            border-radius: 8px;
            padding: 24px;
            margin: 32px 0;
        }
        
        .abstract h2 {
            margin-top: 0;
            border: none;
            padding-bottom: 0;
            margin-bottom: 16px;
        }
        
        .highlight {
            color: #F7931A;
            font-weight: 500;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 24px 0;
            font-size: 14px;
        }
        
        th {
            text-align: left;
            padding: 12px;
            background: #111316;
            color: #E5E7EB;
            font-weight: 600;
            border-bottom: 1px solid #16181D;
        }
        
        td {
            padding: 12px;
            border-bottom: 1px solid #16181D;
        }
        
        .formula {
            background: #111316;
            border: 1px solid #16181D;
            border-radius: 6px;
            padding: 16px;
            margin: 24px 0;
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', monospace;
            font-size: 14px;
            color: #F7931A;
            text-align: center;
        }
        
        .metric-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
            margin: 24px 0;
        }
        
        .metric {
            background: #111316;
            border: 1px solid #16181D;
            border-radius: 6px;
            padding: 16px;
        }
        
        .metric-value {
            font-size: 24px;
            font-weight: 700;
            color: #F7931A;
            margin-bottom: 4px;
        }
        
        .metric-label {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #6B7280;
        }
        
        .distribution-chart {
            display: flex;
            height: 40px;
            background: #111316;
            border-radius: 8px;
            overflow: hidden;
            margin: 24px 0;
        }
        
        .distribution-mining {
            width: 65.5%;
            background: #F7931A;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #0B0E11;
            font-weight: 600;
            font-size: 14px;
        }
        
        .distribution-reserved {
            width: 34.5%;
            background: #374151;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #9CA3AF;
            font-weight: 600;
            font-size: 14px;
        }
        
        .timeline {
            position: relative;
            padding-left: 24px;
            margin: 32px 0;
        }
        
        .timeline::before {
            content: '';
            position: absolute;
            left: 4px;
            top: 8px;
            bottom: 8px;
            width: 1px;
            background: #16181D;
        }
        
        .timeline-item {
            position: relative;
            margin-bottom: 24px;
        }
        
        .timeline-item::before {
            content: '';
            position: absolute;
            left: -20px;
            top: 8px;
            width: 8px;
            height: 8px;
            background: #F7931A;
            border-radius: 50%;
        }
        
        .timeline-item h4 {
            font-size: 14px;
            font-weight: 600;
            color: #E5E7EB;
            margin-bottom: 4px;
        }
        
        .timeline-item p {
            font-size: 14px;
            color: #6B7280;
            margin-bottom: 0;
        }
        
        .warning {
            background: rgba(247, 147, 26, 0.1);
            border: 1px solid rgba(247, 147, 26, 0.3);
            border-radius: 6px;
            padding: 16px;
            margin: 24px 0;
        }
        
        .footer {
            margin-top: 80px;
            padding-top: 32px;
            border-top: 1px solid #16181D;
            text-align: center;
            font-size: 14px;
            color: #6B7280;
        }
        
        code {
            background: #111316;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'SF Mono', monospace;
            font-size: 14px;
            color: #F7931A;
        }
        
        .section-number {
            color: #6B7280;
            margin-right: 8px;
        }
        
        @media (max-width: 768px) {
            .metric-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>B2B Mining Platform</h1>
        <p style="color: #6B7280; margin-bottom: 32px;">Technical Whitepaper v1.0</p>
        
        <div class="abstract">
            <h2>Abstract</h2>
            <p>B2B introduces a mobile-first mining system inspired by Bitcoin's fairness, but without the cost of hardware, electricity, or technical expertise.</p>
            <p>The platform distributes 21 million tokens through a structured block emission cycle with quarterly halving events. Mining participation is simple, accessible, and determined by hashrate not computational equipment.</p>
        </div>
        
        <h2><span class="section-number">1.</span>Vision</h2>
        <p>Bitcoin introduced decentralized mining to the world, proving the power of a fair block reward system.</p>
        <p>B2B is not a competitor to Bitcoin. Instead, it carries the dream of creating a fair second block reward opportunity accessible for everyone through app based mining designed for people everywhere in the world who cannot afford costly setups.
        With its self-power, mobile-first model, B2B makes mining free to join at the base level, with optional enhancements for competitive users.</p>
        <p>Unlike traditional projects, B2B has no venture capital, private sales, or large inside investor allocations. Most of total supply truly belongs to global app miners and the community. 
        Our vision extends the fairness of block rewards to a new generation, ensuring opportunity remains open to all.</p>
        
        <h2><span class="section-number">2.</span>Token Supply</h2>
        
        <p><strong>Total Supply: 21,000,000</strong></p>
        
        <p>65.5% — App-based Mining</p>
        
        <p>34.5% — Reserved for mainnet mining, development, scaling, and ecosystem growth incentives everything for community benefits later.</p>
        
        <h2><span class="section-number">3.</span>Reward Distribution</h2>
        
        <p>Rewards are calculated fairly using network hashrate:</p>
        
        <div class="formula">
            User Reward = (User Hashrate ÷ Global Hashrate) × Block Reward
        </div>
        
        <p>This ensures transparent distribution across all active miners.</p>
        
        <h2><span class="section-number">4.</span>Block Emission Schedule</h2>
        
        <p>Quarterly Halving reduces block rewards over time to ensure fairness with early adopters while enhance & balance scarcity overtime.</p>
        
        <p>First Halving Is Occur From Q1 2026.
        Scarcity increases with each halving cycle, supporting long-term sustainability.</p>
        
        <h2><span class="section-number">5.</span>Conclusion</h2>
        
        <p>B2B reimagines mining by making it mobile-first, accessible, and fair.</p>
        
        <p>With consistent block rewards, a structured halving schedule, and community-centered supply allocation, B2B opens mining to a new generation — without barriers and without privilege.</p>
        
        <div class="footer">
            <p style="color: #E5E7EB; font-weight: 600; margin-bottom: 8px;">B2B Mining Platform</p>
            <p>Bitcoin 2nd Block Inspired System</p>
            <p style="margin-top: 16px; font-size: 12px;">This document is for informational purposes only and does not constitute financial advice.</p>
        </div>
    </div>
</body>
</html>`;
    
    const blob = new Blob([content], { type: 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'B2B_Whitepaper_v2.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="min-h-screen bg-[#0B0E11] text-[#9AA3AF] relative overflow-hidden">
      {/* Animated background */}
      <canvas 
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none opacity-50"
        style={{ zIndex: 0 }}
      />
      
      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="sticky top-0 bg-[#0B0E11]/95 backdrop-blur-sm border-b border-[#16181D] px-4 py-3">
          <div className="max-w-[760px] mx-auto flex items-center justify-between">
            <Link to="/mining">
              <Button variant="ghost" size="sm" className="text-[#9AA3AF] hover:text-white hover:bg-[#16181D]">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            </Link>
            <Button 
              onClick={downloadWhitepaper}
              className="bg-[#F7931A] text-black hover:bg-[#F7931A]/90 font-medium"
              size="sm"
            >
              <Download className="w-4 h-4 mr-1" />
              Download
            </Button>
          </div>
        </div>

        <div className="max-w-[760px] mx-auto px-4 py-16">
          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-12"
          >
            <div className="flex items-center justify-center mb-8">
              <div className="w-16 h-16 bg-[#111316] border border-[#16181D] rounded-full flex items-center justify-center">
                <Bitcoin className="w-8 h-8 text-[#F7931A]" />
              </div>
            </div>
            <h1 className="text-[28px] font-bold text-white text-center mb-2 tracking-tight">
              B2B Mining Platform
            </h1>
            <p className="text-center text-[#6B7280] text-sm">
              Technical Whitepaper v1.0
            </p>
          </motion.div>

          {/* Abstract */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-[#111316] border border-[#16181D] rounded-lg p-6 mb-12"
          >
            <h2 className="text-[20px] font-semibold text-white mb-4">Abstract</h2>
            <p className="text-[#9AA3AF] leading-relaxed">
              B2B introduces a mobile-first mining system inspired by Bitcoin's fairness, but without the cost of hardware, electricity, or technical expertise.
            </p>
            <p className="text-[#9AA3AF] leading-relaxed mt-3">
              The platform distributes 21 million tokens through a structured block emission cycle with quarterly halving events. Mining participation is simple, accessible, and determined by hashrate not computational equipment.
            </p>
          </motion.div>

          {/* Vision */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mb-12"
          >
            <h2 className="text-[22px] font-semibold text-white mb-6 pb-3 border-b border-[#16181D]">
              <span className="text-[#6B7280] mr-2">1.</span>Vision
            </h2>
            <p className="mb-4 leading-relaxed">
              Bitcoin introduced decentralized mining to the world, proving the power of a fair block reward system.
            </p>
            <p className="mb-4 leading-relaxed">
              B2B is not a competitor to Bitcoin. Instead, it carries the dream of creating a fair second block reward opportunity accessible for everyone through app based mining designed for people everywhere in the world who cannot afford costly setups.
              With its self-power, mobile-first model, B2B makes mining free to join at the base level, with optional enhancements for competitive users.
            </p>
            <p className="leading-relaxed">
              Unlike traditional projects, B2B has no venture capital, private sales, or large inside investor allocations. Most of total supply truly belongs to global app miners and the community. 
              Our vision extends the fairness of block rewards to a new generation, ensuring opportunity remains open to all.
            </p>
          </motion.div>

          {/* Token Supply */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mb-12"
          >
            <h2 className="text-[22px] font-semibold text-white mb-6 pb-3 border-b border-[#16181D]">
              <span className="text-[#6B7280] mr-2">2.</span>Token Supply
            </h2>
            
            <div className="bg-[#111316] border border-[#16181D] rounded-lg p-6 mb-6">
              <p className="text-[#F7931A] font-bold text-xl mb-4">Total Supply: 21,000,000</p>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[#E5E7EB]">65.5% — App-based Mining</span>
                  <span className="text-[#F7931A] font-semibold">13,755,000 B2B</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#E5E7EB]">34.5% — Reserved</span>
                  <span className="text-[#6B7280] font-semibold">7,245,000 B2B</span>
                </div>
              </div>
              
              <p className="text-[#6B7280] text-sm mt-4">
                Reserved for mainnet mining, development, scaling, and ecosystem growth incentives everything for community benefits later.
              </p>
            </div>
          </motion.div>

          {/* Reward Distribution */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mb-12"
          >
            <h2 className="text-[22px] font-semibold text-white mb-6 pb-3 border-b border-[#16181D]">
              <span className="text-[#6B7280] mr-2">3.</span>Reward Distribution
            </h2>

            <p className="mb-4 leading-relaxed">
              Rewards are calculated fairly using network hashrate:
            </p>
            
            <div className="bg-[#111316] border border-[#16181D] rounded-lg p-4 text-center font-mono text-sm text-[#F7931A] mb-6">
              User Reward = (User Hashrate ÷ Global Hashrate) × Block Reward
            </div>
            
            <p className="leading-relaxed">
              This ensures transparent distribution across all active miners.
            </p>
          </motion.div>

          {/* Block Emission Schedule */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mb-12"
          >
            <h2 className="text-[22px] font-semibold text-white mb-6 pb-3 border-b border-[#16181D]">
              <span className="text-[#6B7280] mr-2">4.</span>Block Emission Schedule
            </h2>

            <p className="mb-6 leading-relaxed">
              Quarterly Halving reduces block rewards over time to ensure fairness with early adopters while enhance & balance scarcity overtime.
            </p>

            {/* Visual Emission Schedule */}
            <div className="space-y-6 mb-6">
              {/* Genesis Period */}
              <div className="bg-[#111316] border border-[#16181D] rounded-lg p-5">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[#E5E7EB] font-medium">Genesis Period</span>
                  <span className="text-[#6B7280] text-sm">Q4 2025 - Q1 2026</span>
                </div>
                <div className="w-full h-3 bg-[#0D0F14] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#F7931A] to-[#F7B31A] rounded-full" style={{ width: '100%' }}></div>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[#9AA3AF] text-xs">Initial Rewards</span>
                  <span className="text-[#F7931A] text-xs font-medium">100% Rate</span>
                </div>
              </div>

              {/* First Halving */}
              <div className="bg-[#111316] border border-[#16181D] rounded-lg p-5">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[#E5E7EB] font-medium">First Halving</span>
                  <span className="text-[#6B7280] text-sm">Q1 2026 - Q2 2026</span>
                </div>
                <div className="w-full h-3 bg-[#0D0F14] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#F7931A] to-[#E88A1A]" style={{ width: '50%' }}></div>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[#9AA3AF] text-xs">Reduced Rewards</span>
                  <span className="text-[#F7931A] text-xs font-medium">50% Rate</span>
                </div>
              </div>

              {/* Second Halving */}
              <div className="bg-[#111316] border border-[#16181D] rounded-lg p-5">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[#E5E7EB] font-medium">Second Halving</span>
                  <span className="text-[#6B7280] text-sm">Q2 2026 - Q3 2026</span>
                </div>
                <div className="w-full h-3 bg-[#0D0F14] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#F7931A] to-[#D77A1A]" style={{ width: '25%' }}></div>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[#9AA3AF] text-xs">Quarter Rewards</span>
                  <span className="text-[#F7931A] text-xs font-medium">25% Rate</span>
                </div>
              </div>

              {/* Third Halving */}
              <div className="bg-[#111316] border border-[#16181D] rounded-lg p-5">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[#E5E7EB] font-medium">Third Halving</span>
                  <span className="text-[#6B7280] text-sm">Q3 2026 - Q4 2026</span>
                </div>
                <div className="w-full h-3 bg-[#0D0F14] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#F7931A] to-[#C66A1A]" style={{ width: '12.5%' }}></div>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[#9AA3AF] text-xs">Eighth Rewards</span>
                  <span className="text-[#F7931A] text-xs font-medium">12.5% Rate</span>
                </div>
              </div>

              {/* Subsequent Halvings */}
              <div className="bg-[#111316] border border-[#16181D] rounded-lg p-5 opacity-70">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[#E5E7EB] font-medium">Subsequent Halvings</span>
                  <span className="text-[#6B7280] text-sm">Q4 2026+</span>
                </div>
                <div className="w-full h-3 bg-[#0D0F14] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#F7931A] to-[#B55A1A]" style={{ width: '6%' }}></div>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[#9AA3AF] text-xs">Diminishing Rewards</span>
                  <span className="text-[#F7931A] text-xs font-medium">&lt; 12.5% Rate</span>
                </div>
              </div>
            </div>

            {/* Total Supply Distribution */}
            <div className="bg-[#111316] border border-[#F7931A]/20 rounded-lg p-5 mb-6">
              <h3 className="text-[#E5E7EB] font-medium mb-4">Total Supply Distribution</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[#9AA3AF] text-sm">App Mining Distribution</span>
                    <span className="text-[#F7931A] text-sm font-medium">65.5%</span>
                  </div>
                  <div className="w-full h-2 bg-[#0D0F14] rounded-full overflow-hidden">
                    <div className="h-full bg-[#F7931A]" style={{ width: '65.5%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[#9AA3AF] text-sm">Reserved for Future</span>
                    <span className="text-[#6B7280] text-sm font-medium">34.5%</span>
                  </div>
                  <div className="w-full h-2 bg-[#0D0F14] rounded-full overflow-hidden">
                    <div className="h-full bg-[#6B7280]" style={{ width: '34.5%' }}></div>
                  </div>
                </div>
              </div>
            </div>
            
            <p className="leading-relaxed text-sm text-[#9AA3AF]">
              First Halving Is Occur From Q1 2026. Scarcity increases with each halving cycle, supporting long-term sustainability.
            </p>

          </motion.div>


          {/* Conclusion */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mb-12"
          >
            <h2 className="text-[22px] font-semibold text-white mb-6 pb-3 border-b border-[#16181D]">
              <span className="text-[#6B7280] mr-2">5.</span>Conclusion
            </h2>
            <p className="mb-4 leading-relaxed">
              B2B reimagines mining by making it mobile-first, accessible, and fair.
            </p>
            <p className="leading-relaxed">
              With consistent block rewards, a structured halving schedule, and community-centered supply allocation, B2B opens mining to a new generation — without barriers and without privilege.
            </p>
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
            className="text-center pt-8 border-t border-[#16181D]"
          >
            <p className="text-[#E5E7EB] font-semibold mb-2">B2B Mining Platform</p>
            <p className="text-[#6B7280] text-sm mb-4">Bitcoin 2nd Block Inspired System</p>
            <p className="text-[#6B7280] text-xs">
              This document is for informational purposes only and does not constitute financial advice.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}