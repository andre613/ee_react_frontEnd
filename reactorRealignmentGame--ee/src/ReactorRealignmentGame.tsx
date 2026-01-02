import React, { useState, useEffect, useCallback } from 'react';

interface EEResponse {
  success?: boolean;
  message?: string;
  ERROR?: string;
  difficulty?: string;
  timeLimit?: number;
  rounds?: number;
  sequenceSpeed?: number;
}

const ReactorRealignmentGame: React.FC = () => {
  const [serverUrl, setServerUrl] = useState('/api');
  const [shipName, setShipName] = useState('Audacity');
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [totalTime, setTotalTime] = useState<number>(60);
  const [gameActive, setGameActive] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'failure' | ''>('');
  const [audioReady, setAudioReady] = useState(false);

  const [sequence, setSequence] = useState<number[]>([]);
  const [playerSequence, setPlayerSequence] = useState<number[]>([]);
  const [isShowingSequence, setIsShowingSequence] = useState(false);
  const [highlightedButton, setHighlightedButton] = useState<number | null>(null);
  const [round, setRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(5);
  const [sequenceSpeed, setSequenceSpeed] = useState<number>(500);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
  const buttonLabels = ['RED', 'GREEN', 'BLUE', 'YELLOW'];

  useEffect(() => {
    const audio = new Audio('/reactorBreach.mp3');
    audio.loop = true;
    audio.volume = 0.5;
    audioRef.current = audio;

    const playAudio = () => {
      audio.play().then(() => {
        setAudioReady(true);
      }).catch(err => {
        console.log('Autoplay blocked, waiting for user interaction:', err);
      });
    };

    playAudio();

    const handleInteraction = () => {
      if (!audioReady) {
        audio.play().then(() => setAudioReady(true)).catch(console.error);
        document.removeEventListener('click', handleInteraction);
        document.removeEventListener('keydown', handleInteraction);
      }
    };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('keydown', handleInteraction);

    return () => {
      audio.pause();
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };
  }, [audioReady]);

  const callEE = useCallback(async (code: string): Promise<EEResponse | null> => {
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
  }, [serverUrl]);

  const showMessage = useCallback((text: string, type: 'success' | 'failure' | '') => {
    setMessage(text);
    setMessageType(type);
  }, []);

  const forfeit = async () => {
    const luaCode = `return _G.scenarioApi.reactorCoreBreach("${shipName}")`;
    await callEE(luaCode);
  };

  const getDifficultySettings = async () => {
    const code = `
      if _G.gameSettings and _G.gameSettings.difficulty then
        return {
          difficulty = _G.gameSettings.difficulty,
          timeLimit = _G.gameSettings.timeLimit,
          rounds = _G.gameSettings.rounds,
          sequenceSpeed = _G.gameSettings.sequenceSpeed
        }
      else
        return {difficulty = "Easy", timeLimit = 60, rounds = 5, sequenceSpeed = 500}
      end
    `;

    const result = await callEE(code);

    if (result) {
      setTotalTime(result.timeLimit || 60);
      setTotalRounds(result.rounds || 5);
      setSequenceSpeed(result.sequenceSpeed || 500);

      showMessage(`Difficulty: ${result.difficulty} | ${result.rounds} rounds | ${result.timeLimit}s`, '');
    }
  };

  const successfulStabilization = async () => {
    setGameActive(false);
    showMessage('REACTOR STABILIZED!', 'success');

    const code = `
      local all = getAllObjects()
      for i = 1, #all do
        if all[i].typeName == "PlayerSpaceship" and all[i]:getCallSign() == "${shipName}" then
          all[i]:setSystemHealth("reactor", 1.0)
          all[i]:addToShipLog("Reactor core successfully stabilized!", "Green")
          return {success = true, message = "Core stabilized"}
        end
      end
      return {success = false, message = "Ship not found"}
    `;

    await callEE(code);

    setTimeout(() => {
      setSequence([]);
      setPlayerSequence([]);
      setRound(1);
      setTimeLeft(totalTime);
    }, 2000);
  };

  const coreExplosion = useCallback(async () => {
    setGameActive(false);
    showMessage('REACTOR CORE BREACH! CATASTROPHIC FAILURE!', 'failure');

    const code = `_G.scenarioApi.reactorCoreBreach("${shipName}")`;
    await callEE(code);
  }, [shipName, callEE, showMessage]);

  const generateSequence = useCallback(() => {
    const newSequence = [...sequence];
    newSequence.push(Math.floor(Math.random() * 4));
    setSequence(newSequence);
    return newSequence;
  }, [sequence]);

  const showSequence = async (seq: number[]) => {
    setIsShowingSequence(true);
    setPlayerSequence([]);

    for (let i = 0; i < seq.length; i++) {
      await new Promise(resolve => setTimeout(resolve, sequenceSpeed));
      setHighlightedButton(seq[i]);
      await new Promise(resolve => setTimeout(resolve, sequenceSpeed));
      setHighlightedButton(null);
    }

    setIsShowingSequence(false);
    showMessage('Repeat the sequence!', '');
  };

  const handleButtonClick = (buttonId: number) => {
    if (isShowingSequence || !gameActive) return;

    const newPlayerSequence = [...playerSequence, buttonId];
    setPlayerSequence(newPlayerSequence);

    setHighlightedButton(buttonId);
    setTimeout(() => setHighlightedButton(null), 200);

    const currentIndex = newPlayerSequence.length - 1;

    if (newPlayerSequence[currentIndex] !== sequence[currentIndex]) {
      showMessage('WRONG SEQUENCE!', 'failure');
      setTimeout(() => {
        setPlayerSequence([]);
        showSequence(sequence);
      }, 1000);
      return;
    }

    if (newPlayerSequence.length === sequence.length) {
      if (round >= totalRounds) {
        successfulStabilization();
      } else {
        showMessage(`Round ${round} complete!`, 'success');
        setTimeout(() => {
          setRound(prev => prev + 1);
          const newSeq = generateSequence();
          showSequence(newSeq);
        }, 1000);
      }
    }
  };

  const startGame = async () => {
    await getDifficultySettings();

    const initCode = `
      local all = getAllObjects()
      for i = 1, #all do
        if all[i].typeName == "PlayerSpaceship" and all[i]:getCallSign() == "${shipName}" then
          all[i]:setSystemHealth("reactor", 0.3)
          all[i]:addToShipLog("WARNING: Warp core instability detected! Follow the stabilization sequence!", "Red")
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
    setTimeLeft(totalTime);
    setRound(1);
    setSequence([]);
    setPlayerSequence([]);

    setTimeout(() => {
      const newSeq = [Math.floor(Math.random() * 4)];
      setSequence(newSeq);
      showSequence(newSeq);
    }, 1500);
  };

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
  }, [coreExplosion, gameActive]);

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
      maxWidth: '600px',
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
    instructions: {
      background: 'rgba(255, 255, 0, 0.1)',
      border: '2px solid #ffff00',
      padding: '15px',
      borderRadius: '5px',
      marginBottom: '20px',
      color: '#ffff00',
      fontSize: '14px',
      textAlign: 'center' as const
    },
    buttonsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '20px',
      marginBottom: '20px'
    },
    colorButton: {
      padding: '60px 20px',
      fontSize: '20px',
      fontWeight: 'bold',
      cursor: 'pointer',
      borderRadius: '10px',
      border: '4px solid',
      transition: 'all 0.1s',
      fontFamily: '"Courier New", monospace'
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
      minHeight: '25px',
      fontWeight: 'bold'
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
    },
    progress: {
      textAlign: 'center' as const,
      color: '#00aaff',
      marginBottom: '20px',
      fontSize: '16px'
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
        <h1 style={styles.title}>
          <span onClick={() => { forfeit(); }} style={{ cursor: 'pointer' }}>⚠️</span>
          REACTOR CRITICAL
          ⚠️
        </h1>

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

        {gameActive && (
          <>
            <div style={styles.statsBar}>
              <div style={styles.stat}>
                <div style={styles.statLabel}>TIME</div>
                <div style={{...styles.statValue, color: timeLeft < 15 ? '#ff0000' : '#ffff00'}}>
                  {timeLeft}s
                </div>
              </div>
              <div style={styles.stat}>
                <div style={styles.statLabel}>ROUND</div>
                <div style={{...styles.statValue, color: '#00ff00'}}>
                  {round} / {totalRounds}
                </div>
              </div>
            </div>

            <div style={styles.instructions}>
              {isShowingSequence ? 'WATCH THE SEQUENCE...' : 'REPEAT THE SEQUENCE!'}
            </div>

            <div style={styles.progress}>
              Sequence Length: {sequence.length} | Your Input: {playerSequence.length}
            </div>
          </>
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
          <div style={styles.buttonsGrid}>
            {colors.map((color, index) => (
              <button
                key={index}
                onClick={() => handleButtonClick(index)}
                disabled={isShowingSequence}
                style={{
                  ...styles.colorButton,
                  background: highlightedButton === index ? color : `${color}40`,
                  borderColor: color,
                  color: '#fff',
                  textShadow: '0 0 10px #000',
                  opacity: isShowingSequence && highlightedButton !== index ? 0.3 : 1,
                  cursor: isShowingSequence ? 'not-allowed' : 'pointer'
                }}
              >
                {buttonLabels[index]}
              </button>
            ))}
          </div>
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

export default ReactorRealignmentGame;