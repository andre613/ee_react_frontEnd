import React, { useState, useEffect, useCallback } from 'react';

interface EEResponse {
  success?: boolean;
  message?: string;
  ERROR?: string;
}

interface ReactorNode {
  id: number;
  power: number;
  targetPower: number;
  overheating: boolean;
}

const WarpCoreGame: React.FC = () => {
  const [serverUrl, setServerUrl] = useState('/api');
  const [shipName, setShipName] = useState('PL197');
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [gameActive, setGameActive] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'failure' | ''>('');

  const [nodes, setNodes] = useState<ReactorNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [coreStability, setCoreStability] = useState(100);
  const [coolantLevel, setCoolantLevel] = useState(100);

  const callEE = async (code: string): Promise<EEResponse | null> => {
    try {
      const response = await fetch(`${serverUrl}/exec.lua`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: code
      });
      return await response.json();
    } catch (error) {
      console.error('EE API Error:', error);
      return null;
    }
  };

  const showMessage = (text: string, type: 'success' | 'failure' | '') => {
    setMessage(text);
    setMessageType(type);
  };

  const initializeNodes = useCallback(() => {
    const newNodes: ReactorNode[] = [];
    for (let i = 0; i < 6; i++) {
      newNodes.push({
        id: i,
        power: Math.floor(Math.random() * 40) + 30,
        targetPower: 50,
        overheating: false
      });
    }
    setNodes(newNodes);
  }, []);

  const successfulStabilization = async () => {
    setGameActive(false);
    showMessage('REACTOR STABILIZED!', 'success');

    const code = `
      local all = getAllObjects()
      for i = 1, #all do
        if all[i].typeName == "PlayerSpaceship" and all[i]:getCallSign() == "${shipName}" then
          all[i]:setSystemHealth("reactor", 1.0)
          all[i]:addToShipLog("Warp core successfully stabilized!", "Green")
          return {success = true, message = "Core stabilized"}
        end
      end
      return {success = false, message = "Ship not found"}
    `;

    await callEE(code);

    setTimeout(() => {
      setNodes([]);
      setCoreStability(100);
      setCoolantLevel(100);
      setTimeLeft(60);
    }, 2000);
  };

  const coreExplosion = async () => {
    setGameActive(false);
    showMessage('CORE BREACH! CATASTROPHIC FAILURE!', 'failure');

    const code = `_G.scenarioApi.warpCoreBreach("${shipName}")`;

    await callEE(code);

    setTimeout(() => {
      setNodes([]);
      setCoreStability(100);
      setCoolantLevel(100);
      setTimeLeft(60);
    }, 2000);
  };

  const transferPower = (fromId: number, toId: number, amount: number) => {
    setNodes(prev => {
      const newNodes = [...prev];
      const fromNode = newNodes.find(n => n.id === fromId);
      const toNode = newNodes.find(n => n.id === toId);

      if (fromNode && toNode && fromNode.power >= amount) {
        fromNode.power -= amount;
        toNode.power += amount;
      }

      return newNodes;
    });
    setSelectedNode(null);
  };

  const applyCoolant = (nodeId: number) => {
    if (coolantLevel < 20) return;

    setCoolantLevel(prev => Math.max(0, prev - 20));
    setNodes(prev => {
      const newNodes = [...prev];
      const node = newNodes.find(n => n.id === nodeId);
      if (node) {
        node.power = Math.max(0, node.power - 15);
        node.overheating = false;
      }
      return newNodes;
    });
  };

  const startGame = async () => {
    const initCode = `
      local all = getAllObjects()
      for i = 1, #all do
        if all[i].typeName == "PlayerSpaceship" and all[i]:getCallSign() == "${shipName}" then
          all[i]:setSystemHealth("reactor", 0.3)
          all[i]:addToShipLog("WARNING: Warp core instability detected! Balance power nodes!", "Red")
          return {success = true}
        end
      end
      return {success = false, message = "Ship not found"}
    `;

    const result = await callEE(initCode);
    if (!result || !result.success) {
      showMessage('ERROR: Cannot connect to ship', 'failure');
      return;
    }

    setGameActive(true);
    setTimeLeft(60);
    setCoreStability(100);
    setCoolantLevel(100);
    initializeNodes();
    showMessage('Balance all reactor nodes to 50% power!', '');
  };

  useEffect(() => {
    if (!gameActive) return;

    const gameLoop = setInterval(() => {
      setNodes(prev => {
        const newNodes = prev.map(node => {
          const fluctuation = (Math.random() - 0.5) * 4;
          let newPower = node.power + fluctuation;

          if (newPower > 80) {
            newPower = 80;
            node.overheating = true;
          } else if (newPower < 20) {
            newPower = 20;
          } else {
            node.overheating = false;
          }

          return { ...node, power: newPower };
        });

        const allBalanced = newNodes.every(n =>
          Math.abs(n.power - n.targetPower) < 5 && !n.overheating
        );

        if (allBalanced) {
          successfulStabilization();
        }

        const totalDeviation = newNodes.reduce((sum, n) =>
          sum + Math.abs(n.power - n.targetPower), 0
        );
        const overheatingCount = newNodes.filter(n => n.overheating).length;

        const newStability = Math.max(0, 100 - totalDeviation - (overheatingCount * 10));
        setCoreStability(newStability);

        if (newStability <= 0) {
          coreExplosion();
        }

        return newNodes;
      });

      setCoolantLevel(prev => Math.min(100, prev + 0.5));
    }, 200);

    return () => clearInterval(gameLoop);
  }, [gameActive, nodes]);

  useEffect(() => {
    if (!gameActive) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          coreExplosion();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameActive]);

  const getPowerColor = (power: number, overheating: boolean) => {
    if (overheating) return '#ff0000';
    if (Math.abs(power - 50) < 5) return '#00ff00';
    if (power > 65 || power < 35) return '#ff9900';
    return '#ffff00';
  };

  const styles = {
    container: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px',
      fontFamily: '"Courier New", monospace'
    },
    gameBox: {
      background: 'rgba(0, 0, 0, 0.8)',
      border: '4px solid #00ff00',
      borderRadius: '10px',
      padding: '30px',
      maxWidth: '800px',
      width: '100%',
      boxShadow: '0 0 30px rgba(0, 255, 0, 0.3)'
    },
    title: {
      fontSize: '32px',
      fontWeight: 'bold',
      textAlign: 'center' as const,
      color: '#ff0000',
      marginBottom: '24px',
      textShadow: '0 0 10px #ff0000',
      animation: 'pulse 1s infinite'
    },
    config: {
      background: 'rgba(0, 100, 255, 0.2)',
      border: '2px solid #00aaff',
      padding: '16px',
      borderRadius: '5px',
      marginBottom: '24px'
    },
    statsBar: {
      display: 'flex',
      gap: '20px',
      marginBottom: '20px',
      justifyContent: 'space-between'
    },
    stat: {
      flex: 1,
      background: 'rgba(0, 100, 255, 0.2)',
      border: '2px solid #00aaff',
      padding: '10px',
      borderRadius: '5px',
      textAlign: 'center' as const
    },
    statLabel: {
      color: '#00aaff',
      fontSize: '14px',
      marginBottom: '5px'
    },
    statValue: {
      fontSize: '24px',
      fontWeight: 'bold'
    },
    nodesGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '15px',
      marginBottom: '20px'
    },
    node: {
      background: 'rgba(0, 50, 100, 0.3)',
      border: '3px solid',
      borderRadius: '10px',
      padding: '15px',
      cursor: 'pointer',
      transition: 'all 0.2s'
    },
    nodeLabel: {
      fontSize: '12px',
      color: '#00aaff',
      marginBottom: '10px'
    },
    powerBar: {
      height: '30px',
      background: 'rgba(0, 0, 0, 0.5)',
      borderRadius: '5px',
      overflow: 'hidden',
      marginBottom: '10px',
      position: 'relative' as const
    },
    powerFill: {
      height: '100%',
      transition: 'all 0.2s'
    },
    powerText: {
      position: 'absolute' as const,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      color: '#fff',
      fontWeight: 'bold',
      textShadow: '0 0 3px #000'
    },
    nodeButtons: {
      display: 'flex',
      gap: '5px'
    },
    smallButton: {
      flex: 1,
      padding: '5px',
      fontSize: '12px',
      background: 'rgba(0, 100, 255, 0.3)',
      border: '1px solid #00aaff',
      color: '#00aaff',
      cursor: 'pointer',
      borderRadius: '3px'
    },
    instructions: {
      background: 'rgba(255, 255, 0, 0.1)',
      border: '2px solid #ffff00',
      padding: '15px',
      borderRadius: '5px',
      marginBottom: '20px',
      color: '#ffff00',
      fontSize: '14px'
    },
    label: {
      display: 'block',
      color: '#00aaff',
      marginBottom: '8px'
    },
    input: {
      width: '100%',
      padding: '10px',
      background: 'rgba(0, 0, 0, 0.5)',
      border: '1px solid #00aaff',
      color: '#00ff00',
      fontFamily: '"Courier New", monospace',
      borderRadius: '3px',
      marginBottom: '12px',
      fontSize: '16px'
    },
    message: {
      textAlign: 'center' as const,
      fontSize: '18px',
      marginBottom: '20px',
      minHeight: '25px'
    },
    startButton: {
      width: '100%',
      padding: '20px',
      fontSize: '24px',
      background: 'rgba(0, 255, 0, 0.3)',
      border: '3px solid #00ff00',
      color: '#00ff00',
      cursor: 'pointer',
      borderRadius: '5px',
      fontFamily: '"Courier New", monospace',
      transition: 'all 0.2s'
    }
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        button:hover {
          transform: scale(1.05);
        }
        button:active {
          transform: scale(0.95);
        }
      `}</style>

      <div style={styles.gameBox}>
        <h1 style={styles.title}>⚠️ REACTOR CRITICAL ⚠️</h1>

        {!gameActive && (
          <div style={styles.config}>
            <label style={styles.label}>Empty Epsilon Server:</label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              style={styles.input}
            />
            <label style={styles.label}>Player Ship Callsign:</label>
            <input
              type="text"
              value={shipName}
              onChange={(e) => setShipName(e.target.value)}
              style={styles.input}
            />
          </div>
        )}

        {message && (
          <div style={{
            ...styles.message,
            color: messageType === 'success' ? '#00ff00' : messageType === 'failure' ? '#ff0000' : '#ffff00'
          }}>
            {message}
          </div>
        )}

        {gameActive && (
          <>
            <div style={styles.statsBar}>
              <div style={styles.stat}>
                <div style={styles.statLabel}>TIME</div>
                <div style={{...styles.statValue, color: timeLeft < 20 ? '#ff0000' : '#ffff00'}}>
                  {timeLeft}s
                </div>
              </div>
              <div style={styles.stat}>
                <div style={styles.statLabel}>STABILITY</div>
                <div style={{...styles.statValue, color: coreStability < 30 ? '#ff0000' : coreStability < 60 ? '#ff9900' : '#00ff00'}}>
                  {Math.round(coreStability)}%
                </div>
              </div>
              <div style={styles.stat}>
                <div style={styles.statLabel}>COOLANT</div>
                <div style={{...styles.statValue, color: coolantLevel < 30 ? '#ff0000' : '#00aaff'}}>
                  {Math.round(coolantLevel)}%
                </div>
              </div>
            </div>

            <div style={styles.instructions}>
              <strong>OBJECTIVE:</strong> Balance all nodes to 50% power. Nodes fluctuate over time.
              <br/>
              <strong>CONTROLS:</strong> Click node to select, click another to transfer 10 power. Use coolant to reduce power by 15.
            </div>

            <div style={styles.nodesGrid}>
              {nodes.map(node => (
                <div
                  key={node.id}
                  style={{
                    ...styles.node,
                    borderColor: getPowerColor(node.power, node.overheating),
                    transform: selectedNode === node.id ? 'scale(1.05)' : 'scale(1)',
                    boxShadow: selectedNode === node.id ? '0 0 20px rgba(0, 255, 255, 0.5)' : 'none'
                  }}
                  onClick={() => {
                    if (selectedNode === null) {
                      setSelectedNode(node.id);
                    } else if (selectedNode !== node.id) {
                      transferPower(selectedNode, node.id, 10);
                    } else {
                      setSelectedNode(null);
                    }
                  }}
                >
                  <div style={styles.nodeLabel}>
                    NODE {node.id + 1} {node.overheating && '🔥 OVERHEATING'}
                  </div>
                  <div style={styles.powerBar}>
                    <div
                      style={{
                        ...styles.powerFill,
                        width: `${node.power}%`,
                        background: getPowerColor(node.power, node.overheating)
                      }}
                    />
                    <div style={styles.powerText}>{Math.round(node.power)}%</div>
                  </div>
                  <div style={styles.nodeButtons}>
                    <button
                      style={styles.smallButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        applyCoolant(node.id);
                      }}
                      disabled={coolantLevel < 20}
                    >
                      COOLANT
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!gameActive && (
          <button onClick={startGame} style={styles.startButton}>
            STABILIZE REACTOR
          </button>
        )}
      </div>
    </div>
  );
};

export default WarpCoreGame;