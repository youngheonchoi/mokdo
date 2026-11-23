import StartGame from './game/main';

document.addEventListener('DOMContentLoaded', () => {
    const resize = () => {
        const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 800);
        document.documentElement.style.setProperty('--game-scale', String(scale));
    };
    resize();
    window.addEventListener('resize', resize);
    StartGame('game-container');

});
