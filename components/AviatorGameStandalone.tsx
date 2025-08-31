import { useEffect, useRef, useState, useCallback } from 'react'
import { Stage, Container } from '@pixi/react';
import { dimensionType, aviatorStateType } from '../utils/aviatorTypes'
import AppStage from './pixicomp/AppStage'
import { webpORpng } from '../utils/aviatorUtils'

// Internal context for PIXI - self-contained
interface InternalAviatorState {
    dimension: dimensionType;
    game_anim_status: 'WAITING' | 'ANIM_STARTED' | 'ANIM_CRASHED';
}

// External props - only server data
interface AviatorGameStandaloneProps {
    gameState: 'betting' | 'running' | 'crashed'
    multiplier: number
    countdown: number
    crashHistory?: number[]
    
    // Optional styling
    width?: number
    height?: number
    className?: string
    
    // Optional callbacks
    onGameStateChange?: (state: string) => void
    onMultiplierChange?: (multiplier: number) => void
}

const AviatorGameStandalone = ({
    gameState,
    multiplier,
    countdown,
    crashHistory = [],
    width = 800,
    height = 400,
    className = "",
    onGameStateChange,
    onMultiplierChange
}: AviatorGameStandaloneProps) => {
    
    // Internal PIXI state - self-managed
    const [internalAviatorState, setInternalAviatorState] = useState<InternalAviatorState>({
        dimension: { width: 1920, height: 630 }, // Default PIXI dimensions
        game_anim_status: 'WAITING'
    })
    
    const [pixiDimension, setPixiDimension] = useState<dimensionType>({ width, height })
    const [trigParachute, setTrigParachute] = useState({ uniqId: 0, isMe: true })
    const [rotate, setRotate] = useState(0)
    const [scale, setScale] = useState(0)
    
    const pixi_ref = useRef<HTMLDivElement>(null)

    // Calculate PIXI scaling
    useEffect(() => {
        const newScale = Math.min(
            pixiDimension.width / internalAviatorState.dimension.width,
            pixiDimension.height / internalAviatorState.dimension.height
        )
        setScale(newScale)
    }, [pixiDimension, internalAviatorState.dimension])

    // Update dimensions and internal state
    const updateDimensions = useCallback(() => {
        const containerWidth = pixi_ref.current?.clientWidth || width
        const finalWidth = Math.min(containerWidth, width)
        const finalHeight = height
        
        setPixiDimension({ width: finalWidth, height: finalHeight })
        
        // Update internal aviator state for PIXI scaling
        setInternalAviatorState(prev => {
            const new_width = prev.dimension.width
            const new_height = new_width * finalHeight / finalWidth
            return {
                ...prev,
                dimension: {
                    width: new_width,
                    height: new_height
                }
            }
        })
    }, [width, height])

    // Handle game state changes
    useEffect(() => {
        let newAnimStatus: 'WAITING' | 'ANIM_STARTED' | 'ANIM_CRASHED' = 'WAITING'
        
        if (gameState === 'running') {
            newAnimStatus = 'ANIM_STARTED'
        } else if (gameState === 'crashed') {
            newAnimStatus = 'ANIM_CRASHED'
            // Trigger parachute animation
            setTrigParachute(prev => ({ uniqId: prev.uniqId + 1, isMe: true }))
            
            // Reset to waiting after 3 seconds
            setTimeout(() => {
                setInternalAviatorState(prev => ({ ...prev, game_anim_status: 'WAITING' }))
            }, 3000)
        } else {
            newAnimStatus = 'WAITING'
        }
        
        setInternalAviatorState(prev => ({ ...prev, game_anim_status: newAnimStatus }))
        
        // Optional callback
        onGameStateChange?.(gameState)
    }, [gameState, onGameStateChange])

    // Optional multiplier callback
    useEffect(() => {
        onMultiplierChange?.(multiplier)
    }, [multiplier, onMultiplierChange])

    // Initialize dimensions and propeller rotation
    useEffect(() => {
        updateDimensions()
        window.addEventListener('resize', updateDimensions)
        
        // Propeller rotation
        const rotationInterval = setInterval(() => setRotate(prev => prev + 10), 100)
        
        return () => {
            window.removeEventListener('resize', updateDimensions)
            clearInterval(rotationInterval)
        }
    }, [updateDimensions])

    return (
        <div className={`aviator-game-standalone ${className}`}>
            {/* Game Canvas with Professional Styling */}
            <div className="w-full max-w-4xl mx-auto mb-6">
                <div 
                    className="flex justify-center w-full relative border-4 border-gray-800 rounded-2xl bg-black overflow-hidden shadow-2xl" 
                    style={{ 
                        height: pixiDimension.height,
                        background: 'linear-gradient(135deg, #1a1a1a 0%, #000000 100%)'
                    }} 
                    ref={pixi_ref}
                >
                    {/* Game State Overlay */}
                    <div 
                        className='flex flex-col gap-10 absolute top-0 justify-center items-center z-10'
                        style={{
                            height: pixiDimension.height,
                            display: internalAviatorState.game_anim_status !== "ANIM_STARTED" ? "flex" : "none",
                            gap: pixiDimension.height < 200 ? 2 : 40,
                            width: '100%'
                        }}
                    >
                        {/* Spinning Propeller */}
                        <div 
                            style={{ 
                                display: internalAviatorState.game_anim_status === "WAITING" ? "block" : "none",
                                width: Math.min(pixiDimension.width, pixiDimension.height) / 4 
                            }}
                        >
                            <img 
                                src={`${process.env.REACT_APP_ASSETS_IMAGE_URL || '/aviator/'}${webpORpng}/propeller.${webpORpng}`} 
                                style={{ rotate: `${rotate}deg` }} 
                                alt="propeller" 
                            />
                        </div>
                        
                        {/* Game Status Messages */}
                        <div className='flex flex-col justify-center items-center px-4 py-2 lg:px-8 lg:py-2 bg-black/70 border-dashed border border-[#E59407] rounded-lg'>
                            <p className='text-[#E59407] uppercase font-bold text-[21px] lg:text-[30px]'>
                                {internalAviatorState.game_anim_status === "ANIM_CRASHED" ? "FLEW AWAY" : "PLACE YOUR BET"}
                            </p>
                            {internalAviatorState.game_anim_status === "ANIM_CRASHED" && (
                                <p className='text-white font-bold text-[42px] leading-[42px] lg:text-[100px] lg:leading-[100px]'>
                                    {multiplier.toFixed(2)}x
                                </p>
                            )}
                            {gameState === 'betting' && countdown > 0 && (
                                <p className='text-yellow-300 font-bold text-lg mt-2'>
                                    Starting in: {countdown}s
                                </p>
                            )}
                        </div>
                    </div>
                    
                    {/* Self-Contained PIXI Stage */}
                    <Stage width={pixiDimension.width} height={pixiDimension.height} options={{ antialias: true }}>
                        <Container scale={scale}>
                            <AppStage 
                                payout={multiplier} 
                                game_anim_status={internalAviatorState.game_anim_status} 
                                dimension={internalAviatorState.dimension} 
                                pixiDimension={pixiDimension} 
                                trigParachute={trigParachute} 
                            />
                        </Container>
                    </Stage>
                </div>
            </div>

            {/* Optional Crash History Display */}
            {crashHistory.length > 0 && (
                <div className="mt-4 bg-black bg-opacity-30 p-4 rounded-xl w-full max-w-4xl mx-auto">
                    <h3 className="text-lg font-bold mb-3 text-purple-400 text-center">📈 Crash History</h3>
                    <div className="flex flex-wrap gap-2 justify-center">
                        {crashHistory.slice(-10).map((crash, index) => {
                            const colorClass = crash < 2 ? 'bg-red-500' : 
                                             crash < 5 ? 'bg-yellow-500' : 'bg-green-500'
                            return (
                                <div 
                                    key={index}
                                    className={`px-3 py-1 rounded-lg font-bold text-black text-sm ${colorClass} shadow-md`}
                                >
                                    {crash.toFixed(2)}x
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

export default AviatorGameStandalone
