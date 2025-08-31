import { utils, Texture } from "pixi.js";
import { sound } from '@pixi/sound';

export const Game_Global_Vars = {
    curPayout: 0,
    allowedBet: false,
    id: [0, 0],
    hash: "",
    betValue: ["100", "100"],
    betPlaceStatus: ["none", "none"],
    cashingStatus: ["none", "none"],
    cashStarted: [false, false],
    pendingBet: [false, false],
    autoCashVal: ["1.45", "1.45"],
    enabledAutoCashOut: [false, false],
    stake: {
        max: 10000,
        min: 100
    },
}

// Define the function for the curve
export const curveFunction = (x, dimension) => {
    return 0.0007 * Math.pow(x, 1.9) * dimension.height / 1500
};

export const renderCurve = (g, _dimension) => {
    const dimension = { width: _dimension.width, height: _dimension.height - 40 }
    const xAxis = Array.from({ length: dimension.width / 10 }, (_, index) => index * 10)
    const points = xAxis.map(item => ({ x: item, y: dimension.height - curveFunction(item, dimension) }));
    g.clear()
    g.beginFill(0xE59407, 0.3);
    // g.lineStyle(4, 0xffd900, 1);
    g.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
        g.lineTo(points[i].x, points[i].y);
    }
    g.lineTo(points[points.length - 1].x, dimension.height);
    g.lineTo(0, dimension.height);
    g.endFill();
    const lineWidth = interpolate(window.innerWidth, 400, 1920, 16, 4)
    g.lineStyle(lineWidth, 0xffd900, 1);
    g.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
        g.lineTo(points[i].x, points[i].y);
    }
}

export const _drawOuterBoundery = (g, dimension) => {
    g.clear()
    g.lineStyle(2, 0x2A2A2E, 1);
    g.drawRoundedRect(0, 0, dimension.width, dimension.height, 10)
}

export const _drawInnerBoundery = (g, dimension) => {
    g.clear()
    g.lineStyle(2, 0x2A2A2E, 1);
    g.moveTo(40, 0)
    g.lineTo(40, dimension.height - 40)
    g.lineTo(dimension.width, dimension.height - 40)
}

export const createGradTexture = (dimension) => {
    const canvas = document.createElement('canvas');

    canvas.width = dimension.width / 2;
    canvas.height = dimension.height;
    const r = Math.min(dimension.width, dimension.height)
    const ctx = canvas.getContext('2d');

    if (ctx) {
        const grd = ctx.createRadialGradient(dimension.width / 4, dimension.height / 2, r / 8, dimension.width / 4, dimension.height / 2, r / 2);
        // radial - gradient(circle, rgba(86, 0, 152, 1) 0 %, rgba(41, 0, 73, 1) 100 %)
        grd.addColorStop(0, '#E5940744');
        grd.addColorStop(1, '#00000044');

        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, dimension.width / 2, dimension.height);
    }

    return Texture.from(canvas);
}

export const maskDraw = (g, dimension) => {
    g.beginFill(0xff0000);
    g.drawRect(0, 0, dimension.width, dimension.height);
    g.endFill();
}

export const smoothen = (t, dimension) => (Math.sin(Math.PI * t / (2 * dimension.width)) * dimension.width)

export const _drawBar = (width, color) => (g) => {
    g.clear()
    g.beginFill(color, 1)
    g.drawRoundedRect(0, 0, width, 20, 10)
    g.endFill()
}

export const playSound = (type) => {
    let status = '';
    switch (type) {
        case 'bg':
            status = localStorage.getItem('music') || 'true'
            break;
        case 'flew':
        case 'win':
        case 'take':
            status = localStorage.getItem('fx') || 'true'
            break;
    }
    if (status === 'true')
        sound.play(`${type}-sound`, { loop: type === 'bg' });
}

export const stopSound = (type) => {
    sound.stop(`${type}-sound`)
}

export const loadSound = () => {
    try {
        // Use correct path for localhost development
        const soundBasePath = import.meta.env.VITE_ASSETS_IMAGE_URL || "/assets/";
        
        sound.add('bg-sound', `${soundBasePath}general/sound/bg-sound.mp3`);
        sound.add('flew-sound', `${soundBasePath}general/sound/flew.mp3`);
        sound.add('win-sound', `${soundBasePath}general/sound/win.mp3`);
        sound.add('take-sound', `${soundBasePath}general/sound/take.mp3`);
        sound.volumeAll = 0.5
        
        console.log('Sound assets loaded successfully');
    } catch (error) {
        console.warn('Sound loading failed:', error);
    }
}

export const setVolume = (val) => {
    sound.volumeAll = val / 100
}

export const openFullscreen = async () => {
    var elem = document.documentElement;
    if (elem.requestFullscreen) {
        try {
            await elem.requestFullscreen();
        } catch (e) { }
    }
}

/* Close fullscreen */
export const closeFullscreen = async () => {
    if (document.exitFullscreen) {
        try {
            await document.exitFullscreen();
        } catch (e) { }
    }
}

export function interpolate(x, x1, x2, y1, y2) {
    return Math.max(Math.min(y1, y2), Math.min(Math.max(y1, y2), (y2 - y1) * (x - x1) / (x2 - x1) + y1))
}

export function getHistoryItemColor(_val) {
    const val = parseFloat(_val.substring(0, _val.length - 1))
    if (val < 2) return "#07BDE5"
    else if (val < 10) return "#913EF8"
    else return "#C017B4"
}

export const testMobile = () => {
    if (/Mobi/i.test(navigator.userAgent) || /Macintosh/i.test(navigator.userAgent)) {
        console.log("This is a mobile device");
        if (/iPhone/i.test(navigator.userAgent)) {
            console.log("This is an iPhone");
            return {
                mobile: true,
                iPhone: true
            }
        } else if (/iPad/i.test(navigator.userAgent)) {
            console.log("This is an iPad");
            return {
                mobile: true,
                iPhone: true
            }
        } else if (/Macintosh/i.test(navigator.userAgent)) {
            console.log("This is a Macintosh");
            return {
                mobile: true,
                iPhone: true
            }
        } else {
            return {
                mobile: true,
                iPhone: false
            }
        }
    } else {
        console.log("This is a browser");
        return {
            mobile: false,
            iPhone: false
        }
    }
}

export const setStateTemplate = (val, i) => (prev) => {
    const new_val = [...prev]
    new_val[i] = val
    return new_val
}

export const getUTCTimefromUTCTime = (timeString) => {
    if (!timeString) return new Date()
    const modifiedTimeString = timeString.replace(' ', 'T');
    const date = new Date(modifiedTimeString);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    date.setHours(hours - 5);
    date.setMinutes(minutes - 30 - date.getTimezoneOffset());
    return date;
}

export const doDelay = (sec) => new Promise((resolve) => setTimeout(resolve, sec))
export const initBet6 = JSON.parse(localStorage.getItem(`bet6`) || '["100","200","300","400","500","600"]')

// Simple WebP/PNG format selector - modern browsers support WebP
export const webpORpng = utils.isWebGLSupported() ? "webp" : "png"
