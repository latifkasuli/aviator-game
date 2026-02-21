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

    const [internalAviatorState, setInternalAviatorState] = useState({
        dimension: { width: 1920, height: 630 },
        game_anim_status: 'WAITING'
    })
    
    const [pixiDimension, setPixiDimension] = useState({ width, height })
    const [trigParachute, setTrigParachute] = useState({ uniqId: 0, isMe: true })
    const [rotate, setRotate] = useState(0)
    const [scale, setScale] = useState(0)
    
    const pixi_ref = useRef(null)

    useEffect(() => {
        const newScale = Math.min(
            pixiDimension.width / internalAviatorState.dimension.width,
            pixiDimension.height / internalAviatorState.dimension.height
        )
        setScale(newScale)
    }, [pixiDimension, internalAviatorState.dimension])

    const updateDimensions = useCallback(() => {
        const containerWidth = pixi_ref.current?.clientWidth || width
        const finalWidth = Math.min(containerWidth, width)
        
        let finalHeight = height;
        if (containerWidth < 640) {
            finalHeight = height * 0.7;
        } else if (containerWidth < 1024) {
            finalHeight = height * 0.8;
        }
        
        setPixiDimension({ width: finalWidth, height: finalHeight })
        
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

    useEffect(() => {
        let newAnimStatus = 'WAITING'
        
        if (gameState === 'running') {
            newAnimStatus = 'ANIM_STARTED'
        } else if (gameState === 'crashed') {
            newAnimStatus = 'ANIM_CRASHED'
            
            setTimeout(() => {
                setInternalAviatorState(prev => ({ ...prev, game_anim_status: 'WAITING' }))
            }, 3000)
        } else {
            newAnimStatus = 'WAITING'
        }
        
        setInternalAviatorState(prev => ({ ...prev, game_anim_status: newAnimStatus }))
        
        onGameStateChange?.(gameState)
    }, [gameState, onGameStateChange])

    useEffect(() => {
        if (triggerCashout && triggerCashout.timestamp > 0) {
            setTrigParachute(prev => ({ 
                uniqId: prev.uniqId + 1, 
                isMe: triggerCashout.isMe 
            }))
        }
    }, [triggerCashout])

    useEffect(() => {
        onMultiplierChange?.(multiplier)
    }, [multiplier, onMultiplierChange])

    useEffect(() => {
        updateDimensions()
        window.addEventListener('resize', updateDimensions)

        const rotationInterval = setInterval(() => setRotate(prev => prev + 10), 100)
        
        return () => {
            window.removeEventListener('resize', updateDimensions)
            clearInterval(rotationInterval)
        }
    }, [updateDimensions])

    return (
        <div className={`aviator-game-standalone ${className}`}>
            <div className="w-full max-w-4xl mx-auto mb-0">
                <div 
                    className="flex justify-center w-full relative border-2 border-gray-800 rounded-2xl bg-black overflow-hidden shadow-2xl" 
                    style={{ 
                        height: pixiDimension.height,
                        background: 'linear-gradient(135deg, #1a1a1a 0%, #000000 100%)'
                    }} 
                    ref={pixi_ref}
                >
                    <div 
                        className='flex flex-col gap-10 absolute top-0 justify-center items-center z-10'
                        style={{
                            height: pixiDimension.height,
                            display: internalAviatorState.game_anim_status !== "ANIM_STARTED" ? "flex" : "none",
                            gap: pixiDimension.height < 200 ? 2 : 40,
                            width: '100%'
                        }}
                    >
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
