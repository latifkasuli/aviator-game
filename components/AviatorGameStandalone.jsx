import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Stage, Container } from '@pixi/react';
import AppStage from './pixicomp/AppStage'
import { webpORpng } from '../utils/aviatorUtils'

const AviatorGameStandalone = ({
    gameState,
    multiplier,
    countdown,
    crashHistory = [],
    width = 800,
    height = 400,
    className = "",
    onGameStateChange,
    onMultiplierChange,
    triggerCashout
}) => {
    
    // Internal PIXI state - self-managed
    const [internalAviatorState, setInternalAviatorState] = useState({
        dimension: { width: 1920, height: 630 }, // Default PIXI dimensions
        game_anim_status: 'WAITING'
    })
    
    const [pixiDimension, setPixiDimension] = useState({ width, height })
    const [trigParachute, setTrigParachute] = useState({ uniqId: 0, isMe: true })
    const [rotate, setRotate] = useState(0)
    const [scale, setScale] = useState(0)
    
    const pixi_ref = useRef(null)

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
        
        // Mobile height adjustment
        // Adjust these values to control canvas height on different screen sizes
        let finalHeight = height;
        if (containerWidth < 640) {
            // MOBILE: Adjust this value to change mobile canvas height
            // Examples:
            // - height * 0.5 = 50% of default height
            // - height * 0.6 = 60% of default height  
            // - Math.min(height, 300) = max 300px height
            // - 250 = fixed 250px height
            finalHeight = height * 0.7; // Currently set to 65% on mobile
        } else if (containerWidth < 1024) {
            // TABLET: Optional tablet-specific height
            finalHeight = height * 0.8; // 80% on tablets
        }
        // DESKTOP: Uses full height (100%)
        
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
        let newAnimStatus = 'WAITING'
        
        if (gameState === 'running') {
            newAnimStatus = 'ANIM_STARTED'
        } else if (gameState === 'crashed') {
            newAnimStatus = 'ANIM_CRASHED'
            
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

    // Listen for cashout trigger
    useEffect(() => {
        if (triggerCashout && triggerCashout.timestamp > 0) {
            // Trigger parachute animation when cashout occurs
            setTrigParachute(prev => ({ 
                uniqId: prev.uniqId + 1, 
                isMe: triggerCashout.isMe 
            }))
        }
    }, [triggerCashout])

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
            <div className="w-full max-w-4xl mx-auto mb-0">
                <div 
                    className="flex justify-center w-full relative border-2 border-gray-800 rounded-2xl bg-black overflow-hidden shadow-2xl" 
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
                                src={`${import.meta.env.VITE_ASSETS_IMAGE_URL || '/assets/'}${webpORpng}/propeller.${webpORpng}`} 
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
        </div>
    )
}

export default AviatorGameStandalone
